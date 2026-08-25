import { describe, expect, it } from "vitest";
import { PRESET_PACKS, type PackId, type PresetName } from "../src/pack-registry.ts";
import { formatChooser, PACK_CATALOG, PRESET_CATALOG } from "../src/catalog.ts";

const ALL_PRESETS = Object.keys(PRESET_PACKS) as PresetName[];
const ALL_PACKS = [...new Set(Object.values(PRESET_PACKS).flat())] as PackId[];

describe("chooser catalog", () => {
	it("has an entry for every preset", () => {
		expect(Object.keys(PRESET_CATALOG).sort()).toEqual([...ALL_PRESETS].sort());
	});

	it("has an entry for every pack", () => {
		expect(Object.keys(PACK_CATALOG).sort()).toEqual([...ALL_PACKS].sort());
	});

	it("explains what OPM is, what is special, and which agents it learned from", () => {
		const text = formatChooser();
		expect(text).toMatch(/OPM/);
		expect(text).toMatch(/không fork|khong fork/i);
		expect(text).toContain("Pi");
		expect(text).toMatch(/Oh My Pi|\bomp\b/);
		expect(text).toContain("Claude Code");
		expect(text).toContain("Cline");
		expect(text).toContain("Codex");
		for (const preset of ALL_PRESETS) {
			expect(text).toContain(preset);
		}
		for (const pack of ALL_PACKS) {
			expect(text).toContain(pack);
		}
		expect(PACK_CATALOG.hashline.learnedFrom).toMatch(/omp|Oh My Pi/i);
		expect(PACK_CATALOG.plan.learnedFrom).toMatch(/Claude Code/);
		expect(PACK_CATALOG.verify.learnedFrom).toMatch(/OPM|Pi/i);
	});
});
