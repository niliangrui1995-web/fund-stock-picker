# 出海钱眼 UI / UX 系统性优化报告

日期：2026-09-15。
范围：静态基金持仓穿透工具（React 19 + TypeScript + Vite 6，离线同源运行）。
对象：`/research`（基金穿透）、`/leverage`（两融数据）、`/concentration`（交易集中度）、`/methodology`（数据口径）。

本轮不改动任何数据口径与业务结论，只处理界面层：**视觉布局、交互逻辑、信息层级、操作效率、可访问性**。

---

## 一、审计方法与基线

不依赖主观描述，全部结论来自可复现的浏览器实测。

| 手段 | 内容 |
|---|---|
| 静态盘点 | 组件/样式可达性分析：`tsc --noEmit` 报错、未被引用的组件、未被任何选择器匹配的 CSS 类、从未挂载的类名 |
| 浏览器实测 | Playwright + Chrome（headless），桌面 1440×1024、移动 390×844；在同一进程内启动 Vite dev server，避免依赖常驻服务 |
| 量化指标 | 文档高度、横向溢出、可点元素总数、命中区域 <44×24 的数量、<12px 字号元素数、键盘 Tab 序列、文本对比度与非文本对比度采样 |
| 流程复现 | 空态 → 搜索 → 结果表 → 展开构成 → 打开持仓详情 → 组合编辑 → 保存 → 切换页签 |

基线采集脚本：[`outputs/uiaudit-after/audit-capture.mjs`](../outputs/uiaudit-after/audit-capture.mjs)（一次性审计工具，不属于发布流程；归档于截图目录以免混入发布脚本）。

---

## 二、核心功能与用户操作流程复核

现有信息架构本身是合理的，本轮**未做结构性推翻**，只修正层级与可达性。

```
基金穿透（默认）
├── 搜索区        单只证券 / 组合（≤10 只）→ 立即出结果
├── 结果区        工作台（组合编辑 + 保存）→ 结果表（场外基金 / 场内 ETF 双页签）
│   ├── 行内「构成」  展开：直接暴露 / 间接估算 / 来源公式 / 关联份额
│   └── 行内「持仓」  弹窗：该基金披露的全部持仓（可检索、可只看本次研究对象）
├── AI 热点       默认折叠，展开显示 3 条，按需查看更多
└── 海外热门      快捷入口
两融数据 / 交易集中度 / 数据口径   独立页面，按需加载数据包
```

关键流程的“下一步是否明确”是本轮重点：原设计在**未选标的时结果区完全空白**，用户不知道可以做什么。

---

## 三、问题清单（按类别，附实测证据）

### A. 交互逻辑

| # | 问题 | 证据 |
|---|---|---|
| A1 | **AI 热点「更多热点」只能展开不能收起。** `is-collapsed` 类从未被挂载，模板字符串漏写条件分支 | 实测点击前后：按钮文案由「更多热点（5）」变「收起」，但可见卡片 3 → 8，`.is-collapsed` 计数 = 0；再次点击无法回到 3 |
| A2 | **基金持仓悬浮预览为完全不可达死代码。** 整个预览卡系统只绑定 `onMouseEnter/onMouseLeave`，无 `onFocus`、无键盘入口、无触摸等价物，且与「持仓」弹窗功能重叠 | `.fund-holdings-action` 实测计数 = 0；全局检索无任何测试或样式选择器依赖它 |
| A3 | **长表内键盘导航成本高。** Tab 序列前 20 个焦点全部是行内「构成 / 持仓」按钮，无语义分组、无跳转锚点 | Tab 序列实测：`1. 页签 → 2. 结果容器 → 3-20. 构成/持仓 交替` |

### B. 信息层级与信息密度

