"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { parsedRidePostSchema, type ParsedRidePost } from "@/lib/ai/parsed-ride-post";
import { rideCheckMetadataSchema, type RideCheckMetadata } from "@/lib/ai/ride-check-contract";
import { formatDeparture } from "@/lib/rides/ride-presentation";
import { RideCheckSummary } from "./ride-check-summary";
import { ScreenshotImport } from "./screenshot-import";

type ParseResponse = {
  importId: string;
  parsed: ParsedRidePost;
  check?: RideCheckMetadata;
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function ImportRideForm({ cities, pipelineEnabled = false }: { cities: { id: number; name_en: string }[]; pipelineEnabled?: boolean }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"facebook" | "viber">("viber");
  const [screenshotText, setScreenshotText] = useState("");
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [readingScreenshot, setReadingScreenshot] = useState(false);
  const screenshotMode = pipelineEnabled && mode === "facebook";
  const postText = screenshotMode ? screenshotText : text;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || readingScreenshot || postText.trim().length < 10) return;
    setPending(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: postText, sourceHint: screenshotMode ? "facebook" : "viber" }),
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

      const check = rideCheckMetadataSchema.safeParse(
        typeof payload === "object" && payload !== null && "check" in payload ? payload.check : undefined,
      );
      setResult({ importId, parsed: parsedResponse.data, ...(check.success ? { check: check.data } : {}) });
    } catch {
      setError("The parser could not be reached. Try again or create the ride manually.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-7">
      <form className="space-y-5" onSubmit={submit} aria-busy={pending || readingScreenshot}>
        {pipelineEnabled ? <div role="group" aria-label="Import method" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(["facebook", "viber"] as const).map(method => <button key={method} type="button"
            aria-pressed={mode === method} disabled={pending || readingScreenshot}
            onClick={() => { setMode(method); setResult(null); setError(""); }}
            className={`rounded-lg px-3 py-3 text-sm font-semibold transition disabled:opacity-60 ${mode === method ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
            {method === "facebook" ? "Facebook screenshot" : "Viber text"}
          </button>)}
        </div> : null}
        {pipelineEnabled ? <div hidden={!screenshotMode}>
          <ScreenshotImport disabled={pending} onBusyChange={setReadingScreenshot}
            onClearSelection={() => { setScreenshotText(""); setResult(null); setError(""); }}
            onSelect={post => { setScreenshotText(post.text); setResult(null); setError(""); }} />
        </div> : null}
        {!screenshotMode ? <label className="block text-sm font-medium text-slate-700">
          Post text
          <textarea
            aria-label="Post text"
            className={`${inputClass} min-h-56 resize-y text-sm leading-relaxed disabled:opacity-60`}
            maxLength={5_000}
            minLength={10}
            disabled={pending}
            onChange={(event) => { setText(event.target.value); setResult(null); setError(""); }}
            placeholder="Имам 3 слободни места од Скопје за Битола…"
            required
            value={text}
          />
          <span className="mt-1 block text-right text-xs font-normal text-slate-500">{text.length.toLocaleString()} / 5,000</span>
        </label> : null}
        <button
          className="btn-primary w-full disabled:opacity-50"
          disabled={pending || readingScreenshot || postText.trim().length < 10}
          type="submit"
        >
          {pending ? "Parsing…" : "Create review draft"}
        </button>
        <p className="text-center text-xs text-slate-500">Review and edit before publishing.</p>
      </form>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
          {error}
          <Link href="/rides/new" className="mt-2 block font-semibold underline">Enter the ride manually</Link>
        </p>
      ) : null}

      {result ? <ParsedReview result={result} cities={cities} pipelineEnabled={pipelineEnabled} /> : null}
    </div>
  );
}

function ParsedReview({ result, cities, pipelineEnabled }: { result: ParseResponse; cities: { id: number; name_en: string }[]; pipelineEnabled: boolean }) {
  const { parsed } = result;
  const fields = [
    ["Classification", parsed.classification],
    ["Departure city", cities.find(city => city.id === parsed.draft.origin.cityId)?.name_en ?? parsed.draft.origin.rawText ?? "Needs review"],
    ["Destination city", cities.find(city => city.id === parsed.draft.destination.cityId)?.name_en ?? parsed.draft.destination.rawText ?? "Needs review"],
    ["Departure (Skopje time)", parsed.draft.departureAt ? formatDeparture(parsed.draft.departureAt) : "Needs review"],
    ["Seats", parsed.draft.seatsTotal ?? "Needs review"],
    ["Price per seat", parsed.draft.pricePerSeatMkd !== null ? `${parsed.draft.pricePerSeatMkd} MKD` : "Needs review"],
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
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
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

      {pipelineEnabled && result.check ? <RideCheckSummary check={result.check} cities={cities} /> : null}

      {parsed.classification === "request" ? (
        <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950">
          This looks like a request for transport, not an offered ride. Confirm before continuing.
        </p>
      ) : null}

      <Link
        className="mt-5 inline-flex btn-primary"
        href={`/rides/new?import=${result.importId}`}
      >
        Continue to editable ride form
      </Link>
    </section>
  );
}
