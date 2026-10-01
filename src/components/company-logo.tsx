"use client";

import { useState } from "react";

const SIZES = { sm: "size-9 rounded-xl text-xs", md: "size-11 rounded-2xl text-sm", lg: "size-14 rounded-[18px] text-base" };
const IMG = { sm: "size-6", md: "size-7", lg: "size-9" };

// The company's logo from its website, on a white tile; its initials if there's no logo.
export function CompanyLogo({ name, domain, size = "md" }: { name: string; domain?: string | null; size?: keyof typeof SIZES }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.6)] ${SIZES[size]}`} aria-hidden>
      {domain && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`}
          alt=""
          className={`${IMG[size]} object-contain`}
          onError={() => setFailed(true)}
          onLoad={(e) => e.currentTarget.naturalWidth <= 16 && setFailed(true)}
        />
      ) : (
        <span className="font-display font-bold text-[#314455]">{initials}</span>
      )}
    </span>
  );
}
