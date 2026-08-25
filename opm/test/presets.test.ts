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

	it("opm-plan includes the plan pack", () => {
		const plan = resolveLaunchPlan(["--preset", "opm-plan"]);
		expect(PRESET_PACKS["opm-plan"]).toEqual(["verify", "hashline", "ask", "plan", "lsp"]);
		expect(plan.packs).toEqual(["verify", "hashline", "ask", "plan", "lsp"]);
		const paths = plan.extensionPaths.map((p) => p.replaceAll("\\", "/"));
		expect(paths.some((p) => p.endsWith("packs/plan/index.ts"))).toBe(true);
	});

	it("unknown preset throws", () => {
		expect(() => resolveLaunchPlan(["--preset", "omp"])).toThrow(/Unknown preset or profile: omp/);
	});

	it("profile claude-code loads ask+plan+lsp without hashline", () => {
		const plan = resolveLaunchPlan(["--profile", "claude-code", "-p", "hello"]);
		expect(plan.preset).toBe("claude-code");
		expect(plan.extraArgs).toEqual(["-p", "hello"]);
		const paths = plan.extensionPaths.map((p) => p.replaceAll("\\", "/"));
		expect(paths.some((p) => p.endsWith("packs/ask/index.ts"))).toBe(true);
		expect(paths.some((p) => p.endsWith("packs/plan/index.ts"))).toBe(true);
		expect(paths.some((p) => p.endsWith("packs/lsp/index.ts"))).toBe(true);
		expect(paths.some((p) => p.endsWith("packs/hashline/index.ts"))).toBe(false);
	});

	it("profile cline starts in plan mode", () => {
		const plan = resolveLaunchPlan(["--profile", "cline"]);
		expect(plan.preset).toBe("cline");
		expect(plan.extraArgs).toEqual(["--plan"]);
	});

	it("profile cline does not duplicate --plan", () => {
		const plan = resolveLaunchPlan(["--profile", "cline", "--plan"]);
		expect(plan.extraArgs).toEqual(["--plan"]);
	});

	it("toggles packs on a suggested profile with --with and --without", () => {
		const plan = resolveLaunchPlan(["--profile", "claude-code", "--with", "hashline", "--without", "lsp"]);
		expect(plan.packs).toEqual(["verify", "hashline", "ask", "plan"]);
		const paths = plan.extensionPaths.map((p) => p.replaceAll("\\", "/"));
		expect(paths.some((p) => p.endsWith("packs/hashline/index.ts"))).toBe(true);
		expect(paths.some((p) => p.endsWith("packs/lsp/index.ts"))).toBe(false);
	});

	it("custom requires --with or saved packs", () => {
		expect(() => resolveLaunchPlan(["--profile", "custom"])).toThrow(/custom requires --with/);
	});

	it("custom builds a pack list from --with", () => {
		const plan = resolveLaunchPlan(["--preset", "custom", "--with", "verify,ask"]);
		expect(plan.preset).toBe("custom");
		expect(plan.packs).toEqual(["verify", "ask"]);
		expect(plan.extraArgs).toEqual([]);
	});

	it("custom uses saved packs when --with is omitted", () => {
		const plan = resolveLaunchPlan(["--profile", "custom"], { savedCustomPacks: ["verify", "hashline"] });
		expect(plan.packs).toEqual(["verify", "hashline"]);
	});

	it("pi-super is the researched full v1 kit without forcing plan mode", () => {
		const plan = resolveLaunchPlan(["--preset", "pi-super"]);
		expect(plan.packs).toEqual(["verify", "hashline", "ask", "plan", "lsp"]);
		expect(plan.extraArgs).toEqual([]);
	});

	it("cline without plan pack does not inject --plan", () => {
		const plan = resolveLaunchPlan(["--profile", "cline", "--without", "plan"]);
		expect(plan.packs).toEqual(["verify", "ask"]);
		expect(plan.extraArgs).toEqual([]);
	});

	it("unknown pack in --with throws", () => {
		expect(() => resolveLaunchPlan(["--with", "laser"])).toThrow(/Unknown pack: laser/);
	});

	it("profile codex loads sandbox and starts in workspace profile", () => {
		const plan = resolveLaunchPlan(["--profile", "codex"]);
		expect(plan.packs).toEqual(["verify", "sandbox"]);
		expect(plan.extraArgs).toEqual(["--sandbox", "workspace"]);
	});

	it("profile codex does not duplicate --sandbox", () => {
		const plan = resolveLaunchPlan(["--profile", "codex", "--sandbox", "off"]);
		expect(plan.extraArgs).toEqual(["--sandbox", "off"]);
	});

	it("codex without sandbox pack does not inject --sandbox", () => {
		const plan = resolveLaunchPlan(["--profile", "codex", "--without", "sandbox"]);
		expect(plan.packs).toEqual(["verify"]);
		expect(plan.extraArgs).toEqual([]);
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
