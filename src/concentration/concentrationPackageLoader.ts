import type { ConcentrationValidationResult } from "./types";

export interface ConcentrationPackageResponse {
  ok: boolean;
  text(): Promise<string>;
}

export type ConcentrationPackageFetch = (
  url: string,
  options: { cache: "no-cache"; signal: AbortSignal },
) => Promise<ConcentrationPackageResponse>;

interface LoadConcentrationPackageRequest {
  fetchImpl: ConcentrationPackageFetch;
  validate: (
    payloadText: string,
    manifestText: string,
  ) => Promise<ConcentrationValidationResult>;
  signal: AbortSignal;
  payloadUrl: string;
  manifestUrl: string;
}

export async function loadConcentrationPackage({
  fetchImpl,
  validate,
  signal,
  payloadUrl,
  manifestUrl,
}: LoadConcentrationPackageRequest): Promise<ConcentrationValidationResult> {
  const [payloadResponse, manifestResponse] = await Promise.all([
    fetchImpl(payloadUrl, { cache: "no-cache", signal }),
    fetchImpl(manifestUrl, { cache: "no-cache", signal }),
  ]);

  if (!payloadResponse.ok || !manifestResponse.ok) {
    throw new Error("交易集中度静态数据包不存在或无法读取。");
  }

  const [payloadText, manifestText] = await Promise.all([
    payloadResponse.text(),
    manifestResponse.text(),
  ]);
  return validate(payloadText, manifestText);
}
