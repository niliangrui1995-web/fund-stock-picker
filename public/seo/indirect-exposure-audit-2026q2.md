# 2026Q2 间接 / 杠杆 ETF 暴露维护审计

只读维护产物，由 `scripts/build_fund_stock_index.py` 根据定期报告解析结果、`config/stock-exposure-aliases.json` 和最终前端数据生成；不要手工修改它来修页面展示。

- 生成时间：`2026-09-05T05:18:34`
- 前端数据：`public/data/fund-stock-index-2026q2.json`
- 报告解析 summary：`outputs/fund_report_holdings_summary_2026q2.json`
- 报告解析 CSV：`outputs/holdings_fund_investment_2026q2.csv`
- 映射配置：`config/stock-exposure-aliases.json`

## 总览

| 项目 | 值 |
| --- | --- |
| 报告期 | 2026Q2 |
| 候选范围 | overseas-lof |
| 候选基金数 | 78 |
| 已解析 LOF/QDII 定期报告 | 78 |
| 候选未进入 indirectExposureRows | 76 |
| 报告 PDF 解析出的杠杆明细 | 789 |
| 最终 indirectExposureRows | 36 |
| stockAliases 正股数 | 19 |
| knownProducts 产品数 | 19 |
| ignoredProducts 暂不映射产品数 | 8 |

## 状态计数

| 状态 | 含义 | 数量 |
| --- | --- | --- |
| no_leveraged_fund_investment | 报告已解析，无正向杠杆明细 | 74 |
| ok | 解析到杠杆明细 | 4 |

## 已解析定期报告

