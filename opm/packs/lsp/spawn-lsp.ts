import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { delimiter, extname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type JsonRpcMessage = {
	jsonrpc: "2.0";
	id?: number;
	method?: string;
	params?: unknown;
	result?: unknown;
	error?: unknown;
};

export function encodeRpcMessage(message: unknown): Buffer {
	const body = Buffer.from(JSON.stringify(message), "utf8");
	const header = `Content-Length: ${body.byteLength}\r\n\r\n`;
	return Buffer.concat([Buffer.from(header, "ascii"), body]);
}

export class RpcFramer {
	private buffer = Buffer.alloc(0);

	push(chunk: Buffer): unknown[] {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		const messages: unknown[] = [];
		while (true) {
			const message = this.tryRead();
			if (message === undefined) {
				break;
			}
			messages.push(message);
		}
		return messages;
	}

	private tryRead(): unknown | undefined {
		const headerEnd = this.buffer.indexOf("\r\n\r\n");
		if (headerEnd < 0) {
			return undefined;
		}
		const header = this.buffer.subarray(0, headerEnd).toString("ascii");
		const match = header.match(/Content-Length:\s*(\d+)/i);
		if (!match) {
			throw new Error("LSP frame missing Content-Length");
		}
		const length = Number(match[1]);
		const bodyStart = headerEnd + 4;
		if (this.buffer.length < bodyStart + length) {
			return undefined;
		}
		const body = this.buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
		this.buffer = this.buffer.subarray(bodyStart + length);
		return JSON.parse(body) as unknown;
	}
}

export function languageIdForPath(filePath: string): string | undefined {
	switch (extname(filePath).toLowerCase()) {
		case ".ts":
			return "typescript";
		case ".tsx":
			return "typescriptreact";
		case ".js":
			return "javascript";
		case ".jsx":
			return "javascriptreact";
		default:
			return undefined;
	}
}

export function resolveTsServerBin(env: NodeJS.ProcessEnv = process.env): string | undefined {
	if (env.OPM_TSSERVER_BIN && existsSync(env.OPM_TSSERVER_BIN)) {
		return env.OPM_TSSERVER_BIN;
	}
	for (const dir of (env.PATH ?? "").split(delimiter)) {
		if (!dir) {
			continue;
		}
		const candidate = join(dir, "typescript-language-server");
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

type Pending = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
};

export class LspClient {
	private nextId = 1;
	private readonly pending = new Map<number, Pending>();
	private readonly framer = new RpcFramer();
	private child: ReturnType<typeof spawn> | undefined;
	private initialized = false;

	constructor(
		private readonly bin: string,
		private readonly cwd: string,
	) {}

	async start(): Promise<void> {
		if (this.initialized) {
			return;
		}
		this.child = spawn(this.bin, ["--stdio"], {
			cwd: this.cwd,
			stdio: ["pipe", "pipe", "pipe"],
		});
		this.child.stdout?.on("data", (chunk: Buffer) => {
			for (const message of this.framer.push(chunk)) {
				this.onMessage(message);
			}
		});
		this.child.on("error", (error) => {
			this.failAll(error instanceof Error ? error : new Error(String(error)));
		});
		this.child.on("exit", (code, signal) => {
			if (!this.initialized) {
				this.failAll(new Error(`typescript-language-server exited (${code ?? signal ?? "unknown"})`));
			}
		});
		await this.request("initialize", {
			processId: process.pid,
			rootUri: pathToFileURL(this.cwd).href,
			capabilities: {
				textDocument: {
					hover: { contentFormat: ["plaintext", "markdown"] },
					definition: { linkSupport: false },
					references: {},
					publishDiagnostics: {},
					diagnostic: {},
				},
			},
		});
		this.notify("initialized", {});
		this.initialized = true;
	}

	async diagnostics(absolutePath: string): Promise<unknown> {
		const opened = await this.open(absolutePath);
		try {
			return await this.request("textDocument/diagnostic", {
				textDocument: { uri: opened.uri },
			});
		} catch {
			return opened.diagnostics;
		}
	}

	async definition(absolutePath: string, line: number, character: number): Promise<unknown> {
		const opened = await this.open(absolutePath);
		return this.request("textDocument/definition", {
			textDocument: { uri: opened.uri },
			position: toLspPosition(line, character),
		});
	}

	async references(absolutePath: string, line: number, character: number): Promise<unknown> {
		const opened = await this.open(absolutePath);
		return this.request("textDocument/references", {
			textDocument: { uri: opened.uri },
			position: toLspPosition(line, character),
			context: { includeDeclaration: true },
		});
	}

	async hover(absolutePath: string, line: number, character: number): Promise<unknown> {
		const opened = await this.open(absolutePath);
		return this.request("textDocument/hover", {
			textDocument: { uri: opened.uri },
			position: toLspPosition(line, character),
		});
	}

	dispose(): void {
		this.failAll(new Error("LSP client disposed"));
		this.child?.kill();
		this.child = undefined;
		this.initialized = false;
	}

	private async open(absolutePath: string): Promise<{ uri: string; diagnostics: unknown[] }> {
		await this.start();
		const text = await readFile(absolutePath, "utf8");
		const uri = pathToFileURL(absolutePath).href;
		const languageId = languageIdForPath(absolutePath) ?? "plaintext";
		const diagnostics: unknown[] = [];
		this.notify("textDocument/didOpen", {
			textDocument: { uri, languageId, version: 1, text },
		});
		return { uri, diagnostics };
	}

	private request(method: string, params: unknown): Promise<unknown> {
		const id = this.nextId++;
		const message: JsonRpcMessage = { jsonrpc: "2.0", id, method, params };
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`LSP timeout: ${method}`));
			}, 8000);
			this.pending.set(id, {
				resolve: (value) => {
					clearTimeout(timer);
					resolve(value);
				},
				reject: (error) => {
					clearTimeout(timer);
					reject(error);
				},
			});
			this.write(message);
		});
	}

	private notify(method: string, params: unknown): void {
		this.write({ jsonrpc: "2.0", method, params });
	}

	private write(message: unknown): void {
		const stdin = this.child?.stdin;
		if (!stdin) {
			throw new Error("LSP server is not running");
		}
		stdin.write(encodeRpcMessage(message));
	}

	private onMessage(raw: unknown): void {
		if (!raw || typeof raw !== "object") {
			return;
		}
		const message = raw as JsonRpcMessage;
		if (message.id === undefined) {
			return;
		}
		const pending = this.pending.get(message.id);
		if (!pending) {
			return;
		}
		this.pending.delete(message.id);
		if (message.error) {
			pending.reject(new Error(JSON.stringify(message.error)));
			return;
		}
		pending.resolve(message.result);
	}

	private failAll(error: Error): void {
		for (const pending of this.pending.values()) {
			pending.reject(error);
		}
		this.pending.clear();
	}
}

function toLspPosition(line: number, character: number): { line: number; character: number } {
	return {
		line: Math.max(0, line - 1),
		character: Math.max(0, character - 1),
	};
}

const clients = new Map<string, LspClient>();

export function lspClientFor(cwd: string, env: NodeJS.ProcessEnv = process.env): LspClient | undefined {
	const bin = resolveTsServerBin(env);
	if (!bin) {
		return undefined;
	}
	const key = `${bin}::${cwd}`;
	const existing = clients.get(key);
	if (existing) {
		return existing;
	}
	const client = new LspClient(bin, cwd);
	clients.set(key, client);
	return client;
}

export function resolveFilePath(filePath: string, cwd: string): string {
	return isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
}
