import Link from "next/link";
import { Brand } from "@/components/brand";

/** Global footer. It lives in the root layout so every page ends the same way. */
export function SiteFooter() {
  return <footer className="mt-auto border-t border-white/10 bg-[#0f1511]">
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 text-sm text-[#a3b8aa] sm:px-10 md:flex-row md:items-center md:justify-between">
      <Brand inverse />
      <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/rides" className="hover:text-white">Find a ride</Link>
        <Link href="/rides/new" className="hover:text-white">Offer a ride</Link>
        <Link href="/#about" className="hover:text-white">About</Link>
      </nav>
      <p>© {new Date().getFullYear()} ajde. Made in Skopje.</p>
    </div>
  </footer>;
}
