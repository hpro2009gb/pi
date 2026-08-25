#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export OPM_PI_FROM_SOURCE="${OPM_PI_FROM_SOURCE:-1}"
exec node "$SCRIPT_DIR/opm/src/cli.ts" "$@"