| # | 问题 | 证据 |
|---|---|---|
| B1 | **品牌与导航文案重复。** 顶栏左侧同时输出「出海钱眼 基金持仓穿透」，而导航首个条目已是「基金穿透」 | DOM 实测：`.brand-mark` 文本为「出海钱眼 基金持仓穿透」 |
| B2 | **未选标的时结果区空白，无下一步引导。** 空态与「数据加载中」「查询无结果」三种状态在视觉上不可区分 | 空态截图：结果区无任何内容 |
| B3 | **结果表含恒定列，挤占横向预算。** 单标的组合中「覆盖股票」恒为 1 只；无间接来源时「间接估算」恒为 0 | 表头固定 6 列；49 只结果全部为单标的、间接估算为 0 |
| B4 | **前三大重仓与其余行无视觉区分**，长表扫读时无法快速定位主结论 | 行样式仅斑马纹 + 悬停 |

### C. 视觉风格统一

| # | 问题 | 证据 |
|---|---|---|
| C1 | **暖灰与冷灰混用。** 背景已转冷调，但文字中性色、斑马纹仍为暖灰（`#6B6A62`、`#fafbf9`） | 全局色值检索 |
| C2 | **两套蓝色并存。** `--accent`（Blue 400）与 `--blue`（Indigo 600）在多处交替承担「操作色」，焦点环与按钮色不一致 | `--accent-hover: #0C447C` 与 `--blue-hover: #0C447C` 完全同值 |
| C3 | **状态语义色同值多令牌。** `--green/--amber/--rose` 与 `--danger` 并存，其中 `--rose` 与 `--danger` 同值 `#e11d48`；`--rose`、`--green`、`--amber` 实际零引用 | 全局令牌引用检索 |
| C4 | **斑马纹在结果表里从未真正生效。** 选择器为 `tbody tr:nth-child(even)`，而每行数据后紧跟一个隐藏明细行，奇偶被打乱，全部数据行落在奇数位 | 实测前 8 行底色：第 4、5、6、7 行均为 `rgba(0,0,0,0)`，无一行命中 `#f8fafc` |
| C5 | **进度条轨道在 Top3 淡蓝行底上几乎不可见。** 轨道 `#e2e8f0` 对行底 `#eef6fd` 仅 **1.13:1** | 实测：`.table-progress-track` `rgb(226,232,240)` vs `rgb(238,246,253)` = 1.13:1 |

### D. 可访问性

| # | 问题 | 证据（WCAG AA 阈值 4.5:1 正文 / 3:1 大字与非文本） |
|---|---|---|
| D1 | **小字对比度不足。** 摘要卡说明文字为 `rgb(136,136,128)` on white = **3.57:1**，低于 4.5:1 | 对比度采样：`.summary-card span` / `.selected-context span` / `.candidate em` / `.hotspot-title-row em` |
| D2 | **表单控件边框非文本对比度严重不足。** `#cbd5e1` 对白底 = **1.48:1**，远低于 WCAG 1.4.11 要求的 3:1，输入框边界难以辨识 | 控件边框采样 |
| D3 | **存在 11px 正文。** 低于本项目自定的 12px 正文下限 | 字号采样：`tinyText` 集中在 11px |
| D4 | **桌面端 112 个可点元素命中区域 < 44×24**（多为行内小按钮），移动端另有 3 个 <36px | 命中区域采样：桌面 `smallTargets=112` |

### E. 构建阻断（既有）

| # | 问题 | 证据 |
|---|---|---|
| E1 | `LeverageDashboard.tsx` 引用 `dataBounds.start` / `dataBounds.end`，而 `LeverageDateRange` 只提供 `startDate` / `endDate` | `tsc --noEmit` 原始即报错，属发布门禁阻断项 |

---

## 四、改进方案与实现

### 4.1 交互逻辑

