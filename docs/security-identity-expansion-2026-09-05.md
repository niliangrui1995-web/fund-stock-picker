# 证券代码与名称统一验收（2026-09-05）

本轮按同一市场的同一证券归并代码别名，并对基金半年报原文中的实际跨市场重码逐行拆分。基金详情保留原披露代码、名称、证券标识、来源及页码，默认展示标准证券名称、代码和市场。ADR、其他上市市场及不同股份类别各自保留。

## 结果与边界

- 当前海外搜索有 2,976 项：2,018 项身份已核实、953 项身份待核对、5 项仅可确认披露市场。完整身份配置有 2,879 项，包含不进入海外搜索的 861 项 A 股。
- 原 6,597 个搜索代码中，3,296 个代码版本归入标准代码；1,079 个被错误当作海外的 A 股代码按原有出海搜索范围移除；11 个跨市场混合桶拆开；4 个由跨页解析残片构成的假证券桶移除。其余 2,207 个原代码保留，并产生 769 个标准代码键。因此，前后数量差不能全部计作去重。
- 2,607 条按报告来源、原代码及原名称精确匹配的身份映射已生成；1,883 条可安全复用的原代码与精确原名称映射供前端展示使用。名称保留大小写；歧义裸码单独搜索时不会自动选择市场。
- 同一基金报告中经核实属于同一证券的不同交易路径相加；不同报告、不同份额及相同原代码不重复相加。108 组真实披露路径的结果均与组合数据一致。例如中芯国际的 9.61% 与 0.19% 两条港股路径合计为 9.80%。
- 21 条经原 PDF 证实的跨页续行保留在原详情并标记解析待核对，排除搜索与聚合。相邻真实持仓中，依据同一 PDF 的完整数字恢复 20 条市值及 3 条股数（合计涉及 21 条持仓），原比例不变；不修改来源 CSV。

953 项仍缺少足以统一身份的证据，保留原代码及待核对状态，不能宣称全部海外证券身份均已核实。本轮确认的 11 组跨市场混算已全部拆分。

## 实际跨市场重码拆分

| 原代码 | 独立证券结果一 | 独立证券结果二 |
| --- | --- | --- |
| ROP | ROPUS · 美国 Roper | ROP.SIX · 瑞士 Roche |
| 2883 | 02883 · 港股中海油服 | 2883.TWSE · 台股凯基金融 |
| 6088 | 06088 · 港股鸿腾 | 6088.JP · 日本 SIGMAXYZ |
| ASX | ASXUS · 美国日月光 ADR | ASX.ASX · 澳大利亚 ASX Ltd |
| BBY | BBYUS · 美国 Best Buy | BBY.LN · 英国 Balfour Beatty |
| BG | BGUS · 美国 Bunge | BG.AV · 奥地利 BAWAG |
| DTE | DTEUS · 美国 DTE Energy | DTE.GY · 德国 Deutsche Telekom |
| PRU | PRUUS · 美国保德信 | PRU.AU · 澳大利亚 Perseus |
| RIO | RIO.AU · 澳大利亚 Rio Tinto Ltd | RIO.LN · 英国 Rio Tinto PLC |
| SAN | SAN.FP · 法国 Sanofi | SAN.SM · 西班牙 Santander |
| ASML | ASMLUS · 美国登记股 | ASML.NA · 荷兰上市股 |

表内部分后缀是内部用于区分市场的证券键；原报告代码仍可展开查看。ASML 的相同名称不能用来跨市场归并。台积电 2330 与 TSM、阿里 09988 与 BABA、中芯 A 股与 00981，以及 GOOG 与 GOOGL 均有独立身份回归。

## 间接暴露映射兼容

ASML 的美国证券键变更后，已迁移 `stockAliases` 并以 ASMU 代码和精确产品名固定到 ASMLUS。发行方明确该产品跟踪 NASDAQ 上市 ASML 的每日两倍表现：[Direxion ASMU 官方产品页](https://www.direxion.com/product/daily-asml-bull-leveraged-single-stock-etf)。该映射不指向 ASML.NA。

另依据 501226 基金原 PDF 第 51 页第 9 行美国市场单元格，修复 AMZN 的跨页市场识别缺口，AMZN 与 AMZNUS 均统一为已核实的美股 AMZN；AMZU 的精确产品映射保留在该美国证券上，依据 [Direxion AMZU 官方页](https://www.direxion.com/product/daily-amzn-bull-and-bear-leveraged-single-stock-etfs)。

全量检查 19 组名称别名目标、14 个已知产品正股目标和 2 个旧代码目标，均存在于当前证券索引且身份已核实。原间接暴露未映射候选数量及来源回归保持原断言。

## 数据依据与复现

身份归并要求市场和国家级 compositeFIGI 一致；不同国家的同类股份不因 shareClassFIGI 相同而合并。定义参照 [OpenFIGI API](https://www.openfigi.com/api/documentation) 及 [FIGI allocation rules](https://www.openfigi.com/docs/figi-allocation-rules.pdf)。台积电上市形式另核对[公司投资者 FAQ](https://investor.tsmc.com/english/faq)。基金报告证据的 PDF SHA-256 与来源 CSV 一致。

源码内保留紧凑证据：`openfigi-expansion-evidence-2026-09-05.json`、`hk-disclosure-suffix-evidence-2026-09-05.json`、`taiwan-2330-evidence-2026-09-05.json`、`bare-code-separated-identifiers-2026-09-05.json`、`bare-market-identifier-evidence-2026-09-05.json`、`bare-security-market-evidence-2026-09-05.json`。完整工作证据位于 `outputs/research-flow-2026-09-05/identity/`。

```powershell
python -B scripts/build_fund_stock_index.py
python -B scripts/test_security_identity.py -v
python -B scripts/test_build_fund_portfolio_index.py -v
python -B scripts/verify_security_identity.py --output outputs/research-flow-2026-09-05/identity/identity-count-verification.json
node scripts/verify-portfolio-index.mjs
```

前端紧凑身份内容修订号为 `e2829a55effb`，用于季度内持仓 URL 的稳定缓存修订。最终数据包为 `2026q2-20260905051834619843-4ee07ac05050`；manifest SHA-256 为 `21b3bffad4af39c62a0f5dc5c32c5c53cff68be8abb5cea21599c29a322d2e99`。身份回归 10 项、组合生成回归 34 项通过；2,976 股票分片与 256 详情分片校验通过；21 条原解析警示及数值修正经 QDII、普通持仓和组合详情生成路径复核无差异。完整 UI、备份和线上字节验收见主任务发布记录。
