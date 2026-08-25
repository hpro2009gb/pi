import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";

export type BrowserAction = "snapshot" | "screenshot";

export type ChromeExecResult = { code: number; stdout: string; stderr: string };

export type ChromeExec = (bin: string, args: string[]) => Promise<ChromeExecResult>;

export type RunBrowserInput = {
	action: BrowserAction;
	url: string;
	path?: string;
	cwd?: string;
};

export type RunBrowserResult = {
	ok: boolean;
	text: string;
};

export type RunBrowserDeps = {
	resolveBin?: (env?: NodeJS.ProcessEnv) => string | undefined;
	exec?: ChromeExec;
};

const CHROME_NAMES = ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser", "chrome"];
const DUMP_CAP = 100 * 1024;
const CHROME_TIMEOUT_MS = 15_000;
const HEADLESS = ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run"];

export function parseBrowserAction(value: string): BrowserAction {
	if (value === "snapshot" || value === "screenshot") {
		return value;
	}
	throw new Error(`Unknown browser action: ${value}`);
}

export function isAllowedBrowserUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "file:";
	} catch {
		return false;
	}
}

export function isDebugLauncherWrapper(path: string): boolean {
	try {
		const stat = statSync(path);
		if (stat.size === 0 || stat.size > 64 * 1024) {
			return false;
		}
		const text = readFileSync(path, "utf8");
		return text.startsWith("#!") && text.includes("remote-debugging-port");
	} catch {
		return false;
	}
}

export function resolveChromeBin(env: NodeJS.ProcessEnv = process.env): string | undefined {
	if (env.OPM_CHROME_BIN && existsSync(env.OPM_CHROME_BIN)) {
		return env.OPM_CHROME_BIN;
	}
	const dirs = (env.PATH ?? "").split(delimiter);
	for (const name of CHROME_NAMES) {
		for (const dir of dirs) {
			if (!dir) {
				continue;
			}
			const candidate = join(dir, name);
			if (existsSync(candidate) && !isDebugLauncherWrapper(candidate)) {
				return candidate;
			}
		}
	}
	return undefined;
}

export function buildChromeDumpArgs(url: string): string[] {
	return [...HEADLESS, "--dump-dom", url];
}

export function buildChromeScreenshotArgs(url: string, outputPath: string): string[] {
	return [...HEADLESS, `--screenshot=${outputPath}`, url];
}

function missingChromeMessage(): string {
	return "Chrome/Chromium not found on PATH. Install chromium or set OPM_CHROME_BIN. This pack is UI snapshot/screenshot only — no desktop OS control.";
}

function cap(text: string): string {
	if (text.length <= DUMP_CAP) {
		return text;
	}
	return `${text.slice(0, DUMP_CAP)}\n… truncated`;
}

export async function defaultChromeExec(
	bin: string,
	args: string[],
	timeoutMs = CHROME_TIMEOUT_MS,
): Promise<ChromeExecResult> {
	return new Promise((resolve) => {
		const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		let finished = false;
		const finish = (result: ChromeExecResult) => {
			if (finished) {
				return;
			}
			finished = true;
			clearTimeout(timer);
			resolve(result);
		};
		const timer = setTimeout(() => {
			if (child.pid !== undefined) {
				try {
					child.kill("SIGKILL");
				} catch {
					// already exited
				}
			}
			finish({ code: 1, stdout, stderr: stderr || "chrome timed out" });
		}, timeoutMs);
		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString("utf8");
		});
		child.on("error", (error) => {
			finish({ code: 1, stdout, stderr: error.message });
		});
		child.on("close", (code) => {
			finish({ code: code ?? 1, stdout, stderr });
		});
	});
}

export async function runBrowserAction(input: RunBrowserInput, deps: RunBrowserDeps = {}): Promise<RunBrowserResult> {
	const action = parseBrowserAction(input.action);
	if (!isAllowedBrowserUrl(input.url)) {
		return { ok: false, text: "browser: url must be http, https, or file" };
	}
	const resolveBin = deps.resolveBin ?? resolveChromeBin;
	const exec = deps.exec ?? defaultChromeExec;
	const bin = resolveBin();
	if (!bin) {
		return { ok: false, text: missingChromeMessage() };
	}
	const profile = mkdtempSync(join(tmpdir(), "opm-chrome-profile-"));
	try {
		if (action === "snapshot") {
			const result = await exec(bin, [...buildChromeDumpArgs(input.url), `--user-data-dir=${profile}`]);
			if (result.code !== 0) {
				return { ok: false, text: cap(result.stderr || `chrome exited ${result.code}`) };
			}
			return { ok: true, text: cap(result.stdout) };
		}
		const cwd = input.cwd ?? process.cwd();
		const rawPath = input.path ?? "opm-browser-screenshot.png";
		const outputPath = isAbsolute(rawPath) ? rawPath : join(cwd, rawPath);
		const result = await exec(bin, [...buildChromeScreenshotArgs(input.url, outputPath), `--user-data-dir=${profile}`]);
		if (result.code !== 0) {
			return { ok: false, text: cap(result.stderr || `chrome exited ${result.code}`) };
		}
		return { ok: true, text: `screenshot written to ${outputPath}` };
	} finally {
		rmSync(profile, { recursive: true, force: true });
	}
}
