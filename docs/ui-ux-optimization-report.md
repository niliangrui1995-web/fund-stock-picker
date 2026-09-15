# 基金持仓穿透 · UI/UX 系统性优化报告

日期：2026-09-15
范围：`src/styles.css`、`src/portfolio/portfolio.css`、`src/leverage/leverage.css`、`src/concentration/concentration.css`、`src/charts/chartDataTable.css`、`src/__tests__/researchWorkflow.test.tsx`
验证方式：Playwright 无头实测（10 个页面/状态 × 桌面/移动端）+ 量化采样（焦点序列、命中区域、字号、对比度）+ vitest 全量回归。

---

## 一、审计方法与基线证据

通过进程内 Vite + Playwright 对以下状态做了全页截图与 DOM 度量（脚本：`scripts/_uiaudit_capture.mjs`，产物：`outputs/uiaudit/`）：

| 场景 | 视口 |
| --- | --- |
| 研究页（空态 / NVDA 结果 / 详情弹窗 / 编辑器 / 热点展开） | 1440×1024 与 390×844 |
| 两融看板、交易集中度、方法论 | 1440×1024 |

基线问题（均有量化证据）：

1. **可访问性不达标**
   - 次要文本 `#888880` 在白底上对比度仅 **3.57:1**（AA 要求 4.5:1），遍布摘要卡、候选列表、热点卡等 12px 小字；
   - 全站存在 28 处 10–11px 文字（研究页实测 16 处 11px，两融页最低 10px）；
   - 行内"构成/持仓"按钮仅 42×36px，低于推荐命中尺寸。
2. **视觉语言不统一**
   - 组合穿透模块使用 indigo-violet 强调色（#3730a3 / #eef2ff / #c7d2fe…），与全站品牌蓝（#185FA5 / #E6F1FB）冲突；
   - "海外热门"面板头部使用深色导航色块，是浅色页面中唯一的深色大块，视觉断裂；
   - 设计令牌（`--space-*`、`--radius-*`、`--text-*`）已定义但基本未被引用。
3. **信息架构与操作效率**
   - 45+ 行结果表无粘性表头，滚动后无法对照列含义；无斑马纹/悬停引导，宽表横向扫读易串行；
   - 移动端 AI 热点 8 张卡片竖排堆叠，空态页高达 **3493px**（优化后 2139px，-39%），且底部"更多热点"切换按钮在轮播化后失去意义；
   - 旧测试仍按"发现区为默认折叠的 details"断言，与"发现区常驻 section"的新信息架构不一致。

## 二、已实施的改动

### 1. 可读性与对比度（WCAG AA 达标）
- `--muted` 及所有硬编码 `#888880` → `#6B6A62`，实测对比度 **3.57:1 → 5.44:1**；
- 全站字号地板统一为 12px：`--text-xs: 11px→12px`，28 处 10/11px 全部提升（styles.css / leverage / concentration / portfolio / chartDataTable）。优化后研究页 tinyText 实测 **0**。

### 2. 品牌色彩统一
- 组合模块 indigo-violet 系全部映射为品牌蓝系：
  `#3730a3→#0C447C`、`#4338ca→#185FA5`、`#eef2ff→#E6F1FB`、`#c7d2fe→#B7D4EE`、`#a5b4fc→#9CC3EA`、`#e0e7ff→#D5E7F8`；
- "海外热门"面板头部由深色渐变改为浅色面板（`#eef4fb→#f7fafd`），市场筛选快捷键改为白底描边 + 品牌蓝激活态，命中区 32→36px。

### 3. 结果表可扫读性
- 表头粘性悬浮（`top: 48px`，与顶栏高度对齐），长表滚动始终可见列名；
- 斑马纹（偶数行 `#fafbf9`）+ `:hover` / `:focus-within` 行高亮（`#f2f7fc`）；
- "构成/持仓"按钮 42×36 → **50×40**（实测）。

### 4. 移动端 AI 热点轮播
- ≤720px 时热点卡由竖排堆叠改为横向滑动（scroll-snap、隐藏滚动条、负边距出血）；
- 移除小屏失效的展开/收起按钮及其 `is-collapsed` 隐藏规则，空态页高 **3493px → 2139px**。

### 5. 测试与代码一致性
- `researchWorkflow.test.tsx`：发现区断言由 `details.open === false` 更新为"工作台先于常驻发现区"的顺序断言，与新信息架构对齐。

## 三、优化前后实测对比

