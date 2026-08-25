import { spawnSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { opmRoot } from "../src/pack-registry.ts";
import { resolveLaunchPlan } from "../src/presets.ts";
import { formatDryRun, formatLaunchBanner, peelOpmCliFlags, resolvePiBin } from "../src/spawn-pi.ts";

const repoRoot = join(opmRoot(), "..");

describe("peelOpmCliFlags", () => {
	it("strips --dry-run so Pi never sees it", () => {
		expect(peelOpmCliFlags(["--preset", "pi-super", "--dry-run", "--verbose"])).toEqual({
			dryRun: true,
			rest: ["--preset", "pi-super", "--verbose"],
		});
	});
});

describe("formatDryRun / banner", () => {
	it("describes pi-super packs and paths without spawning", () => {
		const plan = resolveLaunchPlan(["--preset", "pi-super"]);
		const piBin = resolvePiBin({ OPM_PI_FROM_SOURCE: "1" }, import.meta.url);
		const text = formatDryRun(plan, piBin);
		expect(text).toMatch(/^preset: pi-super$/m);
		expect(text).toMatch(/packs: verify, hashline, ask, plan, lsp, sandbox, task, browser, ttsr, memory/);
		expect(text).toMatch(/pi-test\.sh/);
		expect(text).toMatch(/packs\/ttsr\/index\.ts/);
		expect(text).toMatch(/packs\/memory\/index\.ts/);
		expect(formatLaunchBanner(plan)).toBe(
			"opm pi-super: verify, hashline, ask, plan, lsp, sandbox, task, browser, ttsr, memory\n",
		);
	});
});

describe("repo launch wrappers", () => {
	it("opm.sh and opm-super.sh --dry-run print the pi-super kit", () => {
		expect(existsSync(join(repoRoot, "opm.sh"))).toBe(true);
		expect(existsSync(join(repoRoot, "opm-super.sh"))).toBe(true);
		chmodSync(join(repoRoot, "opm.sh"), 0o755);
		chmodSync(join(repoRoot, "opm-super.sh"), 0o755);
		const result = spawnSync("bash", [join(repoRoot, "opm-super.sh"), "--dry-run"], {
			encoding: "utf8",
			env: { ...process.env, OPM_QUIET: "1" },
		});
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toMatch(/preset: pi-super/);
		expect(result.stdout).toMatch(/ttsr/);
		expect(result.stdout).toMatch(/memory/);
	});
});
