// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SearchInterpretation } from "./search-interpretation";
import type { SearchQueryResult } from "@/lib/ai/search-query-schema";

afterEach(cleanup);
const result: SearchQueryResult = { originId: null, destinationId: 8, departureAfter: null,
  departureBefore: null, requestedSeats: null, confidence: 0.9, warnings: [],
  dateFrom: null, dateTo: null, timeAfter: "16:00", timeBefore: "18:00" };
it("shows time-only searches without asking for a date", () => {
  render(<SearchInterpretation result={result} cityNames={new Map([[8, "Ohrid"]])} manualOverride={false} />);
  expect(screen.getByText(/Any upcoming date.*16:00–18:00 each day/)).toBeTruthy();
});
it("shows the inclusive calendar range separately from a recurring window", () => {
  render(<SearchInterpretation result={{ ...result, dateFrom: "2026-09-22", dateTo: "2026-09-24" }} cityNames={new Map([[8, "Ohrid"]])} manualOverride={false} />);
  expect(screen.getByText(/2026-09-22 – 2026-09-24.*16:00–18:00 each day/)).toBeTruthy();
});
it("labels overnight windows and manual overrides", () => {
  render(<SearchInterpretation result={{ ...result, timeAfter: "22:00", timeBefore: "02:00" }} cityNames={new Map()} manualOverride />);
  expect(screen.getByText(/22:00–02:00 \(overnight\)/)).toBeTruthy();
  expect(screen.getByText(/manual filter changes take precedence/)).toBeTruthy();
});
