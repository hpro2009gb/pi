import { describe, expect, it } from "vitest";
import {
	MAX_PARALLEL_TASKS,
	applyPreviousPlaceholder,
	buildTaskArgs,
	formatFanoutReport,
	mapWithConcurrencyLimit,
	parseFanoutInput,
	parseTaskAgent,
	runFanoutJobs,
} from "../packs/task/invoke.ts";

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

describe("parseFanoutInput", () => {
	it("parses single scout/worker", () => {
		expect(parseFanoutInput({ agent: "scout", task: "find auth" })).toEqual({
			ok: true,
			mode: "single",
			jobs: [{ agent: "scout", task: "find auth" }],
		});
	});

	it("parses parallel tasks", () => {
		const parsed = parseFanoutInput({
			tasks: [
				{ agent: "scout", task: "a" },
				{ agent: "worker", task: "b" },
			],
		});
		expect(parsed).toEqual({
			ok: true,
			mode: "parallel",
			jobs: [
				{ agent: "scout", task: "a" },
				{ agent: "worker", task: "b" },
			],
		});
	});

	it("parses chain", () => {
		const parsed = parseFanoutInput({
			chain: [
				{ agent: "scout", task: "map files" },
				{ agent: "worker", task: "fix based on {previous}" },
			],
		});
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.mode).toBe("chain");
			expect(parsed.jobs).toHaveLength(2);
		}
	});

	it("rejects mixing modes", () => {
		const parsed = parseFanoutInput({
			agent: "scout",
			task: "a",
			tasks: [{ agent: "scout", task: "b" }],
		});
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.error).toMatch(/exactly one/i);
		}
	});

	it("rejects too many parallel tasks", () => {
		const tasks = Array.from({ length: MAX_PARALLEL_TASKS + 1 }, (_, i) => ({
			agent: "scout" as const,
			task: `t${i}`,
		}));
		const parsed = parseFanoutInput({ tasks });
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.error).toMatch(/Too many parallel tasks/);
		}
	});
});

describe("mapWithConcurrencyLimit", () => {
	it("preserves order and caps in-flight work", async () => {
		let current = 0;
		let max = 0;
		const results = await mapWithConcurrencyLimit([1, 2, 3, 4], 2, async (n) => {
			current += 1;
			max = Math.max(max, current);
			await new Promise((resolve) => setTimeout(resolve, 20));
			current -= 1;
			return n * 10;
		});
		expect(results).toEqual([10, 20, 30, 40]);
		expect(max).toBe(2);
	});
});

describe("applyPreviousPlaceholder", () => {
	it("substitutes chain {previous}", () => {
		expect(applyPreviousPlaceholder("use {previous} here", "MAP")).toBe("use MAP here");
	});
});

describe("runFanoutJobs", () => {
	it("runs parallel jobs concurrently", async () => {
		let current = 0;
		let max = 0;
		const parsed = parseFanoutInput({
			tasks: [
				{ agent: "scout", task: "a" },
				{ agent: "scout", task: "b" },
				{ agent: "scout", task: "c" },
			],
		});
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) {
			return;
		}
		const { results, text } = await runFanoutJobs(parsed, async (job) => {
			current += 1;
			max = Math.max(max, current);
			await new Promise((resolve) => setTimeout(resolve, 25));
			current -= 1;
			return { code: 0, stdout: job.task, stderr: "" };
		}, { concurrency: 2 });
		expect(results.map((r) => r.stdout)).toEqual(["a", "b", "c"]);
		expect(max).toBe(2);
		expect(text).toMatch(/Parallel: 3\/3 succeeded/);
	});

	it("chains with {previous} and stops on failure", async () => {
		const parsed = parseFanoutInput({
			chain: [
				{ agent: "scout", task: "map" },
				{ agent: "worker", task: "edit {previous}" },
			],
		});
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) {
			return;
		}
		const seen: string[] = [];
		const { text } = await runFanoutJobs(parsed, async (job) => {
			seen.push(job.task);
			if (job.agent === "scout") {
				return { code: 1, stdout: "", stderr: "boom" };
			}
			return { code: 0, stdout: "should not run", stderr: "" };
		});
		expect(seen).toEqual(["map"]);
		expect(text).toMatch(/Chain stopped at step 1/);
	});

	it("passes prior stdout into the next chain task", async () => {
		const parsed = parseFanoutInput({
			chain: [
				{ agent: "scout", task: "map" },
				{ agent: "worker", task: "edit {previous}" },
			],
		});
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) {
			return;
		}
		const seen: string[] = [];
		await runFanoutJobs(parsed, async (job) => {
			seen.push(job.task);
			return { code: 0, stdout: job.agent === "scout" ? "AUTH.ts" : "done", stderr: "" };
		});
		expect(seen).toEqual(["map", "edit AUTH.ts"]);
	});
});

describe("formatFanoutReport", () => {
	it("keeps single-job output compact", () => {
		const text = formatFanoutReport(
			"single",
			[{ agent: "scout", task: "find auth" }],
			[{ code: 0, stdout: "ok", stderr: "" }],
		);
		expect(text).toContain("agent=scout exit=0");
		expect(text).toContain("ok");
	});
});
