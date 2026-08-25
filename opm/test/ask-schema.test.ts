import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";
import { askParams } from "../packs/ask/index.ts";

describe("askParams", () => {
	it("requires question", () => {
		expect(Check(askParams, {})).toBe(false);
		expect(Check(askParams, { question: "Which option?" })).toBe(true);
	});
});