| 项 | 实现 | 文件 |
|---|---|---|
| A1 热点折叠 | 修复类名挂载：`className={\`ai-hotspot-section${hotspotsExpanded ? "" : " is-collapsed"}\`}`，展开/收起变为可逆 | `src/App.tsx` |
| A2 死代码清理 | 整块删除悬浮预览卡系统：组件 `FundHoldingsHoverCard`、4 个未被引用的组件（`MetricCard`/`AccessToggle`/`ResultTable`/`IndirectExposureTable`）、相关类型、辅助函数、缓存与全部 hover 状态/副作用，以及对应 CSS（`.fund-holdings-hover-card*`、`.hover-card-*`、`.holding-*` 等约 20 条规则）。**保留「持仓」弹窗作为唯一的持仓查看入口**，功能不减少 | `src/App.tsx`（2353 → 1672 行）、`src/styles.css` |
| A3 长表导航 | 表头改为 `position: sticky; top: 48px`，长表滚动时列含义常驻；行操作按钮补 `title` 语义（「展开 X 各股票的直接 / 间接暴露构成」「查看 X 披露的持仓明细」）；末列表头由「详情」改为语义更准确的「操作」 | `src/portfolio/portfolio.css`、`src/portfolio/PortfolioFundResults.tsx` |

### 4.2 信息层级、信息密度与表格可读性

| 项 | 实现 | 文件 |
|---|---|---|
| B1 去重复 | 顶栏品牌只保留「出海钱眼」；功能区由导航「基金穿透 / 两融数据 / 交易集中度 / 数据口径」承担 | `src/App.tsx` |
| B2 空态引导 | 新增 `IdleGuide` 组件：未选标的时在结果区给出「从一次搜索开始」+ 3 步说明（搜索标的 / 对比穿透结果 / 保存组合深挖）+ 5 个热门标的芯片。仅在 `stockCodes.length === 0` 且非加载/错误态渲染，不干扰已有状态机。芯片桌面 36px、`≤720px` 下 44px | `src/App.tsx`、`src/styles.css` |
| B3 恒定列折叠 | 结果表按实际数据决定表头：仅当存在多标的组合时才显示「覆盖股票」，仅当存在非零间接暴露时才显示「间接估算」；明细行 `colSpan` 同步为动态列数 | `src/portfolio/PortfolioFundResults.tsx` |
| B4 Top3 视觉层级 | 前三行加 `.is-top`：排名徽章填充实心品牌蓝 + 行浅蓝底；移动端卡片化后追加左侧 3px 竖条。徽章承担主要识别（`<tr>` 在 `border-collapse: collapse` 下 `box-shadow` 不可靠） | `src/portfolio/PortfolioFundResults.tsx`、`src/portfolio/portfolio.css` |
| B5 斑马纹修复 | 原 `tbody tr:nth-child(even)` 因每行数据后紧跟隐藏明细行而永不命中，改为在渲染时按序号显式挂 `.is-alt`；同时把 hover / focus-within 规则移到斑马纹与 `.is-top` 之后，避免被行底色压掉 | `src/portfolio/PortfolioFundResults.tsx`、`src/portfolio/portfolio.css` |
| B6 进度条轨道 | 轨道改为半透明中性 `--track: rgba(15,23,42,.28)`：在纯白行底与 Top3 淡蓝行底上观感一致，避免轨道在淡蓝底上「消失」；同时保留填充色与轨道 3.26:1 的可辨分界 | `src/styles.css`、`src/portfolio/portfolio.css` |
| B7 空态去重复 | 引导卡自带的热门标的芯片与紧随其后的「AI 存储热点」面板内容完全相同（同一组 5 个代码上下堆叠）。未选标的时隐藏后者，改由引导卡统一承担一键直达；一旦有研究对象，原面板照常出现 | `src/App.tsx` |

### 4.3 设计令牌统一（视觉风格）

