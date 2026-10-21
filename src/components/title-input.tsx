"use client";

import { useEffect, useId, useRef, useState } from "react";

// A text field that suggests job titles as the person types, so the roles they ask for are ones
// employers post. `multi` keeps a comma-separated list and suggests for the part being typed.
export function TitleInput({
  value,
  onChange,
  multi = false,
  id,
  name,
  placeholder,
  className = "field",
  autoFocus,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  multi?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const abort = useRef<AbortController | null>(null);

  // The part being typed: after the last comma in a list, the whole value otherwise.
  const parts = multi ? value.split(",") : [value];
  const current = parts[parts.length - 1].trim();

  useEffect(() => {
    abort.current?.abort();
    if (current.length < 2) return; // nothing to look up; the list stays hidden below
    const ctl = new AbortController();
    abort.current = ctl;
    const t = setTimeout(() => {
      fetch(`/api/titles?q=${encodeURIComponent(current)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((list: string[]) => {
          const same = list.length === 1 && list[0].toLowerCase() === current.toLowerCase();
          setItems(same ? [] : list);
          setActive(-1);
        })
        .catch(() => {});
    }, 120);
    return () => clearTimeout(t);
  }, [current]);

  const pick = (title: string) => {
    if (multi) {
      const head = parts.slice(0, -1).map((p) => p.trim()).filter(Boolean);
      onChange([...head, title].join(", "));
    } else onChange(title);
    setItems([]);
    setOpen(false);
  };

  const show = open && current.length >= 2 && items.length > 0;
  return (
    <div className="relative w-full">
      <input
        id={id}
        name={name}
        className={className}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(items[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {show && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-2xl border border-white/[0.08] bg-night-2 p-1 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          {items.map((t, i) => (
            <li key={t} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${i === active ? "bg-white/[0.1] text-white" : "text-white/80 hover:bg-white/[0.06] hover:text-white"}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(t)}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
