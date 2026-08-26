import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
	defaultAgentDirForName,
	forbiddenInstallNames,
	formatOpmWrapper,
	formatPackedWrapper,
	installCli,
	parseInstallCliArgs,
	resolveInstallWrapperName,
} from "../src/install-cli.ts";
import { opmRoot } from "../src/pack-registry.ts";

describe("parseInstallCliArgs", () => {
	it("defaults to copy auth and ~/.local/bin", () => {
		expect(parseInstallCliArgs([])).toEqual({
			binDir: undefined,
			wrapperName: undefined,
			agentDir: undefined,
			fromPack: undefined,
			shareAuth: false,
			force: false,
		});
		expect(parseInstallCliArgs(["--share-auth", "--bin-dir", "/tmp/bin", "--force"])).toEqual({
			binDir: "/tmp/bin",
			wrapperName: undefined,
			agentDir: undefined,
			fromPack: undefined,
			shareAuth: true,
			force: true,
		});
	});

	it("parses --name super-pi and --agent-dir", () => {
		expect(parseInstallCliArgs(["--name", "super-pi", "--agent-dir", "/tmp/sp-agent"])).toEqual({
			binDir: undefined,
			wrapperName: "super-pi",
			agentDir: "/tmp/sp-agent",
			fromPack: undefined,
			shareAuth: false,
			force: false,
		});
		expect(parseInstallCliArgs(["--from-pack", "/tmp/super-pi"])).toEqual({
			binDir: undefined,
			wrapperName: undefined,
			agentDir: undefined,
			fromPack: "/tmp/super-pi",
			shareAuth: false,
			force: false,
		});
	});
});

describe("resolveInstallWrapperName", () => {
	const empty = parseInstallCliArgs([]);

	it("defaults install-app and install-super-pi to super-pi", () => {
		expect(resolveInstallWrapperName("install-app", empty)).toBe("super-pi");
		expect(resolveInstallWrapperName("install-super-pi", empty)).toBe("super-pi");
		expect(resolveInstallWrapperName("install-cli", empty)).toBe("opm");
		expect(resolveInstallWrapperName("install-parallel", empty)).toBe("opm");
	});

	it("lets --name override the command default", () => {
		expect(resolveInstallWrapperName("install-app", parseInstallCliArgs(["--name", "pi-lab"]))).toBe(
			"pi-lab",
		);
	});
});

describe("defaultAgentDirForName", () => {
	it("uses ~/.<name>/agent under the given home", () => {
		expect(defaultAgentDirForName("super-pi", "/home/u")).toBe("/home/u/.super-pi/agent");
		expect(defaultAgentDirForName("opm", "/home/u")).toBe("/home/u/.opm/agent");
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
		expect(text).toContain('OPM_AUTH_SHARE="${OPM_AUTH_SHARE:-none}"');
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

	it("refuses to write a wrapper named pi or omp", () => {
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
		expect(() =>
			installCli({
				binDir: root,
				wrapperName: "omp",
				repoRoot: root,
				agentDir: join(root, "agent"),
			}),
		).toThrow(/refusing to install as pi or omp/);
	});

	it("refuses names that are not lowercase kebab", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-install-badname-"));
		dirs.push(root);
		expect(() =>
			installCli({
				binDir: root,
				wrapperName: "Super Pi",
				repoRoot: root,
				agentDir: join(root, "agent"),
			}),
		).toThrow(/lowercase letters, digits, and hyphen/);
	});

	it("installs super-pi as a separate app with ~/.super-pi/agent, not pi/omp/opm", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-super-app-"));
		dirs.push(root);
		const binDir = join(root, "bin");
		const repoRoot = join(root, "repo");
		mkdirSync(repoRoot, { recursive: true });
		writeFileSync(join(repoRoot, "opm.sh"), "#!/bin/sh\n");
		chmodSync(join(repoRoot, "opm.sh"), 0o755);
		const hostAuth = join(root, "omp-auth.json");
		writeFileSync(hostAuth, JSON.stringify({ anthropic: { type: "oauth" } }));

		const result = installCli({
			home: root,
			binDir,
			repoRoot,
			packRoot: "/workspace/opm",
			hostAuthPath: hostAuth,
			wrapperName: "super-pi",
			shareAuth: false,
		});
		expect(result.wrapperPath).toBe(join(binDir, "super-pi"));
		expect(result.agentDir).toBe(join(root, ".super-pi", "agent"));
		expect(existsSync(join(binDir, "pi"))).toBe(false);
		expect(existsSync(join(binDir, "omp"))).toBe(false);
		expect(existsSync(join(binDir, "opm"))).toBe(false);
		expect(result.agentDir).not.toContain("/.pi/");
		expect(result.agentDir).not.toContain("/.opm/");
		expect(result.agentDir).not.toContain("/.omp/");
		const wrapper = readFileSync(result.wrapperPath, "utf8");
		expect(wrapper).toContain(`PI_CODING_AGENT_DIR="\${PI_CODING_AGENT_DIR:-${result.agentDir}}"`);
		expect(wrapper).toContain('OPM_AUTH_SHARE="${OPM_AUTH_SHARE:-none}"');
		expect(lstatSync(result.authPath).isSymbolicLink()).toBe(false);
	});
});

describe("formatPackedWrapper", () => {
	it("defaults flags like --dry-run to pi-super without execing omp", () => {
		const text = formatPackedWrapper({
			libCli: "/home/u/.super-pi/lib/src/cli.ts",
			agentDir: "/home/u/.super-pi/agent",
			shareAuth: false,
			piBin: "/repo/pi-test.sh",
		});
		expect(text).toContain('exec node "/home/u/.super-pi/lib/src/cli.ts" --preset pi-super "$@"');
		expect(text).toContain('OPM_PI_BIN="${OPM_PI_BIN:-/repo/pi-test.sh}"');
		expect(text).not.toMatch(/\bexec omp\b/);
	});
});

describe("install-app CLI", () => {
	it("writes a super-pi wrapper that --help and --dry-run without touching pi/omp", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-install-app-cli-"));
		const binDir = join(root, "bin");
		const agentDir = join(root, ".super-pi", "agent");
		const repoRoot = join(opmRoot(), "..");
		const result = spawnSync("bash", [join(repoRoot, "opm.sh"), "install-app", "--bin-dir", binDir, "--agent-dir", agentDir], {
			encoding: "utf8",
			env: { ...process.env, HOME: root },
		});
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toMatch(/wrapper: .*\/super-pi/);
		expect(result.stdout).toContain(agentDir);
		expect(existsSync(join(binDir, "super-pi"))).toBe(true);
		expect(existsSync(join(binDir, "pi"))).toBe(false);
		expect(existsSync(join(binDir, "omp"))).toBe(false);
		const help = spawnSync(join(binDir, "super-pi"), ["--help"], {
			encoding: "utf8",
			env: { ...process.env, HOME: root, OPM_QUIET: "1" },
		});
		expect(help.status, help.stderr).toBe(0);
		expect(help.stdout.length + help.stderr.length).toBeGreaterThan(0);
		const dry = spawnSync(join(binDir, "super-pi"), ["--dry-run"], {
			encoding: "utf8",
			env: { ...process.env, HOME: root, OPM_QUIET: "1" },
		});
		expect(dry.status, dry.stderr).toBe(0);
		expect(dry.stdout).toMatch(/preset: pi-super/);
		rmSync(root, { recursive: true, force: true });
	});
});
