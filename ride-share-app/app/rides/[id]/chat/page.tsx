import { isChatAiEnabled } from "@/lib/chat/ai-feature";
import Link from "next/link";
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
  return <div className="text-slate-950"><main id="main-content" className="mx-auto flex min-h-[32rem] w-full max-w-6xl flex-col px-3 pb-3 pt-4 sm:px-6 sm:pb-6 lg:h-[calc(100svh-var(--header-h))] lg:min-h-[46rem]">
    {result.ok ? <RideRoom key={id} rideId={id} initial={result.value} aiEnabled={isChatAiEnabled()} /> : <section className="surface-card p-8"><h1 className="font-display text-2xl font-extrabold tracking-[-.03em]">Ride room unavailable</h1><p className="mt-2">This room is available only to its driver and currently accepted passengers.</p><Link className="btn-primary mt-5" href="/rides">Find a ride</Link></section>}
  </main></div>;
}
