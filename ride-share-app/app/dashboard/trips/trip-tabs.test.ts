import { expect, it } from "vitest";

import { parseDriverRideFilter } from "./trip-tabs";

it.each([
  ["completed", "completed"],
  ["cancelled", "cancelled"],
  ["all", "all"],
  ["active", "active"],
  [undefined, "active"],
  ["draft", "active"],
  ["ALL", "active"],
])("maps the driver trip filter %j to %j", (value, expected) => {
  expect(parseDriverRideFilter(value)).toBe(expected);
});
