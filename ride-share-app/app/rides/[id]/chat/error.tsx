"use client";
import { StatusPanel } from "@/components/status-panel";

export default function RoomError({ reset }: { reset: () => void }) {
  return <StatusPanel tone="error" eyebrow="Ride room" title="Could not load the ride room" actions={<button type="button" onClick={reset} className="btn-primary">Try again</button>}>
    <p role="alert">Check your connection and try again.</p>
  </StatusPanel>;
}
