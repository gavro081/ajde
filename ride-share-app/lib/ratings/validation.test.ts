import { describe, expect, it } from "vitest";
import { ratingInputSchema } from "./validation";

const input = { rideId: "40000000-0000-4000-8000-000000000001", rateeId: "20000000-0000-4000-8000-000000000001", score: 4 };
describe("rating input", () => {
  it("trims private notes and treats empty feedback as absent", () => {
    expect(ratingInputSchema.parse({ ...input, note: "  Great ride! \n" }).note).toBe("Great ride!");
    for (const note of [undefined, null, "", " \t\n "]) {
      expect(ratingInputSchema.parse({ ...input, note }).note).toBeNull();
    }
  });
  it.each([0, 6, -1, 2.5, NaN, "5", null, true])("rejects invalid score %s", (score) => {
    expect(ratingInputSchema.safeParse({ ...input, score }).success).toBe(false);
  });
  it("accepts integer scores and the trimmed 1000-character boundary", () => {
    for (const score of [1, 2, 3, 4, 5]) expect(ratingInputSchema.safeParse({ ...input, score }).success).toBe(true);
    expect(ratingInputSchema.parse({ ...input, note: ` ${"x".repeat(1000)} ` }).note).toHaveLength(1000);
    expect(ratingInputSchema.safeParse({ ...input, note: "x".repeat(1001) }).success).toBe(false);
  });
  it("rejects malformed IDs and never accepts extra participant facts", () => {
    expect(ratingInputSchema.safeParse({ ...input, rideId: "bad" }).success).toBe(false);
    expect(ratingInputSchema.safeParse({ ...input, rateeId: "bad" }).success).toBe(false);
    expect(ratingInputSchema.parse({ ...input, rater_id: "forged", status: "completed" })).not.toHaveProperty("rater_id");
  });
});