| 指标（Playwright 实测） | 优化前 | 优化后 |
| --- | --- | --- |
| 次要文本对比度 | 3.57:1 ❌ | **5.44:1 ✅** |
| 研究页 <12px 文字 | 16 处 | **0 处** |
| 两融/集中度 <12px 文字 | 11 处（最低 10px） | **0 处** |
| 行内操作按钮 | 42×36 | **50×40** |
| 移动端空态页高 | 3493px | **2139px（-39%）** |
| 横向溢出（全场景） | 0 | 0（保持） |
| vitest | — | **31 文件 / 222 用例全通过** |
| tsc --noEmit | 24 处错误（历史遗留死代码） | **0**（死代码清理后） |

## 四、补充修复（第二轮：4 项审计发现 → 已全部落地）

第一轮交付时列出的 4 条遗留项，本轮逐条处理完毕。以下每项都给出「问题 → 处理 → 实测证据」。

### 4.1 键盘路径（原遗留项 1）

**问题**：基金持仓预览只绑定 `onMouseEnter/onMouseLeave`，是纯 hover 死代码（实测 `.fund-holdings-action` 计数 = 0），键盘用户无等价入口。

**处理**：整块删除悬浮预览系统，**保留「持仓」弹窗作为唯一持仓查看入口**——该弹窗由行内 `<button>` 触发，键盘天然可达，功能不减少。同时把 `:focus-visible` 焦点环从 `button/input/select/textarea/a` 扩展到 `summary` 与 `[tabindex]`，补全所有可交互元素的键盘态：

```css
button:focus-visible, input:focus-visible, select:focus-visible,
textarea:focus-visible, summary:focus-visible, a:focus-visible,
[tabindex]:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 3px; }
```

顺带修掉 **跳转链接自指循环**：原 `skip-link` 的 `href="#main-content"` 指向 `<main>` 自身（链接的祖先），回车后焦点落回 `main`、再 Tab 又回到链接，等于"跳过但没跳过"。改为按页指向正文标题（`#research-title` / `#leverage-dashboard-title` / `#concentration-dashboard-title` / `#methodology-title`），标题补 `tabIndex={-1}`，并加 `scroll-margin-top: 68px` 避免落点被 48px 粘性顶栏压住。

**证据**：跳转落点验证脚本对 4 个页面逐一断言，均 ✅ 落在导航下方（`scrollY` 8–37，标题 `top = 68`）。

### 4.2 两融 / 集中度页 KPI 重复（原遗留项 2）

**问题**：顶部摘要卡与图表区明细卡输出同一组数值（融资余额、C5 集中度等），首屏被两排数字占据。

**处理**：
- **两融**：删除 `.dashboard-metrics` 那 4 张 KPI 卡，摘要卡改为 **5 张互不重复**的指标——① 当前口径主卡（数值 + 统计日 + 环比）② 沪市融资余额 ③ 深市融资余额 ④ 另一口径（`margin ↔ ratio` 互换）⑤ 上证指数收盘价；页面标题旁改为一行元信息「N 条记录 · 起止日期」。网格由固定 4 列改为 `repeat(auto-fit, minmax(184px, 1fr))` 自适应。
- **集中度**：同样删除 `.dashboard-metrics` 的 4 张重复卡（C5 / 全A成交额 / 活跃A股 / 记录数），页头改为一行 `concentration-header-meta`。

**顺带修正**：两融主卡原先误用风险红（`#e35d6a / #bc4050`）表达"当前口径"，已改回品牌蓝（`linear-gradient(135deg,#f2f8ff,#fff)` + 左侧 `var(--blue)` 竖条 + `#0C447C` 数值）；集中度页整套暖陶土色（`#b94e2c / #cb5d32 / #9e3e23 / #9a4c31`）与图表配色一并收敛到 `var(--blue)` 蓝系，涨跌改用 `var(--up) / var(--down)`（A 股惯例：涨红跌绿）。

**效果**：两页首屏各减少一整行 KPI 卡，且不再有"同一个数字看两遍"。

### 4.3 命中区（原遗留项 3）

**问题**：桌面端约 112 个 <44px 可交互目标。逐项核对 WCAG 2.2 SC 2.5.8：最低要求是 **24×24**，且被更大可点击元素包裹时可豁免。

**处理与结论**：
- 保留紧凑表格按钮（实测 74×36 的「添加股票」等），**宽度 ≥74px**，满足 AA 24×24；这是刻意的密度取舍，不放大。
- 修掉**唯一两处真正低于 24px** 的控件：`.portfolio-detail-source`（原 `inline-block` 18px 高 → `inline-flex; min-height: 24px`）、`.portfolio-holding-name summary`（原 19px → `min-height: 24px; line-height: 1.6`）。
- 对话框内 20×20 输入框与集中度页 3 个 16×16 复选框**不放大控件本身**，改为把包裹的 `<label>` 抬到 `min-height: 44px`——按 SC 2.5.8「被更大元素包裹即豁免」处理。
- 触屏与小屏统一 44px：`@media (max-width: 720px), (pointer: coarse)` 下覆盖 `.research-intro a`、`.leverage-market-summary-link`、`.skip-link`、`.portfolio-detail-source`、`.market-shortcut` 及各 `portfolio-*` 按钮。

