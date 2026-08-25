export type TaskAgent = "scout" | "worker";

export function parseTaskAgent(value: string): TaskAgent {
	if (value === "scout" || value === "worker") {
		return value;
	}
	throw new Error(`Unknown agent: ${value}`);
}

export type BuildTaskArgsOptions = {
	agent: TaskAgent;
	task: string;
	verifyPack: string;
	promptFile?: string;
	sandboxPack?: string;
};

export function buildTaskArgs(options: BuildTaskArgsOptions): string[] {
	const args = ["--no-extensions", "-e", options.verifyPack, "--mode", "json", "-p", "--no-session"];
	if (options.sandboxPack) {
		args.push("-e", options.sandboxPack);
	}
	if (options.promptFile) {
		args.push("--append-system-prompt", options.promptFile);
	}
	if (options.agent === "scout") {
		args.push("--tools", "read,bash");
	}
	args.push(options.task);
	return args;
}