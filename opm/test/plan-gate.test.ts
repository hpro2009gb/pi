import { describe, expect, it } from "vitest";
import { isPlanSafeBash } from "../packs/plan/index.ts";

describe("isPlanSafeBash", () => {
	it("allows read-only inspection commands", () => {
		expect(isPlanSafeBash("ls -la")).toBe(true);
		expect(isPlanSafeBash("rg foo")).toBe(true);
		expect(isPlanSafeBash("git status")).toBe(true);
	});

	it("blocks writes and git mutations", () => {
		expect(isPlanSafeBash("git commit -am x")).toBe(false);
		expect(isPlanSafeBash("rm -rf src")).toBe(false);
		expect(isPlanSafeBash("echo hi > file.txt")).toBe(false);
	});
});
