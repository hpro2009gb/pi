import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type PresetName = "pi" | "opm-verify" | "opm-plan" | "opm-full";

export type AgentProfileId =
	| "claude-code"
	| "cline"
	| "kilo"
	| "command-code"
	| "opencode"
	| "codex"
	| "oh-my-pi"
	| "cursor"
	| "aider"
	| "copilot"
	| "amp"
	| "antigravity";

export type LaunchName = PresetName | AgentProfileId;

export type PackId = "verify" | "hashline" | "ask" | "plan" | "lsp" | "sandbox" | "task" | "browser";

export type AgentProfileDef = {
	packs: PackId[];
	startInPlan: boolean;
};

export const PRESET_PACKS: Record<PresetName, PackId[]> = {
	pi: [],
	"opm-verify": ["verify", "hashline", "ask", "lsp"],
	"opm-plan": ["verify", "hashline", "ask", "lsp", "plan"],
	"opm-full": ["verify", "hashline", "ask", "lsp", "plan", "sandbox", "task", "browser"],
};

export const AGENT_PROFILES: Record<AgentProfileId, AgentProfileDef> = {
	"claude-code": { packs: ["verify", "ask", "plan", "lsp"], startInPlan: false },
	amp: { packs: ["verify", "ask", "plan", "lsp"], startInPlan: false },
	antigravity: { packs: ["verify", "ask", "plan", "lsp"], startInPlan: false },
	cline: { packs: ["verify", "ask", "plan"], startInPlan: true },
	kilo: { packs: ["verify", "ask", "plan"], startInPlan: true },
	"command-code": { packs: ["verify", "ask", "plan"], startInPlan: true },
	opencode: { packs: ["verify", "ask", "lsp"], startInPlan: false },
	copilot: { packs: ["verify", "ask", "lsp"], startInPlan: false },
	codex: { packs: ["verify"], startInPlan: false },
	"oh-my-pi": { packs: ["verify", "hashline", "ask", "lsp", "plan"], startInPlan: false },
	cursor: { packs: ["verify", "hashline", "ask", "lsp"], startInPlan: false },
	aider: { packs: ["verify", "hashline", "ask"], startInPlan: false },
};

export function isPresetName(value: string): value is PresetName {
	return Object.hasOwn(PRESET_PACKS, value);
}

export function isAgentProfileId(value: string): value is AgentProfileId {
	return Object.hasOwn(AGENT_PROFILES, value);
}

export function isLaunchName(value: string): value is LaunchName {
	return isPresetName(value) || isAgentProfileId(value);
}

export function packsForLaunch(name: LaunchName): PackId[] {
	if (isPresetName(name)) {
		return PRESET_PACKS[name];
	}
	return AGENT_PROFILES[name].packs;
}

export function startLaunchInPlan(name: LaunchName): boolean {
	return isAgentProfileId(name) && AGENT_PROFILES[name].startInPlan;
}

export function opmRoot(): string {
	return fileURLToPath(new URL("..", import.meta.url));
}

export function packPath(id: PackId): string {
	return join(opmRoot(), "packs", id, "index.ts");
}

export function extensionPathsForLaunch(name: LaunchName): string[] {
	return packsForLaunch(name).map(packPath);
}

export function extensionPathsForPreset(preset: PresetName): string[] {
	return extensionPathsForLaunch(preset);
}
