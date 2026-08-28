# 多股票组合研究 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有“研究”页内交付可保存的多股票组合研究工作台，用当前季度已采集的公开股票持仓明细计算基金的总估算经济暴露，并保留独立两融看板入口。

**Architecture:** Python 生成器在现有单股票展示截断前产出按股票分片的静态组合索引；React 仅在用户选择组合股票后加载 manifest 和所需分片。新的 `src/portfolio` 目录负责本地保存、数据校验、聚合和 UI，`App.tsx` 只负责把它接入已有搜索、路由和基金详情弹层；轻量两融摘要复用既有校验器但不导入 ECharts。

**Tech Stack:** Python 3 标准库、React 19、TypeScript 5、Vite 6、Vitest 4、Node `node:test`、Playwright、现有 ECharts 两融模块（仅完整看板）。

**Spec:** `D:\vcp_hunter\基金持仓\docs\superpowers\specs\2026-08-28-multi-stock-portfolio-research-design.md`

## Global Constraints

- 每个组合仅允许 1–10 只规范且去重的股票；本地保存键固定为 `chuhaiqianyan.portfolio-baskets.v1`。
- “全量组合索引”只覆盖当前季度已采集的公开股票持仓明细行（个别基金源行可超过前十）；对每一只当前可搜索的海外股票，在展示截断前汇总其全部已采集基金边。不得为当前不可搜索的国内代码额外发布无用户入口的组合股票分片。页面必须显示“未出现不代表未持有”，不得暗示完整基金组合或实时仓位。基金详情最多展示 10 条，不能与组合计算覆盖范围混同。
- 不得从 `topByRatio`、`topOnExchangeByRatio`、`topIndirectExposureByRatio` 聚合多股票结果。
- 总估算经济暴露仅为 `ΣdirectRatioPercent + ΣqualifiedIndirectEstimatedRatioPercent`；不得把原始杠杆产品 `ratioPercent` 额外相加。
- 直接边按 `(fundFamilyKey,targetCode)` 去重；间接边按 `(fundFamilyKey,targetCode,sourceCode)` 去重；同一产品不同份额不重复相加，不同产品可相加。直接 `ratioPercent` 与间接 `estimatedRatioPercent` 均必须有限且严格大于 0 才能使基金进入结果。
- 只有有限且大于 0 的杠杆倍数和有限且大于 0 的估算暴露可计入；未映射、反向、零、空或非法倍率只能作为覆盖缺口，不能显示成 0%。每条合格间接边保留原始 `sourceRatioPercent` 仅作来源解释，绝不重复进入合计。
- 两个结果视图必须互斥：`isOnExchangeFund=true` 为场内 ETF / LOF，其余为场外基金（含 ETF 联接）；排序依次为总估算暴露降序、直接暴露降序、基金代码升序。
- 组合数据、组合结果涉及的基金详情和两融摘要均只使用同源相对静态文件；新命中的前十外基金须按需取得真实的最多 10 条详情或显示“详情暂时不可用”的失败状态，绝不把缺失详情伪装成“未持有”。不引入账号、CDN、第三方请求或投资建议。
- 研究页首屏不能下载全部未截断组合边；两融摘要只在组合结果已就绪后懒加载，且不得导入 `LeverageDashboard`、`LeverageChart`、`LeverageControls` 或 ECharts。
- 所有新增操作满足键盘可达、可见焦点、语义化名称、`aria-live`/`role=alert` 状态提示、非颜色唯一编码，以及 24×24 CSS px 最小目标尺寸。
- 不触碰现有用户未跟踪的 `dist-old-backup/`、`optimization-report.md`、`scripts/split_fund_holdings.mjs`；视觉头脑风暴目录 `.superpowers/` 不得进入提交。
- 当前项目规则要求先报告和等待用户测试确认；本计划中的每个“提交”步骤均改为检查精确 diff，禁止自动 commit/push。

---

## File Structure

- Modify: `D:\vcp_hunter\基金持仓\scripts\build_fund_stock_index.py`
  - 在现有展示 Top 10 截断前，从完整已采集披露行构建全局基金家族 profile、组合 manifest/股票分片与按需基金详情分片；原子发布并保留既有单股票产物和间接审计。
- Create: `D:\vcp_hunter\基金持仓\scripts\test_build_fund_portfolio_index.py`
  - 对 Python 端去重、分类、合格间接边、哈希 manifest 和 Q2 13.54% 回归夹具做 `unittest`。
- Create: `D:\vcp_hunter\基金持仓\scripts\verify-portfolio-index.mjs`
  - 对 `public/data` 中发布的组合 manifest 与所有分片做 schema、季度、哈希、去重键和分类静态校验。
- Create: `D:\vcp_hunter\基金持仓\scripts\verify-portfolio-index.test.mjs`
  - 为 Node 验证器提供有效、哈希不符、季度不符和非法边的临时夹具测试。
- Modify: `D:\vcp_hunter\基金持仓\src\fundQuarter.ts`
  - 提供组合 manifest 的季度化同源 URL，不写死当前 Q2。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\types.ts`
  - 组合、存储、manifest、分片、直接/间接边、聚合行和加载状态的共享类型。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\portfolioStorage.ts`
  - 浏览器本地组合读取、校验、写入和失败状态，绝不清理其他 origin 数据。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\portfolioIndex.ts`
  - manifest/分片加载、SHA-256 校验、会话缓存和 abort 安全。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\aggregatePortfolioResults.ts`
  - 纯聚合、直接/间接去重、互斥分类、覆盖提示和稳定排序。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\usePortfolioResearch.ts`
  - 草稿、保存组合、未保存决策、加载生命周期和外部单股票临时状态。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\PortfolioWorkbench.tsx`
  - 组合编辑条、命名操作、结果页签、基金贡献行、错误/空状态和未保存确认对话框。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\portfolio.css`
  - 仅以 `.portfolio-*` 为前缀的桌面/窄屏、表格/卡片和焦点样式。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\__tests__\fixtures.ts`
  - 小型 manifest/分片/基金家族夹具，含多份额、多个杠杆来源、无映射和 Q2 回归数据。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\__tests__\portfolioStorage.test.ts`
  - 存储 schema、损坏恢复、上限与写入失败测试。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\__tests__\aggregatePortfolioResults.test.ts`
  - 聚合、去重、分类、排序和覆盖缺口测试。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\__tests__\portfolioIndex.test.ts`
  - manifest、分片、abort、缓存和任一分片失败时阻断测试。
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\__tests__\PortfolioWorkbench.test.tsx`
  - 保存、页签键盘、未保存确认和无障碍状态测试。
