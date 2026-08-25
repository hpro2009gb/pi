import { AGENT_PROFILES, PRESET_PACKS, type AgentProfileId, type PackId, type PresetName } from "./pack-registry.ts";

export type ProductBlurb = {
	what: string;
	special: string;
	learnedFrom: string;
};

export type PresetCatalogEntry = {
	chooseWhen: string;
	packs: PackId[];
	what: string;
	special: string;
	learnedFrom: string;
	available: boolean;
};

export type PackCatalogEntry = {
	what: string;
	special: string;
	learnedFrom: string;
	available: boolean;
};

export type AgentProfileCatalogEntry = {
	mimics: string;
	chooseWhen: string;
	closest: string;
	missing: string;
	learnedFrom: string;
	samePacksAs?: AgentProfileId | PresetName;
	startInPlan: boolean;
};

export const OPM_PRODUCT: ProductBlurb = {
	what: "Wrapper CLI quanh Pi: engine vẫn là Pi (agent loop, TUI, session, `read`/`bash`/`edit`/`write`). Từng năng lực thêm là một pack (extension Pi). Preset bật/tắt pack, không sửa `packages/coding-agent`.",
	special:
		"Không fork `agent-loop` như Oh My Pi (`omp`). Pack tháo được (`--preset pi` = Pi gốc). Mặc định `opm-verify`: evidence, diff nhỏ, không commit hộ. Sandbox là policy (mặc định off); OS VM chưa gắn.",
	learnedFrom:
		"Nền: triết lý Pi (nhẹ, 4 tool, không nhét plan/MCP/todo vào core). Học chọn lọc: omp (hashline, LSP), Claude Code (hỏi có cấu trúc, plan mode), Cline (plan rồi mới act), Codex (sandbox policy). Không lấy 31 tool, `computer` desktop, MCP-in-core, auto-commit, auto `learn`.",
};

export const PRESET_CATALOG: Record<PresetName, PresetCatalogEntry> = {
	pi: {
		chooseWhen: "Muốn đúng Pi gốc, hoặc đang debug pack",
		packs: PRESET_PACKS.pi,
		what: "Không load pack. Model chỉ thấy `read`, `bash`, `edit`, `write` (edit `oldText` của Pi).",
		special: "Baseline. Dùng để so sánh: mọi thứ khác là pack, không phải core.",
		learnedFrom: "Pi — harness nhỏ, user-permission, không permission-popup hay plan mode trong core.",
		available: true,
	},
	"opm-verify": {
		chooseWhen: "Làm việc hằng ngày (mặc định)",
		packs: PRESET_PACKS["opm-verify"],
		what: "verify + hashline + ask + lsp trên nền 4 tool Pi.",
		special:
			"Chặn `git commit`/`push`/`reset --hard` trừ khi user hỏi; edit theo hash dòng; hỏi select/confirm; LSP TS/JS nếu có server.",
		learnedFrom: "Kỷ luật OPM (evidence, không commit lén) + omp (hashline/LSP) + Claude Code / Pi `question.ts` (ask).",
		available: true,
	},
	"opm-plan": {
		chooseWhen: "Cần thiết kế trước, chưa cho agent sửa file",
		packs: PRESET_PACKS["opm-plan"],
		what: "Toàn bộ `opm-verify` cộng pack plan (`/plan`).",
		special:
			"edit/write tắt; bash allowlist; confirm “Accept plan and enable writes?”. Cancel giữ plan mode. Không tự execute.",
		learnedFrom: "Claude Code plan, Cline plan-then-act, Pi `examples/extensions/plan-mode`. Khác example Pi: không auto-run.",
		available: true,
	},
	"opm-full": {
		chooseWhen: "Muốn đủ pack: sandbox + task + browser + ttsr + memory",
		packs: PRESET_PACKS["opm-full"],
		what: "`opm-plan` cộng sandbox + task + browser + ttsr + memory.",
		special:
			"Sandbox mặc định off trừ khi `--sandbox workspace|container`. Browser: snapshot/screenshot Chrome headless, không `computer` desktop. TTSR abort+followUp; MEMORY.md user-reviewed.",
		learnedFrom:
			"Codex + Pi sandbox; Pi subagent / omp `task`; browser evidence; TTSR-lite; project memory. Không lấy `computer` desktop của omp.",
		available: true,
	},
	"pi-super": {
		chooseWhen: "Daily driver nghiên cứu của OPM: đủ kit v1, không khóa plan lúc start",
		packs: PRESET_PACKS["pi-super"],
		what: "Pi + verify + hashline + ask + plan + lsp + sandbox + task + browser + ttsr + memory. Combo này không clone một agent: Claude không có hashline; Cline không hashline/lsp; omp auto-commit; Codex không plan/ask.",
		special:
			"Không inject `--plan`. Sandbox mặc định off. Dùng `/plan` khi cần. Browser chỉ snapshot/screenshot. TTSR mặc định on (tắt: `--without ttsr` hoặc `OPM_TTSR=0`). MEMORY.md user-reviewed (`OPM_MEMORY=0` để tắt). Có thể mạnh hơn clone vì ghép vài vũ khí mà từng agent kia không có cùng lúc, vẫn giữ Pi core.",
		learnedFrom:
			"Tổng hợp có chủ đích: Pi 4-tool + OPM verify + omp hashline/lsp + Claude ask/plan + Cline plan-then-act (opt-in) + Codex sandbox policy + UI evidence + TTSR-lite + MEMORY.md. Bỏ auto-commit, 31 tool, `computer`, MCP-in-core, auto `learn`.",
		available: true,
	},
	custom: {
		chooseWhen: "Tự tích chọn vũ khí (pack) — không theo gợi ý có sẵn",
		packs: PRESET_PACKS.custom,
		what: "Danh sách pack user chọn. Trống đến khi `--with` hoặc file `~/.opm/agent/custom-packs.json`.",
		special:
			"`opm customize --from claude-code --with hashline --without lsp` lưu combo. Chạy: `opm --profile custom`.",
		learnedFrom: "User tùy biến. Profile agent chỉ là gợi ý để hiểu Pi + packs ≈ agent thật, rồi tự chỉnh.",
		available: true,
	},
};

