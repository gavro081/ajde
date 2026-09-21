"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function fromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function describe(value: string, today: Date) {
  if (!value) return "Any day";
  if (value === iso(today)) return "Today";
  if (value === iso(addDays(today, 1))) return "Tomorrow";
  return fromIso(value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Compact date picker: quick picks plus a month grid. Submits as `name` in yyyy-mm-dd, or empty for any day. */
export function DatePill({ name }: { name: string }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [today] = useState(() => startOfDay(new Date()));
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  // Rendered in a portal with fixed positioning so the hero's overflow and the card's
  // backdrop-filter can't clip it; flips above the trigger when there's no room below.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor = trigger.current?.getBoundingClientRect();
      const panel = popover.current;
      if (!anchor || !panel) return;
      const { offsetWidth: width, offsetHeight: height } = panel;
      const below = anchor.bottom + 8;
      const above = anchor.top - 8 - height;
      const top = below + height <= innerHeight - 8 || above < 8 ? below : above;
      const left = Math.min(Math.max(12, anchor.right - width), innerWidth - width - 12);
      setPosition({ top: Math.max(8, Math.min(top, innerHeight - height - 8)), left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, month]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !popover.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const saturday = addDays(today, (6 - today.getDay() + 7) % 7);
  const quickPicks = [
    { label: "Any day", value: "" },
    { label: "Today", value: iso(today) },
    { label: "Tomorrow", value: iso(addDays(today, 1)) },
    { label: "Weekend", value: iso(saturday) },
  ];
  const leading = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  function choose(next: string) {
    setValue(next);
    setOpen(false);
  }

  function toggle() {
    setPosition({ visibility: "hidden" });
    setOpen(!open);
  }

  return <div className="relative">
    <input type="hidden" name={name} value={value} />
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}
      className={`flex min-h-0 items-center gap-2 rounded-full py-2 pl-3.5 pr-3 text-[15px] font-semibold transition-colors ${value ? "bg-[#16201a] text-white" : "bg-[#f1f4f1] hover:bg-[#e6ebe5]"}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></svg>
      {describe(value, today)}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
    </button>

    {open ? createPortal(<div ref={popover} role="dialog" aria-label="Choose a departure date" style={position} className="fixed z-[60] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-[#16201a]/8 bg-white p-4 shadow-[0_24px_60px_-12px_rgb(11_42_23/0.35)]">
      <div className="flex gap-1">
        {quickPicks.map((pick) => <button key={pick.label} type="button" onClick={() => choose(pick.value)} aria-pressed={value === pick.value}
          className={`min-h-0 flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[13px] font-semibold ${value === pick.value ? "bg-[#16201a] text-white" : "bg-[#f1f4f1] hover:bg-[#e6ebe5]"}`}>{pick.label}</button>)}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" aria-label="Previous month" disabled={isCurrentMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-8 min-h-0 place-items-center rounded-full hover:bg-[#f1f4f1] disabled:opacity-30">‹</button>
        <p className="font-display text-[15px] font-bold" aria-live="polite">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
        <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-8 min-h-0 place-items-center rounded-full hover:bg-[#f1f4f1]">›</button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
        {weekdays.map((day) => <span key={day} className="py-1 font-mono text-[11px] font-medium uppercase text-[#849182]">{day}</span>)}
        {Array.from({ length: leading }, (_, index) => <span key={`gap-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
          const key = iso(date);
          const past = date < today;
          const selected = key === value;
          const isToday = key === iso(today);
          return <button key={key} type="button" disabled={past} onClick={() => choose(key)} aria-pressed={selected}
            aria-label={date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            className={`mx-auto grid size-9 min-h-0 place-items-center rounded-full text-sm font-medium ${selected ? "bg-[#16201a] text-white" : isToday ? "text-[#15803d] ring-2 ring-inset ring-[#22c55e]" : "hover:bg-[#f1f4f1]"} disabled:text-[#c7d1c4] disabled:hover:bg-transparent`}>
            {index + 1}
          </button>;
        })}
      </div>
    </div>, document.body) : null}
  </div>;
}
