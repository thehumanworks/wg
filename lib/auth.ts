export const AUTH_MISSING_MESSAGE =
  "No Morph API key found. Set MORPHLLM_API_KEY or pass --api-key <key>.";

export function resolveApiKey(flagKey: string | undefined): string {
  const fromFlag = flagKey?.trim();
  if (fromFlag && fromFlag.length > 0) return fromFlag;

  const fromEnv = process.env.MORPHLLM_API_KEY;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  throw new Error(AUTH_MISSING_MESSAGE);
}
