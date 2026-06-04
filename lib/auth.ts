import { DopplerSDK } from "@dopplerhq/node-sdk";

export type DopplerOptions = {
  dopplerProject?: string;
  dopplerConfig?: string;
  dopplerToken?: string;
};

export type DopplerLookupOptions = {
  project: string;
  config: string;
  accessToken?: string;
};

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveDopplerLookupOptions(
  options: DopplerOptions = {},
): DopplerLookupOptions {
  return {
    project:
      nonEmpty(options.dopplerProject) ??
      nonEmpty(process.env.WG_DOPPLER_PROJECT) ??
      "wg",
    config:
      nonEmpty(options.dopplerConfig) ??
      nonEmpty(process.env.WG_DOPPLER_CONFIG) ??
      "prd",
    accessToken:
      nonEmpty(options.dopplerToken) ?? nonEmpty(process.env.DOPPLER_TOKEN),
  };
}

async function getDopplerSecret(
  secretName: string,
  options: DopplerOptions = {},
): Promise<string> {
  const { accessToken, project, config } = resolveDopplerLookupOptions(options);
  if (!accessToken) return "";

  const doppler = new DopplerSDK({ accessToken });

  try {
    const secret = await doppler.secrets.get(project, config, secretName);
    return secret.value?.raw ?? "";
  } catch {
    return "";
  }
}

export const AUTH_MISSING_MESSAGE =
  "No Morph API key found. Set MORPHLLM_API_KEY or pass --api-key <key>.";

export async function resolveApiKey(
  flagKey: string | undefined,
  dopplerOptions: DopplerOptions = {},
): Promise<string> {
  const fromFlag = nonEmpty(flagKey);
  if (fromFlag) return fromFlag;

  const fromEnv = nonEmpty(process.env.MORPHLLM_API_KEY);
  if (fromEnv) return fromEnv;

  const fromDoppler = await getDopplerSecret(
    "MORPHLLM_API_KEY",
    dopplerOptions,
  );
  if (fromDoppler && fromDoppler.length > 0) return fromDoppler;

  throw new Error(AUTH_MISSING_MESSAGE);
}
