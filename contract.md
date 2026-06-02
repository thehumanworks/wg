# wg CLI verification contract

Binary criteria for "done". Each is independently checkable.

1. **CLI entry exists.** `package.json` contains `"bin": { "wg": "./index.ts" }` and `"type": "module"`. `index.ts` starts with a Bun shebang (`#!/usr/bin/env bun`).

2. **Help works.** `bun run index.ts --help` exits 0 and prints usage covering: local search, `github` subcommand, `read` subcommand, and the supported flags.

3. **Local search wired.** Calling `wg "<term>"` (no subcommand) calls `morph.warpGrep.execute({ searchTerm, repoRoot, excludes, includes, debug, search_type, streamSteps })` where `repoRoot` defaults to `process.cwd()` and is overridable with `-C/--cwd`.

4. **GitHub search wired.** `wg github <owner/repo> "<term>" [--branch X]` calls `morph.warpGrep.searchGitHub({ searchTerm, github, branch, streamSteps })`.

5. **GitHub read wired.** `wg read <owner/repo> <path> [--start N --end N --branch B]` calls `morph.warpGrep.readGitHubFile({ github, path, startLine, endLine, branch })`.

6. **Auth resolution.** Reads `MORPHLLM_API_KEY` from env, or accepts `--api-key <key>` (flag overrides env). If both are absent, prints a clear error to stderr and exits non-zero.

7. **Output modes.** Default mode prints `File: <path>` headers followed by content; `--json` mode prints the raw result as JSON to stdout. `--stream` mode prints `[turn N] <toolName>(args)` lines as the agent works.

8. **Typecheck clean.** `bunx tsc --noEmit` exits 0 against the existing `tsconfig.json`.

9. **Tests and lint.** `bun test` passes. `biome check .` passes. Auth and no-Doppler constraints are covered in `test/`.
