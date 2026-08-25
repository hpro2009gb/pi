import { describe, expect, it } from "vitest";
import { AGENT_PROFILES, PRESET_PACKS, type PackId, type PresetName } from "../src/pack-registry.ts";
import { AGENT_PROFILE_CATALOG, formatChooser, PACK_CATALOG, PRESET_CATALOG } from "../src/catalog.ts";

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

	it("lists agent-style profiles with closest packs and gaps", () => {
		expect(Object.keys(AGENT_PROFILE_CATALOG).sort()).toEqual(Object.keys(AGENT_PROFILES).sort());
		const text = formatChooser();
		expect(text).toMatch(/Profile phỏng theo/);
		expect(text).toContain("claude-code");
		expect(text).toContain("cline");
		expect(text).toContain("oh-my-pi");
		expect(text).toContain("codex");
		expect(text).toContain("cursor");
		expect(text).toContain("aider");
		expect(AGENT_PROFILE_CATALOG["claude-code"].mimics).toMatch(/Claude Code/);
		expect(AGENT_PROFILE_CATALOG.cline.startInPlan).toBe(true);
		expect(AGENT_PROFILE_CATALOG["claude-code"].startInPlan).toBe(false);
		expect(AGENT_PROFILE_CATALOG.codex.missing.toLowerCase()).toMatch(/sandbox/);
		expect(text).toContain("pi-super");
		expect(text).toContain("custom");
		expect(text).toMatch(/--with|--without/);
		expect(text).toMatch(/Pi \+/);
		expect(PRESET_CATALOG["pi-super"].packs).toEqual([
			"verify",
			"hashline",
			"ask",
			"plan",
			"lsp",
			"sandbox",
			"task",
			"browser",
		]);
		expect(PRESET_CATALOG["opm-full"].packs).toEqual(PRESET_CATALOG["pi-super"].packs);
		expect(PRESET_CATALOG["opm-full"].available).toBe(true);
		expect(PACK_CATALOG.browser.available).toBe(true);
		expect(text).not.toMatch(/browser chưa/);
		expect(AGENT_PROFILE_CATALOG.antigravity.samePacksAs).toBeUndefined();
		expect(AGENT_PROFILES.antigravity.packs).toEqual(["verify", "ask", "plan", "lsp", "task", "browser"]);
		expect(PRESET_CATALOG.custom.packs).toEqual([]);
	});
});
