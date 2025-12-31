// src/routes/recommend.ts
import { Router } from "express";
import { getProductsForSite } from "../services/productService";
import { rankProductsWithEmbeddings } from "../ai/embeddings";
import { rerankWithLLM } from "../ai/rerank";
import { filterProductsByRules } from "../ai/rules";
import { UserContext } from "../models/UserContext";
import { recordRecommendation } from "../services/statsService";
import { findPartnerByApiKey } from "../services/partnerService";

const router = Router();

function toNumberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function normalizeGender(g: any): "male" | "female" | "other" | "unknown" {
  const v = (typeof g === "string" ? g.trim().toLowerCase() : "");
  if (v === "male" || v === "female" || v === "other" || v === "unknown") return v;
  return "unknown";
}

// Elfogadjuk mindkét header nevet (régi + widget)
function getApiKeyFromReq(req: any): string {
  const h1 = req.headers["x-api-key"];
  const h2 = req.headers["x-mv-api-key"];
  const raw = (typeof h1 === "string" && h1) || (typeof h2 === "string" && h2) || "";
  return raw.trim();
}

// ----- CORS (partner allowed_domains alapján) -----

function getOriginHost(origin: string): string {
  try {
    const u = new URL(origin);
    return (u.hostname || "").toLowerCase();
  } catch {
    return "";
  }
}

function domainMatches(host: string, allowed: string): boolean {
  const a = (allowed || "").trim().toLowerCase();
  if (!a) return false;
  if (host === a) return true;
  // engedjük a subdomaineket is, ha a listában "shop1.hu" szerepel
  return host.endsWith("." + a);
}

function isOriginAllowedForPartner(origin: string, partner: any): boolean {
  const host = getOriginHost(origin);
  if (!host) return false;

  const list = Array.isArray(partner?.allowed_domains) ? partner.allowed_domains : [];

  // ✅ ha nincs lista megadva, nem törjük el a rendszert (backward-compatible)
  // ha STRICT-et akarsz: itt return false; és akkor kötelező a lista.
  if (list.length === 0) return true;

  return list.some((d: string) => domainMatches(host, String(d)));
}

function applyCors(res: any, origin: string) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-mv-api-key, x-api-key"
  );
}

// ----- Rate limit (site_key alapján) -----

type Bucket = { timestamps: number[] };
const buckets: Record<string, Bucket> = {};

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000) || 60_000;
const RECOMMEND_MAX = Number(process.env.RATE_LIMIT_RECOMMEND_MAX || 60) || 60;
const STATUS_MAX = Number(process.env.RATE_LIMIT_STATUS_MAX || 120) || 120;

function hitRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const k = key || "unknown";

  if (!buckets[k]) buckets[k] = { timestamps: [] };

  buckets[k].timestamps = buckets[k].timestamps.filter((t) => t >= cutoff);

  if (buckets[k].timestamps.length >= limit) return true;

  buckets[k].timestamps.push(now);
  return false;
}

// ----- site_key / partner resolve -----

/**
 * SZABÁLY:
 * - default katalógus mehet apiKey nélkül (demo)
 * - nem-default katalógus CSAK érvényes apiKey-vel
 * - ha partner blokkolva => tiltás
 * - ha apiKey-hez nincs partner (törölt) => tiltás
 */
function resolveSiteKeyOrBlock(req: any): { siteKey: string; blocked: boolean; partner: any | null } {
  const apiKey = getApiKeyFromReq(req);
  const body = req.body || {};

  const requestedSiteKey =
    typeof body.site_key === "string" && body.site_key.trim() !== ""
      ? body.site_key.trim()
      : "default";

  // Demo/default: engedjük apiKey nélkül
  if (requestedSiteKey === "default" && !apiKey) {
    return { siteKey: "default", blocked: false, partner: null };
  }

  // Nem defaulthoz KÖTELEZŐ apiKey
  if (!apiKey) {
    return { siteKey: "default", blocked: true, partner: null };
  }

  const partner = findPartnerByApiKey(apiKey);
  if (!partner) {
    return { siteKey: "default", blocked: true, partner: null };
  }

  if (partner.blocked) {
    return { siteKey: partner.site_key, blocked: true, partner };
  }

  return { siteKey: partner.site_key, blocked: false, partner };
}

/**
 * /partner-status esetén rate limit key (site_key)
 */
function resolveSiteKeyForStatus(req: any): { siteKey: string; partner: any | null } {
  const apiKey = getApiKeyFromReq(req);

  const requestedSiteKey =
    typeof req.query.site_key === "string" && req.query.site_key.trim() !== ""
      ? req.query.site_key.trim()
      : "default";

  if (!apiKey) {
    return { siteKey: requestedSiteKey, partner: null };
  }

  const partner = findPartnerByApiKey(apiKey);
  if (!partner) return { siteKey: requestedSiteKey, partner: null };

  return { siteKey: partner.site_key, partner };
}

// ----- OPTIONS (preflight) -----

router.options("/partner-status", (req, res) => {
  const origin = req.headers.origin as string | undefined;
  const apiKey = getApiKeyFromReq(req);
  const partner = apiKey ? findPartnerByApiKey(apiKey) : null;

  if (origin) {
    if (partner && !isOriginAllowedForPartner(origin, partner)) {
      return res.status(403).end();
    }
    applyCors(res, origin);
  }
  return res.status(204).end();
});

