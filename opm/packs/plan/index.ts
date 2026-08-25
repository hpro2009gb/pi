import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const DESTRUCTIVE_PATTERNS = [
	/\brm\b/i,
	/\brmdir\b/i,
	/\bmv\b/i,
	/\bcp\b/i,
	/\bmkdir\b/i,
	/\btouch\b/i,
	/\bchmod\b/i,
	/\bchown\b/i,
	/\bchgrp\b/i,
	/\bln\b/i,
	/\btee\b/i,
	/\btruncate\b/i,
	/\bdd\b/i,
	/\bshred\b/i,
	/(^|[^<])>(?!>)/,
	/>>/,
	/\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
	/\byarn\s+(add|remove|install|publish)/i,
	/\bpnpm\s+(add|remove|install|publish)/i,
	/\bpip\s+(install|uninstall)/i,
	/\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
	/\bbrew\s+(install|uninstall|upgrade)/i,
	/\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)/i,
	/\bsudo\b/i,
	/\bsu\b/i,
	/\bkill\b/i,
	/\bpkill\b/i,
	/\bkillall\b/i,
	/\breboot\b/i,
	/\bshutdown\b/i,
	/\bsystemctl\s+(start|stop|restart|enable|disable)/i,
	/\bservice\s+\S+\s+(start|stop|restart)/i,
	/\b(vim?|nano|emacs|code|subl)\b/i,
];

const SAFE_PATTERNS = [
	/^\s*cat\b/,
	/^\s*head\b/,
	/^\s*tail\b/,
	/^\s*less\b/,
	/^\s*more\b/,
	/^\s*grep\b/,
	/^\s*find\b/,
	/^\s*ls\b/,
	/^\s*pwd\b/,
	/^\s*echo\b/,
	/^\s*printf\b/,
	/^\s*wc\b/,
	/^\s*sort\b/,
	/^\s*uniq\b/,
	/^\s*diff\b/,
	/^\s*file\b/,
	/^\s*stat\b/,
	/^\s*du\b/,
	/^\s*df\b/,
	/^\s*tree\b/,
	/^\s*which\b/,
	/^\s*whereis\b/,
	/^\s*type\b/,
	/^\s*env\b/,
	/^\s*printenv\b/,
	/^\s*uname\b/,
	/^\s*whoami\b/,
	/^\s*id\b/,
	/^\s*date\b/,
	/^\s*cal\b/,
	/^\s*uptime\b/,
	/^\s*ps\b/,
	/^\s*top\b/,
	/^\s*htop\b/,
	/^\s*free\b/,
	/^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get)/i,
	/^\s*git\s+ls-/i,
	/^\s*npm\s+(list|ls|view|info|search|outdated|audit)/i,
	/^\s*yarn\s+(list|info|why|audit)/i,
	/^\s*node\s+--version/i,
	/^\s*python\s+--version/i,
	/^\s*curl\s/i,
	/^\s*wget\s+-O\s*-/i,
	/^\s*jq\b/,
	/^\s*sed\s+-n/i,
	/^\s*awk\b/,
	/^\s*rg\b/,
	/^\s*fd\b/,
	/^\s*bat\b/,
	/^\s*eza\b/,
];

const PLAN_MODE_DISABLED_TOOLS = new Set(["edit", "write"]);

export function isPlanSafeBash(command: string): boolean {
	const isDestructive = DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(command));
	const isSafe = SAFE_PATTERNS.some((pattern) => pattern.test(command));
	return !isDestructive && isSafe;
}

type PlanModeState = {
	enabled: boolean;
	toolsBeforePlanMode?: string[];
};

