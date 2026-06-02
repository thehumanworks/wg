import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { AUTH_MISSING_MESSAGE } from "../lib/auth.ts";
import { repoRoot, runCli } from "./helpers.ts";

const VALID_KEY = "sk-test000000000000000000000000000000";

describe("CLI auth and help", () => {
  test("--help exits 0 and documents MORPHLLM_API_KEY and --api-key", async () => {
    const { stdout, stderr, exitCode } = await runCli(["--help"]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("MORPHLLM_API_KEY");
    expect(stdout).toContain("--api-key");
    expect(stdout).not.toMatch(/doppler/i);
  });

  test("exits non-zero with auth error when no key is available", async () => {
    const { stderr, exitCode } = await runCli(["local-search-term"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain(`wg: ${AUTH_MISSING_MESSAGE}`);
  });

  test("DOPPLER_TOKEN alone does not satisfy auth", async () => {
    const { stderr, exitCode } = await runCli(["term"], {
      DOPPLER_TOKEN: "dp.test.token",
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain(AUTH_MISSING_MESSAGE);
    expect(stderr).not.toMatch(/doppler/i);
  });

  test("MORPH_API_KEY alone does not satisfy auth", async () => {
    const { stderr, exitCode } = await runCli(["term"], {
      MORPH_API_KEY: "sk-legacy-key",
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain(AUTH_MISSING_MESSAGE);
  });

  test("--api-key is accepted for local search (past auth resolution)", async () => {
    const { stderr, exitCode } = await runCli(["term"], {
      MORPHLLM_API_KEY: "",
    });
    const withFlag = await runCli(["--api-key", VALID_KEY, "term"]);
    expect(withFlag.exitCode).not.toBe(0);
    expect(withFlag.stderr).not.toContain(AUTH_MISSING_MESSAGE);
    expect(exitCode).toBe(1);
    expect(stderr).toContain(AUTH_MISSING_MESSAGE);
  });

  test("--api-key is accepted for github subcommand", async () => {
    const { stderr, exitCode } = await runCli([
      "github",
      "octocat/Hello-World",
      "readme",
      "--api-key",
      VALID_KEY,
    ]);
    expect(stderr).not.toContain(AUTH_MISSING_MESSAGE);
    expect(exitCode).not.toBe(0);
  });

  test("--api-key is accepted for read subcommand", async () => {
    const { stderr } = await runCli([
      "read",
      "octocat/Hello-World",
      "README",
      "--api-key",
      VALID_KEY,
    ]);
    expect(stderr).not.toContain(AUTH_MISSING_MESSAGE);
  });

  test("MORPHLLM_API_KEY env is accepted (past auth resolution)", async () => {
    const { stderr } = await runCli(["term"], {
      MORPHLLM_API_KEY: VALID_KEY,
    });
    expect(stderr).not.toContain(AUTH_MISSING_MESSAGE);
  });

  test("--api-key overrides MORPHLLM_API_KEY for auth resolution", async () => {
    const missing = await runCli(["term"], { MORPHLLM_API_KEY: "" });
    expect(missing.stderr).toContain(AUTH_MISSING_MESSAGE);

    const withEnvOnly = await runCli(["term"], {
      MORPHLLM_API_KEY: "not-a-valid-morph-key",
    });
    expect(withEnvOnly.stderr).toContain("Invalid API key format");

    const flagWins = await runCli(["--api-key", VALID_KEY, "term"], {
      MORPHLLM_API_KEY: "not-a-valid-morph-key",
    });
    expect(flagWins.stderr).not.toContain(AUTH_MISSING_MESSAGE);
    expect(flagWins.stderr).not.toContain("not-a-valid-morph-key");
  });
});

describe("no Doppler dependency", () => {
  test("package.json does not list @dopplerhq/node-sdk", () => {
    const pkg = JSON.parse(
      fs.readFileSync(`${repoRoot}/package.json`, "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.["@dopplerhq/node-sdk"]).toBeUndefined();
  });

  test("index.ts does not import or reference Doppler", () => {
    const source = fs.readFileSync(`${repoRoot}/index.ts`, "utf8");
    expect(source).not.toMatch(/doppler/i);
    expect(source).not.toMatch(/DOPPLER_TOKEN/);
    expect(source).not.toMatch(/MORPH_API_KEY/);
  });

  test("lockfile does not pin @dopplerhq/node-sdk", () => {
    const lock = fs.readFileSync(`${repoRoot}/bun.lock`, "utf8");
    expect(lock).not.toContain("@dopplerhq/node-sdk");
  });
});
