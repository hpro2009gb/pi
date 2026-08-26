#!/usr/bin/env node
import { attachOpmToHost, formatAttachResult } from "./attach-pi.ts";
import { formatChooser } from "./catalog.ts";
import { loadCustomPacks, resolveCustomizeDir, runCustomize } from "./customize.ts";
import { initOpm } from "./init.ts";
import {
	formatInstallCliResult,
	installApp,
	installCli,
	parseInstallCliArgs,
	resolveInstallWrapperName,
} from "./install-cli.ts";
import { defaultPackOutDir, formatPackResult, packOpm, parsePackArgs } from "./pack.ts";
import { opmRoot } from "./pack-registry.ts";
import { resolveLaunchPlan } from "./presets.ts";
import { formatDryRun, formatLaunchBanner, peelOpmCliFlags, resolvePiBin, spawnPi } from "./spawn-pi.ts";

const argv = process.argv.slice(2);
if (argv[0] === "choose" || argv[0] === "--choose") {
	process.stdout.write(formatChooser());
	process.exit(0);
}
if (argv[0] === "init") {
	const result = initOpm();
	process.stdout.write(`OPM agent dir: ${result.agentDir}\n`);
	process.stdout.write(`settings: ${result.settingsPath}\n`);
	process.stdout.write(`auth: ${result.authLinked ? result.authPath : "(no host login; ~/.omp and ~/.pi auth.json empty or missing)"}\n`);
	if (result.hostAuthPath) {
		process.stdout.write(`host-auth: ${result.hostAuthPath}\n`);
	}
	process.exit(0);
}
if (argv[0] === "pack") {
	try {
		const flags = parsePackArgs(argv.slice(1));
		const outDir = flags.outDir ?? defaultPackOutDir();
		const result = packOpm({
			sourceRoot: opmRoot(),
			outDir,
			tarball: flags.tarball,
		});
		process.stdout.write(formatPackResult(result));
		process.exit(0);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`${message}\n`);
		process.exit(1);
	}
}
if (argv[0] === "install-app" || argv[0] === "install-super-pi") {
	try {
		const flags = parseInstallCliArgs(argv.slice(1));
		const result = installApp({
			...flags,
			wrapperName: resolveInstallWrapperName(argv[0], flags),
		});
		process.stdout.write(formatInstallCliResult(result));
		process.exit(0);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`${message}\n`);
		process.exit(1);
	}
}
if (argv[0] === "install-cli" || argv[0] === "install-parallel") {
	try {
		const flags = parseInstallCliArgs(argv.slice(1));
		const result = installCli({
			...flags,
			wrapperName: resolveInstallWrapperName(argv[0], flags),
		});
		process.stdout.write(formatInstallCliResult(result));
		process.exit(0);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`${message}\n`);
		process.exit(1);
	}
}
if (argv[0] === "attach" || argv[0] === "attach-pi" || argv[0] === "install-to-pi") {
	const result = attachOpmToHost({ args: argv.slice(1) });
	process.stdout.write(formatAttachResult(result));
	if (result.error) {
		process.stderr.write(`${result.error.message}\n`);
		process.exit(1);
	}
	process.exit(result.status ?? 1);
}
if (argv[0] === "customize") {
	try {
		process.stdout.write(runCustomize(argv.slice(1)));
		process.exit(0);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`${message}\n`);
		process.exit(1);
	}
}

try {
	const peeled = peelOpmCliFlags(argv);
	const plan = resolveLaunchPlan(peeled.rest, {
		savedCustomPacks: loadCustomPacks(resolveCustomizeDir()),
	});
	if (process.env.OPM_QUIET !== "1") {
		process.stderr.write(formatLaunchBanner(plan));
	}
	if (peeled.dryRun) {
		const piBin = resolvePiBin(process.env, import.meta.url);
		process.stdout.write(formatDryRun(plan, piBin));
		process.exit(0);
	}
	const result = spawnPi(plan);
	if (result.error) {
		process.stderr.write(`${result.error.message}\n`);
		process.exit(1);
	}
	process.exit(result.status ?? 1);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`${message}\n`);
	process.exit(1);
}
