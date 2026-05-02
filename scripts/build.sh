#!/usr/bin/env bash
set -e

echo "Installing dependencies..."
pnpm install --frozen-lockfile

echo "Building API server..."
pnpm --filter @workspace/api-server run build

echo "Building frontend..."
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/gupta-enterprises run build

echo "Build complete!"
