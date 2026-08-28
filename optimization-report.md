# 出海钱眼 页面全面优化报告

日期：2026-08-22 ｜ 所有功能逻辑与品牌风格（深蓝导航 + 玫红/靛蓝品牌色）保持不变

## 一、问题分析与改进理由

### 1. 加载性能（问题最严重）

| 问题 | 现状 | 影响 |
|---|---|---|
| 5MB 数据 JSON 双重 no-cache | `fetch(..., {cache:"no-cache"})` + `_headers` 对 `/data/*.json` 下发 `Cache-Control: no-cache` | 每次访问都重新验证/下载 5MB 索引文件，回访体验极差 |
| 742 张股票 logo 无缓存头 | `/stock-logos/*` 未配置任何 Cache-Control | 回访时浏览器只能启发式缓存，命中率不稳定 |
| 单一 JS bundle | 240KB 主包混合业务代码与 React 运行时 | 业务每次迭代用户都要重新下载不变的框架代码 |

### 2. 视觉设计

- 字号过小：多处 9–10px 中文文本（悬浮卡标签、热点指标小字），低于可读下限。
- 留白节奏不统一：各区块间距 12–28px 混用，缺少设计令牌（tokens）体系。
- `.topbar` 背景为不透明渐变却叠加 `backdrop-filter: blur(8px)`，纯浪费 GPU 渲染。

### 3. 用户体验

- **页面没有 h1**：`<main>` 内最高只有 h2，影响 SEO 与读屏器层级导航。
- **搜索无实时反馈**：输入关键词后只能通过左侧候选列表间接选择，核心操作路径长；"查询"按钮在无匹配时点击无任何反馈。
- 无"跳过导航"链接（键盘/读屏用户每次都要 Tab 穿过整个顶栏）。
- 无 `prefers-reduced-motion` 支持，动效对晕动症用户不友好。

### 4. 响应式适配

- 移动端 topbar 三行堆叠（品牌/导航/数据徽章）高达 ~140px 且 sticky 吸顶，严重压缩内容区。
- `min-height: 100vh` 在移动端地址栏伸缩时产生跳动，应使用 `100dvh`。
- 表格 `min-width: 980px` + 常规单元格内边距在手机上横向滚动距离过长。

## 二、具体优化方案（已实施）

### 性能

1. `src/App.tsx`：数据 fetch 移除 `cache:"no-cache"`（URL 自带 `?v=季度` 版本参数，切换季度自动失效）。
2. `public/_headers`：
   - `/data/*.json` → `public, max-age=604800, stale-while-revalidate=86400`（7 天强缓存 + 后台过期刷新）
   - 新增 `/stock-logos/*` → `immutable, 1 年`
   - 新增 sitemap/robots/og-image 缓存规则
3. `vite.config.ts`：manualChunks 分包 —— 业务代码 41KB / react-vendor 194KB / icons 6KB / echarts 550KB（echarts 仍按需加载，仅两融页触发）。稳定依赖长期命中强缓存。

### 视觉

4. `src/styles.css` 新增设计令牌：`--space-*` / `--radius-*` / `--text-*`，统一全站节奏。
5. 统一区块间距为 20px 节奏，搜索区/热点区/结果区留白加大（24→28px）。
6. 9–10px 字号统一提升至 10–11px。
7. 移除无效 `backdrop-filter`。

### 用户体验

8. 新增搜索实时下拉建议（前 5 条匹配，含市场/基金数/最高占比），支持 Esc 关闭、点击外部关闭。
9. 每个路由页面新增唯一 h1（视觉隐藏），完善语义层级。
10. 新增 skip-link 跳转链接；查询按钮无匹配时禁用并降透明度。
11. `prefers-reduced-motion` 降级动效。

### 响应式

12. 移动端 topbar 重构：品牌 + 数据期同排、导航单行横滑、隐藏次要徽章，高度从 ~140px 降至 ~90px。
13. `100vh` → `100dvh`（保留 vh 兜底）。
14. 移动端表格 `min-width` 降至 860px、单元格内边距压缩，缩短横向滚动距离；`-webkit-overflow-scrolling: touch`。

## 三、验证结果

- `tsc --noEmit` 零错误
- `vite build` 成功，分包生效（业务 chunk 仅 41KB / gzip 13KB）
- 预览服务器冒烟测试：首页 200、数据 JSON 5MB 完整返回、vendor JS 200

## 四、遗留事项

- 项目根目录的 `dist-old-backup/`、`dist-verify/` 为旧构建产物备份，环境的删除保护组件无法在本机处理中文路径批量删除，可手动删除。
- 数据 JSON 本体 5MB，后续可考虑服务端 Brotli 压缩（Cloudflare 通常已自动开启）或拆分 fundHoldings 按需加载。
