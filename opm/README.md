# OPM

`opm` là CLI wrapper quanh Pi: engine vẫn là Pi (4 tool mặc định `read` / `bash` / `edit` / `write`). Packs thêm hành vi; preset bật/tắt packs. Không fork `agent-loop.ts`.

## Tên lệnh (đừng lẫn)

| Lệnh | Là gì |
| --- | --- |
| `pi` | Harness gốc (`@earendil-works/pi-coding-agent`) |
| `opm` | Sản phẩm này (wrapper + packs trong repo) |
| `omp` | Oh My Pi (can1357). **Không** phải dependency. Không copy source omp |

## Chạy từ repo này

Cần Node >= 22.19. Từ root repo:

```bash
# Stock Pi (không pack)
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --preset pi

# Mặc định: opm-verify (verify + hashline + ask + lsp)
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts

# Plan mode: không edit/write cho đến khi confirm
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --preset opm-plan

# Print mode
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --preset pi -p "list files"

# Init thư mục config riêng (không ghi đè ~/.pi/agent/settings.json)
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts init

# Bảng chọn preset/pack + nguồn triết lý
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts choose
```

`OPM_PI_FROM_SOURCE=1` dùng `./pi-test.sh`. Muốn binary khác: `OPM_PI_BIN=/path/to/pi`.

`opm` set `PI_CODING_AGENT_DIR` mặc định thành `~/.opm/agent`. Auth: nếu có `~/.pi/agent/auth.json`, `opm init` tạo symlink `~/.opm/agent/auth.json` trỏ tới file đó (không copy secret vào git).

## Tích hợp này là gì

| Câu hỏi | Trả lời |
| --- | --- |
| Tích hợp này là gì? | Wrapper CLI quanh Pi: engine vẫn là Pi (agent loop, TUI, session, `read`/`bash`/`edit`/`write`). Từng năng lực thêm là một pack (extension Pi). Preset bật/tắt pack, không sửa `packages/coding-agent`. |
| Đặc biệt chỗ nào? | Không fork `agent-loop` như Oh My Pi (`omp`). Pack tháo được (`--preset pi` = Pi gốc). Mặc định `opm-verify`: evidence, diff nhỏ, không commit hộ. Quyền vẫn là user — sandbox là phase sau. |
| Học từ triết lý agent nào? | Nền: triết lý Pi (nhẹ, 4 tool, không nhét plan/MCP/todo vào core). Học chọn lọc: omp (hashline, LSP), Claude Code (hỏi có cấu trúc, plan mode), Cline (plan rồi mới act), Codex (sandbox — chưa ship). Không lấy 31 tool, `computer` desktop, MCP-in-core, auto-commit, auto `learn`. |

In lại bảng này: `OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts choose`.

## Bảng chọn preset

| Chọn preset | Dùng khi | Packs | Tính năng | Đặc biệt | Học từ |
| --- | --- | --- | --- | --- | --- |
| `pi` | Muốn đúng Pi gốc, hoặc đang debug pack | (không) | Không load pack. Model chỉ thấy `read`, `bash`, `edit`, `write` (edit `oldText` của Pi). | Baseline. Dùng để so sánh: mọi thứ khác là pack, không phải core. | Pi — harness nhỏ, user-permission, không permission-popup hay plan mode trong core. |
| `opm-verify` (mặc định) | Làm việc hằng ngày | verify, hashline, ask, lsp | Bốn tool Pi + `ask` + `lsp`; edit/read hashline. | Chặn `git commit`/`push`/`reset --hard` trừ khi user hỏi; hỏi select/confirm; LSP TS/JS nếu có server. | Kỷ luật OPM (evidence, không commit lén) + omp (hashline/LSP) + Claude Code / Pi `question.ts` (ask). |
| `opm-plan` | Cần thiết kế trước, chưa cho agent sửa file | opm-verify + plan | `/plan`; write/edit tắt đến khi accept. | Bash allowlist; confirm mới được viết; Cancel giữ plan mode; không tự execute. | Claude Code plan, Cline plan-then-act, Pi `plan-mode`. Khác example Pi: không auto-run. |
| `opm-full` (phase 2) | Khi pack phase 2 đã có trên máy | + sandbox, task, browser | Union; file thiếu thì skip. | v1 chưa ship 3 pack sau. Đừng chọn nếu cần sandbox/subagent/browser ngay. | Codex + Pi sandbox; Pi subagent / omp `task`; browser evidence. Không lấy `computer` desktop của omp. |

