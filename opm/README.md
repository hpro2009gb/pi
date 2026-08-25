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
# Super Pi — đủ pack v1 (cách test)
./opm-super.sh --approve --verbose
./opm-super.sh --dry-run          # in preset/packs/paths, không spawn TUI
./opm-super.sh --help             # phải thấy --plan và --sandbox (pack đã load)

# Model: TUI sẽ báo "No models available" nếu chưa login.
# Dùng login sẵn của omp/pi — không /login lại, không gửi prompt tốn token:
./opm.sh init
./opm.sh attach                 # ưu tiên binary `omp` trên PATH
./opm-super.sh --dry-run
./opm-super.sh --help           # pack flags, không gọi model
./opm.sh --list-models          # catalog local; không completion
# Đừng dùng -p "..." để smoke test.

# Lần đầu trong repo, Pi hỏi Trust project folder; --approve bỏ dialog đó.


# Wrapper chung (mặc định opm-verify)
./opm.sh
./opm.sh --preset pi
./opm.sh init                     # ~/.opm/agent + symlink auth từ ~/.pi nếu có

# Tương đương: OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts ...
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --preset pi


# Mặc định: opm-verify (verify + hashline + ask + lsp)
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts

# Plan mode: không edit/write cho đến khi confirm
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --preset opm-plan

# Print mode
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --preset pi -p "list files"

# Init thư mục config riêng (không ghi đè ~/.pi/agent/settings.json)
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts init

# Bảng chọn preset/pack + profile phỏng theo agent
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts choose

# Gợi ý combo Claude Code (tích/bỏ pack)
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --profile claude-code
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --profile claude-code --with hashline --without lsp

# PI SUPER (combo nghiên cứu của OPM — đủ pack v1, không khóa plan)
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --preset pi-super

# Tắt TTSR-lite trên combo đủ pack (abort+followUp có thể làm hỏng một số model)
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --preset pi-super --without ttsr

# Browser evidence trên combo bất kỳ (cần Chrome/Chromium trên PATH)
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --preset pi --with browser

# Codex-like: verify + sandbox workspace
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --profile codex

# Bật sandbox/task trên combo bất kỳ (`--sandbox` là flag pack: off|workspace|container)
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --with sandbox,task --sandbox workspace

