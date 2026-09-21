"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ChipRow, describeDate, MonthCalendar, Popover, quickDatePicks, startOfDay } from "@/components/date-picker";

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const minuteSteps = Array.from({ length: 12 }, (_, step) => String(step * 5).padStart(2, "0"));
const selectClass = "min-h-0 appearance-none rounded-xl bg-[#f1f4f1] px-3 py-2 text-center font-display text-lg font-bold tabular-nums focus:outline-2 focus:outline-[#16a34a]";

/**
 * Date + time picker that edits a `datetime-local` style value ("yyyy-mm-ddThh:mm", local time).
 * Picking a day keeps the panel open so the time can be set; Done closes it.
 */
export function DateTimeField({ value, onChange, invalid, describedBy, labelledBy, className = "" }: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  labelledBy?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [today] = useState(() => startOfDay(new Date()));
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const valueId = useId();

  const [date = "", time = ""] = value ? value.split("T") : [];
  const [hour = "08", minute = "00"] = time ? time.split(":") : [];
  const minutes = minuteSteps.includes(minute) ? minuteSteps : [...minuteSteps, minute].sort();
  const update = (nextDate: string, nextHour = hour, nextMinute = minute) => onChange(nextDate ? `${nextDate}T${nextHour}:${nextMinute}` : "");

  return <div className="relative">
    {/* Keeps native required-field validation now that the visible control is a button. */}
    <input tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0" />
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-describedby={describedBy} aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
      onClick={() => setOpen(!open)} className={`${className} flex items-center gap-3 text-left ${invalid ? "!border-red-600" : ""}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-slate-500"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></svg>
      <span id={valueId} className={`flex-1 ${date ? "font-medium" : "text-slate-500"}`}>{date ? `${describeDate(date, today)} · ${hour}:${minute}` : "Choose date and time"}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
    </button>

    <Popover open={open} onClose={close} trigger={trigger} panel={panel} label="Choose departure date and time">
      <ChipRow options={quickDatePicks(today)} value={date} onChoose={(next) => update(next)} />
      <div className="mt-4"><MonthCalendar value={date} onChoose={(next) => update(next)} today={today} /></div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#16201a]/8 pt-4">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#647063]">Time</span>
        <div className="flex items-center gap-1.5">
          <label><span className="sr-only">Hour</span>
            <select value={hour} disabled={!date} onChange={(event) => update(date, event.target.value)} className={selectClass}>{hours.map((option) => <option key={option}>{option}</option>)}</select>
          </label>
          <span className="font-display text-lg font-bold" aria-hidden="true">:</span>
          <label><span className="sr-only">Minute</span>
            <select value={minute} disabled={!date} onChange={(event) => update(date, hour, event.target.value)} className={selectClass}>{minutes.map((option) => <option key={option}>{option}</option>)}</select>
          </label>
        </div>
      </div>
      <button type="button" disabled={!date} onClick={close} className="mt-4 w-full min-h-0 rounded-xl bg-[#16201a] py-2.5 text-sm font-semibold text-white hover:bg-[#2a3a30] disabled:opacity-40">{date ? "Done" : "Pick a day first"}</button>
    </Popover>
  </div>;
}
