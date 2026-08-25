import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";

export type SandboxProfile = "off" | "workspace" | "container";

export type SandboxDecision = {
	block: boolean;
	reason?: string;
};

export type EvaluateSandboxInput = {
	profile: SandboxProfile;
	tool: string;
	path?: string;
	command?: string;
	cwd: string;
	tmpDir: string;
	homeDir?: string;
};

const SECRET_DIR_NAMES = [".ssh", ".aws", ".gnupg"];
const NETWORK_COMMAND = /\b(curl|wget|nc|ncat|netcat|ssh|scp|sftp|nmap|telnet)\b/i;

export function parseSandboxProfile(value: string): SandboxProfile {
	if (value === "off" || value === "workspace" || value === "container") {
		return value;
	}
	throw new Error(`Unknown sandbox profile: ${value}`);
}

export function isInsideRoot(root: string, candidate: string): boolean {
	const rel = relative(resolve(root), resolve(candidate));
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function resolveUserPath(cwd: string, inputPath: string): string {
	return isAbsolute(inputPath) ? resolve(inputPath) : resolve(cwd, inputPath);
}

function isSecretPath(absolutePath: string, homeDir: string): boolean {
	return SECRET_DIR_NAMES.some((name) => isInsideRoot(resolve(homeDir, name), absolutePath));
}

function workspaceWriteAllowed(absolutePath: string, cwd: string, tmpDir: string): boolean {
	return isInsideRoot(cwd, absolutePath) || isInsideRoot(tmpDir, absolutePath);
}

export function evaluateSandbox(input: EvaluateSandboxInput): SandboxDecision {
	if (input.profile === "off") {
		return { block: false };
	}

	const homeDir = input.homeDir ?? homedir();
	const pathValue = input.path;
	if (pathValue) {
		const absolutePath = resolveUserPath(input.cwd, pathValue);
		if (isSecretPath(absolutePath, homeDir)) {
			return { block: true, reason: "sandbox: refused secret path (~/.ssh, ~/.aws, ~/.gnupg)" };
		}
		const mutating = input.tool === "edit" || input.tool === "write";
		const workspaceOnlyRead = input.tool === "read" || input.tool === "ls" || input.tool === "grep" || input.tool === "find";
		if (mutating && !workspaceWriteAllowed(absolutePath, input.cwd, input.tmpDir)) {
			return { block: true, reason: "sandbox: write/edit must stay inside workspace or tmp" };
		}
		if (workspaceOnlyRead && !workspaceWriteAllowed(absolutePath, input.cwd, input.tmpDir) && !isInsideRoot(input.cwd, absolutePath)) {
			return { block: true, reason: "sandbox: path must stay inside workspace or tmp" };
		}
	}

	if (input.tool === "bash" && input.command && input.profile === "container" && NETWORK_COMMAND.test(input.command)) {
		return { block: true, reason: "sandbox: container profile blocks network commands" };
	}

	return { block: false };
}