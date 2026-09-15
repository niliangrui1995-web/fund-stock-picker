import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 首屏冷启动预热名单：这些文件是各路由的第一段依赖链。
// dev 模式下 Vite 是按请求懒编译的，空态研究页首次访问往往要等整条链编译完
// （实测偶发 >60s）。warmup 让 dev server 在启动时就并行预编译它们，
// 首屏因此只等一次命中缓存的转换，而不是等整条链现场编译。
const WARMUP_CLIENT_FILES = [
  "./src/main.tsx",
  "./src/App.tsx",
  "./src/portfolio/PortfolioWorkbench.tsx",
  "./src/portfolio/usePortfolioResearch.ts",
  "./src/leverage/LeverageMarketSummary.tsx",
  "./src/leverage/LeverageDashboard.tsx",
  "./src/concentration/TradingConcentrationDashboard.tsx",
];

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // 显式声明入口依赖，避免 dev 期间"边加载边发现新依赖"触发的二次预打包 + 整页 reload
    // （这正是冷启动偶发长时间卡住的主因之一）。
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: {
    warmup: {
      clientFiles: WARMUP_CLIENT_FILES,
    },
    watch: {
      // 关键性能修复：本仓库 data/ 有 8 万+ 个数据文件、public/ 有 1.7 万个发布产物。
      // 默认全量 chokidar 监听会把这些全部纳入 watch，首屏请求被 IO 排队拖到
      // 数十秒甚至超时（实测 GET /src/styles.css 曾 >180s 未返回）。
      // 这些目录只用于「被读取」，不需要 HMR，因此排除掉。
      ignored: [
        "**/data/**",
        "**/public/**",
        "**/outputs/**",
        "**/docs/**",
        "**/dist/**",
        "**/dist-buildcheck/**",
        "**/.git/**",
        "**/*.log",
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 将稳定的第三方依赖拆成独立 chunk：
        // 框架代码基本不变，可长期命中强缓存；业务代码更新时用户只需重新下载小的业务 chunk。
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("echarts") || id.includes("zrender")) {
              return "echarts";
            }
            // 注意：lucide-react 路径也包含 "react"，必须放在 react 判断之前
            if (id.includes("lucide-react")) {
              return "icons";
            }
            if (id.includes("react") || id.includes("scheduler")) {
              return "react-vendor";
            }
          }
          return undefined;
        },
      },
    },
  },
});
