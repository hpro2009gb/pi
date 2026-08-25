import { tmpdir } from "node:os";
import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { evaluateSandbox, parseSandboxProfile, type SandboxProfile } from "./policy.ts";

function inputString(input: Record<string, unknown>, key: string): string | undefined {
	const value = input[key];
	return typeof value === "string" ? value : undefined;
}

function profileFromPi(pi: ExtensionAPI): SandboxProfile {
	const flag = pi.getFlag("sandbox");
	const raw = typeof flag === "string" && flag.length > 0 ? flag : (process.env.OPM_SANDBOX ?? "off");
	try {
		return parseSandboxProfile(raw);
	} catch {
		return "off";
	}
}

export default function sandboxPack(pi: ExtensionAPI): void {
	pi.registerFlag("sandbox", {
		description: "OPM sandbox profile: off, workspace, or container (policy isolation, not a VM)",
		type: "string",
		default: "off",
	});

	let cwd = process.cwd();

	pi.on("session_start", async (_event, ctx) => {
		cwd = ctx.cwd;
		const profile = profileFromPi(pi);
		const detail =
			profile === "off"
				? "Sandbox off (Pi user-permission)."
				: profile === "workspace"
					? "Workspace policy: writes in cwd/tmp; secrets denied; network allowed."
					: "Container policy: workspace rules plus no network commands. Not a VM.";
		ctx.ui.notify(`OPM sandbox: ${profile}. ${detail}`, profile === "off" ? "info" : "warning");
	});

	pi.on("tool_call", async (event: ToolCallEvent) => {
		const input = event.input as Record<string, unknown>;
		const result = evaluateSandbox({
			profile: profileFromPi(pi),
			tool: event.toolName,
			path: inputString(input, "path"),
			command: inputString(input, "command"),
			cwd,
			tmpDir: tmpdir(),
		});
		if (result.block) {
			return { block: true, reason: result.reason };
		}
	});

	pi.registerCommand("sandbox", {
		description: "Show OPM sandbox profile",
		handler: async (_args, ctx) => {
			const profile = profileFromPi(pi);
			ctx.ui.notify(`OPM sandbox profile: ${profile} (off | workspace | container)`, "info");
		},
	});
}