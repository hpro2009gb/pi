import { PRESET_PACKS, type PackId, type PresetName } from "./pack-registry.ts";

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

export const OPM_PRODUCT: ProductBlurb = {
	what: "Wrapper CLI quanh Pi: engine vẫn là Pi (agent loop, TUI, session, `read`/`bash`/`edit`/`write`). Từng năng lực thêm là một pack (extension Pi). Preset bật/tắt pack, không sửa `packages/coding-agent`.",
	special:
		"Không fork `agent-loop` như Oh My Pi (`omp`). Pack tháo được (`--preset pi` = Pi gốc). Mặc định `opm-verify`: evidence, diff nhỏ, không commit hộ. Quyền vẫn là user — sandbox là phase sau.",
	learnedFrom:
		"Nền: triết lý Pi (nhẹ, 4 tool, không nhét plan/MCP/todo vào core). Học chọn lọc: omp (hashline, LSP), Claude Code (hỏi có cấu trúc, plan mode), Cline (plan rồi mới act), Codex (sandbox — chưa ship). Không lấy 31 tool, `computer` desktop, MCP-in-core, auto-commit, auto `learn`.",
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
		chooseWhen: "Khi pack phase 2 đã có trên máy",
		packs: PRESET_PACKS["opm-full"],
		what: "`opm-plan` cộng sandbox + task + browser (file thiếu thì skip, không crash).",
		special: "v1 chưa ship 3 pack sau. Đừng chọn nếu cần sandbox/subagent/browser ngay.",
		learnedFrom: "Codex + Pi sandbox; Pi subagent / omp `task`; browser evidence. Không lấy `computer` desktop của omp.",
		available: false,
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
		special: "Default `off` (giữ Pi trên repo tin). Chưa có trong v1.",
		learnedFrom: "Codex workspace sandbox + Pi `examples/extensions/sandbox` / gondolin.",
		available: false,
	},
	task: {
		what: "Subagent context riêng (worker/scout).",
		special: "Chưa có trong v1. Khi làm: worker inherit verify; scout read-only.",
		learnedFrom: "Pi `examples/extensions/subagent` + omp `task`. Không nhét subagent vào core Pi.",
		available: false,
	},
	browser: {
		what: "UI evidence (browser), tắt mặc định trong `opm-verify`.",
		special: "Chưa có trong v1. Cố ý không thêm `computer` (desktop control) của omp.",
		learnedFrom: "Các agent UI-verify (omp browser/computer — chỉ học browser, bỏ desktop).",
		available: false,
	},
};

function markdownTable(headers: string[], rows: string[][]): string {
	const line = (cells: string[]): string => `| ${cells.join(" | ")} |`;
	return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
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
			const packs = entry.packs.length === 0 ? "(không)" : entry.packs.join(", ");
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

	return [
		"# OPM — bảng chọn",
		"",
		"Lệnh: `opm choose`. Chạy: `opm --preset <tên>`.",
		"",
		"## Tích hợp OPM",
		"",
		product,
		"",
		"## Chọn preset",
		"",
		presets,
		"",
		"## Chọn pack (bên trong preset)",
		"",
		packs,
		"",
		"## Không lấy",
		"",
		"31-tool dump, `computer` desktop, MCP trong core Pi, `omp commit` mặc định, auto `learn` skills, `/collab`.",
		"",
	].join("\n");
}
