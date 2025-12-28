// src/services/statsService.ts

import fs from "fs";
import path from "path";
import { UserContext } from "../models/UserContext";

export type DailyCount = {
  date: string; // 'YYYY-MM-DD'
  count: number;
};

export type PriceBucketKey = "0-5000" | "5001-10000" | "10001-20000" | "20001+";

export type SiteStats = {
  siteKey: string;
  totalRequests: number;
  lastRequestAt?: string; // ISO string

  // bővített statok
  dailyCounts: DailyCount[]; // utolsó ~30 nap
  interestsCount: { [interest: string]: number }; // érdeklődési körök
  priceBuckets: { [bucket in PriceBucketKey]: number }; // budget eloszlás

  // ÚJ: mire kerestek + demó statok
  freeTextCount: { [query: string]: number }; // free_text top
  genderCount: { [gender: string]: number };
  relationshipCount: { [rel: string]: number };
};

// ✅ CSAK DISKHEZ: DATA_DIR env + stats.json fájl
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
const STATS_FILE = path.join(DATA_DIR, "stats.json");

const statsMap: { [siteKey: string]: SiteStats } = {};

const MAX_DAYS = 30;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createEmptyBuckets(): { [bucket in PriceBucketKey]: number } {
  return {
    "0-5000": 0,
    "5001-10000": 0,
    "10001-20000": 0,
    "20001+": 0,
  };
}

function loadStatsFromDisk() {
  ensureDataDir();

  if (!fs.existsSync(STATS_FILE)) return;

  try {
    const raw = fs.readFileSync(STATS_FILE, "utf8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      console.warn("[statsService] stats.json nem tömb, üres statokat használunk.");
      return;
    }

    for (const s of data) {
      const siteKey = String(s?.siteKey ?? "").trim();
      if (!siteKey) continue;

      statsMap[siteKey] = {
        siteKey,
        totalRequests: Number(s?.totalRequests) || 0,
        lastRequestAt: s?.lastRequestAt ? String(s.lastRequestAt) : undefined,

        dailyCounts: Array.isArray(s?.dailyCounts) ? s.dailyCounts : [],
        interestsCount: s?.interestsCount && typeof s.interestsCount === "object" ? s.interestsCount : {},
        priceBuckets: s?.priceBuckets && typeof s.priceBuckets === "object" ? s.priceBuckets : createEmptyBuckets(),

        freeTextCount: s?.freeTextCount && typeof s.freeTextCount === "object" ? s.freeTextCount : {},
        genderCount: s?.genderCount && typeof s.genderCount === "object" ? s.genderCount : {},
        relationshipCount:
          s?.relationshipCount && typeof s.relationshipCount === "object" ? s.relationshipCount : {},
      };
    }

    console.log(`[statsService] Statok betöltve: ${Object.keys(statsMap).length} siteKey`);
  } catch (err) {
    console.error("[statsService] Hiba a stats.json beolvasása közben:", err);
  }
}

function saveStatsToDisk() {
  ensureDataDir();
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(Object.values(statsMap), null, 2), "utf8");
  } catch (err) {
    console.error("[statsService] Hiba a stats.json írása közben:", err);
  }
}

function ensureStats(siteKey: string): SiteStats {
  const key = (siteKey || "unknown").trim() || "unknown";
  if (!statsMap[key]) {
    statsMap[key] = {
      siteKey: key,
      totalRequests: 0,
      lastRequestAt: undefined,
      dailyCounts: [],
      interestsCount: {},
      priceBuckets: createEmptyBuckets(),

      freeTextCount: {},
      genderCount: {},
      relationshipCount: {},
    };
  }
  return statsMap[key];
}

function getPriceBucket(min?: number, max?: number): PriceBucketKey {
  const value = max ?? min ?? 0;
  if (value <= 5000) return "0-5000";
  if (value <= 10000) return "5001-10000";
  if (value <= 20000) return "10001-20000";
  return "20001+";
}

function isoDateToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function inc(map: { [k: string]: number }, rawKey: any): void {
  const key = String(rawKey ?? "").trim().toLowerCase();
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

function normalizeQuery(q: any): string {
  let s = String(q ?? "").trim();
  if (!s) return "";
  if (s.length > 120) s = s.slice(0, 120) + "…";
  return s;
}

// ✅ induláskor betöltjük, ha van
(function init() {
  loadStatsFromDisk();
})();

/**
 * Ezt hívjuk meg minden sikeres /api/recommend hívásnál.
 * Itt gyűjtünk minél több, a statisztikához hasznos adatot.
 */
export function recordRecommendation(siteKey: string, user?: UserContext): void {
  const stats = ensureStats(siteKey);

  // Összes darabszám + utolsó időpont
  stats.totalRequests += 1;
  stats.lastRequestAt = new Date().toISOString();

  // Napi bontás (utolsó 30 nap)
  const today = isoDateToday();
  let daily = stats.dailyCounts.find((d) => d.date === today);
  if (!daily) {
    daily = { date: today, count: 0 };
    stats.dailyCounts.push(daily);
  }
  daily.count += 1;

  // Régiek kiszórása (csak utolsó MAX_DAYS)
  const cutoff = isoDateNDaysAgo(MAX_DAYS);
  stats.dailyCounts = stats.dailyCounts
    .filter((d) => d.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Ha nincs extra user adatom, itt megállhatunk
  if (user) {
    // Budget kategóriák (budget_max / budget_min alapján)
    const bucket = getPriceBucket(user.budget_min, user.budget_max);
    stats.priceBuckets[bucket] = (stats.priceBuckets[bucket] || 0) + 1;

    // Érdeklődési körök
    if (Array.isArray(user.interests)) {
      for (const raw of user.interests) {
        inc(stats.interestsCount, raw);
      }
    }

    // ÚJ: free_text (mire kerestek)
    const q = normalizeQuery(user.free_text);
    if (q) {
      stats.freeTextCount[q] = (stats.freeTextCount[q] || 0) + 1;
    }

    // ÚJ: demó megoszlások
    inc(stats.genderCount, user.gender || "unknown");
    inc(stats.relationshipCount, user.relationship || "unknown");
  }

  // ✅ minden frissítés után kiírjuk diskre
  saveStatsToDisk();
}

/**
 * Admin felülethez: az összes stat lekérdezése.
 */
export function getAllStats(): SiteStats[] {
  return Object.values(statsMap).sort((a, b) => a.siteKey.localeCompare(b.siteKey));
}

/**
 * Egy konkrét siteKey stats-a.
 */
export function getStatsForSite(siteKey: string): SiteStats | undefined {
  const key = (siteKey || "").trim();
  return statsMap[key];
}
