import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempParent = resolve(
  process.env.LEVERAGE_BUILD_TEMP_PARENT ?? resolve(projectRoot, "..", ".."),
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runNodeProgram(program, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [program, ...args], {
      cwd: projectRoot,
      stdio: "inherit",
    });
    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`命令执行失败（退出码 ${code ?? "未知"}）。`));
    });
  });
}

function isSafeTemporaryPath(tempDirectory) {
  const pathFromParent = relative(tempParent, tempDirectory);
  return (
    pathFromParent.length > 0 &&
    !pathFromParent.startsWith("..") &&
    !pathFromParent.includes(".." + "\\") &&
    tempDirectory.startsWith(tempParent) &&
    dirname(tempDirectory) === tempParent
  );
}

async function verifyBuildOutput(tempDirectory) {
  const assetsDirectory = join(tempDirectory, "assets");
  const assets = await readdir(assetsDirectory, { withFileTypes: true });
  const assetNames = assets.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const entryName = assetNames.find((name) => /^index-.*\.js$/.test(name));
  const leverageName = assetNames.find((name) => /^LeverageDashboard-.*\.js$/.test(name));
  const marketSummaryName = assetNames.find((name) => /^LeverageMarketSummary-.*\.js$/.test(name));
  const marketSummaryCssName = assetNames.find((name) => /^LeverageMarketSummary-.*\.css$/.test(name));
  const echartsName = assetNames.find((name) => /^echarts-.*\.js$/.test(name));

  assert(entryName !== undefined, "临时构建缺少主入口 JavaScript chunk。");
  assert(leverageName !== undefined, "两融模块未被输出为独立异步 chunk。");
  assert(marketSummaryName !== undefined, "市场环境摘要未被输出为独立异步 chunk。");
  assert(marketSummaryCssName !== undefined, "市场环境摘要未被输出为独立 CSS chunk。");
  assert(echartsName !== undefined, "完整两融图表未保留独立 ECharts chunk。");

  const entryText = await readFile(join(assetsDirectory, entryName), "utf8");
  const leverageText = await readFile(join(assetsDirectory, leverageName), "utf8");
  const marketSummaryText = await readFile(join(assetsDirectory, marketSummaryName), "utf8");
  const marketSummaryCssText = await readFile(join(assetsDirectory, marketSummaryCssName), "utf8");

  const assetMapMatch = entryText.match(/m\.f\|\|\(m\.f=\[(.*?)\]\)/);
  assert(assetMapMatch !== null, "主入口缺少 Vite 异步依赖映射，无法审计按需边界。");
  const assetMap = JSON.parse(`[${assetMapMatch[1]}]`);
  assert(Array.isArray(assetMap) && assetMap.every((asset) => typeof asset === "string"), "主入口异步依赖映射格式无效。");

  const dynamicDependencies = (chunkName) => {
    const escapedChunkName = chunkName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `import\\(["']\\./${escapedChunkName}["']\\)[\\s\\S]{0,240}?__vite__mapDeps\\(\\[([^\\]]*)\\]\\)`,
    );
    const match = entryText.match(pattern);
    assert(match !== null, `主入口未以动态 import 引用 ${chunkName}。`);
    const indices = match[1]
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10));
    assert(indices.every((index) => Number.isInteger(index) && index >= 0 && index < assetMap.length), `主入口中 ${chunkName} 的异步依赖索引无效。`);
    return indices.map((index) => assetMap[index]);
  };

  const dashboardDependencies = dynamicDependencies(leverageName);
  const marketSummaryDependencies = dynamicDependencies(marketSummaryName);
  const referencesAsset = (dependencies, assetName) =>
    dependencies.some((dependency) => dependency === assetName || dependency.endsWith(`/${assetName}`));

  assert(
    referencesAsset(marketSummaryDependencies, marketSummaryName) &&
      referencesAsset(marketSummaryDependencies, marketSummaryCssName),
    "市场环境摘要动态边界缺少自身 JS 或 CSS 依赖。",
  );
  assert(
    !entryText.includes("/data/leverage-dashboard.json") &&
      !entryText.includes("/data/leverage-dashboard.manifest.json"),
    "研究页主入口错误地内联了两融发布包 URL，可能导致首屏请求。",
  );
  assert(
    !referencesAsset(marketSummaryDependencies, leverageName) &&
      !referencesAsset(marketSummaryDependencies, echartsName) &&
      !marketSummaryDependencies.some((asset) => asset.includes("zrender")),
    "研究页市场环境摘要的动态依赖错误地包含完整看板、ECharts 或 zrender。",
  );
  assert(
    !marketSummaryText.includes("LeverageDashboard") &&
      !marketSummaryText.includes("LeverageChart") &&
      !marketSummaryText.includes("LeverageControls") &&
      !marketSummaryText.includes("echarts") &&
      !marketSummaryText.includes("zrender"),
    "市场环境摘要 chunk 错误地依赖完整两融看板或 ECharts/zrender。",
  );
  assert(
    marketSummaryText.includes("/data/leverage-dashboard.json") &&
      marketSummaryText.includes("/data/leverage-dashboard.manifest.json"),
    "市场环境摘要未通过既有同源两文件发布包读取数据。",
  );
  assert(
    !marketSummaryCssText.includes("leverage-dashboard") &&
      marketSummaryCssText.includes("leverage-market-summary"),
    "市场环境摘要 CSS 混入完整两融看板样式或缺少自身命名空间。",
  );
  assert(
    referencesAsset(dashboardDependencies, echartsName) && leverageText.includes(echartsName),
    "完整两融看板不再保留 ECharts 的异步加载链路。",
  );

  return { entryName, leverageName, marketSummaryName, marketSummaryCssName, echartsName };
}

let temporaryOutputDirectory = null;

try {
  temporaryOutputDirectory = await mkdtemp(join(tempParent, "_tmp_leverage_build_"));
  assert(isSafeTemporaryPath(temporaryOutputDirectory), "临时构建目录不在允许的父目录内。");

  await runNodeProgram(resolve(projectRoot, "node_modules", "typescript", "bin", "tsc"), ["--noEmit"]);
  await runNodeProgram(resolve(projectRoot, "node_modules", "vite", "bin", "vite.js"), [
    "build",
    "--outDir",
    temporaryOutputDirectory,
    "--emptyOutDir",
  ]);

  const chunks = await verifyBuildOutput(temporaryOutputDirectory);
  console.log(
    `两融按需构建校验通过：主入口 ${chunks.entryName}，异步完整看板 ${chunks.leverageName}，异步市场摘要 ${chunks.marketSummaryName}/${chunks.marketSummaryCssName}，ECharts ${chunks.echartsName}；研究页首屏不含两融发布包或 ECharts 依赖；未执行 SEO 生成。`,
  );
} catch (error) {
  const reason = error instanceof Error ? error.message : "未知错误。";
  console.error(`两融按需构建校验失败：${reason}`);
  process.exitCode = 1;
} finally {
  if (temporaryOutputDirectory !== null) {
    if (!isSafeTemporaryPath(temporaryOutputDirectory)) {
      console.error("两融按需构建校验失败：拒绝删除未验证的临时目录。");
      process.exitCode = 1;
    } else {
      await rm(temporaryOutputDirectory, { recursive: true, force: true });
      console.log(`已删除临时构建目录：${temporaryOutputDirectory}`);
    }
  }
}
