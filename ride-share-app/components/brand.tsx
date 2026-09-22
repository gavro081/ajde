import Image from "next/image";
import Link from "next/link";

export function Brand() {
  return <Link href="/" className="brand inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2" aria-label="ajde home">
    <Image src="/brand/ajde-car.png" alt="" width={132} height={108} priority className="brand-mark h-7 w-auto" />
    <span className="brand-label">
      <Image src="/brand/ajde-wordmark.png" alt="" width={223} height={108} priority className="h-7 w-auto max-w-none" />
    </span>
  </Link>;
}
