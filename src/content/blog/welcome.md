---
title: "Welcome to Versal"
description: "Versal is a Valkey-compatible in-memory data store rewritten in Rust — and you can drive the real server from a browser tab."
date: 2026-10-18
---

Versal is an in-memory data store that speaks the Valkey (Redis-family) RESP
protocol, rewritten from scratch in Rust. It is not a thin client or a toy
subset: the same engine that runs as a server binary is compiled to
WebAssembly, and the interactive shell on this site talks to that engine —
not to a remote backend.

If you have not yet, open the [shell](/), type `PING`, and then try the
examples in the side panel. Every reply comes from code executing on your
own machine.

## What works in the browser

- Strings, lists, sets, hashes, sorted sets and their command families.
- Expiration, keyspace scanning and the full command dispatch path.
- A bounded-turn runtime: a single session cannot monopolize the event loop,
  the same fairness guarantee the native server enforces across connections.
- A worker-based UI so the terminal stays responsive while commands run.

Nothing on this page contacts a server. The keyspace lives in the tab's
linear memory and disappears when the tab closes.

## Why rewrite it in Rust

The goal is to keep the observable behavior of Valkey while rebuilding the
internals around a layered architecture: protocol and storage primitives at
the bottom, the engine and command handlers in the middle, and a poller-based
event loop at the top. Compatibility is measured against the upstream Tcl
regression suite, so behavior changes are caught by the same tests the
reference implementation uses.

The browser build is a proving ground for that layering: the engine has no
implicit dependency on sockets or filesystems, which is why it can target
`wasm32-unknown-unknown` without forking the command implementations.

## What this site is

This blog will cover the rewrite as it progresses: runtime architecture,
compatibility milestones, and the engineering notes behind individual
subsystems. The next post,
[Running Valkey in your browser](/blog/wasm-shell/), explains how the
WebAssembly shell is built.

Versal is experimental. Do not put data you care about in it yet — but do try
to break the shell, and report what you find.
