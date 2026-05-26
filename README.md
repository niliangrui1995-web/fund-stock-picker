公开域名：https://fund.niliangrui.cloud/
开源仓库：https://github.com/niliangrui1995-web/fund-stock-picker

# 出海钱眼

出海钱眼是一个静态基金持仓穿透工具，用公开基金持仓数据反查海外股票被哪些基金重仓。用户输入美股、港股、日股、韩股或其他海外股票的名称/代码后，页面会展示场外基金和场内 ETF / LOF 等品种的持仓排序。

项目当前内置 `2026Q1` 数据快照，主要用于基金筛选、海外股票持仓穿透和基金集中度研究。页面只做信息展示和研究辅助，不构成投资建议、基金推荐、销售邀约或收益承诺。

## 在线体验

访问：https://fund.niliangrui.cloud/

![出海钱眼 NVDA 查询示例](docs/screenshot-home.png)

可以直接搜索这些示例：

- `NVDA` / `英伟达`：查看英伟达被哪些场外基金和场内品种持有。
- `TSM` / `台积电`：查看台积电相关基金持仓排序。
- `00700` / `腾讯控股`：查看腾讯控股在公募基金中的持仓穿透结果。

## 功能

- 按股票名称或代码搜索海外标的，例如 `NVDA`、`00700`、`TSM`、`英伟达`、`腾讯控股`。
- 场外口径沿用原有逻辑，剔除基金类型或基金名称中包含“指数”“ETF”“ETF联接”的基金。
- 场内口径覆盖 ETF、LOF、封闭式基金和 REIT，并排除 ETF 联接基金。
- 首页展示海外热门标的，并支持按美股、港股、日股、韩股和其他市场筛选。
- 结果展示基金代码、合并份额代码、基金类型、净值占比、持仓市值、持股数、申购状态、赎回状态、起购金额和限购额度。
- 点击或悬停基金行可查看该基金前十大持仓，并高亮当前查询标的。
- 页面内置意见反馈入口；反馈发送依赖部署环境变量，不在代码中保存邮箱密码或收件人地址。

## 数据快照

| 项目 | 当前值 |
| --- | --- |
| 数据周期 | `2026Q1` |
| 截止日期 | `2026-03-31` |
| 源持仓行数 | `170,403` |
| 源基金数 | `26,826` |
| 源股票总数 | `4,624` |
| 前端发布标的 | `742` 个海外标的 |
| 热门候选 | `60` 个 |
| 基金持仓卡片索引 | `1,679` 个基金代码 |
| 前端数据文件 | `public/data/fund-stock-index-2026q1.json` |

前端只发布海外股票检索范围，完整源股票数量保存在数据文件的 `meta.totalStockCount` 中。`data/eastmoney_cache/` 和 `outputs/` 是本地采集、缓存和中间产物目录，不应提交到公开仓库。

## 技术栈

- React 19
- TypeScript
- Vite 6
- lucide-react
- Python 数据预处理脚本
- 静态 JSON 数据文件
- 可选 Cloudflare Pages Functions / Advanced Mode Worker 处理意见反馈

## 目录结构