- Create: `D:\vcp_hunter\基金持仓\src\leverage\LeverageMarketSummary.tsx`
  - 研究页的 20 个共同交易日融资余额/上证指数轻量摘要和完整看板链接。
- Create: `D:\vcp_hunter\基金持仓\src\leverage\deriveTwentyDayComparison.ts`
  - 纯函数：从已验证两融记录中筛选共同有效交易日、归一化、计算两项区间变化及其描述性差值。
- Create: `D:\vcp_hunter\基金持仓\src\leverage\leverageMarketSummary.css`
  - 轻量摘要样式，不依赖图表样式或 ECharts。
- Create: `D:\vcp_hunter\基金持仓\src\leverage\__tests__\leverageMarketSummary.test.tsx`
  - 对共同交易日、归一化起点、融资余额/指数变化差及失败降级做单元测试。
- Create: `D:\vcp_hunter\基金持仓\src\leverage\__tests__\deriveTwentyDayComparison.test.ts`
  - 对末尾 20 个共同有效交易日、不足 20 日回退至全部共同区间、零/空指数及不可用输入做纯函数测试。
- Modify: `D:\vcp_hunter\基金持仓\src\App.tsx`
  - 在现有搜索、基金详情和研究结果区域接入组合工作台，保留独立页面路由和旧深链。
- Modify: `D:\vcp_hunter\基金持仓\src\styles.css`
  - 仅放置 App 容器级布局钩子；组合具体样式放到 `portfolio.css`。
- Modify: `D:\vcp_hunter\基金持仓\src\leverage\__tests__\appNavigation.test.tsx`
  - 守住 `/leverage` 不请求基金/组合数据，以及研究页首屏不导入完整两融图表。
- Modify: `D:\vcp_hunter\基金持仓\scripts\qa-research-browser.mjs`
  - 增加组合创建、10 只上限、场内/场外切换、保存恢复、窄屏和无横向溢出的真实浏览器 QA。
- Modify: `D:\vcp_hunter\基金持仓\package.json`
  - 增加 `test:portfolio`、`verify:portfolio`，并将组合测试纳入可重复命令。
- Modify: `D:\vcp_hunter\基金持仓\scripts\build_seo_pages.mjs`
  - 使生产构建前校验当前季度组合 manifest/分片，并把 releaseId、manifest 路径和哈希摘要写入季度发布检查文件。
- Modify: `D:\vcp_hunter\基金持仓\scripts\preflight-2026q2-release.mjs`
  - 对当前季度组合发布包执行同样的本地存在性、报告期和校验结果检查。
- Modify: `D:\vcp_hunter\基金持仓\scripts\verify-live-release.mjs`
  - 对线上 manifest 和其引用的组合分片执行可达性与 SHA-256 校验，不把首页可访问误当成组合数据已发布。
- Modify: `D:\vcp_hunter\基金持仓\public\_headers`
  - 为季度组合 manifest/分片配置与既有基金索引一致的缓存策略。
- Modify: `D:\vcp_hunter\基金持仓\README.md`
  - 记录组合功能、已采集公开股票明细覆盖边界、基金详情前十显示上限、计算公式、更新命令与非投资建议。
- Modify: `D:\vcp_hunter\基金持仓\.gitignore`
  - 忽略由视觉头脑风暴生成的 `.superpowers/`，不影响已有用户文件。
- Create after generator validation: `D:\vcp_hunter\基金持仓\public\data\fund-portfolio-index-2026q2.manifest.json` and `D:\vcp_hunter\基金持仓\public\data\fund-portfolio-index-2026q2\*.json`
  - 仅由生成器原子写入，不能手工编辑。
- Create after generator validation: `D:\vcp_hunter\基金持仓\public\data\fund-portfolio-index-2026q2\<release-id>\fund-details\*.json`
  - 由同一 portfolio manifest 引用、按基金家族哈希前缀分片，仅在用户打开新的组合结果基金详情时按需加载；每个基金家族最多 10 条公开持仓详情。

## Shared Interfaces

