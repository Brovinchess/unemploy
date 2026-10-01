// Career Ninja's mark: a single brush-stroke "c" in coral, used the way Muse uses its "M".
export function Mark({ className = "size-24" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d="M78 30 C 66 14, 32 14, 22 42 C 14 68, 34 86, 58 82 C 68 80, 76 74, 82 64"
        fill="none"
        stroke="var(--coral)"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-[1.125rem] font-semibold tracking-tight text-white ${className}`}>
      careerninja<span className="text-coral">.</span>
    </span>
  );
}

// Mochi, the Career Ninja mascot: a squishy round ninja with a coral scarf, tiny feet
// and sparkly eyes. Flat shapes only so it reads at headline size and at hero size.
// Each mood changes the face and adds a small prop; props may sit just outside the box.
export type Mood =
  | "happy" // default
  | "excited" // a search is done, everything sorted
  | "searching" // headhunter at work
  | "sleeping" // switched off between searches, or paused
  | "sad" // nothing here / nothing found
  | "surprised" // a new job card
  | "love" // jobs you want to apply to
  | "thinking"; // the personal Mind answering questions

const INK = "#141b22";
const MOUTH = "#9e5a63";
const CREAM = "#f5e6dc";
const CORAL = "#c96567";

const heart = (x: number, y: number, s: number) =>
  `M${x} ${y + s * 0.9} C${x - s * 1.6} ${y - s * 0.1} ${x - s * 0.6} ${y - s * 1.3} ${x} ${y - s * 0.35} C${x + s * 0.6} ${y - s * 1.3} ${x + s * 1.6} ${y - s * 0.1} ${x} ${y + s * 0.9}Z`;
const sparkle = (x: number, y: number, s: number) => `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;

function Eyes({ dx = 0, dy = 0, r = 1 }: { dx?: number; dy?: number; r?: number }) {
  return (
    <>
      <ellipse cx={47 + dx} cy={58 + dy} rx={5 * r} ry={6 * r} fill={INK} />
      <ellipse cx={73 + dx} cy={58 + dy} rx={5 * r} ry={6 * r} fill={INK} />
      <circle cx={49 + dx} cy={55.5 + dy} r={2 * r} fill="#fff" />
      <circle cx={75 + dx} cy={55.5 + dy} r={2 * r} fill="#fff" />
      <circle cx={45.5 + dx} cy={61 + dy} r=".9" fill="#fff" />
      <circle cx={71.5 + dx} cy={61 + dy} r=".9" fill="#fff" />
    </>
  );
}

const line = { stroke: INK, strokeWidth: 2.6, fill: "none", strokeLinecap: "round" as const };

function Face({ mood }: { mood: Mood }) {
  switch (mood) {
    case "excited":
      return (
        <>
          <path d="M42 60 Q47 53 52 60" {...line} />
          <path d="M68 60 Q73 53 78 60" {...line} />
          <path d="M55 63 Q60 70.5 65 63 Z" fill={MOUTH} />
        </>
      );
    case "searching":
      return (
        <>
          <Eyes dx={3} r={0.9} />
          <path d="M58 65 Q61 66.5 64 65" stroke={MOUTH} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      );
    case "sleeping":
      return (
        <>
          <path d="M42 58 Q47 62 52 58" {...line} />
          <path d="M68 58 Q73 62 78 58" {...line} />
          <ellipse cx="60" cy="65.5" rx="1.6" ry="1.9" fill={MOUTH} />
        </>
      );
    case "sad":
      return (
        <>
          <Eyes dy={1} r={0.85} />
          <path d="M41 51 L51 48.5" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M79 51 L69 48.5" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M56 67.5 Q60 63.5 64 67.5" stroke={MOUTH} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M43 64 Q40.5 68.5 43 70 Q45.5 68.5 43 64 Z" fill="#8ecae6" />
        </>
      );
    case "surprised":
      return (
        <>
          <Eyes r={1.15} />
          <ellipse cx="60" cy="66" rx="2.4" ry="3.2" fill={MOUTH} />
        </>
      );
    case "love":
      return (
        <>
          <path d={heart(47, 58, 5.5)} fill="#e0565b" />
          <path d={heart(73, 58, 5.5)} fill="#e0565b" />
          <path d="M55 63.5 Q60 69 65 63.5" stroke={MOUTH} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      );
    case "thinking":
      return (
        <>
          <Eyes dx={-2} dy={-2} r={0.9} />
          <path d="M56 65.5 L64 64.5" stroke={MOUTH} strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    default:
      return (
        <>
          <Eyes />
          <path d="M57 64 Q 60 67 63 64" stroke={MOUTH} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      );
  }
}

function Props({ mood }: { mood: Mood }) {
  const bold = { fontFamily: "system-ui, sans-serif", fontWeight: 800 };
  switch (mood) {
    case "excited":
      return (
        <>
          <ellipse cx="22" cy="52" rx="5" ry="8" transform="rotate(-35 22 52)" fill="#3b5266" />
          <ellipse cx="98" cy="52" rx="5" ry="8" transform="rotate(35 98 52)" fill="#3b5266" />
          <path d={sparkle(26, 26, 5)} fill="#f2c14e" />
          <path d={sparkle(100, 22, 6)} fill={CREAM} />
          <path d={sparkle(110, 40, 3.5)} fill="#f2c14e" />
          <path d={sparkle(14, 42, 3)} fill={CREAM} />
        </>
      );
    case "searching":
      return (
        <>
          <line x1="104" y1="66" x2="113" y2="76" stroke={CORAL} strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="99" cy="59" r="9" fill="#ffffff" fillOpacity=".18" stroke={CREAM} strokeWidth="3" />
          <path d="M94 55 Q96 52 99.5 52" stroke="#fff" strokeOpacity=".7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      );
    case "sleeping":
      return (
        <>
          <text x="92" y="32" fontSize="13" fill={CREAM} {...bold}>z</text>
          <text x="102" y="22" fontSize="9.5" fill={CREAM} fillOpacity=".7" {...bold}>z</text>
          <text x="109" y="14" fontSize="7" fill={CREAM} fillOpacity=".45" {...bold}>z</text>
        </>
      );
    case "sad":
      return (
        <>
          <path d="M100 30 Q101 26 104 25" stroke="#8ecae6" strokeOpacity=".7" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M106 36 Q108 33 111 33" stroke="#8ecae6" strokeOpacity=".5" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );
    case "surprised":
      return (
        <>
          <text x="98" y="36" fontSize="20" fill="#f2c14e" {...bold}>!</text>
          <path d={sparkle(22, 30, 4)} fill={CREAM} />
        </>
      );
    case "love":
      return (
        <>
          <path d={heart(102, 30, 5)} fill="#e0565b" />
          <path d={heart(112, 16, 3.2)} fill="#e0565b" fillOpacity=".7" />
          <path d={heart(20, 34, 3.5)} fill="#e0565b" fillOpacity=".8" />
        </>
      );
    case "thinking":
      return (
        <>
          <circle cx="94" cy="38" r="2" fill={CREAM} fillOpacity=".6" />
          <circle cx="99" cy="31" r="3" fill={CREAM} fillOpacity=".75" />
          <text x="101" y="25" fontSize="17" fill="#f2c14e" {...bold}>?</text>
        </>
      );
    default:
      return null;
  }
}

export function Ninja({ className = "size-24", mood = "happy" }: { className?: string; mood?: Mood }) {
  return (
    <svg viewBox="16 16 100 98" className={className} overflow="visible" aria-hidden>
      <ellipse cx="60" cy="108" rx="30" ry="4" fill="#000" opacity=".25" />
      {/* scarf tail, behind the body */}
      <path d="M84 70 C 98 66, 104 58, 112 60 C 106 68, 98 74, 86 78 Z" fill={CORAL} />
      {/* body, lighter on top */}
      <path d="M60 22 C 88 22, 98 46, 98 70 C 98 94, 82 104, 60 104 C 38 104, 22 94, 22 70 C 22 46, 32 22, 60 22 Z" fill="#314455" />
      <path d="M60 22 C 88 22, 98 46, 98 60 L 22 60 C 22 46, 32 22, 60 22 Z" fill="#3b5266" />
      {/* face opening */}
      <rect x="30" y="46" width="60" height="24" rx="12" fill={CREAM} />
      {/* cheeks */}
      <ellipse cx="37" cy="65" rx="3.5" ry="2" fill="#e08a8c" opacity={mood === "sad" || mood === "sleeping" ? 0.5 : 1} />
      <ellipse cx="83" cy="65" rx="3.5" ry="2" fill="#e08a8c" opacity={mood === "sad" || mood === "sleeping" ? 0.5 : 1} />
      <Face mood={mood} />
      {/* scarf */}
      <path d="M26 76 Q 60 86 94 76 L 95 84 Q 60 94 25 84 Z" fill={CORAL} />
      {/* feet */}
      <ellipse cx="46" cy="104" rx="8" ry="4" fill="#243240" />
      <ellipse cx="74" cy="104" rx="8" ry="4" fill="#243240" />
      <Props mood={mood} />
    </svg>
  );
}
