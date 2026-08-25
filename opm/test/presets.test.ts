import { describe, expect, it } from "vitest";
import { resolveLaunchPlan } from "../src/presets.ts";

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
});