```ts
export type PortfolioView = "offExchange" | "onExchange";

export interface SavedBasket {
  id: string;
  name: string;
  stockCodes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioStoreV1 {
  schemaVersion: 1;
  activeBasketId: string | null;
  baskets: SavedBasket[];
}

export type PortfolioStorageReadResult =
  | { kind: "ready"; store: PortfolioStoreV1 }
  | { kind: "recovered"; store: PortfolioStoreV1; reason: string }
  | { kind: "unavailable"; store: PortfolioStoreV1; reason: string };

export type PortfolioStorageWriteResult = { ok: true } | { ok: false; reason: string };

export interface FundFamilyProfile {
  fundFamilyKey: string;
  fundCode: string;
  fundName: string;
  fundDisplayName: string;
  fundType: string;
  fundVariantCodes: string[];
  isOnExchangeFund: boolean;
  view: PortfolioView;
  detailShardKey: string;
}

export interface DirectEdge {
  fundFamilyKey: string;
  targetCode: string;
  targetName: string;
  ratioPercent: number;
  isOnExchangeFund: boolean;
}

export interface QualifiedIndirectEdge {
  fundFamilyKey: string;
  targetCode: string;
  targetName: string;
  sourceCode: string;
  sourceName: string;
  sourceRatioPercent: number;
  leverageMultiple: number;
  estimatedRatioPercent: number;
  matchReason: string;
  isOnExchangeFund: boolean;
}

export interface PortfolioFundHoldingDetail {
  rank?: number;
  stockCode: string;
  stockName: string;
  ratioPercent: number;
  marketValueWan?: number | null;
  sharesWan?: number;
}

export interface PortfolioDetailShard {
  schemaVersion: "1";
  releaseId: string;
  report: string;
  cutoffDate: string;
  generatedAt: string;
  fundFamilyKeyHashPrefix: string;
  fundDetails: Record<string, {
    fundFamilyKey: string;
    detailStatus: "available" | "not_captured_in_current_stock_detail_rows";
    detailFundCode?: string;
    detailMessage?: string;
    holdings?: PortfolioFundHoldingDetail[];
  }>;
  integrity: { algorithm: "SHA-256"; encoding: "UTF-8" };
}

export interface PortfolioShard {
  schemaVersion: "1";
  releaseId: string;
  report: string;
  cutoffDate: string;
  generatedAt: string;
  stock: { code: string; name: string };
  fundProfiles: Record<string, FundFamilyProfile>;
  directEdges: DirectEdge[];
  indirectEdges: QualifiedIndirectEdge[];
  coverage: Record<string, unknown>;
  integrity: { algorithm: "SHA-256"; encoding: "UTF-8" };
}

export interface PortfolioManifest {
  schemaVersion: "1";
  releaseId: string;
  report: string;
  cutoffDate: string;
  generatedAt: string;
  builderVersion: string;
  fundFamilyRuleVersion: string;
  viewClassificationRuleVersion: string;
  publishStatus: "complete";
  inputHoldingRows: number;
  source: string;
  sourceFile: string;
  fundInvestmentSourceFile: string;
  fundInvestmentSourceRows: number;
  disclosure: string;
  auditPath: string;
  fundDetailShardRule: string;
  fundDetailDisplayLimit: 10;
  coverage: Record<string, number | string | Record<string, number>>;
  shards: Record<string, {
    path: string;
    sha256: string;
    directEdgeCount: number;
    qualifiedIndirectEdgeCount: number;
  }>;
  fundDetailShards: Record<string, {
    path: string;
    sha256: string;
    fundFamilyCount: number;
  }>;
}

export interface AggregatedFundResult extends FundFamilyProfile {
  view: PortfolioView;
  directRatioPercent: number;
  indirectEstimatedRatioPercent: number;
  totalEstimatedExposurePercent: number;
  contributions: Array<{
    targetCode: string;
    targetName: string;
    directRatioPercent: number;
    indirectEstimatedRatioPercent: number;
    indirectSources: QualifiedIndirectEdge[];
  }>;
}
```

```ts
export function aggregatePortfolioResults(input: {
  selectedStockCodes: string[];
  shards: PortfolioShard[];
}): Record<PortfolioView, AggregatedFundResult[]>;

export function loadPortfolioIndex(input: {
  manifestUrl: string;
  selectedStockCodes: string[];
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<{ manifest: PortfolioManifest; shards: PortfolioShard[] }>;

export function loadPortfolioFundDetails(input: {
  manifest: PortfolioManifest;
  fundFamilyKey: string;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<PortfolioFundHoldingDetail[]>;

export function readPortfolioStore(storage: Storage, validStockCodes: Set<string>): PortfolioStorageReadResult;
export function writePortfolioStore(storage: Storage, store: PortfolioStoreV1): PortfolioStorageWriteResult;
```

---

### Task 1: 生成截断前的组合 manifest 与股票分片

**Files:**

- Modify: `D:\vcp_hunter\基金持仓\scripts\build_fund_stock_index.py:953-1295`
- Create: `D:\vcp_hunter\基金持仓\scripts\test_build_fund_portfolio_index.py`

**Interfaces:**

- Consumes: `stock_rows`、`stock_funds`、原始间接候选记录、`fund_family_key()`、`better_record()`、`better_indirect_exposure_record()`。
- Produces: `build_portfolio_release(...) -> tuple[manifest, dict[canonicalCode, shard]]` and `write_portfolio_release(manifest, shards) -> None`.

- [ ] **Step 1: 编写失败的 Python 端数据契约测试**

在 `scripts/test_build_fund_portfolio_index.py` 创建最小内存基金记录，覆盖两个份额、两个不同 `sourceCode`、一个非法 0 倍率和两个视图：

```python
def test_portfolio_release_dedupes_share_classes_and_keeps_distinct_sources(self):
    manifest, shards = build_portfolio_release(
        report="2026Q2",
        generated_at="2026-08-28T00:00:00+08:00",
        stock_rows={"000660": {"name": "SK海力士"}},
        direct_funds={"000660": [fund("A", 0.042), fund("C", 0.039)]},
        indirect_candidates={"000660": [indirect("A", "SOXL", 0.0974), indirect("C", "SOXL", 0.0974), indirect("A", "NVDL", 0.038)]},
    )
    shard = shards["000660"]
    self.assertEqual(len(shard["directEdges"]), 1)
    self.assertEqual(len(shard["indirectEdges"]), 2)
    self.assertEqual(sum(edge["estimatedRatioPercent"] for edge in shard["indirectEdges"]), 13.54)
    self.assertEqual(shard["directEdges"][0]["isOnExchangeFund"], False)
```

再添加无效间接边不出现、负/零直接边不入结果、ETF 联接归场外、manifest 哈希和分片路径稳定的测试。fixture 至少覆盖同一 `fundFamilyKey` 跨两只股票时 profile 的代码、名称、份额列表和场内属性完全一致；间接边保留 `sourceRatioPercent` 但该字段不进入合计；模拟某分片写入或发布前校验失败时旧 manifest 字节不变、新 releaseId 不被引用。

- [ ] **Step 2: 运行测试确认当前实现缺少组合生成器**

Run: `python scripts/test_build_fund_portfolio_index.py -v`

Expected: FAIL，提示 `build_portfolio_release` 尚不存在或断言不满足。

- [ ] **Step 3: 抽取全量边并实现组合发布函数**

保留 `unique_fund_families(..., limit=10)` 的现有展示语义；新增不带展示截断的家族归并函数，并在写任何股票分片前完成全局 `fundFamilyKey -> canonical profile` 注册表，确保跨分片使用同一显示代码/名称/份额列表/分类。将间接候选从现有按 `fundCode` 的 legacy 展示字典旁路保存为以 `(fundFamilyKey, targetCode, sourceCode)` 为键的候选集合，再生成组合分片：

