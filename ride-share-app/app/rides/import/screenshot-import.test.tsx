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
async function screenshotMode() {
  await userEvent.click(screen.getByRole("button", { name: "Facebook screenshot" }));
}

it("shows only the active input, preserves Viber text across toggles, and submits its source automatically", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(review));
  vi.stubGlobal("fetch", transport);
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  expect(screen.queryByRole("region", { name: "Upload screenshot" })).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Post text" }), { target: { value: transcript } });
  await screenshotMode();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("region", { name: "Upload screenshot" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Create review draft" })).toHaveProperty("disabled", true);
  await userEvent.click(screen.getByRole("button", { name: "Viber text" }));
  expect(screen.getByRole("textbox")).toHaveProperty("value", transcript);
  await userEvent.click(screen.getByRole("button", { name: "Create review draft" }));
  await screen.findByText("Review the extracted details");
  expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toEqual({ text: transcript, sourceHint: "viber" });
});

it("reads a Facebook screenshot and explicitly parses only the selected post", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ posts: [post(), post("Барам превоз утре", "request"), post("Здраво 👋", "other")] })).mockResolvedValueOnce(Response.json(review));
  vi.stubGlobal("fetch", transport);
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  await screenshotMode();
  await userEvent.upload(screen.getByLabelText(/Or upload a screenshot/), file());
  await userEvent.click((await screen.findAllByRole("button", { name: "Use this post" }))[0]);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("button", { name: "Selected post" }).getAttribute("aria-pressed")).toBe("true");
  expect(transport).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Viber text" }));
  expect(screen.getByRole("textbox")).toHaveProperty("value", "");
  await screenshotMode();
  expect(screen.getByRole("button", { name: "Selected post" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Create review draft" }));
  await screen.findByText("Review the extracted details");
  expect(transport.mock.calls[0][0]).toBe("/api/parse/screenshot");
  expect(transport.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
  expect(transport.mock.calls[1][0]).toBe("/api/parse");
  expect(JSON.parse(String(transport.mock.calls[1][1]?.body))).toEqual({ text: transcript, sourceHint: "facebook" });
  expect(screen.getByRole("link", { name: "Continue to editable ride form" })).toBeTruthy();
});

it("retries dropped screenshots and clears the selected draft when the image is removed", async () => {
  const transport = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({ posts: [post()] }));
  vi.stubGlobal("fetch", transport);
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  await screenshotMode();
  fireEvent.drop(screen.getByRole("region", { name: "Upload screenshot" }), { dataTransfer: { files: [file()] } });
  await userEvent.click(await screen.findByRole("button", { name: "Retry reading" }));
  await userEvent.click(await screen.findByRole("button", { name: "Use this post" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove screenshot" }));
  expect(screen.queryByRole("heading", { name: "Choose a detected post" })).toBeNull();
  expect(screen.getByRole("button", { name: "Create review draft" })).toHaveProperty("disabled", true);
  expect(transport).toHaveBeenCalledTimes(2);
});

it("rejects multiple dropped files without discarding previous results", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ posts: [post()] }));
  vi.stubGlobal("fetch", transport);
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  await screenshotMode();
  await userEvent.upload(screen.getByLabelText(/Or upload a screenshot/), file());
  await screen.findByRole("button", { name: "Use this post" });
  fireEvent.drop(screen.getByRole("region", { name: "Upload screenshot" }), { dataTransfer: { files: [file(), file()] } });
  expect(screen.getByRole("alert").textContent).toContain("one screenshot at a time");
  expect(screen.getByRole("button", { name: "Use this post" })).toBeTruthy();
  expect(transport).toHaveBeenCalledTimes(1);
});

it("keeps Viber text available after an unreadable screenshot", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: "Couldn't read this screenshot, paste the text instead" }, { status: 422 })));
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: transcript } });
  await screenshotMode();
  await userEvent.upload(screen.getByLabelText(/Or upload a screenshot/), file());
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Viber text" }));
  expect(screen.getByRole("textbox")).toHaveProperty("value", transcript);
  expect(screen.queryByRole("alert")).toBeNull();
});

it("hides screenshot mode when the pipeline is disabled", () => {
  render(<ImportRideForm cities={cities} pipelineEnabled={false} />);
  expect(screen.queryByRole("button", { name: "Facebook screenshot" })).toBeNull();
  expect(screen.queryByLabelText(/Or upload a screenshot/)).toBeNull();
  expect(screen.getByRole("textbox")).toBeTruthy();
});

it("rejects oversized uploads without requesting the reader", async () => {
  const transport = vi.fn(); vi.stubGlobal("fetch", transport);
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  await screenshotMode();
  await userEvent.upload(screen.getByLabelText(/Or upload a screenshot/), new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
  expect((await screen.findByRole("alert")).textContent).toContain("4 MB");
  expect(transport).not.toHaveBeenCalled();
});

it("blocks mode switching and parsing during a screenshot read", async () => {
  let finish: (response: Response) => void = () => {};
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  render(<ImportRideForm cities={cities} pipelineEnabled />);
  await screenshotMode();
  await userEvent.upload(screen.getByLabelText(/Or upload a screenshot/), file());
  expect(screen.getByRole("button", { name: "Viber text" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Create review draft" })).toHaveProperty("disabled", true);
  finish(Response.json({ posts: [post()] }));
  await screen.findByRole("button", { name: "Use this post" });
  expect(screen.getByRole("button", { name: "Viber text" })).toHaveProperty("disabled", false);
  expect(screen.getByRole("button", { name: "Create review draft" })).toHaveProperty("disabled", true);
});