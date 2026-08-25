import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultOpmAgentDir } from "./init.ts";
import type { LaunchPlan } from "./presets.ts";

export function findRepoRoot(startDir: string): string {
	let dir = startDir;
	while (true) {
		if (existsSync(join(dir, "pi-test.sh")) && existsSync(join(dir, "packages", "coding-agent"))) {
			return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) {
			throw new Error("Could not find pi repo root (missing pi-test.sh)");
		}
		dir = parent;
	}
}

export function resolvePiBin(env: NodeJS.ProcessEnv, fromFileUrl: string): string {
	if (env.OPM_PI_BIN) {
		return env.OPM_PI_BIN;
	}
	if (env.OPM_PI_FROM_SOURCE === "1") {
		const startDir = dirname(fileURLToPath(fromFileUrl));
		return join(findRepoRoot(startDir), "pi-test.sh");
	}
	return "pi";
}

export function extensionArgs(
	paths: string[],
	exists: (path: string) => boolean = existsSync,
): { args: string[]; warnings: string[] } {
	const args: string[] = [];
	const warnings: string[] = [];
	for (const path of paths) {
		if (!exists(path)) {
			warnings.push(`skip missing pack extension: ${path}`);
			continue;
		}
		args.push("-e", path);
	}
	return { args, warnings };
}

export function spawnPi(
	plan: LaunchPlan,
	options?: {
		env?: NodeJS.ProcessEnv;
		cwd?: string;
		fromFileUrl?: string;
	},
): { status: number | null; warnings: string[]; error?: Error } {
	const env = { ...(options?.env ?? process.env) };
	if (!env.PI_CODING_AGENT_DIR) {
		env.PI_CODING_AGENT_DIR = defaultOpmAgentDir();
	}
	const piBin = resolvePiBin(env, options?.fromFileUrl ?? import.meta.url);
	const { args: eArgs, warnings } = extensionArgs(plan.extensionPaths);
	for (const warning of warnings) {
		process.stderr.write(`${warning}\n`);
	}
	const result = spawnSync(piBin, ["--no-extensions", ...eArgs, ...plan.extraArgs], {
		stdio: "inherit",
		env,
		cwd: options?.cwd,
	});
	return { status: result.status, warnings, error: result.error };
}