| 项 | 实现 |
|---|---|
| C1 冷调中性 | 背景、渐变、斑马纹、文字中性色全部收敛到冷调灰蓝。斑马纹 `#fafbf9`（暖）→ `--surface-soft`；文字中性色 `#6B6A62`（暖）→ `--muted: #5f6d7e` |
| C2 单蓝主色 | 删除与 `--blue-soft` / `--blue-hover` 完全同值的 `--accent-soft` / `--accent-hover`；`--accent` 仅保留为强调渐变的第二个色标。次级按钮边框、搜索候选选中底、公式引用描边等补入 `--blue-line` / `--blue-line-strong` / `--blue-soft-hover` |
| C3 状态语义收敛 | 六个同值/零引用令牌（`--green`、`--green-soft`、`--amber`、`--amber-soft`、`--rose`、`--rose-soft`）合并为「文字墨色 + 浅底」三对：`--success-ink/--success-soft`、`--warn-ink/--warn-soft`、`--danger-ink/--danger-soft`，保留 `--danger` 用于图标强调。每个墨色均按自身浅底实测 ≥4.5:1 |
| C4 令牌落地 | 用精确字面量替换（非正则）把 `portfolio.css` 中 87 处同值硬编码色值换成 `var()`，替换后复核目标色值残留 = 0。新增 `--line-solid`（装饰性实边）与 `--line-input`（控件边框）两级描边，替代原先混用的 `#e2e8f0` / `#cbd5e1` |
| C5 死令牌清理 | 删除零引用的 `--text-xs/sm/md/base`（其中 xs 与 sm 取值相同，且无任何 `var()` 引用）、`--surface-blue`。间距与圆角阶梯保留（`--space-md/lg`、`--radius-sm/md` 在用） |

### 4.4 可访问性

| 项 | 实现 | 效果 |
|---|---|---|
| D1 文字对比度 | 中性色令牌改为冷调 `#5f6d7e`，全站同族小字同步受益 | 摘要卡说明文字 3.57:1 → **5.28:1**（≥4.5:1） |
| D2 非文本对比度 | 新增 `--line-input: #8593a6`，替换输入框 / 下拉 / 搜索框 / 空态虚线框 / 更多操作面板输入框的边框 | 控件边框 1.48:1 → **3.12:1**（≥3:1，WCAG 1.4.11） |
| D3 最小字号 | 全局最小正文提升到 12px，清理 11px 规则 | `<12px` 文本元素数 = 0 |
| D4 命中区域 | 结果页签按钮 `min-height: 36px → 40px` 并加大内边距；行操作按钮 50×40；移动端 `≤720px` 下工作台内按钮 / 输入 / 下拉 / `summary` 统一 `min-height: 44px` | 移动端 <36px 可点元素降至 **0** |
| D5 语义与焦点 | 保持既有 `aria-sort`、`aria-expanded`、`aria-controls`、表格 `caption`（视觉隐藏）；行操作按钮补 `title`；焦点环使用 `--focus-ring`，深色导航上用 `--focus-ring-on-dark` | 键盘可达性不回退 |

### 4.5 构建阻断修复

`LeverageDashboard.tsx` 中 `{dataBounds.start} 至 {dataBounds.end}` 改为 `{dataBounds.startDate} 至 {dataBounds.endDate}`，与 `LeverageDateRange` 接口一致。修复后 `tsc --noEmit` 通过。

---

## 五、设计系统（本轮定稿）

### 颜色

