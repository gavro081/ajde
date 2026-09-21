"use client";
import Link from "next/link";
import { StatusPanel } from "@/components/status-panel";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StatusPanel tone="error" eyebrow="Something went wrong" title="We could not load this page"
    actions={<><button type="button" onClick={reset} className="btn-primary">Try again</button><Link href="/" className="btn-secondary">Back to home</Link></>}>
    <p>Check your connection and try again.</p>
  </StatusPanel>;
}
