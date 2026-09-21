export type SubmittedRating = { score: number; note: string | null };
export type RatingActionState =
  | { status: "submitted"; message: string; rating: SubmittedRating }
  | { status: "already_rated" | "error"; message: string }
  | null;
export type RatingControlState = { status: "eligible" } | { status: "submitted"; rating: SubmittedRating };
export type RatingSummary = { average: number | null; count: number };
