import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commandOnPath, resolvePiBin } from "../src/spawn-pi.ts";

describe("resolvePiBin", () => {
	it("honors OPM_PI_BIN first", () => {
		expect(resolvePiBin({ OPM_PI_BIN: "/custom/pi" }, import.meta.url)).toBe("/custom/pi");
	});

	it("uses repo pi-test.sh when OPM_PI_FROM_SOURCE=1", () => {
		const bin = resolvePiBin({ OPM_PI_FROM_SOURCE: "1" }, import.meta.url);
		expect(bin.replaceAll("\\", "/")).toMatch(/\/pi-test\.sh$/);
	});

	it("falls back to repo pi-test.sh when pi is not on PATH", () => {
		const bin = resolvePiBin({ PATH: "/tmp/opm-empty-path" }, import.meta.url);
		expect(bin.replaceAll("\\", "/")).toMatch(/\/pi-test\.sh$/);
	});
});

describe("commandOnPath", () => {
	it("finds a real directory entry", () => {
		expect(commandOnPath("true", "/usr/bin:/bin")).toBe(true);
	});

	it("does not find a missing command", () => {
		expect(commandOnPath("opm-definitely-missing-bin", "/tmp")).toBe(false);
	});
});
