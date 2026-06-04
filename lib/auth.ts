import { DopplerSDK } from "@dopplerhq/node-sdk";

const dopplerProject = process.env.WG_DOPPLER_PROJECT || "wg";
const dopplerConfig = process.env.WG_DOPPLER_CONFIG || "prd";

async function getDopplerSecret(secretName: string): Promise<string> {
  const doppler = new DopplerSDK({
    accessToken: process.env.DOPPLER_TOKEN
  });

  const secret = await doppler.secrets.get(dopplerProject, dopplerConfig, secretName);
  return secret.value?.raw ?? "";
}

export const AUTH_MISSING_MESSAGE =
  "No Morph API key found. Set MORPHLLM_API_KEY or pass --api-key <key>.";

export async function resolveApiKey(flagKey: string | undefined): Promise<string> {
  const fromFlag = flagKey?.trim();
  if (fromFlag && fromFlag.length > 0) return fromFlag;

  const fromEnv = process.env.MORPHLLM_API_KEY;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const fromDoppler = await getDopplerSecret("MORPHLLM_API_KEY");
  if (fromDoppler && fromDoppler.length > 0) return fromDoppler;

  throw new Error(AUTH_MISSING_MESSAGE);
}
