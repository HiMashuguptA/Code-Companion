#!/usr/bin/env bash
set -m
trap 'kill 0' EXIT INT TERM

PORT=8080 NODE_ENV=development \
  node --enable-source-maps artifacts/api-server/dist/index.mjs &

PORT=19303 BASE_PATH=/ \
  pnpm --filter @workspace/gupta-enterprises run dev &

wait
