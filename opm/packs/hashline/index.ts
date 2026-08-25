import { detectSupportedImageMimeTypeFromFile, type ExtensionAPI, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Type } from "typebox";
import { applyHashlineEdits, formatHashlineRead } from "./anchors.ts";

const readSchema = Type.Object({
	path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
	offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});

const hashlineEditSchema = Type.Object({
	hash: Type.String({ description: "First 8 hex chars of SHA-256 of the exact line without newline" }),
	occurrence: Type.Optional(Type.Number({ description: "1-based occurrence when the hash matches multiple lines" })),
	newText: Type.String({ description: "Replacement text for the matched line" }),
});

const editSchema = Type.Object({
	path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
	edits: Type.Array(hashlineEditSchema, {
		description: "Hashline replacements applied against the original file. Never a partial write.",
	}),
});

function isBinaryBuffer(buffer: Buffer): boolean {
	return buffer.includes(0);
}

export default function hashlinePack(pi: ExtensionAPI): void {
	if (process.env.OPM_HASHLINE === "0") {
		return;
	}

	pi.registerTool({
		name: "read",
		label: "read (hashline)",
		description:
			"Read a file. Text files are prefixed with <!-- hashline --> and each line is HHHHHHHH| so edit can target content hashes. Images and binary files are unchanged.",
		parameters: readSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const absolutePath = resolve(ctx.cwd, params.path);
			await access(absolutePath, constants.R_OK);
			const mimeType = await detectSupportedImageMimeTypeFromFile(absolutePath);
			if (mimeType) {
				const buffer = await readFile(absolutePath);
				return {
					content: [
						{ type: "text" as const, text: `Read image file [${mimeType}]` },
						{ type: "image" as const, data: buffer.toString("base64"), mimeType },
					],
				};
			}
			const buffer = await readFile(absolutePath);
			if (isBinaryBuffer(buffer)) {
				return {
					content: [{ type: "text" as const, text: `Binary file (${buffer.length} bytes); hashline prefixes not applied.` }],
				};
			}
			const text = formatHashlineRead(buffer.toString("utf8"), params.offset, params.limit);
			return {
				content: [{ type: "text" as const, text }],
			};
		},
	});

	pi.registerTool({
		name: "edit",
		label: "edit (hashline)",
		description:
			"Edit a file by replacing lines identified by hashline hashes from read. If a hash is stale or occurrence is out of bounds, the call fails and the file is not written.",
		parameters: editSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const absolutePath = resolve(ctx.cwd, params.path);
			return withFileMutationQueue(absolutePath, async () => {
				await access(absolutePath, constants.R_OK | constants.W_OK);
				const original = await readFile(absolutePath, "utf8");
				const result = applyHashlineEdits(original, params.edits);
				if ("error" in result) {
					throw new Error(result.error);
				}
				await writeFile(absolutePath, result.next, "utf8");
				return {
					content: [{ type: "text" as const, text: `Edited ${params.path} (${params.edits.length} hashline replacement(s)).` }],
				};
			});
		},
	});
}
