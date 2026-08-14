# 两融离线栏目前端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 在“出海钱眼”现有 React/Vite 单页应用中新增可离线读取、可审计披露的“两融”栏目，展示两市融资余额或“沪深融资余额／沪深 A 股市值”，并可叠加 000001、399106、399006 的归一化指数走势。

**Architecture:** 前端只通过相对路径读取两个静态 JSON 文件，并先验证 payload 与 manifest 后才渲染；所有数据派生放在纯 TypeScript 函数中，ECharts 组件只负责可视化和生命周期。App.tsx 继续使用当前锚点导航，新增的 leverage 模块独立于基金季度数据和检索状态，移动端导航始终可到达。

**Tech Stack:** React 19、TypeScript、Vite 6、ECharts 本地 tree-shaken bundle、Vitest、CSS、浏览器 Web Crypto API。

## Global Constraints

- 仅消费 data/leverage-dashboard.json 和 data/leverage-dashboard.manifest.json；不得从浏览器读取 D:\HT、产业链投研 artifacts、DFCF、交易所、TDX、数据库或 verified/backtest 文件。
- 页面不使用 CDN、远程字体、远程图片或新的外部 API；ECharts 必须通过 npm 依赖随 Vite 本地打包。
- 删除当前 styles.css 顶部的 Google Fonts @import，保留系统中文字体回退；两融模块不得添加任何 https 资源。
- 现有 public/_headers 的 script-src self、connect-src self 和 /data/*.json no-cache 保持不放宽。
- 只有 DFCF audit 标记 dfcf_only=true、exchange_requests=0 且发布包哈希/格式有效时才显示两融图表。
- ratio_available=false 时融资余额模式仍可使用；“沪深融资余额／沪深 A 股市值”必须禁用并显示 N/A 原因，不回退为全 A 股或历史估算值。
- 指数、余额、比例均不补值、不前填、不后填、不移日；缩放不重设归一化共同基期。
- 指标名称固定为“沪深融资余额／沪深 A 股市值”，并固定披露分子可能含非 A 股融资标的，因此该指标仅为描述性比率。
- 融资余额变化只作去杠杆压力代理，不展示为强平、市场底或必然反弹结论。
- 现有基金季度配置 config/fund-quarter.json、基金 SEO 产物、基金搜索状态及 public/seo/quarter-release-check.json 不得改写或重用为两融数据。
- 项目规则要求：代码、依赖或文档的实质改动验证后先向用户报告，等待确认后才提交或推送；本计划的检查点不执行 git commit。

---

## File Structure

- Modify: D:\vcp_hunter\基金持仓\package.json
  - 添加 echarts、vitest、test:leverage 和 verify:leverage 脚本。
- Modify: D:\vcp_hunter\基金持仓\package-lock.json
  - 锁定 package.json 的依赖变更。
- Modify: D:\vcp_hunter\基金持仓\src\App.tsx
  - 导入并安放 leverage 区段，扩展锚点导航状态。
- Modify: D:\vcp_hunter\基金持仓\src\styles.css
  - 删除远程字体 import，并让 1100px 以下的顶部导航保持可访问。
- Create: D:\vcp_hunter\基金持仓\src\leverage\types.ts
  - 发布包、manifest、记录、指标和指数代码的稳定类型。
- Create: D:\vcp_hunter\基金持仓\src\leverage\validateLeveragePackage.ts
  - JSON 解析、schema、日期、数值、manifest 和 SHA-256 校验。
- Create: D:\vcp_hunter\基金持仓\src\leverage\deriveLeverageSeries.ts
  - 时间范围裁切、主指标、共同基期归一化、指数缺失原因。
- Create: D:\vcp_hunter\基金持仓\src\leverage\LeverageDashboard.tsx
  - 延迟加载、状态机、摘要、控制、图表与披露的组合。
- Create: D:\vcp_hunter\基金持仓\src\leverage\LeverageControls.tsx
  - 主指标、指数复选和时间范围的可访问控制。
- Create: D:\vcp_hunter\基金持仓\src\leverage\LeverageSummary.tsx
  - 当前数据卡片和数据截止日。
- Create: D:\vcp_hunter\基金持仓\src\leverage\LeverageChart.tsx
  - 本地 ECharts 初始化、setOption、ResizeObserver 与 dispose。
- Create: D:\vcp_hunter\基金持仓\src\leverage\LeverageDisclosure.tsx
  - 来源、hash 摘要、固定口径警示和 N/A 原因。
- Create: D:\vcp_hunter\基金持仓\src\leverage\leverage.css
  - 两融模块独立样式及窄屏规则。
- Create: D:\vcp_hunter\基金持仓\src\leverage\__tests__\fixtures.ts
  - 小型、非生产的有效/无效发布包 fixture。
- Create: D:\vcp_hunter\基金持仓\src\leverage\__tests__\validateLeveragePackage.test.ts
  - 数据包验证单测。
- Create: D:\vcp_hunter\基金持仓\src\leverage\__tests__\deriveLeverageSeries.test.ts
  - 序列派生和共同基期单测。
- Create: D:\vcp_hunter\基金持仓\scripts\verify-leverage-dashboard.mjs
  - 对 public/data 中最终发布包进行 Node 侧 hash/schema 静态检查。
- Modify after数据计划发布: D:\vcp_hunter\基金持仓\public\data\leverage-dashboard.json
  - 只能由产业链投研的 bundle 发布步骤原子写入。
- Modify after数据计划发布: D:\vcp_hunter\基金持仓\public\data\leverage-dashboard.manifest.json
  - 只能由产业链投研的 bundle 发布步骤原子写入。
- Modify: D:\vcp_hunter\基金持仓\README.md
  - 添加两融离线数据包、构建与故障显示说明。

## Shared Interfaces

types.ts 应导出：

    export type LeverageMetric = "margin" | "ratio";
    export type LeverageIndexCode = "000001" | "399106" | "399006";

    export interface LeverageRecord {
      date: string;
      sh_margin_yi: number;
      sz_margin_yi: number;
      total_margin_yi: number;
      sh_a_market_cap_yi: number | null;
      sz_a_market_cap_yi: number | null;
      ratio_pct: number | null;
      index_000001_close: number | null;
      index_399106_close: number | null;
      index_399006_close: number | null;
    }

    export interface LeverageDashboardPayload {
      schema_version: "1";
      generated_at_beijing: string;
      records: LeverageRecord[];
      provenance: {
        ratio_available: boolean;
        ratio_unavailable_reason: string | null;
        ratio_scope_warning: string;
      };
    }

    export interface LeverageManifest {
      schema_version: "1";
      payload_sha256: string;
      payload_records: number;
      data_range: { start: string; end: string };
      dfcf: {
        dfcf_only: boolean;
        exchange_requests: number;
        sample_status: string;
        inputs: Record<string, string>;
      };
      market_cap: {
        reporting_eligible: boolean;
        ratio_available: boolean;
        reason: string | null;
        csv_sha256: string | null;
        scope_definition: string;
      };
      indices: Record<LeverageIndexCode, {
        source: string;
        first_date: string;
        last_date: string;
        sha256: string;
      }>;
    }

验证器和序列派生器应导出：

    export type ValidationResult =
      | { ok: true; payload: LeverageDashboardPayload; manifest: LeverageManifest }
      | { ok: false; reason: string };

    export async function validateLeveragePackage(
      payloadText: string,
      manifestText: string,
    ): Promise<ValidationResult>;

    export interface DeriveRequest {
      records: LeverageRecord[];
      metric: LeverageMetric;
      indexCodes: LeverageIndexCode[];
      startDate: string;
      endDate: string;
    }

    export interface DerivedSeries {
      main: Array<{ date: string; value: number }>;
      indices: Array<{
        code: LeverageIndexCode;
        points: Array<{ date: string; rawClose: number | null; normalized: number | null }>;
      }>;
      unavailableIndexCodes: LeverageIndexCode[];
      baseDate: string | null;
      unavailableReason: string | null;
    }

    export function deriveLeverageSeries(request: DeriveRequest): DerivedSeries;

### Task 1: 本地依赖与纯函数测试基座

**Files:**

- Modify: D:\vcp_hunter\基金持仓\package.json
- Modify: D:\vcp_hunter\基金持仓\package-lock.json
- Create: D:\vcp_hunter\基金持仓\src\leverage\__tests__\fixtures.ts
- Create: D:\vcp_hunter\基金持仓\src\leverage\__tests__\validateLeveragePackage.test.ts
- Create: D:\vcp_hunter\基金持仓\src\leverage\__tests__\deriveLeverageSeries.test.ts

**Interfaces:**

- Produces: npm run test:leverage，可执行 src/leverage/__tests__ 下的 Vitest 测试。
- Produces: fixture 的 makeValidPayloadText 与 makeValidManifestText，为后续验证器和派生器测试提供稳定输入。

- [ ] **Step 0: 定义完整 fixture 工具**

在 fixtures.ts 写入下列导出；它们不读取 public/data，也不引用未创建的生产模块：

    import { createHash } from "node:crypto";

    export const fixtureRecords = [
      {
        date: "2026-08-11",
        sh_margin_yi: 100,
        sz_margin_yi: 80,
        total_margin_yi: 180,
        sh_a_market_cap_yi: 6000,
        sz_a_market_cap_yi: 6000,
        ratio_pct: 1.5,
        index_000001_close: 3000,
        index_399106_close: 10000,
        index_399006_close: 2000,
      },
      {
        date: "2026-08-12",
        sh_margin_yi: 101,
        sz_margin_yi: 81,
        total_margin_yi: 182,
        sh_a_market_cap_yi: 6050,
        sz_a_market_cap_yi: 6050,
        ratio_pct: 1.50413223,
        index_000001_close: 3010,
        index_399106_close: 10100,
        index_399006_close: null,
      },
    ];

    export const fixtureRecordsWithNullRatio = [
      fixtureRecords[0],
      { ...fixtureRecords[1], ratio_pct: null },
    ];

    export const fixtureRecordsWithout399006 = fixtureRecords.map((record) => ({
      ...record,
      index_399006_close: null,
    }));

    export function sha256(text: string): string {
      return createHash("sha256").update(text, "utf8").digest("hex");
    }

    export function makeValidPayloadText(records = fixtureRecords): string {
      return JSON.stringify({
        schema_version: "1",
        generated_at_beijing: "2026-08-13T09:00:00+08:00",
        records,
        provenance: {
          ratio_available: true,
          ratio_unavailable_reason: null,
          ratio_scope_warning: "分子可能包含非 A 股融资标的。",
        },
      });
    }

    export function makeValidManifestText(payloadText = makeValidPayloadText()): string {
      return JSON.stringify({
        schema_version: "1",
        payload_sha256: sha256(payloadText),
        payload_records: fixtureRecords.length,
        data_range: { start: "2026-08-11", end: "2026-08-12" },
        dfcf: {
          dfcf_only: true,
          exchange_requests: 0,
          sample_status: "dfcf_vendor_only_unverified_by_exchange",
          inputs: {},
        },
        market_cap: {
          reporting_eligible: true,
          ratio_available: true,
          reason: null,
          csv_sha256: "a".repeat(64),
          scope_definition: "沪深 A 股市值",
        },
        indices: makeIndexManifest(),
      });
    }

继续写入以下函数：

    export function makeIndexManifest() {
      const entry = {
        source: "TDX 本地当前数据",
        first_date: "2026-08-11",
        last_date: "2026-08-12",
        sha256: "b".repeat(64),
      };
      return { "000001": entry, "399106": entry, "399006": entry };
    }

    export function makeManifestWithPayloadHash(payloadHash: string): string {
      const manifest = JSON.parse(makeValidManifestText());
      manifest.payload_sha256 = payloadHash;
      return JSON.stringify(manifest);
    }

    export function makeManifestWithDfcfFlags(dfcfOnly: boolean, exchangeRequests: number): string {
      const manifest = JSON.parse(makeValidManifestText());
      manifest.dfcf.dfcf_only = dfcfOnly;
      manifest.dfcf.exchange_requests = exchangeRequests;
      return JSON.stringify(manifest);
    }

    export function makePayloadWithRatio(): string {
      return JSON.stringify({
        schema_version: "1",
        generated_at_beijing: "2026-08-13T09:00:00+08:00",
        records: fixtureRecords,
        provenance: {
          ratio_available: false,
          ratio_unavailable_reason: "严格沪深市值审计未通过。",
          ratio_scope_warning: "分子可能包含非 A 股融资标的。",
        },
      });
    }

    export function makeManifestWithRatioUnavailable(): string {
      const manifest = JSON.parse(makeValidManifestText(makePayloadWithRatio()));
      manifest.market_cap.reporting_eligible = false;
      manifest.market_cap.ratio_available = false;
      manifest.market_cap.reason = "严格沪深市值审计未通过。";
      return JSON.stringify(manifest);
    }

- [ ] **Step 1: 安装本地依赖并添加测试脚本**

在基金持仓项目根目录运行：

    npm install echarts
    npm install --save-dev vitest

在 package.json 的 scripts 中添加：

    "test:leverage": "vitest run src/leverage/__tests__",
    "verify:leverage": "node scripts/verify-leverage-dashboard.mjs"

保持现有 build、seo、preflight 和发布脚本内容不变。

- [ ] **Step 2: 建立小型 fixture 与预期失败测试**

在 fixtures.ts 导出包含两日记录的 payload 文本和匹配 SHA-256 的 manifest 文本。第一日比率为 1.50000000，第二日的 index_399006_close 为 null。

在 validateLeveragePackage.test.ts 写入：

    it("接受哈希、DFCF 审计和日期顺序均有效的发布包", async () => {
      const result = await validateLeveragePackage(makeValidPayloadText(), makeValidManifestText());
      expect(result.ok).toBe(true);
    });

在 deriveLeverageSeries.test.ts 写入：

    it("以所选范围第一个全部可用共同日归一化为 100", () => {
      const result = deriveLeverageSeries({
        records: fixtureRecords,
        metric: "margin",
        indexCodes: ["000001", "399106"],
        startDate: "2026-08-11",
        endDate: "2026-08-12",
      });
      expect(result.baseDate).toBe("2026-08-11");
      expect(result.indices[0].points[0].normalized).toBe(100);
    });

- [ ] **Step 3: 运行测试，确认基础实现尚不存在**

运行：

    npm run test:leverage

预期：FAIL，原因是 validateLeveragePackage 或 deriveLeverageSeries 模块尚不存在。

- [ ] **Step 4: 报告依赖检查点**

报告 package.json/package-lock 的最小依赖变化和预期失败测试；不要执行 git add、git commit 或 git push，等待用户确认。

### Task 2: 发布包类型与前端审计校验

**Files:**

- Create: D:\vcp_hunter\基金持仓\src\leverage\types.ts
- Create: D:\vcp_hunter\基金持仓\src\leverage\validateLeveragePackage.ts
- Modify: D:\vcp_hunter\基金持仓\src\leverage\__tests__\fixtures.ts
- Modify: D:\vcp_hunter\基金持仓\src\leverage\__tests__\validateLeveragePackage.test.ts

**Interfaces:**

- Consumes: Shared Interfaces 中的 payload 和 manifest 文本。
- Produces: validateLeveragePackage(payloadText, manifestText)。
- Consumed later by: LeverageDashboard 和 scripts/verify-leverage-dashboard.mjs 的同一契约。

- [ ] **Step 1: 扩展失败测试**

添加以下三个明确场景：

    it("拒绝 payload SHA-256 不匹配", async () => {
      const result = await validateLeveragePackage(makeValidPayloadText(), makeManifestWithPayloadHash("0".repeat(64)));
      expect(result).toEqual({ ok: false, reason: "发布包 SHA-256 校验失败。" });
    });

    it("拒绝 DFCF audit 不满足 dfcf_only 或 exchange_requests", async () => {
      const result = await validateLeveragePackage(makeValidPayloadText(), makeManifestWithDfcfFlags(false, 1));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("DFCF");
    });

    it("在 ratio_available 为 false 时拒绝非空 ratio_pct", async () => {
      const result = await validateLeveragePackage(makePayloadWithRatio(), makeManifestWithRatioUnavailable());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("比例");
    });

- [ ] **Step 2: 运行测试，确认新增断言失败**

运行：

    npm run test:leverage

预期：FAIL，原因是校验器尚未实现上述 schema、hash 和 ratio 一致性门。

- [ ] **Step 3: 实现 types.ts 与 validateLeveragePackage**

实现要求：

1. 用 JSON.parse 读取两个文本；解析失败返回中文失败原因。
2. 用 TextEncoder 和 crypto.subtle.digest("SHA-256", bytes) 计算 payloadText 的小写十六进制哈希；必须与 manifest.payload_sha256 相等。
3. 检查 schema_version 均为 "1"，payload_records 等于 records.length，data_range 等于 records 首末日期。
4. 检查 records 非空、date 为 YYYY-MM-DD、严格升序且唯一。
5. 检查融资余额字段是有限且非负的 number；市值、比例、指数收盘字段只能是有限 number 或 null。
6. 检查 manifest.dfcf.dfcf_only===true、exchange_requests===0、sample_status==="dfcf_vendor_only_unverified_by_exchange"。
7. 检查 payload.provenance.ratio_available 与 manifest.market_cap.ratio_available 一致；为 false 时所有 ratio_pct 必须为 null，reason 必须为非空中文文本。
8. 对所有错误使用稳定、可显示的中文 reason；不把 manifest 的任意字符串作为 HTML。

- [ ] **Step 4: 运行验证器测试**

运行：

    npm run test:leverage

预期：PASS，覆盖有效包、坏 SHA、坏 DFCF 标记和比例禁用不一致。

- [ ] **Step 5: 报告检查点**

报告前端只验证发布包、不会重算或读取原始数据的边界，以及通过的测试；不提交或推送。

### Task 3: 主指标与指数共同基期派生

**Files:**

- Create: D:\vcp_hunter\基金持仓\src\leverage\deriveLeverageSeries.ts
- Modify: D:\vcp_hunter\基金持仓\src\leverage\__tests__\deriveLeverageSeries.test.ts

**Interfaces:**

- Consumes: DeriveRequest。
- Produces: DerivedSeries。
- Consumed later by: LeverageChart、LeverageSummary。

- [ ] **Step 1: 写出日期、比例和共同基期失败测试**

在 deriveLeverageSeries.test.ts 中添加：

    it("比例模式排除 ratio_pct 为 null 的日期且不以前值补齐", () => {
      const result = deriveLeverageSeries({
        records: fixtureRecordsWithNullRatio,
        metric: "ratio",
        indexCodes: [],
        startDate: "2026-08-11",
        endDate: "2026-08-12",
      });
      expect(result.main).toEqual([{ date: "2026-08-11", value: 1.5 }]);
    });

    it("完全缺失的单个指数不阻断主指标或其余可用指数", () => {
      const result = deriveLeverageSeries({
        records: fixtureRecordsWithout399006,
        metric: "margin",
        indexCodes: ["000001", "399006"],
        startDate: "2026-08-11",
        endDate: "2026-08-12",
      });
      expect(result.main).not.toHaveLength(0);
      expect(result.indices.map((series) => series.code)).toEqual(["000001"]);
      expect(result.unavailableIndexCodes).toEqual(["399006"]);
      expect(result.baseDate).toBe("2026-08-11");
    });

    it("只有改变日期范围才改变共同基期", () => {
      const first = deriveLeverageSeries({ records: fixtureRecords, metric: "margin", indexCodes: ["000001"], startDate: "2026-08-11", endDate: "2026-08-12" });
      const second = deriveLeverageSeries({ records: fixtureRecords, metric: "margin", indexCodes: ["000001"], startDate: "2026-08-12", endDate: "2026-08-12" });
      expect(first.baseDate).toBe("2026-08-11");
      expect(second.baseDate).toBe("2026-08-12");
    });

- [ ] **Step 2: 运行测试，确认派生模块尚未实现**

运行：

    npm run test:leverage

预期：FAIL，原因是 deriveLeverageSeries 尚不存在。

- [ ] **Step 3: 实现 deriveLeverageSeries**

实现规则：

1. 只保留 startDate 到 endDate 闭区间内的 records。
2. metric="margin" 选择 total_margin_yi；metric="ratio" 仅选择 ratio_pct 非 null 的记录。
3. 没有主指标记录时返回 main=[]、baseDate=null、unavailableReason="所选时间范围没有可用的主指标数据。"。
4. indexCodes 为空时返回主指标且 indices=[]、baseDate=null、unavailableReason=null。
5. 先找出在当前主指标日期中没有任何非 null 收盘价的 selected index，并在 unavailableIndexCodes 中返回它们；这些指数不阻断其他可用指数。
6. 对其余已选且可用的指数，寻找同时拥有主指标和全部可用指数原始收盘价的最早日期；该日期是 baseDate，每条可用指数在该日 normalized=100。
7. 后续缺失的指数点用 rawClose:null、normalized:null 保留，让 ECharts 断线；不得复制前一日数值。
8. 若 selected index 全部无可用收盘价，返回主指标、indices=[]、baseDate=null，并用中文说明“所选指数在当前范围没有可用数据。”。
9. 不接受 dataZoom 参数；图内缩放只能影响 ECharts 可视范围，不得调用该函数重定基。

- [ ] **Step 4: 运行全部纯函数测试**

运行：

    npm run test:leverage

预期：PASS，覆盖余额、比例、空指标、单指数、多指数、缺失共同基期和日期范围变更。

- [ ] **Step 5: 报告检查点**

报告共同基期精确定义、缺失断线策略与通过测试；不提交或推送。

### Task 4: 本地 ECharts 图表与两融模块组件

**Files:**

- Create: D:\vcp_hunter\基金持仓\src\leverage\LeverageControls.tsx
- Create: D:\vcp_hunter\基金持仓\src\leverage\LeverageSummary.tsx
- Create: D:\vcp_hunter\基金持仓\src\leverage\LeverageChart.tsx
- Create: D:\vcp_hunter\基金持仓\src\leverage\LeverageDisclosure.tsx
- Create: D:\vcp_hunter\基金持仓\src\leverage\LeverageDashboard.tsx
- Create: D:\vcp_hunter\基金持仓\src\leverage\leverage.css

**Interfaces:**

- Consumes: LeverageDashboardPayload、LeverageManifest、validateLeveragePackage、deriveLeverageSeries。
- Produces: <LeverageDashboard />，可被 App.tsx 挂载。

- [ ] **Step 1: 写出组件状态表**

在 LeverageDashboard.tsx 文件顶部以常量定义下列状态和对应中文卡片文案：

    type DashboardState =
      | { kind: "idle" }
      | { kind: "loading" }
      | { kind: "ready"; payload: LeverageDashboardPayload; manifest: LeverageManifest }
      | { kind: "blocked"; reason: string };

状态显示要求：

    idle: “进入两融栏目后加载本机数据包。”
    loading: “正在校验两融数据包…”
    blocked: “两融数据暂不可展示：{reason}”
    ready: 显示控制、摘要、图表和披露。

- [ ] **Step 2: 实现仅同源的双文件加载**

在 LeverageDashboard 中，当组件首次挂载时并发获取：

    fetch("data/leverage-dashboard.json", { cache: "no-cache" })
    fetch("data/leverage-dashboard.manifest.json", { cache: "no-cache" })

要求：

1. 检查两个 HTTP response.ok；失败进入 blocked，不显示旧值。
2. 用 response.text() 获取原始文本，传入 validateLeveragePackage。
3. AbortController 在组件卸载时取消请求，避免 StrictMode 双挂载造成状态写入。
4. 不新增任何第三方请求、CDN、source URL 跳转或外部图像。

- [ ] **Step 3: 实现控制、摘要和披露组件**

LeverageControls：

- 两个 button 采用 aria-pressed；ratio_available=false 时比例 button disabled，并显示 manifest.market_cap.reason。
- 三个 checkbox 使用 000001、399106、399006；默认全选。
- deriveLeverageSeries 返回 unavailableIndexCodes 时，对应 checkbox 旁显示“当前范围 N/A”，不阻断其余指数；用户仍可取消该项。
- 时间按钮为 1 年、3 年、5 年、10 年、全部；默认 10 年。

LeverageSummary：

- 余额模式首卡显示 total_margin_yi 与前一可比日变化；比例模式首卡显示 ratio_pct 与前一可比日变化。
- 始终单列沪市和深市融资余额以及共同数据截止日。
- 在卡片显示“DFCF 厂商口径／未经交易所复核”。

LeverageDisclosure：

- 显示 DFCF、TDX、官方市值快照的来源性质、数据范围、payload SHA-256 前 12 位和完整口径提示。
- 固定显示“分子可能包含非 A 股融资标的；本指标仅作描述性比例展示，不代表资产类别完全匹配的估值口径。”。

- [ ] **Step 4: 实现本地 tree-shaken ECharts 图表**

在 LeverageChart.tsx 中从 echarts/core 导入并 use：

    LineChart
    GridComponent
    TooltipComponent
    LegendComponent
    DataZoomComponent
    DatasetComponent
    AxisPointerComponent
    CanvasRenderer

图表规则：

1. 左轴只画当前主指标，标题为“两市融资余额（亿元）”或“沪深融资余额／沪深 A 股市值（%）”。
2. 右轴只画 derived.indices 的 normalized 值，标题为“所选窗口共同基期 = 100”；没有已选指数时隐藏右轴。
3. tooltip 以日期为轴触发，显示主指标原值、每条指数的原始 close、normalized 和 baseDate。
4. xAxis 使用 time；dataZoom 内置 slider + inside；缺失指数点传 null 并 connectNulls=false。
5. useEffect 初始化一次 chart，派生数据变更时 setOption，ResizeObserver 触发 resize，清理时 disconnect 与 dispose。
6. 不创建第二张隐藏图，不通过双轴把指数原始点位与主指标混在一起。

- [ ] **Step 5: 完成组件样式**

在 leverage.css 中实现：

1. 深色顶部导航下的浅色信息卡、控制条、主图和侧栏，与现有 styles.css 的变量兼容。
2. 桌面图表最小高度 360px；小于 720px 时最小高度 300px。
3. 控制项允许换行，图例和披露文本不超出容器。
4. blocked 卡使用清晰的中文失败原因和实际数据截止日（如 manifest 不可用则写 N/A）。

- [ ] **Step 6: 运行类型与纯函数测试**

运行：

    npm run test:leverage
    npx tsc --noEmit

预期：PASS。

- [ ] **Step 7: 报告检查点**

报告组件新增路径、双轴边界、离线请求边界和测试结果；不提交或推送。

### Task 5: App 嵌入、移动导航和发布包静态验证

**Files:**

- Modify: D:\vcp_hunter\基金持仓\src\App.tsx
- Modify: D:\vcp_hunter\基金持仓\src\styles.css
- Create: D:\vcp_hunter\基金持仓\scripts\verify-leverage-dashboard.mjs
- Modify: D:\vcp_hunter\基金持仓\README.md
- Read only: D:\vcp_hunter\基金持仓\public\_headers

**Interfaces:**

- Consumes: <LeverageDashboard />、public/data 的发布包、已有 scrollToPageSection。
- Produces: 顶部“研究｜两融｜方法论”锚点导航，以及 npm run verify:leverage。

- [ ] **Step 1: 扩展 App.tsx 的导航和懒挂载**

在 App.tsx：

1. 将 activeSection 和 scrollToPageSection 的联合类型从：

       "research" | "methodology"

   改为：

       "research" | "leverage" | "methodology"

2. 在“研究”按钮之后插入“两融”按钮；button 的 active 和 aria-current 与既有“研究”“方法论”逻辑一致。
3. 在 App 内定义以下局部函数和状态，不新增未声明组件：

       const [leverageVisited, setLeverageVisited] = useState(false);

       function openLeverage() {
         setLeverageVisited(true);
         requestAnimationFrame(() => {
           document.getElementById("leverage")?.scrollIntoView({ behavior: "smooth", block: "start" });
         });
       }

   scrollToPageSection 在 sectionId==="leverage" 时调用 setLeverageVisited(true)，然后也使用 requestAnimationFrame 进行滚动。
4. 在研究工作区结束后、方法论 section 之前插入：

       <section id="leverage" className="leverage-zone">
         {leverageVisited ? (
           <LeverageDashboard />
         ) : (
           <button type="button" className="leverage-entry-card" onClick={openLeverage}>
             打开两融市场观察
           </button>
         )}
       </section>

5. 初始化时若 window.location.hash === "#leverage"，设置 leverageVisited=true；不要增加滚动高亮观察器。

- [ ] **Step 2: 修复严格离线字体与移动导航**

在 styles.css：

1. 删除第一行 Google Fonts @import。
2. 删除 Plus Jakarta Sans，保留字体栈：

       "PingFang SC", "Noto Sans SC", "Microsoft YaHei UI", system-ui, sans-serif

3. 将 max-width:1100px 下的 .topbar-nav { display:none; } 改为仍显示的横向滚动导航：

       display: flex;
       overflow-x: auto;
       white-space: nowrap;

4. 在 max-width:720px 下让每个导航 button 最小高度为 44px，左右 padding 缩至 14px；品牌与顶部 meta 不得遮挡导航。

- [ ] **Step 3: 实现 Node 侧发布包检查脚本**

verify-leverage-dashboard.mjs 必须：

1. 读取 public/data/leverage-dashboard.json 与 leverage-dashboard.manifest.json 的 UTF-8 原始文本。
2. 使用 node:crypto 的 createHash("sha256") 计算 payload SHA-256，并与 manifest.payload_sha256 比较。
3. 验证 schema_version、payload_records、日期严格升序唯一、dfcf_only=true、exchange_requests=0。
4. 验证 ratio_available=false 时所有 ratio_pct 为 null，ratio_available=true 时每条记录均有有限 ratio_pct。
5. 成功输出：

       PASS leverage dashboard: {records} records, {start} to {end}, ratio_available={true|false}

6. 失败输出明确中文错误并以 process.exitCode=1 结束。

- [ ] **Step 4: 更新 README**

新增“两融离线栏目”小节，写明：

1. 发布包由产业链投研脚本生成，不由网页更新。
2. npm run verify:leverage 的用途。
3. ratio_available=false 的页面行为。
4. DFCF、TDX 和描述性比率的固定来源/口径提示。

- [ ] **Step 5: 运行嵌入和静态检查**

数据计划已发布两个 JSON 后运行：

    npm run test:leverage
    npm run verify:leverage
    npm run build

预期：三条命令均 PASS；build 继续先运行现有 seo，再完成 TypeScript 和 Vite 构建。

- [ ] **Step 6: 报告检查点**

报告导航变更、移动端可达性、Google Fonts 外链移除、发布包校验和构建结果；不要提交或推送。

### Task 6: 浏览器离线验收与截图 QA

**Files:**

- Create: D:\vcp_hunter\基金持仓\design-qa-assets\leverage-default-desktop.png
- Create: D:\vcp_hunter\基金持仓\design-qa-assets\leverage-ratio-desktop.png
- Create: D:\vcp_hunter\基金持仓\design-qa-assets\leverage-mobile.png
- Create: D:\vcp_hunter\基金持仓\design-qa-assets\leverage-blocked.png
- Modify: D:\vcp_hunter\基金持仓\design-qa.md

**Interfaces:**

- Consumes: 已发布数据包、已构建前端、浏览器外网请求阻断模式。
- Produces: 人工可审阅的桌面和窄屏截图及 QA 勾选记录。

- [ ] **Step 1: 启动预览服务器**

运行：

    npm run preview

打开终端显示的 127.0.0.1 预览 URL；不使用线上 fund.niliangrui.cloud。

- [ ] **Step 2: 验收默认余额和多指数图**

在 1440x1024 视口：

1. 点击顶部“两融”。
2. 确认默认主指标为“两市融资余额（亿元）”。
3. 确认 000001、399106、399006 三个指数已选、右轴为共同基期 100。
4. 悬停确认 tooltip 有原始收盘、normalized、baseDate 和融资余额。
5. 拖动 dataZoom 后确认 baseDate 文案不变。
6. 保存 leverage-default-desktop.png。

- [ ] **Step 3: 验收比例可用和比例不可用**

当 manifest.market_cap.ratio_available=true 时：

1. 切换到“沪深融资余额／沪深 A 股市值（%）”。
2. 确认左轴单位为百分比，摘要卡显示 ratio_pct，底部有资产范围差异提示。
3. 保存 leverage-ratio-desktop.png。

用测试 fixture 或临时本地预览副本将 ratio_available 改为 false 后：

1. 刷新页面。
2. 确认比例按钮禁用、显示 N/A 原因、融资余额模式仍可使用。
3. 不把该临时文件发布到 public/data。

- [ ] **Step 4: 验收窄屏与坏包阻断**

在 390x844 视口：

1. 确认“研究｜两融｜方法论”均可横向访问。
2. 确认控制区、图例、tooltip 和披露文本没有截断或水平溢出。
3. 保存 leverage-mobile.png。

再用临时本地预览副本将 manifest.payload_sha256 改为 64 个 0：

1. 刷新页面。
2. 确认显示“发布包 SHA-256 校验失败。”阻断卡，图表没有渲染。
3. 保存 leverage-blocked.png。
4. 恢复通过校验的正式 manifest，再次运行 npm run verify:leverage。

- [ ] **Step 5: 验收离线网络边界**

不要使用会阻断本机预览服务的全局 Offline 开关。保持 http://127.0.0.1 预览可访问，在浏览器 DevTools Request blocking 中阻断 https://*，然后刷新默认页面并进入“两融”栏目，检查：

1. 本地 Vite assets 与 data JSON 正常工作。
2. 网络请求列表没有 fonts.googleapis.com、CDN、DFCF、交易所、TDX 或新增外部图像请求。
3. 不在已有股票搜索结果页触发外部 logo fallback；QA 以默认页面和两融栏目为准。

- [ ] **Step 6: 更新 design-qa.md 并报告最终验收**

在 design-qa.md 追加四张截图的路径、视口、验证场景、数据截止日和通过/失败结论。报告全部命令、截图与仍存在的证据缺口；等待用户确认后，再依项目规则分别备份产业链投研与基金持仓工作树。
