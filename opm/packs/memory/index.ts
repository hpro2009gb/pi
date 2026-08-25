import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	findMemoryFile,
	hasSkillDescription,
	initMemoryFile,
	memoryEnabled,
	readMemory,
} from "./files.ts";

export default function memoryPack(pi: ExtensionAPI): void {
	if (!memoryEnabled()) {
		return;
	}

	pi.on("resources_discover", (event) => {
		const path = findMemoryFile(event.cwd);
		const content = path ? readMemory(path) : undefined;
		if (path && content && hasSkillDescription(content)) {
			return { skillPaths: [path] };
		}
	});

	pi.on("before_agent_start", (event, ctx) => {
		const path = findMemoryFile(ctx.cwd);
		const content = path ? readMemory(path) : undefined;
		if (!path || !content || hasSkillDescription(content)) {
			return;
		}
		return {
			systemPrompt: `${event.systemPrompt}\n\n# ${basename(path)}\n\n${content}`,
		};
	});

	pi.registerCommand("memory", {
		description: "Show MEMORY.md, or `init` to create a template in the current directory",
		handler: async (args, ctx) => {
			const sub = args.trim();
			if (sub === "init") {
				const result = initMemoryFile(ctx.cwd);
				ctx.ui.notify(
					result.created ? `Created ${result.path}` : `Already exists: ${result.path}`,
					"info",
				);
				return;
			}
			const path = findMemoryFile(ctx.cwd);
			if (!path) {
				ctx.ui.notify("No MEMORY.md (walked up to git root). Run `/memory init`.", "warning");
				return;
			}
			const body = readMemory(path) ?? "";
			const preview = body.length > 800 ? `${body.slice(0, 800)}\n…` : body;
			pi.sendMessage({
				customType: "opm-memory",
				content: `${path}\n\n${preview}`,
				display: true,
			});
		},
	});
}
