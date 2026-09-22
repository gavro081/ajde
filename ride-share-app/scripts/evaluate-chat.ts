import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { runChatAssistant } from "../lib/ai/chat-assistant";
import { aiModelSchema, type AiRequest } from "../lib/chat/ai-contract";
import cases from "../fixtures/chat/ai-cases.json";

loadEnvConfig(process.cwd());
async function main() {
  if (process.env.CHAT_AI_LIVE !== "1") throw new Error("Set CHAT_AI_LIVE=1 to run the opt-in synthetic model evaluation.");
  for (const fixture of cases) {
    const messages = fixture.messages.map((body, index) => ({ id: `94000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      created_at: new Date(Date.UTC(2026, 8, 22, 10, index)).toISOString(), author: body.slice(0, body.indexOf(":")), body }));
    const request: AiRequest = fixture.mode === "summary" ? { rideId: "94000000-0000-4000-8000-000000000001", mode: "summary" }
      : { rideId: "94000000-0000-4000-8000-000000000001", mode: "question", question: fixture.question! };
    const output = aiModelSchema.parse(await runChatAssistant(request, messages));
    assert.equal(output.insufficientEvidence, fixture.insufficient, fixture.name);
    const text = output.items.map(item => item.text).join(" ").toLowerCase();
    for (const expected of fixture.contains) assert.ok(text.includes(expected.toLowerCase()), `${fixture.name}: missing ${expected}`);
    for (const forbidden of fixture.forbidden ?? []) assert.ok(!text.includes(forbidden.toLowerCase()), fixture.name);
    if (fixture.noDecisions) assert.ok(output.items.every(item => item.category !== "decision"), fixture.name);
    if (fixture.insufficient) assert.equal(output.items.length, 0);
    else assert.ok(output.items.length > 0);
    for (const item of output.items) for (const id of item.messageIds) assert.ok(messages.some(message => message.id === id), "Invented citation");
    console.log(`PASS ${fixture.name}`);
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Chat evaluation failed"); process.exitCode = 1; });
