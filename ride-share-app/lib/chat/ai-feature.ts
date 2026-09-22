import "server-only";

/** Server runtime switch shared by the room page and AI endpoint. */
export function isChatAiEnabled(): boolean {
  return (process.env.CHAT_AI_ENABLED ?? "true").trim().toLowerCase() === "true";
}
