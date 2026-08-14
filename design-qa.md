**Findings**
- No P0/P1/P2 findings remain.
  Location: `http://127.0.0.1:5173/?q=NVDA`
  Evidence: the source design and implementation both use a dense decision-sheet layout with dark navigation, top search controls, market filters, branded stock rows, KPI cards, and a fund holdings table. The implementation screenshot shows stock brand images in the left stock list and selected stock heading.
  Impact: the requested Product Design direction and the stock-logo requirement are represented in the rendered UI.
  Fix: none required before handoff.

**Required Fidelity Surfaces**
- Fonts and typography: typography hierarchy is preserved with a strong stock title, compact table labels, and dense financial rows. Implementation uses the project's Chinese/system font stack for production reliability.
- Spacing and layout rhythm: desktop layout matches the selected design's decision-sheet structure; mobile full-page screenshot confirms stacked sections without overlap or clipped controls.
- Colors and visual tokens: dark top navigation, blue active states, red emphasis, pale table bands, and light financial surfaces are consistent with the selected direction.
- Image quality and asset fidelity: all 742 shipped stocks now have local brand-image files under `public/stock-logos`; files were normalized to real PNG bytes. Focused logo comparison confirms visible logo treatment in the stock list and selected stock header.
- Copy and content: implementation uses live project data labels and metrics rather than mock-only labels. The visible copy remains coherent for the app context.

**Open Questions**
- None blocking. Some metric values and stock ordering intentionally differ from the mock because the implementation is bound to the live fund-holdings data.

**Implementation Checklist**
- Implement selected Product Design option 2 layout.
- Add stock brand image rendering to stock candidates and selected stock title.
- Cache one local brand image for each of the 742 shipped stocks.
- Keep remote logo fallbacks in code for future data additions.
- Validate desktop, mobile, and focused logo-region screenshots.
- Run production build.

**Follow-up Polish**
- P3: if exact mock parity is desired later, the recent-query chip order and top-right metric emphasis can be tuned further. This is not blocking for the requested redesign.

**QA Evidence**
- Source visual truth path: `C:\Users\Administrator\.codex\generated_images\019e9eb5-9a5a-7543-a491-281696282f48\ig_093d0ed280c66586016a248a38b574819598e60af0039b130e.png`
- Implementation screenshot path: `D:\vcp_hunter\基金持仓\design-qa-assets\decision-sheet-desktop.png`
- Mobile screenshot path: `D:\vcp_hunter\基金持仓\design-qa-assets\decision-sheet-mobile.png`
- Viewport: desktop `1440x1024`; mobile `390x844`
- State: `?q=NVDA`, configured-quarter fund holdings data loaded
- Full-view comparison evidence: `D:\vcp_hunter\基金持仓\design-qa-assets\decision-sheet-comparison.png`
- Focused region comparison evidence: `D:\vcp_hunter\基金持仓\design-qa-assets\decision-sheet-logo-focus.png`

**Patches Made Since Previous QA Pass**
- Added stock logo rendering in `src/App.tsx`.
- Added a complete local stock-logo cache in `public/stock-logos`.
- Updated CSP image sources in `public/_headers` for future remote logo fallbacks.
- Refined responsive Decision Sheet styling in `src/styles.css`.

final result: passed

---

# 两融栏目离线浏览器验收（Task 6）

## 结论

通过。可从工作树直接执行 `npm run qa:leverage` 完整复跑；不依赖已手工启动的服务、环境变量、线上参考站或外部数据源。浏览器会分别直达 `/research`、`/leverage`、`/methodology`，确认三个栏目互为独立页面。两融正式发布包在浏览器端校验后渲染；篡改临时副本的 `payload_sha256` 会阻断图表而不会显示旧值或未校验数据。

## 测试条件

