import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { discoverHostAuthPath, bindHostAuth } from "./host-auth.ts";
import { packPath, PRESET_PACKS } from "./pack-registry.ts";

export type InitOpmOptions = {
	opmAgentDir?: string;
	packRoot?: string;
	piAuthPath?: string;
	shareAuth?: boolean;
};

export type InitOpmResult = {
	created: boolean;
	agentDir: string;
	settingsPath: string;
	authPath: string;
	authLinked: boolean;
	authMode: "symlink" | "copy";
	hostAuthPath?: string;
};

export function defaultOpmAgentDir(): string {
	return join(homedir(), ".opm", "agent");
}

function settingsDocument(packRoot: string | undefined): Record<string, unknown> {
	const extensions = PRESET_PACKS["opm-verify"].map((id) => {
		if (!packRoot) {
			return packPath(id);
		}
		return join(packRoot, "packs", id, "index.ts");
	});
	return { extensions };
}

function verifySkillPath(packRoot: string | undefined): string {
	if (packRoot) {
		return join(packRoot, "packs", "verify", "VERIFY.md");
	}
	return join(packPath("verify"), "..", "VERIFY.md");
}

export function initOpm(options: InitOpmOptions = {}): InitOpmResult {
	const agentDir = options.opmAgentDir ?? defaultOpmAgentDir();
	mkdirSync(agentDir, { recursive: true });

	const settingsPath = join(agentDir, "settings.json");
	const created = !existsSync(settingsPath);
	if (created) {
		writeFileSync(settingsPath, `${JSON.stringify(settingsDocument(options.packRoot), null, 2)}\n`);
	}

	const appendPath = join(agentDir, "APPEND_SYSTEM.md");
	if (!existsSync(appendPath)) {
		const verifyMd = verifySkillPath(options.packRoot);
		if (existsSync(verifyMd)) {
			writeFileSync(appendPath, readFileSync(verifyMd, "utf8"));
		}
	}

	const authPath = join(agentDir, "auth.json");
	const extra = options.piAuthPath ? [options.piAuthPath] : [];
	const host = discoverHostAuthPath(process.env, homedir(), extra);
	const authMode = options.shareAuth === false ? "copy" : "symlink";
	const authLinked = bindHostAuth(authPath, host, authMode);

	return { created, agentDir, settingsPath, authPath, authLinked, authMode, hostAuthPath: host };
}
