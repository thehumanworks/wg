#!/usr/bin/env bun
import * as path from "node:path";

const root = import.meta.dir;
const shimPath = path.join(root, "shim", "ripgrep.ts");
const outfile = path.join(root, "bin", "wg");

const result = await Bun.build({
  entrypoints: [path.join(root, "index.ts")],
  target: "bun",
  compile: { outfile },
  minify: false,
  plugins: [
    {
      name: "alias-vscode-ripgrep",
      setup(build) {
        build.onResolve({ filter: /^@vscode\/ripgrep$/ }, () => ({
          path: shimPath,
        }));
      },
    },
  ],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log(`Built ${outfile}`);