Tắt hashline: `OPM_HASHLINE=0`.

## Bảng chọn pack

| Chọn pack | v1? | Tính năng | Đặc biệt | Học từ |
| --- | --- | --- | --- | --- |
| `verify` | có | Prompt evidence (diff nhỏ, bug cần repro, UI cần check UI) và chặn git write nếu user không hỏi. | Không auto-commit như omp. Nhận cả câu tiếng Việt kiểu “hay commit giup minh”. | Triết lý OPM: evidence trước, không commit hộ. Đối lập omp commit-by-default. |
| `hashline` | có | `read` text có `<!-- hashline -->` và prefix `HHHHHHHH|`; `edit` theo hash SHA-256 8 hex. | Hash stale → fail, không ghi file dở. Tắt: `OPM_HASHLINE=0`. Không đổi binary/ảnh. | omp (Oh My Pi) hashline; gắn bằng override tool Pi, không nhét vào core. |
| `ask` | có | Tool `ask`: ≥2 options → select, yes/no → confirm, còn lại → input. Sequential. | Không todo tool. Non-TUI trả lỗi, không giả câu trả lời. | Claude Code AskUserQuestion + Pi `question.ts`. |
| `plan` | có | `/plan` (và `--plan`): lọc tool + bash allowlist; confirm mới bật write. | Không auto-execute. Cancel = vẫn plan mode. | Claude Code plan, Cline plan/act, Pi `plan-mode` example. |
| `lsp` | có | Tool `lsp` + diagnostics sau `edit`/`write` TS/JS. | Thiếu `typescript-language-server`: báo lỗi, không crash. Lang khác: `unsupported in v1`. | omp LSP + hook `tool_result` của Pi. |
| `sandbox` | chưa | Policy path/net; profile off / workspace / container. | Default `off` (giữ Pi trên repo tin). | Codex workspace sandbox + Pi sandbox/gondolin. |
| `task` | chưa | Subagent context riêng. | Worker inherit verify; scout read-only (khi làm). | Pi `subagent` example + omp `task`. |
| `browser` | chưa | UI evidence. | Không thêm `computer` desktop của omp. | Học browser; bỏ desktop control. |

## Không lấy từ agent khác

31-tool dump, `computer` desktop, MCP trong core Pi, `omp commit` mặc định, auto `learn` skills, `/collab`.

## Gắn pack vào `pi` gốc

`opm` load pack bằng `-e` (và `--no-extensions` để không trộn extension discovery của Pi). Muốn dùng pack với `pi` không qua wrapper, thêm path vào `extensions` trong settings hoặc:

```bash
pi -e /abs/path/to/repo/opm/packs/verify/index.ts
```

Hoặc `pi install /path/to/package` nếu đóng gói đúng layout Pi package (xem `packages/coding-agent/docs/packages.md`). File `index.ts` lẻ không phải npm package.

## Bảo mật

OPM **vẫn chạy với quyền user**, giống Pi. Không sandbox trong v1. Agent có thể chạy bash, sửa file, mạng — trừ khi pack `verify`/`plan` chặn một phần. Pack sandbox là phase sau. Đừng commit trừ khi user hỏi.

## Test

```bash
cd opm && node ../node_modules/vitest/dist/cli.js --run
```

Không chạy `./test.sh` / `npm test` cho OPM (tránh e2e/LLM).