```python
def portfolio_view_for(fund: dict[str, Any]) -> str:
    return "onExchange" if is_on_exchange_fund(fund) else "offExchange"

def eligible_indirect_edge(fund: dict[str, Any]) -> bool:
    multiplier = fund.get("leverageMultiple")
    estimated = fund.get("estimatedRatioPercent")
    return (
        isinstance(multiplier, (int, float)) and math.isfinite(multiplier) and multiplier > 0
        and isinstance(estimated, (int, float)) and math.isfinite(estimated)
    )
```

每个分片引用以 `fundFamilyKey` 为键的规范家族 profile，再让直接/间接边只引用该键；每个直接边写入 `targetCode`、`targetName`、有限且严格为正的 `ratioPercent`，每个合格间接边写入来源产品、原始 `sourceRatioPercent`（只作展示）、倍率、有限且严格为正的估算值和匹配原因。manifest 记录分片相对路径、SHA-256、边数、构建器/家族/分类规则版本、输入行数、完整发布状态、数据来源/已采集公开股票明细覆盖披露、基金详情前十显示上限、全局未映射统计与审计文件相对路径及固定提示。为可命中全量组合的基金家族另建 hash-prefix 详情分片，保留每个家族最多十条真实公开持仓，并在 manifest 中列出详情分片规则、路径、哈希和数目。使用临时文件后 `replace()` 原子落盘；不修改既有主索引/明细文件的字段语义。

- [ ] **Step 4: 在 `main()` 中生成并发布季度分片**

在写入 `TARGET_JSON` 与旧 `fund-holdings` 后调用 `write_portfolio_release`，使用当前 `REPORT` 的小写 slug 创建：

```python
manifest_path = TARGET_JSON.with_name(f"fund-portfolio-index-{REPORT.lower()}.manifest.json")
chunk_root = TARGET_JSON.parent / f"fund-portfolio-index-{REPORT.lower()}"
release_id = build_portfolio_release_id(REPORT, generated_at, manifest)
write_portfolio_release(manifest_path, chunk_root / release_id, release_id, manifest, shards)
```

构建失败时在替换目标前清理本次临时文件并抛出；不得留下可被 manifest 引用的半成品分片。每次成功构建生成不可变 `releaseId`，先写入 `fund-portfolio-index-<quarter>/<releaseId>/` 和同 releaseId 的基金详情分片、完成全体分片 hash/契约验证，最后才替换季度 manifest；旧 release 目录不在本任务中删除。

- [ ] **Step 5: 运行 Python 契约测试和当前季度生成器**

Run: `python scripts/test_build_fund_portfolio_index.py -v`
Expected: PASS。

Run: `python scripts/build_fund_stock_index.py`
Expected: 输出既有主索引、基金明细、间接审计和新的 `fund-portfolio-index-2026q2.manifest.json`；已有主索引的 JSON 仍可被前端解析。

- [ ] **Step 6: 检查精确 diff，不提交**

Run: `git diff --check` and `git status --short`。

Expected: 只出现本任务的生成器、测试和由生成器维护的组合静态文件；保留并排除既有用户未跟踪文件。

### Task 2: 为发布组合索引增加 Node 验证器、命令与缓存规则

**Files:**

- Create: `D:\vcp_hunter\基金持仓\scripts\verify-portfolio-index.mjs`
- Create: `D:\vcp_hunter\基金持仓\scripts\verify-portfolio-index.test.mjs`
- Modify: `D:\vcp_hunter\基金持仓\package.json`
- Modify: `D:\vcp_hunter\基金持仓\public\_headers`
- Modify: `D:\vcp_hunter\基金持仓\scripts\build_seo_pages.mjs`
- Modify: `D:\vcp_hunter\基金持仓\scripts\preflight-2026q2-release.mjs`
- Modify: `D:\vcp_hunter\基金持仓\scripts\verify-live-release.mjs`

**Interfaces:**

- Consumes: Task 1 manifest/股票分片/基金详情分片、Node `crypto.createHash("sha256")`。
- Produces: `verifyPortfolioRelease({ publicDataDir, report }) -> { ok, reason, checkedShards }` and CLI exit code 0/1.

- [ ] **Step 1: 写出验证器的失败夹具**

在 `verify-portfolio-index.test.mjs` 用临时目录写入 manifest/股票分片/基金详情分片，检查正常包、哈希篡改、`report` 不一致、重复去重键、缺失必填发布字段、非法正值与详情分片不匹配：

```js
const result = await verifyPortfolioRelease({ publicDataDir: tempDataDir, report: "2026Q2" });
assert.equal(result.ok, true);
await writeFile(chunkPath, '{"tampered":true}', "utf8");
assert.equal((await verifyPortfolioRelease({ publicDataDir: tempDataDir, report: "2026Q2" })).ok, false);
```

- [ ] **Step 2: 运行 Node 测试确认验证器尚不存在**

Run: `node --test scripts/verify-portfolio-index.test.mjs`

Expected: FAIL，提示找不到 `verify-portfolio-index.mjs` 或导出函数。

- [ ] **Step 3: 实现发布包静态校验**

验证器必须：读取 manifest；校验 `schemaVersion === "1"`、不可变 releaseId、报告季度/截止日/生成时间、构建器/家族/分类规则版本、发布状态、输入行数、来源与披露、全局间接覆盖摘要/审计路径和固定未映射提示；逐一读取 manifest 中声明的股票与基金详情分片；按字节算 SHA-256；确认边的目标代码与所在分片一致、直接/间接 key 不重复、直接与间接数值严格为正且有限、间接倍率严格为正且有限、`sourceRatioPercent` 仅作来源字段、`isOnExchangeFund` 为 boolean、跨分片 profile 与 detailShardKey 一致。对任一失败输出中文可识别原因并返回失败，不进行静默跳过。

- [ ] **Step 4: 接入命令与缓存头**

在 `package.json` 添加：

```json
"test:portfolio": "python scripts/test_build_fund_portfolio_index.py -v && node --test scripts/verify-portfolio-index.test.mjs && vitest run src/portfolio/__tests__",
"verify:portfolio": "node scripts/verify-portfolio-index.mjs"
```

