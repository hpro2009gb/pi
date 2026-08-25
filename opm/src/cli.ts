#!/usr/bin/env node
import { resolveLaunchPlan } from "./presets.ts";
import { spawnPi } from "./spawn-pi.ts";

const plan = resolveLaunchPlan(process.argv.slice(2));
const result = spawnPi(plan);
if (result.error) {
	process.stderr.write(`${result.error.message}\n`);
	process.exit(1);
}
process.exit(result.status ?? 1);