| 基金代码 | 基金名称 | 基金类型 | 状态 | 杠杆明细行 | 公告日期 | 公告 ID |
| --- | --- | --- | --- | --- | --- | --- |
| 003721 | 易方达标普信息科技指数(QDII-LOF)A(美元现汇) | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827150818 |
| 005491 | 兴全合宜混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827157439 |
| 006127 | 华宝港股通标普香港上市中国中小盘指数(LOF)C | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827153428 |
| 008973 | 大成中华沪深港300指数(LOF)C | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148640 |
| 010365 | 鹏华中证香港银行指数(LOF)C | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827112975 |
| 010789 | 汇添富恒生指数(QDII-LOF)C | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148566 |
| 011159 | 大成中小盘混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148743 |
| 012809 | 鹏华中证沪港深科技龙头指数(LOF)C | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827110547 |
| 012868 | 易方达标普信息科技指数(QDII-LOF)C(人民币) | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827150818 |
| 012869 | 易方达标普信息科技指数(QDII-LOF)C(美元现汇) | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827150818 |
| 012884 | 华夏港股通精选股票发起式(LOF)C | 股票型 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827152550 |
| 013027 | 银华富久食品饮料精选混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827113052 |
| 013944 | 招商智星稳健配置混合(FOF-LOF)C | FOF-稳健型 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827156022 |
| 013945 | 交银中证海外中国互联网指数(LOF)C | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827110518 |
| 014982 | 华安标普全球石油指数(LOF)C | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827152466 |
| 015491 | 博时科创主题灵活配置混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827154091 |
| 015546 | 大成恒生指数(QDII-LOF)C | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148841 |
| 016823 | 天弘全球新能源汽车股票(QDII-LOF)C | QDII-普通股票 | 解析到杠杆明细 | 2 | 2026-07-21 | AN202607201827148844 |
| 017290 | 中欧科创主题混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827154654 |
| 017767 | 嘉实欣荣混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827153721 |
| 018007 | 招商瑞利灵活配置混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827156042 |
| 018238 | 广发恒生中型股指数(LOF)E | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827113056 |
| 018860 | 嘉实产业优选混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827153788 |
| 018948 | 东方红睿满沪港深混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148746 |
| 018949 | 东方红睿华沪港深混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148917 |
| 019710 | 广发道琼斯石油指数(QDII-LOF)人民币E | 指数型-海外股票 | 解析到杠杆明细 | 1 | 2026-07-20 | AN202607191827110688 |
| 019711 | 广发道琼斯石油指数(QDII-LOF)美元现汇E | 指数型-海外股票 | 解析到杠杆明细 | 1 | 2026-07-20 | AN202607191827110688 |
| 022182 | 招商智星稳健配置混合(FOF-LOF)D | FOF-稳健型 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827156022 |
| 022834 | 鹏华中证沪港深科技龙头指数(LOF)I | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827110547 |
| 024114 | 泓德丰泽混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607201827125164 |
| 025127 | 鹏华中证香港银行指数(LOF)I | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827112975 |
| 025330 | 银华恒生国企指数(QDII-LOF)C | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827110643 |
| 025988 | 鹏华创新未来混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827113032 |
| 160127 | 南方新兴消费增长股票(LOF)A | 股票型 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827160763 |
| 160142 | 南方优势产业(LOF) | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827159944 |
| 160144 | 南方新兴消费增长股票(LOF)C | 股票型 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827160763 |
| 160322 | 华夏港股通精选股票发起式(LOF)A | 股票型 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827152550 |
| 160416 | 华安标普全球石油指数(LOF)A | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827152466 |
| 160527 | 博时研究优选混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827154481 |
| 160528 | 博时研究优选混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827154481 |
| 160646 | 鹏华中证沪港深科技龙头指数(LOF)A | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827110547 |
| 160717 | 嘉实H股指数(QDII-LOF) | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827154444 |
| 160918 | 大成中小盘混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148743 |
| 160924 | 大成恒生指数(QDII-LOF)A | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148841 |
| 160925 | 大成中华沪深港300指数(LOF)A | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148640 |
| 161128 | 易方达标普信息科技指数(QDII-LOF)A(人民币) | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827150818 |
| 161728 | 招商瑞智优选混合(LOF) | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827156045 |
| 161729 | 招商瑞利灵活配置混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827156042 |
| 161730 | 招商智星稳健配置混合(FOF-LOF)A | FOF-稳健型 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827156022 |
| 161831 | 银华恒生国企指数(QDII-LOF)A | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827110643 |
| 163417 | 兴全合宜混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827157439 |
| 164212 | 天弘全球新能源汽车股票(QDII-LOF)A | QDII-普通股票 | 解析到杠杆明细 | 2 | 2026-07-21 | AN202607201827148844 |
| 164705 | 汇添富恒生指数(QDII-LOF)A | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148566 |
| 164906 | 交银中证海外中国互联网指数(LOF)A | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827110518 |
| 167302 | 方正富邦大湾区综指(LOF) | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148916 |
| 167508 | 安信价值发现两年定开混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827110667 |
| 169104 | 东方红睿满沪港深混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148746 |
| 169105 | 东方红睿华沪港深混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827148917 |
| 501021 | 华宝港股通标普香港上市中国中小盘指数(LOF)A | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827153428 |
| 501025 | 鹏华中证香港银行指数(LOF)A | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827112975 |
| 501062 | 南方瑞合定开混合(LOF) | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827158597 |
| 501071 | 泓德丰泽混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607201827125164 |
| 501076 | 鹏华创新动力混合(LOF) | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827112955 |
| 501081 | 中欧科创主题混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827154654 |
| 501082 | 博时科创主题灵活配置混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827154091 |
| 501087 | 交银瑞丰混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827112996 |
| 501091 | 嘉实欣荣混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827153721 |
| 501092 | 交银瑞思混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827113017 |
| 501098 | 建信优享科技创新混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827112948 |
| 501188 | 汇添富核心精选混合(LOF) | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827153634 |
| 501189 | 嘉实产业优选混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827153788 |
| 501203 | 易方达创新未来混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827153363 |
| 501205 | 鹏华创新未来混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827113032 |
| 501206 | 汇添富创新未来混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827153689 |
| 501207 | 华夏创新未来混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827154040 |
| 501208 | 中欧创新未来混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-21 | AN202607201827154655 |
| 501209 | 银华富久食品饮料精选混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827113052 |
| 501303 | 广发恒生中型股指数(LOF)A | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 2026-07-20 | AN202607191827113056 |

## 杠杆产品映射到正股

