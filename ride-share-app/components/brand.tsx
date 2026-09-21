import Link from "next/link";

export function Brand() {
  return <Link href="/" className="brand inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg text-base font-bold tracking-tight" aria-label="Student Ride Share home">
    <span className="brand-mark grid size-9 place-items-center rounded-xl" aria-hidden="true">
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10 2-5h10l2 5M4 10h16v8H4zM7 18v2m10-2v2M7 13h1m8 0h1M9 16h6" /></svg>
    </span>
    <span>Student Ride Share</span>
  </Link>;
}
