// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { DateTimeField } from "./date-time-field";

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-22T10:00:00Z")); });

function Form({ initial = "", disabled = false }) {
  const [value, setValue] = useState(initial);
  return <form aria-label="Ride"><span id="departure">Departure</span><DateTimeField value={value} onChange={setValue} labelledBy="departure" disabled={disabled} /></form>;
}

it.each(["2026-09-22T11:59", "2027-01-01T12:00"])("rejects an out-of-range recovered departure %s", initial => {
  render(<Form initial={initial} />);
  fireEvent.click(screen.getByRole("button", { name: /^Departure/ }));
  expect((screen.getByRole("form") as HTMLFormElement).checkValidity()).toBe(false);
  expect(screen.getByRole("button", { name: "Choose a time" })).toHaveProperty("disabled", true);
});

it("disables dates and times outside the ride booking window", () => {
  render(<Form initial="2026-09-22T12:30" />);
  fireEvent.click(screen.getByRole("button", { name: /^Departure/ }));
  expect(screen.getByLabelText("Hour").querySelector('option[value=""]')).toBeTruthy();
  expect(screen.getByRole("option", { name: "11" })).toHaveProperty("disabled", true);
  fireEvent.change(screen.getByLabelText("Hour"), { target: { value: "12" } });
  expect(screen.getByLabelText("Minute").querySelector('option:first-child')).toHaveProperty("disabled", true);
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(screen.getByRole("button", { name: "Next month" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: /22 December/ })).toHaveProperty("disabled", true);
});

it("keeps a recovered date incomplete until a time is chosen, then submits it", () => {
  render(<Form initial="2026-09-26T" />);
  const form = screen.getByRole("form") as HTMLFormElement;
  expect(form.checkValidity()).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /^Departure/ }));
  expect(screen.getByLabelText("Hour")).toHaveProperty("value", "");
  expect(screen.getByRole("button", { name: "Choose a time" })).toHaveProperty("disabled", true);
  fireEvent.change(screen.getByLabelText("Hour"), { target: { value: "17" } });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).get("departureLocal")).toBe("2026-09-26T17:00");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Departure/ }));
});

it("uses Skopje's calendar day for Today and preserves a recognized time when choosing a date", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T22:30:00Z"));
  render(<Form initial="T16:17" />);
  fireEvent.click(screen.getByRole("button", { name: /^Departure/ }));
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(screen.getByLabelText("Minute")).toHaveProperty("value", "17");
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("departureLocal")).toBe("2026-09-22T16:17");
});

it("blocks invalid local times and directs required-field validation to the visible picker", () => {
  render(<Form initial="2026-03-29T02:30" />);
  expect((screen.getByRole("form") as HTMLFormElement).checkValidity()).toBe(false);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Departure/ }));
});

it("hides the portalled controls while the ride form is saving", () => {
  const view = render(<Form initial="2026-09-26T16:00" />);
  fireEvent.click(screen.getByRole("button", { name: /^Departure/ }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  view.rerender(<Form initial="2026-09-26T16:00" disabled />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: /^Departure/ })).toHaveProperty("disabled", true);
});
