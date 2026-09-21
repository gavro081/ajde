import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { RideRoom } from "@/components/chat/room";
import { requireCompleteProfile } from "@/lib/auth/session";
import { queryRoom } from "@/lib/chat/server";

export const metadata = { title: "Private ride room", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCompleteProfile(`/rides/${id}/chat`);
  const result = await queryRoom({ rideId: id });
  if (!result.ok && result.code === "database") throw new Error("Room could not be loaded.");
  return <div className="min-h-screen bg-slate-50 text-slate-950"><AppHeader /><main className="mx-auto max-w-3xl px-3 py-6 sm:px-6">
    {result.ok ? <RideRoom key={id} rideId={id} initial={result.value} /> : <section className="rounded-2xl border bg-white p-8"><h1 className="text-2xl font-bold">Ride room unavailable</h1><p className="mt-2">This room is available only to its driver and currently accepted passengers.</p><Link className="mt-4 inline-block text-emerald-700 underline" href="/rides">Find a ride</Link></section>}
  </main></div>;
}
