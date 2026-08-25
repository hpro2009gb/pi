import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	MEMORY_TEMPLATE,
	findMemoryFile,
	hasSkillDescription,
	initMemoryFile,
	memoryEnabled,
	readMemory,
} from "../packs/memory/files.ts";

describe("findMemoryFile", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("finds MEMORY.md in cwd", () => {
		const dir = mkdtempSync(join(tmpdir(), "opm-mem-"));
		dirs.push(dir);
		const path = join(dir, "MEMORY.md");
		writeFileSync(path, "notes");
		expect(findMemoryFile(dir)).toBe(path);
	});

	it("walks up to git root and stops", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-mem-git-"));
		dirs.push(root);
		mkdirSync(join(root, ".git"));
		writeFileSync(join(root, "MEMORY.md"), "root notes");
		const nested = join(root, "pkg", "src");
		mkdirSync(nested, { recursive: true });
		expect(findMemoryFile(nested)).toBe(join(root, "MEMORY.md"));
	});

	it("does not walk past .git when MEMORY.md is missing", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-mem-stop-"));
		dirs.push(root);
		mkdirSync(join(root, ".git"));
		writeFileSync(join(root, "..", "should-not-matter.md"), "x");
		const nested = join(root, "src");
		mkdirSync(nested);
		expect(findMemoryFile(nested)).toBeUndefined();
	});
});

describe("initMemoryFile", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("writes a user-reviewed template once", () => {
		const dir = mkdtempSync(join(tmpdir(), "opm-mem-init-"));
		dirs.push(dir);
		const first = initMemoryFile(dir);
		expect(first.created).toBe(true);
		expect(readFileSync(first.path, "utf8")).toBe(MEMORY_TEMPLATE);
		expect(hasSkillDescription(MEMORY_TEMPLATE)).toBe(true);
		const second = initMemoryFile(dir);
		expect(second.created).toBe(false);
	});
});

describe("readMemory / flags", () => {
	it("returns undefined when missing", () => {
		expect(readMemory("/tmp/opm-no-memory-dir")).toBeUndefined();
	});

	it("is on unless OPM_MEMORY=0", () => {
		expect(memoryEnabled({})).toBe(true);
		expect(memoryEnabled({ OPM_MEMORY: "0" })).toBe(false);
	});
});
