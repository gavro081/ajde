"use client";

import { useCallback, useRef, useState } from "react";
import { ChipRow, describeDate, MonthCalendar, Popover, quickDatePicks, startOfDay } from "@/components/date-picker";

/** Compact date picker: quick picks plus a month grid. Submits as `name` in yyyy-mm-dd, or nothing for any day. */
export function DatePill({ name }: { name: string }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [today] = useState(() => startOfDay(new Date()));
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  function choose(next: string) {
    setValue(next);
    setOpen(false);
  }

  return <div className="relative">
    <input type="hidden" name={name} value={value} disabled={!value} />
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}
      className={`flex min-h-0 items-center gap-2 rounded-full py-2 pl-3.5 pr-3 text-[15px] font-semibold transition-colors ${value ? "bg-[#16201a] text-white" : "bg-[#f1f4f1] hover:bg-[#e6ebe5]"}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></svg>
      {value ? describeDate(value, today) : "Any day"}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
    </button>

    <Popover open={open} onClose={close} trigger={trigger} panel={panel} label="Choose a departure date">
      <ChipRow options={[{ label: "Any day", value: "" }, ...quickDatePicks(today)]} value={value} onChoose={choose} />
      <div className="mt-4"><MonthCalendar value={value} onChoose={choose} today={today} /></div>
    </Popover>
  </div>;
}
