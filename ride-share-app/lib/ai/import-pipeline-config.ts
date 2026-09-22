import "server-only";

/** Server authority; never infer enablement from a client request. */
export function aiImportPipelineEnabled(): boolean {
  return process.env.AI_IMPORT_PIPELINE_ENABLED === "true";
}
