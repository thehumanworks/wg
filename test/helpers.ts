import * as path from "node:path";

export const repoRoot = path.join(import.meta.dir, "..");
export const indexPath = path.join(repoRoot, "index.ts");

/** Run the CLI with a controlled env (clears MORPHLLM_API_KEY by default). */
export async function runCli(
  args: string[],
  env: Record<string, string | undefined> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", indexPath, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MORPHLLM_API_KEY: "",
      MORPH_API_KEY: "",
      DOPPLER_TOKEN: "",
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}
