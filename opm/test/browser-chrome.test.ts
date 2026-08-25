import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
	buildChromeDumpArgs,
	buildChromeScreenshotArgs,
	defaultChromeExec,
	isAllowedBrowserUrl,
	isDebugLauncherWrapper,
	parseBrowserAction,
	resolveChromeBin,
	runBrowserAction,
} from "../packs/browser/chrome.ts";

describe("parseBrowserAction", () => {
	it("accepts snapshot and screenshot", () => {
		expect(parseBrowserAction("snapshot")).toBe("snapshot");
		expect(parseBrowserAction("screenshot")).toBe("screenshot");
	});

	it("rejects desktop computer actions", () => {
		expect(() => parseBrowserAction("computer")).toThrow(/Unknown browser action/);
	});
});

describe("isAllowedBrowserUrl", () => {
	it("allows http, https, and file", () => {
		expect(isAllowedBrowserUrl("https://example.com/ui")).toBe(true);
		expect(isAllowedBrowserUrl("http://127.0.0.1:3000")).toBe(true);
		expect(isAllowedBrowserUrl("file:///tmp/page.html")).toBe(true);
	});

	it("denies javascript and missing scheme", () => {
		expect(isAllowedBrowserUrl("javascript:alert(1)")).toBe(false);
		expect(isAllowedBrowserUrl("not a url")).toBe(false);
	});
});

describe("chrome args", () => {
	it("builds dump-dom args for snapshot", () => {
		const args = buildChromeDumpArgs("https://example.com");
		expect(args).toContain("--headless=new");
		expect(args).toContain("--dump-dom");
		expect(args.at(-1)).toBe("https://example.com");
	});

	it("builds screenshot args", () => {
		const args = buildChromeScreenshotArgs("https://example.com", "/tmp/ui.png");
		expect(args.some((a) => a.startsWith("--screenshot="))).toBe(true);
		expect(args.at(-1)).toBe("https://example.com");
	});
});

describe("runBrowserAction", () => {
	it("returns a clear error when chrome is missing", async () => {
		const result = await runBrowserAction(
			{ action: "snapshot", url: "https://example.com" },
			{
				resolveBin: () => undefined,
				exec: async () => ({ code: 0, stdout: "", stderr: "" }),
			},
		);
		expect(result.ok).toBe(false);
		expect(result.text).toMatch(/OPM_CHROME_BIN|chromium|chrome/i);
		expect(result.text).not.toMatch(/computer/i);
	});

	it("snapshots via dump-dom when chrome is present", async () => {
		const result = await runBrowserAction(
			{ action: "snapshot", url: "https://example.com" },
			{
				resolveBin: () => "/usr/bin/chromium",
				exec: async (bin, args) => {
					expect(bin).toBe("/usr/bin/chromium");
					expect(args).toContain("--dump-dom");
					return { code: 0, stdout: "<html>ok</html>", stderr: "" };
				},
			},
		);
		expect(result.ok).toBe(true);
		expect(result.text).toContain("<html>ok</html>");
	});

	it("rejects javascript urls without spawning chrome", async () => {
		let spawned = false;
		const result = await runBrowserAction(
			{ action: "snapshot", url: "javascript:alert(1)" },
			{
				resolveBin: () => "/usr/bin/chromium",
				exec: async () => {
					spawned = true;
					return { code: 0, stdout: "", stderr: "" };
				},
			},
		);
		expect(spawned).toBe(false);
		expect(result.ok).toBe(false);
		expect(result.text).toMatch(/http, https, or file/);
	});

	it("screenshots via --screenshot=", async () => {
		let seen: string[] = [];
		const result = await runBrowserAction(
			{ action: "screenshot", url: "https://example.com", path: "/tmp/opm-ui.png" },
			{
				resolveBin: () => "/usr/bin/chromium",
				exec: async (_bin, args) => {
					seen = args;
					return { code: 0, stdout: "", stderr: "" };
				},
			},
		);
		expect(result.ok).toBe(true);
		expect(seen.some((arg) => arg === "--screenshot=/tmp/opm-ui.png")).toBe(true);
		expect(result.text).toContain("/tmp/opm-ui.png");
	});
});

describe("resolveChromeBin", () => {
	it("honors OPM_CHROME_BIN when the file exists", () => {
		const bin = resolveChromeBin({ OPM_CHROME_BIN: "/workspace/pi-test.sh", PATH: "" });
		expect(bin).toBe("/workspace/pi-test.sh");
	});

	it("returns undefined when nothing is on PATH", () => {
		expect(resolveChromeBin({ PATH: "/tmp/opm-no-chrome" })).toBeUndefined();
	});

	it("prefers google-chrome-stable over an earlier PATH google-chrome", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-chrome-path-"));
		const early = join(root, "early");
		const late = join(root, "late");
		mkdirSync(early);
		mkdirSync(late);
		writeFileSync(join(early, "google-chrome"), "#!/bin/sh\n");
		writeFileSync(join(late, "google-chrome-stable"), "#!/bin/sh\n");
		expect(resolveChromeBin({ PATH: `${early}:${late}` })).toBe(join(late, "google-chrome-stable"));
		rmSync(root, { recursive: true, force: true });
	});

	it("skips remote-debugging launcher wrappers", () => {
		const root = mkdtempSync(join(tmpdir(), "opm-chrome-wrap-"));
		writeFileSync(
			join(root, "google-chrome-stable"),
			"#!/bin/bash\nexec /usr/bin/google-chrome-stable --remote-debugging-port=9222 \"$@\"\n",
		);
		writeFileSync(join(root, "chromium"), "#!/bin/sh\n");
		expect(isDebugLauncherWrapper(join(root, "google-chrome-stable"))).toBe(true);
		expect(resolveChromeBin({ PATH: root })).toBe(join(root, "chromium"));
		rmSync(root, { recursive: true, force: true });
	});
});

describe("defaultChromeExec", () => {
	it("kills a hung binary at the timeout", async () => {
		const start = Date.now();
		const result = await defaultChromeExec("/bin/sleep", ["30"], 200);
		expect(result.code).not.toBe(0);
		expect(Date.now() - start).toBeLessThan(5000);
		expect(result.stderr).toMatch(/timed out/i);
	});
});

describe("live chrome", () => {
	it.skipIf(!resolveChromeBin())("dump-dom of a local file URL", async () => {
		const dir = mkdtempSync(join(tmpdir(), "opm-chrome-"));
		const htmlPath = join(dir, "page.html");
		writeFileSync(htmlPath, "<html><body>opm-live-marker</body></html>");
		try {
			const result = await runBrowserAction({
				action: "snapshot",
				url: pathToFileURL(htmlPath).href,
			});
			expect(result.ok).toBe(true);
			expect(result.text).toContain("opm-live-marker");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
