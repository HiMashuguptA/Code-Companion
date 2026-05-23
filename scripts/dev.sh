#!/usr/bin/env bash
set -m
trap 'kill 0' EXIT INT TERM

echo "Building API server..."
pnpm --filter @workspace/api-server run build

(
  export PORT=8080 NODE_ENV=development
  unset PROD_DATABASE_URL
  node --enable-source-maps artifacts/api-server/dist/index.mjs
) &

PORT=5000 BASE_PATH=/ \
  pnpm --filter @workspace/gupta-enterprises run dev &

wait
