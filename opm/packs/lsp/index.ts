import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
	languageIdForPath,
	lspClientFor,
	resolveFilePath,
	resolveTsServerBin,
} from "./spawn-lsp.ts";

const lspParams = Type.Object({
	action: Type.Union([
		Type.Literal("diagnostics"),
		Type.Literal("definition"),
		Type.Literal("references"),
		Type.Literal("hover"),
	]),
	path: Type.String({ description: "Path to a TypeScript or JavaScript file" }),
	line: Type.Optional(Type.Number({ description: "1-based line number" })),
	character: Type.Optional(Type.Number({ description: "1-based column number" })),
});

function missingServerMessage(): string {
	return "typescript-language-server not found on PATH. Install it or set OPM_TSSERVER_BIN. The lsp pack does not crash Pi when the server is missing.";
}

function formatResult(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

async function runLspAction(
	cwd: string,
	params: {
		action: "diagnostics" | "definition" | "references" | "hover";
		path: string;
		line?: number;
		character?: number;
	},
): Promise<string> {
	const languageId = languageIdForPath(params.path);
	if (!languageId) {
		return "unsupported in v1";
	}
	if (!resolveTsServerBin()) {
		return missingServerMessage();
	}
	const client = lspClientFor(cwd);
	if (!client) {
		return missingServerMessage();
	}
	const absolutePath = resolveFilePath(params.path, cwd);
	if (params.action === "diagnostics") {
		return formatResult(await client.diagnostics(absolutePath));
	}
	if (params.line === undefined || params.character === undefined) {
		return "line and character are required for this action (1-based)";
	}
	if (params.action === "definition") {
		return formatResult(await client.definition(absolutePath, params.line, params.character));
	}
	if (params.action === "references") {
		return formatResult(await client.references(absolutePath, params.line, params.character));
	}
	return formatResult(await client.hover(absolutePath, params.line, params.character));
}

export default function lspPack(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "lsp",
		label: "lsp",
		description:
			"TypeScript/JavaScript language intelligence via typescript-language-server. Actions: diagnostics, definition, references, hover. Other languages: unsupported in v1.",
		parameters: lspParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			try {
				const text = await runLspAction(ctx.cwd, params);
				return {
					content: [{ type: "text" as const, text }],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text" as const, text: `lsp error: ${message}` }],
					isError: true,
				};
			}
		},
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "edit" && event.toolName !== "write") {
			return;
		}
		if (event.isError) {
			return;
		}
		const path = "path" in event.input && typeof event.input.path === "string" ? event.input.path : "";
		if (!languageIdForPath(path)) {
			return;
		}
		let note: string;
		try {
			note = await runLspAction(ctx.cwd, { action: "diagnostics", path });
		} catch (error) {
			note = error instanceof Error ? error.message : String(error);
		}
		if (ctx.hasUI) {
			ctx.ui.notify(note.length > 240 ? `${note.slice(0, 237)}...` : note, "info");
		}
		const suffix = `\n\n[lsp diagnostics]\n${note}`;
		const content = event.content.map((block) => {
			if (block.type === "text") {
				return { ...block, text: `${block.text}${suffix}` };
			}
			return block;
		});
		return { content };
	});
}
