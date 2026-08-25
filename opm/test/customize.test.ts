import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	formatPackCheckboxes,
	loadCustomPacks,
	parseCustomizeArgs,
	runCustomize,
	saveCustomPacks,
} from "../src/customize.ts";
import { resolveLaunchPlan } from "../src/presets.ts";

describe("customize packs", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("saves a suggested combo with toggles for --profile custom", () => {
		const dir = mkdtempSync(join(tmpdir(), "opm-custom-"));
		dirs.push(dir);
		const suggested = resolveLaunchPlan(["--profile", "claude-code", "--with", "hashline", "--without", "lsp"]);
		saveCustomPacks(dir, suggested.packs, suggested.preset);
		expect(JSON.parse(readFileSync(join(dir, "custom-packs.json"), "utf8"))).toEqual({
			from: "claude-code",
			packs: ["verify", "hashline", "ask", "plan"],
		});
		expect(loadCustomPacks(dir)).toEqual(["verify", "hashline", "ask", "plan"]);
		const loaded = resolveLaunchPlan(["--profile", "custom"], { savedCustomPacks: loadCustomPacks(dir) });
		expect(loaded.packs).toEqual(["verify", "hashline", "ask", "plan"]);
	});

	it("renders checkboxes for selected weapons", () => {
		const text = formatPackCheckboxes(["verify", "ask"]);
		expect(text).toMatch(/\[x\] verify/);
		expect(text).toMatch(/\[ \] hashline/);
		expect(text).toMatch(/\[x\] ask/);
		expect(text).toMatch(/\[ \] plan/);
		expect(text).toMatch(/\[ \] browser/);
		expect(text).not.toMatch(/chưa v1/);
	});

	it("parses --from and leaves toggles for resolveLaunchPlan", () => {
		expect(parseCustomizeArgs(["--from", "claude-code", "--with", "hashline", "--without", "lsp"])).toEqual({
			from: "claude-code",
			rest: ["--with", "hashline", "--without", "lsp"],
		});
	});

	it("saves a customized suggestion via runCustomize", () => {
		const dir = mkdtempSync(join(tmpdir(), "opm-custom-"));
		dirs.push(dir);
		const output = runCustomize(["--from", "claude-code", "--with", "hashline", "--without", "lsp"], dir);
		expect(output).toMatch(/Saved custom combo from claude-code/);
		expect(output).toMatch(/\[x\] hashline/);
		expect(output).toMatch(/\[ \] lsp/);
		expect(JSON.parse(readFileSync(join(dir, "custom-packs.json"), "utf8"))).toEqual({
			from: "claude-code",
			packs: ["verify", "hashline", "ask", "plan"],
		});
	});
});