| 分组 | 令牌 | 值 | 用途 | 对比度 |
|---|---|---|---|---|
| 背景 | `--bg` / `--bg-gradient-*` | `#f5f6f8` / `#f8f9fb` | 页面冷调底色 | — |
| 表面 | `--surface` / `--surface-soft` | `#ffffff` / `#f8fafc` | 卡片 / 次级面 | — |
| 导航 | `--nav` / `--nav-soft` / `--nav-border` | `#0b1329` / `#111a36` / `rgba(255,255,255,.06)` | 顶栏 | 白字 ≥12:1 |
| 文字 | `--ink` / `--ink-strong` | `#334155` / `#16202e` | 正文 / 标题 | ≥10:1 |
| 文字 | `--muted` / `--muted-strong` | `#5f6d7e` / `#4b5563` | 辅助文字 | 5.28:1 / 7.56:1 |
| 描边 | `--line` / `--line-soft` | `rgba(0,0,0,.08)` / `.04` | 分隔线（装饰） | — |
| 描边 | `--line-solid` / `--line-input` | `#e2e8f0` / `#8593a6` | 表格实边 / 控件边框 | — / **3.12:1** |
| 数据 | `--track` | `rgba(15,23,42,.28)` | 进度条轨道（半透明，跨底色一致） | 1.84:1（装饰，见 §8） |
| 品牌蓝 | `--blue` / `--blue-hover` | `#185FA5` / `#0C447C` | 主操作 / 悬停 | 6.52:1 / 9.6:1 |
| 品牌蓝 | `--blue-soft` / `--blue-line` / `--blue-line-strong` / `--blue-soft-hover` | `#E6F1FB` / `#B7D4EE` / `#9CC3EA` / `#D5E7F8` | 浅底 / 描边 / 选中底 | — |
| 强调 | `--accent` | `#378ADD` | 渐变强调色标 | — |
| 状态 | `--success-ink/soft` | `#0f5132` / `#E7F5EE` | 已保存 | ≥6:1 |
| 状态 | `--warn-ink/soft` | `#b45309` / `#FDF3E3` | 未保存 / 待核对 | 4.57:1 |
| 状态 | `--danger-ink/soft`、`--danger` | `#9f1239` / `#fff1f2` / `#e11d48` | 阻断 / 删除 | 8.0:1 |
| 涨跌 | `--up` / `--down` | `#be123c` / `#0f7a5a` | **按 A 股惯例：涨=红 / 跌=绿** | ≥7:1 |

### 间距 / 圆角 / 字号

- 间距阶梯：`4 / 8 / 16 / 24 / 32`（`--space-xs … --space-xl`）。
- 圆角阶梯：`8 / 12 / 16`（`--radius-sm/md/lg`）。
- 字号节奏：`12 / 13 / 14 / 16 / 18 / 20 / 24 / 30`；**正文下限 12px**，核心数值 16px，数值一律等宽 + 右对齐。
- 缓动：`--ease: cubic-bezier(0.16, 1, 0.3, 1)`。

### 断点

`≤360px`（紧凑手机）｜`≤720px`（触控：44px 目标）｜`≤860px`（结果表卡片化）｜`1024 / 1240 / 1280px`（图表与栅格）。

---

## 六、验证记录

### 类型与测试

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | **通过（退出码 0）**，含既有 `LeverageDashboard` 阻断项的修复 |
| `vitest run src/portfolio/__tests__ src/__tests__ src/leverage/__tests__ src/concentration/__tests__` | **31 个测试文件 / 222 项全部通过**（35.5s） |
| 其中研究主流程 | `researchWorkflow.test.tsx` 18 项、`PortfolioWorkbench.test.tsx` 34 项、`usePortfolioResearchInteractions.test.tsx` 12 项全部通过 |

测试选择器契约（`.portfolio-fund-table`、`thead th[aria-sort="descending"]` 含「总估算暴露」、`.portfolio-row-actions` 首个按钮为「构成」、`.portfolio-estimate-detail`、`.portfolio-source-formula`、`.portfolio-share-codes`、`.portfolio-fund-row`）全部保留，未因界面调整而破坏。

> 关于构建：本项目 `npm run build` 会先执行 `rm -rf dist`，而当前沙箱拦截该删除操作（`blocked by policy`）。因此本轮以 `tsc --noEmit` + 全量 vitest + 真实浏览器渲染实测替代构建验证，三者均已通过。这一限制与本次界面改动无关，属既有环境约束。

### 浏览器实测（桌面 1440×1000 / 移动 390×844）

