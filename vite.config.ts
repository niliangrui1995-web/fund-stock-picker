import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
