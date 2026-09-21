import type { ReactNode } from "react";
import styles from "./landing.module.css";

const route = "M240 318 C 330 330 400 385 520 420 C 700 472 930 455 1100 330 C 1220 242 1300 185 1380 172";

function Chip({ x, y, w, children, tone = "light", className }: { x: number; y: number; w: number; children: ReactNode; tone?: "light" | "green"; className?: string }) {
  return <g transform={`translate(${x} ${y})`}>
    <g className={className}>
      <rect x={-w / 2} y={-19} width={w} height={38} rx={19} fill={tone === "green" ? "#15803d" : "#fff"} filter="url(#chip-shadow)" />
      <text textAnchor="middle" dy="6" fontSize="16" fontWeight="600" fill={tone === "green" ? "#fff" : "#16201a"}>{children}</text>
    </g>
  </g>;
}

/** Stylised map: fields, hills, a lake, roads, and a shared car driving the highlighted route. */
export function LandingMap() {
  return <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-x-0 top-0 h-[27rem] w-full sm:h-full" aria-hidden="true">
    <defs>
      <filter id="chip-shadow" x="-20%" y="-50%" width="140%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0b2a17" floodOpacity=".14" /></filter>
      <path id="route" d={route} />
    </defs>

    <g fill="#c4ebb9" opacity=".6">
      <path d="M860 560c120-60 300-40 380 40s40 200-120 220-300-40-330-120 10-110 70-140Z" />
      <path d="M1000 -20c160 40 260 20 330 90s-40 150-190 140-230-60-240-130 40-120 100-100Z" />
      <path d="M40 80c120-30 220 10 240 80s-60 120-170 110S-20 200 0 140s10-50 40-60Z" />
    </g>

    <g fill="none" stroke="#fff" strokeWidth="1.6" opacity=".55" transform="translate(640 170)">
      {[1, 0.78, 0.56, 0.34].map((s) => <path key={s} transform={`scale(${s})`} d="M-230 10c20-90 130-150 250-140s210 70 200 150-120 120-240 110S-250 100-230 10Z" />)}
    </g>

    <path d="M1470 150c70 10 110 90 105 190s-40 190-100 200-100-70-110-170 35-230 105-220Z" fill="#a8dcf5" />
    <text x="1480" y="360" textAnchor="middle" fontSize="14" fontStyle="italic" fill="#4a86a8" opacity=".9">Lake Ohrid</text>

    <g fill="none" stroke="#fff" strokeLinecap="round">
      <path d="M320 -20c10 220-50 480 70 940" strokeWidth="7" opacity=".7" />
      <path d="M1190 -20c-30 260 60 520 30 940" strokeWidth="7" opacity=".7" />
      <path d="M-20 720c420-40 900 40 1640-80" strokeWidth="7" opacity=".7" />
      <path d="M760 -20c30 160-10 300 40 440" strokeWidth="5" opacity=".6" />
      <path d={`M-60 300 C 80 300 170 305 240 318 ${route.slice(route.indexOf("C"))} C 1460 160 1560 165 1680 170`} strokeWidth="16" opacity=".95" />
    </g>

    <g fill="#6fbf6c" opacity=".75">
      {[[130, 470], [150, 490], [115, 495], [980, 610], [1000, 590], [1020, 615], [470, 150], [490, 170], [1270, 470], [1290, 455], [1300, 480], [880, 110], [900, 95]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="11" />)}
    </g>

    <use href="#route" fill="none" stroke="#16a34a" strokeWidth="7" strokeLinecap="round" />
    <use href="#route" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" className={styles.routeFlow} />

    <circle cx="240" cy="318" r="12" fill="#16a34a" className={styles.pulse} />
    <circle cx="240" cy="318" r="10" fill="#16a34a" stroke="#fff" strokeWidth="4" />
    <rect x="1369" y="161" width="22" height="22" rx="3" fill="#111" stroke="#fff" strokeWidth="4" />
    <circle cx="800" cy="458" r="7" fill="#fff" stroke="#16a34a" strokeWidth="4" />

    <Chip x={240} y={268} w={96}>Skopje</Chip>
    <Chip x={1380} y={122} w={86}>Ohrid</Chip>
    <Chip x={760} y={400} w={210} className={styles.float}>+2 riders picked up</Chip>
    <Chip x={1080} y={250} w={176} tone="green" className={styles.floatSlow}>−21.4 kg CO₂</Chip>

    <g>
      <animateMotion dur="16s" repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#route" /></animateMotion>
      <ellipse cx="2" cy="6" rx="30" ry="15" fill="#0b2a17" opacity=".18" />
      <rect x="-28" y="-15" width="56" height="30" rx="10" fill="#16201a" />
      <rect x="4" y="-12" width="11" height="24" rx="3" fill="#a8dcf5" />
      <rect x="-21" y="-11" width="7" height="22" rx="2" fill="#a8dcf5" opacity=".8" />
      <circle cx="-5" cy="0" r="5" fill="#4ade80" />
      <rect x="22" y="-13" width="5" height="5" rx="1.5" fill="#fef9c3" /><rect x="22" y="8" width="5" height="5" rx="1.5" fill="#fef9c3" />
    </g>
  </svg>;
}
