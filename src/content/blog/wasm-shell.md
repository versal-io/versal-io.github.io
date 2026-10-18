---
title: "Running Valkey in your browser"
description: "How the Versal shell ships the real Rust server to wasm32: cdylib, worker transport, bounded turns, and a copy-pasteable static bundle."
date: 2026-10-18
---

The shell on the front page is not a simulation of a key-value store. It is
the Versal server crate compiled to a `wasm32-unknown-unknown` cdylib,
driven through the same command runtime as the native binary. This post
describes how that fits together.

## One engine, two front doors

The command engine never touches a socket directly. Handlers take parsed
arguments and return reply values; IO, authentication and statistics are
applied around them. That boundary means the same handlers can sit behind
two different drivers:

- the native driver, backed by epoll and real connections;
- the browser driver, backed by a Web Worker and serialized messages.

On `wasm32`, filesystem and socket dependencies are compiled out behind a
feature flag. Platform services that remain — time and randomness — are
supplied by small shims backed by browser APIs.

## The worker protocol

The page, the worker, and the Rust runtime have deliberately narrow seams:

```
page  ── postMessage({ kind: "execute", argv }) ──▶  worker
page  ◀── { ok: true, value: <reply> } ───────────  worker
```

The worker instantiates the wasm module once, owns a single runtime, and
forwards each command as an argv array. Replies are tagged unions
(`simple`, `bulk`, `integer`, `array`, `map`, `error`, ...) that the shell
formats to look like a native CLI session. A `wake` message drives timed
events — expiration keeps working even though there is no OS timer thread.

The runtime steps in bounded turns, so a long command cannot starve
everything else in the worker.

## Shipping a release build

Debug wasm is a poor fit for the web: the unoptimized module weighs tens of
megabytes. The browser package is built with `wasm-pack --release`, which
enables fat LTO and runs `wasm-opt`, shrinking the module to roughly a
megabyte — about 400 KB pre-uncached after gzip.

A Make target assembles a self-contained bundle meant to be copied
verbatim into a static-site repository:

```sh
make wasm-dist
# dist/versal-wasm/
#   pkg/versal.js, pkg/versal_bg.wasm
#   client.mjs, worker.mjs, worker-entry.mjs, gateway.mjs
```

All imports inside the bundle are relative, so the directory works under any
host or subpath without rewriting code. This site keeps it under
`public/versal-wasm/`, where the static publisher copies it untouched.

## What does not work (yet)

- Persistence: there is no RDB or AOF in the browser build; reloading the
  tab starts with an empty keyspace.
- Replication, clustering and the module ABI are intentionally absent.
- A handful of commands still diverge from upstream semantics; the
  compatibility list is tracked by the Tcl regression suite.

Try the [shell](/) and see how far real workloads get. Future posts will
cover the bounded-turn driver and the storage engine's data structures.
