import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultOpmAgentDir } from "./init.ts";
import type { LaunchPlan } from "./presets.ts";

export function peelOpmCliFlags(argv: string[]): { dryRun: boolean; rest: string[] } {
	const rest: string[] = [];
	let dryRun = false;
	for (const arg of argv) {
		if (arg === "--dry-run") {
			dryRun = true;
			continue;
		}
		rest.push(arg);
	}
	return { dryRun, rest };
}

export function formatLaunchBanner(plan: LaunchPlan): string {
	const packs = plan.packs.length > 0 ? plan.packs.join(", ") : "(no packs)";
	return `opm ${plan.preset}: ${packs}\n`;
}

export function formatDryRun(plan: LaunchPlan, piBin: string): string {
	const extra = plan.extraArgs.length > 0 ? plan.extraArgs.join(" ") : "(none)";
	const packs = plan.packs.length > 0 ? plan.packs.join(", ") : "(none)";
	const extensions =
		plan.extensionPaths.length > 0
			? plan.extensionPaths.map((path) => `  ${path}`).join("\n")
			: "  (none)";
	return [
		`preset: ${plan.preset}`,
		`packs: ${packs}`,
		`pi: ${piBin}`,
		`extraArgs: ${extra}`,
		"extensions:",
		extensions,
		"",
	].join("\n");
}


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

export function commandOnPath(command: string, pathEnv: string): boolean {
	if (command.includes("/") || command.includes("\\")) {
		return existsSync(command);
	}
	for (const dir of pathEnv.split(delimiter)) {
		if (dir.length > 0 && existsSync(join(dir, command))) {
			return true;
		}
	}
	return false;
}

export function resolvePiBin(env: NodeJS.ProcessEnv, fromFileUrl: string): string {
	if (env.OPM_PI_BIN) {
		return env.OPM_PI_BIN;
	}
	const startDir = dirname(fileURLToPath(fromFileUrl));
	if (env.OPM_PI_FROM_SOURCE === "1") {
		return join(findRepoRoot(startDir), "pi-test.sh");
	}
	const pathEnv = env.PATH ?? process.env.PATH ?? "";
	if (commandOnPath("pi", pathEnv)) {
		return "pi";
	}
	try {
		return join(findRepoRoot(startDir), "pi-test.sh");
	} catch {
		throw new Error("pi not found on PATH. Set OPM_PI_BIN or OPM_PI_FROM_SOURCE=1 to use ./pi-test.sh");
	}
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
	if (!env.OPM_PI_BIN) {
		env.OPM_PI_BIN = piBin;
	}
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
