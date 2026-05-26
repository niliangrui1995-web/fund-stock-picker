# 出海钱眼

出海钱眼是一个静态基金持仓穿透网站，用来帮助大陆投资者从公开公募基金持仓里反查海外股票暴露。用户输入美股、港股或其他海外股票代码/名称后，页面会返回场外基金和场内 ETF / LOF 等基金的持仓榜。

本项目当前聚焦 `2026Q1` 数据，适合做海外股票投资需求下的基金筛选、持仓穿透和基金集中度研究。页面仅做信息展示和研究辅助，不构成投资建议。

## 核心能力

- 按股票名称或代码搜索海外标的，例如 `NVDA`、`00700`、`TSM`、`英伟达`、`腾讯控股`。
- 展示持仓该股票的前 10 只场外基金，场外口径沿用原有“剔除指数、ETF、ETF联接”逻辑。
- 支持切换场内基金，包含 ETF、LOF、封闭式基金和 REIT，并排除 ETF 联接基金。
- 首屏提供海外热门候选，并支持按美股、港股、日股、韩股和其他市场筛选。
- 展示基金代码、合并份额代码、基金类型、净值占比、持仓市值、持股数、申购状态、赎回状态、起购金额和限购额度。
- 悬停基金行可查看该基金前十大持仓，并高亮当前查询标的。
- 纯静态前端，无后端服务，适合部署到静态托管平台。

## 当前数据快照

| 项目 | 当前值 |
| --- | --- |
| 数据周期 | `2026Q1` |
| 截止日期 | `2026-03-31` |
| 源持仓行数 | `170,403` |
| 源基金数 | `26,826` |
| 源股票总数 | `4,624` |
| 前端发布标的 | `742` 个海外标的 |
| 申购限制记录 | `26,542` |
| 前端数据文件 | `public/data/fund-stock-index-2026q1.json` |
| 当前 JSON 体积 | 约 `5.12 MB`，gzip 后约 `0.61 MB` |

前端发布数据只保留海外股票检索范围，完整源股票数量保存在 `meta.totalStockCount` 中。这样可以保留数据口径可追溯性，同时避免公开页面加载完整 A 股持仓索引。

## 技术栈

- React 19
- TypeScript
- Vite 6
- lucide-react 图标
- Python CSV/JSON 预处理脚本
- 静态 JSON 数据文件

## 目录结构

```text
.
├── index.html
├── package.json
├── public/
│   ├── _headers
│   └── data/
│       └── fund-stock-index-2026q1.json
├── scripts/
│   ├── build_fund_stock_index.py
│   ├── fetch_2026q1_fund_holdings.py
│   └── analyze_overseas_ai_exposure.py
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── outputs/
│   ├── holdings_stock_2026q1.csv
│   ├── fund_purchase_limit_snapshot.csv
│   └── run_summary_2026q1.json
└── vite.config.ts
```

## 数据流

```text
outputs/holdings_stock_2026q1.csv
        +
outputs/fund_purchase_limit_snapshot.csv
        +
outputs/run_summary_2026q1.json
        |
        v
scripts/build_fund_stock_index.py
        |
        v
public/data/fund-stock-index-2026q1.json
        |
        v
React + Vite static website
```

生成脚本会完成以下处理：

- 按股票代码聚合基金持仓。
- 生成场外榜单时，剔除基金名称或类型中包含“指数”“ETF”“ETF联接”的基金。
- 合并同一基金的不同份额、币种、前端/后端代码，只保留当前股票口径下最强的一类份额。
- 为每只股票生成场外 `topByRatio` / `topByValue` 榜单，以及场内 `topOnExchangeByRatio` 榜单。
- 为页面悬停卡片生成可展示基金的前十大持仓。
- 只向前端发布海外股票检索范围，降低首屏数据负担。

## 本地运行

### 1. 安装依赖

```powershell
npm install
```

### 2. 生成前端数据

```powershell
python scripts\build_fund_stock_index.py
```

成功后会写入：

```text
public/data/fund-stock-index-2026q1.json
```

### 3. 启动开发服务器

```powershell
npm run dev
```

打开：

```text
http://127.0.0.1:5173/
```

## 生产构建与预览

```powershell
npm run build
npm run preview
```

生产预览默认打开：

```text
http://127.0.0.1:4173/
```

`npm run build` 会先运行 TypeScript 类型检查，再执行 Vite 生产构建。

## 线上地址

- 正式域名：`https://fund.niliangrui.cloud/`
- Cloudflare Pages 默认域名：`https://fund-stock-picker.pages.dev/`
- Cloudflare Pages 项目：`fund-stock-picker`
- 最近一次生产部署：`03fdef8e`，状态为 `success`
- 大陆访问验证：2026-05-26 使用 Check-Host 中国浙江节点 `cn1.node.check-host.net` 测试，返回 HTTP `200`

## 可用命令

| 命令 | 作用 |
| --- | --- |
| `python scripts\build_fund_stock_index.py` | 从 `outputs` 数据生成前端 JSON |
| `npm install` | 安装前端依赖 |
| `npm run dev` | 启动本地开发服务器 |
| `npm run build` | 类型检查并生成生产构建 |
| `npm run preview` | 本地预览生产构建 |
| `npm audit --audit-level=moderate` | 检查 npm 依赖风险 |

## 发布前检查清单

