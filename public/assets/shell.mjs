// In-browser Versal session. The runtime lives in /versa-wasm, assembled by
// `make wasm-dist` in the versa repository; keep that directory verbatim.
import { VersaClient } from "../versa-wasm/client.mjs";

const app = document.querySelector("#app");
const bootScreen = document.querySelector("#boot-screen");
const bootStatus = document.querySelector("#boot-status");
const scrollArea = document.querySelector("#scroll");
const lines = document.querySelector("#lines");
const input = document.querySelector("#input");
const prompt = document.querySelector("#prompt");
const runner = document.querySelector("#runner");
const examplesContainer = document.querySelector("#examples");

const EXAMPLES = [
  "PING",
  'SET greeting "hello from wasm"',
  "GET greeting",
  "INCR visits",
  "RPUSH tasks alpha beta gamma",
  "LRANGE tasks 0 -1",
  "HSET user:1 name versa role engine",
  "HGETALL user:1",
  "SADD tags rust wasm valkey",
  "SMEMBERS tags",
  "ZADD scores 10 alice 20 bob",
  "ZRANGE scores 0 -1 WITHSCORES",
  "DBSIZE",
  "SCAN 0",
];

const history = [];
let historyIndex = 0;
let historyDraft = "";
let client = null;
let busy = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function appendLine(kind, text) {
  const block = document.createElement("div");
  block.className = `line line-${kind}`;
  if (kind === "cmd") {
    const marker = document.createElement("span");
    marker.className = "prompt";
    marker.textContent = "versal> ";
    block.append(marker, document.createTextNode(text));
  } else {
    block.textContent = text;
  }
  lines.append(block);
  scrollArea.scrollTop = scrollArea.scrollHeight;
}

function quote(value) {
  return JSON.stringify(value);
}

function indentItems(items, formatter, depth = 0) {
  if (items.length === 0) return ["(empty array)"];
  const childIndent = "   ".repeat(depth + 1);
  return items.flatMap((item, index) => {
    const rendered = formatter(item, depth + 1);
    const prefix = `${index + 1}) `;
    const continuation = `${" ".repeat(prefix.length)}${childIndent}`;
    const indented = rendered.map((line, lineIndex) =>
      lineIndex === 0 ? line : `${continuation}${line}`,
    );
    indented[0] = `${prefix}${indented[0]}`;
    return indented;
  });
}

function formatReply(reply, depth = 0) {
  if (!reply || typeof reply !== "object") return [String(reply)];
  switch (reply.type) {
    case "simple":
      return [String(reply.value)];
    case "bulk":
      return [reply.value == null ? "(nil)" : quote(reply.value)];
    case "integer":
      return [`(integer) ${reply.value}`];
    case "double":
      return [`(double) ${reply.value}`];
    case "boolean":
      return [`(boolean) ${reply.value}`];
    case "array":
      return indentItems(
        reply.value,
        (value) => [value == null ? "(nil)" : quote(value)],
        depth,
      );
    case "replies":
      return indentItems(reply.value, formatReply, depth);
    case "map":
      return indentItems(
        reply.value,
        ([key, value], itemDepth) => {
          const keyLines = formatReply(key, itemDepth);
          const valueLines = formatReply(value, itemDepth);
          return [
            `${keyLines.join(" ")} => ${valueLines[0]}`,
            ...valueLines.slice(1),
          ];
        },
        depth,
      );
    case "error":
      return [`(error) ${reply.value}`];
    default:
      return [JSON.stringify(reply)];
  }
}

function decodeEscape(character) {
  if (character === "n") return "\n";
  if (character === "r") return "\r";
  if (character === "t") return "\t";
  return character;
}

function parseCommand(line) {
  const argv = [];
  let current = "";
  let quoteCharacter = null;
  let escaped = false;
  let hasToken = false;

  for (const character of line) {
    if (escaped) {
      current += decodeEscape(character);
      escaped = false;
      hasToken = true;
    } else if (character === "\\") {
      escaped = true;
      hasToken = true;
    } else if (quoteCharacter !== null) {
      if (character === quoteCharacter) {
        quoteCharacter = null;
      } else {
        current += character;
      }
      hasToken = true;
    } else if (character === '"' || character === "'") {
      quoteCharacter = character;
      hasToken = true;
    } else if (/\s/u.test(character)) {
      if (hasToken) {
        argv.push(current);
        current = "";
        hasToken = false;
      }
    } else {
      current += character;
      hasToken = true;
    }
  }

  if (escaped) throw new Error("Command ends with an incomplete escape");
  if (quoteCharacter !== null) {
    throw new Error("Command contains an unterminated quote");
  }
  if (hasToken) argv.push(current);
  return argv;
}

