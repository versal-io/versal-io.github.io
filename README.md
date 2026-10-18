# versal-io.github.io

Website for Versal — a Valkey-compatible in-memory data store rewritten in
Rust. The homepage embeds the real server compiled to WebAssembly as an
interactive shell.

Built with [Astro](https://astro.build) and deployed to GitHub Pages from
`main` via `.github/workflows/deploy.yml`.

## Develop

```sh
npm install
npm run dev        # local dev server
npm run build      # production build into dist/
npm run preview    # serve the production build
```

## Project layout

```
public/
  assets/shell.mjs        # terminal UI; talks to the wasm worker
  versal-wasm/             # browser runtime bundle (generated, do not edit)
src/
  layouts/BaseLayout.astro
  pages/index.astro       # interactive shell
  pages/blog/             # blog index and markdown posts
  content/blog/           # blog posts (markdown with frontmatter)
  content.config.ts       # blog collection schema
  styles/global.css       # design system
```

## The wasm bundle

`public/versal-wasm/` is **not committed** and is never built in this
repository. It is compiled from the engine repository
([versal-io/versalkv](https://github.com/versal-io/versalkv)) via its
`make wasm-dist` target, which produces a self-contained bundle under
`dist/versal-wasm/`.

`npm run fetch-wasm` clones (or reuses) the versalkv source, builds the
bundle, and copies it into `public/versal-wasm/`. Configuration:

```sh
# Default: use ../versalkv, cloning it from the private repo over SSH if absent
npm run fetch-wasm

# Point at an existing local checkout
VERSALKV_DIR=/path/to/versalkv npm run fetch-wasm

# Build a specific branch / tag
VERSALKV_REF=main npm run fetch-wasm

# Skip pulling updates when a local checkout already exists
VERSALKV_SKIP_PULL=1 npm run fetch-wasm

# Clone over HTTPS with a token (for CI environments without SSH keys)
VERSALKV_REMOTE=https://<token>@github.com/versal-io/versalkv.git npm run fetch-wasm
```

> versalkv is a private repository. The default remote uses SSH
> (`git@github.com:versal-io/versalkv.git`), so your SSH key must be
> registered with GitHub. For token-based access, set `VERSALKV_REMOTE` to
> an authenticated HTTPS URL.

All imports inside the bundle are relative; no path edits are required.
