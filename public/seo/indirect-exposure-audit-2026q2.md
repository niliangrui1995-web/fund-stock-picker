# 2026Q2 间接 / 杠杆 ETF 暴露维护审计

只读维护产物，由 `scripts/build_fund_stock_index.py` 根据定期报告解析结果、`config/stock-exposure-aliases.json` 和最终前端数据生成；不要手工修改它来修页面展示。

- 生成时间：`2026-09-01T02:25:15`
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
| knownProducts 产品数 | 18 |
| ignoredProducts 暂不映射产品数 | 1 |

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
| 7709.HK | CSOP SK H ynix Daily 2 x Leveraged Product | 000660 / SK HYNIX INC | 2.0 | known product name alias -> 7709.HK | 4 | 016664, 016665, 016823, 164212 |
| 7709.HK | CSOP SK Hynix Daily 2x Leveraged Product | 000660 / SK HYNIX INC | 2.0 | known product name alias -> 7709.HK | 9 | 002230, 005698, 018229, 018230, 018231, 018232, 019447, 019448, 024239 |
| 7747.HK | CSOP Sams ung Electro nics Daily 2 x Leveraged Product | 005930 / 三星电子有限公司 | 2.0 | known product name alias -> 7747.HK | 4 | 016664, 016665, 016823, 164212 |
| 7747.HK | CSOP Samsung Electronics Daily 2x Leveraged Product | 005930 / 三星电子有限公司 | 2.0 | known product name alias -> 7747.HK | 5 | 002230, 018229, 018230, 018231, 018232 |
| Defiance Daily Target 2X Long AMAT ETF | Defiance Daily Target 2X Long AMAT ETF | AMAT / 应用材料公司 | 2.0 | name matched AMAT | 1 | 001691 |
| Defiance Daily Target 2X Long NOK ETF | Defiance Daily Target 2X Long NOK ETF | NOK / 诺基亚 | 2.0 | name matched NOK | 2 | 019265, 019266 |
| Direxion Daily ASML Bull 2X ETF | Direxion Daily ASML Bull 2X ETF | ASML / 阿斯麦控股公司 | 2.0 | name matched ASML | 1 | 001691 |
| Direxion Daily Intc Bull 2X ETF | Direxion Daily Intc Bull 2X ETF | INTC / 英特尔公司 | 2.0 | name matched INTC | 1 | 001691 |
| Direxion Daily TSM Bull 2X ETF | Direxion Daily TSM Bull 2X ETF | TSM / 台湾积体电路制造股份有限公司 | 2.0 | name matched TSM | 2 | 019265, 019266 |
| GraniteSha res 2x Long NVDA Daily ETF | GraniteSha res 2x Long NVDA Daily ETF | NVDA / 英伟达 | 2.0 | name matched NVDA | 2 | 000043, 000044 |
| Granitesha res 2x Long AMD Daily ETF | Granitesha res 2x Long AMD Daily ETF | AMD / ADVANCED MICRO DEVICES INC | 2.0 | name matched AMD | 2 | 019265, 019266 |
| Tradr 2X Long ALAB Daily ETF | Tradr 2X Long ALAB Daily ETF | ALAB / ASTERA LABS INC | 2.0 | name matched ALAB | 2 | 019265, 019266 |
| Tradr 2X Long LRCX Daily ETF | Tradr 2X Long LRCX Daily ETF | LRCX / 泛林集团 | 2.0 | name matched LRCX | 1 | 001691 |

## 最终进入 indirectExposureRows

| 正股 | 基金代码 | 基金名称 | 杠杆产品 | 原占净值 | 杠杆倍数 | 估算暴露 |
| --- | --- | --- | --- | --- | --- | --- |
| 000660 / SK HYNIX INC | 002230 | 华夏大中华混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 1.26 | 2.0 | 2.52 |
| 000660 / SK HYNIX INC | 005698 | 华夏全球科技先锋混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 1.01 | 2.0 | 2.02 |
| 000660 / SK HYNIX INC | 016664 | 天弘全球高端制造混合(QDII) | 7709.HK / CSOP SK H ynix Daily 2 x Leveraged Product | 7.44 | 2.0 | 14.88 |
| 000660 / SK HYNIX INC | 016665 | 天弘全球高端制造混合(QDII) | 7709.HK / CSOP SK H ynix Daily 2 x Leveraged Product | 7.44 | 2.0 | 14.88 |
| 000660 / SK HYNIX INC | 016823 | 天弘全球新能源汽车股票(QDII-LOF) | 7709.HK / CSOP SK H ynix Daily 2 x Leveraged Product | 4.87 | 2.0 | 9.74 |
| 000660 / SK HYNIX INC | 018229 | 易方达全球优质企业混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 0.73 | 2.0 | 1.46 |
| 000660 / SK HYNIX INC | 018230 | 易方达全球优质企业混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 0.73 | 2.0 | 1.46 |
| 000660 / SK HYNIX INC | 018231 | 易方达全球优质企业混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 0.73 | 2.0 | 1.46 |
| 000660 / SK HYNIX INC | 018232 | 易方达全球优质企业混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 0.73 | 2.0 | 1.46 |
| 000660 / SK HYNIX INC | 019447 | 华夏全球科技先锋混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 1.01 | 2.0 | 2.02 |
| 000660 / SK HYNIX INC | 019448 | 华夏全球科技先锋混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 1.01 | 2.0 | 2.02 |
| 000660 / SK HYNIX INC | 024239 | 华夏全球科技先锋混合(QDII) | 7709.HK / CSOP SK Hynix Daily 2x Leveraged Product | 1.01 | 2.0 | 2.02 |
| 000660 / SK HYNIX INC | 164212 | 天弘全球新能源汽车股票(QDII-LOF) | 7709.HK / CSOP SK H ynix Daily 2 x Leveraged Product | 4.87 | 2.0 | 9.74 |
| 005930 / 三星电子有限公司 | 002230 | 华夏大中华混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 1.06 | 2.0 | 2.12 |
| 005930 / 三星电子有限公司 | 016664 | 天弘全球高端制造混合(QDII) | 7747.HK / CSOP Sams ung Electro nics Daily 2 x Leveraged Product | 1.5 | 2.0 | 3.0 |
| 005930 / 三星电子有限公司 | 016665 | 天弘全球高端制造混合(QDII) | 7747.HK / CSOP Sams ung Electro nics Daily 2 x Leveraged Product | 1.5 | 2.0 | 3.0 |
| 005930 / 三星电子有限公司 | 016823 | 天弘全球新能源汽车股票(QDII-LOF) | 7747.HK / CSOP Sams ung Electro nics Daily 2 x Leveraged Product | 1.9 | 2.0 | 3.8 |
| 005930 / 三星电子有限公司 | 018229 | 易方达全球优质企业混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82 | 2.0 | 1.64 |
| 005930 / 三星电子有限公司 | 018230 | 易方达全球优质企业混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82 | 2.0 | 1.64 |
| 005930 / 三星电子有限公司 | 018231 | 易方达全球优质企业混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82 | 2.0 | 1.64 |
| 005930 / 三星电子有限公司 | 018232 | 易方达全球优质企业混合(QDII) | 7747.HK / CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82 | 2.0 | 1.64 |
| 005930 / 三星电子有限公司 | 164212 | 天弘全球新能源汽车股票(QDII-LOF) | 7747.HK / CSOP Sams ung Electro nics Daily 2 x Leveraged Product | 1.9 | 2.0 | 3.8 |
| ALAB / ASTERA LABS INC | 019265 | 南方港股数字经济混合发起(QDII) | Tradr 2X Long ALAB Daily ETF / Tradr 2X Long ALAB Daily ETF | 2.75 | 2.0 | 5.5 |
| ALAB / ASTERA LABS INC | 019266 | 南方港股数字经济混合发起(QDII) | Tradr 2X Long ALAB Daily ETF / Tradr 2X Long ALAB Daily ETF | 2.75 | 2.0 | 5.5 |
| AMAT / 应用材料公司 | 001691 | 南方香港成长灵活配置混合 | Defiance Daily Target 2X Long AMAT ETF / Defiance Daily Target 2X Long AMAT ETF | 0.85 | 2.0 | 1.7 |
| AMD / ADVANCED MICRO DEVICES INC | 019265 | 南方港股数字经济混合发起(QDII) | Granitesha res 2x Long AMD Daily ETF / Granitesha res 2x Long AMD Daily ETF | 1.67 | 2.0 | 3.34 |
| AMD / ADVANCED MICRO DEVICES INC | 019266 | 南方港股数字经济混合发起(QDII) | Granitesha res 2x Long AMD Daily ETF / Granitesha res 2x Long AMD Daily ETF | 1.67 | 2.0 | 3.34 |
| ASML / 阿斯麦控股公司 | 001691 | 南方香港成长灵活配置混合 | Direxion Daily ASML Bull 2X ETF / Direxion Daily ASML Bull 2X ETF | 0.29 | 2.0 | 0.58 |
| INTC / 英特尔公司 | 001691 | 南方香港成长灵活配置混合 | Direxion Daily Intc Bull 2X ETF / Direxion Daily Intc Bull 2X ETF | 1.3 | 2.0 | 2.6 |
| LRCX / 泛林集团 | 001691 | 南方香港成长灵活配置混合 | Tradr 2X Long LRCX Daily ETF / Tradr 2X Long LRCX Daily ETF | 1.29 | 2.0 | 2.58 |
| NOK / 诺基亚 | 019265 | 南方港股数字经济混合发起(QDII) | Defiance Daily Target 2X Long NOK ETF / Defiance Daily Target 2X Long NOK ETF | 1.01 | 2.0 | 2.02 |
| NOK / 诺基亚 | 019266 | 南方港股数字经济混合发起(QDII) | Defiance Daily Target 2X Long NOK ETF / Defiance Daily Target 2X Long NOK ETF | 1.01 | 2.0 | 2.02 |
| NVDA / 英伟达 | 000043 | 嘉实美国成长股票 | GraniteSha res 2x Long NVDA Daily ETF / GraniteSha res 2x Long NVDA Daily ETF | 0.03 | 2.0 | 0.06 |
| NVDA / 英伟达 | 000044 | 嘉实美国成长股票 | GraniteSha res 2x Long NVDA Daily ETF / GraniteSha res 2x Long NVDA Daily ETF | 0.03 | 2.0 | 0.06 |
| TSM / 台湾积体电路制造股份有限公司 | 019265 | 南方港股数字经济混合发起(QDII) | Direxion Daily TSM Bull 2X ETF / Direxion Daily TSM Bull 2X ETF | 2.28 | 2.0 | 4.56 |
| TSM / 台湾积体电路制造股份有限公司 | 019266 | 南方港股数字经济混合发起(QDII) | Direxion Daily TSM Bull 2X ETF / Direxion Daily TSM Bull 2X ETF | 2.28 | 2.0 | 4.56 |

## 解析到但未映射的杠杆明细

