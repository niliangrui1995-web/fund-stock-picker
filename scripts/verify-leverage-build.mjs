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

  assert(entryName !== undefined, "临时构建缺少主入口 JavaScript chunk。");
  assert(leverageName !== undefined, "两融模块未被输出为独立异步 chunk。");

  const entryText = await readFile(join(assetsDirectory, entryName), "utf8");
  assert(
    entryText.includes(leverageName),
    "主入口未以动态 import 引用两融异步 chunk。",
  );

  return { entryName, leverageName };
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
    `两融按需构建校验通过：主入口 ${chunks.entryName}，异步两融 chunk ${chunks.leverageName}；未执行 SEO 生成。`,
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
