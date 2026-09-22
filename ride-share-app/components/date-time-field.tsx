"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ChipRow, describeDate, fromIsoDate, MonthCalendar, Popover, quickDatePicks } from "@/components/date-picker";
import { departureInstant, skopjeLocal } from "@/lib/rides/offer-values";
import { latestDeparture } from "@/lib/rides/ride-limits";

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const minuteSteps = Array.from({ length: 12 }, (_, step) => String(step * 5).padStart(2, "0"));
const selectClass = "min-h-0 appearance-none rounded-xl bg-[#f1f4f1] px-3 py-2 text-center font-display text-lg font-bold tabular-nums focus:outline-2 focus:outline-[#16a34a]";

/**
 * Date + time picker that edits a `datetime-local` style value ("yyyy-mm-ddThh:mm", local time).
 * Picking a day keeps the panel open so the time can be set; Done closes it.
 */
export function DateTimeField({ value, onChange, invalid, disabled, describedBy, labelledBy, className = "" }: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
  labelledBy?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const today = fromIsoDate(skopjeLocal(now.toISOString()).split("T")[0]);
  const maximum = latestDeparture(now);
  const minLocal = skopjeLocal(new Date(now.getTime() + 60_000).toISOString());
  const maxLocal = skopjeLocal(maximum.toISOString());
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus(); }, []);
  const valueId = useId();

  const [date = "", time = ""] = value ? value.split("T") : [];
  const [hour = "", minute = "00"] = time ? time.split(":") : [];
  const instant = departureInstant(value);
  const inRange = (candidate: string) => {
    const timestamp = Date.parse(departureInstant(candidate));
    return timestamp > now.getTime() && timestamp <= maximum.getTime();
  };
  const complete = Boolean(instant) && inRange(value);
  const minutes = minuteSteps.includes(minute) ? minuteSteps : [...minuteSteps, minute].sort();
  const update = (nextDate: string, nextHour = hour, nextMinute = minute) => onChange(nextDate ? `${nextDate}T${nextHour ? `${nextHour}:${nextMinute}` : ""}` : "");

  return <div className="relative">
    {/* Keeps native required-field validation now that the visible control is a button. */}
    <input type="datetime-local" min={minLocal} max={maxLocal} name="departureLocal" tabIndex={-1} aria-hidden="true" aria-invalid={invalid || undefined} required disabled={disabled} value={instant ? value : ""} onChange={() => {}} onInvalid={(event) => { event.preventDefault(); setNow(new Date()); setOpen(true); trigger.current?.focus(); }} className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0" />
    <button ref={trigger} type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open && !disabled} aria-describedby={describedBy} aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
      onClick={() => { setNow(new Date()); setOpen(!open); }} className={`${className} flex items-center gap-3 text-left ${invalid ? "!border-red-600" : ""}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-slate-500"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></svg>
      <span id={valueId} className={`flex-1 ${date ? "font-medium" : "text-slate-500"}`}>{date ? `${describeDate(date, today)} · ${hour ? `${hour}:${minute}` : "Choose time"}` : "Choose date and time"}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
    </button>

    <Popover open={open && !disabled} onClose={close} trigger={trigger} panel={panel} label="Choose departure date and time">
      <ChipRow options={quickDatePicks(today)} value={date} onChoose={(next) => update(next)} />
      <div className="mt-4"><MonthCalendar value={date} onChoose={(next) => update(next)} today={today} maxDate={fromIsoDate(maxLocal.split("T")[0])} /></div>
      <p className="mt-2 text-[.75rem] text-slate-500">Choose a future time within 90 days, in Skopje time.</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#16201a]/8 pt-4">
        <span className="text-sm font-semibold text-[#647063]">Time</span>
        <div className="flex items-center gap-1.5">
          <label><span className="sr-only">Hour</span>
            <select value={hour} disabled={!date} onChange={(event) => update(date, event.target.value)} className={selectClass}><option value="">Hour</option>{hours.map((option) => <option key={option} disabled={`${date}T${option}:59` < minLocal || `${date}T${option}:00` > maxLocal}>{option}</option>)}</select>
          </label>
          <span className="font-display text-lg font-bold" aria-hidden="true">:</span>
          <label><span className="sr-only">Minute</span>
            <select value={minute} disabled={!date || !hour} onChange={(event) => update(date, hour, event.target.value)} className={selectClass}>{minutes.map((option) => <option key={option} disabled={!inRange(`${date}T${hour}:${option}`)}>{option}</option>)}</select>
          </label>
        </div>
      </div>
      <button type="button" disabled={!complete} onClick={close} className="mt-4 w-full min-h-0 rounded-xl bg-[#16201a] py-2.5 text-sm font-semibold text-white hover:bg-[#2a3a30] disabled:opacity-40">{complete ? "Done" : date ? "Choose a time" : "Pick a day first"}</button>
    </Popover>
  </div>;
}
