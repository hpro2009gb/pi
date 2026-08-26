import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { packOpm, parsePackArgs } from "../src/pack.ts";
import { opmRoot } from "../src/pack-registry.ts";

describe("parsePackArgs", () => {
	it("defaults to a directory plus tarball", () => {
		expect(parsePackArgs([])).toEqual({ outDir: undefined, tarball: true });
		expect(parsePackArgs(["--out", "/tmp/sp", "--no-tarball"])).toEqual({
			outDir: "/tmp/sp",
			tarball: false,
		});
	});
});

describe("packOpm", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("copies cli and packs, writes install.sh, skips tests", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-pack-"));
		dirs.push(root);
		const outDir = join(root, "super-pi");
		const result = packOpm({
			sourceRoot: opmRoot(),
			outDir,
			tarball: false,
			repoRoot: join(opmRoot(), ".."),
		});
		expect(result.packDir).toBe(outDir);
		expect(existsSync(join(outDir, "src", "cli.ts"))).toBe(true);
		expect(existsSync(join(outDir, "packs", "verify", "index.ts"))).toBe(true);
		expect(existsSync(join(outDir, "install.sh"))).toBe(true);
		expect(existsSync(join(outDir, "opm.sh"))).toBe(true);
		expect(existsSync(join(outDir, "pack.json"))).toBe(true);
		expect(existsSync(join(outDir, "test"))).toBe(false);
		const meta = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as {
			kind: string;
			piTestSh?: string;
		};
		expect(meta.kind).toBe("opm-pack");
		expect(meta.piTestSh?.replaceAll("\\", "/")).toMatch(/\/pi-test\.sh$/);
		const install = readFileSync(join(outDir, "install.sh"), "utf8");
		expect(install).toContain("install-app --from-pack");
		expect(install).not.toMatch(/\bomp\b/);
		expect(install).not.toMatch(/\bnpm publish\b/);
	});

	it("writes a tarball next to the pack directory", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-pack-tgz-"));
		dirs.push(root);
		const outDir = join(root, "super-pi");
		const result = packOpm({
			sourceRoot: opmRoot(),
			outDir,
			tarball: true,
			repoRoot: join(opmRoot(), ".."),
		});
		expect(result.tarballPath).toBe(`${outDir}.tgz`);
		expect(existsSync(result.tarballPath ?? "")).toBe(true);
	});
});

describe("pack then install-app --from-pack", () => {
	it("installs super-pi from the tarball extract without naming pi or omp", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-pack-install-"));
		const outDir = join(root, "super-pi");
		const packed = packOpm({
			sourceRoot: opmRoot(),
			outDir,
			tarball: false,
			repoRoot: join(opmRoot(), ".."),
		});
		const binDir = join(root, "bin");
		const agentDir = join(root, ".super-pi", "agent");
		mkdirSync(binDir, { recursive: true });
		writeFileSync(join(binDir, "omp"), "#!/bin/sh\necho host-omp\n");
		chmodSync(join(binDir, "omp"), 0o755);
		const install = spawnSync("bash", [join(packed.packDir, "install.sh"), "--bin-dir", binDir, "--agent-dir", agentDir], {
			encoding: "utf8",
			env: { ...process.env, HOME: root, PATH: `${binDir}:${process.env.PATH ?? ""}` },
		});
		expect(install.status, install.stderr + install.stdout).toBe(0);
		expect(existsSync(join(binDir, "super-pi"))).toBe(true);
		expect(readFileSync(join(binDir, "omp"), "utf8")).toContain("host-omp");
		expect(existsSync(join(root, ".super-pi", "lib", "src", "cli.ts"))).toBe(true);
		const wrapper = readFileSync(join(binDir, "super-pi"), "utf8");
		expect(wrapper).toContain(join(root, ".super-pi", "lib", "src", "cli.ts"));
		expect(wrapper).toContain(`PI_CODING_AGENT_DIR="\${PI_CODING_AGENT_DIR:-${agentDir}}"`);
		expect(wrapper).not.toMatch(/\bexec omp\b/);
		const dry = spawnSync(join(binDir, "super-pi"), ["--dry-run"], {
			encoding: "utf8",
			env: { ...process.env, HOME: root, OPM_QUIET: "1" },
		});
		expect(dry.status, dry.stderr).toBe(0);
		expect(dry.stdout).toMatch(/preset: pi-super/);
		rmSync(root, { recursive: true, force: true });
	});
});
