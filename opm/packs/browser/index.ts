import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { parseBrowserAction, runBrowserAction } from "./chrome.ts";

const browserParams = Type.Object({
	action: Type.Union([Type.Literal("snapshot"), Type.Literal("screenshot")]),
	url: Type.String({ description: "http, https, or file URL to capture" }),
	path: Type.Optional(Type.String({ description: "Screenshot output path (screenshot action)" })),
});

export default function browserPack(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "browser",
		label: "browser",
		description:
			"UI evidence via headless Chrome/Chromium: snapshot (DOM dump) or screenshot. Not desktop computer control. Needs chrome on PATH or OPM_CHROME_BIN.",
		parameters: browserParams,
		executionMode: "sequential",
		async execute(_id, params, _signal, _onUpdate, ctx) {
			let action: "snapshot" | "screenshot";
			try {
				action = parseBrowserAction(params.action);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return { content: [{ type: "text" as const, text: message }] };
			}
			const result = await runBrowserAction({
				action,
				url: params.url,
				path: params.path,
				cwd: ctx.cwd,
			});
			return { content: [{ type: "text" as const, text: result.text }] };
		},
	});
}