router.options("/recommend", (req, res) => {
  const origin = req.headers.origin as string | undefined;
  const apiKey = getApiKeyFromReq(req);
  const partner = apiKey ? findPartnerByApiKey(apiKey) : null;

  if (origin) {
    if (partner && !isOriginAllowedForPartner(origin, partner)) {
      return res.status(403).end();
    }
    applyCors(res, origin);
  }
  return res.status(204).end();
});

// ----- partner-status -----

/**
 * Widgetnek: megkérdezi, hogy megjelenhet-e
 * GET /api/partner-status
 * Header: x-mv-api-key (vagy x-api-key)
 */
router.get("/partner-status", (req, res) => {
  const origin = req.headers.origin as string | undefined;

  const apiKey = getApiKeyFromReq(req);
  const { siteKey, partner } = resolveSiteKeyForStatus(req);

  // ✅ CORS: ha böngészőből jön és partner van, ellenőrizzük
  if (origin && partner) {
    if (!isOriginAllowedForPartner(origin, partner)) {
      return res.status(403).json({ allowed: false, reason: "CORS_BLOCKED" });
    }
    applyCors(res, origin);
  } else if (origin && !partner) {
    // demo módnál is engedjük vissza ugyanarra az originre (különben a böngésző tilt)
    applyCors(res, origin);
  }

  // ✅ rate limit (siteKey alapján)
  if (hitRateLimit(`status:${siteKey}`, STATUS_MAX)) {
    return res.status(429).json({ allowed: false, reason: "RATE_LIMIT" });
  }

  // fontos: a widget most már küldi query-ben
  const requestedSiteKey =
    typeof req.query.site_key === "string" && req.query.site_key.trim() !== ""
      ? req.query.site_key.trim()
      : "default";

  // ✅ DEMO csak akkor oké, ha default (különben ne jelenjen meg a widget)
  if (!apiKey) {
    if (requestedSiteKey === "default") {
      return res.json({ allowed: true, mode: "demo" });
    }
    return res.json({ allowed: false, reason: "API_KEY_REQUIRED" });
  }

  const p = findPartnerByApiKey(apiKey);
  if (!p) return res.json({ allowed: false, reason: "INVALID_API_KEY" });
  if (p.blocked) return res.json({ allowed: false, reason: "PARTNER_BLOCKED" });

  return res.json({ allowed: true, site_key: p.site_key });
});

// ----- recommend -----

router.post("/recommend", async (req, res) => {
  const origin = req.headers.origin as string | undefined;

  try {
    const body = req.body || {};
    const { siteKey, blocked, partner } = resolveSiteKeyOrBlock(req);

    // ✅ CORS: ha böngészőből jön és partner van, ellenőrizzük
    if (origin && partner) {
      if (!isOriginAllowedForPartner(origin, partner)) {
        return res.status(403).json({ error: "CORS_BLOCKED" });
      }
      applyCors(res, origin);
    } else if (origin && !partner) {
      // demo/default esetén is engedjük vissza ugyanarra az originre
      applyCors(res, origin);
    }

    // ✅ rate limit (siteKey alapján)
    if (hitRateLimit(`recommend:${siteKey}`, RECOMMEND_MAX)) {
      return res.status(429).json({ error: "RATE_LIMIT" });
    }

    if (blocked) {
      return res.status(403).json({ error: "PARTNER_BLOCKED" });
    }

    const budgetMin = toNumberOrNull(body.budget_min);
    const budgetMax = toNumberOrNull(body.budget_max);
    const age = toNumberOrNull(body.age);

    const user: UserContext = {
      age: age ?? undefined,
      gender: normalizeGender(body.gender),
      budget_min: budgetMin ?? undefined,
      budget_max: budgetMax ?? undefined,
      relationship: (body.relationship as string) || undefined,
      interests: Array.isArray(body.interests)
        ? body.interests
        : typeof body.interests === "string" && body.interests.length > 0
        ? body.interests.split(",").map((x: string) => x.trim())
        : [],
      free_text: (body.free_text as string) || "",
      site_key: siteKey,
    };

    const allProducts = getProductsForSite(siteKey || "default");
    if (!allProducts || allProducts.length === 0) {
      return res.json({ items: [] });
    }

    const rankedByEmbedding = await rankProductsWithEmbeddings(user, allProducts);
    const topCandidates = rankedByEmbedding.slice(0, 20).map((r) => r.product);

    let afterRules = filterProductsByRules(user, topCandidates);
    if (afterRules.length === 0) {
      afterRules = topCandidates.slice(0, 10);
    }

    const finalRanked = await rerankWithLLM(user, afterRules);

    const items = finalRanked.map((r) => ({
      product_id: r.product.product_id,
      name: r.product.name,
      price: r.product.price,
      category: r.product.category,
      description: r.product.description,
      image_url: r.product.image_url,
      product_url: r.product.product_url,
      reason: r.reason,
    }));

    try {
      if (items.length > 0) {
        recordRecommendation(siteKey, user as any);
      }
    } catch (e) {
      console.error("Statisztika rögzítési hiba:", e);
    }

    return res.json({ items });
  } catch (err: any) {
    console.error("Hiba a recommend endpointban:", err);
    return res.status(500).json({ error: "Hiba történt az ajánlás során." });
  }
});

export default router;
