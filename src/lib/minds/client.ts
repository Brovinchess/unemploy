import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { BUILDER_API, mindsMode } from "./config";
import { OAuthError, refreshTokens } from "./oauth";
import { mockMinds } from "./mock";

export type Attachment = { fileName: string; mimeType: string; extension: string; content: string };

// One chat message, newest first from history().
export type ChatMessage = { fromMind: boolean; text: string; at: Date };
// One hourly bucket of billed work for one tool (the Hello Minds "ledger").
export type ToolUse = { tool: string; at: Date; calls: number; cognition: number };

export interface MindsApi {
  isNameAvailable(name: string): Promise<boolean>;
  awaken(archetype: string, mindName: string): Promise<{ mindId: string; name: string }>;
  getBalance(mindId: string): Promise<number>;
  createConversation(alias: string, mindId: string): Promise<void>;
  sendMessage(alias: string, text: string, attachments?: Attachment[]): Promise<void>;
  beacon(mindId: string, note: string): Promise<void>;
  setEnabled(mindId: string, enabled: boolean): Promise<void>;
  history(alias: string, limit?: number): Promise<ChatMessage[]>;
  toolUsage(mindId: string, since: Date): Promise<ToolUse[]>;
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

// Tokens are stored encrypted (see lib/crypto). Refresh tokens rotate on every use, so two
// concurrent refreshes would leave one holder with a dead token: refresh inside a
// transaction that locks the user's row, which serializes it across server instances.
async function accessTokenFor(user: User): Promise<string> {
  const fresh = (u: User) => !!u.accessToken && !!u.tokenExpiresAt && u.tokenExpiresAt.getTime() - Date.now() > 60_000;
  if (fresh(user)) return decrypt(user.accessToken!);

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(schema.users).where(eq(schema.users.id, user.id)).for("update");
    if (!current?.refreshToken) throw new LoginExpiredError();
    // Another request may have refreshed while we waited for the lock.
    if (fresh(current)) return decrypt(current.accessToken!);
    try {
      const t = await refreshTokens(decrypt(current.refreshToken));
      await tx
        .update(schema.users)
        .set({
          accessToken: encrypt(t.accessToken),
          refreshToken: encrypt(t.refreshToken),
          tokenExpiresAt: new Date(Date.now() + t.expiresIn * 1000),
          scope: t.scope ?? current.scope,
        })
        .where(eq(schema.users.id, user.id));
      return t.accessToken;
    } catch (e) {
      if (e instanceof OAuthError && e.isDeadLogin) throw new LoginExpiredError();
      throw e;
    }
  });
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
    async history(alias, limit = 30) {
      const rows = await call<{ senderType: number; messageText?: string; createdAt: string }[]>(
        "GET",
        `/v1/messaging/histories/${encodeURIComponent(alias)}?limit=${limit}`,
      );
      return (Array.isArray(rows) ? rows : []).map((r) => ({
        fromMind: r.senderType === 0,
        text: r.messageText ?? "",
        at: new Date(r.createdAt),
      }));
    },
    async toolUsage(mindId, since) {
      const q = new URLSearchParams({ interval: "hour", startTime: since.toISOString(), endTime: new Date().toISOString() });
      const r = await call<{ timeline?: { tool: string; timeBucket: string; callCount: number; creditsUsed: number }[] }>(
        "GET",
        `/v1/minds/${mindId}/cognition/usage-by-tool?${q}`,
      );
      return (r.timeline ?? []).map((t) => ({ tool: t.tool, at: new Date(t.timeBucket), calls: t.callCount, cognition: t.creditsUsed }));
    },
  };
}

export function minds(user: User): MindsApi {
  return mindsMode === "live" ? liveMinds(user) : mockMinds;
}
