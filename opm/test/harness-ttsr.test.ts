import { afterEach, describe, expect, it } from "vitest";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import {
	createHarness,
	getUserTexts,
	type Harness,
} from "../../packages/coding-agent/test/suite/harness.ts";
import ttsrPack from "../packs/ttsr/index.ts";
import { TTSR_REMINDER_MARKER } from "../packs/ttsr/rules.ts";

describe("OPM ttsr pack on faux AgentSession", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("aborts unsolicited commit speech and injects a follow-up reminder", async () => {
		const harness = await createHarness({
			extensionFactories: [ttsrPack],
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage("I'll commit this now"),
			fauxAssistantMessage("I will wait for a yes"),
		]);

		await harness.session.prompt("fix the bug");

		expect(getUserTexts(harness).some((text) => text.includes(TTSR_REMINDER_MARKER))).toBe(true);
	});
});
