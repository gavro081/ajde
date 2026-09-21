"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

// Shared calendar primitives for the landing search pill and the ride form's departure field.

const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function fromIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function describeDate(value: string, today: Date) {
  if (value === isoDate(today)) return "Today";
  if (value === isoDate(addDays(today, 1))) return "Tomorrow";
  return fromIsoDate(value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function quickDatePicks(today: Date) {
  return [
    { label: "Today", value: isoDate(today) },
    { label: "Tomorrow", value: isoDate(addDays(today, 1)) },
    { label: "Weekend", value: isoDate(addDays(today, (6 - today.getDay() + 7) % 7)) },
  ];
}

/**
 * A fixed-position panel portalled to <body>, so overflow and backdrop-filter on ancestors can't
 * clip it. It opens below the trigger, or above when there is no room, and closes on an outside
 * pointer or Escape.
 */
export function Popover({ open, onClose, trigger, panel, label, children }: {
  open: boolean;
  onClose: () => void;
  trigger: RefObject<HTMLElement | null>;
  panel: RefObject<HTMLDivElement | null>;
  label: string;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor = trigger.current?.getBoundingClientRect();
      const node = panel.current;
      if (!anchor || !node) return;
      const { offsetWidth: width, offsetHeight: height } = node;
      const below = anchor.bottom + 8;
      const above = anchor.top - 8 - height;
      const top = below + height <= innerHeight - 8 || above < 8 ? below : above;
      const left = Math.min(Math.max(12, anchor.right - width), innerWidth - width - 12);
      setPosition({ top: Math.max(8, Math.min(top, innerHeight - height - 8)), left });
    }
    place();
    // The panel's height changes with its content (e.g. a month with six week rows).
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (panel.current) observer?.observe(panel.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { observer?.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, trigger, panel]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) onClose();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open, onClose, trigger, panel]);

  if (!open) return null;
  return createPortal(<div ref={panel} role="dialog" aria-label={label} style={position}
    className="fixed z-[60] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-[#16201a]/8 bg-white p-4 shadow-[0_24px_60px_-12px_rgb(11_42_23/0.35)]">
    {children}
  </div>, document.body);
}

export function ChipRow({ options, value, onChoose }: { options: { label: string; value: string }[]; value: string; onChoose: (value: string) => void }) {
  return <div className="flex gap-1">
    {options.map((option) => <button key={option.label} type="button" onClick={() => onChoose(option.value)} aria-pressed={value === option.value}
      className={`min-h-0 flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[13px] font-semibold ${value === option.value ? "bg-[#16201a] text-white" : "bg-[#f1f4f1] hover:bg-[#e6ebe5]"}`}>{option.label}</button>)}
  </div>;
}

/** Month grid; past days are disabled. `value` is yyyy-mm-dd or empty. */
export function MonthCalendar({ value, onChoose, today }: { value: string; onChoose: (value: string) => void; today: Date }) {
  const [month, setMonth] = useState(() => {
    const base = value ? fromIsoDate(value) : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const leading = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  return <div>
    <div className="flex items-center justify-between">
      <button type="button" aria-label="Previous month" disabled={isCurrentMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-8 min-h-0 place-items-center rounded-full hover:bg-[#f1f4f1] disabled:opacity-30">‹</button>
      <p className="font-display text-[15px] font-bold" aria-live="polite">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
      <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-8 min-h-0 place-items-center rounded-full hover:bg-[#f1f4f1]">›</button>
    </div>
    <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
      {weekdays.map((day) => <span key={day} className="py-1 font-mono text-[11px] font-medium uppercase text-[#849182]">{day}</span>)}
      {Array.from({ length: leading }, (_, index) => <span key={`gap-${index}`} />)}
      {Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
        const key = isoDate(date);
        const selected = key === value;
        const isToday = key === isoDate(today);
        return <button key={key} type="button" disabled={date < today} onClick={() => onChoose(key)} aria-pressed={selected}
          aria-label={date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          className={`mx-auto grid size-9 min-h-0 place-items-center rounded-full text-sm font-medium ${selected ? "bg-[#16201a] text-white" : isToday ? "text-[#15803d] ring-2 ring-inset ring-[#22c55e]" : "hover:bg-[#f1f4f1]"} disabled:text-[#c7d1c4] disabled:hover:bg-transparent`}>
          {index + 1}
        </button>;
      })}
    </div>
  </div>;
}
