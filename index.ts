#!/usr/bin/env bun
import * as path from "node:path";
import { parseArgs } from "node:util";
import { MorphClient } from "@morphllm/morphsdk";
import type {
  GitHubReadFileResult,
  WarpGrepContext,
  WarpGrepResult,
  WarpGrepStep,
} from "@morphllm/morphsdk/tools/warp-grep";
import { resolveApiKey } from "./lib/auth.ts";

const USAGE = `wg — warp grep, fast code search for AI agents

Usage:
  wg [options] <search-term>                    Search the local repo
  wg github <owner/repo> <search-term> [opts]   Search a public GitHub repo
  wg read <owner/repo> <file-path> [opts]       Read a file from a public GitHub repo
  wg --help

Global options:
  --api-key <key>           Morph API key (overrides MORPHLLM_API_KEY)

Local-search options:
  -C, --cwd <path>          Repo root (default: current directory)
  --include <glob>          Include glob (repeatable)
  --exclude <glob>          Exclude glob (repeatable)
  --node-modules            Search inside node_modules / dep dirs
  --stream                  Stream tool-call steps to stderr as they happen
  --json                    Emit the full result as JSON to stdout
  --debug                   Enable SDK debug logging

GitHub-search options:
  --branch <branch>         Branch to search (defaults to the repo default)
  --stream, --json, --debug

GitHub-read options:
  --start <n>               Start line (1-based)
  --end <n>                 End line (1-based, inclusive)
  --branch <branch>
  --json

Authentication:
  Set MORPHLLM_API_KEY in the environment, or pass --api-key <key>.
`;

function die(msg: string, code = 1): never {
  process.stderr.write(`wg: ${msg}\n`);
  process.exit(code);
}

function printContexts(contexts: WarpGrepContext[] | undefined): void {
  if (!contexts || contexts.length === 0) {
    process.stdout.write("(no matches)\n");
    return;
  }
  for (const ctx of contexts) {
    process.stdout.write(`\n=== ${ctx.file} ===\n`);
    process.stdout.write(ctx.content);
    if (!ctx.content.endsWith("\n")) process.stdout.write("\n");
  }
}

function reportResult(result: WarpGrepResult, asJson: boolean): number {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.success ? 0 : 1;
  }
  if (!result.success) {
    process.stderr.write(`search failed: ${result.error ?? "unknown error"}\n`);
    return 1;
  }
  if (result.summary) {
    process.stdout.write(`Summary: ${result.summary}\n`);
  }
  printContexts(result.contexts);
  return 0;
}

function describeToolCall(step: WarpGrepStep): string {
  if (step.toolCalls.length === 0) return `[turn ${step.turn}] (no tool calls)`;
  const parts = step.toolCalls.map((tc) => {
    const args = Object.entries(tc.arguments)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ");
    return `${tc.name}(${args})`;
  });
  return `[turn ${step.turn}] ${parts.join("; ")}`;
}

async function consumeStream(
  stream: AsyncGenerator<WarpGrepStep, WarpGrepResult, undefined>,
): Promise<WarpGrepResult> {
  let next = await stream.next();
  while (!next.done) {
    process.stderr.write(`${describeToolCall(next.value)}\n`);
    next = await stream.next();
  }
  return next.value;
}

type ParsedFlags = {
  values: Record<string, string | boolean | string[] | undefined>;
  positionals: string[];
};

function parse(argv: string[]): ParsedFlags {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      cwd: { type: "string", short: "C" },
      include: { type: "string", multiple: true },
      exclude: { type: "string", multiple: true },
      "node-modules": { type: "boolean" },
      stream: { type: "boolean" },
      json: { type: "boolean" },
      debug: { type: "boolean" },
      branch: { type: "string" },
      start: { type: "string" },
      end: { type: "string" },
      "api-key": { type: "string" },
    },
  });
  return { values, positionals };
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asBool(v: unknown): boolean {
  return v === true;
}
function asStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : undefined;
}

