import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="font-display text-xl font-extrabold tracking-tight text-ink">
      unemploy<span className="text-coral">.</span>
    </Link>
  );
}

// Company "logo": initials on a tinted square, until real logos are available.
export function CompanyMark({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const tints = ["bg-mist-soft text-navy", "bg-coral-soft text-rose", "bg-plum-soft text-muted"];
  const tint = tints[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % tints.length];
  const dims = { sm: "size-9 text-xs rounded-lg", md: "size-11 text-sm rounded-xl", lg: "size-14 text-base rounded-2xl" }[size];
  return (
    <span className={`font-display inline-flex shrink-0 items-center justify-center font-bold ${dims} ${tint}`} aria-hidden>
      {initials}
    </span>
  );
}
