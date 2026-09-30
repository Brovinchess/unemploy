// Unemploy's mark: a single brush-stroke "u" in coral, used the way Muse uses its "M".
export function Mark({ className = "size-24" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d="M22 22 C 20 48, 18 78, 48 80 C 76 82, 80 56, 78 22 M78 22 C 78 50, 80 72, 90 82"
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
      unemploy<span className="text-coral">.</span>
    </span>
  );
}