| 产品代码 | 产品名称 | 映射正股 | 杠杆倍数 | 匹配原因 | 最终行数 | 基金代码 |
| --- | --- | --- | --- | --- | --- | --- |
| 7709.HK | CSOP SK Hynix Daily 2x Leveraged Product | 000660 / SK 海力士 | 2.0 | known product name alias -> 7709.HK | 13 | 002230, 005698, 016664, 016665, 016823, 018229, 018230, 018231, 018232, 019447, 019448, 024239, 164212 |
| 7747.HK | CSOP Samsung Electronics Daily 2x Leveraged Product | 005930 / 三星电子（普通股） | 2.0 | known product name alias -> 7747.HK | 9 | 002230, 016664, 016665, 016823, 018229, 018230, 018231, 018232, 164212 |
| ASMU | Direxion Daily ASML Bull 2X ETF | ASMLUS / 阿斯麦 ASML（美国登记股） | 2.0 | known product name alias -> ASMU | 1 | 001691 |
| Defiance Daily Target 2X Long AMAT ETF | Defiance Daily Target 2X Long AMAT ETF | AMAT / 应用材料公司 | 2.0 | name matched AMAT | 1 | 001691 |
| Defiance Daily Target 2X Long NOK ETF | Defiance Daily Target 2X Long NOK ETF | NOK / 诺基亚 | 2.0 | name matched NOK | 2 | 019265, 019266 |
| Direxion Daily Intc Bull 2X ETF | Direxion Daily Intc Bull 2X ETF | INTC / 英特尔公司 | 2.0 | name matched INTC | 1 | 001691 |
| Direxion Daily TSM Bull 2X ETF | Direxion Daily TSM Bull 2X ETF | TSM / 台积电 TSMC（ADR） | 2.0 | name matched TSM | 2 | 019265, 019266 |
| GraniteShares 2x Long NVDA Daily ETF | GraniteShares 2x Long NVDA Daily ETF | NVDA / 英伟达 NVIDIA | 2.0 | name matched NVDA | 2 | 000043, 000044 |
| Graniteshares 2x Long AMD Daily ETF | Graniteshares 2x Long AMD Daily ETF | AMD / 超威半导体 AMD | 2.0 | name matched AMD | 2 | 019265, 019266 |
| Tradr 2X Long ALAB Daily ETF | Tradr 2X Long ALAB Daily ETF | ALAB / Astera Labs 股份有限公司 | 2.0 | name matched ALAB | 2 | 019265, 019266 |
| Tradr 2X Long LRCX Daily ETF | Tradr 2X Long LRCX Daily ETF | LRCX / 泛林集团 | 2.0 | name matched LRCX | 1 | 001691 |

## 最终进入 indirectExposureRows

