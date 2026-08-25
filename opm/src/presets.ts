import {
	applyPackToggles,
	extensionPathsForPacks,
	isLaunchName,
	parsePackList,
	packsForLaunch,
	startLaunchInPlan,
	type LaunchName,
	type PackId,
	type PresetName,
} from "./pack-registry.ts";

export type { LaunchName, PresetName };

export type LaunchPlan = {
	preset: LaunchName;
	packs: PackId[];
	extensionPaths: string[];
	extraArgs: string[];
};

export type ResolveLaunchOptions = {
	savedCustomPacks?: PackId[];
};

const NAME_FLAGS = new Set(["--preset", "--profile"]);
const ADD_FLAGS = new Set(["--with", "--enable"]);
const REMOVE_FLAGS = new Set(["--without", "--disable"]);

function parseLaunchName(value: string | undefined): LaunchName {
	if (value && isLaunchName(value)) {
		return value;
	}
	throw new Error(`Unknown preset or profile: ${value ?? "(missing)"}`);
}

function takeValue(argv: string[], index: number, flag: string): { value: string; nextIndex: number } {
	const value = argv[index + 1];
	if (value === undefined || value.startsWith("-")) {
		throw new Error(`${flag} requires a value`);
	}
	return { value, nextIndex: index + 1 };
}

export function resolveLaunchPlan(argv: string[], options: ResolveLaunchOptions = {}): LaunchPlan {
	const extraArgs: string[] = [];
	const add: PackId[] = [];
	const remove: PackId[] = [];
	let preset: LaunchName = "opm-verify";

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (NAME_FLAGS.has(arg)) {
			const taken = takeValue(argv, i, arg);
			preset = parseLaunchName(taken.value);
			i = taken.nextIndex;
			continue;
		}
		if (ADD_FLAGS.has(arg)) {
			const taken = takeValue(argv, i, arg);
			add.push(...parsePackList(taken.value));
			i = taken.nextIndex;
			continue;
		}
		if (REMOVE_FLAGS.has(arg)) {
			const taken = takeValue(argv, i, arg);
			remove.push(...parsePackList(taken.value));
			i = taken.nextIndex;
			continue;
		}
		extraArgs.push(arg);
	}

	let base = packsForLaunch(preset);
	if (preset === "custom" && base.length === 0) {
		base = options.savedCustomPacks ?? [];
		if (base.length === 0 && add.length === 0) {
			throw new Error("custom requires --with <packs> or a saved combo from `opm customize`");
		}
	}

	const packs = applyPackToggles(base, add, remove);
	if (startLaunchInPlan(preset) && packs.includes("plan") && !extraArgs.includes("--plan")) {
		extraArgs.unshift("--plan");
	}
	if (preset === "codex" && packs.includes("sandbox") && !extraArgs.includes("--sandbox")) {
		extraArgs.unshift("--sandbox", "workspace");
	}

	return {
		preset,
		packs,
		extraArgs,
		extensionPaths: extensionPathsForPacks(packs),
	};
}
