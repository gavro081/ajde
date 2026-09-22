import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isChatAiEnabled } from "./ai-feature";
afterEach(() => vi.unstubAllEnvs());
it.each([[undefined, true], ["true", true], [" TRUE ", true], ["false", false], ["", false], ["invalid", false]])("parses feature switch %s", (value, expected) => {
  vi.stubEnv("CHAT_AI_ENABLED", value);
  expect(isChatAiEnabled()).toBe(expected);
});
