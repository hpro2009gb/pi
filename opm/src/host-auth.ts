import { existsSync, lstatSync, readFileSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function parseAuthObject(path: string): Record<string, unknown> | undefined {
	if (!existsSync(path)) {
		return undefined;
	}
	try {
		const data: unknown = JSON.parse(readFileSync(path, "utf8"));
		if (!data || typeof data !== "object" || Array.isArray(data)) {
			return undefined;
		}
		return data as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

/** Empty `{}` is what Pi writes before `/login`. That is not a credential. */
export function isPlaceholderAuthFile(path: string): boolean {
	if (!existsSync(path)) {
		return true;
	}
	const data = parseAuthObject(path);
	if (!data) {
		return false;
	}
	return Object.keys(data).length === 0;
}

export function isUsableAuthFile(path: string): boolean {
	const data = parseAuthObject(path);
	return Boolean(data && Object.keys(data).length > 0);
}

function hostAuthCandidates(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string[] {
	const paths: string[] = [];
	if (env.OPM_AUTH_JSON) {
		paths.push(env.OPM_AUTH_JSON);
	}
	if (env.OMP_CODING_AGENT_DIR) {
		paths.push(join(env.OMP_CODING_AGENT_DIR, "auth.json"));
	}
	paths.push(join(home, ".omp", "agent", "auth.json"));
	paths.push(join(home, ".pi", "agent", "auth.json"));
	return paths;
}

export function discoverHostAuthPath(
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
	extra: string[] = [],
): string | undefined {
	for (const path of [...extra, ...hostAuthCandidates(env, home)]) {
		if (path.length > 0 && isUsableAuthFile(path)) {
			return path;
		}
	}
	return undefined;
}

/** Symlink dest to host login. Never copies secret bytes. Replaces empty `{}`. */
export function linkHostAuth(dest: string, host: string | undefined): boolean {
	if (host && isUsableAuthFile(host) && dest !== host) {
		try {
			if (existsSync(dest) && lstatSync(dest).isSymbolicLink() && readlinkSync(dest) === host) {
				return true;
			}
		} catch {
			// dest missing or not a symlink
		}
		if (isPlaceholderAuthFile(dest) || !isUsableAuthFile(dest)) {
			if (existsSync(dest)) {
				unlinkSync(dest);
			}
			symlinkSync(host, dest);
			return true;
		}
	}
	return isUsableAuthFile(dest);
}

export function ensureOpmHostAuth(
	agentDir: string,
	env: NodeJS.ProcessEnv = process.env,
	extra: string[] = [],
): boolean {
	return linkHostAuth(join(agentDir, "auth.json"), discoverHostAuthPath(env, homedir(), extra));
}
