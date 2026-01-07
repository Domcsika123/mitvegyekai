// src/services/partnerService.ts

import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface WidgetTheme {
  bubble_bg?: string;
  bubble_text?: string;

  panel_bg?: string;
  panel_text?: string;

  button_bg?: string;
  button_text?: string;

  accent?: string;

  // opcionális finomhangolások
  header_grad_start?: string;
  header_grad_end?: string;
}

export interface WidgetConfig {
  // felhő
  bubble_texts?: string[];

  // panel header
  panel_title?: string;
  panel_subtitle?: string;

  // input placeholderok
  interest_placeholder?: string; // mv-input-interests
  details_placeholder?: string; // mv-input-free-text

  // (opcionális) javaslatok későbbre
  interest_suggestions?: string[];

  theme?: WidgetTheme;
}

export interface Partner {
  id: string;
  name: string;
  site_key: string;
  api_key: string;
  created_at: string;
  blocked?: boolean;

  // ✅ ÚJ: megengedett domain lista (CORS whitelist)
  allowed_domains?: string[];

  // ✅ ÚJ: widget config per partner/katalógus
  widget_config?: WidgetConfig;
}

// ✅ Render persistent disk támogatás
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
const PARTNERS_FILE = path.join(DATA_DIR, "partners.json");

let partners: Partner[] = [];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function normalizeDomain(raw: any): string {
  let s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";

  s = s.replace(/^https?:\/\//, "");
  s = s.split("/")[0];
  s = s.split(":")[0];

  // www-t nem erőltetjük, csak maradjon, ha ott van
  return s.trim();
}

function normalizeDomainList(domains: any): string[] {
  if (!domains) return [];
  const arr = Array.isArray(domains) ? domains : [domains];
  const out = arr.map(normalizeDomain).filter(Boolean);
  return Array.from(new Set(out));
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateApiKey(): string {
  return crypto.randomBytes(24).toString("hex");
}

function generateSiteKey(baseName: string): string {
  const base = slugifyName(baseName) || "partner";
  let candidate = base;
  let counter = 2;

  while (partners.some((p) => p.site_key === candidate)) {
    candidate = `${base}-${counter}`;
    counter++;
  }

  return candidate;
}

export function buildDefaultWidgetConfig(siteKey: string): WidgetConfig {
  // ✅ Ez legyen az "eredeti" alap design (kék felhő),
  // és új katalógus/partner esetén is ezt kapja.
  return {
    bubble_texts: [
    "Dönts könnyebben.",
    "Ne vacillálj! Segítek!",
    "Ez a tuti. Nyomd meg!",
    "Egy kattintás és kész!",
    "Könnyebb így.",
    "Ne vacillálj, megoldjuk.",
    "Kattints, és kész.",
    "Kíváncsi vagy? Katt!",
    "Ez a segítség amire vártál!",
    "Itt kezdődik a jó döntés.",
    ],
    panel_title: "Termékajánló",
    panel_subtitle: "Pár adat alapján mutatok jó találatokat",
    interest_placeholder: `pl. futás, tech, kávé, fotózás (${siteKey})`,
    details_placeholder: "pl. szereti a praktikus dolgokat, kütyüket, sportot...",
    interest_suggestions: [],
    theme: {
      bubble_bg: "#3b82f6",
      bubble_text: "#ffffff",
      panel_bg: "#ffffff",
      panel_text: "#0F172A",
      button_bg: "#6366F1",
      button_text: "#ffffff",
      accent: "#6366F1",
      header_grad_start: "#6366F1",
      header_grad_end: "#3B82F6",
    },
  };
}

function sanitizeHexColor(v: any, fallback: string): string {
  const s = String(v ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s) || /^#[0-9a-fA-F]{3}$/.test(s)) return s;
  return fallback;
}

function normalizeWidgetConfig(siteKey: string, raw: any): WidgetConfig {
  const def = buildDefaultWidgetConfig(siteKey);

  const bubble_texts = Array.isArray(raw?.bubble_texts)
    ? raw.bubble_texts.map((x: any) => String(x || "").trim()).filter(Boolean)
    : def.bubble_texts;

  const themeRaw = raw?.theme || {};
  const defTheme = def.theme || {};

  const theme: WidgetTheme = {
    bubble_bg: sanitizeHexColor(themeRaw.bubble_bg, defTheme.bubble_bg || "#3b82f6"),
    bubble_text: sanitizeHexColor(themeRaw.bubble_text, defTheme.bubble_text || "#ffffff"),
    panel_bg: sanitizeHexColor(themeRaw.panel_bg, defTheme.panel_bg || "#ffffff"),
    panel_text: sanitizeHexColor(themeRaw.panel_text, defTheme.panel_text || "#0F172A"),
    button_bg: sanitizeHexColor(themeRaw.button_bg, defTheme.button_bg || "#6366F1"),
    button_text: sanitizeHexColor(themeRaw.button_text, defTheme.button_text || "#ffffff"),
    accent: sanitizeHexColor(themeRaw.accent, defTheme.accent || "#6366F1"),
    header_grad_start: sanitizeHexColor(
      themeRaw.header_grad_start,
      defTheme.header_grad_start || "#6366F1"
    ),
    header_grad_end: sanitizeHexColor(
      themeRaw.header_grad_end,
      defTheme.header_grad_end || "#3B82F6"
    ),
  };

  return {
    bubble_texts,
    panel_title: String(raw?.panel_title ?? def.panel_title ?? "Termékajánló"),
    panel_subtitle: String(raw?.panel_subtitle ?? def.panel_subtitle ?? ""),
    interest_placeholder: String(raw?.interest_placeholder ?? def.interest_placeholder ?? ""),
    details_placeholder: String(raw?.details_placeholder ?? def.details_placeholder ?? ""),
    interest_suggestions: Array.isArray(raw?.interest_suggestions)
      ? raw.interest_suggestions.map((x: any) => String(x || "").trim()).filter(Boolean)
      : (def.interest_suggestions || []),
    theme,
  };
}

/** partners.json mentése lemezre. */
function saveToDisk() {
  ensureDataDir();
  try {
    fs.writeFileSync(PARTNERS_FILE, JSON.stringify(partners, null, 2), "utf8");
  } catch (err) {
    console.error("[partnerService] Hiba a partners.json írása közben:", err);
  }
}

/** ✅ ÚJ: ha hiányzik a partner (pl. új katalógusnál), létrehozzuk alap widget_config-kal */
function ensurePartnerExists(siteKey: string, nameHint?: string): Partner {
  partners = loadFromDisk();

  const key = String(siteKey || "").trim();
  if (!key) {
    // sose kéne ide jutni, de legyen stabil
    const fallback = createPartner(nameHint || "Partner");
    return fallback;
  }

  const existing = partners.find((p) => p.site_key === key);
  if (existing) {
    // ha bármi hiányos, normalizáljuk és visszamentjük
    const before = JSON.stringify(existing.widget_config || null);
    existing.widget_config = normalizeWidgetConfig(existing.site_key, existing.widget_config || {});
    const after = JSON.stringify(existing.widget_config || null);
    if (before !== after) saveToDisk();
    return existing;
  }

  const partner: Partner = {
    id: crypto.randomUUID ? crypto.randomUUID() : `partner_${Date.now()}`,
    name: String(nameHint || key).trim() || key,
    site_key: key,
    api_key: generateApiKey(),
    created_at: new Date().toISOString(),
    blocked: false,
    allowed_domains: [],
    widget_config: buildDefaultWidgetConfig(key), // ✅ default kék
  };

  partners.push(partner);
  saveToDisk();

  console.log(`[partnerService] Partner auto-létrehozva site_key alapján: site_key="${partner.site_key}"`);
  return partner;
}

/** partners.json beolvasása lemezről (ha létezik). */
function loadFromDisk(): Partner[] {
  ensureDataDir();

  if (!fs.existsSync(PARTNERS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(PARTNERS_FILE, "utf8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      console.warn("[partnerService] partners.json nem tömb, üres listát használunk.");
      return [];
    }

    const now = new Date().toISOString();

    // ✅ ÚJ: migráció flag – ha valakinél hiányzik/hiányos a widget_config, visszamentjük
    let touched = false;

    const loaded: Partner[] = data.map((p: any, idx: number) => {
      const name = String(p.name ?? `Partner ${idx + 1}`);
      const site_key = String(p.site_key ?? slugifyName(name));
      const api_key = String(p.api_key ?? generateApiKey());
      const id =
        typeof p.id === "string" && p.id.length > 0
          ? p.id
          : crypto.randomUUID
          ? crypto.randomUUID()
          : `partner_${idx}_${Date.now()}`;

      const hadConfig = !!p.widget_config;

      // ✅ FONTOS: ha nincs mentett config, akkor is legyen default (ne szürke fallback)
      const widget_config = normalizeWidgetConfig(site_key, p.widget_config || {});

      if (!hadConfig) touched = true;

      return {
        id,
        name,
        site_key,
        api_key,
        created_at: String(p.created_at ?? p.createdAt ?? now),
        blocked: Boolean(p.blocked) || false,
        allowed_domains: normalizeDomainList(p.allowed_domains),
        widget_config,
      };
    });

    // ✅ ÚJ: ha migráltunk, mentsük vissza, hogy tartós legyen (ne csak memóriában legyen kék)
    if (touched) {
      partners = loaded;
      saveToDisk();
      console.log("[partnerService] Widget config migráció: hiányzó widget_config-ok pótolva és elmentve.");
    }

    return loaded;
  } catch (err) {
    console.error("[partnerService] Hiba a partners.json beolvasása közben:", err);
    return [];
  }
}

(function init() {
  partners = loadFromDisk();
  console.log(`[partnerService] Betöltött partnerek száma: ${partners.length}`);
})();

export function listPartners(): Partner[] {
  partners = loadFromDisk();
  return partners;
}

export function createPartner(name: string): Partner {
  partners = loadFromDisk();

  const trimmedName = name.trim();
  const site_key = generateSiteKey(trimmedName || "Partner");
  const api_key = generateApiKey();

  const partner: Partner = {
    id: crypto.randomUUID ? crypto.randomUUID() : `partner_${Date.now()}`,
    name: trimmedName || site_key,
    site_key,
    api_key,
    created_at: new Date().toISOString(),
    blocked: false,
    allowed_domains: [],
    // ✅ ÚJ partner = alap (kék) widget_config, így nem lesz szürke felhő
    widget_config: buildDefaultWidgetConfig(site_key),
  };

  partners.push(partner);
  saveToDisk();

  console.log(
    `[partnerService] Új partner létrehozva: name="${partner.name}", site_key="${partner.site_key}"`
  );

  return partner;
}

export function findPartnerBySiteKey(siteKey: string): Partner | null {
  partners = loadFromDisk();

  const key = (siteKey || "").trim();
  if (!key) return null;

  return partners.find((p) => p.site_key === key) || null;
}

export function findPartnerByApiKey(apiKey: string): Partner | null {
  partners = loadFromDisk();

  const key = (apiKey || "").trim();
  if (!key) return null;

  return partners.find((p) => p.api_key === key) || null;
}

export function setPartnerBlocked(siteKey: string, blocked: boolean): Partner | null {
  partners = loadFromDisk();

  const key = (siteKey || "").trim();
  if (!key) return null;

  const partner = partners.find((p) => p.site_key === key);
  if (!partner) return null;

  partner.blocked = blocked;
  saveToDisk();

  console.log(
    `[partnerService] Partner blokkolt státusz módosítva: site_key="${partner.site_key}", blocked=${blocked}`
  );

  return partner;
}

/** ✅ allowed domains mentése */
export function setPartnerAllowedDomains(siteKey: string, domains: any): Partner | null {
  partners = loadFromDisk();

  const key = (siteKey || "").trim();
  if (!key) return null;

  const partner = partners.find((p) => p.site_key === key);
  if (!partner) return null;

  partner.allowed_domains = normalizeDomainList(domains);
  saveToDisk();

  console.log(
    `[partnerService] allowed_domains frissítve: site_key="${partner.site_key}", count=${partner.allowed_domains.length}`
  );

  return partner;
}

/** ✅ API kulcs rotálás */
export function rotatePartnerApiKey(siteKey: string): Partner | null {
  partners = loadFromDisk();

  const key = (siteKey || "").trim();
  if (!key) return null;

  const partner = partners.find((p) => p.site_key === key);
  if (!partner) return null;

  partner.api_key = generateApiKey();
  saveToDisk();

  console.log(`[partnerService] API key rotálva: site_key="${partner.site_key}"`);
  return partner;
}

export function deletePartner(siteKey: string): boolean {
  partners = loadFromDisk();

  const key = (siteKey || "").trim();
  if (!key) return false;

  const idx = partners.findIndex((p) => p.site_key === key);
  if (idx === -1) return false;

  const removed = partners[idx];
  partners.splice(idx, 1);
  saveToDisk();

  console.log(
    `[partnerService] Partner törölve: name="${removed.name}", site_key="${removed.site_key}"`
  );

  return true;
}

// ===================== WIDGET CONFIG API (ADMIN + PUBLIC) =====================

export function getPartnerWidgetConfig(siteKey: string): WidgetConfig | null {
  partners = loadFromDisk();
  const p = partners.find((x) => x.site_key === (siteKey || "").trim());
  if (!p) return null;

  // ✅ mindig legyen mit visszaadni (default is)
  return p.widget_config || normalizeWidgetConfig((siteKey || "").trim(), {});
}

export function setPartnerWidgetConfig(siteKey: string, config: any): Partner | null {
  // ✅ ÚJ: ha nincs partner, csinálunk (így új katalógusnál is biztosan lesz menthető config)
  const ensured = ensurePartnerExists(siteKey, siteKey);

  partners = loadFromDisk();

  const key = (siteKey || "").trim();
  if (!key) return null;

  const partner = partners.find((p) => p.site_key === key);
  if (!partner) return ensured; // fallback

  // ✅ normalizáljuk, hogy ne tudjon szétesni
  partner.widget_config = normalizeWidgetConfig(key, config || {});
  saveToDisk();

  console.log(`[partnerService] widget_config mentve: site_key="${partner.site_key}"`);
  return partner;
}

export function clearPartnerWidgetConfig(siteKey: string): Partner | null {
  // ✅ ÚJ: ha nincs partner, csinálunk defaulttal
  const ensured = ensurePartnerExists(siteKey, siteKey);

  partners = loadFromDisk();

  const key = (siteKey || "").trim();
  if (!key) return null;

  const partner = partners.find((p) => p.site_key === key);
  if (!partner) return ensured;

  // ✅ reset = default (kék), ne "üres" (szürke fallback)
  partner.widget_config = buildDefaultWidgetConfig(key);
  saveToDisk();

  console.log(`[partnerService] widget_config reset default-ra: site_key="${partner.site_key}"`);
  return partner;
}

// ✅ Partner belépéshez (site_key + api_key)
export function authenticatePartner(siteKey: string, apiKey: string): Partner | null {
  const p = findPartnerBySiteKey(siteKey);
  if (!p) return null;

  if (p.blocked) return null;

  const provided = String(apiKey || "").trim();
  if (!provided) return null;

  // egyszerű összehasonlítás (mivel jelenleg plain textben van az api_key)
  if (String(p.api_key || "").trim() !== provided) return null;

  return p;
}