| 基金代码 | 基金名称 | 基金类型 | 产品代码 | 产品名称 | 原占净值 | 处理结果 |
| --- | --- | --- | --- | --- | --- | --- |
| 000041 | 华夏全球股票(QDII)(人民币) | QDII-普通股票 |  | ProShares UltraPro QQQ | 2.12% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019549 | 华夏全球股票美元现汇(QDII) | QDII-普通股票 |  | ProShares UltraPro QQQ | 2.12% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019550 | 华夏全球股票美元现钞(QDII) | QDII-普通股票 |  | ProShares UltraPro QQQ | 2.12% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000041 | 华夏全球股票(QDII)(人民币) | QDII-普通股票 |  | iShares Expanded Tech-Software Sector ETF | 0.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019549 | 华夏全球股票美元现汇(QDII) | QDII-普通股票 |  | iShares Expanded Tech-Software Sector ETF | 0.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019550 | 华夏全球股票美元现钞(QDII) | QDII-普通股票 |  | iShares Expanded Tech-Software Sector ETF | 0.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000041 | 华夏全球股票(QDII)(人民币) | QDII-普通股票 |  | State Street Utilities Select Sector SPDR ETF | 0.61% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019549 | 华夏全球股票美元现汇(QDII) | QDII-普通股票 |  | State Street Utilities Select Sector SPDR ETF | 0.61% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019550 | 华夏全球股票美元现钞(QDII) | QDII-普通股票 |  | State Street Utilities Select Sector SPDR ETF | 0.61% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000041 | 华夏全球股票(QDII)(人民币) | QDII-普通股票 |  | State Street SPDR S&P Biotech ETF | 0.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019549 | 华夏全球股票美元现汇(QDII) | QDII-普通股票 |  | State Street SPDR S&P Biotech ETF | 0.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019550 | 华夏全球股票美元现钞(QDII) | QDII-普通股票 |  | State Street SPDR S&P Biotech ETF | 0.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000041 | 华夏全球股票(QDII)(人民币) | QDII-普通股票 |  | State Street SPDR S&P Metals & Mining ETF | 0.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019549 | 华夏全球股票美元现汇(QDII) | QDII-普通股票 |  | State Street SPDR S&P Metals & Mining ETF | 0.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019550 | 华夏全球股票美元现钞(QDII) | QDII-普通股票 |  | State Street SPDR S&P Metals & Mining ETF | 0.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000041 | 华夏全球股票(QDII)(人民币) | QDII-普通股票 |  | iShares Semiconducto r ETF | 0.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019549 | 华夏全球股票美元现汇(QDII) | QDII-普通股票 |  | iShares Semiconducto r ETF | 0.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019550 | 华夏全球股票美元现钞(QDII) | QDII-普通股票 |  | iShares Semiconducto r ETF | 0.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000041 | 华夏全球股票(QDII)(人民币) | QDII-普通股票 |  | 2x Long VIX Futures ETF | 0.14% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019549 | 华夏全球股票美元现汇(QDII) | QDII-普通股票 |  | 2x Long VIX Futures ETF | 0.14% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019550 | 华夏全球股票美元现钞(QDII) | QDII-普通股票 |  | 2x Long VIX Futures ETF | 0.14% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000043 | 嘉实美国成长股票人民币 | QDII-普通股票 |  | SPDR Gold Shares | 0.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000044 | 嘉实美国成长股票美元现汇 | QDII-普通股票 |  | SPDR Gold Shares | 0.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000043 | 嘉实美国成长股票人民币 | QDII-普通股票 |  | VanEck Gold Miners ETF/USA | 0.08% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000044 | 嘉实美国成长股票美元现汇 | QDII-普通股票 |  | VanEck Gold Miners ETF/USA | 0.08% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000043 | 嘉实美国成长股票人民币 | QDII-普通股票 |  | GraniteSha res 2x Long NVDA Daily ETF | 0.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000044 | 嘉实美国成长股票美元现汇 | QDII-普通股票 |  | GraniteSha res 2x Long NVDA Daily ETF | 0.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000043 | 嘉实美国成长股票人民币 | QDII-普通股票 |  | Invesco Golden Dragon China ETF | 0.01% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000044 | 嘉实美国成长股票美元现汇 | QDII-普通股票 |  | Invesco Golden Dragon China ETF | 0.01% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000071 | 华夏恒生ETF联接A | 指数型-海外股票 |  | 华夏恒生 ETF | 91.75% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006381 | 华夏恒生ETF联接C | 指数型-海外股票 |  | 华夏恒生 ETF | 91.75% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000103 | 国泰境外高收益债(QDII) | QDII-纯债 |  | Direxion | 4.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000103 | 国泰境外高收益债(QDII) | QDII-纯债 |  | iShares 7-10 Year Treasury Bond ETF | 4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000179 | 广发美国房地产指数人民币(QDII)A | 指数型-海外股票 |  | Vanguard Real Estate ETF | 0.05% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016278 | 广发美国房地产指数人民币(QDII)C | 指数型-海外股票 |  | Vanguard Real Estate ETF | 0.05% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000290 | 鹏华全球高收益债(QDII) | QDII-纯债 |  | ISHARES 20+ YEAR TREASURY BO | 0.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001876 | 鹏华全球高收益债美元现汇 | QDII-纯债 |  | ISHARES 20+ YEAR TREASURY BO | 0.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000369 | 广发全球医疗保健指数人民币(QDII)A | 指数型-海外股票 |  | iShares Global Healthcare ETF | 4.52% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016280 | 广发全球医疗保健指数人民币(QDII)C | 指数型-海外股票 |  | iShares Global Healthcare ETF | 4.52% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000614 | 华安德国(DAX)联接(QDII)A | 指数型-海外股票 |  | 华安国际龙头 （DAX）交易型开放式指数证券投资基金 | 94.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 015016 | 华安德国(DAX)联接(QDII)C | 指数型-海外股票 |  | 华安国际龙头 （DAX）交易型开放式指数证券投资基金 | 94.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000834 | 大成纳斯达克100ETF联接(QDII)A | 指数型-海外股票 |  | 大成纳斯达克100ETF （QDII） | 90.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008971 | 大成纳斯达克100ETF联接(QDII)C | 指数型-海外股票 |  | 大成纳斯达克100ETF （QDII） | 90.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001061 | 华夏收益债券(QDII)A | QDII-纯债 |  | iShares 20+ Year Treasury Bond ETF | 2.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001063 | 华夏收益债券(QDII)C | QDII-纯债 |  | iShares 20+ Year Treasury Bond ETF | 2.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001061 | 华夏收益债券(QDII)A | QDII-纯债 |  | Nuveen Preferred & Income Opportunitie s Fund | 1.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001063 | 华夏收益债券(QDII)C | QDII-纯债 |  | Nuveen Preferred & Income Opportunitie s Fund | 1.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001061 | 华夏收益债券(QDII)A | QDII-纯债 |  | Direxion Daily 20+ Year Treasury Bull 3X ETF | 1.08% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001063 | 华夏收益债券(QDII)C | QDII-纯债 |  | Direxion Daily 20+ Year Treasury Bull 3X ETF | 1.08% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001061 | 华夏收益债券(QDII)A | QDII-纯债 |  | Morgan Stanley | 0.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001063 | 华夏收益债券(QDII)C | QDII-纯债 |  | Morgan Stanley | 0.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001061 | 华夏收益债券(QDII)A | QDII-纯债 |  | Calamos Convertible and High Income Fund | 0.21% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001063 | 华夏收益债券(QDII)C | QDII-纯债 |  | Calamos Convertible and High Income Fund | 0.21% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001061 | 华夏收益债券(QDII)A | QDII-纯债 |  | iShares Preferred and Income Securities ETF | 0.12% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001063 | 华夏收益债券(QDII)C | QDII-纯债 |  | iShares Preferred and Income Securities ETF | 0.12% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001092 | 广发生物科技指数人民币(QDII)A | 指数型-海外股票 |  | ProShares Ultra Nasdaq Biotechnol ogy | 3.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016470 | 广发生物科技指数人民币(QDII)C | 指数型-海外股票 |  | ProShares Ultra Nasdaq Biotechnol ogy | 3.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001691 | 南方香港成长灵活配置混合 | QDII-混合灵活 |  | Direxion Daily Intc Bull 2X ETF | 1.3% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001691 | 南方香港成长灵活配置混合 | QDII-混合灵活 |  | Tradr 2X Long LRCX Daily ETF | 1.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001691 | 南方香港成长灵活配置混合 | QDII-混合灵活 |  | Defiance Daily Target 2X Long AMAT ETF | 0.85% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 001691 | 南方香港成长灵活配置混合 | QDII-混合灵活 |  | Direxion Daily ASML Bull 2X ETF | 0.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002230 | 华夏大中华混合(QDII) | QDII-混合灵活 |  | CSOP SK Hynix Daily 2x Leveraged Product | 1.26% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002230 | 华夏大中华混合(QDII) | QDII-混合灵活 |  | CSOP Samsung Electronics Daily 2x Leveraged Product | 1.06% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002877 | 华夏大中华信用债A | QDII-纯债 |  | Calamos Convertible and High Income Fund | 0.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002878 | 华夏大中华信用债美元现汇A | QDII-纯债 |  | Calamos Convertible and High Income Fund | 0.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002879 | 华夏大中华信用债美元现钞A | QDII-纯债 |  | Calamos Convertible and High Income Fund | 0.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002880 | 华夏大中华信用债C | QDII-纯债 |  | Calamos Convertible and High Income Fund | 0.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002877 | 华夏大中华信用债A | QDII-纯债 |  | DoubleLine Income Solutions Fund | 0% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002878 | 华夏大中华信用债美元现汇A | QDII-纯债 |  | DoubleLine Income Solutions Fund | 0% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002879 | 华夏大中华信用债美元现钞A | QDII-纯债 |  | DoubleLine Income Solutions Fund | 0% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002880 | 华夏大中华信用债C | QDII-纯债 |  | DoubleLine Income Solutions Fund | 0% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002877 | 华夏大中华信用债A | QDII-纯债 |  | BlackRock Corporate High Yield Fund Inc | 0% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002878 | 华夏大中华信用债美元现汇A | QDII-纯债 |  | BlackRock Corporate High Yield Fund Inc | 0% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002879 | 华夏大中华信用债美元现钞A | QDII-纯债 |  | BlackRock Corporate High Yield Fund Inc | 0% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002880 | 华夏大中华信用债C | QDII-纯债 |  | BlackRock Corporate High Yield Fund Inc | 0% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002891 | 华夏移动互联混合人民币 | QDII-混合灵活 |  | iShares MSCI South Korea ETF | 2.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002892 | 华夏移动互联混合美元现汇 | QDII-混合灵活 |  | iShares MSCI South Korea ETF | 2.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002893 | 华夏移动互联混合美元现钞 | QDII-混合灵活 |  | iShares MSCI South Korea ETF | 2.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002891 | 华夏移动互联混合人民币 | QDII-混合灵活 |  | CSOP SK Hynix | 1.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002892 | 华夏移动互联混合美元现汇 | QDII-混合灵活 |  | CSOP SK Hynix | 1.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 002893 | 华夏移动互联混合美元现钞 | QDII-混合灵活 |  | CSOP SK Hynix | 1.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003629 | 摩根全球多元配置(QDII-FOF)人民币A | QDII-混合平衡 |  | JPM US GROWTH I (ACC) - USD | 17.33% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003630 | 摩根全球多元配置(QDII-FOF)美元现钞 | QDII-混合平衡 |  | JPM US GROWTH I (ACC) - USD | 17.33% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003631 | 摩根全球多元配置(QDII-FOF)美元现汇 | QDII-混合平衡 |  | JPM US GROWTH I (ACC) - USD | 17.33% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019512 | 摩根全球多元配置(QDII-FOF)人民币C | QDII-混合平衡 |  | JPM US GROWTH I (ACC) - USD | 17.33% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003629 | 摩根全球多元配置(QDII-FOF)人民币A | QDII-混合平衡 |  | JPM US VALUE I (ACC) - USD | 14.06% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003630 | 摩根全球多元配置(QDII-FOF)美元现钞 | QDII-混合平衡 |  | JPM US VALUE I (ACC) - USD | 14.06% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003631 | 摩根全球多元配置(QDII-FOF)美元现汇 | QDII-混合平衡 |  | JPM US VALUE I (ACC) - USD | 14.06% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019512 | 摩根全球多元配置(QDII-FOF)人民币C | QDII-混合平衡 |  | JPM US VALUE I (ACC) - USD | 14.06% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003629 | 摩根全球多元配置(QDII-FOF)人民币A | QDII-混合平衡 |  | JPMORGAN SAR-GLOBAL BD FD-C | 13.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003630 | 摩根全球多元配置(QDII-FOF)美元现钞 | QDII-混合平衡 |  | JPMORGAN SAR-GLOBAL BD FD-C | 13.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003631 | 摩根全球多元配置(QDII-FOF)美元现汇 | QDII-混合平衡 |  | JPMORGAN SAR-GLOBAL BD FD-C | 13.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019512 | 摩根全球多元配置(QDII-FOF)人民币C | QDII-混合平衡 |  | JPMORGAN SAR-GLOBAL BD FD-C | 13.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003629 | 摩根全球多元配置(QDII-FOF)人民币A | QDII-混合平衡 |  | JPM GLOB CORP BD I (ACC) USD | 12.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003630 | 摩根全球多元配置(QDII-FOF)美元现钞 | QDII-混合平衡 |  | JPM GLOB CORP BD I (ACC) USD | 12.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003631 | 摩根全球多元配置(QDII-FOF)美元现汇 | QDII-混合平衡 |  | JPM GLOB CORP BD I (ACC) USD | 12.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019512 | 摩根全球多元配置(QDII-FOF)人民币C | QDII-混合平衡 |  | JPM GLOB CORP BD I (ACC) USD | 12.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003629 | 摩根全球多元配置(QDII-FOF)人民币A | QDII-混合平衡 |  | JPM EME MKT OPPS I(ACC)-USD | 7.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003630 | 摩根全球多元配置(QDII-FOF)美元现钞 | QDII-混合平衡 |  | JPM EME MKT OPPS I(ACC)-USD | 7.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003631 | 摩根全球多元配置(QDII-FOF)美元现汇 | QDII-混合平衡 |  | JPM EME MKT OPPS I(ACC)-USD | 7.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019512 | 摩根全球多元配置(QDII-FOF)人民币C | QDII-混合平衡 |  | JPM EME MKT OPPS I(ACC)-USD | 7.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003629 | 摩根全球多元配置(QDII-FOF)人民币A | QDII-混合平衡 |  | JPM US SEL EQ I (ACC)-USD | 5.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003630 | 摩根全球多元配置(QDII-FOF)美元现钞 | QDII-混合平衡 |  | JPM US SEL EQ I (ACC)-USD | 5.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003631 | 摩根全球多元配置(QDII-FOF)美元现汇 | QDII-混合平衡 |  | JPM US SEL EQ I (ACC)-USD | 5.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019512 | 摩根全球多元配置(QDII-FOF)人民币C | QDII-混合平衡 |  | JPM US SEL EQ I (ACC)-USD | 5.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003629 | 摩根全球多元配置(QDII-FOF)人民币A | QDII-混合平衡 |  | JPMI GLOBAL SELECT EQ - I ACC $ | 5.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003630 | 摩根全球多元配置(QDII-FOF)美元现钞 | QDII-混合平衡 |  | JPMI GLOBAL SELECT EQ - I ACC $ | 5.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003631 | 摩根全球多元配置(QDII-FOF)美元现汇 | QDII-混合平衡 |  | JPMI GLOBAL SELECT EQ - I ACC $ | 5.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019512 | 摩根全球多元配置(QDII-FOF)人民币C | QDII-混合平衡 |  | JPMI GLOBAL SELECT EQ - I ACC $ | 5.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003629 | 摩根全球多元配置(QDII-FOF)人民币A | QDII-混合平衡 |  | JPM EUR DYNAMIC I (ACC) - EUR | 3.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003630 | 摩根全球多元配置(QDII-FOF)美元现钞 | QDII-混合平衡 |  | JPM EUR DYNAMIC I (ACC) - EUR | 3.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003631 | 摩根全球多元配置(QDII-FOF)美元现汇 | QDII-混合平衡 |  | JPM EUR DYNAMIC I (ACC) - EUR | 3.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019512 | 摩根全球多元配置(QDII-FOF)人民币C | QDII-混合平衡 |  | JPM EUR DYNAMIC I (ACC) - EUR | 3.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003629 | 摩根全球多元配置(QDII-FOF)人民币A | QDII-混合平衡 |  | JPM EUR SEL EQ I (ACC) - USDHED | 3.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003630 | 摩根全球多元配置(QDII-FOF)美元现钞 | QDII-混合平衡 |  | JPM EUR SEL EQ I (ACC) - USDHED | 3.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003631 | 摩根全球多元配置(QDII-FOF)美元现汇 | QDII-混合平衡 |  | JPM EUR SEL EQ I (ACC) - USDHED | 3.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019512 | 摩根全球多元配置(QDII-FOF)人民币C | QDII-混合平衡 |  | JPM EUR SEL EQ I (ACC) - USDHED | 3.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003629 | 摩根全球多元配置(QDII-FOF)人民币A | QDII-混合平衡 |  | JPM ASIA PAC EQ I(ACC)-USD | 3.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003630 | 摩根全球多元配置(QDII-FOF)美元现钞 | QDII-混合平衡 |  | JPM ASIA PAC EQ I(ACC)-USD | 3.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003631 | 摩根全球多元配置(QDII-FOF)美元现汇 | QDII-混合平衡 |  | JPM ASIA PAC EQ I(ACC)-USD | 3.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019512 | 摩根全球多元配置(QDII-FOF)人民币C | QDII-混合平衡 |  | JPM ASIA PAC EQ I(ACC)-USD | 3.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 004877 | 汇添富全球医疗混合(QDII)人民币 | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 004878 | 汇添富全球医疗混合(QDII)美元现汇 | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 004879 | 汇添富全球医疗混合(QDII)美元现钞 | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 004998 | 长信全球债券人民币 | QDII-纯债 |  | DRX DLY 20+ YR TEARS BULL 3X | 2.42% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 004999 | 长信全球债券美元 | QDII-纯债 |  | DRX DLY 20+ YR TEARS BULL 3X | 2.42% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 004998 | 长信全球债券人民币 | QDII-纯债 |  | ChinaAMC Select USD Money Market Fund | 0.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 004999 | 长信全球债券美元 | QDII-纯债 |  | ChinaAMC Select USD Money Market Fund | 0.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005698 | 华夏全球科技先锋混合(QDII)A(人民币) | QDII-混合偏股 |  | Direxion Daily Semiconducto r Bull 3X ETF | 8.57% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019447 | 华夏全球科技先锋混合(QDII)A(美元现汇) | QDII-混合偏股 |  | Direxion Daily Semiconducto r Bull 3X ETF | 8.57% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019448 | 华夏全球科技先锋混合(QDII)A(美元现钞) | QDII-混合偏股 |  | Direxion Daily Semiconducto r Bull 3X ETF | 8.57% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 024239 | 华夏全球科技先锋混合(QDII)C | QDII-混合偏股 |  | Direxion Daily Semiconducto r Bull 3X ETF | 8.57% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005698 | 华夏全球科技先锋混合(QDII)A(人民币) | QDII-混合偏股 |  | CSOP SK Hynix Daily 2x Leveraged Product | 1.01% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019447 | 华夏全球科技先锋混合(QDII)A(美元现汇) | QDII-混合偏股 |  | CSOP SK Hynix Daily 2x Leveraged Product | 1.01% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019448 | 华夏全球科技先锋混合(QDII)A(美元现钞) | QDII-混合偏股 |  | CSOP SK Hynix Daily 2x Leveraged Product | 1.01% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 024239 | 华夏全球科技先锋混合(QDII)C | QDII-混合偏股 |  | CSOP SK Hynix Daily 2x Leveraged Product | 1.01% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006308 | 汇添富全球消费混合(QDII)人民币A | QDII-混合偏股 |  | State Street Consumer Discretio nary Select Sector SPDR ETF | 1.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006309 | 汇添富全球消费混合(QDII)人民币C | QDII-混合偏股 |  | State Street Consumer Discretio nary Select Sector SPDR ETF | 1.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006310 | 汇添富全球消费混合(QDII)美元现汇 | QDII-混合偏股 |  | State Street Consumer Discretio nary Select Sector SPDR ETF | 1.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006308 | 汇添富全球消费混合(QDII)人民币A | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006309 | 汇添富全球消费混合(QDII)人民币C | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006310 | 汇添富全球消费混合(QDII)美元现汇 | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006327 | 易方达中证海外互联网50ETF联接(QDII)A | 指数型-海外股票 |  | 易方达中证海外中国互联网 50 交易型开放式指数证券投资基金 | 93.63% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006328 | 易方达中证海外互联网50ETF联接(QDII)C | 指数型-海外股票 |  | 易方达中证海外中国互联网 50 交易型开放式指数证券投资基金 | 93.63% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006445 | 华夏海外聚享混合发起式(QDII-FOF)A人民币 | QDII-混合平衡 |  | Brookfield Real Assets Income Fund Inc | 9.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006446 | 华夏海外聚享混合发起式(QDII-FOF)A美元现汇 | QDII-混合平衡 |  | Brookfield Real Assets Income Fund Inc | 9.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006447 | 华夏海外聚享混合发起式(QDII-FOF)A美元现钞 | QDII-混合平衡 |  | Brookfield Real Assets Income Fund Inc | 9.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006448 | 华夏海外聚享混合发起式(QDII-FOF)C人民币 | QDII-混合平衡 |  | Brookfield Real Assets Income Fund Inc | 9.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006445 | 华夏海外聚享混合发起式(QDII-FOF)A人民币 | QDII-混合平衡 |  | Western Asset Inflation-Linke d Opportunities & Income Fund | 9.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006446 | 华夏海外聚享混合发起式(QDII-FOF)A美元现汇 | QDII-混合平衡 |  | Western Asset Inflation-Linke d Opportunities & Income Fund | 9.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006447 | 华夏海外聚享混合发起式(QDII-FOF)A美元现钞 | QDII-混合平衡 |  | Western Asset Inflation-Linke d Opportunities & Income Fund | 9.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006448 | 华夏海外聚享混合发起式(QDII-FOF)C人民币 | QDII-混合平衡 |  | Western Asset Inflation-Linke d Opportunities & Income Fund | 9.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006445 | 华夏海外聚享混合发起式(QDII-FOF)A人民币 | QDII-混合平衡 |  | Invesco Preferred ETF | 7.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006446 | 华夏海外聚享混合发起式(QDII-FOF)A美元现汇 | QDII-混合平衡 |  | Invesco Preferred ETF | 7.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006447 | 华夏海外聚享混合发起式(QDII-FOF)A美元现钞 | QDII-混合平衡 |  | Invesco Preferred ETF | 7.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006448 | 华夏海外聚享混合发起式(QDII-FOF)C人民币 | QDII-混合平衡 |  | Invesco Preferred ETF | 7.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006445 | 华夏海外聚享混合发起式(QDII-FOF)A人民币 | QDII-混合平衡 |  | Gabelli Dividend & Income Trust/The | 7.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006446 | 华夏海外聚享混合发起式(QDII-FOF)A美元现汇 | QDII-混合平衡 |  | Gabelli Dividend & Income Trust/The | 7.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006447 | 华夏海外聚享混合发起式(QDII-FOF)A美元现钞 | QDII-混合平衡 |  | Gabelli Dividend & Income Trust/The | 7.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006448 | 华夏海外聚享混合发起式(QDII-FOF)C人民币 | QDII-混合平衡 |  | Gabelli Dividend & Income Trust/The | 7.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006445 | 华夏海外聚享混合发起式(QDII-FOF)A人民币 | QDII-混合平衡 |  | Goldman Sachs S&P 500 Premium Income ETF | 6.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006446 | 华夏海外聚享混合发起式(QDII-FOF)A美元现汇 | QDII-混合平衡 |  | Goldman Sachs S&P 500 Premium Income ETF | 6.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006447 | 华夏海外聚享混合发起式(QDII-FOF)A美元现钞 | QDII-混合平衡 |  | Goldman Sachs S&P 500 Premium Income ETF | 6.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006448 | 华夏海外聚享混合发起式(QDII-FOF)C人民币 | QDII-混合平衡 |  | Goldman Sachs S&P 500 Premium Income ETF | 6.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006445 | 华夏海外聚享混合发起式(QDII-FOF)A人民币 | QDII-混合平衡 |  | Vanguard Value ETF | 6.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006446 | 华夏海外聚享混合发起式(QDII-FOF)A美元现汇 | QDII-混合平衡 |  | Vanguard Value ETF | 6.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006447 | 华夏海外聚享混合发起式(QDII-FOF)A美元现钞 | QDII-混合平衡 |  | Vanguard Value ETF | 6.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006448 | 华夏海外聚享混合发起式(QDII-FOF)C人民币 | QDII-混合平衡 |  | Vanguard Value ETF | 6.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006445 | 华夏海外聚享混合发起式(QDII-FOF)A人民币 | QDII-混合平衡 |  | NEOS Nasdaq-100 High Income ETF | 5.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006446 | 华夏海外聚享混合发起式(QDII-FOF)A美元现汇 | QDII-混合平衡 |  | NEOS Nasdaq-100 High Income ETF | 5.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006447 | 华夏海外聚享混合发起式(QDII-FOF)A美元现钞 | QDII-混合平衡 |  | NEOS Nasdaq-100 High Income ETF | 5.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006448 | 华夏海外聚享混合发起式(QDII-FOF)C人民币 | QDII-混合平衡 |  | NEOS Nasdaq-100 High Income ETF | 5.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006445 | 华夏海外聚享混合发起式(QDII-FOF)A人民币 | QDII-混合平衡 |  | BlackRock Credit Allocation Income Trust | 5.54% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006446 | 华夏海外聚享混合发起式(QDII-FOF)A美元现汇 | QDII-混合平衡 |  | BlackRock Credit Allocation Income Trust | 5.54% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006447 | 华夏海外聚享混合发起式(QDII-FOF)A美元现钞 | QDII-混合平衡 |  | BlackRock Credit Allocation Income Trust | 5.54% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006448 | 华夏海外聚享混合发起式(QDII-FOF)C人民币 | QDII-混合平衡 |  | BlackRock Credit Allocation Income Trust | 5.54% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006445 | 华夏海外聚享混合发起式(QDII-FOF)A人民币 | QDII-混合平衡 |  | State Street Bridgewater All Weather ETF | 4.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006446 | 华夏海外聚享混合发起式(QDII-FOF)A美元现汇 | QDII-混合平衡 |  | State Street Bridgewater All Weather ETF | 4.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006447 | 华夏海外聚享混合发起式(QDII-FOF)A美元现钞 | QDII-混合平衡 |  | State Street Bridgewater All Weather ETF | 4.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006448 | 华夏海外聚享混合发起式(QDII-FOF)C人民币 | QDII-混合平衡 |  | State Street Bridgewater All Weather ETF | 4.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006445 | 华夏海外聚享混合发起式(QDII-FOF)A人民币 | QDII-混合平衡 |  | BlackRock Corporate High Yield Fund Inc | 4.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006446 | 华夏海外聚享混合发起式(QDII-FOF)A美元现汇 | QDII-混合平衡 |  | BlackRock Corporate High Yield Fund Inc | 4.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006447 | 华夏海外聚享混合发起式(QDII-FOF)A美元现钞 | QDII-混合平衡 |  | BlackRock Corporate High Yield Fund Inc | 4.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006448 | 华夏海外聚享混合发起式(QDII-FOF)C人民币 | QDII-混合平衡 |  | BlackRock Corporate High Yield Fund Inc | 4.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007721 | 天弘标普500发起(QDII-FOF)A | QDII-FOF |  | State Street SPDR Portf olio S&P 50 0 ETF | 19.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007722 | 天弘标普500发起(QDII-FOF)C | QDII-FOF |  | State Street SPDR Portf olio S&P 50 0 ETF | 19.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022523 | 天弘标普500发起(QDII-FOF)D | QDII-FOF |  | State Street SPDR Portf olio S&P 50 0 ETF | 19.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007721 | 天弘标普500发起(QDII-FOF)A | QDII-FOF |  | State Street SPDR S&P 500 ETF Tr ust | 19.88% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007722 | 天弘标普500发起(QDII-FOF)C | QDII-FOF |  | State Street SPDR S&P 500 ETF Tr ust | 19.88% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022523 | 天弘标普500发起(QDII-FOF)D | QDII-FOF |  | State Street SPDR S&P 500 ETF Tr ust | 19.88% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007721 | 天弘标普500发起(QDII-FOF)A | QDII-FOF |  | Vanguard S &P 500 ET F | 19.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007722 | 天弘标普500发起(QDII-FOF)C | QDII-FOF |  | Vanguard S &P 500 ET F | 19.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022523 | 天弘标普500发起(QDII-FOF)D | QDII-FOF |  | Vanguard S &P 500 ET F | 19.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007721 | 天弘标普500发起(QDII-FOF)A | QDII-FOF |  | iShares Cor e S&P 500 ETF | 19.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007722 | 天弘标普500发起(QDII-FOF)C | QDII-FOF |  | iShares Cor e S&P 500 ETF | 19.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022523 | 天弘标普500发起(QDII-FOF)D | QDII-FOF |  | iShares Cor e S&P 500 ETF | 19.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007721 | 天弘标普500发起(QDII-FOF)A | QDII-FOF |  | iShares Cor e S&P 500 UCITS ETF | 8.52% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007722 | 天弘标普500发起(QDII-FOF)C | QDII-FOF |  | iShares Cor e S&P 500 UCITS ETF | 8.52% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022523 | 天弘标普500发起(QDII-FOF)D | QDII-FOF |  | iShares Cor e S&P 500 UCITS ETF | 8.52% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007721 | 天弘标普500发起(QDII-FOF)A | QDII-FOF |  | Invesco S& P 500 UCIT S ETF | 2.96% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007722 | 天弘标普500发起(QDII-FOF)C | QDII-FOF |  | Invesco S& P 500 UCIT S ETF | 2.96% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022523 | 天弘标普500发起(QDII-FOF)D | QDII-FOF |  | Invesco S& P 500 UCIT S ETF | 2.96% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007729 | 招商普盛全球配置(QDII)人民币A | QDII-混合灵活 |  | T Rowe Price Funds SICAV - Global Aggregate Bond Fund | 13.92% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023559 | 招商普盛全球配置(QDII)人民币C | QDII-混合灵活 |  | T Rowe Price Funds SICAV - Global Aggregate Bond Fund | 13.92% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025339 | 招商普盛全球配置(QDII)人民币D | QDII-混合灵活 |  | T Rowe Price Funds SICAV - Global Aggregate Bond Fund | 13.92% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007729 | 招商普盛全球配置(QDII)人民币A | QDII-混合灵活 |  | T. Rowe Price Global High Income Bond Fund | 8.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023559 | 招商普盛全球配置(QDII)人民币C | QDII-混合灵活 |  | T. Rowe Price Global High Income Bond Fund | 8.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025339 | 招商普盛全球配置(QDII)人民币D | QDII-混合灵活 |  | T. Rowe Price Global High Income Bond Fund | 8.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007729 | 招商普盛全球配置(QDII)人民币A | QDII-混合灵活 |  | T. Rowe Price Emerging Markets Discovery Stock Fund | 7.39% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023559 | 招商普盛全球配置(QDII)人民币C | QDII-混合灵活 |  | T. Rowe Price Emerging Markets Discovery Stock Fund | 7.39% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025339 | 招商普盛全球配置(QDII)人民币D | QDII-混合灵活 |  | T. Rowe Price Emerging Markets Discovery Stock Fund | 7.39% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007729 | 招商普盛全球配置(QDII)人民币A | QDII-混合灵活 |  | T Rowe Price Emerging Markets Local Currency | 7.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023559 | 招商普盛全球配置(QDII)人民币C | QDII-混合灵活 |  | T Rowe Price Emerging Markets Local Currency | 7.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025339 | 招商普盛全球配置(QDII)人民币D | QDII-混合灵活 |  | T Rowe Price Emerging Markets Local Currency | 7.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007729 | 招商普盛全球配置(QDII)人民币A | QDII-混合灵活 |  | T Rowe Price Internation al Bond Fund | 6.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023559 | 招商普盛全球配置(QDII)人民币C | QDII-混合灵活 |  | T Rowe Price Internation al Bond Fund | 6.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025339 | 招商普盛全球配置(QDII)人民币D | QDII-混合灵活 |  | T Rowe Price Internation al Bond Fund | 6.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007729 | 招商普盛全球配置(QDII)人民币A | QDII-混合灵活 |  | SPDR S&P BIOTECH ETF | 4.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023559 | 招商普盛全球配置(QDII)人民币C | QDII-混合灵活 |  | SPDR S&P BIOTECH ETF | 4.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025339 | 招商普盛全球配置(QDII)人民币D | QDII-混合灵活 |  | SPDR S&P BIOTECH ETF | 4.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007729 | 招商普盛全球配置(QDII)人民币A | QDII-混合灵活 |  | T Rowe Price US Treasury Long-Term Index Fund | 3.67% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023559 | 招商普盛全球配置(QDII)人民币C | QDII-混合灵活 |  | T Rowe Price US Treasury Long-Term Index Fund | 3.67% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025339 | 招商普盛全球配置(QDII)人民币D | QDII-混合灵活 |  | T Rowe Price US Treasury Long-Term Index Fund | 3.67% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007729 | 招商普盛全球配置(QDII)人民币A | QDII-混合灵活 |  | ISHARES MSCI SOUTH KOREA ETF | 2.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023559 | 招商普盛全球配置(QDII)人民币C | QDII-混合灵活 |  | ISHARES MSCI SOUTH KOREA ETF | 2.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025339 | 招商普盛全球配置(QDII)人民币D | QDII-混合灵活 |  | ISHARES MSCI SOUTH KOREA ETF | 2.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007729 | 招商普盛全球配置(QDII)人民币A | QDII-混合灵活 |  | Global X Japan Semicondu ctor ETF | 2.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023559 | 招商普盛全球配置(QDII)人民币C | QDII-混合灵活 |  | Global X Japan Semicondu ctor ETF | 2.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025339 | 招商普盛全球配置(QDII)人民币D | QDII-混合灵活 |  | Global X Japan Semicondu ctor ETF | 2.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007729 | 招商普盛全球配置(QDII)人民币A | QDII-混合灵活 |  | ROUNDHI LL MEMORY ETF | 2.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023559 | 招商普盛全球配置(QDII)人民币C | QDII-混合灵活 |  | ROUNDHI LL MEMORY ETF | 2.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025339 | 招商普盛全球配置(QDII)人民币D | QDII-混合灵活 |  | ROUNDHI LL MEMORY ETF | 2.18% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008253 | 华宝致远混合(QDII)A | QDII-混合偏股 |  | Direxion Daily Semicondu ctor Bull 3X ETF | 2.98% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008254 | 华宝致远混合(QDII)C | QDII-混合偏股 |  | Direxion Daily Semicondu ctor Bull 3X ETF | 2.98% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008253 | 华宝致远混合(QDII)A | QDII-混合偏股 |  | Roundhill Memory ETF | 2.45% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008254 | 华宝致远混合(QDII)C | QDII-混合偏股 |  | Roundhill Memory ETF | 2.45% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008253 | 华宝致远混合(QDII)A | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.47% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008254 | 华宝致远混合(QDII)C | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.47% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008253 | 华宝致远混合(QDII)A | QDII-混合偏股 |  | iShares MSCI Taiwan ETF | 0.24% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008254 | 华宝致远混合(QDII)C | QDII-混合偏股 |  | iShares MSCI Taiwan ETF | 0.24% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008253 | 华宝致远混合(QDII)A | QDII-混合偏股 |  | Janus Henderson Global Adaptive Multi- | 0.07% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008254 | 华宝致远混合(QDII)C | QDII-混合偏股 |  | Janus Henderson Global Adaptive Multi- | 0.07% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008284 | 易方达全球医药行业混合发起式(QDII)A(人民币) | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 3.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008285 | 易方达全球医药行业混合发起式(QDII)A(美元现汇) | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 3.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019035 | 易方达全球医药行业混合发起式(QDII)C(人民币) | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 3.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019036 | 易方达全球医药行业混合发起式(QDII)C(美元现汇) | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 3.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012348 | 天弘恒生科技ETF联接A | 指数型-海外股票 |  | 天弘恒生科技交易型开放式指数证券投资基金 （QDII） | 91.64% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012349 | 天弘恒生科技ETF联接C | 指数型-海外股票 |  | 天弘恒生科技交易型开放式指数证券投资基金 （QDII） | 91.64% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012348 | 天弘恒生科技ETF联接A | 指数型-海外股票 |  | GX恒生科技 | 1.85% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012349 | 天弘恒生科技ETF联接C | 指数型-海外股票 |  | GX恒生科技 | 1.85% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012804 | 广发恒生科技ETF联接(QDII)A | 指数型-海外股票 |  | 广发恒生科技 （QDII-ET F） | 95.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012805 | 广发恒生科技ETF联接(QDII)C | 指数型-海外股票 |  | 广发恒生科技 （QDII-ET F） | 95.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022005 | 广发恒生科技ETF联接(QDII)F | 指数型-海外股票 |  | 广发恒生科技 （QDII-ET F） | 95.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012920 | 易方达全球成长精选混合(QDII)人民币A | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012921 | 易方达全球成长精选混合(QDII)美元现汇A | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012922 | 易方达全球成长精选混合(QDII)人民币C | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012923 | 易方达全球成长精选混合(QDII)美元现汇C | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 0.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012979 | 大成恒生科技ETF发起式联接A | 指数型-海外股票 |  | 大成恒生科技ETF （QDII） | 92.47% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012980 | 大成恒生科技ETF发起式联接C | 指数型-海外股票 |  | 大成恒生科技ETF （QDII） | 92.47% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013127 | 汇添富恒生科技ETF联接发起式(QDII)A | 指数型-海外股票 |  | 恒生科技 ETF 汇添富 | 93.17% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013128 | 汇添富恒生科技ETF联接发起式(QDII)C | 指数型-海外股票 |  | 恒生科技 ETF 汇添富 | 93.17% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013171 | 华夏恒生互联网科技业ETF联接(QDII)A | 指数型-海外股票 |  | 华夏恒生互联网科技业ETF （QDII） | 93.86% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013172 | 华夏恒生互联网科技业ETF联接(QDII)C | 指数型-海外股票 |  | 华夏恒生互联网科技业ETF （QDII） | 93.86% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013308 | 易方达恒生科技ETF联接(QDII)A | 指数型-海外股票 |  | 易方达恒生科技交易型开放式指数证券投资基 | 94.53% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013309 | 易方达恒生科技ETF联接(QDII)C | 指数型-海外股票 |  | 易方达恒生科技交易型开放式指数证券投资基 | 94.53% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013328 | 嘉实全球价值股票(QDII)人民币 | QDII-普通股票 |  | SPDR Gold Shares | 0.23% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013329 | 嘉实全球价值股票(QDII)美元现汇 | QDII-普通股票 |  | SPDR Gold Shares | 0.23% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013328 | 嘉实全球价值股票(QDII)人民币 | QDII-普通股票 |  | iShares MSCI India ETF | 0.08% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013329 | 嘉实全球价值股票(QDII)美元现汇 | QDII-普通股票 |  | iShares MSCI India ETF | 0.08% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013402 | 华夏恒生科技ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华夏恒生科技ETF （QDII） | 94.56% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 013403 | 华夏恒生科技ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华夏恒生科技ETF （QDII） | 94.56% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023763 | 华夏恒生科技ETF发起式联接(QDII)D | 指数型-海外股票 |  | 华夏恒生科技ETF （QDII） | 94.56% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 014424 | 博时恒生医疗保健ETF发起式联接(QDII)A | 指数型-海外股票 |  | 博时恒生医疗保健 (QDII-ETF) | 94.91% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 014425 | 博时恒生医疗保健ETF发起式联接(QDII)C | 指数型-海外股票 |  | 博时恒生医疗保健 (QDII-ETF) | 94.91% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 014438 | 博时恒生科技ETF发起式联接(QDII)A | 指数型-海外股票 |  | 博时恒生科技 ETF(QDII) | 93.81% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 014439 | 博时恒生科技ETF发起式联接(QDII)C | 指数型-海外股票 |  | 博时恒生科技 ETF(QDII) | 93.81% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 015282 | 华安恒生科技ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华安恒生科技交易型开放式指数证券投资基金 （QDII） | 90.47% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 015283 | 华安恒生科技ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华安恒生科技交易型开放式指数证券投资基金 （QDII） | 90.47% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022647 | 华安恒生科技ETF发起式联接(QDII)I | 指数型-海外股票 |  | 华安恒生科技交易型开放式指数证券投资基金 （QDII） | 90.47% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 015299 | 华夏纳斯达克100ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华夏纳斯达克 100ETF （QDII） | 91.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 015300 | 华夏纳斯达克100ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华夏纳斯达克 100ETF （QDII） | 91.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 015518 | 华夏纳斯达克100ETF发起式联接(QDII)A美元现汇 | 指数型-海外股票 |  | 华夏纳斯达克 100ETF （QDII） | 91.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 015310 | 华泰柏瑞恒生科技ETF联接(QDII)A | 指数型-海外股票 |  | 华泰柏瑞南方东英恒生科技指数交易型开放式指数证券投资基金 （QDII） | 93.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 015311 | 华泰柏瑞恒生科技ETF联接(QDII)C | 指数型-海外股票 |  | 华泰柏瑞南方东英恒生科技指数交易型开放式指数证券投资基金 （QDII） | 93.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022680 | 华泰柏瑞恒生科技ETF联接(QDII)I | 指数型-海外股票 |  | 华泰柏瑞南方东英恒生科技指数交易型开放式指数证券投资基金 （QDII） | 93.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016055 | 博时纳斯达克100ETF发起式联接(QDII)A人民币 | 指数型-海外股票 |  | 博时纳斯达克 100ETF | 93.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016056 | 博时纳斯达克100ETF发起式联接(QDII)A美元现汇 | 指数型-海外股票 |  | 博时纳斯达克 100ETF | 93.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016057 | 博时纳斯达克100ETF发起式联接(QDII)C人民币 | 指数型-海外股票 |  | 博时纳斯达克 100ETF | 93.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016058 | 博时纳斯达克100ETF发起式联接(QDII)C美元现汇 | 指数型-海外股票 |  | 博时纳斯达克 100ETF | 93.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 024237 | 博时纳斯达克100ETF发起式联接(QDII)I人民币 | 指数型-海外股票 |  | 博时纳斯达克 100ETF | 93.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016452 | 南方纳斯达克100指数发起(QDII)A | 指数型-海外股票 |  | Invesco Nasdaq 100 ETF | 2.79% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016453 | 南方纳斯达克100指数发起(QDII)C | 指数型-海外股票 |  | Invesco Nasdaq 100 ETF | 2.79% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021000 | 南方纳斯达克100指数发起(QDII)I | 指数型-海外股票 |  | Invesco Nasdaq 100 ETF | 2.79% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016532 | 嘉实纳斯达克100ETF发起联接(QDII)A人民币 | 指数型-海外股票 |  | Harvest NASDAQ-100 ETF QDII | 90.91% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016533 | 嘉实纳斯达克100ETF发起联接(QDII)C人民币 | 指数型-海外股票 |  | Harvest NASDAQ-100 ETF QDII | 90.91% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016534 | 嘉实纳斯达克100ETF发起联接(QDII)A美元现汇 | 指数型-海外股票 |  | Harvest NASDAQ-100 ETF QDII | 90.91% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016535 | 嘉实纳斯达克100ETF发起联接(QDII)C美元现汇 | 指数型-海外股票 |  | Harvest NASDAQ-100 ETF QDII | 90.91% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021838 | 嘉实纳斯达克100ETF发起联接(QDII)I人民币 | 指数型-海外股票 |  | Harvest NASDAQ-100 ETF QDII | 90.91% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016664 | 天弘全球高端制造混合(QDII)A | QDII-混合偏股 |  | CSOP SK H ynix Daily 2 x Leveraged Product | 7.44% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016665 | 天弘全球高端制造混合(QDII)C | QDII-混合偏股 |  | CSOP SK H ynix Daily 2 x Leveraged Product | 7.44% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016664 | 天弘全球高端制造混合(QDII)A | QDII-混合偏股 |  | CSOP Sams ung Electro nics Daily 2 x Leveraged Product | 1.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016665 | 天弘全球高端制造混合(QDII)C | QDII-混合偏股 |  | CSOP Sams ung Electro nics Daily 2 x Leveraged Product | 1.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016970 | 华夏恒生生物科技ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华夏恒生生物科技 ETF （QDII） | 93.53% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016971 | 华夏恒生生物科技ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华夏恒生生物科技 ETF （QDII） | 93.53% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017028 | 国泰标普500ETF发起联接(QDII)A人民币 | 指数型-海外股票 |  | 国泰标普 500 交易型开放式指数证券投资基金 （QDII） | 94.8% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017030 | 国泰标普500ETF发起联接(QDII)C人民币 | 指数型-海外股票 |  | 国泰标普 500 交易型开放式指数证券投资基金 （QDII） | 94.8% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017091 | 景顺长城纳斯达克科技ETF联接(QDII)A人民币 | 指数型-海外股票 |  | 景顺长城纳斯达克科技市值加权交易型开放式指数证券投资基金 （QDII） | 94.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017092 | 景顺长城纳斯达克科技ETF联接(QDII)A美元现汇 | 指数型-海外股票 |  | 景顺长城纳斯达克科技市值加权交易型开放式指数证券投资基金 （QDII） | 94.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017093 | 景顺长城纳斯达克科技ETF联接(QDII)C人民币 | 指数型-海外股票 |  | 景顺长城纳斯达克科技市值加权交易型开放式指数证券投资基金 （QDII） | 94.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019118 | 景顺长城纳斯达克科技ETF联接(QDII)E人民币 | 指数型-海外股票 |  | 景顺长城纳斯达克科技市值加权交易型开放式指数证券投资基金 （QDII） | 94.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017653 | 创金合信全球芯片产业股票发起(QDII)A | QDII-普通股票 |  | ISHARES SEMICON DUCTOR ETF | 4.49% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017654 | 创金合信全球芯片产业股票发起(QDII)C | QDII-普通股票 |  | ISHARES SEMICON DUCTOR ETF | 4.49% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017653 | 创金合信全球芯片产业股票发起(QDII)A | QDII-普通股票 |  | DIREX DAIL SEMI BU 3X ET-USD | 0.39% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017654 | 创金合信全球芯片产业股票发起(QDII)C | QDII-普通股票 |  | DIREX DAIL SEMI BU 3X ET-USD | 0.39% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017653 | 创金合信全球芯片产业股票发起(QDII)A | QDII-普通股票 |  | PROSHAR ES ULTRAPR O QQQ | 0.07% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017654 | 创金合信全球芯片产业股票发起(QDII)C | QDII-普通股票 |  | PROSHAR ES ULTRAPR O QQQ | 0.07% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017653 | 创金合信全球芯片产业股票发起(QDII)A | QDII-普通股票 |  | INVESCO QQQ TRUST SERIES 1 | 0.05% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017654 | 创金合信全球芯片产业股票发起(QDII)C | QDII-普通股票 |  | INVESCO QQQ TRUST SERIES 1 | 0.05% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017730 | 嘉实全球产业升级股票发起式(QDII)A | QDII-普通股票 |  | Harvest G2 Tech 50 ETF | 0.09% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017731 | 嘉实全球产业升级股票发起式(QDII)C | QDII-普通股票 |  | Harvest G2 Tech 50 ETF | 0.09% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017894 | 汇添富纳斯达克生物科技ETF发起式联接(QDII)人民币A | 指数型-海外股票 |  | 纳指生物科技ETF 汇添富 | 93.53% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017895 | 汇添富纳斯达克生物科技ETF发起式联接(QDII)人民币C | 指数型-海外股票 |  | 纳指生物科技ETF 汇添富 | 93.53% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017951 | 汇添富纳斯达克生物科技ETF发起式联接(QDII)美元现汇 | 指数型-海外股票 |  | 纳指生物科技ETF 汇添富 | 93.53% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017952 | 汇添富纳斯达克生物科技ETF发起式联接(QDII)美元现钞 | 指数型-海外股票 |  | 纳指生物科技ETF 汇添富 | 93.53% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017970 | 摩根海外稳健配置混合(QDII-FOF)人民币A | QDII-FOF |  | JPM US SHORT DUR BD I(ACC)-USD | 18.28% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017971 | 摩根海外稳健配置混合(QDII-FOF)美元现汇 | QDII-FOF |  | JPM US SHORT DUR BD I(ACC)-USD | 18.28% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017972 | 摩根海外稳健配置混合(QDII-FOF)美元现钞 | QDII-FOF |  | JPM US SHORT DUR BD I(ACC)-USD | 18.28% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020512 | 摩根海外稳健配置混合(QDII-FOF)人民币C | QDII-FOF |  | JPM US SHORT DUR BD I(ACC)-USD | 18.28% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017970 | 摩根海外稳健配置混合(QDII-FOF)人民币A | QDII-FOF |  | JPM MGD RESERVES-I ACC USD | 18.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017971 | 摩根海外稳健配置混合(QDII-FOF)美元现汇 | QDII-FOF |  | JPM MGD RESERVES-I ACC USD | 18.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017972 | 摩根海外稳健配置混合(QDII-FOF)美元现钞 | QDII-FOF |  | JPM MGD RESERVES-I ACC USD | 18.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020512 | 摩根海外稳健配置混合(QDII-FOF)人民币C | QDII-FOF |  | JPM MGD RESERVES-I ACC USD | 18.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017970 | 摩根海外稳健配置混合(QDII-FOF)人民币A | QDII-FOF |  | JPM USD ULTSHT INC UCITS ETF LN | 17.95% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017971 | 摩根海外稳健配置混合(QDII-FOF)美元现汇 | QDII-FOF |  | JPM USD ULTSHT INC UCITS ETF LN | 17.95% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017972 | 摩根海外稳健配置混合(QDII-FOF)美元现钞 | QDII-FOF |  | JPM USD ULTSHT INC UCITS ETF LN | 17.95% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020512 | 摩根海外稳健配置混合(QDII-FOF)人民币C | QDII-FOF |  | JPM USD ULTSHT INC UCITS ETF LN | 17.95% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017970 | 摩根海外稳健配置混合(QDII-FOF)人民币A | QDII-FOF |  | JPM BETA USTRES 0-1 USD UCITS LN | 17.88% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017971 | 摩根海外稳健配置混合(QDII-FOF)美元现汇 | QDII-FOF |  | JPM BETA USTRES 0-1 USD UCITS LN | 17.88% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017972 | 摩根海外稳健配置混合(QDII-FOF)美元现钞 | QDII-FOF |  | JPM BETA USTRES 0-1 USD UCITS LN | 17.88% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020512 | 摩根海外稳健配置混合(QDII-FOF)人民币C | QDII-FOF |  | JPM BETA USTRES 0-1 USD UCITS LN | 17.88% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017970 | 摩根海外稳健配置混合(QDII-FOF)人民币A | QDII-FOF |  | JPM GLOBL SHO DUR BND I(ACC)USD | 10.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017971 | 摩根海外稳健配置混合(QDII-FOF)美元现汇 | QDII-FOF |  | JPM GLOBL SHO DUR BND I(ACC)USD | 10.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017972 | 摩根海外稳健配置混合(QDII-FOF)美元现钞 | QDII-FOF |  | JPM GLOBL SHO DUR BND I(ACC)USD | 10.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020512 | 摩根海外稳健配置混合(QDII-FOF)人民币C | QDII-FOF |  | JPM GLOBL SHO DUR BND I(ACC)USD | 10.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017970 | 摩根海外稳健配置混合(QDII-FOF)人民币A | QDII-FOF |  | JPM INCOME FUND I (ACC) - USD | 7.08% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017971 | 摩根海外稳健配置混合(QDII-FOF)美元现汇 | QDII-FOF |  | JPM INCOME FUND I (ACC) - USD | 7.08% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017972 | 摩根海外稳健配置混合(QDII-FOF)美元现钞 | QDII-FOF |  | JPM INCOME FUND I (ACC) - USD | 7.08% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020512 | 摩根海外稳健配置混合(QDII-FOF)人民币C | QDII-FOF |  | JPM INCOME FUND I (ACC) - USD | 7.08% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017970 | 摩根海外稳健配置混合(QDII-FOF)人民币A | QDII-FOF |  | JPM BETA US TRE BD 0-3 USD A ETF | 3.58% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017971 | 摩根海外稳健配置混合(QDII-FOF)美元现汇 | QDII-FOF |  | JPM BETA US TRE BD 0-3 USD A ETF | 3.58% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017972 | 摩根海外稳健配置混合(QDII-FOF)美元现钞 | QDII-FOF |  | JPM BETA US TRE BD 0-3 USD A ETF | 3.58% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020512 | 摩根海外稳健配置混合(QDII-FOF)人民币C | QDII-FOF |  | JPM BETA US TRE BD 0-3 USD A ETF | 3.58% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018064 | 华夏标普500ETF发起式联接(QDII)A(人民币) | 指数型-海外股票 |  | 华夏标普 500ETF （QDII） | 91.21% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018065 | 华夏标普500ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华夏标普 500ETF （QDII） | 91.21% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018066 | 华夏标普500ETF发起式联接(QDII)A(美元) | 指数型-海外股票 |  | 华夏标普 500ETF （QDII） | 91.21% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018078 | 南方恒生生物科技ETF发起联接(QDII)A | 指数型-海外股票 |  | 南方恒生生物科技 ETF(QDII) | 94.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018079 | 南方恒生生物科技ETF发起联接(QDII)C | 指数型-海外股票 |  | 南方恒生生物科技 ETF(QDII) | 94.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021053 | 南方恒生生物科技ETF发起联接(QDII)I | 指数型-海外股票 |  | 南方恒生生物科技 ETF(QDII) | 94.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018155 | 创金合信全球医药生物股票发起(QDII)A | QDII-普通股票 |  | DRXN DLY S&P BT BL 3X ETF-UI | 6.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018156 | 创金合信全球医药生物股票发起(QDII)C | QDII-普通股票 |  | DRXN DLY S&P BT BL 3X ETF-UI | 6.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018200 | 嘉实恒生消费ETF发起联接(QDII)A | 指数型-海外股票 |  | Harvest Hang Se ng Consum ption ETF | 92.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018201 | 嘉实恒生消费ETF发起联接(QDII)C | 指数型-海外股票 |  | Harvest Hang Se ng Consum ption ETF | 92.03% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018229 | 易方达全球优质企业混合(QDII)A(人民币份额) | QDII-混合偏股 |  | CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018230 | 易方达全球优质企业混合(QDII)C(人民币份额) | QDII-混合偏股 |  | CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018231 | 易方达全球优质企业混合(QDII)A(美元现汇份额) | QDII-混合偏股 |  | CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018232 | 易方达全球优质企业混合(QDII)C(美元现汇份额) | QDII-混合偏股 |  | CSOP Samsung Electronics Daily 2x Leveraged Product | 0.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018229 | 易方达全球优质企业混合(QDII)A(人民币份额) | QDII-混合偏股 |  | CSOP SK Hynix Daily 2x Leveraged Product | 0.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018230 | 易方达全球优质企业混合(QDII)C(人民币份额) | QDII-混合偏股 |  | CSOP SK Hynix Daily 2x Leveraged Product | 0.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018231 | 易方达全球优质企业混合(QDII)A(美元现汇份额) | QDII-混合偏股 |  | CSOP SK Hynix Daily 2x Leveraged Product | 0.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018232 | 易方达全球优质企业混合(QDII)C(美元现汇份额) | QDII-混合偏股 |  | CSOP SK Hynix Daily 2x Leveraged Product | 0.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018432 | 嘉实恒生医疗保健ETF发起联接(QDII)A | 指数型-海外股票 |  | Harvest Hang Seng Healthcare ETF QDII | 93.2% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018433 | 嘉实恒生医疗保健ETF发起联接(QDII)C | 指数型-海外股票 |  | Harvest Hang Seng Healthcare ETF QDII | 93.2% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018577 | 摩根恒生科技ETF发起式联接(QDII)A | 指数型-海外股票 |  | 摩根恒生科技 ETF(QDII) | 95.16% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018578 | 摩根恒生科技ETF发起式联接(QDII)C | 指数型-海外股票 |  | 摩根恒生科技 ETF(QDII) | 95.16% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018966 | 汇添富纳斯达克100ETF发起式联接(QDII)人民币A | 指数型-海外股票 |  | 纳指ETF 汇添富 | 90.41% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018967 | 汇添富纳斯达克100ETF发起式联接(QDII)人民币C | 指数型-海外股票 |  | 纳指ETF 汇添富 | 90.41% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018968 | 汇添富纳斯达克100ETF发起式联接(QDII)美元现汇 | 指数型-海外股票 |  | 纳指ETF 汇添富 | 90.41% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018969 | 汇添富纳斯达克100ETF发起式联接(QDII)美元现钞 | 指数型-海外股票 |  | 纳指ETF 汇添富 | 90.41% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021773 | 汇添富纳斯达克100ETF发起式联接(QDII)人民币E | 指数型-海外股票 |  | 纳指ETF 汇添富 | 90.41% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019075 | 嘉实全球产业精选混合发起式(QDII)人民币 | QDII-混合偏股 |  | State Street Energy Select Sector SPDR ETF | 1.66% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019076 | 嘉实全球产业精选混合发起式(QDII)美元 | QDII-混合偏股 |  | State Street Energy Select Sector SPDR ETF | 1.66% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019075 | 嘉实全球产业精选混合发起式(QDII)人民币 | QDII-混合偏股 |  | NEXT FUNDS TOPIX Banks Exchange Traded Fund | 0.83% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019076 | 嘉实全球产业精选混合发起式(QDII)美元 | QDII-混合偏股 |  | NEXT FUNDS TOPIX Banks Exchange Traded Fund | 0.83% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019075 | 嘉实全球产业精选混合发起式(QDII)人民币 | QDII-混合偏股 |  | iShares Global Healthcar e ETF | 0.77% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019076 | 嘉实全球产业精选混合发起式(QDII)美元 | QDII-混合偏股 |  | iShares Global Healthcar e ETF | 0.77% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019075 | 嘉实全球产业精选混合发起式(QDII)人民币 | QDII-混合偏股 |  | NEXT FUNDS TOPIX-17 Commercia l & Wholesale Trade ETF | 0.58% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019076 | 嘉实全球产业精选混合发起式(QDII)美元 | QDII-混合偏股 |  | NEXT FUNDS TOPIX-17 Commercia l & Wholesale Trade ETF | 0.58% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019102 | 景顺长城恒生消费ETF联接(QDII)A | 指数型-海外股票 |  | 景顺长城恒生消费交易型开放式指数证券投资基金 （QDII） | 94.19% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019103 | 景顺长城恒生消费ETF联接(QDII)C | 指数型-海外股票 |  | 景顺长城恒生消费交易型开放式指数证券投资基金 （QDII） | 94.19% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019265 | 南方港股数字经济混合发起(QDII)A | QDII-混合偏股 |  | Tradr 2X Long ALAB Daily ETF | 2.75% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019266 | 南方港股数字经济混合发起(QDII)C | QDII-混合偏股 |  | Tradr 2X Long ALAB Daily ETF | 2.75% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019265 | 南方港股数字经济混合发起(QDII)A | QDII-混合偏股 |  | Direxion Daily TSM Bull 2X ETF | 2.28% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019266 | 南方港股数字经济混合发起(QDII)C | QDII-混合偏股 |  | Direxion Daily TSM Bull 2X ETF | 2.28% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019265 | 南方港股数字经济混合发起(QDII)A | QDII-混合偏股 |  | Direxion Daily ASML | 1.98% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019266 | 南方港股数字经济混合发起(QDII)C | QDII-混合偏股 |  | Direxion Daily ASML | 1.98% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019265 | 南方港股数字经济混合发起(QDII)A | QDII-混合偏股 |  | Granitesha res 2x Long AMD Daily ETF | 1.67% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019266 | 南方港股数字经济混合发起(QDII)C | QDII-混合偏股 |  | Granitesha res 2x Long AMD Daily ETF | 1.67% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019265 | 南方港股数字经济混合发起(QDII)A | QDII-混合偏股 |  | Direxion Daily Semicondu ctor Bull 3X ETF | 1.66% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019266 | 南方港股数字经济混合发起(QDII)C | QDII-混合偏股 |  | Direxion Daily Semicondu ctor Bull 3X ETF | 1.66% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019265 | 南方港股数字经济混合发起(QDII)A | QDII-混合偏股 |  | Defiance Daily Target 2X Long NOK ETF | 1.01% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019266 | 南方港股数字经济混合发起(QDII)C | QDII-混合偏股 |  | Defiance Daily Target 2X Long NOK ETF | 1.01% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019415 | 南方港股医药行业混合发起(QDII)A | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 2.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019416 | 南方港股医药行业混合发起(QDII)C | QDII-混合偏股 |  | State Street SPDR S&P Biotech ETF | 2.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019454 | 华泰柏瑞中韩半导体ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华泰柏瑞中证韩交所中韩半导体交易 | 94.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019455 | 华泰柏瑞中韩半导体ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华泰柏瑞中证韩交所中韩半导体交易 | 94.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022681 | 华泰柏瑞中韩半导体ETF发起式联接(QDII)I | 指数型-海外股票 |  | 华泰柏瑞中证韩交所中韩半导体交易 | 94.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019524 | 华泰柏瑞纳斯达克100ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华泰柏瑞纳斯达克 100 交易型开放式指数证券投 | 91.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019525 | 华泰柏瑞纳斯达克100ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华泰柏瑞纳斯达克 100 交易型开放式指数证券投 | 91.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022664 | 华泰柏瑞纳斯达克100ETF发起式联接(QDII)I | 指数型-海外股票 |  | 华泰柏瑞纳斯达克 100 交易型开放式指数证券投 | 91.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019547 | 招商纳斯达克100ETF发起式联接(QDII)A | 指数型-海外股票 |  | 招商纳斯达克 100ETF（QDII） | 94.28% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019548 | 招商纳斯达克100ETF发起式联接(QDII)C | 指数型-海外股票 |  | 招商纳斯达克 100ETF（QDII） | 94.28% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019670 | 广发港股创新药ETF联接(QDII)A | 指数型-海外股票 |  | 广发中证香港创新药 （QDII-ET F） | 96.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019671 | 广发港股创新药ETF联接(QDII)C | 指数型-海外股票 |  | 广发中证香港创新药 （QDII-ET F） | 96.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019936 | 华安恒生互联网科技业ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华安恒生互联网科技业交易型开放式指数证券投资基金 （QDII） | 94.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019937 | 华安恒生互联网科技业ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华安恒生互联网科技业交易型开放式指数证券投资基金 （QDII） | 94.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020515 | 华泰柏瑞东南亚科技ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华泰柏瑞南方东英新交所泛东南亚科技交易型开放式指数证券投资基金 （QDII） | 94.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020516 | 华泰柏瑞东南亚科技ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华泰柏瑞南方东英新交所泛东南亚科技交易型开放式指数证券投资基金 （QDII） | 94.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020621 | 华夏中证香港内地国有企业ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华夏中证香港内地国有企业 ETF （QDII） | 94.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020622 | 华夏中证香港内地国有企业ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华夏中证香港内地国有企业 ETF （QDII） | 94.51% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020634 | 汇添富恒生生物科技ETF发起式联接(QDII)A | 指数型-海外股票 |  | 恒生生物科技ETF 汇添富 | 92.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020635 | 汇添富恒生生物科技ETF发起式联接(QDII)C | 指数型-海外股票 |  | 恒生生物科技ETF 汇添富 | 92.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020712 | 华安三菱日联日经225ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华安三菱日联日经 225 交易型开放式指数证券投资基金 （QDII） | 93.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020713 | 华安三菱日联日经225ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华安三菱日联日经 225 交易型开放式指数证券投资基金 （QDII） | 93.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020743 | 广发恒生消费ETF发起式联接(QDII)A | 指数型-海外股票 |  | 广发恒生消费 （QDII-ET F） | 95.9% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020744 | 广发恒生消费ETF发起式联接(QDII)C | 指数型-海外股票 |  | 广发恒生消费 （QDII-ET F） | 95.9% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020988 | 南方恒生科技ETF发起联接(QDII)A | 指数型-海外股票 |  | 南方恒生科技 ETF(QDII) | 94.44% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020989 | 南方恒生科技ETF发起联接(QDII)C | 指数型-海外股票 |  | 南方恒生科技 ETF(QDII) | 94.44% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021189 | 南方亚太精选ETF联接(QDII)A | 指数型-海外股票 |  | 南方基金南方东英富时亚太精选 ETF(QDII) | 94.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021190 | 南方亚太精选ETF联接(QDII)C | 指数型-海外股票 |  | 南方基金南方东英富时亚太精选 ETF(QDII) | 94.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021539 | 华安法国CAC40ETF发起式联接(QDII)A | 指数型-海外股票 |  | 华安法国 CAC40 交易型开放式指数证券投资基金 （QDII） | 94.34% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021540 | 华安法国CAC40ETF发起式联接(QDII)C | 指数型-海外股票 |  | 华安法国 CAC40 交易型开放式指数证券投资基金 （QDII） | 94.34% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021633 | 招商中证香港科技ETF发起式联接(QDII)A | 指数型-海外股票 |  | 招商中证香港科技ETF（QDII） | 94.85% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021634 | 招商中证香港科技ETF发起式联接(QDII)C | 指数型-海外股票 |  | 招商中证香港科技ETF（QDII） | 94.85% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 024055 | 大成恒生医疗保健ETF发起式联接(QDII)A | 指数型-海外股票 |  | 大成恒生医疗保健 ETF （QDII） | 93.7% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 024056 | 大成恒生医疗保健ETF发起式联接(QDII)C | 指数型-海外股票 |  | 大成恒生医疗保健 ETF （QDII） | 93.7% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 014978 | 华安纳斯达克100ETF联接(QDII)C | 指数型-海外股票 |  | 华安纳斯达克100 交易型开放式指数证券投资基金 （QDII） | 90.64% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 040046 | 华安纳斯达克100ETF联接(QDII)A | 指数型-海外股票 |  | 华安纳斯达克100 交易型开放式指数证券投资基金 （QDII） | 90.64% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 040047 | 华安纳斯达克100ETF联接(QDII)A美元现钞 | 指数型-海外股票 |  | 华安纳斯达克100 交易型开放式指数证券投资基金 （QDII） | 90.64% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 040048 | 华安纳斯达克100ETF联接(QDII)A美元现汇 | 指数型-海外股票 |  | 华安纳斯达克100 交易型开放式指数证券投资基金 （QDII） | 90.64% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050020 | 博时抗通胀增强回报 | QDII-商品 |  | SPDR GOLD SHARES | 13.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050020 | 博时抗通胀增强回报 | QDII-商品 |  | SS SPDR S&P 500 ETF TRUST-US | 12.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050020 | 博时抗通胀增强回报 | QDII-商品 |  | INVESCO QQQ TRUST SERIES 1 | 11.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050020 | 博时抗通胀增强回报 | QDII-商品 |  | ISHARES SEMICONDUCTOR ETF | 8.35% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050020 | 博时抗通胀增强回报 | QDII-商品 |  | ISHARES TIPS BOND ETF | 5.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050020 | 博时抗通胀增强回报 | QDII-商品 |  | INVESCO DB AGRICULTURE FUND | 4.54% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050020 | 博时抗通胀增强回报 | QDII-商品 |  | UNITED STATES OIL FUND LP | 3.83% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050020 | 博时抗通胀增强回报 | QDII-商品 |  | ABRDN PRECIOUS METALS BASKET | 2.44% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050020 | 博时抗通胀增强回报 | QDII-商品 |  | SS ENERGY SELECT SECTOR | 1.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050020 | 博时抗通胀增强回报 | QDII-商品 |  | ISHARES EXPANDED | 1.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006075 | 博时标普500ETF联接C | 指数型-海外股票 |  | 博时标普 500ETF(Q DII) | 92.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018738 | 博时标普500ETF联接E(人民币) | 指数型-海外股票 |  | 博时标普 500ETF(Q DII) | 92.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050025 | 博时标普500ETF联接A | 指数型-海外股票 |  | 博时标普 500ETF(Q DII) | 92.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019480 | 博时亚洲票息收益债券C人民币 | QDII-纯债 |  | ISHARES 7-10 YEAR TREASURY B | 1.55% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 019481 | 博时亚洲票息收益债券C美元现汇 | QDII-纯债 |  | ISHARES 7-10 YEAR TREASURY B | 1.55% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050030 | 博时亚洲票息收益债券A人民币 | QDII-纯债 |  | ISHARES 7-10 YEAR TREASURY B | 1.55% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050202 | 博时亚洲票息收益债券A美元现汇 | QDII-纯债 |  | ISHARES 7-10 YEAR TREASURY B | 1.55% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 050203 | 博时亚洲票息收益债券A美元现钞 | QDII-纯债 |  | ISHARES 7-10 YEAR TREASURY B | 1.55% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 070031 | 嘉实全球房地产(QDII) | QDII-REITs |  | iShares Global REIT ETF | 7.23% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000157 | 富国全球科技互联网股票(QDII)A(后端) | QDII-普通股票 |  | 南方港韩科技 | 0.77% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 022184 | 富国全球科技互联网股票(QDII)C | QDII-普通股票 |  | 南方港韩科技 | 0.77% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 026228 | 富国全球科技互联网股票(QDII)D | QDII-普通股票 |  | 南方港韩科技 | 0.77% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 100055 | 富国全球科技互联网股票(QDII)A | QDII-普通股票 |  | 南方港韩科技 | 0.77% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005675 | 易方达恒生国企ETF联接C | 指数型-海外股票 |  | 易方达恒生中国企业交易型 | 92.72% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 110031 | 易方达恒生国企ETF联接A | 指数型-海外股票 |  | 易方达恒生中国企业交易型 | 92.72% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 159100 | 巴西ETF华夏 | 指数型-海外股票 |  | ETF Bradesco Ibovespa Fundo de Indice | 99.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 159329 | 沙特ETF南方 | 指数型-海外股票 |  | CSOP Saudi Arabia ETF | 99.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 159687 | 亚太精选ETF南方 | 指数型-海外股票 |  | CSOP FTSE Asia Pacific Select Index ETF | 99.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 159822 | 新经济ETF银华 | 指数型-海外股票 |  | 工银南方东英标普中国新经济行业 ETF(ICBC CSOP S&P NEW CHINA SECTORS ETF) | 96.14% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 159892 | 恒生医药ETF华夏 | 指数型-海外股票 |  | 华夏恒生香港生物科技指数 ETF | 3.17% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 159941 | 纳指ETF广发 | 指数型-海外股票 |  | ProShares UltraPro QQQ | 1.7% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160140 | 南方道琼斯美国精选A | 指数型-海外股票 |  | State Street SPDR Dow Jones REIT ETF | 2.58% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160141 | 南方道琼斯美国精选C | 指数型-海外股票 |  | State Street SPDR Dow Jones REIT ETF | 2.58% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | iShares Gold Trust | 16.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | iShares Gold Trust | 16.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | SPDR Gold Shares | 10.7% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | SPDR Gold Shares | 10.7% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | Invesco DB Base Metals Fund | 10.23% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | Invesco DB Base Metals Fund | 10.23% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | ProShares Ultra Gold | 10.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | ProShares Ultra Gold | 10.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | Invesco DB Agriculture Fund | 5.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | Invesco DB Agriculture Fund | 5.4% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | State Street SPDR S&P Oil & Gas Exploration & Production ETF | 5.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | State Street SPDR S&P Oil & Gas Exploration & Production ETF | 5.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | ProShares UltraShort Silver | 4.1% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | ProShares UltraShort Silver | 4.1% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | Direxion Daily 20+ Year Treasury Bull 3X ETF | 3.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | Direxion Daily 20+ Year Treasury Bull 3X ETF | 3.22% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | ProShares UltraShort Bloomberg Crude Oil | 2.35% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | ProShares UltraShort Bloomberg Crude Oil | 2.35% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 025162 | 国泰大宗商品(QDII-LOF)D | QDII-商品 |  | VanEck Oil Services ETF | 2.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160216 | 国泰大宗商品(QDII-LOF)A | QDII-商品 |  | VanEck Oil Services ETF | 2.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160719 | 嘉实黄金 | QDII-商品 |  | SPDR Gold Shares | 17.31% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160719 | 嘉实黄金 | QDII-商品 |  | abrdn Physical Gold Shares ETF | 17.31% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160719 | 嘉实黄金 | QDII-商品 |  | iShares Gold Trust | 17.06% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160719 | 嘉实黄金 | QDII-商品 |  | Swisscanto CH Gold ETF | 16.47% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160719 | 嘉实黄金 | QDII-商品 |  | UBS Gold ETF | 16.16% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160719 | 嘉实黄金 | QDII-商品 |  | iShares Gold ETF CH | 10.55% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160723 | 嘉实原油(QDII-LOF) | QDII-商品 |  | WisdomTree WTI Crude Oil | 18.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160723 | 嘉实原油(QDII-LOF) | QDII-商品 |  | United States Oil Fund LP | 18.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160723 | 嘉实原油(QDII-LOF) | QDII-商品 |  | ProShares K-1 Free Crude Oil ETF | 18.54% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160723 | 嘉实原油(QDII-LOF) | QDII-商品 |  | United States Brent Oil Fund LP | 18.37% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160723 | 嘉实原油(QDII-LOF) | QDII-商品 |  | WisdomTree Brent Crude Oil （Trading Currency-U SD） | 14.9% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 160723 | 嘉实原油(QDII-LOF) | QDII-商品 |  | WisdomTree Brent Crude Oil （Trading Currency-G BP） | 3.67% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007976 | 易方达黄金主题人民币C | QDII-商品 |  | abrdn Physical Gold Shares ETF | 19.86% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007977 | 易方达黄金主题美元现汇A | QDII-商品 |  | abrdn Physical Gold Shares ETF | 19.86% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007978 | 易方达黄金主题美元现汇C | QDII-商品 |  | abrdn Physical Gold Shares ETF | 19.86% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161116 | 易方达黄金主题人民币A | QDII-商品 |  | abrdn Physical Gold Shares ETF | 19.86% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007976 | 易方达黄金主题人民币C | QDII-商品 |  | SPDR Gold Shares | 19.83% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007977 | 易方达黄金主题美元现汇A | QDII-商品 |  | SPDR Gold Shares | 19.83% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007978 | 易方达黄金主题美元现汇C | QDII-商品 |  | SPDR Gold Shares | 19.83% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161116 | 易方达黄金主题人民币A | QDII-商品 |  | SPDR Gold Shares | 19.83% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007976 | 易方达黄金主题人民币C | QDII-商品 |  | SPDR Gold MiniShares Trust | 19.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007977 | 易方达黄金主题美元现汇A | QDII-商品 |  | SPDR Gold MiniShares Trust | 19.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007978 | 易方达黄金主题美元现汇C | QDII-商品 |  | SPDR Gold MiniShares Trust | 19.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161116 | 易方达黄金主题人民币A | QDII-商品 |  | SPDR Gold MiniShares Trust | 19.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007976 | 易方达黄金主题人民币C | QDII-商品 |  | iShares Gold Trust | 19.65% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007977 | 易方达黄金主题美元现汇A | QDII-商品 |  | iShares Gold Trust | 19.65% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007978 | 易方达黄金主题美元现汇C | QDII-商品 |  | iShares Gold Trust | 19.65% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161116 | 易方达黄金主题人民币A | QDII-商品 |  | iShares Gold Trust | 19.65% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007976 | 易方达黄金主题人民币C | QDII-商品 |  | UBS Gold ETF | 15.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007977 | 易方达黄金主题美元现汇A | QDII-商品 |  | UBS Gold ETF | 15.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 007978 | 易方达黄金主题美元现汇C | QDII-商品 |  | UBS Gold ETF | 15.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161116 | 易方达黄金主题人民币A | QDII-商品 |  | UBS Gold ETF | 15.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003321 | 易方达原油C类人民币 | QDII-商品 |  | WisdomTre e WTI Crude Oil | 19.75% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161129 | 易方达原油A类人民币 | QDII-商品 |  | WisdomTre e WTI Crude Oil | 19.75% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003321 | 易方达原油C类人民币 | QDII-商品 |  | WisdomTre e Brent Crude Oil | 18.57% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161129 | 易方达原油A类人民币 | QDII-商品 |  | WisdomTre e Brent Crude Oil | 18.57% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003321 | 易方达原油C类人民币 | QDII-商品 |  | Invesco DB Oil Fund | 18.2% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161129 | 易方达原油A类人民币 | QDII-商品 |  | Invesco DB Oil Fund | 18.2% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003321 | 易方达原油C类人民币 | QDII-商品 |  | United States Oil Fund LP | 17.05% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161129 | 易方达原油A类人民币 | QDII-商品 |  | United States Oil Fund LP | 17.05% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003321 | 易方达原油C类人民币 | QDII-商品 |  | United States Brent Oil Fund LP | 12.57% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161129 | 易方达原油A类人民币 | QDII-商品 |  | United States Brent Oil Fund LP | 12.57% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003321 | 易方达原油C类人民币 | QDII-商品 |  | Samsung S&P GSCI Crude Oil ER Futures ETF | 7.81% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161129 | 易方达原油A类人民币 | QDII-商品 |  | Samsung S&P GSCI Crude Oil ER Futures ETF | 7.81% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 003722 | 易方达纳斯达克100ETF联接(QDII-LOF)A(美元现汇) | 指数型-海外股票 |  | 易方达纳斯达克100 交易型开放式指数证券投资基金 （QDII） | 93.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012870 | 易方达纳斯达克100ETF联接(QDII-LOF)C(人民币) | 指数型-海外股票 |  | 易方达纳斯达克100 交易型开放式指数证券投资基金 （QDII） | 93.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 012871 | 易方达纳斯达克100ETF联接(QDII-LOF)C(美元现汇) | 指数型-海外股票 |  | 易方达纳斯达克100 交易型开放式指数证券投资基金 （QDII） | 93.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161130 | 易方达纳斯达克100ETF联接(QDII-LOF)A(人民币) | 指数型-海外股票 |  | 易方达纳斯达克100 交易型开放式指数证券投资基金 （QDII） | 93.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 014127 | 融通核心价值混合C | QDII-混合灵活 |  | FIRST TRUST NASDQ 100 TECH I | 2.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161620 | 融通核心价值混合A | QDII-混合灵活 |  | FIRST TRUST NASDQ 100 TECH I | 2.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 014127 | 融通核心价值混合C | QDII-混合灵活 |  | ISHARES SEMICONDUCTOR ETF | 2.35% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161620 | 融通核心价值混合A | QDII-混合灵活 |  | ISHARES SEMICONDUCTOR ETF | 2.35% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 014127 | 融通核心价值混合C | QDII-混合灵活 |  | FIRST TRUST NASDAQ CYBERSECU | 2.21% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161620 | 融通核心价值混合A | QDII-混合灵活 |  | FIRST TRUST NASDAQ CYBERSECU | 2.21% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 014127 | 融通核心价值混合C | QDII-混合灵活 |  | ROUNDHILL MEMORY ETF | 1.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161620 | 融通核心价值混合A | QDII-混合灵活 |  | ROUNDHILL MEMORY ETF | 1.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 014127 | 融通核心价值混合C | QDII-混合灵活 |  | ISHARES BIOTECHNOLOGY ETF | 0.97% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161620 | 融通核心价值混合A | QDII-混合灵活 |  | ISHARES BIOTECHNOLOGY ETF | 0.97% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021694 | 银华抗通胀主题(QDII-FOF-LOF)C | QDII-商品 |  | ISHARES GSCI COMMODITY DYNAM ETF | 20.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161815 | 银华抗通胀主题(QDII-FOF-LOF)A | QDII-商品 |  | ISHARES GSCI COMMODITY DYNAM ETF | 20.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021694 | 银华抗通胀主题(QDII-FOF-LOF)C | QDII-商品 |  | INVESCO AGRICULTUR E CMDTYK-1 | 12.28% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161815 | 银华抗通胀主题(QDII-FOF-LOF)A | QDII-商品 |  | INVESCO AGRICULTUR E CMDTYK-1 | 12.28% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021694 | 银华抗通胀主题(QDII-FOF-LOF)C | QDII-商品 |  | ABRDN PHYSICAL GOLD SHARES | 11.63% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161815 | 银华抗通胀主题(QDII-FOF-LOF)A | QDII-商品 |  | ABRDN PHYSICAL GOLD SHARES | 11.63% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021694 | 银华抗通胀主题(QDII-FOF-LOF)C | QDII-商品 |  | WT WTI CRUDE OIL | 9.36% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161815 | 银华抗通胀主题(QDII-FOF-LOF)A | QDII-商品 |  | WT WTI CRUDE OIL | 9.36% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021694 | 银华抗通胀主题(QDII-FOF-LOF)C | QDII-商品 |  | INVESCO OPTIMUM YIELD DIVERS ETF | 9.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161815 | 银华抗通胀主题(QDII-FOF-LOF)A | QDII-商品 |  | INVESCO OPTIMUM YIELD DIVERS ETF | 9.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021694 | 银华抗通胀主题(QDII-FOF-LOF)C | QDII-商品 |  | WT BRENT CRUDE OIL | 7.33% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161815 | 银华抗通胀主题(QDII-FOF-LOF)A | QDII-商品 |  | WT BRENT CRUDE OIL | 7.33% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021694 | 银华抗通胀主题(QDII-FOF-LOF)C | QDII-商品 |  | GOLDMAN SACHS PHYSICAL GOLD | 6.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161815 | 银华抗通胀主题(QDII-FOF-LOF)A | QDII-商品 |  | GOLDMAN SACHS PHYSICAL GOLD | 6.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021694 | 银华抗通胀主题(QDII-FOF-LOF)C | QDII-商品 |  | ISHARES GOLD TRUST | 5.39% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161815 | 银华抗通胀主题(QDII-FOF-LOF)A | QDII-商品 |  | ISHARES GOLD TRUST | 5.39% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021694 | 银华抗通胀主题(QDII-FOF-LOF)C | QDII-商品 |  | ABRDN BLOOMBERG ALL COMMODIT LNGR DATED ETF | 4.79% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161815 | 银华抗通胀主题(QDII-FOF-LOF)A | QDII-商品 |  | ABRDN BLOOMBERG ALL COMMODIT LNGR DATED ETF | 4.79% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021694 | 银华抗通胀主题(QDII-FOF-LOF)C | QDII-商品 |  | SPDR GOLD TRUST ETF | 2.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 161815 | 银华抗通胀主题(QDII-FOF-LOF)A | QDII-商品 |  | SPDR GOLD TRUST ETF | 2.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 004243 | 广发道琼斯石油指数人民币C | 指数型-海外股票 |  | ProShares Ultra Energy | 1.89% | 已确认暂不映射：ProShares Ultra Energy (DIG) 是 2x 能源行业指数 ETF，跟踪 S&P Energy Select Sector Index，不是单一正股杠杆产品；不要映射到 XOM/CVX 等站内正股。 |
| 006679 | 广发道琼斯石油指数美元现汇A | 指数型-海外股票 |  | ProShares Ultra Energy | 1.89% | 已确认暂不映射：ProShares Ultra Energy (DIG) 是 2x 能源行业指数 ETF，跟踪 S&P Energy Select Sector Index，不是单一正股杠杆产品；不要映射到 XOM/CVX 等站内正股。 |
| 006680 | 广发道琼斯石油指数美元现汇C | 指数型-海外股票 |  | ProShares Ultra Energy | 1.89% | 已确认暂不映射：ProShares Ultra Energy (DIG) 是 2x 能源行业指数 ETF，跟踪 S&P Energy Select Sector Index，不是单一正股杠杆产品；不要映射到 XOM/CVX 等站内正股。 |
| 162719 | 广发道琼斯石油指数人民币A | 指数型-海外股票 |  | ProShares Ultra Energy | 1.89% | 已确认暂不映射：ProShares Ultra Energy (DIG) 是 2x 能源行业指数 ETF，跟踪 S&P Energy Select Sector Index，不是单一正股杠杆产品；不要映射到 XOM/CVX 等站内正股。 |
| 163208 | 诺安油气能源 | QDII-普通股票 |  | SPDR S&P OIL & GAS EXPLO RATION & PRO DUCTION ETF | 18.84% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163208 | 诺安油气能源 | QDII-普通股票 |  | VANGUARD ENE RGY ETF | 17.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163208 | 诺安油气能源 | QDII-普通股票 |  | ISHARES US E NERGY ETF | 16.99% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163208 | 诺安油气能源 | QDII-普通股票 |  | ISHARES GLOB AL ENERGY ET F | 16.8% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163208 | 诺安油气能源 | QDII-普通股票 |  | SPDR ENERGY SELECT SECTO R FUND | 16.2% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163208 | 诺安油气能源 | QDII-普通股票 |  | UNITED STATE S OIL FUND L P | 5.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163208 | 诺安油气能源 | QDII-普通股票 |  | UNITED STATE S BRENT OIL FUND | 3.44% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020957 | 中银全球策略(QDII-FOF)C | QDII-FOF |  | INVESCO QQQ TRUST SERIES 1 | 12.09% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163813 | 中银全球策略(QDII-FOF)A | QDII-FOF |  | INVESCO QQQ TRUST SERIES 1 | 12.09% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020957 | 中银全球策略(QDII-FOF)C | QDII-FOF |  | INVESCO SEMICON DUCTORS ETF | 11.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163813 | 中银全球策略(QDII-FOF)A | QDII-FOF |  | INVESCO SEMICON DUCTORS ETF | 11.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020957 | 中银全球策略(QDII-FOF)C | QDII-FOF |  | PWR S&P 500 EQ WGT TECH | 9.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163813 | 中银全球策略(QDII-FOF)A | QDII-FOF |  | PWR S&P 500 EQ WGT TECH | 9.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020957 | 中银全球策略(QDII-FOF)C | QDII-FOF |  | INVESCO NASDAQ 100 ETF | 6.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163813 | 中银全球策略(QDII-FOF)A | QDII-FOF |  | INVESCO NASDAQ 100 ETF | 6.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020957 | 中银全球策略(QDII-FOF)C | QDII-FOF |  | VANECK SEMICON DUCTOR ETF | 6.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163813 | 中银全球策略(QDII-FOF)A | QDII-FOF |  | VANECK SEMICON DUCTOR ETF | 6.5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020957 | 中银全球策略(QDII-FOF)C | QDII-FOF |  | FIRST TRUST NASDAQ 100 TECH I | 6.41% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163813 | 中银全球策略(QDII-FOF)A | QDII-FOF |  | FIRST TRUST NASDAQ 100 TECH I | 6.41% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020957 | 中银全球策略(QDII-FOF)C | QDII-FOF |  | SPDR BBG BARC 1-3 MONTH TBIL | 5.01% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163813 | 中银全球策略(QDII-FOF)A | QDII-FOF |  | SPDR BBG BARC 1-3 MONTH TBIL | 5.01% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020957 | 中银全球策略(QDII-FOF)C | QDII-FOF |  | VANGUA RD TOT | 3.76% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163813 | 中银全球策略(QDII-FOF)A | QDII-FOF |  | VANGUA RD TOT | 3.76% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020957 | 中银全球策略(QDII-FOF)C | QDII-FOF |  | TECHNOL OGY SELECT SECT SPDR | 3.26% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163813 | 中银全球策略(QDII-FOF)A | QDII-FOF |  | TECHNOL OGY SELECT SECT SPDR | 3.26% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020957 | 中银全球策略(QDII-FOF)C | QDII-FOF |  | Franklin FTSE KOREA UCITS ETF | 2.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 163813 | 中银全球策略(QDII-FOF)A | QDII-FOF |  | Franklin FTSE KOREA UCITS ETF | 2.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016823 | 天弘全球新能源汽车股票(QDII-LOF)C | QDII-普通股票 |  | CSOP SK H ynix Daily 2 x Leveraged Product | 4.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164212 | 天弘全球新能源汽车股票(QDII-LOF)A | QDII-普通股票 |  | CSOP SK H ynix Daily 2 x Leveraged Product | 4.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016823 | 天弘全球新能源汽车股票(QDII-LOF)C | QDII-普通股票 |  | CSOP Sams ung Electro nics Daily 2 x Leveraged Product | 1.9% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164212 | 天弘全球新能源汽车股票(QDII-LOF)A | QDII-普通股票 |  | CSOP Sams ung Electro nics Daily 2 x Leveraged Product | 1.9% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018543 | 汇添富黄金及贵金属(QDII-LOF-FOF)C | QDII-商品 |  | iShares Gold Trust | 17.98% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164701 | 汇添富黄金及贵金属(QDII-LOF-FOF)A | QDII-商品 |  | iShares Gold Trust | 17.98% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018543 | 汇添富黄金及贵金属(QDII-LOF-FOF)C | QDII-商品 |  | SPDR Gold Shares | 17.49% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164701 | 汇添富黄金及贵金属(QDII-LOF-FOF)A | QDII-商品 |  | SPDR Gold Shares | 17.49% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018543 | 汇添富黄金及贵金属(QDII-LOF-FOF)C | QDII-商品 |  | SPDR Gold MiniShare s Trust | 17.31% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164701 | 汇添富黄金及贵金属(QDII-LOF-FOF)A | QDII-商品 |  | SPDR Gold MiniShare s Trust | 17.31% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018543 | 汇添富黄金及贵金属(QDII-LOF-FOF)C | QDII-商品 |  | iShares Gold | 11.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164701 | 汇添富黄金及贵金属(QDII-LOF-FOF)A | QDII-商品 |  | iShares Gold | 11.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018543 | 汇添富黄金及贵金属(QDII-LOF-FOF)C | QDII-商品 |  | Granitesh ares Gold Trust | 9.57% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164701 | 汇添富黄金及贵金属(QDII-LOF-FOF)A | QDII-商品 |  | Granitesh ares Gold Trust | 9.57% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018543 | 汇添富黄金及贵金属(QDII-LOF-FOF)C | QDII-商品 |  | abrdn Physical Gold Shares ETF | 8.45% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164701 | 汇添富黄金及贵金属(QDII-LOF-FOF)A | QDII-商品 |  | abrdn Physical Gold Shares ETF | 8.45% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018543 | 汇添富黄金及贵金属(QDII-LOF-FOF)C | QDII-商品 |  | Goldman Sachs Physical Gold ETF | 7.66% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164701 | 汇添富黄金及贵金属(QDII-LOF-FOF)A | QDII-商品 |  | Goldman Sachs Physical Gold ETF | 7.66% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 018543 | 汇添富黄金及贵金属(QDII-LOF-FOF)C | QDII-商品 |  | ProShares Ultra Gold | 5.83% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164701 | 汇添富黄金及贵金属(QDII-LOF-FOF)A | QDII-商品 |  | ProShares Ultra Gold | 5.83% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005801 | 工银印度基金美元 | QDII-混合偏股 |  | WisdomTree India Earnings Fund | 16.62% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164824 | 工银印度基金人民币 | QDII-混合偏股 |  | WisdomTree India Earnings Fund | 16.62% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005801 | 工银印度基金美元 | QDII-混合偏股 |  | iShares MSCI India ETF | 16.36% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164824 | 工银印度基金人民币 | QDII-混合偏股 |  | iShares MSCI India ETF | 16.36% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005801 | 工银印度基金美元 | QDII-混合偏股 |  | iShares MSCI India UCITS ETF | 16.3% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164824 | 工银印度基金人民币 | QDII-混合偏股 |  | iShares MSCI India UCITS ETF | 16.3% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005801 | 工银印度基金美元 | QDII-混合偏股 |  | Amundi MSCI India | 15.35% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164824 | 工银印度基金人民币 | QDII-混合偏股 |  | Amundi MSCI India | 15.35% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005801 | 工银印度基金美元 | QDII-混合偏股 |  | iShares MSCI India Small-Cap ETF | 9.09% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164824 | 工银印度基金人民币 | QDII-混合偏股 |  | iShares MSCI India Small-Cap ETF | 9.09% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005801 | 工银印度基金美元 | QDII-混合偏股 |  | iShares India 50 ETF | 6.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164824 | 工银印度基金人民币 | QDII-混合偏股 |  | iShares India 50 ETF | 6.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005801 | 工银印度基金美元 | QDII-混合偏股 |  | NEXT FUNDS Nifty 50 Linked Exchange Traded Fund | 4.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164824 | 工银印度基金人民币 | QDII-混合偏股 |  | NEXT FUNDS Nifty 50 Linked Exchange Traded Fund | 4.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005801 | 工银印度基金美元 | QDII-混合偏股 |  | Columbia India Consumer ETF | 3.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164824 | 工银印度基金人民币 | QDII-混合偏股 |  | Columbia India Consumer ETF | 3.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005801 | 工银印度基金美元 | QDII-混合偏股 |  | VanEck India Growth Leaders ETF | 0.99% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164824 | 工银印度基金人民币 | QDII-混合偏股 |  | VanEck India Growth Leaders ETF | 0.99% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 005801 | 工银印度基金美元 | QDII-混合偏股 |  | iShares Core SENSEX India ETF | 0.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 164824 | 工银印度基金人民币 | QDII-混合偏股 |  | iShares Core SENSEX India ETF | 0.87% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020969 | 中信保诚全球商品(QDII)C | QDII-商品 |  | ISHARES GOL D TRUST | 17.36% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 165513 | 中信保诚全球商品(QDII)A | QDII-商品 |  | ISHARES GOL D TRUST | 17.36% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020969 | 中信保诚全球商品(QDII)C | QDII-商品 |  | SPDR Gold M iniShares T rust | 17.36% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 165513 | 中信保诚全球商品(QDII)A | QDII-商品 |  | SPDR Gold M iniShares T rust | 17.36% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020969 | 中信保诚全球商品(QDII)C | QDII-商品 |  | iShares Gol d Trust Mic ro | 14.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 165513 | 中信保诚全球商品(QDII)A | QDII-商品 |  | iShares Gol d Trust Mic ro | 14.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020969 | 中信保诚全球商品(QDII)C | QDII-商品 |  | Aberdeen St andard Phys ical Gold S hares ETF | 14.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 165513 | 中信保诚全球商品(QDII)A | QDII-商品 |  | Aberdeen St andard Phys ical Gold S hares ETF | 14.25% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020969 | 中信保诚全球商品(QDII)C | QDII-商品 |  | SPDR GOLD S HARES | 14.24% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 165513 | 中信保诚全球商品(QDII)A | QDII-商品 |  | SPDR GOLD S HARES | 14.24% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020969 | 中信保诚全球商品(QDII)C | QDII-商品 |  | Invesco Phy sical Gold ETC | 7.23% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 165513 | 中信保诚全球商品(QDII)A | QDII-商品 |  | Invesco Phy sical Gold ETC | 7.23% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020969 | 中信保诚全球商品(QDII)C | QDII-商品 |  | DB Gold Dou ble Long Ex change Trad ed Notes | 4.1% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 165513 | 中信保诚全球商品(QDII)A | QDII-商品 |  | DB Gold Dou ble Long Ex change Trad ed Notes | 4.1% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 020969 | 中信保诚全球商品(QDII)C | QDII-商品 |  | Japan Physi cal Gold ET F | 2.1% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 165513 | 中信保诚全球商品(QDII)A | QDII-商品 |  | Japan Physi cal Gold ET F | 2.1% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023591 | 南方全球精选配置股票(QDII-FOF)C | QDII-普通股票 |  | State Street Bridgewate r All Weather ETF | 15.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 202801 | 南方全球精选配置股票(QDII-FOF)A | QDII-普通股票 |  | State Street Bridgewate r All Weather ETF | 15.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023591 | 南方全球精选配置股票(QDII-FOF)C | QDII-普通股票 |  | Harbor Commodit y All Weather Strategy ETF | 4.56% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 202801 | 南方全球精选配置股票(QDII-FOF)A | QDII-普通股票 |  | Harbor Commodit y All Weather Strategy ETF | 4.56% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023591 | 南方全球精选配置股票(QDII-FOF)C | QDII-普通股票 |  | T Rowe Price Technolog y ETF | 4.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 202801 | 南方全球精选配置股票(QDII-FOF)A | QDII-普通股票 |  | T Rowe Price Technolog y ETF | 4.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023591 | 南方全球精选配置股票(QDII-FOF)C | QDII-普通股票 |  | iShares Expanded Tech Sector ETF | 3.85% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 202801 | 南方全球精选配置股票(QDII-FOF)A | QDII-普通股票 |  | iShares Expanded Tech Sector ETF | 3.85% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023591 | 南方全球精选配置股票(QDII-FOF)C | QDII-普通股票 |  | Invesco S&P 500 Momentu m ETF | 3.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 202801 | 南方全球精选配置股票(QDII-FOF)A | QDII-普通股票 |  | Invesco S&P 500 Momentu m ETF | 3.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023591 | 南方全球精选配置股票(QDII-FOF)C | QDII-普通股票 |  | VanEck Semicondu ctor ETF | 3.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 202801 | 南方全球精选配置股票(QDII-FOF)A | QDII-普通股票 |  | VanEck Semicondu ctor ETF | 3.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023591 | 南方全球精选配置股票(QDII-FOF)C | QDII-普通股票 |  | State Street SPDR Portfolio S&P 500 Growth ETF | 3.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 202801 | 南方全球精选配置股票(QDII-FOF)A | QDII-普通股票 |  | State Street SPDR Portfolio S&P 500 Growth ETF | 3.13% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023591 | 南方全球精选配置股票(QDII-FOF)C | QDII-普通股票 |  | Invesco Nasdaq 100 ETF | 2.9% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 202801 | 南方全球精选配置股票(QDII-FOF)A | QDII-普通股票 |  | Invesco Nasdaq 100 ETF | 2.9% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023591 | 南方全球精选配置股票(QDII-FOF)C | QDII-普通股票 |  | State Street SPDR Dow Jones Industrial Average ETF Trust | 2.9% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 202801 | 南方全球精选配置股票(QDII-FOF)A | QDII-普通股票 |  | State Street SPDR Dow Jones Industrial Average ETF Trust | 2.9% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023591 | 南方全球精选配置股票(QDII-FOF)C | QDII-普通股票 |  | Fidelity Managed Futures ETF | 2.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 202801 | 南方全球精选配置股票(QDII-FOF)A | QDII-普通股票 |  | Fidelity Managed Futures ETF | 2.82% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006285 | 鹏华全球中短债(QDII)美元现汇A | QDII-混合债 |  | ISHARES 20+ YEAR TREASURY BO | 0.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008320 | 鹏华全球中短债(QDII)人民币C | QDII-混合债 |  | ISHARES 20+ YEAR TREASURY BO | 0.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008321 | 鹏华全球中短债(QDII)美元现汇C | QDII-混合债 |  | ISHARES 20+ YEAR TREASURY BO | 0.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 206006 | 鹏华全球中短债(QDII)人民币A | QDII-混合债 |  | ISHARES 20+ YEAR TREASURY BO | 0.04% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006285 | 鹏华全球中短债(QDII)美元现汇A | QDII-混合债 |  | INVESCO AT1 CAPITAL BOND | 0.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008320 | 鹏华全球中短债(QDII)人民币C | QDII-混合债 |  | INVESCO AT1 CAPITAL BOND | 0.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008321 | 鹏华全球中短债(QDII)美元现汇C | QDII-混合债 |  | INVESCO AT1 CAPITAL BOND | 0.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 206006 | 鹏华全球中短债(QDII)人民币A | QDII-混合债 |  | INVESCO AT1 CAPITAL BOND | 0.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000906 | 广发全球精选股票(QDII)美元A | QDII-普通股票 |  | GFI Unit | 0.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021277 | 广发全球精选股票(QDII)人民币C | QDII-普通股票 |  | GFI Unit | 0.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023402 | 广发全球精选股票(QDII)人民币F | QDII-普通股票 |  | GFI Unit | 0.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 270023 | 广发全球精选股票(QDII)人民币A | QDII-普通股票 |  | GFI Unit | 0.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 000906 | 广发全球精选股票(QDII)美元A | QDII-普通股票 |  | KraneShare s Public-Priv ate AI & Technology ETF | 0.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 021277 | 广发全球精选股票(QDII)人民币C | QDII-普通股票 |  | KraneShare s Public-Priv ate AI & Technology ETF | 0.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023402 | 广发全球精选股票(QDII)人民币F | QDII-普通股票 |  | KraneShare s Public-Priv ate AI & Technology ETF | 0.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 270023 | 广发全球精选股票(QDII)人民币A | QDII-普通股票 |  | KraneShare s Public-Priv ate AI & Technology ETF | 0.11% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006479 | 广发纳斯达克100ETF联接人民币(QDII)C | 指数型-海外股票 |  | 广发纳指 100ETF | 89.45% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 270042 | 广发纳斯达克100ETF联接人民币(QDII)A | 指数型-海外股票 |  | 广发纳指 100ETF | 89.45% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006479 | 广发纳斯达克100ETF联接人民币(QDII)C | 指数型-海外股票 |  | ProShares UltraPro QQQ | 0.95% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 270042 | 广发纳斯达克100ETF联接人民币(QDII)A | 指数型-海外股票 |  | ProShares UltraPro QQQ | 0.95% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 027784 | 诺安全球黄金(QDII-FOF)C | QDII-商品 |  | CSETF GOLD | 18.31% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 320013 | 诺安全球黄金(QDII-FOF)A | QDII-商品 |  | CSETF GOLD | 18.31% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 027784 | 诺安全球黄金(QDII-FOF)C | QDII-商品 |  | UBS GOLD ETF | 17.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 320013 | 诺安全球黄金(QDII-FOF)A | QDII-商品 |  | UBS GOLD ETF | 17.29% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 027784 | 诺安全球黄金(QDII-FOF)C | QDII-商品 |  | Aberdeen Sta ndard Physic al Swiss Gol d Shares ETF | 16.61% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 320013 | 诺安全球黄金(QDII-FOF)A | QDII-商品 |  | Aberdeen Sta ndard Physic al Swiss Gol d Shares ETF | 16.61% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 027784 | 诺安全球黄金(QDII-FOF)C | QDII-商品 |  | ISHARES GOLD TRU | 15.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 320013 | 诺安全球黄金(QDII-FOF)A | QDII-商品 |  | ISHARES GOLD TRU | 15.78% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 027784 | 诺安全球黄金(QDII-FOF)C | QDII-商品 |  | SPDR GOLD TR UST | 15.6% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 320013 | 诺安全球黄金(QDII-FOF)A | QDII-商品 |  | SPDR GOLD TR UST | 15.6% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 027784 | 诺安全球黄金(QDII-FOF)C | QDII-商品 |  | SWISSCANTO (CH) GOLD ET F | 10.37% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 320013 | 诺安全球黄金(QDII-FOF)A | QDII-商品 |  | SWISSCANTO (CH) GOLD ET F | 10.37% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006476 | 南方原油C | QDII-商品 |  | WisdomTr ee Brent Crude Oil | 18.79% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501018 | 南方原油A | QDII-商品 |  | WisdomTr ee Brent Crude Oil | 18.79% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006476 | 南方原油C | QDII-商品 |  | United States | 18.67% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501018 | 南方原油A | QDII-商品 |  | United States | 18.67% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006476 | 南方原油C | QDII-商品 |  | WisdomTr ee WTI Crude Oil | 18.66% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501018 | 南方原油A | QDII-商品 |  | WisdomTr ee WTI Crude Oil | 18.66% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006476 | 南方原油C | QDII-商品 |  | United States Oil Fund LP | 18.41% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501018 | 南方原油A | QDII-商品 |  | United States Oil Fund LP | 18.41% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006476 | 南方原油C | QDII-商品 |  | UBS CMCI Oil SF ETF | 8.47% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501018 | 南方原油A | QDII-商品 |  | UBS CMCI Oil SF ETF | 8.47% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006476 | 南方原油C | QDII-商品 |  | Simplex WTI ETF | 5.62% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501018 | 南方原油A | QDII-商品 |  | Simplex WTI ETF | 5.62% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 006476 | 南方原油C | QDII-商品 |  | NEXT FUNDS NOMURA Crude Oil Long Index Linked Exchange Traded | 5.42% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501018 | 南方原油A | QDII-商品 |  | NEXT FUNDS NOMURA Crude Oil Long Index Linked Exchange Traded | 5.42% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016667 | 景顺长城全球半导体芯片股票A(QDII-LOF)(美元现汇) | QDII-普通股票 |  | Invesco Dynamic Semiconductors | 18.21% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016668 | 景顺长城全球半导体芯片股票C(QDII-LOF)(人民币) | QDII-普通股票 |  | Invesco Dynamic Semiconductors | 18.21% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501225 | 景顺长城全球半导体芯片股票A(QDII-LOF)(人民币) | QDII-普通股票 |  | Invesco Dynamic Semiconductors | 18.21% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016667 | 景顺长城全球半导体芯片股票A(QDII-LOF)(美元现汇) | QDII-普通股票 |  | iShares Semiconductor ETF | 17.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016668 | 景顺长城全球半导体芯片股票C(QDII-LOF)(人民币) | QDII-普通股票 |  | iShares Semiconductor ETF | 17.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501225 | 景顺长城全球半导体芯片股票A(QDII-LOF)(人民币) | QDII-普通股票 |  | iShares Semiconductor ETF | 17.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016667 | 景顺长城全球半导体芯片股票A(QDII-LOF)(美元现汇) | QDII-普通股票 |  | VanEck Semiconductor ETF | 17.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016668 | 景顺长城全球半导体芯片股票C(QDII-LOF)(人民币) | QDII-普通股票 |  | VanEck Semiconductor ETF | 17.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501225 | 景顺长城全球半导体芯片股票A(QDII-LOF)(人民币) | QDII-普通股票 |  | VanEck Semiconductor ETF | 17.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016667 | 景顺长城全球半导体芯片股票A(QDII-LOF)(美元现汇) | QDII-普通股票 |  | Invesco PHLX Semiconductor ETF | 17.63% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016668 | 景顺长城全球半导体芯片股票C(QDII-LOF)(人民币) | QDII-普通股票 |  | Invesco PHLX Semiconductor ETF | 17.63% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501225 | 景顺长城全球半导体芯片股票A(QDII-LOF)(人民币) | QDII-普通股票 |  | Invesco PHLX Semiconductor ETF | 17.63% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016667 | 景顺长城全球半导体芯片股票A(QDII-LOF)(美元现汇) | QDII-普通股票 |  | 华夏国证半导体芯片ETF | 7.74% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016668 | 景顺长城全球半导体芯片股票C(QDII-LOF)(人民币) | QDII-普通股票 |  | 华夏国证半导体芯片ETF | 7.74% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501225 | 景顺长城全球半导体芯片股票A(QDII-LOF)(人民币) | QDII-普通股票 |  | 华夏国证半导体芯片ETF | 7.74% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016667 | 景顺长城全球半导体芯片股票A(QDII-LOF)(美元现汇) | QDII-普通股票 |  | 国泰CES 半导体芯片行业ETF | 7.68% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016668 | 景顺长城全球半导体芯片股票C(QDII-LOF)(人民币) | QDII-普通股票 |  | 国泰CES 半导体芯片行业ETF | 7.68% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501225 | 景顺长城全球半导体芯片股票A(QDII-LOF)(人民币) | QDII-普通股票 |  | 国泰CES 半导体芯片行业ETF | 7.68% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016667 | 景顺长城全球半导体芯片股票A(QDII-LOF)(美元现汇) | QDII-普通股票 |  | 景顺长城中证芯片产业ETF | 4.97% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016668 | 景顺长城全球半导体芯片股票C(QDII-LOF)(人民币) | QDII-普通股票 |  | 景顺长城中证芯片产业ETF | 4.97% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501225 | 景顺长城全球半导体芯片股票A(QDII-LOF)(人民币) | QDII-普通股票 |  | 景顺长城中证芯片产业ETF | 4.97% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016667 | 景顺长城全球半导体芯片股票A(QDII-LOF)(美元现汇) | QDII-普通股票 |  | Global X Semiconductor ETF/Jap | 1.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 016668 | 景顺长城全球半导体芯片股票C(QDII-LOF)(人民币) | QDII-普通股票 |  | Global X Semiconductor ETF/Jap | 1.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501225 | 景顺长城全球半导体芯片股票A(QDII-LOF)(人民币) | QDII-普通股票 |  | Global X Semiconductor ETF/Jap | 1.73% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017204 | 华宝海外科技股票(QDII-LOF)C | QDII-普通股票 |  | ARK Innovatio n ETF | 18.48% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501312 | 华宝海外科技股票(QDII-LOF)A | QDII-普通股票 |  | ARK Innovatio n ETF | 18.48% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017204 | 华宝海外科技股票(QDII-LOF)C | QDII-普通股票 |  | ARK Genomic | 16.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501312 | 华宝海外科技股票(QDII-LOF)A | QDII-普通股票 |  | ARK Genomic | 16.93% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017204 | 华宝海外科技股票(QDII-LOF)C | QDII-普通股票 |  | ARK Autonomou s Technolog y & Robotics ETF | 10.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501312 | 华宝海外科技股票(QDII-LOF)A | QDII-普通股票 |  | ARK Autonomou s Technolog y & Robotics ETF | 10.15% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017204 | 华宝海外科技股票(QDII-LOF)C | QDII-普通股票 |  | Global X Artificia l Intellige nce & Technolog y ETF | 6.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501312 | 华宝海外科技股票(QDII-LOF)A | QDII-普通股票 |  | Global X Artificia l Intellige nce & Technolog y ETF | 6.32% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017204 | 华宝海外科技股票(QDII-LOF)C | QDII-普通股票 |  | Global X Robotics & Artificia l Intellige nce ETF | 5.05% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501312 | 华宝海外科技股票(QDII-LOF)A | QDII-普通股票 |  | Global X Robotics & Artificia l Intellige nce ETF | 5.05% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017204 | 华宝海外科技股票(QDII-LOF)C | QDII-普通股票 |  | ARK Space & Defense Innovatio n ETF | 5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501312 | 华宝海外科技股票(QDII-LOF)A | QDII-普通股票 |  | ARK Space & Defense Innovatio n ETF | 5% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017204 | 华宝海外科技股票(QDII-LOF)C | QDII-普通股票 |  | State Street Technolog y Select Sector SPDR ETF | 4.67% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501312 | 华宝海外科技股票(QDII-LOF)A | QDII-普通股票 |  | State Street Technolog y Select Sector SPDR ETF | 4.67% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017204 | 华宝海外科技股票(QDII-LOF)C | QDII-普通股票 |  | VanEck Semicondu ctor ETF | 4.39% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501312 | 华宝海外科技股票(QDII-LOF)A | QDII-普通股票 |  | VanEck Semicondu ctor ETF | 4.39% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017204 | 华宝海外科技股票(QDII-LOF)C | QDII-普通股票 |  | iShares Semicondu ctor ETF | 3.33% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501312 | 华宝海外科技股票(QDII-LOF)A | QDII-普通股票 |  | iShares Semicondu ctor ETF | 3.33% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 017204 | 华宝海外科技股票(QDII-LOF)C | QDII-普通股票 |  | Invesco QQQ Trust Series 1 | 3.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 501312 | 华宝海外科技股票(QDII-LOF)A | QDII-普通股票 |  | Invesco QQQ Trust Series 1 | 3.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 513000 | 日经225ETF易方达 | 指数型-海外股票 |  | Listed Index Fund 225 | 94.27% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 513130 | 恒生科技ETF华泰柏瑞 | 指数型-海外股票 |  | 南方恒生科技 | 95.91% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 513130 | 恒生科技ETF华泰柏瑞 | 指数型-海外股票 |  | CSOP HANG SENG TECH INDEX ETF-HKD | 3.02% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 513180 | 恒生科技ETF华夏 | 指数型-海外股票 |  | 华夏恒生科技指数 ETF | 0.38% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 513520 | 日经ETF华夏 | 指数型-海外股票 |  | NEXT FUNDS Nikkei 225 Exchange Traded Fund | 98.75% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 513730 | 东南亚科技ETF华泰柏瑞 | 指数型-海外股票 |  | CSOP IEDGE SEA+ TECH ETF USD | 99.71% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 513800 | 日本东证指数ETF南方 | 指数型-海外股票 |  | One ETF TOPIX | 97.48% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 513880 | 日经225ETF华安 | 指数型-海外股票 |  | MAXIS NIKKEI 225 ETF | 91.92% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 513950 | 恒生红利ETF富国 | 指数型-海外股票 |  | Fullgoal Hang Seng HK High Dividend ETF | 3.23% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 027170 | 交银环球精选混合(QDII)C | QDII-混合偏股 |  | Invesco QQQ Trust Series 1 | 0.66% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 519696 | 交银环球精选混合(QDII)A | QDII-混合偏股 |  | Invesco QQQ Trust Series 1 | 0.66% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 027170 | 交银环球精选混合(QDII)C | QDII-混合偏股 |  | Vanguard S&P 500 ETF | 0.48% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 519696 | 交银环球精选混合(QDII)A | QDII-混合偏股 |  | Vanguard S&P 500 ETF | 0.48% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 520570 | 恒生科技ETF南方 | 指数型-海外股票 |  | CSOP Hang Seng Tech Index ETF | 5.12% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 520580 | 新兴亚洲ETF招商 | 指数型-海外股票 |  | Lion-China Merchants Emerging Asia Select Index ETF | 99.43% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 520830 | 沙特ETF华泰柏瑞 | 指数型-海外股票 |  | CSOP Saudi Arabia ETF | 99.46% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 520870 | 巴西ETF易方达 | 指数型-海外股票 |  | IT Now IBOVESPA Fundo de Indice | 99% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008706 | 建信富时100指数(QDII)C人民币 | 指数型-海外股票 |  | SCOTTISH MORTGAGE | 0.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008707 | 建信富时100指数(QDII)A美元现汇 | 指数型-海外股票 |  | SCOTTISH MORTGAGE | 0.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 008708 | 建信富时100指数(QDII)C美元现汇 | 指数型-海外股票 |  | SCOTTISH MORTGAGE | 0.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 023373 | 建信富时100指数(QDII)D人民币 | 指数型-海外股票 |  | SCOTTISH MORTGAGE | 0.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |
| 539003 | 建信富时100指数(QDII)A人民币 | 指数型-海外股票 |  | SCOTTISH MORTGAGE | 0.69% | 未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。 |

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
