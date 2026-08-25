import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { attachOpmToHost, resolveHostBin } from "../src/attach-pi.ts";
import { PACK_ORDER, opmRoot, packPath } from "../src/pack-registry.ts";
import { resolvePiBin } from "../src/spawn-pi.ts";

describe("OPM as a Pi package", () => {
	it("declares every pack under package.json pi.extensions", () => {
		const pkg = JSON.parse(readFileSync(join(opmRoot(), "package.json"), "utf8")) as {
			keywords?: string[];
			pi?: { extensions?: string[] };
		};
		expect(pkg.keywords).toContain("pi-package");
		expect(pkg.pi?.extensions).toEqual(PACK_ORDER.map((id) => `./packs/${id}/index.ts`));
		for (const id of PACK_ORDER) {
			expect(readFileSync(packPath(id), "utf8").length).toBeGreaterThan(0);
		}
	});
});

describe("resolveHostBin", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("prefers OPM_HOST_BIN, then omp on PATH, then pi, then repo pi-test.sh", () => {
		expect(resolveHostBin({ OPM_HOST_BIN: "/custom/pi" }, import.meta.url)).toEqual({
			bin: "/custom/pi",
			kind: "pi",
		});
		expect(resolveHostBin({ OPM_HOST_BIN: "/opt/omp" }, import.meta.url)).toEqual({
			bin: "/opt/omp",
			kind: "omp",
		});
		expect(resolveHostBin({ PATH: "/tmp/opm-empty-host-path" }, import.meta.url).bin.replaceAll("\\", "/")).toMatch(
			/\/pi-test\.sh$/,
		);
		expect(resolveHostBin({ PATH: "/tmp/opm-empty-host-path" }, import.meta.url).kind).toBe("source");
	});

	it("prefers omp over pi when both exist on PATH", () => {
		const dir = mkdtempSync(join(tmpdir(), "opm-host-bins-"));
		dirs.push(dir);
		writeFileSync(join(dir, "omp"), "");
		writeFileSync(join(dir, "pi"), "");
		expect(resolveHostBin({ PATH: dir }, import.meta.url)).toEqual({ bin: "omp", kind: "omp" });
	});
});

describe("attachOpmToHost", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("installs the opm package into a Pi agent dir via pi install", () => {
		const agentDir = mkdtempSync(join(tmpdir(), "opm-attach-"));
		dirs.push(agentDir);
		const piBin = resolvePiBin({ OPM_PI_FROM_SOURCE: "1" }, import.meta.url);
		const env = {
			...process.env,
			OPM_HOST_BIN: piBin,
			PI_CODING_AGENT_DIR: agentDir,
			PI_OFFLINE: "1",
		};
		const attached = attachOpmToHost({ env, fromFileUrl: import.meta.url });
		expect(attached.status, `${attached.stdout}\n${attached.stderr}`).toBe(0);
		expect(`${attached.stdout}\n${attached.stderr}`).toMatch(/Installed /);

		const settings = JSON.parse(readFileSync(join(agentDir, "settings.json"), "utf8")) as {
			packages?: Array<string | { source: string }>;
		};
		const sources = (settings.packages ?? []).map((pkg) => (typeof pkg === "string" ? pkg : pkg.source));
		expect(sources.some((source) => source.includes("opm") || source === opmRoot())).toBe(true);

		const listed = spawnSync(piBin, ["list"], { encoding: "utf8", env });
		expect(listed.status).toBe(0);
		expect(listed.stdout).toMatch(/opm/);

		const help = spawnSync(piBin, ["--help"], { encoding: "utf8", env });
		expect(help.status).toBe(0);
		expect(help.stdout).toMatch(/--plan/);
		expect(help.stdout).toMatch(/--sandbox/);
	});
});
