import Link from "next/link";

export default function RideNotFound() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-4"><div className="text-center"><h1 className="text-3xl font-bold">Ride not found</h1><p className="mt-2 text-slate-600">It may have been removed or is no longer public.</p><Link href="/rides" className="mt-5 inline-block rounded-xl bg-coral-600 px-4 py-2.5 font-semibold text-white">Browse rides</Link></div></main>;
}
