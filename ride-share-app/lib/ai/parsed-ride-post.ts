import { z } from "zod";

import { importedRideDraftSchema } from "../rides/ride-draft";

export const parsedRidePostSchema = z.object({
  classification: z.enum(["offer", "request", "unknown"]),
  sourceLanguage: z.enum(["mk", "sq", "mixed", "unknown"]),
  draft: importedRideDraftSchema,
});

export type ParsedRidePost = z.infer<typeof parsedRidePostSchema>;
