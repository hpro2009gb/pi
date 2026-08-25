import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverHostAuthPath, isPlaceholderAuthFile, isUsableAuthFile, linkHostAuth } from "../src/host-auth.ts";
import { initOpm } from "../src/init.ts";

describe("isUsableAuthFile / isPlaceholderAuthFile", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("treats missing and empty {} as placeholder, not a login", () => {
		const dir = mkdtempSync(join(tmpdir(), "opm-auth-shape-"));
		dirs.push(dir);
		const missing = join(dir, "missing.json");
		const empty = join(dir, "empty.json");
		writeFileSync(empty, "{}\n");
		expect(isPlaceholderAuthFile(missing)).toBe(true);
		expect(isUsableAuthFile(missing)).toBe(false);
		expect(isPlaceholderAuthFile(empty)).toBe(true);
		expect(isUsableAuthFile(empty)).toBe(false);
	});

	it("treats a provider credential object as a login", () => {
		const dir = mkdtempSync(join(tmpdir(), "opm-auth-ok-"));
		dirs.push(dir);
		const path = join(dir, "auth.json");
		writeFileSync(path, JSON.stringify({ anthropic: { type: "api_key", key: "sk-test" } }));
		expect(isPlaceholderAuthFile(path)).toBe(false);
		expect(isUsableAuthFile(path)).toBe(true);
	});
});

describe("discoverHostAuthPath", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("prefers OMP_CODING_AGENT_DIR over ~/.pi when both have logins", () => {
		const home = mkdtempSync(join(tmpdir(), "opm-home-"));
		dirs.push(home);
		const ompDir = join(home, "omp-agent");
		const piDir = join(home, ".pi", "agent");
		mkdirSync(ompDir, { recursive: true });
		mkdirSync(piDir, { recursive: true });
		writeFileSync(join(ompDir, "auth.json"), JSON.stringify({ anthropic: { type: "oauth" } }));
		writeFileSync(join(piDir, "auth.json"), JSON.stringify({ openai: { type: "api_key" } }));
		const found = discoverHostAuthPath(
			{ OMP_CODING_AGENT_DIR: ompDir },
			home,
		);
		expect(found).toBe(join(ompDir, "auth.json"));
	});

	it("skips empty {} host files", () => {
		const home = mkdtempSync(join(tmpdir(), "opm-home-empty-"));
		dirs.push(home);
		const piDir = join(home, ".pi", "agent");
		mkdirSync(piDir, { recursive: true });
		writeFileSync(join(piDir, "auth.json"), "{}\n");
		expect(discoverHostAuthPath({}, home)).toBeUndefined();
	});
});

describe("linkHostAuth", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("replaces an empty {} dest with a symlink to the host login", () => {
		const dir = mkdtempSync(join(tmpdir(), "opm-link-"));
		dirs.push(dir);
		const dest = join(dir, "opm-auth.json");
		const host = join(dir, "omp-auth.json");
		writeFileSync(dest, "{}\n");
		writeFileSync(host, JSON.stringify({ anthropic: { type: "oauth" } }));
		expect(linkHostAuth(dest, host)).toBe(true);
		expect(lstatSync(dest).isSymbolicLink()).toBe(true);
		expect(readFileSync(dest, "utf8")).toContain("oauth");
		expect(readFileSync(host, "utf8")).toContain("oauth");
	});
});

describe("initOpm host login", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("replaces placeholder {} instead of keeping it as a fake login", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-init-empty-"));
		dirs.push(root);
		const opmAgentDir = join(root, "opm-agent");
		mkdirSync(opmAgentDir);
		writeFileSync(join(opmAgentDir, "auth.json"), "{}\n");
		const host = join(root, "omp-auth.json");
		writeFileSync(host, JSON.stringify({ token: "secret-value" }));
		const result = initOpm({ opmAgentDir, packRoot: "/workspace/opm", piAuthPath: host });
		expect(result.authLinked).toBe(true);
		expect(lstatSync(result.authPath).isSymbolicLink()).toBe(true);
		expect(readFileSync(result.authPath, "utf8")).toContain("secret-value");
		expect(readFileSync(join(opmAgentDir, "settings.json"), "utf8")).not.toContain("secret-value");
	});
});
