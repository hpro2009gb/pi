import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type PresetName = "pi" | "opm-verify" | "opm-plan" | "opm-full";

export type PackId = "verify" | "hashline" | "ask" | "plan" | "lsp" | "sandbox" | "task" | "browser";

export const PRESET_PACKS: Record<PresetName, PackId[]> = {
	pi: [],
	"opm-verify": ["verify", "hashline", "ask", "lsp"],
	"opm-plan": ["verify", "hashline", "ask", "lsp", "plan"],
	"opm-full": ["verify", "hashline", "ask", "lsp", "plan", "sandbox", "task", "browser"],
};

export function opmRoot(): string {
	return fileURLToPath(new URL("..", import.meta.url));
}

export function packPath(id: PackId): string {
	return join(opmRoot(), "packs", id, "index.ts");
}

export function extensionPathsForPreset(preset: PresetName): string[] {
	return PRESET_PACKS[preset].map(packPath);
}
