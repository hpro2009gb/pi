import { createHash } from "node:crypto";

export type LineAnchor = {
	hash: string;
	line: string;
};

export type HashlineEdit = {
	hash: string;
	occurrence?: number;
	newText: string;
};

export function normalizeToLF(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function detectLineEnding(content: string): "\r\n" | "\n" {
	const crlfIdx = content.indexOf("\r\n");
	const lfIdx = content.indexOf("\n");
	if (lfIdx === -1) return "\n";
	if (crlfIdx === -1) return "\n";
	return crlfIdx < lfIdx ? "\r\n" : "\n";
}

export function restoreLineEndings(text: string, ending: "\r\n" | "\n"): string {
	return ending === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

export function lineHash(line: string): string {
	return createHash("sha256").update(line, "utf8").digest("hex").slice(0, 8);
}

function splitLines(content: string): { lines: string[]; endsWithNewline: boolean; ending: "\r\n" | "\n" } {
	const ending = detectLineEnding(content);
	const lf = normalizeToLF(content);
	const endsWithNewline = lf.endsWith("\n");
	const body = endsWithNewline ? lf.slice(0, -1) : lf;
	return { lines: body.split("\n"), endsWithNewline, ending };
}

export function lineAnchors(content: string): LineAnchor[] {
	return splitLines(content).lines.map((line) => ({ hash: lineHash(line), line }));
}

export function formatHashlineRead(content: string, offset?: number, limit?: number): string {
	const anchors = lineAnchors(content);
	const start = offset ? Math.max(0, offset - 1) : 0;
	if (start >= anchors.length) {
		throw new Error(`Offset ${offset} is beyond end of file (${anchors.length} lines total)`);
	}
	const selected = limit !== undefined ? anchors.slice(start, start + limit) : anchors.slice(start);
	const body = selected.map((anchor) => `${anchor.hash}|${anchor.line}`).join("\n");
	return `<!-- hashline -->\n${body}`;
}

export function applyHashlineEdits(content: string, edits: HashlineEdit[]): { next: string } | { error: string } {
	const { lines, endsWithNewline, ending } = splitLines(content);
	const replacements = new Map<number, string>();

	for (const edit of edits) {
		const hash = edit.hash.toLowerCase();
		const matches: number[] = [];
		for (let i = 0; i < lines.length; i++) {
			if (lineHash(lines[i]!) === hash) {
				matches.push(i);
			}
		}
		if (matches.length === 0) {
			return { error: `stale hash ${edit.hash}: line not found` };
		}

		let index: number;
		if (matches.length > 1) {
			if (edit.occurrence === undefined) {
				return {
					error: `hash ${edit.hash} matches ${matches.length} lines; set occurrence (1-based)`,
				};
			}
			const matched = matches[edit.occurrence - 1];
			if (matched === undefined) {
				return { error: `occurrence ${edit.occurrence} is out of bounds for hash ${edit.hash}` };
			}
			index = matched;
		} else if (edit.occurrence !== undefined && edit.occurrence !== 1) {
			return { error: `occurrence ${edit.occurrence} is out of bounds for hash ${edit.hash}` };
		} else {
			index = matches[0]!;
		}

		if (replacements.has(index)) {
			return { error: `duplicate edit for line ${index + 1}` };
		}
		replacements.set(index, edit.newText);
	}

	const nextLines: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		const replacement = replacements.get(i);
		if (replacement === undefined) {
			nextLines.push(lines[i]!);
			continue;
		}
		nextLines.push(...normalizeToLF(replacement).split("\n"));
	}

	let next = nextLines.join("\n");
	if (endsWithNewline) {
		next += "\n";
	}
	return { next: restoreLineEndings(next, ending) };
}
