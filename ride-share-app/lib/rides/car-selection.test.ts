import { describe, expect, it } from "vitest";

import { readCarSelection } from "./car-selection";

describe("readCarSelection", () => {
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
