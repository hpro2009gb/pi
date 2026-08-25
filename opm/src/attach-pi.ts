import { spawnSync } from "node:child_process";
import { opmRoot } from "./pack-registry.ts";
import { commandOnPath, resolvePiBin } from "./spawn-pi.ts";

export type HostKind = "pi" | "omp" | "source";

export type HostBin = {
	bin: string;
	kind: HostKind;
};

export function resolveHostBin(env: NodeJS.ProcessEnv = process.env, fromFileUrl: string = import.meta.url): HostBin {
	if (env.OPM_HOST_BIN) {
		return { bin: env.OPM_HOST_BIN, kind: "pi" };
	}
	const pathEnv = env.PATH ?? process.env.PATH ?? "";
	if (commandOnPath("pi", pathEnv)) {
		return { bin: "pi", kind: "pi" };
	}
	if (commandOnPath("omp", pathEnv)) {
		return { bin: "omp", kind: "omp" };
	}
	return { bin: resolvePiBin({ ...env, OPM_PI_FROM_SOURCE: "1" }, fromFileUrl), kind: "source" };
}

export type AttachResult = {
	bin: string;
	kind: HostKind;
	packageRoot: string;
	status: number | null;
	stdout: string;
	stderr: string;
	error?: Error;
};

export function attachOpmToHost(options?: {
	env?: NodeJS.ProcessEnv;
	fromFileUrl?: string;
	packageRoot?: string;
	args?: string[];
}): AttachResult {
	const env = { ...(options?.env ?? process.env) };
	const host = resolveHostBin(env, options?.fromFileUrl ?? import.meta.url);
	const packageRoot = options?.packageRoot ?? opmRoot();
	const extra = options?.args ?? [];
	const result = spawnSync(host.bin, ["install", packageRoot, ...extra], {
		encoding: "utf8",
		env,
	});
	return {
		bin: host.bin,
		kind: host.kind,
		packageRoot,
		status: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
		error: result.error,
	};
}

export function formatAttachResult(result: AttachResult): string {
	const lines = [
		`host: ${result.kind} (${result.bin})`,
		`package: ${result.packageRoot}`,
		result.stdout.trim(),
		result.stderr.trim(),
	].filter((line) => line.length > 0);
	return `${lines.join("\n")}\n`;
}
