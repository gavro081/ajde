import { describe, expect, it } from "vitest";

import { readCarSelection } from "./car-selection";

describe("readCarSelection", () => {
  it.each([
    ["consumptionL100Km", "0.4", false], ["consumptionL100Km", "30.1", false],
    ["consumptionL100Km", "0.5", true], ["consumptionL100Km", "30", true],
    ["carSeatsTotal", "9", false], ["carSeatsTotal", "0", false],
    ["carColor", "b".repeat(41), false], ["carColor", "b".repeat(40), true],
    ["plateLast3", "12", false], ["plateLast3", "a12", true],
  ])("validates %s=%s for both car entry methods", (field, value, accepted) => {
    for (const mode of ["manual", "catalog"]) {
      const form = new FormData();
      Object.entries({ carMode: mode, carMake: "Dacia", carModel: "Logan", fuelType: "diesel", carModelId: "12", consumptionL100Km: "5.2", carSeatsTotal: "4" }).forEach(([key, entry]) => form.set(key, entry));
      form.set(field, value);
      expect(readCarSelection(form).success).toBe(accepted);
    }
  });

  it("parses an existing saved car", () => {
    const formData = new FormData();
    formData.set("carMode", "existing");
    formData.set("carId", "8cf6b8f1-ef8b-4eef-b3ff-6e131648ed47");

    expect(readCarSelection(formData).success).toBe(true);
  });

  it("parses a catalog car with an overridden consumption", () => {
    const formData = new FormData();
    formData.set("carMode", "catalog");
    formData.set("carModelId", "12");
    formData.set("consumptionL100Km", "7.4");
    formData.set("carColor", "blue");
    formData.set("plateLast3", "a7b");
    formData.set("carSeatsTotal", "4");

    const result = readCarSelection(formData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        mode: "catalog",
        carModelId: 12,
        consumptionL100Km: 7.4,
        plateLast3: "A7B",
      });
    }
  });

  it("allows manual models but validates their required details", () => {
    const formData = new FormData();
    formData.set("carMode", "manual");
    formData.set("carMake", "Dacia");
    formData.set("carModel", "Logan");
    formData.set("fuelType", "diesel");
    formData.set("consumptionL100Km", "5.2");
    formData.set("carSeatsTotal", "5");

    expect(readCarSelection(formData).success).toBe(true);

    formData.set("consumptionL100Km", "0");
    expect(readCarSelection(formData).success).toBe(false);
  });
});
