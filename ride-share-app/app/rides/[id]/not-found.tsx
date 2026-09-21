import Link from "next/link";
import { StatusPanel } from "@/components/status-panel";

export default function RideNotFound() {
  return <StatusPanel eyebrow="Ride" title="Ride not found" actions={<Link href="/rides" className="btn-primary">Browse rides</Link>}>
    <p>It may have been removed or is no longer public.</p>
  </StatusPanel>;
}
