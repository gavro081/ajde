import "server-only";

/** Temporary local-only bypass. Remove when authenticated ride testing is restored. */
export function anonymousRideTestingEnabled() {
  return process.env.NODE_ENV !== "production";
}
