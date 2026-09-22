import { describe, expect, it } from "vitest";

import { validateRideSubmission } from "./ride-form";

const NOW = new Date("2026-09-20T10:00:00+02:00");

function validFormData() {
  const formData = new FormData();
  formData.set("source", "native");
  formData.set("originCityId", "1");
  formData.set("originPickupPointId", "2");
  formData.set("destinationCityId", "3");
  formData.set("destinationPickupPointId", "");
  formData.set("departureAt", "2026-09-21T08:00:00+02:00");
  formData.set("distanceKm", "170");
  formData.set("seatsTotal", "3");
  formData.set("carId", "8cf6b8f1-ef8b-4eef-b3ff-6e131648ed47");
  formData.set("pricePerSeatMkd", "500");
  formData.set("notes", "Room for one suitcase");
  formData.append("tags", "no_smoking");
  formData.set("genderPreference", "any");
  formData.set("intent", "publish");
  formData.set("submissionId", "9051ad30-7a1d-4895-b517-e64d3d44448a");
  return formData;
}

describe("validateRideSubmission", () => {
  it.each([
    ["pricePerSeatMkd", "-1"], ["pricePerSeatMkd", "3001"], ["pricePerSeatMkd", "12.5"],
    ["distanceKm", "0.9"], ["distanceKm", "600.1"],
    ["seatsTotal", "0"], ["seatsTotal", "9"], ["seatsTotal", "1.5"],
    ["departureAt", NOW.toISOString()],
    ["departureAt", new Date(NOW.getTime() + 90 * 86_400_000 + 1).toISOString()],
  ])("rejects out-of-range %s=%s even when browser validation is bypassed", (field, value) => {
    const form = validFormData();
    form.set(field, value);
    for (const intent of ["publish", "save_draft"]) {
      form.set("intent", intent);
      const result = validateRideSubmission(form, NOW).draft;
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.some(issue => issue.path[0] === field)).toBe(true);
    }
  });

  it.each([
    ["pricePerSeatMkd", "0"], ["pricePerSeatMkd", "3000"],
    ["distanceKm", "1"], ["distanceKm", "600"],
    ["seatsTotal", "1"], ["seatsTotal", "8"],
    ["departureAt", new Date(NOW.getTime() + 90 * 86_400_000).toISOString()],
  ])("accepts the supported boundary %s=%s", (field, value) => {
    const form = validFormData();
    form.set(field, value);
    expect(validateRideSubmission(form, NOW).draft.success).toBe(true);
  });

  it("normalizes and validates a complete HTML form submission", () => {
    const result = validateRideSubmission(validFormData(), NOW);

    expect(result.draft.success).toBe(true);
    expect(result.metadata.success).toBe(true);
    if (result.draft.success) {
      expect(result.draft.data).toMatchObject({
        origin: { cityId: 1, pickupPointId: 2 },
        destination: { cityId: 3, pickupPointId: null },
        seatsTotal: 3,
        distanceKm: 170,
        pricePerSeatMkd: 500,
        tags: ["no_smoking"],
      });
    }
  });

  it("rejects malformed numbers instead of coercing them to valid values", () => {
    const formData = validFormData();
    formData.set("seatsTotal", "three");
    formData.set("pricePerSeatMkd", "-1");

    const result = validateRideSubmission(formData, NOW);

    expect(result.draft.success).toBe(false);
  });

  it("requires an explicit draft or publish intent", () => {
    const formData = validFormData();
    formData.delete("intent");

    expect(validateRideSubmission(formData, NOW).metadata.success).toBe(false);
  });
});
