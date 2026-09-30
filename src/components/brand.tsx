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
