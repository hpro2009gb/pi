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
```

`OPM_PI_FROM_SOURCE=1` dùng `./pi-test.sh`. Muốn binary khác: `OPM_PI_BIN=/path/to/pi`.

`opm` set `PI_CODING_AGENT_DIR` mặc định thành `~/.opm/agent`. Auth: nếu có `~/.pi/agent/auth.json`, `opm init` tạo symlink `~/.opm/agent/auth.json` trỏ tới file đó (không copy secret vào git).

## Preset

| Preset | Packs | Model thấy |
| --- | --- | --- |
| `pi` | không | `read`, `bash`, `edit`, `write` (edit gốc của Pi) |
| `opm-verify` (mặc định) | verify, hashline, ask, lsp | bốn tool trên + `ask` + `lsp`; edit/read hashline |
| `opm-plan` | opm-verify + plan | write/edit tắt đến khi accept |
| `opm-full` | thêm sandbox, task, browser | packs đó chưa có trong v1; spawn bỏ qua file thiếu |

Tắt hashline: `OPM_HASHLINE=0`.

## Packs v1

- **verify** — evidence, diff nhỏ, không `git commit` / `git push` / `git reset --hard` trừ khi user hỏi trong lượt (ví dụ “hay commit giup minh”).
- **hashline** — `read` text có header `<!-- hashline -->` và prefix `HHHHHHHH|`; `edit` theo hash; hash stale thì fail, không ghi file dở.
- **ask** — hỏi user có cấu trúc (`select` / `confirm` / `input`). Không có todo tool.
- **plan** — `/plan`; bash allowlist; confirm “Accept plan and enable writes?”; Cancel vẫn ở plan mode. Không tự execute.
- **lsp** — TS/JS qua `typescript-language-server --stdio` nếu có trên PATH. Ngôn ngữ khác: `unsupported in v1`. Thiếu server: báo lỗi, không crash Pi.

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
