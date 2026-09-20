"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { parsedRidePostSchema, type ParsedRidePost } from "@/lib/ai/parse-ride-post";

type ParseResponse = {
  importId: string;
  parsed: ParsedRidePost;
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function ImportRideForm() {
  const [text, setText] = useState("");
  const [sourceHint, setSourceHint] = useState<"viber" | "facebook" | "other">("viber");
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, sourceHint }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "The post could not be parsed.";
        setError(message);
        return;
      }

      const parsedResponse = parsedRidePostSchema.safeParse(
        typeof payload === "object" && payload !== null && "parsed" in payload
          ? payload.parsed
          : null,
      );
      const importId =
        typeof payload === "object" &&
        payload !== null &&
        "importId" in payload &&
        typeof payload.importId === "string"
          ? payload.importId
          : null;

      if (!parsedResponse.success || !importId) {
        setError("The parser returned an invalid draft. Nothing was published.");
        return;
      }

      setResult({ importId, parsed: parsedResponse.data });
    } catch {
      setError("The parser could not be reached. Try again or create the ride manually.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-7">
      <form className="space-y-5" onSubmit={submit}>
        <label className="block font-medium text-slate-800">
          Source
          <select
            className={inputClass}
            onChange={(event) =>
              setSourceHint(event.target.value as "viber" | "facebook" | "other")
            }
            value={sourceHint}
          >
            <option value="viber">Viber</option>
            <option value="facebook">Facebook</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block font-medium text-slate-800">
          Post text
          <textarea
            className={`${inputClass} min-h-48 resize-y`}
            maxLength={5_000}
            minLength={10}
            onChange={(event) => setText(event.target.value)}
            placeholder="Имам 3 слободни места од Скопје за Битола…"
            required
            value={text}
          />
          <span className="mt-1 block text-right text-xs text-slate-500">{text.length}/5000</span>
        </label>
        <button
          className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Parsing…" : "Create review draft"}
        </button>
      </form>

      {error ? (
        <p aria-live="polite" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
          {error}
        </p>
      ) : null}

      {result ? <ParsedReview result={result} /> : null}
    </div>
  );
}

function ParsedReview({ result }: { result: ParseResponse }) {
  const { parsed } = result;
  const fields = [
    ["Classification", parsed.classification],
    ["Origin city ID", parsed.draft.origin.cityId ?? "Needs review"],
    ["Destination city ID", parsed.draft.destination.cityId ?? "Needs review"],
    ["Departure", parsed.draft.departureAt ?? "Needs review"],
    ["Seats", parsed.draft.seatsTotal ?? "Needs review"],
    ["Price per seat", parsed.draft.pricePerSeatMkd ?? "Needs review"],
  ];

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-emerald-950">Review the extracted details</h2>
          <p className="mt-1 text-sm text-emerald-900/75">
            Confidence: {Math.round((parsed.draft.confidence ?? 0) * 100)}%
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase text-emerald-800">
          {parsed.sourceLanguage}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div className="rounded-xl bg-white p-3" key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      {parsed.draft.warnings.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-amber-900">
          {parsed.draft.warnings.map((warning, index) => (
            <li className="rounded-lg bg-amber-100 px-3 py-2" key={`${warning.code}-${index}`}>
              {warning.message}
            </li>
          ))}
        </ul>
      ) : null}

      {parsed.classification === "request" ? (
        <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950">
          This looks like a request for transport, not an offered ride. Confirm before continuing.
        </p>
      ) : null}

      <Link
        className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"
        href={`/rides/new?import=${result.importId}`}
      >
        Continue to editable ride form
      </Link>
    </section>
  );
}