# Tự chọn vũ khí, lưu, rồi chạy
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts customize --from claude-code --with hashline --without lsp
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --profile custom
OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --profile custom --with verify,ask
```

`OPM_PI_FROM_SOURCE=1` dùng `./pi-test.sh`. Muốn binary khác: `OPM_PI_BIN=/path/to/pi`. Nếu `pi` không có trên PATH, `opm` tự dùng `./pi-test.sh` khi chạy từ repo này.

`opm` set `PI_CODING_AGENT_DIR` mặc định thành `~/.opm/agent`. Auth: symlink tới login host nếu file đó có credential (không phải `{}`). Thứ tự: `OPM_AUTH_JSON`, `OMP_CODING_AGENT_DIR/auth.json`, `~/.omp/agent/auth.json`, `~/.pi/agent/auth.json`. `opm init` / mỗi lần spawn sẽ thay `{}` rỗng bằng symlink — không copy secret. Smoke test: `--dry-run`, `--help`, `--list-models`. Không `-p` (tốn token).

## Tích hợp này là gì

| Câu hỏi | Trả lời |
| --- | --- |
| Tích hợp này là gì? | Wrapper CLI quanh Pi: engine vẫn là Pi (agent loop, TUI, session, `read`/`bash`/`edit`/`write`). Từng năng lực thêm là một pack (extension Pi). Preset bật/tắt pack, không sửa `packages/coding-agent`. |
| Đặc biệt chỗ nào? | Không fork `agent-loop` như Oh My Pi (`omp`). Pack tháo được (`--preset pi` = Pi gốc). Mặc định `opm-verify`: evidence, diff nhỏ, không commit hộ. Sandbox là policy (mặc định off); OS VM chưa gắn. |
| Học từ triết lý agent nào? | Nền: triết lý Pi (nhẹ, 4 tool, không nhét plan/MCP/todo vào core). Học chọn lọc: omp (hashline, LSP), Claude Code (hỏi có cấu trúc, plan mode), Cline (plan rồi mới act), Codex (sandbox policy). Không lấy 31 tool, `computer` desktop, MCP-in-core, auto-commit, auto `learn`. |

In lại bảng này: `OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts choose`.

## Bảng chọn preset

| Chọn preset | Dùng khi | Packs | Tính năng | Đặc biệt | Học từ |
| --- | --- | --- | --- | --- | --- |
| `pi` | Muốn đúng Pi gốc, hoặc đang debug pack | Pi | Không load pack. Model chỉ thấy `read`, `bash`, `edit`, `write` (edit `oldText` của Pi). | Baseline. Dùng để so sánh: mọi thứ khác là pack, không phải core. | Pi — harness nhỏ, user-permission, không permission-popup hay plan mode trong core. |
| `opm-verify` (mặc định) | Làm việc hằng ngày | Pi + verify, hashline, ask, lsp | Bốn tool Pi + `ask` + `lsp`; edit/read hashline. | Chặn `git commit`/`push`/`reset --hard` trừ khi user hỏi; hỏi select/confirm; LSP TS/JS nếu có server. | Kỷ luật OPM (evidence, không commit lén) + omp (hashline/LSP) + Claude Code / Pi `question.ts` (ask). |
| `opm-plan` | Cần thiết kế trước, chưa cho agent sửa file | Pi + verify, hashline, ask, plan, lsp | `/plan`; write/edit tắt đến khi accept. | Bash allowlist; confirm mới được viết; Cancel giữ plan mode; không tự execute. | Claude Code plan, Cline plan-then-act, Pi `plan-mode`. Khác example Pi: không auto-run. |
| `opm-full` | Muốn đủ pack: sandbox + task + browser + ttsr + memory | Pi + verify, hashline, ask, plan, lsp, sandbox, task, browser, ttsr, memory | Union của mọi pack đã ship. | Sandbox mặc định off. Browser: snapshot/screenshot, không `computer`. TTSR abort+followUp; MEMORY.md user-reviewed. | Codex + Pi sandbox; Pi subagent / omp `task`; Chrome CLI evidence; TTSR-lite; project memory. |
| `pi-super` | Daily driver nghiên cứu của OPM | Pi + verify, hashline, ask, plan, lsp, sandbox, task, browser, ttsr, memory | Đủ pack v1; `/plan` khi cần, không khóa lúc start. | Không clone Claude/Cline/omp. Không inject `--plan`/`--sandbox`. TTSR on (tắt: `--without ttsr` / `OPM_TTSR=0`). | Pi + OPM verify + omp hashline/lsp + Claude ask/plan + Cline plan opt-in + Codex sandbox policy + browser + TTSR + MEMORY.md. |
| `custom` | Tự tích vũ khí | (tự chọn) | Pack user chọn / file đã lưu. | `opm customize --from <profile> --with/--without`. | User tùy biến; profile agent chỉ là gợi ý. |

Tắt hashline: `OPM_HASHLINE=0`.

`--preset` và `--profile` cùng parser: `opm --profile cline` = `opm --preset cline`.

Combo là **gợi ý**. Tích/bỏ pack trên mọi preset/profile:

| Flag | Alias | Việc |
| --- | --- | --- |
| `--with verify,ask` | `--enable` | Bật pack (lặp flag được) |
| `--without lsp,plan` | `--disable` | Tắt pack |

Ví dụ: `opm --profile claude-code --with hashline --without lsp` = Pi + verify, hashline, ask, plan.

## PI SUPER

`pi-super` là combo OPM nghiên cứu, không clone một agent. Packs: verify, hashline, ask, plan, lsp, sandbox, task, browser, ttsr, memory. Không inject `--plan` lúc start (dùng `/plan` khi cần). Sandbox mặc định `off`. TTSR-lite và MEMORY.md mặc định on; tắt bằng `--without` hoặc `OPM_TTSR=0` / `OPM_MEMORY=0`.

So với clone: Claude Code gợi ý không có hashline; Cline không hashline/lsp; omp auto-commit (OPM không); Codex không plan/ask. `pi-super` ghép các vũ khí v1 trên Pi core — có thể gần agent thật, hoặc mạnh hơn ở vài điểm. Browser pack không phải `computer` desktop.

## Custom (tự chọn vũ khí)

```bash
opm customize --from claude-code --with hashline --without lsp
opm --profile custom
```

Lưu `~/.opm/agent/custom-packs.json`. `--profile custom` không có file và không `--with` thì lỗi. Checkbox: `[x]` bật, `[ ]` tắt.

## Profile phỏng theo agent

Không biến Pi thành agent kia. Mỗi dòng là gợi ý `Pi + packs`. Cột “Còn thiếu” là phần không giả lập. User `--with` / `--without` hoặc `customize`.

| Chọn profile | Phỏng theo | Dùng khi | Gợi ý combo | Gần giống ở | Còn thiếu | Bắt đầu |
| --- | --- | --- | --- | --- | --- | --- |
| `claude-code` | Claude Code | Plan + hỏi + lint, không hashline | Pi + verify, ask, plan, lsp | ask, `/plan` (không auto-run), lsp TS/JS, verify | Permission từng tool, MCP, CLAUDE.md riêng, IDE | normal |
| `amp` | Amp | Cùng gần Claude Code | Pi + verify, ask, plan, lsp | ask+plan+lsp | Amp source/repo map, IDE | normal |
| `antigravity` | Antigravity | Nhiều bước nhưng vẫn plan/ask | Pi + verify, ask, plan, lsp, task, browser | ask+plan+lsp+task fan-out+browser snapshot | `computer` desktop, orchestration Antigravity ngoài scout/worker | normal |
| `cline` | Cline | Plan mặc định, Act sau accept | Pi + verify, ask, plan | `--plan` lúc start; confirm mới write | Browser, MCP, UI VS Code | `--plan` |
| `kilo` | Kilo Code | Họ Cline | Pi + verify, ask, plan | như `cline` | UI/MCP marketplace Kilo | `--plan` |
| `command-code` | Command Code | Họ plan/act | Pi + verify, ask, plan | như `cline` | Command palette/IDE | `--plan` |
| `opencode` | OpenCode | TUI, hỏi khi cần, không khóa plan | Pi + verify, ask, lsp | Pi TUI + ask/lsp/verify | Session/share, plugin marketplace | normal |
| `copilot` | GitHub Copilot Agent | Agent + lint + hỏi | Pi + verify, ask, lsp | ask+lsp+verify | GitHub PR agent, inline IDE | normal |
| `codex` | Codex | Ít nghi lễ, phạm vi workspace | Pi + verify, sandbox | `--sandbox workspace`; không commit hộ | OS VM/bubblewrap, Codex IDE | `--sandbox workspace` |
| `oh-my-pi` | Oh My Pi (`omp`) | Batteries: hashline+lsp+ask+plan | Pi + verify, hashline, ask, plan, lsp | Cùng pack `opm-plan`; vẫn chặn auto-commit | 31 tool, `computer`, Rust, MCP-in-core, `/collab`. Lệnh `omp` ≠ profile này | normal |
| `cursor` | Cursor Agent | Edit neo + diagnostics + hỏi | Pi + verify, hashline, ask, lsp | Cùng pack `opm-verify` | IDE, Composer, Tab, cloud agent | normal |
| `aider` | Aider | Sửa neo, git do user | Pi + verify, hashline, ask | hashline + ask; không auto-commit | Repo map, conventional commit mặc định của Aider | normal |

## Bảng chọn pack

| Chọn pack | v1? | Tính năng | Đặc biệt | Học từ |
| --- | --- | --- | --- | --- |
| `verify` | có | Prompt evidence (diff nhỏ, bug cần repro, UI cần check UI) và chặn git write nếu user không hỏi. | Không auto-commit như omp. Nhận cả câu tiếng Việt kiểu “hay commit giup minh”. | Triết lý OPM: evidence trước, không commit hộ. Đối lập omp commit-by-default. |
| `hashline` | có | `read` text có `<!-- hashline -->` và prefix `HHHHHHHH|`; `edit` theo hash SHA-256 8 hex. | Hash stale → fail, không ghi file dở. Tắt: `OPM_HASHLINE=0`. Không đổi binary/ảnh. | omp (Oh My Pi) hashline; gắn bằng override tool Pi, không nhét vào core. |
| `ask` | có | Tool `ask`: ≥2 options → select, yes/no → confirm, còn lại → input. Sequential. | Không todo tool. Non-TUI trả lỗi, không giả câu trả lời. | Claude Code AskUserQuestion + Pi `question.ts`. |
| `plan` | có | `/plan` (và `--plan`): lọc tool + bash allowlist; confirm mới bật write. | Không auto-execute. Cancel = vẫn plan mode. | Claude Code plan, Cline plan/act, Pi `plan-mode` example. |
| `lsp` | có | Tool `lsp` + diagnostics sau `edit`/`write` TS/JS. | Thiếu `typescript-language-server`: báo lỗi, không crash. Lang khác: `unsupported in v1`. | omp LSP + hook `tool_result` của Pi. |
| `sandbox` | có | Policy path/net; profile `off` / `workspace` / `container`. | Default `off`. workspace: ghi cwd/tmp, chặn ~/.ssh ~/.aws ~/.gnupg. container: thêm chặn curl/wget/ssh. Chưa phải VM. | Codex workspace + Pi sandbox/gondolin (VM để sau). |
| `task` | có | Tool `task`: scout (read+bash) hoặc worker (đủ tool + verify). Isolated `--mode json -p`. | Fan-out `tasks[]` (max 8, concurrency 4); `chain[]` với `{previous}`. Child spawn cùng engine parent (`pi-test.sh` từ source, binary `pi` nếu compiled). Không `node cli.ts`. Worker không auto-commit. Scout không edit/write. | Pi subagent example (single/parallel/chain) + omp `task`. |
| `browser` | có | UI evidence: `snapshot` (`--dump-dom`) hoặc `screenshot`. | Cần Chrome/Chromium hoặc `OPM_CHROME_BIN`. Không có tool `computer`. Tắt trong `opm-verify` trừ `--with browser`. | Học browser CLI; bỏ desktop control. |
| `ttsr` | có | TTSR-lite: assistant nói sẽ commit / skip tests / auto-learn → abort + followUp reminder. | Off trong `opm-verify`. Abort giữa stream có thể loop hoặc làm mất tool call trên một số model. Tắt: `--without ttsr` / `OPM_TTSR=0`. | Kỷ luật OPM; không phải retry hook upstream. |
| `memory` | có | `MEMORY.md` (skill nếu có YAML `description:`, không thì system prompt). `/memory`, `/memory init`. | User-reviewed. Không auto-learn. Walk tới git root. Off trong `opm-verify`. Tắt: `--without memory` / `OPM_MEMORY=0`. | Project memory; đối lập omp auto `learn`. |

## Không lấy từ agent khác

31-tool dump, `computer` desktop, MCP trong core Pi, `omp commit` mặc định, auto `learn` skills, `/collab`.

## Cài thành lệnh `opm` song song với `omp` (data riêng)

Không ghi đè `omp`/`pi`. Session/settings nằm `~/.opm/agent`, không phải `~/.pi/agent`. Auth **copy** một lần (không symlink) — `/login` trong OPM không ghi auth của omp. Đừng `attach`.

Từ root repo (worktree cũng được):

```bash
./opm.sh install-cli
# wrapper: ~/.local/bin/opm
# cần ~/.local/bin trong PATH