断言脚本：[`outputs/uiaudit-after/audit-probe.mjs`](../outputs/uiaudit-after/audit-probe.mjs)；原始日志：[`outputs/uiaudit-after/probe-result.txt`](../outputs/uiaudit-after/probe-result.txt)；截图与审计日志：[`outputs/uiaudit-after/`](../outputs/uiaudit-after)（优化前基线见 [`outputs/uiaudit/`](../outputs/uiaudit)）。6 段检查全部执行成功，全部断言通过。

| 检查 | 实测结果 |
|---|---|
| 空态引导 | `.idle-guide` 位于工作台之前；标题「从一次搜索开始」；3 步说明 = 搜索标的 / 对比穿透结果 / 保存组合深挖；5 个热门标的芯片（桌面 36px，`≤720px` 44px） |
| 品牌去重复 | `.brand-mark` 文本 = 「出海钱眼」；导航 = 基金穿透 / 两融 / 交易集中度 / 方法论 |
| 热点折叠可逆性 | 可见卡片 **3 → 8**（标签变「收起」）→ **3**（标签回「更多热点（5）」）；`.is-collapsed` 正确挂载 |
| 结果表结构 | 45 行；表头 5 列 `基金 / 直接暴露 / 间接估算 / 总估算暴露 ↓ / 操作`；`aria-sort="descending"` 仍在「总估算暴露」列；明细行 `colSpan=5` 与表头列数一致；「覆盖股票」按预期隐藏（该组合全部为单标的） |
| Top3 视觉层级 | 第 1–3 名徽章 `rgb(24,95,165)` 底 + 白字；第 4 名起 `rgb(230,241,251)` 底 + `rgb(12,68,124)` 字；Top3 行底 `rgb(238,246,253)` |
| 斑马纹 | 45 行中 **22 行**命中 `.is-alt`（`rgb(248,250,252)`），自第 4 行起交替生效；Top3 行底优先于斑马纹 |
| 行操作语义 | `title` = 「展开 建信新兴市场混合(QDII) 各股票的直接 / 间接暴露构成」「查看 建信新兴市场混合(QDII) 披露的持仓明细」 |
| 空态去重复 | 未选标的时「AI 存储热点」芯片面板不再渲染，同一组代码只出现一次（引导卡内） |
| 移动端 | 390px 无横向溢出；数据行 `display: grid`；Top3 卡片左侧 `rgb(24,95,165)` 3px 竖条 + 边框 `rgb(188,216,240)`；高度 <36px 的可点元素 = **0** |
| 文本对比度 | 13 项抽样**全部 PASS**，区间 5.05:1（结果表副标题）～18.43:1（顶栏品牌）；摘要卡 / 候选 / 热点说明文字由 3.57:1 提升到 **5.28:1** |
| 非文本对比度 | 组合搜索框、编辑器输入框边框 **3.12:1 PASS**（原 1.48:1）；进度条填充 **5.98:1 PASS**；进度条轨道 1.13:1 → 1.84:1（装饰性元素，理由见 §8） |
| 最小字号 | <12px 文本元素数 = **0** |
| 引导文案对比度 | 步骤说明 / 热门标签 / 引导正文均 **7.56:1 PASS** |

---

## 七、优化后页面

![桌面端结果表（Top3 强调 + 折叠恒定列）](../outputs/uiaudit-after/A3-fund-table-top.png)

![展开后的暴露构成明细](../outputs/uiaudit-after/A4-fund-breakdown-open.png)

![移动端结果表卡片](../outputs/uiaudit-after/A5-mobile-table.png)

![未选标的时的引导空态](../outputs/uiaudit-after/A1-research-empty-desktop.png)

---

## 八、边界与后续建议

**本轮已实测的边界**

