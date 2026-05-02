#!/usr/bin/env bash
exec PORT=5000 NODE_ENV=production node artifacts/api-server/dist/index.mjs