opm --help                 # Super Pi flags; không gọi model
opm --list-models
opm                        # TUI preset pi-super, data ~/.opm/agent
opm --preset opm-verify    # preset khác, vẫn dir riêng
```

`--share-auth` nếu muốn symlink login (chung credential, `/login` ghi cả hai). `--bin-dir /path` nếu không dùng `~/.local/bin`. `--force` nếu đã có file `opm` không phải wrapper này.

Gỡ: xóa `~/.local/bin/opm`. Data còn ở `~/.opm/agent` cho đến khi bạn xóa tay.

## Gắn pack vào `pi` gốc


OPM là Pi package (`package.json` → `pi.extensions`). Cài vào CLI `pi` đã có (cùng cách với `omp` nếu binary đó vẫn là lệnh `install` của Pi):

```bash
# Host trên PATH: omp trước, rồi pi, rồi ./pi-test.sh trong repo này
./opm.sh attach

# Chỉ định binary
OPM_HOST_BIN=$(command -v omp) ./opm.sh attach
OPM_HOST_BIN=$(command -v pi) ./opm.sh attach

# Tương đương tay
pi install /abs/path/to/repo/opm
pi list
pi --help    # phải thấy --plan và --sandbox
```

Ghi `packages` vào `~/.pi/agent/settings.json` (không copy source). `./opm-super.sh` vẫn spawn bằng `-e` và `--no-extensions` — không dùng package vừa cài; `attach` là cho lệnh `pi`/`omp` trần.

Một file `index.ts` lẻ: `pi -e /abs/path/to/repo/opm/packs/verify/index.ts`.

## Bảo mật

OPM **vẫn chạy với quyền user**, giống Pi. Pack `sandbox` là **policy** (chặn tool_call), không phải bubblewrap/QEMU. Agent vẫn có thể làm hại nếu profile `off` hoặc lệnh bash lách policy. Đừng commit trừ khi user hỏi.

## Test

```bash
cd opm && node ../node_modules/vitest/dist/cli.js --run
```

Không chạy `./test.sh` / `npm test` cho OPM (tránh e2e/LLM).