export default function planPack(pi: ExtensionAPI): void {
	let planModeEnabled = false;
	let toolsBeforePlanMode: string[] | undefined;

	pi.registerFlag("plan", {
		description: "Start in plan mode (read-only exploration)",
		type: "boolean",
		default: false,
	});

	function uniqueToolNames(toolNames: string[]): string[] {
		return [...new Set(toolNames)];
	}

	function getPlanModeTools(activeToolNames: string[]): string[] {
		return uniqueToolNames(activeToolNames.filter((name) => !PLAN_MODE_DISABLED_TOOLS.has(name)));
	}

	function enablePlanModeTools(): void {
		if (toolsBeforePlanMode === undefined) {
			toolsBeforePlanMode = pi.getActiveTools();
		}
		pi.setActiveTools(getPlanModeTools(toolsBeforePlanMode));
	}

	function restoreNormalModeTools(): void {
		if (toolsBeforePlanMode) {
			pi.setActiveTools(toolsBeforePlanMode);
		}
		toolsBeforePlanMode = undefined;
	}

	function persistState(): void {
		const state: PlanModeState = {
			enabled: planModeEnabled,
			toolsBeforePlanMode,
		};
		pi.appendEntry("opm-plan", state);
	}

	function updateStatus(ctx: ExtensionContext): void {
		if (planModeEnabled) {
			ctx.ui.setStatus("opm-plan", ctx.ui.theme.fg("warning", "plan"));
		} else {
			ctx.ui.setStatus("opm-plan", undefined);
		}
	}

	function setPlanMode(ctx: ExtensionContext, enabled: boolean): void {
		planModeEnabled = enabled;
		if (planModeEnabled) {
			enablePlanModeTools();
			ctx.ui.notify("Plan mode enabled. Writes stay disabled until you accept.");
		} else {
			restoreNormalModeTools();
			ctx.ui.notify("Plan mode disabled. Writes enabled.");
		}
		updateStatus(ctx);
		persistState();
	}

	pi.registerCommand("plan", {
		description: "Toggle plan mode (read-only until accept)",
		handler: async (_args, ctx) => {
			setPlanMode(ctx, !planModeEnabled);
		},
	});

	pi.on("tool_call", async (event) => {
		if (!planModeEnabled) {
			return;
		}
		if (PLAN_MODE_DISABLED_TOOLS.has(event.toolName)) {
			return {
				block: true,
				reason: "Plan mode: edit/write are disabled until you accept the plan.",
			};
		}
		if (event.toolName !== "bash") {
			return;
		}
		const command = "command" in event.input && typeof event.input.command === "string" ? event.input.command : "";
		if (!isPlanSafeBash(command)) {
			return {
				block: true,
				reason: `Plan mode: command blocked (not allowlisted).\nCommand: ${command}`,
			};
		}
	});

	pi.on("before_agent_start", async () => {
		if (!planModeEnabled) {
			return;
		}
		return {
			message: {
				customType: "opm-plan-context",
				content: `[PLAN MODE ACTIVE]
You are in plan mode: read-only exploration.

Restrictions:
- edit and write are disabled
- bash is restricted to an allowlisted set of read-only commands
- Use the ask tool for clarifying questions

Write a numbered plan under a "Plan:" header.
Do not make changes until the user accepts the plan.`,
				display: false,
			},
		};
	});

	pi.on("agent_end", async (event, ctx) => {
		if (!planModeEnabled || !ctx.hasUI) {
			return;
		}
		const lastAssistant = [...event.messages].reverse().find((message) => message.role === "assistant");
		const text =
			lastAssistant && Array.isArray(lastAssistant.content)
				? lastAssistant.content
						.filter((block) => block.type === "text")
						.map((block) => (block.type === "text" ? block.text : ""))
						.join("\n")
				: "";
		if (!/\*{0,2}Plan:\*{0,2}/i.test(text)) {
			return;
		}
		const accepted = await ctx.ui.confirm("Accept plan and enable writes?", "Cancel keeps plan mode on.");
		if (!accepted) {
			ctx.ui.notify("Staying in plan mode.");
			return;
		}
		setPlanMode(ctx, false);
		pi.sendUserMessage("Execute the accepted plan.");
	});

	pi.on("session_start", async (_event, ctx) => {
		if (pi.getFlag("plan") === true) {
			planModeEnabled = true;
		}
		const entries = ctx.sessionManager.getEntries();
		const planEntry = entries
			.filter((entry: { type: string; customType?: string }) => entry.type === "custom" && entry.customType === "opm-plan")
			.pop() as { data?: PlanModeState } | undefined;
		if (planEntry?.data) {
			planModeEnabled = planEntry.data.enabled ?? planModeEnabled;
			toolsBeforePlanMode = planEntry.data.toolsBeforePlanMode ?? toolsBeforePlanMode;
		}
		if (planModeEnabled) {
			enablePlanModeTools();
		}
		updateStatus(ctx);
	});
}
