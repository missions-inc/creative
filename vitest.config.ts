import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 40000,
    // ルールテストは共有エミュレータ状態を使うため直列実行が安全。
    fileParallelism: false,
    pool: "forks",
  },
});
