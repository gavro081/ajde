"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";

export function SubmitButton({ children, pendingLabel = "Saving…", disabled, ...props }: ComponentProps<"button"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button {...props} type="submit" disabled={disabled || pending} aria-disabled={disabled || pending}>{pending ? pendingLabel : children}</button>;
}