| 正股 | 基金代码 | 基金名称 | 杠杆产品 | 原占净值 | 杠杆倍数 | 估算暴露 |
| --- | --- | --- | --- | --- | --- | --- |
| 000660 / SK 海力士 | 002230 | 华夏大中华混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 1.26 | 2.0 | 2.52 |
| 000660 / SK 海力士 | 005698 | 华夏全球科技先锋混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 1.01 | 2.0 | 2.02 |
| 000660 / SK 海力士 | 016664 | 天弘全球高端制造混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 7.44 | 2.0 | 14.88 |
| 000660 / SK 海力士 | 016665 | 天弘全球高端制造混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 7.44 | 2.0 | 14.88 |
| 000660 / SK 海力士 | 016823 | 天弘全球新能源汽车股票(QDII-LOF) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 4.87 | 2.0 | 9.74 |
| 000660 / SK 海力士 | 018229 | 易方达全球优质企业混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 0.73 | 2.0 | 1.46 |
| 000660 / SK 海力士 | 018230 | 易方达全球优质企业混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 0.73 | 2.0 | 1.46 |
| 000660 / SK 海力士 | 018231 | 易方达全球优质企业混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 0.73 | 2.0 | 1.46 |
| 000660 / SK 海力士 | 018232 | 易方达全球优质企业混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 0.73 | 2.0 | 1.46 |
| 000660 / SK 海力士 | 019447 | 华夏全球科技先锋混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 1.01 | 2.0 | 2.02 |
| 000660 / SK 海力士 | 019448 | 华夏全球科技先锋混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 1.01 | 2.0 | 2.02 |
| 000660 / SK 海力士 | 024239 | 华夏全球科技先锋混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 1.01 | 2.0 | 2.02 |
| 000660 / SK 海力士 | 164212 | 天弘全球新能源汽车股票(QDII-LOF) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 4.87 | 2.0 | 9.74 |
| 005930 / 三星电子（普通股） | 002230 | 华夏大中华混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 1.06 | 2.0 | 2.12 |
| 005930 / 三星电子（普通股） | 016664 | 天弘全球高端制造混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 1.5 | 2.0 | 3.0 |
| 005930 / 三星电子（普通股） | 016665 | 天弘全球高端制造混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 1.5 | 2.0 | 3.0 |
| 005930 / 三星电子（普通股） | 016823 | 天弘全球新能源汽车股票(QDII-LOF) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 1.9 | 2.0 | 3.8 |
| 005930 / 三星电子（普通股） | 018229 | 易方达全球优质企业混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82 | 2.0 | 1.64 |
| 005930 / 三星电子（普通股） | 018230 | 易方达全球优质企业混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82 | 2.0 | 1.64 |
| 005930 / 三星电子（普通股） | 018231 | 易方达全球优质企业混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82 | 2.0 | 1.64 |
| 005930 / 三星电子（普通股） | 018232 | 易方达全球优质企业混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82 | 2.0 | 1.64 |
| 005930 / 三星电子（普通股） | 164212 | 天弘全球新能源汽车股票(QDII-LOF) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 1.9 | 2.0 | 3.8 |
| ALAB / Astera Labs 股份有限公司 | 019265 | 南方港股数字经济混合发起(QDII) | Tradr 2X Long ALAB Daily ETF / Tradr 2X Long ALAB Daily ETF | 2.75 | 2.0 | 5.5 |
| ALAB / Astera Labs 股份有限公司 | 019266 | 南方港股数字经济混合发起(QDII) | Tradr 2X Long ALAB Daily ETF / Tradr 2X Long ALAB Daily ETF | 2.75 | 2.0 | 5.5 |
| AMAT / 应用材料公司 | 001691 | 南方香港成长灵活配置混合 | Defiance Daily Target 2X Long AMAT ETF / Defiance Daily Target 2X Long AMAT ETF | 0.85 | 2.0 | 1.7 |
| AMD / 超威半导体 AMD | 019265 | 南方港股数字经济混合发起(QDII) | Graniteshares 2x Long AMD Daily ETF / Graniteshares 2x Long AMD Daily ETF | 1.67 | 2.0 | 3.34 |
| AMD / 超威半导体 AMD | 019266 | 南方港股数字经济混合发起(QDII) | Graniteshares 2x Long AMD Daily ETF / Graniteshares 2x Long AMD Daily ETF | 1.67 | 2.0 | 3.34 |
| ASMLUS / 阿斯麦 ASML（美国登记股） | 001691 | 南方香港成长灵活配置混合 | ASMU / Direxion Daily ASML Bull 2X ETF | 0.29 | 2.0 | 0.58 |
| INTC / 英特尔公司 | 001691 | 南方香港成长灵活配置混合 | Direxion Daily Intc Bull 2X ETF / Direxion Daily Intc Bull 2X ETF | 1.3 | 2.0 | 2.6 |
| LRCX / 泛林集团 | 001691 | 南方香港成长灵活配置混合 | Tradr 2X Long LRCX Daily ETF / Tradr 2X Long LRCX Daily ETF | 1.29 | 2.0 | 2.58 |
| NOK / 诺基亚 | 019265 | 南方港股数字经济混合发起(QDII) | Defiance Daily Target 2X Long NOK ETF / Defiance Daily Target 2X Long NOK ETF | 1.01 | 2.0 | 2.02 |
| NOK / 诺基亚 | 019266 | 南方港股数字经济混合发起(QDII) | Defiance Daily Target 2X Long NOK ETF / Defiance Daily Target 2X Long NOK ETF | 1.01 | 2.0 | 2.02 |
| NVDA / 英伟达 NVIDIA | 000043 | 嘉实美国成长股票 | GraniteShares 2x Long NVDA Daily ETF / GraniteShares 2x Long NVDA Daily ETF | 0.03 | 2.0 | 0.06 |
| NVDA / 英伟达 NVIDIA | 000044 | 嘉实美国成长股票 | GraniteShares 2x Long NVDA Daily ETF / GraniteShares 2x Long NVDA Daily ETF | 0.03 | 2.0 | 0.06 |
| TSM / 台积电 TSMC（ADR） | 019265 | 南方港股数字经济混合发起(QDII) | Direxion Daily TSM Bull 2X ETF / Direxion Daily TSM Bull 2X ETF | 2.28 | 2.0 | 4.56 |
| TSM / 台积电 TSMC（ADR） | 019266 | 南方港股数字经济混合发起(QDII) | Direxion Daily TSM Bull 2X ETF / Direxion Daily TSM Bull 2X ETF | 2.28 | 2.0 | 4.56 |

## 解析到但未映射的杠杆明细