- 复跑命令：`npm run qa:leverage`。runner 先执行无 SEO 的 TypeScript 校验与 `vite build --outDir` 临时构建，校验主入口存在独立 `LeverageDashboard-*` 异步 chunk；不会调用 `npm run seo` 或 `npm run build`。
- runner 在 `D:\vcp_hunter\_tmp_leverage_qa_*` 创建一个临时根目录，将正式 `public/data` 字节复制到正常预览，再生成两类隔离副本：仅篡改 `payload_sha256` 的坏包，以及重新计算 SHA-256 的合法比例不可用包。后者所有 `ratio_pct` 与市值分母为 `null`，payload／manifest 比例标记、原因、空日期范围与缺失记录数一致。
- runner 自动选择三个 `127.0.0.1` 端口并启动相应静态服务；本次运行的动态端口、生成时间和完整请求清单以 [leverage-browser-qa-result.json](design-qa-assets/leverage-browser-qa-result.json) 为准，不把某次端口作为复跑契约。完成后 runner 验证服务关闭和临时根目录删除。
- 浏览器必须由用户或受控环境预先准备在本工作树的 Playwright 本地路径；缺失时 runner 以中文错误阻断，绝不自动下载依赖或 Chromium。
- 对 runner 源码执行了静态断言：不存在 Playwright CLI／浏览器下载调用，并且存在“不会自动下载浏览器”的中文 fail-closed 提示。
- runner 在开始和 finally 中分别计算正式 `public/data/leverage-dashboard.json` 与 `public/data/leverage-dashboard.manifest.json` 的 SHA-256；本次前后一致，正式发布包未被改写。
- 结构化结果：[leverage-browser-qa-result.json](design-qa-assets/leverage-browser-qa-result.json)。其中保留端口、构建模式、请求清单、断言结果、截图 SHA-256、正式数据前后哈希和清理状态。
- 浏览器：Playwright Chromium；桌面 `1440×1024`、移动端 `390×844`，`deviceScaleFactor=1`，浅色模式。
- 数据截止由正式 `leverage-dashboard.manifest.json` 的 `data_range.end` 动态读取并写入结构化结果；融资余额完整范围、当前比例范围与数据截止均以该结果为准。

## 结果与证据

- 默认余额页：默认选择三只指数 `000001`、`399106`、`399006`；主图左轴为两市融资余额、右轴为共同基期归一化指数。提示框显示当日融资余额、每只指数的原始收盘、归一化值和共同基期。截图：[leverage-default-desktop.png](design-qa-assets/leverage-default-desktop.png)。
- 比例页：比例主图按正式包当前可用范围绘制；`2011-08-03` 至 `2016-12-30` 分母为交易所官方历史原始链已审计口径，`2017-01-03` 起为东方财富Choice厂商口径、未经交易所复核和完整审计。截图：[leverage-ratio-desktop.png](design-qa-assets/leverage-ratio-desktop.png)。
- 基期规则：默认共同基期随当前观察区间动态确定。实际拖动 dataZoom 后，图表中点会变化而共同基期保持不变；手动修改起始日期后，观察区间变为“自定义区间”，共同基期重设为该起始日期。具体日期见结构化结果。
- 移动端：三项导航链接均存在、`overflow-x: auto`、链接高度均为至少 `44px`，`clientWidth >= scrollWidth`，页面宽度 `390px` 没有横向溢出；控件和摘要无截断。截图：[leverage-mobile.png](design-qa-assets/leverage-mobile.png)。
- 坏包阻断：临时 manifest 的哈希被篡改为 64 个 `0` 后，显示“发布包 SHA-256 校验失败。”和“数据截止日：N/A”，且 `.leverage-chart-canvas` 数量为 0。截图：[leverage-blocked.png](design-qa-assets/leverage-blocked.png)。
- 比例不可用：合法临时包通过前端 validator 后，比例按钮处于 disabled，控件和披露同时显示 `N/A` 与非空原因；默认融资余额模式和图表仍正常渲染。该场景的包哈希、记录数、缺失统计、原因与浏览器断言写入结构化结果。
- 离线边界：浏览器拦截全部 `https://*` 请求；正常研究页和 `/leverage` 仍可用。runner 断言实际请求全部属于本次动态分配的 `127.0.0.1` 正常预览，具体端口与请求清单见 [leverage-browser-qa-result.json](design-qa-assets/leverage-browser-qa-result.json)；无 CDN、远程字体、远程图片或外部 API 请求。

## 截图完整性

四张 PNG 均由 runner 检查 PNG 签名与图像尺寸，并已人工视觉复核。截图的动态大小、尺寸与 SHA-256 不在本文写死；唯一动态证据为同目录当前的 [leverage-browser-qa-result.json](design-qa-assets/leverage-browser-qa-result.json)。

正式 `public/data` 两个文件的运行前后 SHA-256、未改写断言和清理状态也只记录在结构化结果中。

## 最终自动化检查

```text
npm run qa:leverage          PASS（自包含正常／坏包／合法比例不可用预览、浏览器断言、SHA 比对和清理）
npm run test:leverage        PASS（12 个测试文件，51 项测试）
npm run verify:leverage      PASS（3,649 条）
npx tsc --noEmit             PASS
npm run verify:leverage:build PASS（独立两融异步 chunk，未运行 SEO）
git diff --check             PASS
```

## 证据缺口与边界

- 比例为东方财富Choice厂商口径；未经交易所复核、未经完整审计，且 `reporting_eligible=false`。本页面只能作描述性展示。
- `2011-08-03` 至 `2016-12-30` 的交易所历史市值分段仍待准出，因此该段比例严格为 `N/A`；页面未插值、移位或沿用旧值。
- DFCF 融资余额为厂商口径／未经交易所复核；融资余额变动仅反映杠杆使用或去杠杆压力代理，不能据此证明强制平仓、爆仓、市场底或必然反弹。
