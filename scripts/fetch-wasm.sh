#!/bin/sh
# Download the rolling browser runtime built by the versalkv pipeline into
# public/versal-wasm. The bundle contains only relative imports, so it works
# under any host or subpath.
set -eu

cd "$(dirname "$0")/.."

URL="${VERSAL_WASM_URL:-https://github.com/versal-io/versalkv/releases/download/wasm-latest/versal-wasm.tar.gz}"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

curl -fSL --retry 2 -o "$tmp" "$URL"
rm -rf public/versal-wasm
mkdir -p public
tar -xzf "$tmp" -C public
echo "Fetched versal browser runtime into public/versal-wasm"
