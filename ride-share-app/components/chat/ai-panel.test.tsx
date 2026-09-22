// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChatAiPanel } from "./ai-panel";
import type { AiAnswer } from "@/lib/chat/ai-contract";
const rideId = "94000000-0000-4000-8000-000000000001";
const source = { id: "94000000-0000-4000-8000-000000000010", created_at: "2026-09-21T12:00:00.000001Z", author: "Ana", body: "Earlier pickup agreement" };
const answer: AiAnswer = { mode: "summary", insufficientEvidence: false,
  items: [{ category: "decision", text: "Pickup at the station", sources: [source] }], messageCount: 151, cutoff: { id: source.id, created_at: source.created_at } };
const fetcher = vi.fn();
const denied = vi.fn();
beforeEach(() => { denied.mockReset(); fetcher.mockReset().mockResolvedValue(Response.json({ ok: true, value: answer })); vi.stubGlobal("fetch", fetcher); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mount = () => render(<ChatAiPanel rideId={rideId} latest={source} onUnavailable={denied} />);
it("only calls AI on request, shows full-history count and real source text", async () => {
  mount(); expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Summarize chat" }));
  await screen.findByText("Pickup at the station");
  expect(screen.getByText(/Based on 151 messages/)).toBeDefined();
  fireEvent.click(screen.getByText("Source messages (1)"));
  expect(screen.getByText(source.body)).toBeDefined();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ rideId, mode: "summary" });
});
it("focuses the labelled question field and keeps each question independent", async () => {
  fetcher.mockResolvedValue(Response.json({ ok: true, value: { ...answer, mode: "question", insufficientEvidence: true, items: [] } }));
  mount(); fireEvent.click(screen.getByRole("button", { name: "Ask AI" }));
  const input = screen.getByLabelText("Your question");
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: "  What luggage?  " } });
  fireEvent.submit(input.closest("form")!);
  await screen.findByText("The chat does not say.");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ rideId, mode: "question", question: "What luggage?" });
});
it("keeps a failed question, supports retry, and escapes model text", async () => {
  fetcher.mockRejectedValueOnce(new Error("offline"));
  fetcher.mockResolvedValueOnce(Response.json({ ok: true, value: { ...answer, mode: "question", items: [{ ...answer.items[0], text: "<script>bad()</script>" }] } }));
  const { container } = mount(); fireEvent.click(screen.getByRole("button", { name: "Ask AI" }));
  const input = screen.getByLabelText("Your question") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Where?" } }); fireEvent.submit(input.closest("form")!);
  await screen.findByRole("alert"); expect(input.value).toBe("Where?");
  fireEvent.click(screen.getByRole("button", { name: "Retry AI request" }));
  await screen.findByText("<script>bad()</script>"); expect(container.querySelector("script")).toBeNull();
});
it("marks new microsecond messages as stale without automatically generating again", async () => {
  const view = mount(); fireEvent.click(screen.getByRole("button", { name: "Summarize chat" }));
  await screen.findByText("Pickup at the station");
  view.rerender(<ChatAiPanel rideId={rideId} latest={{ ...source, created_at: "2026-09-21T12:00:00.000002Z" }} onUnavailable={denied} />);
  expect(screen.getByText("New messages since this answer.")).toBeDefined(); expect(fetcher).toHaveBeenCalledTimes(1);
});
it("aborts and ignores late results when closed or unmounted", async () => {
  let finish!: (r: Response) => void;
  fetcher.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
  const view = mount(); fireEvent.click(screen.getByRole("button", { name: "Summarize chat" }));
  expect((screen.getByRole("button", { name: "Summarize chat" }) as HTMLButtonElement).disabled).toBe(true);
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
  fireEvent.click(screen.getByRole("button", { name: "Close AI panel" })); expect(signal.aborted).toBe(true);
  await act(async () => finish(Response.json({ ok: true, value: answer })));
  fireEvent.click(screen.getByRole("button", { name: "Ask AI" })); expect(screen.queryByText("Pickup at the station")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Summarize chat" }));
  const nextSignal = fetcher.mock.calls[1][1].signal as AbortSignal;
  view.unmount(); expect(nextSignal.aborted).toBe(true);
  await act(async () => finish(Response.json({ ok: true, value: answer })));
});
it("discards private output and notifies the room when access is revoked", async () => {
  fetcher.mockResolvedValue(Response.json({ ok: false, code: "unavailable", error: "Room unavailable" }));
  mount(); fireEvent.click(screen.getByRole("button", { name: "Summarize chat" }));
  await waitFor(() => expect(denied).toHaveBeenCalledOnce());
  expect(screen.queryByText("Pickup at the station")).toBeNull();
});
it("does not steal focus from the room composer when a pending request finishes", async () => {
  let finish!: (r: Response) => void;
  fetcher.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
  render(<><ChatAiPanel rideId={rideId} latest={source} onUnavailable={denied} /><textarea aria-label="Room composer" /></>);
  fireEvent.click(screen.getByRole("button", { name: "Summarize chat" }));
  const composer = screen.getByLabelText("Room composer"); composer.focus();
  await act(async () => finish(Response.json({ ok: true, value: answer })));
  expect(document.activeElement).toBe(composer);
});
