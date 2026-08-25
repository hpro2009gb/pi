import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateSandbox, parseSandboxProfile } from "../packs/sandbox/policy.ts";

const cwd = "/workspace/app";
const tmp = tmpdir();

describe("parseSandboxProfile", () => {
	it("accepts off, workspace, and container", () => {
		expect(parseSandboxProfile("off")).toBe("off");
		expect(parseSandboxProfile("workspace")).toBe("workspace");
		expect(parseSandboxProfile("container")).toBe("container");
	});

	it("rejects unknown profiles", () => {
		expect(() => parseSandboxProfile("laser")).toThrow(/Unknown sandbox profile: laser/);
	});
});

describe("evaluateSandbox", () => {
	it("off never blocks", () => {
		expect(
			evaluateSandbox({
				profile: "off",
				tool: "write",
				path: "/etc/passwd",
				cwd,
				tmpDir: tmp,
			}).block,
		).toBe(false);
	});

	it("workspace allows write inside cwd", () => {
		expect(
			evaluateSandbox({
				profile: "workspace",
				tool: "write",
				path: join(cwd, "src/a.ts"),
				cwd,
				tmpDir: tmp,
			}).block,
		).toBe(false);
	});

	it("workspace allows write inside tmp", () => {
		expect(
			evaluateSandbox({
				profile: "workspace",
				tool: "write",
				path: join(tmp, "opm-out.txt"),
				cwd,
				tmpDir: tmp,
			}).block,
		).toBe(false);
	});

	it("workspace blocks write outside cwd and tmp", () => {
		const result = evaluateSandbox({
			profile: "workspace",
			tool: "write",
			path: "/etc/passwd",
			cwd,
			tmpDir: tmp,
		});
		expect(result.block).toBe(true);
		expect(result.reason).toMatch(/workspace/i);
	});

	it("workspace denies read of ~/.ssh", () => {
		const result = evaluateSandbox({
			profile: "workspace",
			tool: "read",
			path: join(homedir(), ".ssh", "id_rsa"),
			cwd,
			tmpDir: tmp,
		});
		expect(result.block).toBe(true);
		expect(result.reason).toMatch(/secret|ssh/i);
	});

	it("workspace allows bash without network tools", () => {
		expect(
			evaluateSandbox({
				profile: "workspace",
				tool: "bash",
				command: "ls src",
				cwd,
				tmpDir: tmp,
			}).block,
		).toBe(false);
	});

	it("workspace allows curl", () => {
		expect(
			evaluateSandbox({
				profile: "workspace",
				tool: "bash",
				command: "curl https://example.com",
				cwd,
				tmpDir: tmp,
			}).block,
		).toBe(false);
	});

	it("container blocks curl", () => {
		const result = evaluateSandbox({
			profile: "container",
			tool: "bash",
			command: "curl https://example.com",
			cwd,
			tmpDir: tmp,
		});
		expect(result.block).toBe(true);
		expect(result.reason).toMatch(/network/i);
	});

	it("container still blocks write outside workspace", () => {
		expect(
			evaluateSandbox({
				profile: "container",
				tool: "edit",
				path: "/etc/hosts",
				cwd,
				tmpDir: tmp,
			}).block,
		).toBe(true);
	});
});
