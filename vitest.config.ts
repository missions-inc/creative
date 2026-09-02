import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // 期日はカレンダー日基準。本番（JST）と揃えて検証する。
    env: { TZ: "Asia/Tokyo" },
    testTimeout: 20000,
    hookTimeout: 40000,
    // ルールテストは共有エミュレータ状態を使うため直列実行が安全。
    fileParallelism: false,
    pool: "forks",
  },
});
