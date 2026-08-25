import { afterEach, describe, expect, it } from "vitest";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { createHarness, getMessageText, type Harness } from "../../packages/coding-agent/test/suite/harness.ts";
import browserPack from "../packs/browser/index.ts";

describe("OPM browser pack on faux AgentSession", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("registers browser, not computer, and snapshot returns chrome evidence or a missing-bin error", async () => {
		const harness = await createHarness({
			extensionFactories: [browserPack],
		});
		harnesses.push(harness);
		expect(harness.session.getActiveToolNames()).toContain("browser");
		expect(harness.session.getActiveToolNames()).not.toContain("computer");
		harness.setResponses([
			fauxAssistantMessage(
				[fauxToolCall("browser", { action: "snapshot", url: "https://example.com" })],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage("done"),
		]);

		await harness.session.prompt("capture the UI");

		const result = harness.session.messages.find((message) => message.role === "toolResult");
		expect(result).toBeDefined();
		expect(getMessageText(result)).toMatch(/OPM_CHROME_BIN|chromium|chrome|html|dump-dom/i);
		expect(getMessageText(result)).not.toMatch(/\bcomputer\b/i);
	});
});
