import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";

const script = join(dirname(fileURLToPath(import.meta.url)), "check-github-share.mjs");

test("blocks git push without PI_ALLOW_GITHUB_SHARE", () => {
	const result = spawnSync(process.execPath, [script], {
		encoding: "utf8",
		env: { ...process.env, PI_ALLOW_GITHUB_SHARE: "" },
	});
	assert.equal(result.status, 1);
	assert.match(result.stderr, /git push blocked/);
});

test("allows git push when PI_ALLOW_GITHUB_SHARE=1", () => {
	const result = spawnSync(process.execPath, [script], {
		encoding: "utf8",
		env: { ...process.env, PI_ALLOW_GITHUB_SHARE: "1" },
	});
	assert.equal(result.status, 0);
});
