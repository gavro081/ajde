import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Live checks against the real OpenAI API. Not part of `npm test`; run with `npm run test:live`.
// They cost a few cents per run and depend on model behaviour, so run them by hand when
// changing prompts, schemas or models.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/live/**/*.live.test.ts"],
    env: loadEnv("live", process.cwd(), ""),
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