发布前至少执行：

```powershell
python scripts\build_fund_stock_index.py
npm run build
npm audit --audit-level=moderate
npm run preview
```

人工验收重点：

- 页面标题为“出海钱眼”，首屏不是空白页。
- 浏览器控制台没有相关错误。
- `NVDA`、`00700`、`TSM` 能命中结果。
- “场外 / 场内”切换正常，场内榜单能展示 ETF 等品种。
- 美股、港股、日股、韩股、其他市场筛选正常。
- 桌面端表格不遮挡、不错位。
- 移动端搜索框、指标卡、榜单行可读。
- 悬停基金行时，前十大持仓卡能出现，并高亮当前查询标的。

## 部署说明

这是一个静态站点，生产构建输出在 `dist/`：

```powershell
npm run build
```

当前生产环境部署在 Cloudflare Pages。发布前先执行生产构建，再将 `dist/` 上传到 Pages 项目 `fund-stock-picker`。`public/_headers` 会被复制到 `dist/_headers`，并随部署提交到 Cloudflare Pages。

自有域名 `fund.niliangrui.cloud` 通过 Cloudflare DNS CNAME 指向 `fund-stock-picker.pages.dev`，并已在 Pages 自定义域名中验证为 `active`。如果后续更换域名，需要同时检查 Pages 自定义域名状态、DNS 记录和 HTTPS 证书状态。

当前响应头策略包括：

- 内容安全策略：只允许加载同源脚本、样式、字体和数据。
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- 禁用摄像头、麦克风、地理位置、支付、USB 等浏览器权限。
- 指纹静态资源长缓存。
- 数据 JSON 设置 1 天缓存。

如果部署平台不支持 `_headers`，需要在平台控制台或 CDN 层手动配置等价响应头。

## 重要文件说明

### `scripts/build_fund_stock_index.py`

核心数据生成脚本。它读取 `outputs/holdings_stock_2026q1.csv`、`outputs/fund_purchase_limit_snapshot.csv` 和 `outputs/run_summary_2026q1.json`，生成浏览器使用的紧凑 JSON。

### `public/data/fund-stock-index-2026q1.json`

前端实际加载的数据文件。它不是手工维护文件，应通过生成脚本重建。

### `src/App.tsx`

主要 React 应用逻辑，包括：

- 数据加载
- 股票搜索
- 热门市场筛选
- 排名口径切换
- 基金榜单渲染
- 悬停持仓卡
- 错误与加载状态

### `src/styles.css`

页面样式、响应式布局、表格、指标卡、搜索区和悬停卡样式。

### `public/_headers`

静态部署响应头配置。发布前需要确认构建产物 `dist/_headers` 与该文件一致。

## 数据口径

- 股票范围：前端当前只发布海外股票。
- 热门候选：按海外标的覆盖基金数量排序，并按市场做均衡展示。
- 场外基金过滤：剔除基金名称或类型中包含“指数”“ETF”“ETF联接”的基金。
- 场内基金过滤：基金名称或类型包含“ETF”“LOF”“封闭”“REIT”，且排除 ETF 联接基金。
- 基金份额合并：同一基金不同份额、币种、前端/后端名称归并展示。
- 场外默认榜单：按该股票占基金净值比例排序。
- 场内默认榜单：按该股票占基金净值比例排序。
- 申购/赎回状态：来自当前快照文件，可能滞后于销售平台实时状态。

## 常见问题

### 页面显示“数据载入失败”

先确认数据文件存在：

```powershell
Test-Path public\data\fund-stock-index-2026q1.json
```

如果不存在，重新生成：

```powershell
python scripts\build_fund_stock_index.py
```

### 搜索某只股票没有结果

当前前端只发布海外股票范围。如果目标是 A 股，可能存在于源数据中，但不会出现在前端检索文件里。

### 生产预览看到旧数据

重新生成数据并重建：

```powershell
python scripts\build_fund_stock_index.py
npm run build
npm run preview
```

### 数据文件变大

检查是否误把全市场股票重新下发到 `public/data/fund-stock-index-2026q1.json`。当前发布目标是海外标的范围，正常体积约 `5.12 MB`。

## 维护约定

- 不手改 `public/data/fund-stock-index-2026q1.json`，只通过脚本生成。
- 不提交 `node_modules/`、`dist/`、`__pycache__/`、`*.pyc`、临时 pid 文件。
- 修改数据口径后，需要同步更新 README 的“数据口径”和“当前数据快照”。
- 发布前必须跑构建和依赖审计。
- 涉及中文文本时保持 UTF-8 编码，避免乱码。

## 免责声明

本项目基于公开基金定期报告、基金持仓明细及申赎状态快照整理，仅供信息展示和研究参考，不构成任何投资建议、基金推荐、销售邀约或收益承诺。基金持仓、申购赎回、费率和限额可能存在披露滞后或实时变化，请以基金管理人、基金销售机构及监管披露文件为准。基金有风险，投资需谨慎。

## 后续增强

- 增加近四季持仓变化，区分新进、增持、减持。
- 接入基金规模、基金经理、费率和同类排名。
- 支持自选股批量查询并导出基金持仓榜。
- 增加基金详情页，展示该基金重仓股结构和单股集中度风险。
- 增加数据生成校验脚本，自动检查排序、体积、字段和样本命中。
