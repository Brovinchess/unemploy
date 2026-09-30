import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const newIngestKey = () => `uk_${randomBytes(24).toString("base64url")}`;
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
