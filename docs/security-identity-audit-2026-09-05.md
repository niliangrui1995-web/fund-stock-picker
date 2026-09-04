# 证券身份与基金计数修复核验

核验日期：2026-09-05。对应《出海钱眼 UI / UX 审查与优化建议》第 1、2 项。

## 已修复的行为

- 21 个经过核实的证券使用 `config/security-identities.json` 的标准名称、市场、交易所与有限别名白名单；Python 构建器和前端共同读取同一配置。
- `NVDA`、`NVDAUS`、`NVDAUW`、`NVDAUSEquity` 均定位标准 `NVDA`。同样处理 AMD、美光、台积电 ADR、康宁、Lumentum、Coherent 等已核实的披露版本。
- `000660` / SK 海力士明确展示韩股 / KRX；即使原始名称截断为“SK 海力”，也不再由六位数字误判为 A 股。
- 未完成证券身份核实的版本保留原始代码。已含 US/UW/UN 等披露市场标记的代码展示披露市场，并明确“代码版本待核对”；无法确定市场的显示“市场待核对”。不会把未经核实的后缀剥离后合并。
- 不在白名单的纯英文字母代码无法单靠格式证明其交易国家或交易所，统一显示“市场待核对”，例如未核实的 SNDK、BAS；不会再将这种形式直接视作美国市场披露。
- 搜索使用 `offExchangeFundCount` 与 `portfolioOnExchangeFundCount`，与组合结果采用相同的有效占比检查、基金家族注册表、交易场景分类，以及直接持仓和合格间接暴露的家族并集。
- 保留 `activeFundCount` 的原含义，主动/指数属于另一分类维度。组合基金 profile 新增 `managementStyle`。

## 身份证据与合并边界

查阅 [OpenFIGI 官方 API 文档](https://www.openfigi.com/api/documentation)，并实时查询 `/v3/mapping` 共 40 个证券及交易场所标识。按 `compositeFIGI` 核实同一市场中的证券身份，不能只凭公司名或 ticker 前缀归并。每条允许的别名同时保留证监会基金披露平台的报告名称、基金代码、报告 URL、页码、PDF SHA-256 和原文名称，见配置中 `evidence`。

英伟达的 US / UW 均返回 `BBG000BBJQV0`，证券名 `NVIDIA CORP`；[英伟达投资者 FAQ](https://investor.nvidia.com/investor-resources/faqs/)也确认 NASDAQ 代码 NVDA。[SK 海力士投资者页面](https://www.skhynix.com/ir/UI-FR-IR99/)确认 000660；[三星官方上市信息](https://www.samsung.com/global/ir/stock-information/listing-Info/)明确区分 KRX 普通股 005930 与优先股 005935。

明确保持独立的身份包括：

| 证券 | 保留边界 |
|---|---|
| GOOG / GOOGL | C 类与 A 类，OpenFIGI 返回不同 compositeFIGI 和 shareClassFIGI |
| TSM / 2330 | 美国 ADR 与台湾普通股，不把发行人相同当作同一上市证券 |
| ASML / ASMLNA | 美国登记股与荷兰上市代码保持独立 |
| 00700 / TCEHYUV | 腾讯港币柜台与美国 ADR 保持独立 |
| KYG875721634 | 查询同时返回腾讯 700 与人民币柜台 80700，无法仅据 ISIN 确定交易柜台，保留待核对 |
| 00700HG / 00700HS | 本轮未核实交易路径标记，不纳入新别名白名单 |

SK 海力士、三星的旧显式代码别名沿用项目已有的官方报告核验配置；本轮补齐其标准市场和名称。新规则没有扩大旧别名的覆盖范围。

## 去重与计数验证

检查原始 `outputs/holdings_qdii_2026h1.csv` 中 17,878 条权益披露，本轮白名单内同一基金出现不同已确认别名的碰撞为 **0**。生成器先归一证券，再沿用同一基金代表持仓选择和基金家族去重，未通过求和合并别名比例；原始持仓明细中的代码、名称、序号、报告来源全部保留。

重建后发布包：`2026q2-20260905034027904683-5efc7336c49a`；6,597 个股票分片和 256 个详情分片均通过已有完整校验。对全部 6,597 个股票逐一比较搜索摘要与组合分片，计数差异 **0**。

| 标准证券 | 场外基金家族 | 场内基金家族 | 主动基金家族（直接持仓维度） |
|---|---:|---:|---:|
| NVDA | 39 | 15 | 31 |
| AMD | 45 | 18 | 35 |
| MU | 45 | 18 | 35 |
| TSM | 37 | 0 | 36 |
| GLW | 16 | 5 | 13 |
| 000660 | 21 | 2 | 18 |
| 005930 | 15 | 2 | 13 |
| 00700 | 601 | 119 | 574 |

上表是当前披露数据的结果，不代表实时持仓或未披露基金全覆盖；场外/场内列包含合格间接暴露，因此不能与只统计直接持仓的主动基金列直接相减。

## 可重复验证

最终对照检查另外修复了四个 REIT 主题 QDII 的交易分类：070031 嘉实全球房地产、005613 摩根富时发达市场 REITs 指数、320017 诺安全球收益不动产、206011 鹏华美国房地产。它们的 REITs 标签描述投资对象，不代表基金份额上市交易。

2026-09-05 重新下载四份 2026H1 证监会官方报告，第 5 页均确认其普通开放式运作方式，四份 PDF SHA-256 与原始采集记录一致。证据见 `docs/fund-trading-classification-evidence-2026-09-05.json`，精确基金家族名单见 `config/fund-trading-overrides.json`。Python 构建器、TypeScript 加载校验与 Node 发布校验共同使用该配置；已列入的人民币、美元及 A/C 份额全部归场外；真正的上市 REIT、ETF 保持原交易分类。未采用“所有 REIT 都场外”的宽泛替代规则。

```powershell
python -B scripts/test_security_identity.py -v
npx vitest run src/__tests__/securityIdentity.test.ts
python -B scripts/test_build_fund_portfolio_index.py -v
node scripts/verify-portfolio-index.mjs
python -B scripts/verify_security_identity.py
```

身份回归覆盖全部 NVDA 版本归一、证券类别边界、韩国市场识别、未核实版本保留、A/C 家族去重、零占比排除、直接与间接家族并集、非场内指数基金分类。详细动态核验结果写入 `outputs/ui-ux-optimization-2026-09-05/identity-count-verification.json`。

若需要重新获取官方标识证据，可运行 `python -B scripts/audit_security_identity.py`。脚本只处理本文已审查的有限证券清单，检测多结果或 compositeFIGI 不一致时停止；取得证据后还须重新生成索引并完成上述校验，不自动发布。
