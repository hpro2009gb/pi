import { describe, expect, it } from "vitest";
import { buildTaskArgs, parseTaskAgent } from "../packs/task/invoke.ts";

describe("parseTaskAgent", () => {
	it("accepts scout and worker", () => {
		expect(parseTaskAgent("scout")).toBe("scout");
		expect(parseTaskAgent("worker")).toBe("worker");
	});

	it("rejects unknown agents", () => {
		expect(() => parseTaskAgent("laser")).toThrow(/Unknown agent: laser/);
	});
});

describe("buildTaskArgs", () => {
	it("scout is read-only: read+bash, no edit/write", () => {
		const args = buildTaskArgs({
			agent: "scout",
			task: "find auth",
			verifyPack: "/workspace/opm/packs/verify/index.ts",
		});
		expect(args).toContain("--no-extensions");
		expect(args).toContain("-e");
		expect(args).toContain("/workspace/opm/packs/verify/index.ts");
		expect(args).toContain("--tools");
		const tools = args[args.indexOf("--tools") + 1];
		expect(tools).toBe("read,bash");
		expect(args.join(" ")).not.toMatch(/\bedit\b/);
		expect(args.join(" ")).not.toMatch(/\bwrite\b/);
		expect(args.at(-1)).toBe("find auth");
	});

	it("worker inherits verify and does not restrict tools", () => {
		const args = buildTaskArgs({
			agent: "worker",
			task: "fix the bug",
			verifyPack: "/workspace/opm/packs/verify/index.ts",
		});
		expect(args).toContain("-e");
		expect(args).toContain("/workspace/opm/packs/verify/index.ts");
		expect(args.includes("--tools")).toBe(false);
		expect(args.at(-1)).toBe("fix the bug");
	});
});
