import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { initOpm } from "./init.ts";
import { packOpm, readPackMeta } from "./pack.ts";
import { opmRoot } from "./pack-registry.ts";
import { findRepoRoot } from "./spawn-pi.ts";

export const OPM_WRAPPER_MARKER = "# opm-install-cli";

export function forbiddenInstallNames(): string[] {
	return ["omp", "pi"];
}

export type InstallCliArgs = {
	binDir?: string;
	wrapperName?: string;
	agentDir?: string;
	fromPack?: string;
	shareAuth: boolean;
	force: boolean;
};

export function parseInstallCliArgs(argv: string[]): InstallCliArgs {
	let binDir: string | undefined;
	let wrapperName: string | undefined;
	let agentDir: string | undefined;
	let fromPack: string | undefined;
	let shareAuth = false;
	let force = false;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--share-auth") {
			shareAuth = true;
			continue;
		}
		if (arg === "--force") {
			force = true;
			continue;
		}
		if (arg === "--bin-dir" || arg === "--name" || arg === "--agent-dir" || arg === "--from-pack") {
			const next = argv[i + 1];
			if (!next || next.startsWith("-")) {
				throw new Error(`${arg} needs a value`);
			}
			if (arg === "--bin-dir") {
				binDir = next;
			} else if (arg === "--name") {
				wrapperName = next;
			} else if (arg === "--agent-dir") {
				agentDir = next;
			} else {
				fromPack = next;
			}
			i += 1;
			continue;
		}
		throw new Error(`Unknown install-cli flag: ${arg}`);
	}
	return { binDir, wrapperName, agentDir, fromPack, shareAuth, force };
}

/** `install-app` / `install-super-pi` → `super-pi`. `install-cli` → `opm`. `--name` wins. */
export function resolveInstallWrapperName(command: string, flags: InstallCliArgs): string {
	if (flags.wrapperName && flags.wrapperName.length > 0) {
		return flags.wrapperName;
	}
	if (command === "install-app" || command === "install-super-pi") {
		return "super-pi";
	}
	return "opm";
}

export function defaultAgentDirForName(name: string, home: string): string {
	return join(home, `.${name}`, "agent");
}

function assertInstallName(name: string): void {
	if (forbiddenInstallNames().includes(name.toLowerCase())) {
		throw new Error("refusing to install as pi or omp (keeps the host CLI unchanged)");
	}
	if (!/^[a-z][a-z0-9-]*$/.test(name)) {
		throw new Error("install name must be lowercase letters, digits, and hyphen (e.g. super-pi)");
	}
}

export function formatOpmWrapper(options: {
	repoRoot: string;
	agentDir: string;
	shareAuth: boolean;
}): string {
	const share = options.shareAuth ? "1" : "none";
	return `#!/usr/bin/env bash
${OPM_WRAPPER_MARKER}
set -euo pipefail
export PI_CODING_AGENT_DIR="\${PI_CODING_AGENT_DIR:-${options.agentDir}}"
export OPM_PI_FROM_SOURCE="\${OPM_PI_FROM_SOURCE:-1}"
export OPM_AUTH_SHARE="\${OPM_AUTH_SHARE:-${share}}"
if [ "$#" -eq 0 ]; then
  exec "${options.repoRoot}/opm.sh" --preset pi-super
fi
exec "${options.repoRoot}/opm.sh" "$@"
`;
}

export function formatPackedWrapper(options: {
	libCli: string;
	agentDir: string;
	shareAuth: boolean;
	piBin?: string;
}): string {
	const share = options.shareAuth ? "1" : "none";
	const piLine = options.piBin ? `export OPM_PI_BIN="\${OPM_PI_BIN:-${options.piBin}}"\n` : "";
	return `#!/usr/bin/env bash
${OPM_WRAPPER_MARKER}
set -euo pipefail
export PI_CODING_AGENT_DIR="\${PI_CODING_AGENT_DIR:-${options.agentDir}}"
export OPM_AUTH_SHARE="\${OPM_AUTH_SHARE:-${share}}"
${piLine}use_super=1
for arg in "\$@"; do
  case "\$arg" in
    --preset|--profile|pack|init|choose|attach|customize|install-cli|install-app|install-super-pi|install-parallel|install-to-pi|attach-pi|--choose)
      use_super=0
      break
      ;;
  esac
done
if [ "\$use_super" -eq 1 ]; then
  exec node "${options.libCli}" --preset pi-super "\$@"
fi
exec node "${options.libCli}" "\$@"
`;
}

export type InstallCliOptions = {
	binDir?: string;
	wrapperName?: string;
	agentDir?: string;
	repoRoot?: string;
	packRoot?: string;
	fromPack?: string;
	hostAuthPath?: string;
	shareAuth?: boolean;
	force?: boolean;
	home?: string;
};

export type InstallCliResult = {
	wrapperPath: string;
	agentDir: string;
	authPath: string;
	authMode: "symlink" | "copy";
	authLinked: boolean;
	repoRoot: string;
	libDir?: string;
	engineBin?: string;
};

