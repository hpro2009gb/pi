import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import {
	createHarness,
	getAssistantTexts,
	getMessageText,
	type Harness,
} from "../../packages/coding-agent/test/suite/harness.ts";
import verifyPack from "../packs/verify/index.ts";

function bashProbe(): { tool: AgentTool; executed: { value: boolean } } {
	const executed = { value: false };
	const tool: AgentTool = {
		name: "bash",
		label: "bash",
		description: "Run a shell command",
		parameters: Type.Object({ command: Type.String() }),
		execute: async () => {
			executed.value = true;
			return { content: [{ type: "text", text: "committed" }], details: {} };
		},
	};
	return { tool, executed };
}

function toolResultText(harness: Harness): string {
	const result = harness.session.messages.find((message) => message.role === "toolResult");
	return result ? getMessageText(result) : "";
}

describe("OPM verify pack on faux AgentSession", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("blocks git commit when the user did not ask", async () => {
		const { tool, executed } = bashProbe();
		const harness = await createHarness({
			tools: [tool],
			extensionFactories: [verifyPack],
		});
		harnesses.push(harness);
		harness.setResponses([
			(context) => {
				expect(context.systemPrompt ?? "").toMatch(/Never commit/);
				return fauxAssistantMessage([fauxToolCall("bash", { command: "git commit -am x" })], {
					stopReason: "toolUse",
				});
			},
			(context) => {
				const toolResult = context.messages.find((message) => message.role === "toolResult");
				const errorText =
					toolResult?.role === "toolResult"
						? toolResult.content
								.filter((part): part is { type: "text"; text: string } => part.type === "text")
								.map((part) => part.text)
								.join("\n")
						: "";
				return fauxAssistantMessage(errorText);
			},
		]);

		await harness.session.prompt("fix the bug");

		expect(executed.value).toBe(false);
		expect(harness.session.messages.find((message) => message.role === "toolResult" && message.isError)).toBeDefined();
		expect(toolResultText(harness)).toMatch(/verify pack|commit/i);
		expect(getAssistantTexts(harness).join("\n")).toMatch(/verify pack|commit/i);
	});

	it("allows git commit when the user asked", async () => {
		const { tool, executed } = bashProbe();
		const harness = await createHarness({
			tools: [tool],
			extensionFactories: [verifyPack],
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("bash", { command: "git commit -am x" })], { stopReason: "toolUse" }),
			fauxAssistantMessage("ok"),
		]);

		await harness.session.prompt("hay commit giup minh");

		expect(executed.value).toBe(true);
		expect(harness.session.messages.find((message) => message.role === "toolResult" && message.isError)).toBeUndefined();
		expect(toolResultText(harness)).toContain("committed");
	});
});
