import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { initOpm } from "./init.ts";
import { opmRoot } from "./pack-registry.ts";
import { findRepoRoot } from "./spawn-pi.ts";

export const OPM_WRAPPER_MARKER = "# opm-install-cli";

export function forbiddenInstallNames(): string[] {
	return ["omp", "pi"];
}

export type InstallCliArgs = {
	binDir?: string;
	shareAuth: boolean;
	force: boolean;
};

export function parseInstallCliArgs(argv: string[]): InstallCliArgs {
	let binDir: string | undefined;
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
		if (arg === "--bin-dir") {
			const next = argv[i + 1];
			if (!next || next.startsWith("-")) {
				throw new Error("--bin-dir needs a path");
			}
			binDir = next;
			i += 1;
			continue;
		}
		throw new Error(`Unknown install-cli flag: ${arg}`);
	}
	return { binDir, shareAuth, force };
}

export function formatOpmWrapper(options: {
	repoRoot: string;
	agentDir: string;
	shareAuth: boolean;
}): string {
	const share = options.shareAuth ? "1" : "0";
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

export type InstallCliOptions = {
	binDir?: string;
	wrapperName?: string;
	agentDir?: string;
	repoRoot?: string;
	packRoot?: string;
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
};

export function installCli(options: InstallCliOptions = {}): InstallCliResult {
	const name = options.wrapperName ?? "opm";
	if (forbiddenInstallNames().includes(name.toLowerCase())) {
		throw new Error("refusing to install as pi or omp (keeps the host CLI unchanged)");
	}
	const home = options.home ?? homedir();
	const binDir = options.binDir ?? join(home, ".local", "bin");
	const agentDir = options.agentDir ?? join(home, ".opm", "agent");
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

export function formatInstallCliResult(result: InstallCliResult): string {
	return [
		`wrapper: ${result.wrapperPath}`,
		`agent dir: ${result.agentDir}`,
		`auth: ${result.authMode}${result.authLinked ? "" : " (no host login to copy)"}`,
		`repo: ${result.repoRoot}`,
		"omp and pi on PATH are unchanged. Data is not ~/.pi/agent.",
		"Run: opm --help    or    opm --preset pi-super",
		"",
	].join("\n");
}
