import { afterEach, describe, expect, test } from "bun:test";
import {
  AUTH_MISSING_MESSAGE,
  buildDopplerSecretUrl,
  resolveApiKey,
  resolveDopplerLookupOptions,
} from "../lib/auth.ts";

const savedMorphKey = process.env.MORPHLLM_API_KEY;
const savedDopplerToken = process.env.DOPPLER_TOKEN;
const savedDopplerProject = process.env.WG_DOPPLER_PROJECT;
const savedDopplerConfig = process.env.WG_DOPPLER_CONFIG;

afterEach(() => {
  if (savedMorphKey === undefined) delete process.env.MORPHLLM_API_KEY;
  else process.env.MORPHLLM_API_KEY = savedMorphKey;

  if (savedDopplerToken === undefined) delete process.env.DOPPLER_TOKEN;
  else process.env.DOPPLER_TOKEN = savedDopplerToken;

  if (savedDopplerProject === undefined) delete process.env.WG_DOPPLER_PROJECT;
  else process.env.WG_DOPPLER_PROJECT = savedDopplerProject;

  if (savedDopplerConfig === undefined) delete process.env.WG_DOPPLER_CONFIG;
  else process.env.WG_DOPPLER_CONFIG = savedDopplerConfig;
});

describe("resolveApiKey", () => {
  test("uses --api-key when provided", async () => {
    process.env.MORPHLLM_API_KEY = "env-key";
    expect(await resolveApiKey("flag-key")).toBe("flag-key");
  });

  test("trims whitespace from flag value", async () => {
    expect(await resolveApiKey("  sk-trimmed  ")).toBe("sk-trimmed");
  });

  test("uses MORPHLLM_API_KEY when flag is absent", async () => {
    delete process.env.MORPHLLM_API_KEY;
    process.env.MORPHLLM_API_KEY = "env-only";
    expect(await resolveApiKey(undefined)).toBe("env-only");
  });

  test("uses MORPHLLM_API_KEY when flag is empty or whitespace", async () => {
    process.env.MORPHLLM_API_KEY = "env-only";
    expect(await resolveApiKey("")).toBe("env-only");
    expect(await resolveApiKey("   ")).toBe("env-only");
  });

  test("flag overrides MORPHLLM_API_KEY", async () => {
    process.env.MORPHLLM_API_KEY = "from-env";
    expect(await resolveApiKey("from-flag")).toBe("from-flag");
  });

  test("flag overrides Doppler token and coordinates", async () => {
    delete process.env.MORPHLLM_API_KEY;
    expect(
      await resolveApiKey("from-flag", {
        dopplerConfig: "dev",
        dopplerProject: "custom-project",
        dopplerToken: "dp.test.token",
      }),
    ).toBe("from-flag");
  });

  test("resolves Doppler defaults, env overrides, and option precedence", () => {
    process.env.DOPPLER_TOKEN = "dp.env.token";
    process.env.WG_DOPPLER_PROJECT = "env-project";
    process.env.WG_DOPPLER_CONFIG = "dev";

    expect(resolveDopplerLookupOptions()).toEqual({
      accessToken: "dp.env.token",
      project: "env-project",
      config: "dev",
    });
    expect(
      resolveDopplerLookupOptions({
        dopplerConfig: "stg",
        dopplerProject: "flag-project",
        dopplerToken: "dp.flag.token",
      }),
    ).toEqual({
      accessToken: "dp.flag.token",
      project: "flag-project",
      config: "stg",
    });
  });

  test("builds the Doppler secret endpoint URL", () => {
    expect(
      buildDopplerSecretUrl("MORPHLLM_API_KEY", {
        project: "custom-project",
        config: "dev",
      }),
    ).toBe(
      "https://api.doppler.com/v3/configs/config/secret?project=custom-project&config=dev&name=MORPHLLM_API_KEY",
    );
  });

  test("uses Doppler project/config defaults when overrides are empty", () => {
    delete process.env.DOPPLER_TOKEN;
    process.env.WG_DOPPLER_PROJECT = "";
    process.env.WG_DOPPLER_CONFIG = "";

    expect(resolveDopplerLookupOptions()).toEqual({
      accessToken: undefined,
      project: "wg",
      config: "prd",
    });
  });

  test("throws when neither flag nor env nor Doppler token is set", async () => {
    delete process.env.MORPHLLM_API_KEY;
    delete process.env.DOPPLER_TOKEN;
    await expect(resolveApiKey(undefined)).rejects.toThrow(
      AUTH_MISSING_MESSAGE,
    );
  });

  test("throws when env is empty and Doppler token is absent", async () => {
    process.env.MORPHLLM_API_KEY = "";
    delete process.env.DOPPLER_TOKEN;
    await expect(resolveApiKey(undefined)).rejects.toThrow(
      AUTH_MISSING_MESSAGE,
    );
  });
});
