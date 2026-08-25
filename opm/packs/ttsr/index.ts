import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	TTSR_REMINDER_MARKER,
	applyTtsr,
	extractAssistantText,
	ttsrEnabled,
} from "./rules.ts";

export default function ttsrPack(pi: ExtensionAPI): void {
	if (!ttsrEnabled()) {
		return;
	}

	const state = { fired: false };

	pi.on("before_agent_start", (event) => {
		if (!event.prompt.includes(TTSR_REMINDER_MARKER)) {
			state.fired = false;
		}
	});

	pi.on("message_update", (event, ctx) => {
		const text = extractAssistantText(event.message);
		applyTtsr(text, state, {
			abort: () => {
				ctx.abort();
			},
			remind: (reminder) => {
				pi.sendUserMessage(reminder, { deliverAs: "followUp" });
			},
		});
	});
}
