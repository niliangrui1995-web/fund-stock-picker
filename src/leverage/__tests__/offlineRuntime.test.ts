import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { stockLogoSources } from "../../App";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("本机离线运行边界", () => {
  it("股票图标只使用本地文件，失效后由组件文本占位，不尝试外网回退", () => {
    const sources = stockLogoSources("NVDA");

    expect(sources).toEqual(["/stock-logos/nvda.png"]);
    expect(sources.every((source) => !/^https?:\/\//.test(source))).toBe(true);
    expect(stockLogoSources("AMDUS")).toEqual(["/stock-logos/amd.png"]);
    expect(stockLogoSources("")).toEqual([]);
  });

  it("运行时代码只允许 Turnstile，不保留外部图片或数据域名", async () => {
    const [appSource, headers] = await Promise.all([
      readFile(resolve(projectRoot, "src", "App.tsx"), "utf8"),
      readFile(resolve(projectRoot, "public", "_headers"), "utf8"),
    ]);

    const externalUrls = appSource.match(/https?:\/\/[^\"'`\s]+/g) ?? [];

    expect(externalUrls).toEqual(["https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]);
    expect(headers).toContain("img-src 'self' data:");
    expect(headers).toContain("connect-src 'self'");
    expect(headers).toContain("script-src 'self' https://challenges.cloudflare.com");
    expect(headers).toContain("frame-src https://challenges.cloudflare.com");
    expect(headers).not.toMatch(/financialmodelingprep|eodhd/);
  });
});
