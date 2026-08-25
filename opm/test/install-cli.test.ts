import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { forbiddenInstallNames, formatOpmWrapper, installCli, parseInstallCliArgs } from "../src/install-cli.ts";

describe("parseInstallCliArgs", () => {
	it("defaults to copy auth and ~/.local/bin", () => {
		expect(parseInstallCliArgs([])).toEqual({
			binDir: undefined,
			shareAuth: false,
			force: false,
		});
		expect(parseInstallCliArgs(["--share-auth", "--bin-dir", "/tmp/bin", "--force"])).toEqual({
			binDir: "/tmp/bin",
			shareAuth: true,
			force: true,
		});
	});
});

describe("forbiddenInstallNames", () => {
	it("never installs as pi or omp", () => {
		expect(forbiddenInstallNames()).toEqual(["omp", "pi"]);
	});
});

describe("formatOpmWrapper", () => {
	it("pins PI_CODING_AGENT_DIR and repo opm.sh, never execs omp/pi by name", () => {
		const text = formatOpmWrapper({
			repoRoot: "/repo/pi",
			agentDir: "/home/u/.opm/agent",
			shareAuth: false,
		});
		expect(text).toContain("# opm-install-cli");
		expect(text).toContain('PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-/home/u/.opm/agent}"');
		expect(text).toContain('OPM_AUTH_SHARE="${OPM_AUTH_SHARE:-0}"');
		expect(text).toContain('exec "/repo/pi/opm.sh" --preset pi-super');
		expect(text).toContain('exec "/repo/pi/opm.sh" "$@"');
		expect(text).not.toMatch(/\bomp\b/);
	});
});

describe("installCli", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("writes ~/.local-style bin/opm and copies host auth into a private agent dir", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-install-"));
		dirs.push(root);
		const binDir = join(root, "bin");
		const agentDir = join(root, "opm-agent");
		const repoRoot = join(root, "repo");
		mkdirSync(join(repoRoot), { recursive: true });
		writeFileSync(join(repoRoot, "opm.sh"), "#!/bin/sh\n");
		chmodSync(join(repoRoot, "opm.sh"), 0o755);
		const hostAuth = join(root, "omp-auth.json");
		writeFileSync(hostAuth, JSON.stringify({ anthropic: { type: "oauth" } }));

		const result = installCli({
			binDir,
			agentDir,
			repoRoot,
			packRoot: "/workspace/opm",
			hostAuthPath: hostAuth,
			shareAuth: false,
		});
		expect(result.wrapperPath).toBe(join(binDir, "opm"));
		expect(existsSync(join(binDir, "pi"))).toBe(false);
		expect(existsSync(join(binDir, "omp"))).toBe(false);
		expect(readFileSync(result.wrapperPath, "utf8")).toContain("# opm-install-cli");
		expect(lstatSync(result.authPath).isSymbolicLink()).toBe(false);
		expect(readFileSync(result.authPath, "utf8")).toContain("oauth");
		expect(result.authMode).toBe("copy");
	});

	it("refuses to write a wrapper named pi", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-install-pi-"));
		dirs.push(root);
		expect(() =>
			installCli({
				binDir: root,
				wrapperName: "pi",
				repoRoot: root,
				agentDir: join(root, "agent"),
			}),
		).toThrow(/refusing to install as pi or omp/);
	});
});
