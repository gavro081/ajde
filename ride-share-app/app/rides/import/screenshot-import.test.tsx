// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyOfferDraft } from "@/lib/rides/offer-interpretation";
import { ImportRideForm } from "./import-ride-form";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const cities = [{ id: 1, name_en: "Skopje" }, { id: 2, name_en: "Bitola" }];
const transcript = "Возам Битола → Скопје утре 08:30, 3 mesta 🚗";
const post = (text = transcript, kind = "offer") => ({ text, kind, confidence: 0.8 });
const file = () => new File(["image fixture"], "ride.png", { type: "image/png" });
const review = { importId: "10000000-0000-4000-8000-000000000001", parsed: {
  classification: "offer", sourceLanguage: "mk", draft: { ...emptyOfferDraft(), source: "imported" },
}, check: { status: "unavailable", trace: [] } };

it("reads one screenshot, keeps every kind selectable, and only parses the selected edited text on explicit submit", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ posts: [post(), post("Барам превоз утре", "request"), post("Здраво 👋", "other")] })).mockResolvedValueOnce(Response.json(review));
  vi.stubGlobal("fetch", transport);
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  await userEvent.upload(screen.getByLabelText(/Or upload a screenshot/), file());
  await screen.findByText(transcript);
  expect(screen.getByText("request")).toBeTruthy();
  expect(screen.getByText("other")).toBeTruthy();
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][0]).toBe("/api/parse/screenshot");
  expect(transport.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
  expect(screen.getByLabelText(/Post text/)).toHaveProperty("value", "");
  await userEvent.click(screen.getAllByRole("button", { name: "Use this post" })[0]);
  expect(screen.getByLabelText(/Post text/)).toHaveProperty("value", transcript);
  expect(screen.getByLabelText("Source")).toHaveProperty("value", "other");
  expect(transport).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText(/Post text/), { target: { value: `${transcript} цена 450 ден.` } });
  await userEvent.click(screen.getByRole("button", { name: "Create review draft" }));
  await screen.findByText("Review the extracted details");
  expect(transport).toHaveBeenCalledTimes(2);
  expect(transport.mock.calls[1][0]).toBe("/api/parse");
  expect(JSON.parse(String(transport.mock.calls[1][1]?.body))).toEqual({ text: `${transcript} цена 450 ден.`, sourceHint: "other" });
  expect(screen.getByText(/Automatic plausibility check was unavailable/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Continue to editable ride form" }).getAttribute("href")).toContain("/rides/new?import=");
});

it("preserves manual pasted text and explicit importing after reader failure", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ error: "Couldn't read this screenshot, paste the text instead" }, { status: 422 })).mockResolvedValueOnce(Response.json(review));
  vi.stubGlobal("fetch", transport);
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  fireEvent.change(screen.getByLabelText(/Post text/), { target: { value: "Skopje Bitola tomorrow at 17h" } });
  await userEvent.upload(screen.getByLabelText(/Or upload a screenshot/), file());
  await screen.findByText("Couldn't read this screenshot, paste the text instead");
  expect(screen.getByLabelText(/Post text/)).toHaveProperty("value", "Skopje Bitola tomorrow at 17h");
  await userEvent.click(screen.getByRole("button", { name: "Create review draft" }));
  await screen.findByText("Review the extracted details");
});

it("hides all screenshot controls when the pipeline is disabled", () => {
  render(<ImportRideForm cities={cities} pipelineEnabled={false} />);
  expect(screen.queryByLabelText(/Or upload a screenshot/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Use this post" })).toBeNull();
  expect(screen.getByLabelText(/Post text/)).toBeTruthy();
});

it("rejects an oversized screenshot locally without losing the text workflow", async () => {
  const transport = vi.fn(); vi.stubGlobal("fetch", transport);
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  await userEvent.upload(screen.getByLabelText(/Or upload a screenshot/), new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
  expect((await screen.findByRole("alert")).textContent).toContain("4 MB");
  expect(transport).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Create review draft" })).not.toHaveProperty("disabled", true);
});

it.each(["request", "other"])("allows selecting a %s post without starting parsing", async kind => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ posts: [post("Барам превоз утре, 2 места", kind)] }));
  vi.stubGlobal("fetch", transport);
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  await userEvent.upload(screen.getByLabelText(/Or upload a screenshot/), file());
  await userEvent.click(await screen.findByRole("button", { name: "Use this post" }));
  expect(screen.getByLabelText(/Post text/)).toHaveProperty("value", "Барам превоз утре, 2 места");
  expect(transport).toHaveBeenCalledTimes(1);
});

it("blocks parsing while the screenshot read is pending", async () => {
  let finish: (response: Response) => void = () => {};
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  await userEvent.upload(screen.getByLabelText(/Or upload a screenshot/), file());
  expect(screen.getByRole("status").textContent).toBe("Reading screenshot…");
  expect(screen.getByRole("button", { name: "Create review draft" })).toHaveProperty("disabled", true);
  finish(Response.json({ posts: [post()] }));
  await screen.findByRole("button", { name: "Use this post" });
  expect(screen.getByRole("button", { name: "Create review draft" })).toHaveProperty("disabled", false);
});
