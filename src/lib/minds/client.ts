import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { BUILDER_API, mindsMode } from "./config";
import { OAuthError, refreshTokens } from "./oauth";
import { mockMinds } from "./mock";

export type Attachment = { fileName: string; mimeType: string; extension: string; content: string };

export interface MindsApi {
  isNameAvailable(name: string): Promise<boolean>;
  awaken(archetype: string, mindName: string): Promise<{ mindId: string; name: string }>;
  getBalance(mindId: string): Promise<number>;
  createConversation(alias: string, mindId: string): Promise<void>;
  sendMessage(alias: string, text: string, attachments?: Attachment[]): Promise<void>;
  beacon(mindId: string, note: string): Promise<void>;
  setEnabled(mindId: string, enabled: boolean): Promise<void>;
}

export class MindsApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    body: string,
  ) {
    super(`Hello Minds ${path} → ${status}: ${body.slice(0, 300)}`);
  }
}

export class LoginExpiredError extends Error {
  constructor() {
    super("Hello Minds login expired");
  }
}

// Refresh tokens rotate on every use, so two concurrent refreshes would leave one
// holder with a dead token. Serialize per user (single server process).
const refreshing = new Map<string, Promise<string>>();

async function accessTokenFor(user: User): Promise<string> {
  const fresh = user.tokenExpiresAt && user.tokenExpiresAt.getTime() - Date.now() > 60_000;
  if (user.accessToken && fresh) return user.accessToken;

  const pending = refreshing.get(user.id);
  if (pending) return pending;

  const run = (async () => {
    // Re-read: another request may already have refreshed.
    const current = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    if (!current?.refreshToken) throw new LoginExpiredError();
    if (current.accessToken && current.tokenExpiresAt && current.tokenExpiresAt.getTime() - Date.now() > 60_000) {
      return current.accessToken;
    }
    try {
      const t = await refreshTokens(current.refreshToken);
      await db
        .update(schema.users)
        .set({
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
          tokenExpiresAt: new Date(Date.now() + t.expiresIn * 1000),
          scope: t.scope ?? current.scope,
        })
        .where(eq(schema.users.id, user.id));
      return t.accessToken;
    } catch (e) {
      if (e instanceof OAuthError && e.isDeadLogin) throw new LoginExpiredError();
      throw e;
    }
  })();

  refreshing.set(user.id, run);
  try {
    return await run;
  } finally {
    refreshing.delete(user.id);
  }
}

function liveMinds(user: User): MindsApi {
  async function call<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) headers.Authorization = `Bearer ${await accessTokenFor(user)}`;
    const res = await fetch(`${BUILDER_API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) throw new MindsApiError(res.status, path, await res.text().catch(() => ""));
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  return {
    async isNameAvailable(name) {
      const r = await call<{ isAvailable: boolean }>(
        "GET",
        `/v1/minds/check/name?name=${encodeURIComponent(name)}`,
        undefined,
        false,
      );
      return r.isAvailable;
    },
    async awaken(archetype, mindName) {
      const r = await call<{ mindId: string; name?: string }>("POST", "/v1/minds/awaken", { id: archetype, mindName });
      return { mindId: r.mindId, name: r.name ?? mindName };
    },
    async getBalance(mindId) {
      const r = await call<{ swarm: number }>("GET", `/v1/minds/${mindId}/credits`);
      return r.swarm;
    },
    async createConversation(alias, mindId) {
      await call("POST", "/v1/messaging/conversation", { alias, mindId });
    },
    async sendMessage(alias, messageText, attachments) {
      await call("POST", "/v1/messaging/message", { alias, messageText, attachments });
    },
    async beacon(mindId, beacon) {
      await call("POST", `/v1/messaging/${mindId}/beacon`, { beacon, triggerImmediateCognition: true });
    },
    async setEnabled(mindId, isEnabled) {
      await call("PATCH", `/v1/minds/${mindId}`, { isEnabled });
    },
  };
}

export function minds(user: User): MindsApi {
  return mindsMode === "live" ? liveMinds(user) : mockMinds;
}
