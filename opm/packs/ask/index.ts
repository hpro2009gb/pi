import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export const askParams = Type.Object({
	question: Type.String({ description: "The question to ask the user" }),
	options: Type.Optional(Type.Array(Type.String(), { description: "Options for the user to choose from" })),
	multi: Type.Optional(Type.Boolean({ description: "When true, the user may pick more than one option" })),
});

function isYesNo(options: string[]): boolean {
	if (options.length !== 2) {
		return false;
	}
	const normalized = options.map((option) => option.trim().toLowerCase());
	return normalized.includes("yes") && normalized.includes("no");
}

export default function askPack(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "ask",
		label: "ask",
		description:
			"Ask the user a structured question. Use when you need a choice or confirmation before proceeding.",
		parameters: askParams,
		executionMode: "sequential",
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (ctx.mode !== "tui") {
				return {
					content: [{ type: "text" as const, text: "Error: UI not available (running in non-interactive mode)" }],
					details: { question: params.question, options: params.options ?? [], answer: null },
				};
			}

			const options = params.options ?? [];

			if (params.multi === true) {
				const placeholder = options.length > 0 ? options.join(", ") : "Type one or more answers";
				const answer = await ctx.ui.input(params.question, placeholder);
				if (answer === undefined) {
					return {
						content: [{ type: "text" as const, text: "User cancelled the question" }],
						details: { question: params.question, options, answer: null },
					};
				}
				return {
					content: [{ type: "text" as const, text: `User answered: ${answer}` }],
					details: { question: params.question, options, answer },
				};
			}

			if (isYesNo(options)) {
				const accepted = await ctx.ui.confirm(params.question, "Choose yes or no.");
				const answer = accepted ? "yes" : "no";
				return {
					content: [{ type: "text" as const, text: `User selected: ${answer}` }],
					details: { question: params.question, options, answer },
				};
			}

			if (options.length >= 2) {
				const answer = await ctx.ui.select(params.question, options);
				if (answer === undefined) {
					return {
						content: [{ type: "text" as const, text: "User cancelled the selection" }],
						details: { question: params.question, options, answer: null },
					};
				}
				return {
					content: [{ type: "text" as const, text: `User selected: ${answer}` }],
					details: { question: params.question, options, answer },
				};
			}

			const answer = await ctx.ui.input(params.question, "Type an answer");
			if (answer === undefined) {
				return {
					content: [{ type: "text" as const, text: "User cancelled the question" }],
					details: { question: params.question, options, answer: null },
				};
			}
			return {
				content: [{ type: "text" as const, text: `User answered: ${answer}` }],
				details: { question: params.question, options, answer },
			};
		},
	});
}
