#!/bin/sh
# Download the rolling browser runtime built by the versalkv pipeline into
# public/versa-wasm. The bundle contains only relative imports, so it works
# under any host or subpath.
set -eu

cd "$(dirname "$0")/.."

URL="${VERSA_WASM_URL:-https://github.com/versal-io/versalkv/releases/download/wasm-latest/versa-wasm.tar.gz}"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

curl -fSL --retry 2 -o "$tmp" "$URL"
rm -rf public/versa-wasm
mkdir -p public
tar -xzf "$tmp" -C public
echo "Fetched versal browser runtime into public/versa-wasm"
