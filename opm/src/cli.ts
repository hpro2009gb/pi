#!/usr/bin/env node
import { initOpm } from "./init.ts";
import { resolveLaunchPlan } from "./presets.ts";
import { spawnPi } from "./spawn-pi.ts";

const argv = process.argv.slice(2);
if (argv[0] === "init") {
	const result = initOpm();
	process.stdout.write(`OPM agent dir: ${result.agentDir}\n`);
	process.stdout.write(`settings: ${result.settingsPath}\n`);
	process.stdout.write(`auth: ${result.authLinked ? result.authPath : "(no ~/.pi/agent/auth.json found)"}\n`);
	process.exit(0);
}

const plan = resolveLaunchPlan(argv);
const result = spawnPi(plan);
if (result.error) {
	process.stderr.write(`${result.error.message}\n`);
	process.exit(1);
}
process.exit(result.status ?? 1);
