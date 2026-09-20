import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Student rides across North Macedonia" };

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <p className="text-lg font-black tracking-tight">Student Ride Share</p>
        <Link href="/login" className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10">Sign in</Link>
      </nav>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Made for students in Skopje</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight tracking-tight sm:text-6xl">A simpler ride home. A fairer way to split the cost.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Find students travelling your route, request the seats you need, and share real fuel costs instead of searching through scattered group posts.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/rides" className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-400">Find a ride</Link><Link href="/rides/new" className="rounded-xl border border-slate-600 px-5 py-3 font-bold hover:bg-slate-900">Offer a ride</Link></div>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <div className="rounded-2xl bg-white p-5 text-slate-950"><p className="text-sm font-bold text-emerald-700">Tomorrow · 18:00</p><h2 className="mt-2 text-2xl font-black">Skopje → Bitola</h2><p className="mt-2 text-sm text-slate-600">Verified student · 3 seats · fair fuel split</p><div className="mt-6 flex items-end justify-between border-t border-slate-100 pt-5"><div><p className="text-sm text-slate-500">Per seat</p><p className="text-2xl font-black">500 MKD</p></div><span className="rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800">Request seat</span></div></div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-xl bg-slate-800 p-3"><p className="font-black text-emerald-400">10</p><p className="mt-1 text-slate-400">cities</p></div><div className="rounded-xl bg-slate-800 p-3"><p className="font-black text-emerald-400">Private</p><p className="mt-1 text-slate-400">contacts</p></div><div className="rounded-xl bg-slate-800 p-3"><p className="font-black text-emerald-400">Fair</p><p className="mt-1 text-slate-400">pricing</p></div></div>
        </div>
      </section>
    </main>
  );
}
