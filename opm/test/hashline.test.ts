import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applyHashlineEdits, lineAnchors } from "../packs/hashline/anchors.ts";

function hashLine(line: string): string {
	return createHash("sha256").update(line, "utf8").digest("hex").slice(0, 8);
}

describe("lineAnchors", () => {
	it("returns one anchor per line for LF content", () => {
		expect(lineAnchors("a\nb\n")).toHaveLength(2);
	});
});

describe("applyHashlineEdits", () => {
	it("requires occurrence for identical lines", () => {
		const content = "x\nx\n";
		const hash = hashLine("x");
		const [first, second] = lineAnchors(content);
		expect(first.hash).toBe(hash);
		expect(second.hash).toBe(hash);

		const missingOccurrence = applyHashlineEdits(content, [{ hash, newText: "y" }]);
		expect("error" in missingOccurrence).toBe(true);

		expect(applyHashlineEdits(content, [{ hash, occurrence: 1, newText: "y" }])).toEqual({ next: "y\nx\n" });
		expect(applyHashlineEdits(content, [{ hash, occurrence: 2, newText: "z" }])).toEqual({ next: "x\nz\n" });
	});

	it("returns an error containing stale for a missing hash", () => {
		const result = applyHashlineEdits("a\n", [{ hash: "deadbeef", newText: "b" }]);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toMatch(/stale/i);
		}
	});
});