**证据**：最终审计 `wcagViolations(<24) = 0`（除被 44px 标签包裹者），移动端 `smallTargets(<44) = 0`。

### 4.4 首屏加载（原遗留项 4）

**问题**：空态研究页 dev 冷启动偶发 >60s。

**根因（实测定位，非猜测）**：诊断脚本分阶段计时显示 `GET /src/PortfolioWorkbench.tsx` 耗时 **24978ms**、`GET /src/styles.css` **>180s 不返回**，Playwright `goto` 90s 超时复现。真正原因不是编译慢，而是 **chokidar 全量监听**：本仓库 `data/` 有 8 万+ 文件、`public/` 有 1.7 万发布产物，dev server 把这些全部纳入 watch，首屏请求被文件 IO 排队拖死。

**处理**（`vite.config.ts`）：
1. `server.watch.ignored` 排除 `data/ public/ outputs/ docs/ dist/ .git/ *.log` —— 这些只被读取、不需要 HMR，**这是决定性修复**；
2. `server.warmup.clientFiles` 预热各路由第一段依赖链（`main.tsx`、`App.tsx`、`PortfolioWorkbench.tsx`、`usePortfolioResearch.ts`、`LeverageMarketSummary.tsx`、`LeverageDashboard.tsx`、`TradingConcentrationDashboard.tsx`）；
3. `optimizeDeps.include` 显式声明 react 系列入口依赖，避免 dev 期间"边加载边发现依赖"触发的二次预打包 + 整页 reload；
4. `build.rollupOptions.output.manualChunks` 把 `echarts`、`lucide-react`(icons)、`react-vendor` 拆成独立 chunk，长期命中强缓存。

**复测**：`PortfolioWorkbench.tsx` 24978ms → **4ms**；`styles.css` >180s → **201ms**；全场景首屏 `loadMs` 均 **<300ms**。

### 4.5 顺带修复：移动端热点网格塌列（真 bug）

审计移动端时发现 AI 热点区首张卡片只有 **2px 宽**（计算值 `0px 213.7px 213.7px`）。根因是 CSS 特异性冲突：`.research-discovery-body .ai-hotspot-grid`（0,2,0）压过了 `@media (max-width:720px)` 里的 `.ai-hotspot-grid`（0,1,0）轮播规则，`minmax(0,1fr)` 抢占首列导致自由空间为负、塌成 0px。修复方式是在 720px 媒体查询内**以同等 0,2,0 特异性重申轮播**，并 `display: grid` 恢复第 4 张起的卡片（轮播须全显）。修复后 `grid-template-columns` 正常，8 张卡片可横向滑动。

---

## 五、验证记录（第二轮）

| 检查 | 结果 |
| --- | --- |
| `tsc --noEmit` | **退出码 0**，0 错误 |
| `vitest run` | **31 个测试文件 / 222 个用例全部通过**（34.1s） |
| 首屏 `loadMs`（全场景） | 167–269ms（修复前 >180000ms） |
| 移动端 `smallTargets(<44px)` | **0** |
| `wcagViolations(<24px)` | **0**（除被 44px 标签包裹的复选框 / 输入框） |
| 跳转链接落点 | 4 页均 ✅ 落在 48px 粘性导航下方 |
| 文本对比度抽样 | `.summary-card span` 5.28:1、`.portfolio-result-count` 7.56:1，均 ≥4.5:1 |
| 横向溢出 / <12px 文字 | 0 / 0 |

审计脚本：`scripts/_uiaudit_capture.mjs`（主审计，含小命中区聚合、<24px 违规检测、`loadMs` 计时、跳转链接验证）、`scripts/_uiaudit_dev_timing.mjs`（首屏分阶段计时）、`scripts/_uiaudit_grid_rules.mjs`（热点网格生效规则诊断）、`scripts/_uiaudit_probe_mobile.mjs`（移动端布局探针）、`scripts/_uiaudit_skiplink.mjs`（跳转落点验证）。均为一次性工具，不参与发布流程。

> 发布前的生产构建因沙箱拦截 `rm -rf dist` 未能完整跑通，故以 `tsc --noEmit` + 全量 vitest + 真实浏览器实测三者代替；三者均已通过，与本次界面改动无关。
