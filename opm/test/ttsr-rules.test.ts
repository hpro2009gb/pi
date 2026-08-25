import { describe, expect, it } from "vitest";
import {
	TTSR_REMINDER_MARKER,
	applyTtsr,
	extractAssistantText,
	matchTtsr,
	shouldFireTtsr,
	ttsrEnabled,
} from "../packs/ttsr/rules.ts";

describe("matchTtsr", () => {
	it("hits unsolicited commit language", () => {
		expect(matchTtsr("I'll commit this now").id).toBe("commit");
		expect(matchTtsr("hay commit giup minh")?.id).toBe("commit");
	});

	it("hits skip-tests language", () => {
		expect(matchTtsr("We can skip the tests for now")?.id).toBe("skip-tests");
	});

	it("hits auto-learn language", () => {
		expect(matchTtsr("I'll save this as a skill")?.id).toBe("auto-learn");
		expect(matchTtsr("Let me write MEMORY.md")?.id).toBe("auto-learn");
	});

	it("ignores the reminder itself", () => {
		expect(matchTtsr(`${TTSR_REMINDER_MARKER} do not commit`)).toBeUndefined();
	});

	it("does not fire on ordinary coding text", () => {
		expect(matchTtsr("Fix the parser and add a unit test")).toBeUndefined();
	});
});

describe("shouldFireTtsr", () => {
	it("does not fire twice or when disabled", () => {
		expect(shouldFireTtsr({ text: "I'll commit this", fired: true, enabled: true })).toBeUndefined();
		expect(shouldFireTtsr({ text: "I'll commit this", fired: false, enabled: false })).toBeUndefined();
		expect(shouldFireTtsr({ text: "I'll commit this", fired: false, enabled: true })?.id).toBe("commit");
	});
});

describe("ttsrEnabled", () => {
	it("is on unless OPM_TTSR=0", () => {
		expect(ttsrEnabled({})).toBe(true);
		expect(ttsrEnabled({ OPM_TTSR: "0" })).toBe(false);
	});
});

describe("extractAssistantText", () => {
	it("joins text parts", () => {
		expect(
			extractAssistantText({
				role: "assistant",
				content: [{ type: "text", text: "I'll " }, { type: "text", text: "commit this" }],
			}),
		).toBe("I'll commit this");
	});
});

describe("applyTtsr", () => {
	it("aborts once and injects a follow-up reminder", () => {
		const calls: string[] = [];
		const state = { fired: false, enabled: true };
		expect(
			applyTtsr("I'll commit the fix", state, {
				abort: () => calls.push("abort"),
				remind: (text) => calls.push(text),
			}),
		).toBe(true);
		expect(state.fired).toBe(true);
		expect(calls[0]).toBe("abort");
		expect(calls[1]).toMatch(new RegExp(TTSR_REMINDER_MARKER));
		expect(calls[1]).toMatch(/commit/i);
		expect(
			applyTtsr("I'll commit again", state, {
				abort: () => calls.push("abort2"),
				remind: () => calls.push("remind2"),
			}),
		).toBe(false);
		expect(calls).toHaveLength(2);
	});
});
