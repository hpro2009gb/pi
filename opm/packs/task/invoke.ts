export type TaskAgent = "scout" | "worker";

export const MAX_PARALLEL_TASKS = 8;
export const MAX_CONCURRENCY = 4;

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

export type TaskJob = { agent: TaskAgent; task: string };

export type FanoutMode = "single" | "parallel" | "chain";

export type FanoutOk = { ok: true; mode: FanoutMode; jobs: TaskJob[] };
export type FanoutErr = { ok: false; error: string };
export type FanoutParse = FanoutOk | FanoutErr;

export type TaskJobInput = { agent?: string; task?: string };

export type TaskInput = {
	agent?: string;
	task?: string;
	tasks?: TaskJobInput[];
	chain?: TaskJobInput[];
};

export type ChildResult = { code: number; stdout: string; stderr: string };

function parseJob(item: TaskJobInput): TaskJob {
	if (typeof item.agent !== "string" || typeof item.task !== "string" || item.task.length === 0) {
		throw new Error("Each job needs agent and task");
	}
	return { agent: parseTaskAgent(item.agent), task: item.task };
}

function parseJobList(items: TaskJobInput[], label: string): TaskJob[] | FanoutErr {
	if (items.length > MAX_PARALLEL_TASKS) {
		return { ok: false, error: `Too many ${label} (${items.length}). Max is ${MAX_PARALLEL_TASKS}.` };
	}
	try {
		return items.map(parseJob);
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export function parseFanoutInput(input: TaskInput): FanoutParse {
	const hasSingle = typeof input.agent === "string" && typeof input.task === "string" && input.task.length > 0;
	const hasTasks = Array.isArray(input.tasks) && input.tasks.length > 0;
	const hasChain = Array.isArray(input.chain) && input.chain.length > 0;
	const modeCount = Number(hasSingle) + Number(hasTasks) + Number(hasChain);
	if (modeCount !== 1) {
		return { ok: false, error: "Provide exactly one of: agent+task, tasks[], or chain[]" };
	}
	if (hasSingle) {
		try {
			return { ok: true, mode: "single", jobs: [parseJob({ agent: input.agent, task: input.task })] };
		} catch (error) {
			return { ok: false, error: error instanceof Error ? error.message : String(error) };
		}
	}
	if (hasTasks) {
		const jobs = parseJobList(input.tasks ?? [], "parallel tasks");
		if (!Array.isArray(jobs)) {
			return jobs;
		}
		return { ok: true, mode: "parallel", jobs };
	}
	const jobs = parseJobList(input.chain ?? [], "chain steps");
	if (!Array.isArray(jobs)) {
		return jobs;
	}
	return { ok: true, mode: "chain", jobs };
}

export function applyPreviousPlaceholder(task: string, previous: string): string {
	return task.replaceAll("{previous}", previous);
}

export async function mapWithConcurrencyLimit<TIn, TOut>(
	items: readonly TIn[],
	concurrency: number,
	fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
	if (items.length === 0) {
		return [];
	}
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = Array.from({ length: limit }, async () => {
		while (true) {
			const current = nextIndex;
			nextIndex += 1;
			if (current >= items.length) {
				return;
			}
			const item = items[current];
			if (item === undefined) {
				return;
			}
			results[current] = await fn(item, current);
		}
	});
	await Promise.all(workers);
	return results;
}

function jobBody(result: ChildResult): string {
	return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
}

export function formatFanoutReport(mode: FanoutMode, jobs: TaskJob[], results: ChildResult[]): string {
	if (mode === "single" && jobs[0] && results[0]) {
		return [`agent=${jobs[0].agent} exit=${results[0].code}`, jobBody(results[0])].filter(Boolean).join("\n");
	}
	if (mode === "parallel") {
		const success = results.filter((result) => result.code === 0).length;
		const blocks = jobs.map((job, index) => {
			const result = results[index] ?? { code: 1, stdout: "", stderr: "(missing)" };
			const status = result.code === 0 ? "completed" : "failed";
			return `### [${job.agent}] ${status}\n\n${jobBody(result) || "(no output)"}`;
		});
		return `Parallel: ${success}/${results.length} succeeded\n\n${blocks.join("\n\n---\n\n")}`;
	}
	const blocks = jobs.map((job, index) => {
		const result = results[index] ?? { code: 1, stdout: "", stderr: "(missing)" };
		const status = result.code === 0 ? "completed" : "failed";
		return `### step ${index + 1} [${job.agent}] ${status}\n\n${jobBody(result) || "(no output)"}`;
	});
	return `Chain: ${results.filter((result) => result.code === 0).length}/${jobs.length} steps\n\n${blocks.join("\n\n---\n\n")}`;
}

export async function runFanoutJobs(
	parsed: FanoutOk,
	run: (job: TaskJob) => Promise<ChildResult>,
	options?: { concurrency?: number },
): Promise<{ results: ChildResult[]; text: string }> {
	if (parsed.mode === "chain") {
		const results: ChildResult[] = [];
		const ran: TaskJob[] = [];
		let previous = "";
		for (let i = 0; i < parsed.jobs.length; i++) {
			const template = parsed.jobs[i];
			if (!template) {
				break;
			}
			const job: TaskJob = {
				agent: template.agent,
				task: applyPreviousPlaceholder(template.task, previous),
			};
			ran.push(job);
			const result = await run(job);
			results.push(result);
			if (result.code !== 0) {
				return {
					results,
					text: `Chain stopped at step ${i + 1} (${job.agent}): ${jobBody(result) || `exit ${result.code}`}\n\n${formatFanoutReport("chain", ran, results)}`,
				};
			}
			previous = result.stdout.trim() || result.stderr.trim();
		}
		return { results, text: formatFanoutReport("chain", ran, results) };
	}

	if (parsed.mode === "single") {
		const job = parsed.jobs[0];
		if (!job) {
			return { results: [], text: "No job" };
		}
		const results = [await run(job)];
		return { results, text: formatFanoutReport("single", [job], results) };
	}

	const concurrency = options?.concurrency ?? MAX_CONCURRENCY;
	const results = await mapWithConcurrencyLimit(parsed.jobs, concurrency, (job) => run(job));
	return { results, text: formatFanoutReport("parallel", parsed.jobs, results) };
}
