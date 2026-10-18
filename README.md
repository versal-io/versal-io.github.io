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
repository. The engine repository
([versal-io/versalkv](https://github.com/versal-io/versalkv)) compiles it in
its `Browser wasm bundle` workflow and publishes a rolling asset on the
`wasm-latest` GitHub Release. The deploy workflow fetches it before the
Astro build; if the release or asset is missing, that step is skipped and
the shell section renders empty while the rest of the site stays up.

Fetch it locally for development:

```sh
npm run fetch-wasm
# or pin a specific tarball:
VERSAL_WASM_URL=https://.../versal-wasm.tar.gz npm run fetch-wasm
```

All imports inside the bundle are relative; no path edits are required.
