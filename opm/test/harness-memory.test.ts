import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../../packages/coding-agent/test/suite/harness.ts";
import memoryPack from "../packs/memory/index.ts";
import { MEMORY_TEMPLATE } from "../packs/memory/files.ts";

describe("OPM memory pack on faux AgentSession", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("creates MEMORY.md in the session cwd via /memory init", async () => {
		const harness = await createHarness({
			extensionFactories: [memoryPack],
		});
		harnesses.push(harness);

		await harness.session.prompt("/memory init");

		const path = join(harness.tempDir, "MEMORY.md");
		expect(existsSync(path)).toBe(true);
		expect(readFileSync(path, "utf8")).toBe(MEMORY_TEMPLATE);
	});
});
