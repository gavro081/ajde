import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // tests/live calls the real OpenAI API and runs separately via `npm run test:live`.
  test: { exclude: [...configDefaults.exclude, "tests/live/**"] },
});
