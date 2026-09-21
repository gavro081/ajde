import Link from "next/link";

export function Brand() {
  return <Link href="/" className="brand inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-full pr-2 font-display text-[17px] font-extrabold tracking-tight" aria-label="Student Ride Share home">
    <span className="brand-mark grid size-9 place-items-center rounded-full" aria-hidden="true">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4c-9 0-15 4-15 11 0 1.6.5 3 1.3 4.2C8 15 11 12 15 10c-3.4 2.6-6 5.9-7.3 9.6.9.3 1.8.4 2.8.4C17 20 20 14 20 4Z" /></svg>
    </span>
    <span>Student Ride Share</span>
  </Link>;
}
