import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PACK_ORDER, packPath, PRESET_PACKS, type PackId } from "../src/pack-registry.ts";
import { resolveLaunchPlan } from "../src/presets.ts";
import { extensionArgs } from "../src/spawn-pi.ts";

const SUPER: PackId[] = ["verify", "hashline", "ask", "plan", "lsp", "sandbox", "task", "browser"];

describe("opm-full / pi-super shipped packs", () => {
	it("every registered pack has an extension file on disk", () => {
		for (const id of PACK_ORDER) {
			expect(existsSync(packPath(id)), `missing pack file: ${id}`).toBe(true);
		}
	});

	it("pi-super and opm-full load every pack without skip-missing warnings", () => {
		expect(PRESET_PACKS["pi-super"]).toEqual(SUPER);
		expect(PRESET_PACKS["opm-full"]).toEqual(SUPER);
		for (const name of ["pi-super", "opm-full"] as const) {
			const plan = resolveLaunchPlan(["--preset", name]);
			expect(plan.packs).toEqual(SUPER);
			expect(plan.extraArgs).toEqual([]);
			const { args, warnings } = extensionArgs(plan.extensionPaths);
			expect(warnings).toEqual([]);
			expect(args.filter((flag) => flag === "-e")).toHaveLength(SUPER.length);
			for (const id of SUPER) {
				expect(args.some((arg) => arg.replaceAll("\\", "/").endsWith(`packs/${id}/index.ts`))).toBe(true);
			}
		}
	});

	it("does not register a computer pack or preset", () => {
		expect(PACK_ORDER).not.toContain("computer");
		expect(() => resolveLaunchPlan(["--with", "computer"])).toThrow(/Unknown pack: computer/);
	});
});
