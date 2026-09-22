// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message, RoomPage } from "@/lib/chat/contract";

const mocks = vi.hoisted(() => ({ load: vi.fn(), send: vi.fn(), remove: vi.fn(), session: vi.fn(), setAuth: vi.fn(), channels: [] as { event: (payload: { new: Record<string, unknown> }) => void; status: (state: string) => void }[] }));
vi.mock("@/lib/chat/actions", () => ({ loadRoom: mocks.load, sendRoomMessage: mocks.send }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ removeChannel: mocks.remove,
  auth: { getSession: mocks.session },
  realtime: { setAuth: mocks.setAuth },
  channel: () => {
    const callbacks: (typeof mocks.channels)[number] = { event: () => {}, status: () => {} };
    const channel = { on: (_type: string, _filter: unknown, callback: typeof callbacks.event) => { callbacks.event = callback; return channel; },
      subscribe: (callback: typeof callbacks.status) => { callbacks.status = callback; mocks.channels.push(callbacks); return channel; } };
    return channel;
  },
}) }));
import { RideRoom } from "./room";
const rideId = "92000000-0000-4000-8000-000000000001";
const message: Message = { id: "92000000-0000-4000-8000-000000000002", ride_id: rideId, recipient_id: null, sender_id: "driver", body: "Hello room", created_at: "2026-09-21T12:00:00Z", sender: { full_name: "Driver", photo_url: "/photo.png" } };
const initial: RoomPage = { viewerId: "driver", members: ["driver", "one", "two"].map(id => ({ id, full_name: id, photo_url: "/photo.png", isDriver: id === "driver", phone: "+38970123456", social_url: "https://x.com/" + id, instagram: null, facebook: null })), messages: [], nextCursor: null, membership: { role: "driver", canSend: true, closesAt: "2099-09-21T12:00:00Z" } };
beforeEach(() => { mocks.channels = []; mocks.load.mockReset().mockResolvedValue({ ok: true, value: initial }); mocks.send.mockReset(); mocks.remove.mockClear(); mocks.session.mockReset().mockResolvedValue({ data: { session: { access_token: "test-token" } } }); mocks.setAuth.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
describe("ride room client", () => {
  it("shows one roster and escapes markup instead of interpreting it", async () => {
    mocks.load.mockResolvedValue({ ok: true, value: { ...initial, messages: [{ ...message, body: "<script>alert(1)</script>" }] } });
    const { container } = render(<RideRoom rideId={rideId} initial={initial} />);
    expect(await screen.findByText("<script>alert(1)</script>")).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
    expect(within(screen.getByLabelText("Room participants")).getAllByRole("listitem")).toHaveLength(3);
  });
  it("delivers once to driver and two passenger clients and reconciles the send response", async () => {
    const clients = ["driver", "one", "two"].map(viewerId => render(<RideRoom rideId={rideId} initial={{ ...initial, viewerId }} />));
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(3));
    mocks.load.mockResolvedValue({ ok: true, value: { ...initial, messages: [message] } });
    mocks.send.mockResolvedValue({ ok: true, value: message });
    const field = within(clients[0].container).getByLabelText("Message to the ride group");
    fireEvent.change(field, { target: { value: "Hello room" } });
    fireEvent.submit(field.closest("form")!);
    await act(async () => { for (const channel of mocks.channels) channel.event({ new: message }); });
    for (const client of clients) await waitFor(() => expect(within(client.container).getAllByText("Hello room")).toHaveLength(1));
  });
  it("rejects wrong-ride and DM events without querying", async () => {
    render(<RideRoom rideId={rideId} initial={initial} />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    await act(async () => { mocks.channels[0].event({ new: { ...message, ride_id: "wrong" } }); mocks.channels[0].event({ new: { ...message, recipient_id: "one" } }); });
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });
  it("keeps loaded history offline and resubscribes on manual retry", async () => {
    render(<RideRoom rideId={rideId} initial={{ ...initial, messages: [message] }} />);
    await waitFor(() => expect(mocks.channels).toHaveLength(1));
    await act(async () => { mocks.channels[0].status("CHANNEL_ERROR"); window.dispatchEvent(new Event("offline")); });
    expect(screen.getByText("Hello room")).toBeTruthy();
    expect(screen.getByText("Offline — retry when connected")).toBeTruthy();
    fireEvent.click(screen.getByText("Retry connection"));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.channels).toHaveLength(2));
    await act(async () => { mocks.channels[1].status("SUBSCRIBED"); });
    expect(screen.getByText("Connected")).toBeTruthy();
  });
  it("clears history and unsubscribes when membership is lost", async () => {
    mocks.load.mockResolvedValue({ ok: false, code: "unavailable", error: "Unavailable" });
    render(<RideRoom rideId={rideId} initial={{ ...initial, messages: [message] }} />);
    expect(await screen.findByText("Ride room unavailable")).toBeTruthy();
    expect(screen.queryByText("Hello room")).toBeNull();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
  it("preserves failed drafts, supports keyboard newlines, and restores focus", async () => {
    mocks.send.mockResolvedValue({ ok: false, code: "database", error: "Send failed" });
    const user = userEvent.setup();
    render(<RideRoom rideId={rideId} initial={initial} />);
    const field = screen.getByLabelText("Message to the ride group") as HTMLTextAreaElement;
    await user.type(field, "Hello{Shift>}{Enter}{/Shift}room");
    expect(field.value).toBe("Hello\nroom");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Send failed");
    expect(field.value).toBe("Hello\nroom");
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(mocks.send).toHaveBeenCalledWith({ rideId, body: "Hello\nroom" });
  });
  it("loads older pages without duplicate rows", async () => {
    mocks.load.mockImplementation(async (input: { direction: string }) => ({ ok: true, value: { ...initial, messages: input.direction === "older" ? [message] : [], nextCursor: null } }));
    render(<RideRoom rideId={rideId} initial={{ ...initial, nextCursor: message, messages: [message] }} />);
    fireEvent.click(screen.getByText("Load older messages"));
    await waitFor(() => expect(screen.queryByText("Load older messages")).toBeNull());
    expect(screen.getAllByText("Hello room")).toHaveLength(1);
  });
  it("cleans up on unmount and ignores late events", async () => {
    const { unmount } = render(<RideRoom rideId={rideId} initial={initial} />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    unmount();
    mocks.channels[0].event({ new: message });
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });
  it("does not steal scroll position while someone reads older messages", async () => {
    render(<RideRoom rideId={rideId} initial={{ ...initial, messages: [message] }} />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    const history = screen.getByLabelText("Message history");
    Object.defineProperties(history, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 200 } });
    history.scrollTop = 120; fireEvent.scroll(history);
    const next = { ...message, id: message.id.replace(/2$/, "3"), body: "New arrival" };
    mocks.load.mockResolvedValue({ ok: true, value: { ...initial, messages: [next] } });
    await act(async () => mocks.channels[0].event({ new: next }));
    expect(await screen.findByText("New arrival")).toBeTruthy();
    expect(history.scrollTop).toBe(120);
  });
  it("disables the composer during a pending send and reconciles success", async () => {
    let finish!: (value: unknown) => void;
    mocks.send.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<RideRoom rideId={rideId} initial={initial} />);
    const field = screen.getByLabelText("Message to the ride group") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "Hello room" } });
    fireEvent.submit(field.closest("form")!);
    await waitFor(() => expect(field.disabled).toBe(true));
    await act(async () => finish({ ok: true, value: message }));
    expect(field.value).toBe(""); expect(field.disabled).toBe(false);
    expect(screen.getAllByText("Hello room")).toHaveLength(1);
  });
  it("does not render a sendable composer in a closed room", async () => {
    const closed = { ...initial, membership: { ...initial.membership, canSend: false } };
    mocks.load.mockResolvedValue({ ok: true, value: closed });
    render(<RideRoom rideId={rideId} initial={closed} />);
    expect((screen.getByLabelText("Message to the ride group") as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getByText(/This room is read-only/)).toBeTruthy();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("sends only validated cursor fields when catching up an existing timeline", async () => {
    render(<RideRoom rideId={rideId} initial={{ ...initial, messages: [message] }} />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith({ rideId, direction: "newer", cursor: { id: message.id, created_at: message.created_at } }));
  });
  it("waits for authentication before joining and ignores late session resolution on unmount", async () => {
    let resolveSession!: (value: unknown) => void;
    mocks.session.mockImplementation(() => new Promise(resolve => { resolveSession = resolve; }));
    const { unmount } = render(<RideRoom rideId={rideId} initial={initial} />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
    expect(mocks.channels).toHaveLength(0);
    unmount();
    await act(async () => resolveSession({ data: { session: { access_token: "late-token" } } }));
    expect(mocks.setAuth).not.toHaveBeenCalled();
    expect(mocks.channels).toHaveLength(0);
  });
  it("never joins anonymously if the browser session has disappeared", async () => {
    mocks.session.mockResolvedValue({ data: { session: null } });
    render(<RideRoom rideId={rideId} initial={{ ...initial, messages: [message] }} />);
    expect(await screen.findByText("Ride room unavailable")).toBeTruthy();
    expect(screen.queryByText("Hello room")).toBeNull();
    expect(mocks.channels).toHaveLength(0);
  });
});

it("shows callable contact details in the current participant roster", async () => {
  render(<RideRoom rideId={rideId} initial={initial} />);
  const roster=screen.getByLabelText("Room participants");
  expect(within(roster).getAllByRole("link",{name:"+38970123456"})).toHaveLength(3);
  expect(within(roster).getAllByRole("link",{name:/Social profile/})).toHaveLength(3);
  await waitFor(()=>expect(mocks.load).toHaveBeenCalled());
});
