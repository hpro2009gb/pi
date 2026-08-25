import { readFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const VERIFY_MD = readFileSync(new URL("./VERIFY.md", import.meta.url), "utf8");

const USER_ASKED_GIT_WRITE = /\b(commit|push|tao commit|git commit)\b/i;
const GIT_WRITE = /\bgit\s+(commit|push|reset\s+--hard)\b/i;

export function shouldBlockGitWrite(command: string, lastUserText: string): boolean {
	if (!GIT_WRITE.test(command)) {
		return false;
	}
	return !USER_ASKED_GIT_WRITE.test(lastUserText);
}

export default function verifyPack(pi: ExtensionAPI): void {
	let lastUserText = "";

	pi.on("before_agent_start", async (event) => {
		lastUserText = event.prompt;
		return {
			systemPrompt: `${event.systemPrompt}\n\n${VERIFY_MD}`,
		};
	});

	pi.on("tool_call", async (event) => {
		if (event.toolName !== "bash") {
			return;
		}
		const command = "command" in event.input && typeof event.input.command === "string" ? event.input.command : "";
		if (shouldBlockGitWrite(command, lastUserText)) {
			return {
				block: true,
				reason: "verify pack: commit only when the user asked",
			};
		}
	});
}
