import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACK_CATALOG } from "./catalog.ts";
import { defaultOpmAgentDir } from "./init.ts";
import { isLaunchName, isPackId, PACK_ORDER, uniquePacks, type LaunchName, type PackId } from "./pack-registry.ts";
import { resolveLaunchPlan } from "./presets.ts";

export function customPacksPath(agentDir: string): string {
	return join(agentDir, "custom-packs.json");
}

export function formatPackCheckboxes(selected: PackId[]): string {
	const on = new Set(selected);
	return PACK_ORDER.map((id) => {
		const mark = on.has(id) ? "x" : " ";
		const status = PACK_CATALOG[id].available ? "" : " (chưa v1)";
		return `[${mark}] ${id}${status}`;
	}).join("\n");
}

export function saveCustomPacks(agentDir: string, packs: PackId[], from?: LaunchName): void {
	mkdirSync(agentDir, { recursive: true });
	const body = {
		from: from ?? "custom",
		packs: uniquePacks(packs),
	};
	writeFileSync(customPacksPath(agentDir), `${JSON.stringify(body, null, 2)}\n`);
}

export function loadCustomPacks(agentDir: string): PackId[] | undefined {
	const path = customPacksPath(agentDir);
	if (!existsSync(path)) {
		return undefined;
	}
	const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (!raw || typeof raw !== "object" || !("packs" in raw) || !Array.isArray(raw.packs)) {
		throw new Error(`Invalid custom pack file: ${path}`);
	}
	const packs: PackId[] = [];
	for (const item of raw.packs) {
		if (typeof item !== "string" || !isPackId(item)) {
			throw new Error(`Invalid pack in ${path}: ${String(item)}`);
		}
		packs.push(item);
	}
	return uniquePacks(packs);
}

export function resolveCustomizeDir(override?: string): string {
	return override ?? defaultOpmAgentDir();
}

export function parseCustomizeArgs(argv: string[]): { from: LaunchName; rest: string[] } {
	const rest: string[] = [];
	let from: LaunchName = "custom";
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (arg === "--from") {
			const value = argv[i + 1];
			if (value === undefined || value.startsWith("-")) {
				throw new Error("--from requires a value");
			}
			if (!isLaunchName(value)) {
				throw new Error(`Unknown preset or profile: ${value}`);
			}
			from = value;
			i += 1;
			continue;
		}
		rest.push(arg);
	}
	return { from, rest };
}

export function runCustomize(argv: string[], agentDir = defaultOpmAgentDir()): string {
	const { from, rest } = parseCustomizeArgs(argv);
	const plan = resolveLaunchPlan(["--profile", from, ...rest], {
		savedCustomPacks: loadCustomPacks(agentDir),
	});
	saveCustomPacks(agentDir, plan.packs, plan.preset);
	const selected = plan.packs.length === 0 ? "(none)" : plan.packs.join(", ");
	return [`Saved custom combo from ${plan.preset}: ${selected}`, formatPackCheckboxes(plan.packs), customPacksPath(agentDir), ""].join(
		"\n",
	);
}