```text
.
|-- index.html
|-- package.json
|-- public/
|   |-- _headers
|   |-- _worker.js
|   `-- data/
|       `-- fund-stock-index-2026q1.json
|-- scripts/
|   |-- analyze_overseas_ai_exposure.py
|   |-- build_fund_stock_index.py
|   `-- fetch_2026q1_fund_holdings.py
|-- src/
|   |-- App.tsx
|   |-- main.tsx
|   `-- styles.css
|-- tsconfig.json
`-- vite.config.ts
```

## 本地运行

安装依赖：

```powershell
npm install
```

启动开发服务：

```powershell
npm run dev
```

生产构建：

```powershell
npm run build
```

本地预览生产构建：

```powershell
npm run preview
```

## 数据生成

当前前端读取：

```text
public/data/fund-stock-index-2026q1.json
```

数据文件由脚本生成，不建议手工编辑。典型流程如下：

```powershell
python scripts\fetch_2026q1_fund_holdings.py
python scripts\analyze_overseas_ai_exposure.py
python scripts\build_fund_stock_index.py
```

生成脚本会读取本地缓存和中间产物，输出浏览器可直接加载的紧凑 JSON：

```text
data/eastmoney_cache/       # 本地缓存，不提交
outputs/                    # 本地中间产物，不提交
public/data/*.json          # 前端发布数据
```

## 意见反馈配置

`public/_worker.js` 提供可选的反馈接口：

```text
POST /api/feedback
```

接口通过部署平台的环境变量读取发件邮箱、授权密钥和收件邮箱，代码仓库中不保存真实邮箱密码或收件人地址。

需要在部署平台配置：

```text
FEEDBACK_EMAIL_ADDRESS
FEEDBACK_EMAIL_PASSWORD
FEEDBACK_RECEIVER_EMAIL
```

反馈接口已包含基础保护：

- 只接受同源请求。
- 只接受 JSON 请求。
- 限制联系方式和留言长度。
- 限制请求体大小。
- 内置隐藏字段拦截简单机器人提交。
- 使用 Worker 内存做轻量频率限制。
- 邮件正文做 HTML 转义和 SMTP 点转义。

如果公开流量增大，建议继续在平台侧启用 Cloudflare Turnstile、WAF 或 Rate Limiting。Worker 内存限流只能作为基础保护，不能替代平台级反滥用策略。

## 部署

这是一个静态站点，`npm run build` 后会生成 `dist/`。可以部署到 Cloudflare Pages、GitHub Pages、Netlify、Vercel 或任意静态托管平台。

如果使用反馈接口，需要选择支持 `public/_worker.js` 的部署方式，并在部署平台配置上面的环境变量。如果不需要反馈接口，可以移除反馈按钮和 `_worker.js`，仅按普通静态站点发布。

`public/_headers` 包含基础安全响应头：

- Content Security Policy 只允许同源脚本、样式、字体和数据请求。
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- 禁用摄像头、麦克风、定位、支付、USB 等浏览器权限。

## 开源前安全检查

发布到公开 GitHub 前建议至少执行：

```powershell
npm run build
npm audit --audit-level=moderate
rg -n -I "password|passwd|secret|token|api[_-]?key|auth[_-]?key|private[_-]?key|@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" -g "!node_modules/**" -g "!dist/**" -g "!data/eastmoney_cache/**" -g "!outputs/**" .
```

同时确认：

- 不提交 `.env`、`.env.*`、`.dev.vars`、`.wrangler/`。
- 不提交 `data/eastmoney_cache/` 和 `outputs/`。
- 不把个人域名、个人邮箱、API 密钥、SMTP 授权码、Cloudflare Token 写入 README、源码、提交信息或 Issues。
- 如果旧 Git 历史曾经包含个人部署信息，公开发布时建议新建干净仓库或重写历史后再推送。
- 已添加 MIT 开源许可证文件，详见 `LICENSE`。

## 常见问题

### 页面显示“数据载入失败”

确认前端数据文件存在：

```powershell
Test-Path public\data\fund-stock-index-2026q1.json
```

如果不存在，重新生成数据并构建：

```powershell
python scripts\build_fund_stock_index.py
npm run build
```

### 搜索某只股票没有结果

当前前端只发布海外股票检索范围。如果目标是 A 股，可能存在于源数据中，但不会出现在前端搜索文件里。

### 场内基金显示为空

优先检查数据文件中该股票是否存在 `topOnExchangeByRatio`、`onExchangeFundCount` 和 `onExchangeMaxRatioPercent`。场内口径只包含 ETF、LOF、封闭式基金和 REIT，并排除 ETF 联接基金。

### 生产预览看到旧数据

重新生成数据、重新构建并刷新预览：

```powershell
python scripts\build_fund_stock_index.py
npm run build
npm run preview
```

## 维护约定

- 不手工修改 `public/data/fund-stock-index-2026q1.json`，只通过脚本重建。
- 不提交 `node_modules/`、`dist/`、缓存目录、输出目录、环境变量文件和本地平台配置。
- 修改数据口径后，同步更新 README 的数据说明和常见问题。
- 发布前跑构建、依赖审计和隐私关键词扫描。
- 所有中文文件保持 UTF-8 编码。

## 许可证

本项目采用 MIT License，详见 `LICENSE`。

## 免责声明

本项目基于公开基金定期报告、基金持仓明细和申购状态快照整理，仅供信息展示和研究参考，不构成任何投资建议、基金推荐、销售邀约或收益承诺。基金持仓、申购赎回、费率和限额可能存在披露滞后或实时变化，请以基金管理人、基金销售机构及监管披露文件为准。基金有风险，投资需谨慎。
