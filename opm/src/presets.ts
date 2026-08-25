import { extensionPathsForPreset, type PresetName } from "./pack-registry.ts";

export type { PresetName };

export type LaunchPlan = {
	preset: PresetName;
	extensionPaths: string[];
	extraArgs: string[];
};

const PRESET_FLAG = "--preset";

export function resolveLaunchPlan(argv: string[]): LaunchPlan {
	const extraArgs: string[] = [];
	let preset: PresetName = "opm-verify";
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (arg === PRESET_FLAG) {
			const value = argv[++i];
			if (value === "pi" || value === "opm-verify" || value === "opm-plan" || value === "opm-full") {
				preset = value;
			} else {
				throw new Error(`Unknown preset: ${value ?? "(missing)"}`);
			}
			continue;
		}
		extraArgs.push(arg);
	}
	return { preset, extraArgs, extensionPaths: extensionPathsForPreset(preset) };
}
