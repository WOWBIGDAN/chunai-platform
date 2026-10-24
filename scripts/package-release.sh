#!/usr/bin/env bash
set -euo pipefail
revision=${1:?Commit SHA required}
[[ $revision =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid commit SHA' >&2; exit 2; }
mkdir -p .release
printf '%s\n' "$revision" > REVISION
npm prune --omit=dev --ignore-scripts --no-audit --no-fund
tar -czf .release/release.tar.gz dist database/schema.sql database/commerce.sql node_modules package.json package-lock.json REVISION
sha256sum .release/release.tar.gz > .release/release.tar.gz.sha256