| 基金代码 | 基金名称 | 基金类型 | 产品代码 | 产品名称 | 原占净值 | 基金半年报原始来源 | 发行方/指数资料 | 处理结果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 000041 | 华夏全球股票(QDII)(人民币) | QDII-普通股票 |  | ProShares UltraPro QQQ | 2.12% | [原始半年报 p.60](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565549) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq) | 已确认暂不映射：ProShares UltraPro QQQ（TQQQ）跟踪 Nasdaq-100 指数的日度 3 倍表现，是多成分股指数产品，不是单一正股；不要映射到 NVDA、MSFT 或 QQQ 等任何个股。 |
| 019549 | 华夏全球股票美元现汇(QDII) | QDII-普通股票 |  | ProShares UltraPro QQQ | 2.12% | [原始半年报 p.60](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565549) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq) | 已确认暂不映射：ProShares UltraPro QQQ（TQQQ）跟踪 Nasdaq-100 指数的日度 3 倍表现，是多成分股指数产品，不是单一正股；不要映射到 NVDA、MSFT 或 QQQ 等任何个股。 |
| 019550 | 华夏全球股票美元现钞(QDII) | QDII-普通股票 |  | ProShares UltraPro QQQ | 2.12% | [原始半年报 p.60](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565549) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq) | 已确认暂不映射：ProShares UltraPro QQQ（TQQQ）跟踪 Nasdaq-100 指数的日度 3 倍表现，是多成分股指数产品，不是单一正股；不要映射到 NVDA、MSFT 或 QQQ 等任何个股。 |
| 000041 | 华夏全球股票(QDII)(人民币) | QDII-普通股票 |  | 2x Long VIX Futures ETF | 0.14% | [原始半年报 p.61](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565549) | [发行方/指数资料](https://www.volatilityshares.com/UVIX) | 已确认暂不映射：Volatility Shares 2x Long VIX Futures ETF（UVIX）跟踪 Long VIX Futures Index（LONGVOL）的日度 2 倍表现，底层为滚动 VIX 期货组合，不对应上市公司正股。 |
| 019549 | 华夏全球股票美元现汇(QDII) | QDII-普通股票 |  | 2x Long VIX Futures ETF | 0.14% | [原始半年报 p.61](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565549) | [发行方/指数资料](https://www.volatilityshares.com/UVIX) | 已确认暂不映射：Volatility Shares 2x Long VIX Futures ETF（UVIX）跟踪 Long VIX Futures Index（LONGVOL）的日度 2 倍表现，底层为滚动 VIX 期货组合，不对应上市公司正股。 |
| 019550 | 华夏全球股票美元现钞(QDII) | QDII-普通股票 |  | 2x Long VIX Futures ETF | 0.14% | [原始半年报 p.61](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565549) | [发行方/指数资料](https://www.volatilityshares.com/UVIX) | 已确认暂不映射：Volatility Shares 2x Long VIX Futures ETF（UVIX）跟踪 Long VIX Futures Index（LONGVOL）的日度 2 倍表现，底层为滚动 VIX 期货组合，不对应上市公司正股。 |
| 001061 | 华夏收益债券(QDII)A | QDII-纯债 |  | Direxion Daily 20+ Year Treasury Bull 3X ETF | 1.08% | [原始半年报 p.39](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565563) | [发行方/指数资料](https://www.direxion.com/product/daily-20-year-treasury-bull-bear-3x-etfs) | 已确认暂不映射：Direxion Daily 20+ Year Treasury Bull 3X ETF（TMF）跟踪 ICE U.S. Treasury 20+ Year Bond Index 的日度 3 倍表现；报告中的 DRX 缩写/拼写噪声作为该产品精确别名保留。它是国债指数产品，不对应正股。 |
| 001063 | 华夏收益债券(QDII)C | QDII-纯债 |  | Direxion Daily 20+ Year Treasury Bull 3X ETF | 1.08% | [原始半年报 p.39](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565563) | [发行方/指数资料](https://www.direxion.com/product/daily-20-year-treasury-bull-bear-3x-etfs) | 已确认暂不映射：Direxion Daily 20+ Year Treasury Bull 3X ETF（TMF）跟踪 ICE U.S. Treasury 20+ Year Bond Index 的日度 3 倍表现；报告中的 DRX 缩写/拼写噪声作为该产品精确别名保留。它是国债指数产品，不对应正股。 |
| 001092 | 广发生物科技指数人民币(QDII)A | 指数型-海外股票 |  | ProShares Ultra Nasdaq Biotechnology | 3.27% | [原始半年报 p.62](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1560879) | — | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016470 | 广发生物科技指数人民币(QDII)C | 指数型-海外股票 |  | ProShares Ultra Nasdaq Biotechnology | 3.27% | [原始半年报 p.62](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1560879) | — | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 004998 | 长信全球债券人民币 | QDII-纯债 |  | DRX DLY 20+ YR TEARS BULL 3X | 2.42% | [原始半年报 p.41](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1569234) | [发行方/指数资料](https://www.direxion.com/product/daily-20-year-treasury-bull-bear-3x-etfs) | 已确认暂不映射：Direxion Daily 20+ Year Treasury Bull 3X ETF（TMF）跟踪 ICE U.S. Treasury 20+ Year Bond Index 的日度 3 倍表现；报告中的 DRX 缩写/拼写噪声作为该产品精确别名保留。它是国债指数产品，不对应正股。 |
| 004999 | 长信全球债券美元 | QDII-纯债 |  | DRX DLY 20+ YR TEARS BULL 3X | 2.42% | [原始半年报 p.41](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1569234) | [发行方/指数资料](https://www.direxion.com/product/daily-20-year-treasury-bull-bear-3x-etfs) | 已确认暂不映射：Direxion Daily 20+ Year Treasury Bull 3X ETF（TMF）跟踪 ICE U.S. Treasury 20+ Year Bond Index 的日度 3 倍表现；报告中的 DRX 缩写/拼写噪声作为该产品精确别名保留。它是国债指数产品，不对应正股。 |
| 005698 | 华夏全球科技先锋混合(QDII)A(人民币) | QDII-混合偏股 |  | Direxion Daily Semiconductor Bull 3X ETF | 8.57% | [原始半年报 p.89](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565728) | — | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019447 | 华夏全球科技先锋混合(QDII)A(美元现汇) | QDII-混合偏股 |  | Direxion Daily Semiconductor Bull 3X ETF | 8.57% | [原始半年报 p.89](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565728) | — | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019448 | 华夏全球科技先锋混合(QDII)A(美元现钞) | QDII-混合偏股 |  | Direxion Daily Semiconductor Bull 3X ETF | 8.57% | [原始半年报 p.89](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565728) | — | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 024239 | 华夏全球科技先锋混合(QDII)C | QDII-混合偏股 |  | Direxion Daily Semiconductor Bull 3X ETF | 8.57% | [原始半年报 p.89](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1565728) | — | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008253 | 华宝致远混合(QDII)A | QDII-混合偏股 |  | Direxion Daily Semiconductor Bull 3X ETF | 2.98% | [原始半年报 p.54](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1572532) | — | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008254 | 华宝致远混合(QDII)C | QDII-混合偏股 |  | Direxion Daily Semiconductor Bull 3X ETF | 2.98% | [原始半年报 p.54](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1572532) | — | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018155 | 创金合信全球医药生物股票发起(QDII)A | QDII-普通股票 |  | DRXN DLY S&P BT BL 3X ETF-UI | 6.46% | [原始半年报 p.49](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1558102) | [发行方/指数资料](https://www.direxion.com/product/daily-sp-biotech-bull-bear-3x-etfs) | 已确认暂不映射：报告原始缩写与 Direxion Daily S&P Biotech Bull 3X ETF（LABU）逐项对应；LABU 跟踪 S&P Biotechnology Select Industry Index 的日度 3 倍表现，是行业指数产品，不应映射到任何单一生物科技股。 |
| 018156 | 创金合信全球医药生物股票发起(QDII)C | QDII-普通股票 |  | DRXN DLY S&P BT BL 3X ETF-UI | 6.46% | [原始半年报 p.49](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1558102) | [发行方/指数资料](https://www.direxion.com/product/daily-sp-biotech-bull-bear-3x-etfs) | 已确认暂不映射：报告原始缩写与 Direxion Daily S&P Biotech Bull 3X ETF（LABU）逐项对应；LABU 跟踪 S&P Biotechnology Select Industry Index 的日度 3 倍表现，是行业指数产品，不应映射到任何单一生物科技股。 |
| 019265 | 南方港股数字经济混合发起(QDII)A | QDII-混合偏股 |  | Direxion Daily Semiconductor Bull 3X ETF | 1.66% | [原始半年报 p.52](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1572993) | — | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019266 | 南方港股数字经济混合发起(QDII)C | QDII-混合偏股 |  | Direxion Daily Semiconductor Bull 3X ETF | 1.66% | [原始半年报 p.52](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1572993) | — | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 159941 | 纳指ETF广发 | 指数型-海外股票 |  | ProShares UltraPro QQQ | 1.7% | [原始半年报 p.49](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1560788) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq) | 已确认暂不映射：ProShares UltraPro QQQ（TQQQ）跟踪 Nasdaq-100 指数的日度 3 倍表现，是多成分股指数产品，不是单一正股；不要映射到 NVDA、MSFT 或 QQQ 等任何个股。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | ProShares Ultra Gold | 10.02% | [原始半年报 p.38](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1562683) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/ugl) | 已确认暂不映射：ProShares Ultra Gold（UGL）跟踪 Bloomberg Gold Subindex 的日度 2 倍表现，底层为黄金期货/掉期等商品敞口，不是公司正股，也不应映射到金矿股。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | ProShares Ultra Gold | 10.02% | [原始半年报 p.38](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1562683) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/ugl) | 已确认暂不映射：ProShares Ultra Gold（UGL）跟踪 Bloomberg Gold Subindex 的日度 2 倍表现，底层为黄金期货/掉期等商品敞口，不是公司正股，也不应映射到金矿股。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | Direxion Daily 20+ Year Treasury Bull 3X ETF | 3.22% | [原始半年报 p.39](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1562683) | [发行方/指数资料](https://www.direxion.com/product/daily-20-year-treasury-bull-bear-3x-etfs) | 已确认暂不映射：Direxion Daily 20+ Year Treasury Bull 3X ETF（TMF）跟踪 ICE U.S. Treasury 20+ Year Bond Index 的日度 3 倍表现；报告中的 DRX 缩写/拼写噪声作为该产品精确别名保留。它是国债指数产品，不对应正股。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | Direxion Daily 20+ Year Treasury Bull 3X ETF | 3.22% | [原始半年报 p.39](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1562683) | [发行方/指数资料](https://www.direxion.com/product/daily-20-year-treasury-bull-bear-3x-etfs) | 已确认暂不映射：Direxion Daily 20+ Year Treasury Bull 3X ETF（TMF）跟踪 ICE U.S. Treasury 20+ Year Bond Index 的日度 3 倍表现；报告中的 DRX 缩写/拼写噪声作为该产品精确别名保留。它是国债指数产品，不对应正股。 |
| 004243 | 广发道琼斯石油指数人民币C | 指数型-海外股票 |  | ProShares Ultra Energy | 1.89% | [原始半年报 p.47](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1561293) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/dig) | 已确认暂不映射：ProShares Ultra Energy (DIG) 是 2x 能源行业指数 ETF，跟踪 S&P Energy Select Sector Index，不是单一正股杠杆产品；不要映射到 XOM/CVX 等站内正股。 |
| 006679 | 广发道琼斯石油指数美元现汇A | 指数型-海外股票 |  | ProShares Ultra Energy | 1.89% | [原始半年报 p.47](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1561293) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/dig) | 已确认暂不映射：ProShares Ultra Energy (DIG) 是 2x 能源行业指数 ETF，跟踪 S&P Energy Select Sector Index，不是单一正股杠杆产品；不要映射到 XOM/CVX 等站内正股。 |
| 006680 | 广发道琼斯石油指数美元现汇C | 指数型-海外股票 |  | ProShares Ultra Energy | 1.89% | [原始半年报 p.47](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1561293) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/dig) | 已确认暂不映射：ProShares Ultra Energy (DIG) 是 2x 能源行业指数 ETF，跟踪 S&P Energy Select Sector Index，不是单一正股杠杆产品；不要映射到 XOM/CVX 等站内正股。 |
| 162719 | 广发道琼斯石油指数人民币A | 指数型-海外股票 |  | ProShares Ultra Energy | 1.89% | [原始半年报 p.47](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1561293) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/dig) | 已确认暂不映射：ProShares Ultra Energy (DIG) 是 2x 能源行业指数 ETF，跟踪 S&P Energy Select Sector Index，不是单一正股杠杆产品；不要映射到 XOM/CVX 等站内正股。 |
| 018543 | 汇添富黄金及贵金属(QDII-LOF-FOF)C | QDII-商品 |  | ProShares Ultra Gold | 5.83% | [原始半年报 p.48](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1566889) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/ugl) | 已确认暂不映射：ProShares Ultra Gold（UGL）跟踪 Bloomberg Gold Subindex 的日度 2 倍表现，底层为黄金期货/掉期等商品敞口，不是公司正股，也不应映射到金矿股。 |
| 164701 | 汇添富黄金及贵金属(QDII-LOF-FOF)A | QDII-商品 |  | ProShares Ultra Gold | 5.83% | [原始半年报 p.48](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1566889) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/ugl) | 已确认暂不映射：ProShares Ultra Gold（UGL）跟踪 Bloomberg Gold Subindex 的日度 2 倍表现，底层为黄金期货/掉期等商品敞口，不是公司正股，也不应映射到金矿股。 |
| 006479 | 广发纳斯达克100ETF联接人民币(QDII)C | 指数型-海外股票 |  | ProShares UltraPro QQQ | 0.95% | [原始半年报 p.45](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1561661) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq) | 已确认暂不映射：ProShares UltraPro QQQ（TQQQ）跟踪 Nasdaq-100 指数的日度 3 倍表现，是多成分股指数产品，不是单一正股；不要映射到 NVDA、MSFT 或 QQQ 等任何个股。 |
| 270042 | 广发纳斯达克100ETF联接人民币(QDII)A | 指数型-海外股票 |  | ProShares UltraPro QQQ | 0.95% | [原始半年报 p.45](http://eid.csrc.gov.cn/fund/disclose/instance_show_pdf_id.do?instanceid=1561661) | [发行方/指数资料](https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq) | 已确认暂不映射：ProShares UltraPro QQQ（TQQQ）跟踪 Nasdaq-100 指数的日度 3 倍表现，是多成分股指数产品，不是单一正股；不要映射到 NVDA、MSFT 或 QQQ 等任何个股。 |

## 候选跳过 / 未进入 indirectExposureRows

| 基金代码 | 基金名称 | 基金类型 | 状态 | 解析杠杆行 | 映射行 | 原因 |
| --- | --- | --- | --- | --- | --- | --- |
| 003721 | 易方达标普信息科技指数(QDII-LOF)A(美元现汇) | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 005491 | 兴全合宜混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 006127 | 华宝港股通标普香港上市中国中小盘指数(LOF)C | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 008973 | 大成中华沪深港300指数(LOF)C | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 010365 | 鹏华中证香港银行指数(LOF)C | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 010789 | 汇添富恒生指数(QDII-LOF)C | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 011159 | 大成中小盘混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 012809 | 鹏华中证沪港深科技龙头指数(LOF)C | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 012868 | 易方达标普信息科技指数(QDII-LOF)C(人民币) | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 012869 | 易方达标普信息科技指数(QDII-LOF)C(美元现汇) | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 012884 | 华夏港股通精选股票发起式(LOF)C | 股票型 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 013027 | 银华富久食品饮料精选混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 013944 | 招商智星稳健配置混合(FOF-LOF)C | FOF-稳健型 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 013945 | 交银中证海外中国互联网指数(LOF)C | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 014982 | 华安标普全球石油指数(LOF)C | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 015491 | 博时科创主题灵活配置混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 015546 | 大成恒生指数(QDII-LOF)C | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 017290 | 中欧科创主题混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 017767 | 嘉实欣荣混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 018007 | 招商瑞利灵活配置混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 018238 | 广发恒生中型股指数(LOF)E | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 018860 | 嘉实产业优选混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 018948 | 东方红睿满沪港深混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 018949 | 东方红睿华沪港深混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 019710 | 广发道琼斯石油指数(QDII-LOF)人民币E | 指数型-海外股票 | 解析到杠杆明细 | 1 | 0 | 解析到杠杆明细，但未通过映射配置匹配到站内正股 |
| 019711 | 广发道琼斯石油指数(QDII-LOF)美元现汇E | 指数型-海外股票 | 解析到杠杆明细 | 1 | 0 | 解析到杠杆明细，但未通过映射配置匹配到站内正股 |
| 022182 | 招商智星稳健配置混合(FOF-LOF)D | FOF-稳健型 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 022834 | 鹏华中证沪港深科技龙头指数(LOF)I | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 024114 | 泓德丰泽混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 025127 | 鹏华中证香港银行指数(LOF)I | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 025330 | 银华恒生国企指数(QDII-LOF)C | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 025988 | 鹏华创新未来混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160127 | 南方新兴消费增长股票(LOF)A | 股票型 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160142 | 南方优势产业(LOF) | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160144 | 南方新兴消费增长股票(LOF)C | 股票型 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160322 | 华夏港股通精选股票发起式(LOF)A | 股票型 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160416 | 华安标普全球石油指数(LOF)A | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160527 | 博时研究优选混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160528 | 博时研究优选混合(LOF)C | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160646 | 鹏华中证沪港深科技龙头指数(LOF)A | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160717 | 嘉实H股指数(QDII-LOF) | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160918 | 大成中小盘混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160924 | 大成恒生指数(QDII-LOF)A | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 160925 | 大成中华沪深港300指数(LOF)A | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 161128 | 易方达标普信息科技指数(QDII-LOF)A(人民币) | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 161728 | 招商瑞智优选混合(LOF) | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 161729 | 招商瑞利灵活配置混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 161730 | 招商智星稳健配置混合(FOF-LOF)A | FOF-稳健型 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 161831 | 银华恒生国企指数(QDII-LOF)A | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 163417 | 兴全合宜混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 164705 | 汇添富恒生指数(QDII-LOF)A | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 164906 | 交银中证海外中国互联网指数(LOF)A | 指数型-海外股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 167302 | 方正富邦大湾区综指(LOF) | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 167508 | 安信价值发现两年定开混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 169104 | 东方红睿满沪港深混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 169105 | 东方红睿华沪港深混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501021 | 华宝港股通标普香港上市中国中小盘指数(LOF)A | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501025 | 鹏华中证香港银行指数(LOF)A | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501062 | 南方瑞合定开混合(LOF) | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501071 | 泓德丰泽混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501076 | 鹏华创新动力混合(LOF) | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501081 | 中欧科创主题混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501082 | 博时科创主题灵活配置混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501087 | 交银瑞丰混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501091 | 嘉实欣荣混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501092 | 交银瑞思混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501098 | 建信优享科技创新混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501188 | 汇添富核心精选混合(LOF) | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501189 | 嘉实产业优选混合(LOF)A | 混合型-灵活 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501203 | 易方达创新未来混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501205 | 鹏华创新未来混合(LOF)C | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501206 | 汇添富创新未来混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501207 | 华夏创新未来混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501208 | 中欧创新未来混合(LOF) | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501209 | 银华富久食品饮料精选混合(LOF)A | 混合型-偏股 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
| 501303 | 广发恒生中型股指数(LOF)A | 指数型-股票 | 报告已解析，无正向杠杆明细 | 0 | 0 | 报告已解析，但基金投资明细里没有正向个股杠杆产品 |
