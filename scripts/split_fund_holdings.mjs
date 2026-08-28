// 将 public/data/fund-stock-index-<slug>.json 拆分为：
//   1. 主索引（不含 fundHoldings）—— 首屏关键数据，体积约减 37%
//   2. fund-holdings-<slug>.json —— 悬浮卡明细数据，前端按需懒加载
// 用法: node scripts/split_fund_holdings.mjs [slug ...]  （默认处理已有季度文件）
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "public", "data");

async function splitQuarter(slug) {
  const indexPath = path.join(DATA_DIR, `fund-stock-index-${slug}.json`);
  const holdingsPath = path.join(DATA_DIR, `fund-holdings-${slug}.json`);

  const raw = await readFile(indexPath, "utf8");
  const payload = JSON.parse(raw);
  const { fundHoldings, ...rest } = payload;

  if (!fundHoldings) {
    console.log(`[skip] fund-stock-index-${slug}.json has no fundHoldings (already split?)`);
    return;
  }

  const holdingsPayload = {
    meta: {
      report: payload.meta?.report ?? slug,
      generatedAt: payload.meta?.generatedAt ?? "",
      fundCount: Object.keys(fundHoldings).length,
    },
    fundHoldings,
  };

  await writeFile(holdingsPath, JSON.stringify(holdingsPayload), "utf8");
  await writeFile(indexPath, JSON.stringify(rest), "utf8");

  const kb = (n) => (n / 1024).toFixed(0) + "KB";
  console.log(
    `[ok] ${slug}: index ${kb(Buffer.byteLength(JSON.stringify(rest)))} + holdings ${kb(
      Buffer.byteLength(JSON.stringify(holdingsPayload)),
    )} (funds: ${holdingsPayload.meta.fundCount})`,
  );
}

async function main() {
  const files = await readdir(DATA_DIR);
  const slugs = (process.argv.length > 2 ? process.argv.slice(2) : files
    .filter((name) => /^fund-stock-index-(\d{4}q[1-4])\.json$/.test(name))
    .map((name) => name.match(/(\d{4}q[1-4])/)[1]));

  for (const slug of slugs) {
    await splitQuarter(slug);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