在 `public/_headers` 添加：

```text
/data/fund-portfolio-index-*.manifest.json
  Cache-Control: no-cache

/data/fund-portfolio-index-:quarter/*
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400
```

同时让 `build_seo_pages.mjs` 在生成 `public/seo/quarter-release-check.json` 前调用 `verifyPortfolioRelease`，把当前 `report`、`releaseId`、manifest SHA-256、股票分片数和详情分片数写入检查文件；`preflight-2026q2-release.mjs` 和 `verify-live-release.mjs` 读取同一字段并分别校验本地/线上 manifest 与实际分片。线上校验必须对 manifest 中至少一个股票分片、一个详情分片和全部 manifest SHA-256 声明进行验证，避免只验证首页；同时断言线上 manifest 为 `no-cache`，不可变 release 分片具备预期长期缓存策略。

- [ ] **Step 5: 验证当前季度发布包**

Run: `npm run test:portfolio`
Expected: 当前 Python/Node 前半段 PASS；Vitest 在 Task 3/4 添加前可先仅执行指定 Python/Node 命令。

Run: `npm run verify:portfolio`
Expected: PASS，输出检查的 `2026Q2` 分片数与 manifest 路径。

- [ ] **Step 6: 检查精确 diff，不提交**

Run: `git diff --check` and `git status --short`。

Expected: 不包含 `.superpowers/` 或用户原有未跟踪文件。

### Task 3: 建立组合类型和浏览器本地存储契约

**Files:**

- Create: `D:\vcp_hunter\基金持仓\src\portfolio\types.ts`
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\portfolioStorage.ts`
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\__tests__\fixtures.ts`
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\__tests__\portfolioStorage.test.ts`

**Interfaces:**

- Consumes: canonical stock code set from `FundStockIndex.stocks`.
- Produces: `PortfolioStoreV1`, `SavedBasket`, `PortfolioStorageReadResult`, `readPortfolioStore`, `writePortfolioStore`, `validateBasketDraft`.

- [ ] **Step 1: 写本地存储失败测试**

覆盖空存储、合法已保存组合、重复代码、11 只、空名称、同名要求显式覆盖、损坏 JSON、已失效股票代码、单条非法组合与 `setItem` 抛出异常。单条坏记录不得拖垮其它合法组合，active id 指向坏记录时必须回退到保留组合或空草稿，并返回可理解的隔离提示：

```ts
it("损坏 localStorage 只隔离组合键且保留可用空草稿", () => {
  storage.setItem(PORTFOLIO_STORAGE_KEY, "{");
  const result = readPortfolioStore(storage, new Set(["NVDA"]));
  expect(result.kind).toBe("recovered");
  expect(result.store.baskets).toEqual([]);
});

it("拒绝第 11 只股票", () => {
  expect(validateBasketDraft({ name: "AI", stockCodes: elevenCodes }, validCodes).ok).toBe(false);
});
```

- [ ] **Step 2: 运行测试确认模块尚不存在**

Run: `npx vitest run src/portfolio/__tests__/portfolioStorage.test.ts`

Expected: FAIL，提示找不到 `portfolioStorage`。

- [ ] **Step 3: 实现版本化存储与校验**

在 `types.ts` 固定 `schemaVersion: 1`、ISO 时间、`id/name/stockCodes/createdAt/updatedAt`。`readPortfolioStore` 只能读取 `chuhaiqianyan.portfolio-baskets.v1`，逐项隔离非法基金代码/组合但保留合法 basket，并返回 `ready | recovered | unavailable` 及可理解的恢复原因；`writePortfolioStore` 捕获 `SecurityError`/`QuotaExceededError` 并返回 `{ ok: false, reason }`，不执行 `clear()`/`removeItem()` 于其他键。相同名称只能在调用方明确传入覆盖意图时替换。

- [ ] **Step 4: 运行存储测试和 TypeScript 检查**

Run: `npx vitest run src/portfolio/__tests__/portfolioStorage.test.ts && npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 5: 检查精确 diff，不提交**

Run: `git diff --check` and `git status --short`。

Expected: 只出现 `src/portfolio` 本任务文件与已批准数据产物。

### Task 4: 实现组合分片加载与纯聚合

**Files:**

- Create: `D:\vcp_hunter\基金持仓\src\portfolio\portfolioIndex.ts`
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\aggregatePortfolioResults.ts`
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\__tests__\portfolioIndex.test.ts`
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\__tests__\aggregatePortfolioResults.test.ts`
- Modify: `D:\vcp_hunter\基金持仓\src\fundQuarter.ts`

**Interfaces:**

- Consumes: Task 1 manifest/股票分片/按需详情分片 and Task 3 type definitions.
- Produces: `loadPortfolioIndex`, `loadPortfolioFundDetails`, `validatePortfolioManifest`, `validatePortfolioShard`, `validatePortfolioDetailShard`, `aggregatePortfolioResults` and a typed selected-coverage result.

The loader consumes the actual Task 1 wire schema rather than a permissive approximation: all coverage fields have explicit interfaces; holding `rank` is a required positive integer; and detail records are a discriminated union. `available` requires `detailFundCode` plus 1–10 holdings; `not_captured_in_current_stock_detail_rows` requires its explicit message and cannot be converted to an empty holdings array. `loadPortfolioFundDetails` therefore returns that union and receives `manifestUrl` (or an equivalent resolved data base) as well as the manifest, so it never hardcodes a different release base.

- [ ] **Step 1: 写分片加载和聚合失败测试**

覆盖 00700 的第 11 名命中、直接+间接相加、同来源不同份额去重、不同来源累计、0/空倍率与负/零直接或估算排除、互斥分类、同分稳定排序、一个分片失败不返回部分结果、abort 不提交旧响应和缓存命中，以及前十外基金从 hash-prefix 详情分片取得最多十条真实详情：

```ts
it("把同一基金的直接与两条不同来源的合格间接暴露相加", () => {
  const result = aggregatePortfolioResults({ selectedStockCodes: ["000660", "005930"], shards });
  const fund = result.offExchange[0];
  expect(fund.indirectEstimatedRatioPercent).toBeCloseTo(13.54, 2);
  expect(fund.totalEstimatedExposurePercent).toBeCloseTo(
    fund.directRatioPercent + 13.54,
    2,
  );
});

