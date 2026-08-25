import { describe, expect, it } from "vitest";
import { shouldBlockGitWrite } from "../packs/verify/index.ts";

describe("shouldBlockGitWrite", () => {
	it("blocks git commit when the user did not ask to commit", () => {
		expect(shouldBlockGitWrite("git commit -am x", "fix the bug")).toBe(true);
	});

	it("allows git commit when the user asked in Vietnamese", () => {
		expect(shouldBlockGitWrite("git commit -am x", "hay commit giup minh")).toBe(false);
	});
});