function showHelp() {
  appendLine(
    "sys",
    [
      "Versal — in-browser Valkey-compatible runtime.",
      "Examples: PING | SET key value | GET key | INCR key | DEL key",
      "          LPUSH/RPUSH/LRANGE | SADD/SMEMBERS | HSET/HGETALL",
      "          ZADD/ZRANGE | EXPIRE/TTL | SCAN | DBSIZE | FLUSHDB",
      "Local commands: help, clear",
      "History: Up/Down · clear screen: Ctrl+L · newline: Shift+Enter",
    ].join("\n"),
  );
}

function autoresize() {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

function setBusy(next) {
  busy = next;
  runner.classList.toggle("is-active", next);
  input.disabled = next;
  if (!next) {
    input.focus();
    autoresize();
  }
}

async function runLine(line) {
  if (!client) return;
  let argv;
  try {
    argv = parseCommand(line);
  } catch (error) {
    appendLine("err", error.message);
    return;
  }
  if (argv.length === 0) return;

  if (argv.length === 1 && argv[0].toLowerCase() === "clear") {
    lines.replaceChildren();
    return;
  }
  if (argv.length === 1 && argv[0].toLowerCase() === "help") {
    showHelp();
    return;
  }

  appendLine("cmd", line);
  setBusy(true);
  try {
    const reply = await client.execute(argv);
    appendLine(reply.type === "error" ? "err" : "out", formatReply(reply).join("\n"));
  } catch (error) {
    appendLine("err", `(error) ${error.message}`);
  } finally {
    setBusy(false);
  }
}

function submitInput() {
  const line = input.value.trim();
  if (!line || busy || !client) return;
  if (history.at(-1) !== line) {
    history.push(line);
  }
  historyIndex = history.length;
  historyDraft = "";
  input.value = "";
  autoresize();
  runLine(line);
}

function renderExamples() {
  for (const command of EXAMPLES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "example-btn";
    button.textContent = command;
    button.addEventListener("click", () => {
      app.classList.remove("sidebar-open");
      runLine(command);
    });
    examplesContainer.append(button);
  }
}

async function resetSession() {
  if (busy || !client) return;
  lines.replaceChildren();
  appendLine("sys", "Resetting keyspace...");
  try {
    await client.execute(["FLUSHDB"]);
    appendLine("sys", "Ready. Type help or tap an example.");
  } catch (error) {
    appendLine("err", `(error) ${error.message}`);
  }
  input.focus();
}

function leaveShellBlank() {
  // Bundle absent or broken: hide the boot screen and leave the shell empty.
  bootScreen.remove();
  app.classList.remove("app-loading");
  document.querySelector(".input-row")?.remove();
  examplesContainer.replaceChildren();
}

async function boot() {
  let VersaClient;
  try {
    await delay(220);
    bootStatus.textContent = "Compiling WebAssembly module...";
    ({ VersaClient } = await import("../versa-wasm/client.mjs"));
    client = await VersaClient.create();
    await delay(160);
    bootStatus.textContent = "Warming command runtime...";
    await client.execute(["PING"]);
    await delay(180);

    app.classList.remove("app-loading");
    bootScreen.classList.add("boot-hidden");
    setTimeout(() => bootScreen.remove(), 220);
    input.disabled = false;
    appendLine(
      "sys",
      [
        "Versal wasm32 — a Valkey-compatible runtime in your browser.",
        "Data lives only in this tab. Type help or tap an example.",
      ].join("\n"),
    );
    input.focus();
  } catch {
    leaveShellBlank();
  }
}

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitInput();
    return;
  }
  if (event.key === "ArrowUp" && (historyIndex > 0 || input.value)) {
    event.preventDefault();
    if (historyIndex === history.length) historyDraft = input.value;
    if (historyIndex > 0) {
      historyIndex -= 1;
      input.value = history[historyIndex] ?? "";
      autoresize();
    }
  } else if (event.key === "ArrowDown" && historyIndex < history.length) {
    event.preventDefault();
    historyIndex += 1;
    input.value = history[historyIndex] ?? historyDraft;
    autoresize();
  } else if (event.key.toLowerCase() === "l" && event.ctrlKey) {
    event.preventDefault();
    lines.replaceChildren();
  }
});

input.addEventListener("input", autoresize);

scrollArea.addEventListener("click", (event) => {
  if (event.target === scrollArea || event.target === lines) input.focus();
});

document.querySelector("#btn-clear").addEventListener("click", () => {
  lines.replaceChildren();
  input.focus();
});
document.querySelector("#btn-reset").addEventListener("click", resetSession);
document
  .querySelector("#btn-sidebar-toggle")
  .addEventListener("click", () => app.classList.add("sidebar-open"));
document
  .querySelector("#btn-sidebar-close")
  .addEventListener("click", () => app.classList.remove("sidebar-open"));

renderExamples();
boot();
oot();
