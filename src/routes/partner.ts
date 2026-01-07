// src/routes/partner.ts
import { Router } from "express";
import { authenticatePartner } from "../services/partnerService";
import { getStatsForSite } from "../services/statsService";
import { createFeedback, listFeedbackForSite } from "../services/feedbackService";
import { createPartnerToken, partnerAuth } from "../middleware/partnerAuth";

const router = Router();

/**
 * POST /api/partner/login
 * body: { site_key, api_key }
 * resp: { ok, token, expires_in, site_key, name }
 */
router.post("/login", (req, res) => {
  try {
    const { site_key, api_key } = req.body || {};
    if (!site_key || !api_key) {
      return res.status(400).json({ error: "site_key és api_key kötelező." });
    }

    const partner = authenticatePartner(String(site_key), String(api_key));
    if (!partner) return res.status(401).json({ error: "Hibás site_key / api_key vagy blokkolva." });

    const { token, expires_in } = createPartnerToken(partner.site_key);
    return res.json({ ok: true, token, expires_in, site_key: partner.site_key, name: partner.name });
  } catch (err) {
    console.error("Hiba a /api/partner/login hívásban:", err);
    return res.status(500).json({ error: "Szerver hiba partner login közben." });
  }
});

// --- védett végpontok ---
router.get("/stats", partnerAuth, (req, res) => {
  try {
    const siteKey = String((req as any).partnerSiteKey || "").trim();
    const stats = getStatsForSite(siteKey);

    // ha nincs még stat, adjunk vissza üreset
    return res.json({
      ok: true,
      siteKey,
      stats: stats || {
        siteKey,
        totalRequests: 0,
        lastRequestAt: undefined,
        dailyCounts: [],
        interestsCount: {},
        priceBuckets: { "0-5000": 0, "5001-10000": 0, "10001-20000": 0, "20001+": 0 },
        freeTextCount: {},
        genderCount: {},
        relationshipCount: {},
      },
    });
  } catch (err) {
    console.error("Hiba a /api/partner/stats hívásban:", err);
    return res.status(500).json({ error: "Nem sikerült lekérni a statisztikát." });
  }
});

router.post("/feedback", partnerAuth, (req, res) => {
  try {
    const siteKey = String((req as any).partnerSiteKey || "").trim();
    const item = createFeedback(siteKey, req.body || {});
    return res.json({ ok: true, item });
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.includes("kötelező")) return res.status(400).json({ error: msg });
    console.error("Hiba a /api/partner/feedback hívásban:", err);
    return res.status(500).json({ error: "Nem sikerült elmenteni a bejelentést." });
  }
});

router.get("/feedback", partnerAuth, (req, res) => {
  try {
    const siteKey = String((req as any).partnerSiteKey || "").trim();
    const items = listFeedbackForSite(siteKey).slice(0, 30);
    return res.json({ ok: true, siteKey, items });
  } catch (err) {
    console.error("Hiba a /api/partner/feedback (GET) hívásban:", err);
    return res.status(500).json({ error: "Nem sikerült lekérni a bejelentéseket." });
  }
});

export default router;
