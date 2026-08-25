import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const MEMORY_FILENAME = "MEMORY.md";

export const MEMORY_TEMPLATE = `---
name: memory
description: Project memory. User-reviewed notes the agent should follow. Do not auto-learn.
---

# Project memory

Add facts the agent should remember. Review this file yourself; the agent must not write it unless you ask.
`;

export function memoryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return env.OPM_MEMORY !== "0";
}

export function hasSkillDescription(content: string): boolean {
	if (!content.startsWith("---")) {
		return false;
	}
	const end = content.indexOf("\n---", 3);
	if (end < 0) {
		return false;
	}
	return /^description:\s*\S/m.test(content.slice(0, end + 4));
}

export function findMemoryFile(startDir: string): string | undefined {
	let dir = startDir;
	for (;;) {
		const candidate = join(dir, MEMORY_FILENAME);
		if (existsSync(candidate)) {
			return candidate;
		}
		if (existsSync(join(dir, ".git"))) {
			return undefined;
		}
		const parent = dirname(dir);
		if (parent === dir) {
			return undefined;
		}
		dir = parent;
	}
}

export function readMemory(path: string): string | undefined {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return undefined;
	}
}

export function initMemoryFile(dir: string): { path: string; created: boolean } {
	mkdirSync(dir, { recursive: true });
	const path = join(dir, MEMORY_FILENAME);
	if (existsSync(path)) {
		return { path, created: false };
	}
	writeFileSync(path, MEMORY_TEMPLATE, "utf8");
	return { path, created: true };
}
