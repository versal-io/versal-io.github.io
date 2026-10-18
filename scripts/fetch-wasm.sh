#!/bin/sh
# Build the versal browser runtime from the versalkv source tree and copy it
# into public/versal-wasm. The bundle contains only relative imports, so it
# works under any host or subpath.
#
# Configuration (all optional, via environment variables):
#   VERSALKV_DIR      Local versalkv checkout. Defaults to ../versalkv.
#                     If the directory exists and is a git repo we build there
#                     directly instead of cloning.
#   VERSALKV_REMOTE   Git remote used when cloning. Defaults to the SSH URL,
#                     which requires a GitHub-registered SSH key for the
#                     private repo. For CI / token-based access, set it to
#                     https://<token>@github.com/versal-io/versalkv.git .
#   VERSALKV_REF      Branch / tag / commit to build. Defaults to main.
#   VERSALKV_SKIP_PULL  Set to 1 to skip fetching / pulling when a local
#                       checkout already exists.
set -eu

cd "$(dirname "$0")/.."

VERSALKV_DIR="${VERSALKV_DIR:-../versalkv}"
VERSALKV_REMOTE="${VERSALKV_REMOTE:-git@github.com:versal-io/versalkv.git}"
VERSALKV_REF="${VERSALKV_REF:-main}"
VERSALKV_SKIP_PULL="${VERSALKV_SKIP_PULL:-0}"

# --- tool checks -----------------------------------------------------------
need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required tool '$1' not found in PATH" >&2
    exit 1
  fi
}
need git
need wasm-pack
need cargo

# --- resolve the source tree -----------------------------------------------
if [ -d "$VERSALKV_DIR/.git" ]; then
  echo "Using existing versalkv checkout at $VERSALKV_DIR"
  if [ "$VERSALKV_SKIP_PULL" != "1" ]; then
    echo "Updating $VERSALKV_REF ..."
    (cd "$VERSALKV_DIR" && git fetch origin "$VERSALKV_REF" && git checkout "$VERSALKV_REF" && git pull --ff-only origin "$VERSALKV_REF")
  else
    echo "Skipping pull (VERSALKV_SKIP_PULL=1)"
  fi
else
  echo "versalkv not found at $VERSALKV_DIR"
  # If the directory exists but is not a git repo (e.g. CI restored only
  # target/ via cache), remove it so git clone can proceed cleanly.
  if [ -d "$VERSALKV_DIR" ]; then
    echo "Removing stale non-repo directory at $VERSALKV_DIR"
    rm -rf "$VERSALKV_DIR"
  fi
  echo "Cloning $VERSALKV_REMOTE ($VERSALKV_REF) ..."
  case "$VERSALKV_REMOTE" in
    git@github.com:*)
      echo "Note: versalkv is a private repo; ensure your SSH key is registered with GitHub."
      ;;
    https://*@github.com/*)
      echo "Note: using token-authenticated HTTPS remote."
      ;;
    https://github.com/*)
      echo "error: versalkv is a private repo; the HTTPS URL must embed a token" >&2
      echo "       (set VERSALKV_REMOTE to https://<token>@github.com/versal-io/versalkv.git)" >&2
      exit 1
      ;;
  esac
  git clone --depth 1 --branch "$VERSALKV_REF" "$VERSALKV_REMOTE" "$VERSALKV_DIR"
fi

# --- build -----------------------------------------------------------------
echo "Building wasm bundle (make wasm-dist) ..."
(cd "$VERSALKV_DIR" && make wasm-dist)

# --- install ---------------------------------------------------------------
if [ ! -d "$VERSALKV_DIR/dist/versal-wasm" ]; then
  echo "error: build produced no dist/versal-wasm directory" >&2
  exit 1
fi

rm -rf public/versal-wasm
mkdir -p public
cp -R "$VERSALKV_DIR/dist/versal-wasm" public/versal-wasm
echo "Installed versal browser runtime into public/versal-wasm"