export const PACK_CATALOG: Record<PackId, PackCatalogEntry> = {
	verify: {
		what: "Prompt evidence (diff nhỏ, bug cần repro, UI cần check UI) và chặn git write nếu user không hỏi.",
		special: "Không auto-commit như omp. Nhận cả câu tiếng Việt kiểu “hay commit giup minh”.",
		learnedFrom: "Triết lý OPM (user): evidence trước, không commit hộ. Đối lập omp commit-by-default.",
		available: true,
	},
	hashline: {
		what: "`read` text có `<!-- hashline -->` và prefix `HHHHHHHH|`; `edit` thay dòng theo hash SHA-256 8 hex.",
		special: "Hash stale / occurrence sai → fail, không ghi file dở. Tắt bằng `OPM_HASHLINE=0`. Không đổi binary/ảnh.",
		learnedFrom: "omp (Oh My Pi) hashline. Gắn bằng `registerTool({ name: \"edit\" })` của Pi, không nhét vào core.",
		available: true,
	},
	ask: {
		what: "Tool `ask`: `select` nếu ≥2 options, yes/no → confirm, còn lại → input. `executionMode: sequential`.",
		special: "Không có todo tool. Non-TUI trả lỗi, không giả câu trả lời.",
		learnedFrom: "Claude Code AskUserQuestion + Pi `examples/extensions/question.ts` (schema đơn giản hơn example).",
		available: true,
	},
	plan: {
		what: "`/plan` (và `--plan`): lọc tool + chặn bash không allowlist; sau Plan: thì confirm mới bật write.",
		special: "Không auto-execute. Cancel = vẫn plan mode. Gửi “Execute the accepted plan.” chỉ khi accept.",
		learnedFrom: "Claude Code plan mode, Cline plan/act, Pi `plan-mode` example.",
		available: true,
	},
	lsp: {
		what: "Tool `lsp` (diagnostics/definition/references/hover) và ghi chú diagnostics sau `edit`/`write` TS/JS.",
		special: "Chỉ TS/JS qua `typescript-language-server`. Thiếu binary: báo lỗi, không crash Pi. Lang khác: `unsupported in v1`.",
		learnedFrom: "omp LSP + hook `tool_result` của Pi. Không port 80k Rust language stack của omp.",
		available: true,
	},
	sandbox: {
		what: "Policy path/net cho bash/edit/write; profile off / workspace / container.",
		special:
			"Default `off`. workspace: ghi trong cwd/tmp, chặn ~/.ssh ~/.aws ~/.gnupg, mạng vẫn được. container: thêm chặn curl/wget/ssh (policy, chưa phải VM/bubblewrap).",
		learnedFrom: "Codex workspace sandbox + Pi `examples/extensions/sandbox` / gondolin (VM để sau).",
		available: true,
	},
	task: {
		what: "Tool `task`: subagent isolated (spawn Pi `--mode json -p`). scout = read+bash; worker = đủ tool + pack verify.",
		special:
			"Fan-out: `tasks[]` song song (max 8, concurrency 4). `chain[]` tuần tự, `{previous}` = stdout bước trước. Worker không auto-commit. Scout không edit/write.",
		learnedFrom: "Pi `examples/extensions/subagent` (single/parallel/chain) + omp `task`. Không nhét subagent vào core Pi.",
		available: true,
	},
	browser: {
		what: "UI evidence: snapshot (Chrome `--dump-dom`) hoặc screenshot (`--screenshot=`).",
		special:
			"Cần chrome/chromium trên PATH hoặc `OPM_CHROME_BIN`. Tắt mặc định trong `opm-verify` (`--with browser`). Không có tool `computer` (desktop OS).",
		learnedFrom: "Các agent UI-verify (omp browser/computer — chỉ học browser CLI, bỏ desktop).",
		available: true,
	},
	ttsr: {
		what: "TTSR-lite: khi assistant nói sẽ commit / skip tests / auto-learn, abort stream rồi followUp reminder.",
		special:
			"Mặc định off trong `opm-verify`, on trong `opm-full` / `pi-super`. Tắt: `--without ttsr` hoặc `OPM_TTSR=0`. Abort giữa stream + followUp có thể loop hoặc làm mất tool call trên một số model — đừng bật nếu model đang tool-call dở.",
		learnedFrom: "Kỷ luật OPM (không commit/learn lén). Không phải TTSR đầy đủ (không retry hook upstream).",
		available: true,
	},
	memory: {
		what: "`MEMORY.md` trong project: skill nếu có YAML `description:`, không thì nhét vào system prompt. `/memory` và `/memory init`.",
		special:
			"User-reviewed. Không auto-write learnings. Walk lên git root, dừng ở `.git`. Mặc định off trong `opm-verify`. Tắt: `--without memory` hoặc `OPM_MEMORY=0`.",
		learnedFrom: "Project memory kiểu skill; đối lập omp auto `learn`.",
		available: true,
	},
};