async function runLocalSearch(
  morph: MorphClient,
  searchTerm: string,
  flags: ParsedFlags["values"],
): Promise<number> {
  const cwd = asString(flags.cwd) ?? process.cwd();
  const repoRoot = path.resolve(cwd);
  const stream = asBool(flags.stream);
  const json = asBool(flags.json);
  const debug = asBool(flags.debug);
  const includes = asStringArray(flags.include);
  const excludes = asStringArray(flags.exclude);
  const searchType: "default" | "node_modules" = asBool(flags["node-modules"])
    ? "node_modules"
    : "default";

  if (stream) {
    const gen = morph.warpGrep.execute({
      searchTerm,
      repoRoot,
      includes,
      excludes,
      debug,
      search_type: searchType,
      streamSteps: true,
    });
    const result = await consumeStream(gen);
    return reportResult(result, json);
  }

  const result = await morph.warpGrep.execute({
    searchTerm,
    repoRoot,
    includes,
    excludes,
    debug,
    search_type: searchType,
  });
  return reportResult(result, json);
}

async function runGitHubSearch(
  morph: MorphClient,
  github: string,
  searchTerm: string,
  flags: ParsedFlags["values"],
): Promise<number> {
  const stream = asBool(flags.stream);
  const json = asBool(flags.json);
  const branch = asString(flags.branch);

  if (stream) {
    const gen = morph.warpGrep.searchGitHub({
      searchTerm,
      github,
      branch,
      streamSteps: true,
    });
    const result = await consumeStream(gen);
    return reportResult(result, json);
  }

  const result = await morph.warpGrep.searchGitHub({
    searchTerm,
    github,
    branch,
  });
  return reportResult(result, json);
}

function parseLine(s: string | undefined, label: string): number | undefined {
  if (s === undefined) return undefined;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) {
    die(`--${label} must be a positive integer, got ${JSON.stringify(s)}`);
  }
  return n;
}

async function runGitHubRead(
  morph: MorphClient,
  github: string,
  filePath: string,
  flags: ParsedFlags["values"],
): Promise<number> {
  const json = asBool(flags.json);
  const startLine = parseLine(asString(flags.start), "start");
  const endLine = parseLine(asString(flags.end), "end");
  const branch = asString(flags.branch);

  const result: GitHubReadFileResult = await morph.warpGrep.readGitHubFile({
    github,
    path: filePath,
    startLine,
    endLine,
    branch,
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.success ? 0 : 1;
  }
  if (!result.success) {
    process.stderr.write(`read failed: ${result.error ?? "unknown error"}\n`);
    return 1;
  }
  const headerLeft = [result.github, result.path].filter(Boolean).join(" ");
  const header = [
    headerLeft,
    result.branch ? `@${result.branch}` : "",
    result.lineRange
      ? ` lines ${result.lineRange[0]}-${result.lineRange[1]}`
      : "",
    result.totalLines ? ` of ${result.totalLines}` : "",
  ]
    .filter(Boolean)
    .join("");
  process.stdout.write(`=== ${header} ===\n`);
  process.stdout.write(result.content ?? "");
  if (result.content && !result.content.endsWith("\n"))
    process.stdout.write("\n");
  return 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);

  let parsed: ParsedFlags;
  try {
    parsed = parse(argv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    die(`${msg}\n\n${USAGE}`, 2);
  }

  const { values, positionals } = parsed;

  if (asBool(values.help) || positionals.length === 0) {
    process.stdout.write(USAGE);
    return asBool(values.help) ? 0 : 1;
  }

  let apiKey: string;
  try {
    apiKey = resolveApiKey(asString(values["api-key"]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    die(msg);
  }
  const morph = new MorphClient({ apiKey });

  const first = positionals[0]!;

  if (first === "github") {
    const repo = positionals[1];
    const term = positionals.slice(2).join(" ");
    if (!repo || !term) {
      die(
        `github subcommand needs <owner/repo> and <search-term>\n\n${USAGE}`,
        2,
      );
    }
    return runGitHubSearch(morph, repo, term, values);
  }

  if (first === "read") {
    const repo = positionals[1];
    const filePath = positionals[2];
    if (!repo || !filePath) {
      die(`read subcommand needs <owner/repo> and <file-path>\n\n${USAGE}`, 2);
    }
    parseLine(asString(values.start), "start");
    parseLine(asString(values.end), "end");
    return runGitHubRead(morph, repo, filePath, values);
  }

  const searchTerm = positionals.join(" ");
  return runLocalSearch(morph, searchTerm, values);
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.stack ?? err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      die(formatError(err));
    });
}
