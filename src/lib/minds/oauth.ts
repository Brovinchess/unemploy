import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { OAUTH_API, OAUTH_SCOPES, mindsConfig, redirectUri } from "./config";

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope?: string;
};

const b64url = (buf: Buffer) => buf.toString("base64url");

export function createPkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(16));
  return { verifier, challenge, state };
}

export function loginUrl(challenge: string, state: string) {
  const url = new URL(`${OAUTH_API}/v2/oauth/login`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: mindsConfig.clientId,
    redirect_uri: redirectUri(),
    scope: OAUTH_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(`${OAUTH_API}/v2/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: mindsConfig.clientId, ...body }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new OAuthError(res.status, await res.text().catch(() => ""));
  }
  return res.json();
}

export class OAuthError extends Error {
  constructor(
    public status: number,
    body: string,
  ) {
    super(`Hello Minds OAuth ${status}: ${body.slice(0, 200)}`);
  }
  // 4xx other than 429 means the login is dead and the user must sign in again.
  get isDeadLogin() {
    return this.status >= 400 && this.status < 500 && this.status !== 429;
  }
}

export function exchangeCode(code: string, verifier: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
    code_verifier: verifier,
  });
}

export function refreshTokens(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function revoke(refreshToken: string) {
  await fetch(`${OAUTH_API}/v2/oauth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: refreshToken, client_id: mindsConfig.clientId }),
  }).catch(() => {});
}

// The access token is a JWT; `sub` is the Hello Minds user id.
export function tokenSubject(accessToken: string): string {
  const payload = accessToken.split(".")[1];
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!claims.sub) throw new Error("Access token has no sub");
  return String(claims.sub);
}
