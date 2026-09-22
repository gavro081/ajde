import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { aiImportPipelineEnabled } from "./import-pipeline-config";

afterEach(() => vi.unstubAllEnvs());
it.each([undefined, "false", "TRUE", "1", " true", "invalid"])("keeps the pipeline disabled for %s", value => {
  vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", value);
  expect(aiImportPipelineEnabled()).toBe(false);
});
it("enables the pipeline only for the explicit true value", () => {
  vi.stubEnv("AI_IMPORT_PIPELINE_ENABLED", "true");
  expect(aiImportPipelineEnabled()).toBe(true);
});
