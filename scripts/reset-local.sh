#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

STATE_DIR=".wrangler/state/v3/d1"

if [ -d "$STATE_DIR" ]; then
  rm -rf "$STATE_DIR"
fi

CI=1 pnpm exec wrangler d1 migrations apply DB --local
pnpm exec wrangler d1 execute DB --local --file=seeds/seed.sql

echo "Local D1 reset complete (local state only; no remote database was contacted)."
