import type { ValidationResult } from "./types";

export interface LeveragePackageResponse {
  ok: boolean;
  text(): Promise<string>;
}

export type LeveragePackageFetch = (
  url: string,
  options: { cache: "no-cache"; signal: AbortSignal },
) => Promise<LeveragePackageResponse>;

interface LoadLeveragePackageRequest {
  fetchImpl: LeveragePackageFetch;
  validate: (payloadText: string, manifestText: string) => Promise<ValidationResult>;
  signal: AbortSignal;
  payloadUrl: string;
  manifestUrl: string;
}

export async function loadLeveragePackage({
  fetchImpl,
  validate,
  signal,
  payloadUrl,
  manifestUrl,
}: LoadLeveragePackageRequest): Promise<ValidationResult> {
  const [payloadResponse, manifestResponse] = await Promise.all([
    fetchImpl(payloadUrl, { cache: "no-cache", signal }),
    fetchImpl(manifestUrl, { cache: "no-cache", signal }),
  ]);

  if (!payloadResponse.ok || !manifestResponse.ok) {
    throw new Error("本机静态发布包文件不存在或无法读取。");
  }

  const [payloadText, manifestText] = await Promise.all([
    payloadResponse.text(),
    manifestResponse.text(),
  ]);
  return validate(payloadText, manifestText);
}
