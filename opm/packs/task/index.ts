import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
	buildTaskArgs,
	parseFanoutInput,
	resolveChildInvocation,
	runFanoutJobs,
	type TaskAgent,
	type TaskJob,
} from "./invoke.ts";

const OUTPUT_CAP = 50 * 1024;
const VERIFY_PACK = fileURLToPath(new URL("../verify/index.ts", import.meta.url));
const SANDBOX_PACK = fileURLToPath(new URL("../sandbox/index.ts", import.meta.url));
const SCOUT_PROMPT = fileURLToPath(new URL("./prompts/scout.md", import.meta.url));
const WORKER_PROMPT = fileURLToPath(new URL("./prompts/worker.md", import.meta.url));

const taskJob = Type.Object({
	agent: Type.Union([Type.Literal("scout"), Type.Literal("worker")]),
	task: Type.String({ description: "Work for the isolated subagent" }),
});

const taskParams = Type.Object({
	agent: Type.Optional(Type.Union([Type.Literal("scout"), Type.Literal("worker")])),
	task: Type.Optional(Type.String({ description: "Work for the isolated subagent (single mode)" })),
	tasks: Type.Optional(Type.Array(taskJob, { description: "Fan-out: run these jobs in parallel" })),
	chain: Type.Optional(Type.Array(taskJob, { description: "Run jobs in order; `{previous}` is prior stdout" })),
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
	// Inherit PI_CODING_AGENT_DIR so children keep parent auth; --no-session isolates the session file.
	const env = { ...process.env, OPM_SANDBOX: sandboxProfile };
	const invocation = resolveChildInvocation(args, env);
	return new Promise((resolve) => {
		const child = spawn(invocation.command, invocation.args, {
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
			"Isolated subagent. Single: agent+task. Fan-out: tasks[] (parallel, max 8, concurrency 4). Chain: chain[] sequential with {previous}. scout = read+bash. worker = full tools + verify (no unsolicited commit).",
		parameters: taskParams,
		executionMode: "parallel",
		async execute(_id, params, signal, _onUpdate, ctx) {
			const parsed = parseFanoutInput({
				agent: params.agent,
				task: params.task,
				tasks: params.tasks,
				chain: params.chain,
			});
			if (!parsed.ok) {
				return { content: [{ type: "text" as const, text: parsed.error }] };
			}
			const flag = pi.getFlag("sandbox");
			const sandboxProfile = typeof flag === "string" && flag.length > 0 ? flag : (process.env.OPM_SANDBOX ?? "off");
			const model = ctx.model;
			const modelRef =
				model && typeof model.provider === "string" && typeof model.id === "string"
					? `${model.provider}/${model.id}`
					: undefined;
			const thinking = ctx.thinkingLevel;
			const { text } = await runFanoutJobs(parsed, (job: TaskJob) => {
				const args = buildTaskArgs({
					agent: job.agent,
					task: job.task,
					verifyPack: VERIFY_PACK,
					sandboxPack: SANDBOX_PACK,
					promptFile: promptFileFor(job.agent),
					model: modelRef,
					thinking: typeof thinking === "string" ? thinking : undefined,
				});
				return runPiTask(args, ctx.cwd, signal, sandboxProfile);
			});
			return { content: [{ type: "text" as const, text: cap(text) }] };
		},
	});
}