- 真实读屏软件、真实手机触控与真实用户任务访谈**未做**。浏览器宽度 / 键盘 / 文字放大检查不能替代这些实机验证，也不构成完整 WCAG 认证。
- `@media (prefers-reduced-motion)` 仍缺；当前动效集中在 0.15–0.3s 过渡与进度条宽度动画。

**有意保留的设计决策**

- 表格行分隔与卡片描边使用装饰性 `--line-solid`（1.31:1），低于 3:1。理由是它们不承担识别功能：行的识别来自内容，卡片的识别来自填充与投影。控件边框已单独提升到 3.12:1。
- 进度条**轨道**实测 1.84:1，同样低于 3:1，且**有意保持在这个量级**：轨道只是「满量程」刻度的视觉暗示，不承载数值——数值由等宽数字与填充条共同表达，填充条对行底为 5.98:1、对轨道为 3.26:1，均可辨别。若把轨道压暗到 3:1，轨道与填充条的对比会降到 1.9:1，反而让「条有多长」更难读。因此这里选择「填充优先」而非「轨道达标」。
- 危险操作按钮描边 `#fda4af`（对白底 <3:1）保留为装饰性描边，该按钮由填充色与文字「撤销 / 删除」识别。
- 间接暴露的估算口径、0 值含义与「未披露 ≠ 未持有」的提示保持原样，未做任何措辞简化。

**建议后续单独排期**

1. **长表分页密度**：45+ 行结果仍按每次 50 条分页，可评估「按暴露分档折叠」或「只看前 N」的密度选项（涉及产品决策，不在本次范围）。
2. **剩余硬编码色值**：`portfolio.css` 的 `#fda4af`、`#fff`、遮罩 `rgba(15,23,42,.44)` 与各页面零散的 slate 色值尚未令牌化。本轮已把占比最高的 87 处收敛，剩余部分建议在下一次触碰对应组件时顺手迁移，避免为改而改。
3. **导航分组**：结果页签与工作台之间可增加跳转锚点，进一步降低长表内的键盘导航成本。
4. **`prefers-reduced-motion`** 支持。

**参考规范**：[WCAG 1.4.11 非文本对比度](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) · [WCAG 1.4.3 对比度（最低）](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [ARIA 表格模式](https://www.w3.org/WAI/ARIA/apg/patterns/table/) · [WAI 表格教程](https://www.w3.org/WAI/tutorials/tables/)

---

## 九、第二轮补充修复（4 项审计发现已闭环）

本文档记录的是第一批问题清单（A1–E1）。随后由独立审计又提出 4 条遗留项，均已在本轮处理完毕，**详细记录见 [`ui-ux-optimization-report.md`](./ui-ux-optimization-report.md) 第四章**，此处仅列结论：

| 遗留项 | 处理 | 关键实测 |
|---|---|---|
| 1. 键盘路径 | 删除 hover-only 死代码，保留「持仓」弹窗为唯一入口；`:focus-visible` 扩展到 `summary` / `[tabindex]`；修复跳转链接自指循环 | 4 页跳转落点均落在 48px 导航下方 |
| 2. 两融/集中度 KPI 重复 | 各删一组重复 KPI 卡；两融摘要改 5 张互不重复指标卡；集中度页头收敛为一行元信息 | 两页首屏各减一行 |
| 3. 命中区 | 保留 74×36 紧凑按钮（满足 AA 24×24）；修掉唯一 2 处 <24px 控件；触屏统一 44px | `wcagViolations(<24)=0`，移动端 `smallTargets(<44)=0` |
| 4. dev 首屏 >60s | 根因是 chokidar 全量监听 8 万+ `data/` 文件；`watch.ignored` + `warmup` + `optimizeDeps.include` + `manualChunks` 拆包 | `styles.css` >180s → **201ms**；首屏 `loadMs` 全部 <300ms |

顺带修复移动端 AI 热点网格首列塌成 0px 的特异性冲突（CSS 0,2,0 vs 0,1,0）。
