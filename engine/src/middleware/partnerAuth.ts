// src/middleware/partnerAuth.ts
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const SECRET = process.env.PARTNER_TOKEN_SECRET || "CHANGE_ME_PARTNER_TOKEN_SECRET";
const DEFAULT_EXPIRES_SEC = Number(process.env.PARTNER_TOKEN_EXPIRES_SEC || 60 * 60 * 24 * 7); // 7 nap

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

function sign(data: string) {
  return b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
}

export type PartnerTokenPayload = {
  site_key: string;
  exp: number; // unix seconds
};

export function createPartnerToken(site_key: string, expiresInSec = DEFAULT_EXPIRES_SEC) {
  const payload: PartnerTokenPayload = {
    site_key,
    exp: Math.floor(Date.now() / 1000) + Math.max(60, expiresInSec),
  };
  const p = b64url(JSON.stringify(payload));
  const sig = sign(p);
  return { token: `${p}.${sig}`, expires_in: expiresInSec };
}

export function verifyPartnerToken(token: string): PartnerTokenPayload | null {
  const t = String(token || "").trim();
  const parts = t.split(".");
  if (parts.length !== 2) return null;

  const [p, sig] = parts;
  const expected = sign(p);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(b64urlDecode(p));
    if (!payload?.site_key || !payload?.exp) return null;
    if (Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
    return payload as PartnerTokenPayload;
  } catch {
    return null;
  }
}

export function partnerAuth(req: Request, res: Response, next: NextFunction) {
  const auth = String(req.headers.authorization || "");
  let token = "";

  if (auth.toLowerCase().startsWith("bearer ")) token = auth.slice(7).trim();
  if (!token && req.headers["x-partner-token"]) token = String(req.headers["x-partner-token"]);

  if (!token) return res.status(401).json({ error: "Hiányzó partner token." });

  const payload = verifyPartnerToken(token);
  if (!payload) return res.status(401).json({ error: "Érvénytelen vagy lejárt token." });

  (req as any).partnerSiteKey = payload.site_key;
  next();
}
