"use client";

import { useCallback, useEffect, useState } from "react";

// Talks to the Career Ninja Chrome extension through its script on our pages.
export type ExtensionStatus = {
  installed: boolean;
  connected: boolean;
  supported?: number; // To-apply jobs on sites the extension can fill
  detailsComplete?: boolean;
  running?: boolean;
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
    const r = await ask<ExtensionStatus>("hello");
    setStatus({ installed: true, connected: !!r?.connected, supported: r?.supported, detailsComplete: r?.detailsComplete, running: r?.running });
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

  return { status, refresh, connect, applyAll };
}
