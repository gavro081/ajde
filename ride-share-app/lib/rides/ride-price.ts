/** A ride without a price, or priced at 0, is offered free of charge. */
export function isFreeRide(pricePerSeatMkd: number | null | undefined) {
  return !pricePerSeatMkd;
}

/** Headline price shown on cards and ride pages, e.g. "250 MKD" or "Free". */
export function formatSeatPrice(pricePerSeatMkd: number | null | undefined) {
  return isFreeRide(pricePerSeatMkd) ? "Free" : `${pricePerSeatMkd} MKD`;
}

/** The small caption under the headline price. */
export function seatPriceCaption(pricePerSeatMkd: number | null | undefined) {
  return isFreeRide(pricePerSeatMkd) ? "no charge" : "per seat";
}
