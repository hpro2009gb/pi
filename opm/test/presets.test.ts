import { describe, expect, it } from "vitest";
import { PRESET_PACKS } from "../src/pack-registry.ts";
import { resolveLaunchPlan } from "../src/presets.ts";
import { extensionArgs } from "../src/spawn-pi.ts";

describe("resolveLaunchPlan", () => {
	it("preset pi passes no extension paths", () => {
		const plan = resolveLaunchPlan(["--preset", "pi", "-p", "hello"]);
		expect(plan.preset).toBe("pi");
		expect(plan.extensionPaths).toEqual([]);
		expect(plan.extraArgs).toEqual(["-p", "hello"]);
	});

	it("default preset is opm-verify", () => {
		const plan = resolveLaunchPlan([]);
		expect(plan.preset).toBe("opm-verify");
	});

	it("opm-verify computes four pack paths even if files are missing", () => {
		const plan = resolveLaunchPlan(["--preset", "opm-verify"]);
		expect(plan.extensionPaths).toHaveLength(4);
		expect(plan.extensionPaths.map((p) => p.replaceAll("\\", "/"))).toEqual([
			expect.stringMatching(/packs\/verify\/index\.ts$/),
			expect.stringMatching(/packs\/hashline\/index\.ts$/),
			expect.stringMatching(/packs\/ask\/index\.ts$/),
			expect.stringMatching(/packs\/lsp\/index\.ts$/),
		]);
	});

	it("opm-plan includes the plan pack after verify packs", () => {
		const plan = resolveLaunchPlan(["--preset", "opm-plan"]);
		expect(PRESET_PACKS["opm-plan"]).toEqual(["verify", "hashline", "ask", "lsp", "plan"]);
		expect(plan.extensionPaths.at(-1)?.replaceAll("\\", "/")).toMatch(/packs\/plan\/index\.ts$/);
	});

	it("unknown preset throws", () => {
		expect(() => resolveLaunchPlan(["--preset", "omp"])).toThrow(/Unknown preset: omp/);
	});
});

describe("extensionArgs", () => {
	it("skips missing pack files and records warnings", () => {
		const missing = "/tmp/opm-missing-pack/index.ts";
		const present = "/tmp/opm-present-pack/index.ts";
		const { args, warnings } = extensionArgs([missing, present], (path) => path === present);
		expect(args).toEqual(["-e", present]);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain(missing);
	});
});
