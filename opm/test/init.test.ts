import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initOpm } from "../src/init.ts";

describe("initOpm", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("creates settings.json in a tmpdir and is idempotent", () => {
		const opmAgentDir = mkdtempSync(join(tmpdir(), "opm-init-"));
		dirs.push(opmAgentDir);
		const first = initOpm({ opmAgentDir, packRoot: "/workspace/opm" });
		const settingsPath = join(opmAgentDir, "settings.json");
		expect(existsSync(settingsPath)).toBe(true);
		expect(first.created).toBe(true);
		const firstJson = readFileSync(settingsPath, "utf8");

		const second = initOpm({ opmAgentDir, packRoot: "/workspace/opm" });
		expect(second.created).toBe(false);
		expect(readFileSync(settingsPath, "utf8")).toBe(firstJson);
	});

	it("symlinks Pi auth.json when present and does not copy the secret bytes into settings", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-auth-"));
		dirs.push(root);
		const opmAgentDir = join(root, "opm-agent");
		mkdirSync(opmAgentDir);
		const piAuthPath = join(root, "pi-auth.json");
		writeFileSync(piAuthPath, JSON.stringify({ token: "secret-value" }));

		const result = initOpm({ opmAgentDir, packRoot: "/workspace/opm", piAuthPath });
		expect(result.authPath).toBe(join(opmAgentDir, "auth.json"));
		expect(existsSync(result.authPath)).toBe(true);
		const settings = readFileSync(join(opmAgentDir, "settings.json"), "utf8");
		expect(settings).not.toContain("secret-value");
	});
});
