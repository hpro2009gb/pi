import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { opmRoot } from "./pack-registry.ts";
import { findRepoRoot } from "./spawn-pi.ts";

export type PackArgs = {
	outDir?: string;
	tarball: boolean;
};

export type OpmPackMeta = {
	kind: "opm-pack";
	name: string;
	piTestSh?: string;
};

export type PackOpmOptions = {
	sourceRoot?: string;
	outDir: string;
	tarball?: boolean;
	repoRoot?: string;
};

export type PackOpmResult = {
	packDir: string;
	tarballPath?: string;
	piTestSh?: string;
};

export function parsePackArgs(argv: string[]): PackArgs {
	let outDir: string | undefined;
	let tarball = true;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--no-tarball") {
			tarball = false;
			continue;
		}
		if (arg === "--tarball") {
			tarball = true;
			continue;
		}
		if (arg === "--out" || arg === "-o") {
			const next = argv[i + 1];
			if (!next || next.startsWith("-")) {
				throw new Error(`${arg} needs a value`);
			}
			outDir = next;
			i += 1;
			continue;
		}
		throw new Error(`Unknown pack flag: ${arg}`);
	}
	return { outDir, tarball };
}

export function readPackMeta(packDir: string): OpmPackMeta | undefined {
	const path = join(packDir, "pack.json");
	if (!existsSync(path)) {
		return undefined;
	}
	try {
		const data: unknown = JSON.parse(readFileSync(path, "utf8"));
		if (!data || typeof data !== "object" || Array.isArray(data)) {
			return undefined;
		}
		const record = data as Record<string, unknown>;
		if (record.kind !== "opm-pack") {
			return undefined;
		}
		const name = typeof record.name === "string" ? record.name : "super-pi";
		const piTestSh = typeof record.piTestSh === "string" ? record.piTestSh : undefined;
		return { kind: "opm-pack", name, piTestSh };
	} catch {
		return undefined;
	}
}

function resolvePiTestSh(sourceRoot: string, repoRoot?: string): string | undefined {
	if (repoRoot) {
		const pinned = join(repoRoot, "pi-test.sh");
		if (existsSync(pinned)) {
			return pinned;
		}
	}
	try {
		return join(findRepoRoot(sourceRoot), "pi-test.sh");
	} catch {
		const existing = readPackMeta(sourceRoot);
		if (existing?.piTestSh && existing.piTestSh.length > 0) {
			return existing.piTestSh;
		}
		return undefined;
	}
}

export function formatPackInstallScript(): string {
	return `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
exec node "\$ROOT/src/cli.ts" install-app --from-pack "\$ROOT" "\$@"
`;
}

export function formatPackLauncher(): string {
	return `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
exec node "\$ROOT/src/cli.ts" "\$@"
`;
}

export function packOpm(options: PackOpmOptions): PackOpmResult {
	const sourceRoot = resolve(options.sourceRoot ?? opmRoot());
	const outDir = resolve(options.outDir);
	if (outDir === sourceRoot) {
		throw new Error("pack out dir must not be the OPM source tree");
	}
	if (existsSync(outDir)) {
		rmSync(outDir, { recursive: true, force: true });
	}
	mkdirSync(outDir, { recursive: true });
	cpSync(join(sourceRoot, "src"), join(outDir, "src"), { recursive: true });
	cpSync(join(sourceRoot, "packs"), join(outDir, "packs"), { recursive: true });
	copyFileSync(join(sourceRoot, "package.json"), join(outDir, "package.json"));
	const piTestSh = resolvePiTestSh(sourceRoot, options.repoRoot);
	const meta: OpmPackMeta = { kind: "opm-pack", name: "super-pi" };
	if (piTestSh) {
		meta.piTestSh = piTestSh;
	}
	writeFileSync(join(outDir, "pack.json"), `${JSON.stringify(meta, null, 2)}\n`);
	writeFileSync(join(outDir, "install.sh"), formatPackInstallScript(), { encoding: "utf8", mode: 0o755 });
	chmodSync(join(outDir, "install.sh"), 0o755);
	writeFileSync(join(outDir, "opm.sh"), formatPackLauncher(), { encoding: "utf8", mode: 0o755 });
	chmodSync(join(outDir, "opm.sh"), 0o755);
	let tarballPath: string | undefined;
	if (options.tarball !== false) {
		tarballPath = `${outDir}.tgz`;
		const tar = spawnSync("tar", ["-czf", tarballPath, "-C", dirname(outDir), basename(outDir)], {
			encoding: "utf8",
		});
		if (tar.status !== 0) {
			throw new Error(`tar failed: ${tar.stderr || tar.stdout || tar.status}`);
		}
	}
	return { packDir: outDir, tarballPath, piTestSh };
}

export function formatPackResult(result: PackOpmResult): string {
	const lines = [`pack: ${result.packDir}`];
	if (result.tarballPath) {
		lines.push(`tarball: ${result.tarballPath}`);
	}
	if (result.piTestSh) {
		lines.push(`engine: ${result.piTestSh}`);
	}
	lines.push(`Install: bash ${result.packDir}/install.sh`);
	lines.push("Or from this clone: ./opm.sh install-app");
	lines.push("Does not npm publish. Does not overwrite pi/omp.");
	return `${lines.join("\n")}\n`;
}

export function defaultPackOutDir(sourceRoot: string = opmRoot()): string {
	try {
		return join(findRepoRoot(sourceRoot), "dist", "super-pi");
	} catch {
		throw new Error("pack needs --out DIR when not run from a pi clone");
	}
}
