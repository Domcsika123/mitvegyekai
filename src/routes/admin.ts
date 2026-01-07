// src/routes/admin.ts
import { Router } from "express";
import { listCatalogs, replaceCatalog, deleteCatalog } from "../services/productService";
import { getAllStats } from "../services/statsService";
import { Product } from "../models/Product";
import { embedProductsInBatches } from "../ai/embeddings";
import { listAllFeedback, updateFeedback } from "../services/feedbackService";
import {
  createPartner,
  listPartners,
  deletePartner,
  findPartnerBySiteKey,
  setPartnerBlocked,
  setPartnerAllowedDomains,
  rotatePartnerApiKey,
  // ✅ ÚJ: widget config
  getPartnerWidgetConfig,
  setPartnerWidgetConfig,
  clearPartnerWidgetConfig,
} from "../services/partnerService";

const router = Router();

/* ---------- KATALÓGUSOK ---------- */

router.get("/catalogs", (req, res) => {
  try {
    const catalogs = listCatalogs();
    return res.json({ catalogs });
  } catch (err) {
    console.error("Hiba a /api/admin/catalogs hívásban:", err);
    return res.status(500).json({ error: "Nem sikerült lekérni a katalógusokat." });
  }
});

router.post("/import-products", async (req, res) => {
  try {
    const { site_key, items } = req.body || {};

    if (!site_key || typeof site_key !== "string") {
      return res.status(400).json({ error: "site_key kötelező és string legyen." });
    }

    const partner = findPartnerBySiteKey(site_key);
    if (!partner) {
      return res.status(400).json({ error: `Nincs ilyen partner vagy site_key: ${site_key}` });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items tömb szükséges." });
    }

    const products: Product[] = [];

    for (const raw of items) {
      if (!raw) continue;

      const p: Product = {
        product_id: String(raw.product_id || "").trim(),
        name: String(raw.name || "").trim(),
        price: Number(raw.price ?? 0),
        category: String(raw.category || "").trim(),
        description: String(raw.description || "").trim(),
        image_url: raw.image_url ? String(raw.image_url) : undefined,
        product_url: raw.product_url ? String(raw.product_url) : undefined,
      };

      if (!p.product_id || !p.name) {
        return res.status(400).json({ error: "Minden terméknek kell product_id és name mező." });
      }

      if (Number.isNaN(p.price)) {
        return res.status(400).json({ error: `Érvénytelen price érték a terméknél: ${p.product_id}` });
      }

      products.push(p);
    }

    const batchSize = Number(process.env.EMBED_BATCH_SIZE || 64) || 64;

    let productsWithEmbeddings: Product[] = [];
    try {
      productsWithEmbeddings = await embedProductsInBatches(products, batchSize);
    } catch (e) {
      console.error("Embedding generálási hiba importkor:", e);
      return res.status(500).json({
        error: "Embedding generálás hiba. Ellenőrizd az OPENAI_API_KEY-t és próbáld újra.",
      });
    }

    replaceCatalog(site_key, productsWithEmbeddings, true);

    const embeddedCount = productsWithEmbeddings.filter((p: any) => Array.isArray(p.embedding)).length;

    return res.json({
      ok: true,
      site_key,
      count: productsWithEmbeddings.length,
      embedded: embeddedCount,
      batchSize,
    });
  } catch (err) {
    console.error("Hiba a /api/admin/import-products hívásban:", err);
    return res.status(500).json({ error: "Hiba történt az import során a szerveren." });
  }
});

