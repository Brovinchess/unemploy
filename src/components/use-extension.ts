"use client";

import { useCallback, useEffect, useState } from "react";

// Talks to the Career Ninja Chrome extension through its script on our pages.
export type ExtensionStatus = {
  installed: boolean;
  connected: boolean;
  supported?: number; // To-apply jobs on sites the extension can fill
  detailsComplete?: boolean;
  running?: boolean;
  unreachable?: boolean;
  version?: string;
  needsUpdate?: boolean; // older than the app supports
  canApplyOne?: boolean; // 1.1.0 and up take a list of job ids
};

// "1.0.0" >= "0.9.5"
const atLeast = (v: string | undefined, min: string | undefined) => {
  if (!v || !min) return true;
  const a = v.split(".").map(Number), b = min.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return true;
};

function ask<T>(type: string, extra: Record<string, unknown> = {}, timeout = 4000): Promise<T | null> {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window || e.data?.source !== "careerninja-ext" || e.data.id !== id) return;
      window.removeEventListener("message", onMsg);
      resolve(e.data as T);
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ source: "careerninja-app", type, id, ...extra }, window.location.origin);
    setTimeout(() => {
      window.removeEventListener("message", onMsg);
      resolve(null);
    }, timeout);
  });
}

export const extensionInstalled = () => typeof document !== "undefined" && !!document.documentElement.dataset.careerNinjaExtension;

export function useExtension() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);

  const refresh = useCallback(async () => {
    if (!extensionInstalled()) return setStatus({ installed: false, connected: false });
    const r = await ask<ExtensionStatus & { minVersion?: string }>("hello");
    setStatus({
      installed: true,
      connected: !!r?.connected,
      unreachable: !!r?.unreachable,
      supported: r?.supported,
      detailsComplete: r?.detailsComplete,
      running: r?.running,
      version: r?.version,
      needsUpdate: !atLeast(r?.version, r?.minVersion),
      canApplyOne: !!r?.version && atLeast(r.version, "1.1.0"),
    });
  }, []);

  useEffect(() => {
    // The extension's page script marks the page at load; give it a moment.
    const t = setTimeout(refresh, 300);
    return () => clearTimeout(t);
  }, [refresh]);

  const connect = useCallback(
    async (token: string) => {
      await ask("connect", { token });
      await refresh();
    },
    [refresh],
  );

  const applyAll = useCallback(async () => ask<{ ok: boolean; reason?: string; count?: number }>("applyAll", {}, 15000), []);
  const applyOne = useCallback(async (id: string) => ask<{ ok: boolean; reason?: string; count?: number }>("applyAll", { ids: [id] }, 15000), []);

  return { status, refresh, connect, applyAll, applyOne };
}
