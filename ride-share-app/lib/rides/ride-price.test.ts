import { expect, it } from "vitest";

import { formatSeatPrice, isFreeRide, seatPriceCaption } from "./ride-price";

it.each([
  [0, "Free", "no charge", true],
  [null, "Free", "no charge", true],
  [undefined, "Free", "no charge", true],
  [1, "1 MKD", "per seat", false],
  [250, "250 MKD", "per seat", false],
])("shows a %j MKD seat as %j (%s)", (price, label, caption, free) => {
  expect(formatSeatPrice(price)).toBe(label);
  expect(seatPriceCaption(price)).toBe(caption);
  expect(isFreeRide(price)).toBe(free);
});