router.delete("/catalogs/:site_key", (req, res) => {
  try {
    const { site_key } = req.params;
    if (!site_key) return res.status(400).json({ error: "site_key kötelező." });

    // katalógus törlés
    deleteCatalog(site_key);

    // ✅ ha van hozzá partner, reseteljük a widget szerkesztéseket is (default kék)
    const p = findPartnerBySiteKey(site_key);
    if (p) {
      clearPartnerWidgetConfig(site_key);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Hiba a /api/admin/catalogs/:site_key (DELETE) hívásban:", err);
    return res.status(500).json({ error: "Hiba történt a katalógus törlése során." });
  }
});


/* ---------- STATISZTIKA ---------- */

router.get("/stats", (req, res) => {
  try {
    const stats = getAllStats();
    return res.json({ stats });
  } catch (err) {
    console.error("Hiba a /api/admin/stats hívásban:", err);
    return res.status(500).json({ error: "Nem sikerült lekérni a statisztikákat." });
  }
});

/* ---------- PARTNEREK ---------- */

router.get("/partners", (req, res) => {
  try {
    const partners = listPartners();
    return res.json({ partners });
  } catch (err) {
    console.error("Hiba a /api/admin/partners (GET) hívásban:", err);
    return res.status(500).json({ error: "Nem sikerült lekérni a partnereket." });
  }
});

router.post("/partners", (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "A partner neve (name) kötelező." });
    }

    const partner = createPartner(name);
    return res.json({ partner });
  } catch (err) {
    console.error("Hiba a /api/admin/partners (POST) hívásban:", err);
    return res.status(500).json({ error: "Hiba történt a partner létrehozásakor." });
  }
});

router.post("/partners/:site_key/block", (req, res) => {
  try {
    const { site_key } = req.params;
    const { blocked } = req.body || {};

    if (!site_key) return res.status(400).json({ error: "Hiányzik a site_key paraméter." });
    if (typeof blocked !== "boolean") {
      return res.status(400).json({ error: "blocked mező kötelező és boolean legyen." });
    }

    const partner = setPartnerBlocked(site_key, blocked);
    if (!partner) return res.status(404).json({ error: "Nincs ilyen partner." });

    return res.json({ ok: true, partner });
  } catch (err) {
    console.error("Hiba a /api/admin/partners/:site_key/block hívásban:", err);
    return res.status(500).json({ error: "Hiba történt a blokkolás során." });
  }
});

router.post("/partners/:site_key/allowed-domains", (req, res) => {
  try {
    const { site_key } = req.params;
    const { allowed_domains } = req.body || {};

    if (!site_key) return res.status(400).json({ error: "Hiányzik a site_key paraméter." });

    const partner = setPartnerAllowedDomains(site_key, allowed_domains);
    if (!partner) return res.status(404).json({ error: "Nincs ilyen partner." });

    return res.json({ ok: true, partner });
  } catch (err) {
    console.error("Hiba a /api/admin/partners/:site_key/allowed-domains hívásban:", err);
    return res.status(500).json({ error: "Hiba történt az allowed domains mentésekor." });
  }
});

router.post("/partners/:site_key/rotate-key", (req, res) => {
  try {
    const { site_key } = req.params;
    if (!site_key) return res.status(400).json({ error: "Hiányzik a site_key paraméter." });

    const partner = rotatePartnerApiKey(site_key);
    if (!partner) return res.status(404).json({ error: "Nincs ilyen partner." });

    return res.json({ ok: true, partner });
  } catch (err) {
    console.error("Hiba a /api/admin/partners/:site_key/rotate-key hívásban:", err);
    return res.status(500).json({ error: "Hiba történt az API key rotálás során." });
  }
});

router.delete("/partners/:site_key", (req, res) => {
  try {
    const { site_key } = req.params;
    if (!site_key) return res.status(400).json({ error: "Hiányzik a site_key paraméter." });

    const ok = deletePartner(site_key);
    if (!ok) return res.status(404).json({ error: "Nincs ilyen partner." });

    deleteCatalog(site_key);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Hiba a /api/admin/partners/:site_key (DELETE) hívásban:", err);
    return res.status(500).json({ error: "Hiba történt a törlés során." });
  }
});

