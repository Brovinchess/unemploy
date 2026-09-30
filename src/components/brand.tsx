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
export function Ninja({ className = "size-24" }: { className?: string }) {
  return (
    <svg viewBox="16 16 100 98" className={className} aria-hidden>
      <ellipse cx="60" cy="108" rx="30" ry="4" fill="#000" opacity=".25" />
      {/* scarf tail, behind the body */}
      <path d="M84 70 C 98 66, 104 58, 112 60 C 106 68, 98 74, 86 78 Z" fill="#c96567" />
      {/* body, lighter on top */}
      <path d="M60 22 C 88 22, 98 46, 98 70 C 98 94, 82 104, 60 104 C 38 104, 22 94, 22 70 C 22 46, 32 22, 60 22 Z" fill="#314455" />
      <path d="M60 22 C 88 22, 98 46, 98 60 L 22 60 C 22 46, 32 22, 60 22 Z" fill="#3b5266" />
      {/* face opening */}
      <rect x="30" y="46" width="60" height="24" rx="12" fill="#f5e6dc" />
      {/* eyes with sparkles */}
      <ellipse cx="47" cy="58" rx="5" ry="6" fill="#141b22" />
      <ellipse cx="73" cy="58" rx="5" ry="6" fill="#141b22" />
      <circle cx="49" cy="55.5" r="2" fill="#fff" />
      <circle cx="75" cy="55.5" r="2" fill="#fff" />
      <circle cx="45.5" cy="61" r=".9" fill="#fff" />
      <circle cx="71.5" cy="61" r=".9" fill="#fff" />
      {/* cheeks and smile */}
      <ellipse cx="37" cy="65" rx="3.5" ry="2" fill="#e08a8c" />
      <ellipse cx="83" cy="65" rx="3.5" ry="2" fill="#e08a8c" />
      <path d="M57 64 Q 60 67 63 64" stroke="#9e5a63" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* scarf */}
      <path d="M26 76 Q 60 86 94 76 L 95 84 Q 60 94 25 84 Z" fill="#c96567" />
      {/* feet */}
      <ellipse cx="46" cy="104" rx="8" ry="4" fill="#243240" />
      <ellipse cx="74" cy="104" rx="8" ry="4" fill="#243240" />
    </svg>
  );
}