it("任一分片 HTTP 失败时阻断且不交付部分数组", async () => {
  await expect(loadPortfolioIndex({ manifestUrl, selectedStockCodes: ["NVDA", "TSM"], signal, fetchImpl })).rejects.toThrow("组合数据分片");
});
```

- [ ] **Step 2: 运行测试确认函数尚不存在**

Run: `npx vitest run src/portfolio/__tests__/portfolioIndex.test.ts src/portfolio/__tests__/aggregatePortfolioResults.test.ts`

Expected: FAIL，提示找不到加载器/聚合器。

- [ ] **Step 3: 实现 URL、校验、缓存和 abort 语义**

扩展 `fundQuarter`：

```ts
portfolioManifestUrl: `/data/fund-portfolio-index-${slug}.manifest.json?v=${slug}`
```

`portfolioIndex.ts` 先 fetch manifest，再只 fetch选股对应分片；所有 fetch 使用 `{ cache: "no-cache", signal }`，manifest 每次重新读取，股票与详情分片仅在已通过原始 UTF-8 `ArrayBuffer` SHA-256、schema 和 release 校验后以内存键 `{resolvedDataBase, releaseId, sha256, codeOrPrefix}` 缓存。每个 response、JSON、schema、releaseId、report、精确 path、coverage、跨已选分片 profile 和 SHA-256 都校验；股票代码不能用过严正则（当前可含 `BP.`、`RR.`），只允许 manifest 精确声明的代码与路径。任何所选股票片失败抛出包含股票代码的中文错误，且不交付部分数组；详情片失败只能让该基金详情显示暂时不可用，不能伪造成“暂无持仓”。`AbortError` 原样取消，且在 fetch、hash、parse、校验、写缓存前均检查 signal，不将旧数据写入状态。

- [ ] **Step 4: 实现聚合与稳定排序**

使用 `Map<fundFamilyKey, MutableAggregate>`，先把有限且严格正的直接边按 `(family,target)` 去重，再把有限且严格正的合格间接边按 `(family,target,source)` 去重。发布包正常时重复键本应已被拒绝；纯函数仍以确定的代表记录防御性去重。`sourceRatioPercent` 只作为来源展示，合计只累加直接 `ratioPercent` 与间接 `estimatedRatioPercent`。聚合为每只选股建立贡献明细，并返回已选分片的排除/未映射覆盖标记；视图由 profile 的 `isOnExchangeFund` 一次决定；只要总直接和间接均不为正则不入结果。排序必须显式比较：

```ts
rows.sort((left, right) =>
  right.totalEstimatedExposurePercent - left.totalEstimatedExposurePercent ||
  right.directRatioPercent - left.directRatioPercent ||
  left.fundCode.localeCompare(right.fundCode, "en"),
);
```

- [ ] **Step 5: 运行纯逻辑测试**

Run: `npx vitest run src/portfolio/__tests__/portfolioIndex.test.ts src/portfolio/__tests__/aggregatePortfolioResults.test.ts && npx tsc --noEmit`

Expected: PASS，包括 Q2 `13.54%` 回归与任一分片阻断场景。

- [ ] **Step 6: 检查精确 diff，不提交**

Run: `git diff --check` and `git status --short`。

Expected: 没有把旧 `top*` 数组作为组合输入的实现或测试。

### Task 5: 实现组合研究 hook、工作台与研究页接入

**Files:**

- Create: `D:\vcp_hunter\基金持仓\src\portfolio\usePortfolioResearch.ts`
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\PortfolioWorkbench.tsx`
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\portfolio.css`
- Create: `D:\vcp_hunter\基金持仓\src\portfolio\__tests__\PortfolioWorkbench.test.tsx`
- Modify: `D:\vcp_hunter\基金持仓\src\App.tsx:15-25,1469-1734,1858-2163`
- Modify: `D:\vcp_hunter\基金持仓\src\styles.css`

**Interfaces:**

- Consumes: Tasks 3–4 types/storage/loader/aggregator; existing `FundDetailsTarget`, `onHoverFund`, `onOpenFund`, `appPagePath`.
- Produces: `usePortfolioResearch` model and `PortfolioWorkbench` mounted at the existing research results panel.

- [ ] **Step 1: 写组件交互与无障碍失败测试**

测试应覆盖：从搜索结果加入临时单股票组合、添加/移除标签、10 只上限、保存/刷新恢复、切换/删除/离开研究页时的未保存草稿焦点陷阱对话框、场内/场外页签的 ArrowLeft/ArrowRight/Home/End、基金详情（含前十外基金详情按需加载与失败状态）、结果阻断状态和完整排序后的“加载更多”：

```tsx
it("页签键盘切换并保持互斥结果", async () => {
  render(<PortfolioWorkbench {...props} />);
  const offExchange = screen.getByRole("tab", { name: "场外基金" });
  offExchange.focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "场内 ETF / LOF" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("场内");
});
```

- [ ] **Step 2: 运行组件测试确认工作台尚不存在**

Run: `npx vitest run src/portfolio/__tests__/PortfolioWorkbench.test.tsx`

Expected: FAIL，提示找不到组件或 hook。

- [ ] **Step 3: 实现 hook 的草稿、保存和请求生命周期**

`usePortfolioResearch` 持有规范代码数组而非复制 `StockRecord`；在 `selectedCode`/搜索/热点选择时把该代码作为临时单股票草稿输入。它暴露 `addStock`、`removeStock`、`saveActive`、`saveAs`、`renameActive`、`requestSwitch`、`resolveUnsavedDecision`、`requestDelete`、`requestLeave`、`retry`，并以请求 token/`AbortController` 忽略快速选股后的迟到响应。对应用内导航采用保存/放弃/取消确认；对刷新/关闭挂接标准 `beforeunload` 提示（浏览器不允许自定义三按钮时保留原生取消保护）。localStorage 不可用时仍允许即时研究，保存按钮给出 `aria-live` 中文说明。

- [ ] **Step 4: 实现工作台与最小接入**

在 `App.tsx` 保留搜索 combobox、`chooseStock()`、`FundDetailsTarget` 和现有详情弹层；把旧 `top*` 结果分支替换为 `PortfolioWorkbench`。该组件要：

- 使用真实 `<button>`、`tablist/tab/tabpanel` 和可聚焦结果标题；
- 每个基金行显示直接、间接估算、总估算经济暴露与按股票的贡献标签；
- 先对完整命中集聚合、分类和排序，再每次显示固定页大小（建议 50 条）并提供“加载更多”；不得对可见子集重新排序；
- 常驻显示数据季度、已采集公开股票明细覆盖边界、基金详情前十显示上限、“未出现不代表未持有”、公式和非投资建议；
- 在 320/390px 用可读的基金卡片或有说明的横向结果容器，不靠不可读的缩小字号；
- 复用既有 `FundHoldingsHoverCard`、焦点恢复和 `onHoverFund/onOpenFund` 交互；旧行继续读取既有 `fund-holdings`，新的组合前十外基金通过 Task 4 的同源详情分片按需加载。详情请求失败显示“详情暂时不可用”与重试，而不是“该基金暂无持仓记录”；
- 在无选股、无命中、分片阻断、未映射覆盖提示和保存失败时分别显示语义正确的状态。

在 `PortfolioWorkbench.tsx` 顶部导入 `./portfolio.css`，新增样式只能使用 `.portfolio-*` 前缀。未保存确认复用现有可聚焦元素/恢复焦点模式，Esc 等同取消。

- [ ] **Step 5: 运行组件、导航和 TypeScript 测试**

Run: `npx vitest run src/portfolio/__tests__/PortfolioWorkbench.test.tsx src/leverage/__tests__/appNavigation.test.tsx && npx tsc --noEmit`

Expected: PASS；`/leverage` 仍不读取基金/组合数据，研究页原有搜索/详情测试仍通过。

- [ ] **Step 6: 检查精确 diff，不提交**

Run: `git diff --check` and `git status --short`。

Expected: `App.tsx` 改动只涉及研究页组合挂载、导入和被替代的展示分支；不重构无关反馈、方法论或完整两融页面。

### Task 6: 加入 20 日两融市场环境摘要、披露与文档

**Files:**

- Create: `D:\vcp_hunter\基金持仓\src\leverage\LeverageMarketSummary.tsx`
- Create: `D:\vcp_hunter\基金持仓\src\leverage\deriveTwentyDayComparison.ts`
- Create: `D:\vcp_hunter\基金持仓\src\leverage\leverageMarketSummary.css`
- Create: `D:\vcp_hunter\基金持仓\src\leverage\__tests__\leverageMarketSummary.test.tsx`
- Create: `D:\vcp_hunter\基金持仓\src\leverage\__tests__\deriveTwentyDayComparison.test.ts`
- Modify: `D:\vcp_hunter\基金持仓\src\App.tsx`
- Modify: `D:\vcp_hunter\基金持仓\README.md`
- Modify: `D:\vcp_hunter\基金持仓\.gitignore`

**Interfaces:**

- Consumes: existing `loadLeveragePackage`, `validateLeveragePackage`, `LeverageLoadLifecycle`, `LeverageRecord`, `appPagePath("leverage")`; Task 5 的组合结果 `ready` 状态。
- Produces: `LeverageMarketSummary`，只在组合有结果后挂载，显示 20 个共同交易日的融资余额与上证指数描述性变化。

- [ ] **Step 1: 写轻量摘要的失败测试**

用 21 条以上、末尾缺指数、两条至 19 条共同日、少于两条共同日的 `LeverageRecord` fixture 校验“最后 20 个共同有效交易日”、归一化起点、变化、差值、日期不足 20 日回退至全部共同区间、包失败和完整看板链接：

```tsx
expect(deriveMarketComparison(records)).toEqual({
  startDate: "2026-07-01",
  endDate: "2026-07-28",
  marginChangePercent: 4.2,
  indexChangePercent: 1.1,
  relativeDifferencePercent: 3.1,
});
```

- [ ] **Step 2: 运行测试确认摘要模块尚不存在**

Run: `npx vitest run src/leverage/__tests__/deriveTwentyDayComparison.test.ts src/leverage/__tests__/leverageMarketSummary.test.tsx`

Expected: FAIL，提示模块或 `deriveMarketComparison` 尚不存在。

- [ ] **Step 3: 实现无图表的摘要模块**

在 `deriveTwentyDayComparison.ts` 从记录中筛选融资余额为有限非负、`index_000001_close` 为有限正数的共同交易日，取最后 20 条；不足 20 条时使用全部共同区间。至少两条共同日才给出比较，否则返回不可用状态。两条序列均以起点为 100 计算；“变化”是归一化末值减 100，“差值”是前者减后者，单位为百分点：

```ts
const marginChangePercent = ((end.total_margin_yi / start.total_margin_yi) - 1) * 100;
const indexChangePercent = ((end.index_000001_close / start.index_000001_close) - 1) * 100;
const relativeDifferencePercent = marginChangePercent - indexChangePercent;
```

组件只复用 `loadLeveragePackage` 和验证器，不导入 `LeverageDashboard`、`LeverageChart`、`LeverageControls` 或 ECharts，也不修改既有完整两融看板。加载/校验失败仅显示“市场环境摘要暂不可用”与 `/leverage` 链接；不阻断基金结果。卡片显示起止日期、两项变化、描述性差值和“不能据此推断与所选股票的因果关系”。

- [ ] **Step 4: 在组合结果 ready 后懒挂载摘要**

使用 `lazy(() => import("./leverage/LeverageMarketSummary"))` 或只在 `PortfolioWorkbench` 有已排序结果时渲染，使研究页首屏仍不发起两融数据请求、不下载图表 chunk。链接使用 `appPagePath("leverage")`，不修改完整两融路由。

- [ ] **Step 5: 更新 README 与 Git 忽略规则**

README 增加组合工作台说明、10 只上限、局部浏览器保存、两个互斥分类、直接/间接公式、已采集公开股票明细覆盖边界、基金详情前十显示上限、`未出现不代表未持有`、`npm run test:portfolio`、`npm run verify:portfolio` 和两融摘要非因果说明。`.gitignore` 只增加：

```gitignore
.superpowers/
```

- [ ] **Step 6: 运行摘要、导航和构建验证**

Run: `npx vitest run src/leverage/__tests__/deriveTwentyDayComparison.test.ts src/leverage/__tests__/leverageMarketSummary.test.tsx src/leverage/__tests__/appNavigation.test.tsx && npm run build`

Expected: PASS；构建产物中研究页初始主 chunk 不含 ECharts/`LeverageDashboard`，且摘要失败不会阻断研究页。

- [ ] **Step 7: 检查精确 diff，不提交**

Run: `git diff --check` and `git status --short`。

Expected: 只增加组合功能、轻量摘要、文档和 `.superpowers/` 忽略规则。

### Task 7: 端到端 QA、规格逐条审计与最终验证

**Files:**

- Modify: `D:\vcp_hunter\基金持仓\scripts\qa-research-browser.mjs`
- Modify: `D:\vcp_hunter\基金持仓\src\leverage\__tests__\appNavigation.test.tsx`
- Modify: `D:\vcp_hunter\基金持仓\docs\superpowers\specs\2026-08-28-multi-stock-portfolio-research-design.md` only if a verified implementation detail requires an accuracy correction; otherwise leave unchanged.

**Interfaces:**

- Consumes: completed Tasks 1–6 and current static `2026Q2` release.
- Produces: repeatable browser proof and a spec-to-implementation conformance checklist in the final report.

- [ ] **Step 1: 扩展真实浏览器 QA 场景**

在 `qa-research-browser.mjs` 使用本机临时构建/静态服务器加入以下断言：

```js
await page.getByRole("button", { name: /添加到组合/ }).click();
await expect(page.getByText(/1\s*\/\s*10/)).toBeVisible();
await page.getByRole("tab", { name: "场内 ETF / LOF" }).click();
await assertNoPageOverflow(page, "390px 组合结果");
```

覆盖：键盘添加股票、10 只上限、命名保存后 reload 恢复、切换/删除/应用内离开研究页的保存-放弃-取消确认与刷新关闭原生保护、两个互斥页签、完整排序后加载更多、旧与前十外组合基金的详情打开/关闭焦点恢复、详情分片失败显示暂不可用、选中分片阻断不显示部分值、两融摘要链接、1440/390/320/768 无页面横向溢出、无外部请求、研究页首屏不请求两融数据或 ECharts。

对所有新 `.portfolio-*` 交互元素以计算样式断言可见 focus indicator、最小 24×24 CSS px；对状态、覆盖限制、估算和错误分别断言含可读文本或图标/ARIA 名称，不能只靠颜色。复核新增普通文本颜色与其背景达到 WCAG 2.2 AA 对比度基线，并在 QA 报告中记录计算值与选择器。

- [ ] **Step 2: 运行新增 QA 以确认失败点可被捕获**

Run: `npm run qa:research`

Expected: 在 QA 断言尚未与新 DOM 对齐前 FAIL；失败信息精确指出缺失的角色、文案或布局问题。

- [ ] **Step 3: 最小修复 UI 或 QA 选择器并使端到端场景通过**

修复必须优先调整新增 `.portfolio-*` 组件或明确的稳定 ARIA 标签；不得降低断言、跳过移动端、允许部分结果或放宽外部请求检查来取得通过。

- [ ] **Step 4: 执行完整验证矩阵**

Run in order:

```text
npm run test:portfolio
npm run verify:portfolio
npm run test:leverage
npm run qa:research
npm run qa:leverage
npm run build
npm run verify-stock-deeplinks
git diff --check
git status --short
```

Expected: 全部 PASS；`verify:portfolio` 验证当前季度 manifest/全部分片；旧两融和深链不回归；工作树只包含本功能预期文件与用户原有未跟踪项。

- [ ] **Step 5: 对照规格逐条审计，不提交**

逐项核对规格第 1–10 节：入口、10 只限制、localStorage、互斥分类、全量（相对当前已采集公开股票明细）索引、跨分片统一家族 profile、真实详情按需加载、直接/间接公式和去重、未映射边界、稳定排序和渐进呈现、两融 20 日摘要、失败状态、键盘/窄屏/性能、免责声明和非目标。记录每一项的实现文件和通过命令；若任意项缺失，回到对应任务补齐后重跑相关测试。完成后向用户报告，等待用户实际测试确认，再依据项目备份规则处理提交/推送。

## Spec Coverage Self-Review

| 规格要求 | 计划任务 |
| --- | --- |
| 研究页组合工作台、10 只限制、多个命名本地组合 | Task 3、Task 5 |
| 截断前组合索引、全局家族 profile、季度/哈希/分片发布 | Task 1、Task 2、Task 4 |
| 已采集公开股票明细边界、前十外基金详情按需加载、基金详情前十显示上限和“未出现不代表未持有” | Task 1、Task 4、Task 5、Task 6、Task 7 |
| 直接/间接公式、正倍率、去重、13.54% 回归 | Task 1、Task 4 |
| 两个互斥结果视图与稳定排序 | Task 1、Task 4、Task 5 |
| 既有单股票、深链、基金详情兼容及未保存离开保护 | Task 5、Task 7 |
| 20 日两融/指数市场环境摘要及完整看板入口 | Task 6、Task 7 |
| 阻断失败、存储失败、无映射和数据披露 | Task 2、Task 3、Task 4、Task 5 |
| 无障碍、移动端、渐进加载、首屏性能、无外部请求 | Task 5、Task 6、Task 7 |
| README、缓存策略、Git 忽略和不自动备份 | Task 2、Task 6、Task 7 |

Plan self-review completed: every confirmed spec section maps to at least one implementation task; type names in later tasks are declared in Shared Interfaces; no implementation step uses a hidden current-quarter constant; no task authorizes a commit or push before user testing confirmation.
