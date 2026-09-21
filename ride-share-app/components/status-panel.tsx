import type { ReactNode } from "react";

/** Centered message card for error and not-found states. */
export function StatusPanel({ eyebrow, title, children, actions, tone = "neutral" }: {
  eyebrow: string; title: string; children: ReactNode; actions: ReactNode; tone?: "neutral" | "error";
}) {
  return <main id="main-content" className="grid flex-1 place-items-center px-5 py-16">
    <section className="surface-card max-w-md p-9 text-center">
      <p className={`eyebrow ${tone === "error" ? "text-red-700" : "text-brand-700"}`}>{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.035em]">{title}</h1>
      <div className="mt-3 leading-7 text-slate-600">{children}</div>
      <div className="mt-7 flex flex-wrap justify-center gap-3">{actions}</div>
    </section>
  </main>;
}
