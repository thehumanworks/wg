// Replaces the real `@vscode/ripgrep` entrypoint at bundle time.
//
// The upstream package resolves a per-platform sibling package
// (`@vscode/ripgrep-${platform}-${arch}`) via `require.resolve` at import
// time. That throws inside a Bun `--compile` standalone executable because
// there is no node_modules tree at runtime.
//
// We embed the platform binary via Bun's `with { type: "file" }` so the
// import resolves at runtime. Embedded files live under a virtual
// `/$bunfs/` path which `fs` can read but the kernel cannot `exec`, so we
// extract the binary to a real temp file on first use and expose that path
// as `rgPath`. The extraction is cached across invocations by content hash.

import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// @ts-expect-error — Bun-only file import. The platform package ships a
// binary, not types.
import embeddedRgPath from "@vscode/ripgrep-darwin-arm64/bin/rg" with {
  type: "file",
};

function materialise(virtualPath: string): string {
  if (!virtualPath.startsWith("/$bunfs/")) return virtualPath;

  const data = readFileSync(virtualPath);
  const digest = createHash("sha256").update(data).digest("hex").slice(0, 16);
  const cacheDir = path.join(os.tmpdir(), "warpgrep-rg");
  const realPath = path.join(cacheDir, `rg-${digest}`);

  if (!existsSync(realPath)) {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(realPath, data, { mode: 0o755 });
    chmodSync(realPath, 0o755);
  }
  return realPath;
}

export const rgPath: string = materialise(embeddedRgPath);