function agentProfile(
	id: AgentProfileId,
	fields: Omit<AgentProfileCatalogEntry, "startInPlan">,
): AgentProfileCatalogEntry {
	return { ...fields, startInPlan: AGENT_PROFILES[id].startInPlan };
}

export const AGENT_PROFILE_CATALOG: Record<AgentProfileId, AgentProfileCatalogEntry> = {
	"claude-code": agentProfile("claude-code", {
		mimics: "Claude Code",
		chooseWhen: "Muốn plan + hỏi user + lint, không hashline",
		closest: "ask, /plan (không auto-run), lsp TS/JS, verify (không commit hộ).",
		missing: "Permission prompt từng tool, MCP, CLAUDE.md riêng, subagent team, IDE.",
		learnedFrom: "Claude Code: AskUserQuestion, plan mode, cẩn thận khi sửa. Engine vẫn là Pi.",
	}),
	amp: agentProfile("amp", {
		mimics: "Amp",
		chooseWhen: "Cùng gần với Claude Code (plan + ask + lsp)",
		closest: "Cùng pack với `claude-code`.",
		missing: "Amp source/repo map, team runner, IDE.",
		learnedFrom: "Amp (phong cách agent plan/ask). Cùng pack `claude-code`.",
		samePacksAs: "claude-code",
	}),
	antigravity: agentProfile("antigravity", {
		mimics: "Antigravity",
		chooseWhen: "Muốn agent tự chạy nhiều bước nhưng vẫn có plan/ask",
		closest: "verify, ask, plan, lsp, task, browser — hơn `claude-code` vì có task fan-out + UI snapshot.",
		missing: "`computer` desktop, orchestration riêng của Antigravity ngoài scout/worker. Browser pack chỉ snapshot/screenshot.",
		learnedFrom: "Antigravity (agent đa bước). OPM bắt lớp plan/ask + task scout/worker + browser evidence.",
	}),
	cline: agentProfile("cline", {
		mimics: "Cline",
		chooseWhen: "Plan mode mặc định, Act sau khi accept",
		closest: "Khởi động `--plan`; ask; verify. Không hashline/lsp (Cline không lấy đó làm xương sống).",
		missing: "Browser, MCP, checkpoint/diff UI của VS Code, auto-switch Plan/Act trong IDE.",
		learnedFrom: "Cline: Plan rồi Act, user duyệt. OPM confirm mới bật write, không tự execute.",
	}),
	kilo: agentProfile("kilo", {
		mimics: "Kilo Code",
		chooseWhen: "Cùng họ Cline (plan/act trên VS Code)",
		closest: "Cùng pack và `--plan` với `cline`.",
		missing: "UI Kilo, MCP marketplace, mode riêng của Kilo.",
		learnedFrom: "Kilo Code (họ Cline). Cùng pack `cline`.",
		samePacksAs: "cline",
	}),
	"command-code": agentProfile("command-code", {
		mimics: "Command Code",
		chooseWhen: "Cùng họ Cline/plan-act",
		closest: "Cùng pack và `--plan` với `cline`.",
		missing: "Command palette/IDE integration của Command Code.",
		learnedFrom: "Command Code (họ plan/act). Cùng pack `cline`.",
		samePacksAs: "cline",
	}),
	opencode: agentProfile("opencode", {
		mimics: "OpenCode",
		chooseWhen: "TUI agent, hỏi khi cần, không khóa plan lúc start",
		closest: "verify + ask + lsp. Giống Pi+TUI hơn Cline.",
		missing: "OpenCode session/share, provider UX, plugin marketplace.",
		learnedFrom: "OpenCode: TUI-first, tool-using. Pi đã là TUI; pack chỉ thêm ask/lsp/verify.",
	}),
	copilot: agentProfile("copilot", {
		mimics: "GitHub Copilot Agent",
		chooseWhen: "Agent + lint + hỏi, không plan-gate",
		closest: "Cùng pack với `opencode` (verify, ask, lsp).",
		missing: "GitHub PR agent, Copilot Workspace, IDE inline, MCP GitHub.",
		learnedFrom: "Copilot Agent (sửa code + kiểm tra). Không giả lập GitHub-hosted runner.",
		samePacksAs: "opencode",
	}),
	codex: agentProfile("codex", {
		mimics: "Codex (OpenAI)",
		chooseWhen: "Ít nghi lễ, làm trong phạm vi workspace",
		closest: "verify + sandbox workspace (policy path; chưa phải OS VM).",
		missing: "Sandbox OS/container thật (bubblewrap/gondolin QEMU), Codex app/IDE.",
		learnedFrom: "Codex: chạy trong workspace sandbox, ít hỏi. OPM bật `--sandbox workspace` trên profile này.",
	}),
	"oh-my-pi": agentProfile("oh-my-pi", {
		mimics: "Oh My Pi (omp)",
		chooseWhen: "Muốn batteries Pi: hashline + lsp + ask + plan",
		closest: "Cùng pack với `opm-plan`. Vẫn bật verify (không bắt chước auto-commit của omp).",
		missing: "31 tool, `computer` desktop, Rust native, MCP-in-core, `/collab`, auto `learn`. Lệnh `omp` không phải profile này.",
		learnedFrom: "omp: hashline, LSP, nhiều tool. OPM chỉ lấy phần gắn được bằng pack, giữ Pi core.",
		samePacksAs: "opm-plan",
	}),
	cursor: agentProfile("cursor", {
		mimics: "Cursor Agent",
		chooseWhen: "Edit chính xác + diagnostics + hỏi; không plan mặc định",
		closest: "Cùng pack với `opm-verify` (verify, hashline, ask, lsp).",
		missing: "IDE, Composer, Tab, repo index, multi-file apply UI, cloud agent.",
		learnedFrom: "Cursor: lints sau edit, hỏi khi thiếu context, sửa neo. TUI Pi không thay IDE.",
		samePacksAs: "opm-verify",
	}),
	aider: agentProfile("aider", {
		mimics: "Aider",
		chooseWhen: "Sửa file theo neo, hỏi khi cần, git do user quyết",
		closest: "hashline + ask + verify. Không lsp, không plan-gate.",
		missing: "Repo map, auto conventional commit, watch files, aider architect mode.",
		learnedFrom: "Aider: edit có chủ đích trên git repo. OPM không auto-commit (ngược aider mặc định).",
	}),
};

