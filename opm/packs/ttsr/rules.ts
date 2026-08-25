export type TtsrRule = "commit" | "skip-tests" | "auto-learn";

export type TtsrMatch = { id: TtsrRule };

export const TTSR_REMINDER_MARKER = "[opm-ttsr]";

const RULES: Array<{ id: TtsrRule; re: RegExp }> = [
	{
		id: "commit",
		re: /\b(i'?ll|i will|let me|going to)\s+(commit|git commit)\b|hay commit|mình commit|minh commit|commit giúp|commit giup/i,
	},
	{
		id: "skip-tests",
		re: /\b(skip(ping)?|without)\s+(the\s+)?(tests|test suite)\b|không cần test|khong can test/i,
	},
	{
		id: "auto-learn",
		re: /\b(save|write|learn)\s+(this|that)\s+(as\s+)?(a\s+)?skill\b|\bwrite\s+MEMORY\.md\b|tự học skill|tu hoc skill/i,
	},
];

const REMINDERS: Record<TtsrRule, string> = {
	commit: "Do not commit unless the user explicitly asked. Stop and wait for a yes.",
	"skip-tests": "Do not skip tests unless the user explicitly asked.",
	"auto-learn":
		"Do not write skills or MEMORY.md unless the user explicitly asked. Memory is user-reviewed.",
};

export function matchTtsr(text: string): TtsrMatch | undefined {
	if (text.includes(TTSR_REMINDER_MARKER)) {
		return undefined;
	}
	for (const rule of RULES) {
		if (rule.re.test(text)) {
			return { id: rule.id };
		}
	}
	return undefined;
}

export function ttsrEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return env.OPM_TTSR !== "0";
}

export function shouldFireTtsr(args: {
	text: string;
	fired: boolean;
	enabled: boolean;
}): TtsrMatch | undefined {
	if (!args.enabled || args.fired) {
		return undefined;
	}
	return matchTtsr(args.text);
}

export function extractAssistantText(message: unknown): string {
	if (!message || typeof message !== "object") {
		return "";
	}
	const content = (message as { content?: unknown }).content;
	if (!Array.isArray(content)) {
		return "";
	}
	const parts: string[] = [];
	for (const part of content) {
		if (
			part &&
			typeof part === "object" &&
			(part as { type?: unknown }).type === "text" &&
			typeof (part as { text?: unknown }).text === "string"
		) {
			parts.push((part as { text: string }).text);
		}
	}
	return parts.join("");
}

export type TtsrRuntime = {
	abort: () => void;
	remind: (text: string) => void;
};

export function applyTtsr(
	text: string,
	state: { fired: boolean },
	runtime: TtsrRuntime,
	enabled: boolean = true,
): boolean {
	const match = shouldFireTtsr({ text, fired: state.fired, enabled });
	if (!match) {
		return false;
	}
	state.fired = true;
	runtime.abort();
	runtime.remind(`${TTSR_REMINDER_MARKER} ${REMINDERS[match.id]}`);
	return true;
}
