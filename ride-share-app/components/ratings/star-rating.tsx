"use client";

import { useState } from "react";

export const scoreLabels = ["Poor", "Fair", "Good", "Very good", "Excellent"];

function Star({ filled, size }: { filled: boolean; size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={filled ? "text-amber-400" : "text-slate-300"}>
    <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>;
}

/** Read-only stars; fractional scores (e.g. a 4.5 average) partially fill a star. */
export function StarDisplay({ score, size = 20, label }: { score: number; size?: number; label?: string }) {
  return <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${score} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => {
      const fill = Math.min(1, Math.max(0, score - (star - 1)));
      return <span key={star} className="relative inline-block" style={{ width: size, height: size }}>
        <Star filled={false} size={size} />
        {fill > 0 ? <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star filled size={size} /></span> : null}
      </span>;
    })}
  </span>;
}

/**
 * Star picker backed by real radio inputs named `name`, so arrow keys, required validation and
 * form submission work natively; hovering previews a score.
 */
export function StarRatingInput({ name, label }: { name: string; label: string }) {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(0);
  const shown = hovered || selected;

  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
    <div role="radiogroup" aria-label={label} className="flex" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => <label key={star} onMouseEnter={() => setHovered(star)}
        className="cursor-pointer rounded-lg p-1 transition-transform hover:scale-110 has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-brand-600">
        <input type="radio" name={name} value={star} required checked={selected === star} onChange={() => setSelected(star)} className="sr-only" />
        <span className="sr-only">{star} star{star === 1 ? "" : "s"}, {scoreLabels[star - 1]}</span>
        <Star filled={star <= shown} size={34} />
      </label>)}
    </div>
    <span aria-hidden="true" className={`text-sm font-semibold ${shown ? "text-slate-800" : "text-slate-400"}`}>{shown ? scoreLabels[shown - 1] : "Tap a star to rate"}</span>
  </div>;
}
