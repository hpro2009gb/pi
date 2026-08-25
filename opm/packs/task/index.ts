import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { buildTaskArgs, parseTaskAgent, type TaskAgent } from "./invoke.ts";

const OUTPUT_CAP = 50 * 1024;
const VERIFY_PACK = fileURLToPath(new URL("../verify/index.ts", import.meta.url));
const SANDBOX_PACK = fileURLToPath(new URL("../sandbox/index.ts", import.meta.url));
const SCOUT_PROMPT = fileURLToPath(new URL("./prompts/scout.md", import.meta.url));
const WORKER_PROMPT = fileURLToPath(new URL("./prompts/worker.md", import.meta.url));

const taskParams = Type.Object({
	agent: Type.Union([Type.Literal("scout"), Type.Literal("worker")]),
	task: Type.String({ description: "Work for the isolated subagent" }),
});

function promptFileFor(agent: TaskAgent): string {
	return agent === "scout" ? SCOUT_PROMPT : WORKER_PROMPT;
}

function cap(text: string): string {
	if (text.length <= OUTPUT_CAP) {
		return text;
	}
	return `${text.slice(0, OUTPUT_CAP)}\n… truncated`;
}

function runPiTask(
	args: string[],
	cwd: string,
	signal: AbortSignal | undefined,
	sandboxProfile: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
	const command = process.env.OPM_PI_BIN || "pi";
	const env = { ...process.env, OPM_SANDBOX: sandboxProfile };
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			env,
		});
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString("utf8");
		});
		const kill = (): void => {
			child.kill("SIGTERM");
		};
		if (signal) {
			if (signal.aborted) {
				kill();
			} else {
				signal.addEventListener("abort", kill, { once: true });
			}
		}
		child.on("error", (error) => {
			resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` });
		});
		child.on("close", (code) => {
			resolve({ code: code ?? 1, stdout, stderr });
		});
	});
}

export default function taskPack(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "task",
		label: "task",
		description:
			"Run an isolated subagent. scout = read-only recon (read+bash). worker = full tools with verify pack (no unsolicited commit).",
		parameters: taskParams,
		executionMode: "sequential",
		async execute(_id, params, signal, _onUpdate, ctx) {
			let agent: TaskAgent;
			try {
				agent = parseTaskAgent(params.agent);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return { content: [{ type: "text" as const, text: message }] };
			}
			const args = buildTaskArgs({
				agent,
				task: params.task,
				verifyPack: VERIFY_PACK,
				sandboxPack: SANDBOX_PACK,
				promptFile: promptFileFor(agent),
			});
			const flag = pi.getFlag("sandbox");
			const sandboxProfile = typeof flag === "string" && flag.length > 0 ? flag : (process.env.OPM_SANDBOX ?? "off");
			const result = await runPiTask(args, ctx.cwd, signal, sandboxProfile);
			const body = cap(
				[`agent=${agent} exit=${result.code}`, result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n"),
			);
			return { content: [{ type: "text" as const, text: body }] };
		},
	});
}