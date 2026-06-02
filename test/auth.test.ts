import { afterEach, describe, expect, test } from "bun:test";
import { AUTH_MISSING_MESSAGE, resolveApiKey } from "../lib/auth.ts";

const saved = process.env.MORPHLLM_API_KEY;

afterEach(() => {
  if (saved === undefined) delete process.env.MORPHLLM_API_KEY;
  else process.env.MORPHLLM_API_KEY = saved;
});

describe("resolveApiKey", () => {
  test("uses --api-key when provided", () => {
    process.env.MORPHLLM_API_KEY = "env-key";
    expect(resolveApiKey("flag-key")).toBe("flag-key");
  });

  test("trims whitespace from flag value", () => {
    expect(resolveApiKey("  sk-trimmed  ")).toBe("sk-trimmed");
  });

  test("uses MORPHLLM_API_KEY when flag is absent", () => {
    delete process.env.MORPHLLM_API_KEY;
    process.env.MORPHLLM_API_KEY = "env-only";
    expect(resolveApiKey(undefined)).toBe("env-only");
  });

  test("uses MORPHLLM_API_KEY when flag is empty or whitespace", () => {
    process.env.MORPHLLM_API_KEY = "env-only";
    expect(resolveApiKey("")).toBe("env-only");
    expect(resolveApiKey("   ")).toBe("env-only");
  });

  test("flag overrides MORPHLLM_API_KEY", () => {
    process.env.MORPHLLM_API_KEY = "from-env";
    expect(resolveApiKey("from-flag")).toBe("from-flag");
  });

  test("throws when neither flag nor env is set", () => {
    delete process.env.MORPHLLM_API_KEY;
    expect(() => resolveApiKey(undefined)).toThrow(AUTH_MISSING_MESSAGE);
  });

  test("throws when env is empty and flag is absent", () => {
    process.env.MORPHLLM_API_KEY = "";
    expect(() => resolveApiKey(undefined)).toThrow(AUTH_MISSING_MESSAGE);
  });
});
