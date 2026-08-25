import {
	extensionPathsForLaunch,
	isLaunchName,
	startLaunchInPlan,
	type LaunchName,
	type PresetName,
} from "./pack-registry.ts";

export type { LaunchName, PresetName };

export type LaunchPlan = {
	preset: LaunchName;
	extensionPaths: string[];
	extraArgs: string[];
};

const NAME_FLAGS = new Set(["--preset", "--profile"]);

function parseLaunchName(value: string | undefined): LaunchName {
	if (value && isLaunchName(value)) {
		return value;
	}
	throw new Error(`Unknown preset or profile: ${value ?? "(missing)"}`);
}

export function resolveLaunchPlan(argv: string[]): LaunchPlan {
	const extraArgs: string[] = [];
	let preset: LaunchName = "opm-verify";
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (NAME_FLAGS.has(arg)) {
			preset = parseLaunchName(argv[++i]);
			continue;
		}
		extraArgs.push(arg);
	}
	if (startLaunchInPlan(preset) && !extraArgs.includes("--plan")) {
		extraArgs.unshift("--plan");
	}
	return { preset, extraArgs, extensionPaths: extensionPathsForLaunch(preset) };
}