router.get("/partners/:site_key", (req, res) => {
  try {
    const { site_key } = req.params;
    const partner = findPartnerBySiteKey(site_key);

    if (!partner) return res.status(404).json({ error: "Nincs ilyen partner." });

    return res.json({ partner });
  } catch (err) {
    console.error("Hiba a /api/admin/partners/:site_key (GET, detail) hívásban:", err);
    return res.status(500).json({ error: "Hiba történt a partner lekérdezésekor." });
  }
});

/* ---------- ✅ WIDGET CONFIG (ADMIN) ---------- */

// lekérés
router.get("/widget-config/:site_key", (req, res) => {
  try {
    const { site_key } = req.params;
    if (!site_key) return res.status(400).json({ error: "Hiányzik a site_key paraméter." });

    const partner = findPartnerBySiteKey(site_key);
    if (!partner) return res.status(404).json({ error: "Nincs ilyen partner." });

    const widget_config = getPartnerWidgetConfig(site_key);
    return res.json({ ok: true, site_key, widget_config });
  } catch (err) {
    console.error("Hiba a /api/admin/widget-config/:site_key (GET) hívásban:", err);
    return res.status(500).json({ error: "Hiba történt a widget config lekérésekor." });
  }
});

// mentés
router.post("/widget-config/:site_key", (req, res) => {
  try {
    const { site_key } = req.params;
    if (!site_key) return res.status(400).json({ error: "Hiányzik a site_key paraméter." });

    const partner = findPartnerBySiteKey(site_key);
    if (!partner) return res.status(404).json({ error: "Nincs ilyen partner." });

    const { widget_config } = req.body || {};
    const updated = setPartnerWidgetConfig(site_key, widget_config);

    if (!updated) return res.status(404).json({ error: "Nincs ilyen partner." });

    return res.json({ ok: true, site_key, partner: updated });
  } catch (err) {
    console.error("Hiba a /api/admin/widget-config/:site_key (POST) hívásban:", err);
    return res.status(500).json({ error: "Hiba történt a widget config mentésekor." });
  }
});

// reset (opcionális)
router.post("/widget-config/:site_key/reset", (req, res) => {
  try {
    const { site_key } = req.params;
    if (!site_key) return res.status(400).json({ error: "Hiányzik a site_key paraméter." });

    const partner = findPartnerBySiteKey(site_key);
    if (!partner) return res.status(404).json({ error: "Nincs ilyen partner." });

    const updated = clearPartnerWidgetConfig(site_key);
    if (!updated) return res.status(404).json({ error: "Nincs ilyen partner." });

    return res.json({ ok: true, site_key, partner: updated });
  } catch (err) {
    console.error("Hiba a /api/admin/widget-config/:site_key/reset (POST) hívásban:", err);
    return res.status(500).json({ error: "Hiba történt a widget config reset során." });
  }
});

/* ---------- ✅ BEJELENTÉSEK / FEEDBACK (ADMIN) ---------- */

router.get("/feedback", (req, res) => {
  try {
    const { status, site_key } = req.query || {};
    let items = listAllFeedback();

    if (status && typeof status === "string") {
      items = items.filter((x) => x.status === status);
    }
    if (site_key && typeof site_key === "string") {
      items = items.filter((x) => x.site_key === site_key);
    }

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("Hiba a /api/admin/feedback (GET) hívásban:", err);
    return res.status(500).json({ error: "Nem sikerült lekérni a bejelentéseket." });
  }
});

router.patch("/feedback/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Hiányzik az id." });

    const updated = updateFeedback(id, req.body || {});
    if (!updated) return res.status(404).json({ error: "Nincs ilyen bejelentés." });

    return res.json({ ok: true, item: updated });
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.includes("Érvénytelen")) return res.status(400).json({ error: msg });

    console.error("Hiba a /api/admin/feedback/:id (PATCH) hívásban:", err);
    return res.status(500).json({ error: "Nem sikerült menteni a módosítást." });
  }
});


export default router;