function markdownTable(headers: string[], rows: string[][]): string {
	const line = (cells: string[]): string => `| ${cells.join(" | ")} |`;
	return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

export function piPlusLabel(packs: readonly PackId[]): string {
	if (packs.length === 0) {
		return "Pi";
	}
	return `Pi + ${packs.join(", ")}`;
}

export function formatChooser(): string {
	const product = markdownTable(
		["Câu hỏi", "Trả lời"],
		[
			["Tích hợp này là gì?", OPM_PRODUCT.what],
			["Đặc biệt chỗ nào?", OPM_PRODUCT.special],
			["Học từ triết lý agent nào?", OPM_PRODUCT.learnedFrom],
		],
	);

	const presets = markdownTable(
		["Chọn preset", "Dùng khi", "Packs", "Tính năng", "Đặc biệt", "Học từ"],
		(Object.keys(PRESET_CATALOG) as PresetName[]).map((id) => {
			const entry = PRESET_CATALOG[id];
			const packs = id === "custom" ? "(tự chọn)" : piPlusLabel(entry.packs);
			const status = entry.available ? id : `${id} (phase 2)`;
			return [status, entry.chooseWhen, packs, entry.what, entry.special, entry.learnedFrom];
		}),
	);

	const packs = markdownTable(
		["Chọn pack", "v1?", "Tính năng", "Đặc biệt", "Học từ"],
		(Object.keys(PACK_CATALOG) as PackId[]).map((id) => {
			const entry = PACK_CATALOG[id];
			return [id, entry.available ? "có" : "chưa", entry.what, entry.special, entry.learnedFrom];
		}),
	);

	const profiles = markdownTable(
		["Chọn profile", "Phỏng theo", "Dùng khi", "Gợi ý combo", "Gần giống ở", "Còn thiếu", "Bắt đầu"],
		(Object.keys(AGENT_PROFILE_CATALOG) as AgentProfileId[]).map((id) => {
			const entry = AGENT_PROFILE_CATALOG[id];
			return [
				id,
				entry.mimics,
				entry.chooseWhen,
				piPlusLabel(AGENT_PROFILES[id].packs),
				entry.closest,
				entry.missing,
				entry.startInPlan ? "--plan" : "normal",
			];
		}),
	);

	return [
		"# OPM — bảng chọn",
		"",
		"Lệnh: `opm choose`. Preset: `opm --preset <tên>`. Profile: `opm --profile <tên>` (`--preset` cũng nhận tên profile).",
		"",
		"Mỗi profile là **gợi ý combo**: Pi + packs ≈ agent thật (hoặc mạnh hơn ở vài vũ khí). Cột “Còn thiếu” là phần không giả lập. User tích/bỏ pack trên mọi combo:",
		"",
		"- `--with hashline,ask` / `--enable` — bật pack",
		"- `--without lsp,plan` / `--disable` — tắt pack",
		"- `opm customize --from claude-code --with hashline --without lsp` — lưu combo riêng",
		"- `opm --profile custom` — chạy combo đã lưu (hoặc `--with` ngay trên CLI)",
		"",
		"`pi-super` là combo OPM nghiên cứu (đủ kit v1, không khóa plan). Không phải clone Claude/Cline/omp.",
		"",
		"## Tích hợp OPM",
		"",
		product,
		"",
		"## Chọn preset",
		"",
		presets,
		"",
		"## Profile phỏng theo agent (gợi ý — có thể --with / --without)",
		"",
		profiles,
		"",
		"## Chọn pack (vũ khí — tích hoặc bỏ)",
		"",
		packs,
		"",
		"## Không lấy",
		"",
		"31-tool dump, `computer` desktop, MCP trong core Pi, `omp commit` mặc định, auto `learn` skills, `/collab`.",
		"",
	].join("\n");
}