export function installCli(options: InstallCliOptions = {}): InstallCliResult {
	const name = options.wrapperName ?? "opm";
	assertInstallName(name);
	const home = options.home ?? homedir();
	const binDir = options.binDir ?? join(home, ".local", "bin");
	const agentDir = options.agentDir ?? defaultAgentDirForName(name, home);
	const repoRoot = options.repoRoot ?? findRepoRoot(opmRoot());
	const wrapperPath = join(binDir, name);
	if (existsSync(wrapperPath) && !options.force) {
		let existing = "";
		try {
			existing = readFileSync(wrapperPath, "utf8");
		} catch {
			existing = "";
		}
		if (existing.length > 0 && !existing.includes(OPM_WRAPPER_MARKER)) {
			throw new Error(`${wrapperPath} exists and is not an OPM wrapper. Pass --force to replace.`);
		}
	}
	mkdirSync(binDir, { recursive: true });
	const inited = initOpm({
		opmAgentDir: agentDir,
		packRoot: options.packRoot,
		piAuthPath: options.hostAuthPath,
		shareAuth: options.shareAuth === true,
	});
	writeFileSync(
		wrapperPath,
		formatOpmWrapper({
			repoRoot,
			agentDir,
			shareAuth: options.shareAuth === true,
		}),
		{ encoding: "utf8", mode: 0o755 },
	);
	chmodSync(wrapperPath, 0o755);
	return {
		wrapperPath,
		agentDir,
		authPath: inited.authPath,
		authMode: inited.authMode,
		authLinked: inited.authLinked,
		repoRoot,
	};
}

function tryFindRepoRoot(start: string): string | undefined {
	try {
		return findRepoRoot(start);
	} catch {
		return undefined;
	}
}

function writeInstallWrapper(wrapperPath: string, body: string, force: boolean | undefined): void {
	if (existsSync(wrapperPath) && !force) {
		let existing = "";
		try {
			existing = readFileSync(wrapperPath, "utf8");
		} catch {
			existing = "";
		}
		if (existing.length > 0 && !existing.includes(OPM_WRAPPER_MARKER)) {
			throw new Error(`${wrapperPath} exists and is not an OPM wrapper. Pass --force to replace.`);
		}
	}
	writeFileSync(wrapperPath, body, { encoding: "utf8", mode: 0o755 });
	chmodSync(wrapperPath, 0o755);
}

/** Snapshot OPM into ~/.<name>/lib and install command `super-pi` (or --name). */
export function installApp(options: InstallCliOptions = {}): InstallCliResult {
	const name = options.wrapperName ?? "super-pi";
	assertInstallName(name);
	const home = options.home ?? homedir();
	const binDir = options.binDir ?? join(home, ".local", "bin");
	const agentDir = options.agentDir ?? defaultAgentDirForName(name, home);
	const libDir = join(home, `.${name}`, "lib");
	const sourceRoot = resolve(options.fromPack ?? opmRoot());
	const repoRoot = options.repoRoot ?? tryFindRepoRoot(sourceRoot) ?? tryFindRepoRoot(opmRoot());
	if (resolve(sourceRoot) !== resolve(libDir)) {
		packOpm({
			sourceRoot,
			outDir: libDir,
			tarball: false,
			repoRoot,
		});
	}
	const meta = readPackMeta(libDir);
	const engineBin = meta?.piTestSh && existsSync(meta.piTestSh) ? meta.piTestSh : undefined;
	mkdirSync(binDir, { recursive: true });
	const inited = initOpm({
		opmAgentDir: agentDir,
		packRoot: libDir,
		piAuthPath: options.hostAuthPath,
		shareAuth: options.shareAuth === true,
	});
	const wrapperPath = join(binDir, name);
	writeInstallWrapper(
		wrapperPath,
		formatPackedWrapper({
			libCli: join(libDir, "src", "cli.ts"),
			agentDir,
			shareAuth: options.shareAuth === true,
			piBin: engineBin,
		}),
		options.force,
	);
	return {
		wrapperPath,
		agentDir,
		authPath: inited.authPath,
		authMode: inited.authMode,
		authLinked: inited.authLinked,
		repoRoot: repoRoot ?? libDir,
		libDir,
		engineBin,
	};
}

export function formatInstallCliResult(result: InstallCliResult): string {
	const cmd = result.wrapperPath.split(/[/\\]/).pop() ?? "opm";
	const lines = [
		`wrapper: ${result.wrapperPath}`,
		`clone: ${result.repoRoot}`,
		`agent dir: ${result.agentDir}`,
		result.libDir ? `lib: ${result.libDir}` : undefined,
		result.engineBin ? `engine: ${result.engineBin}` : undefined,
		`auth: ${result.authMode}${result.authLinked ? "" : " (no host login to copy)"}`,
		`repo: ${result.repoRoot}`,
		"Host omp/pi binaries and ~/.pi/agent / ~/.omp/agent are unchanged.",
		`${cmd} uses only this agent dir (sessions, settings, copied auth).`,
		`Run: ${cmd} --help    or    ${cmd}`,
	].filter((line): line is string => typeof line === "string");
	return `${lines.join("\n")}\n`;
}
