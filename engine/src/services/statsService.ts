// src/services/statsService.ts
import fs from "fs";
import path from "path";
import { UserContext } from "../models/UserContext";

export type DailyCount = {
  date: string; // 'YYYY-MM-DD'
  count: number;
};

export type DailyTiming = {
  date: string; // 'YYYY-MM-DD'
  sumMs: number; // összes idő ms-ban
  count: number; // hány mérés
};

export type PriceBucketKey = "0-5000" | "5001-10000" | "10001-20000" | "20001+";

export type SiteStats = {
  siteKey: string;
  totalRequests: number;
  lastRequestAt?: string; // ISO string

  // statok
  dailyCounts: DailyCount[]; // utolsó ~MAX_DAYS nap
  interestsCount: { [interest: string]: number };
  priceBuckets: { [bucket in PriceBucketKey]: number };

  freeTextCount: { [query: string]: number };
  genderCount: { [gender: string]: number };
  relationshipCount: { [rel: string]: number };

  // ✅ ÚJ: válaszidő
  responseTimeTotalMs: number;
  responseTimeCount: number;
  dailyResponseTimes: DailyTiming[]; // napra bontva

  // ✅ ÚJ: termék megnyitás kattintások
  productOpenClicksTotal: number;
  dailyProductOpenClicks: DailyCount[]; // napra bontva
  productOpenClicksByProductId: { [productId: string]: number }; // opcionális: top termékekhez
};

// ✅ CSAK DISKHEZ: DATA_DIR env + stats.json fájl
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
const STATS_FILE = path.join(DATA_DIR, "stats.json");

const statsMap: { [siteKey: string]: SiteStats } = {};

// 7/30/90 + “előző időszak” összehasonlításhoz kell 180 nap is.
// Legyen kényelmes: 200 nap.
const MAX_DAYS = 200;

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
        relationshipCount: s?.relationshipCount && typeof s.relationshipCount === "object" ? s.relationshipCount : {},

        responseTimeTotalMs: Number(s?.responseTimeTotalMs) || 0,
        responseTimeCount: Number(s?.responseTimeCount) || 0,
        dailyResponseTimes: Array.isArray(s?.dailyResponseTimes) ? s.dailyResponseTimes : [],

        productOpenClicksTotal: Number(s?.productOpenClicksTotal) || 0,
        dailyProductOpenClicks: Array.isArray(s?.dailyProductOpenClicks) ? s.dailyProductOpenClicks : [],
        productOpenClicksByProductId:
          s?.productOpenClicksByProductId && typeof s.productOpenClicksByProductId === "object"
            ? s.productOpenClicksByProductId
            : {},
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

      responseTimeTotalMs: 0,
      responseTimeCount: 0,
      dailyResponseTimes: [],

      productOpenClicksTotal: 0,
      dailyProductOpenClicks: [],
      productOpenClicksByProductId: {},
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

function pruneDailyCounts(arr: DailyCount[]) {
  const cutoff = isoDateNDaysAgo(MAX_DAYS);
  return (Array.isArray(arr) ? arr : [])
    .filter((d) => d && typeof d.date === "string" && d.date >= cutoff)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function pruneDailyTimings(arr: DailyTiming[]) {
  const cutoff = isoDateNDaysAgo(MAX_DAYS);
  return (Array.isArray(arr) ? arr : [])
    .filter((d) => d && typeof d.date === "string" && d.date >= cutoff)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// ✅ induláskor betöltjük, ha van
(function init() {
  loadStatsFromDisk();
})();

/**
 * Ezt hívjuk meg minden sikeres /api/recommend hívásnál.
 * durationMs: a teljes ajánlás futási ideje (ms).
 */
export function recordRecommendation(siteKey: string, user?: UserContext, durationMs?: number): void {
  const stats = ensureStats(siteKey);

  // Összes darabszám + utolsó időpont
  stats.totalRequests += 1;
  stats.lastRequestAt = new Date().toISOString();

  // Napi bontás
  const today = isoDateToday();
  let daily = stats.dailyCounts.find((d) => d.date === today);
  if (!daily) {
    daily = { date: today, count: 0 };
    stats.dailyCounts.push(daily);
  }
  daily.count += 1;

  // Válaszidő mérés (ha jött duration)
  const ms = typeof durationMs === "number" && Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0;
  if (ms > 0) {
    stats.responseTimeTotalMs += ms;
    stats.responseTimeCount += 1;

    let dt = stats.dailyResponseTimes.find((d) => d.date === today);
    if (!dt) {
      dt = { date: today, sumMs: 0, count: 0 };
      stats.dailyResponseTimes.push(dt);
    }
    dt.sumMs += ms;
    dt.count += 1;
  }

  // Prune
  stats.dailyCounts = pruneDailyCounts(stats.dailyCounts);
  stats.dailyResponseTimes = pruneDailyTimings(stats.dailyResponseTimes);

  // Extra user statok
  if (user) {
    const bucket = getPriceBucket(user.budget_min, user.budget_max);
    stats.priceBuckets[bucket] = (stats.priceBuckets[bucket] || 0) + 1;

    if (Array.isArray(user.interests)) {
      for (const raw of user.interests) {
        inc(stats.interestsCount, raw);
      }
    }

    const q = normalizeQuery(user.free_text);
    if (q) {
      stats.freeTextCount[q] = (stats.freeTextCount[q] || 0) + 1;
    }

    inc(stats.genderCount, user.gender || "unknown");
    inc(stats.relationshipCount, user.relationship || "unknown");
  }

  saveStatsToDisk();
}

/**
 * Widget termék megnyitás kattintás rögzítés.
 */
export function recordProductOpenClick(siteKey: string, productId?: string): void {
  const stats = ensureStats(siteKey);

  stats.productOpenClicksTotal += 1;

  const today = isoDateToday();
  let d = stats.dailyProductOpenClicks.find((x) => x.date === today);
  if (!d) {
    d = { date: today, count: 0 };
    stats.dailyProductOpenClicks.push(d);
  }
  d.count += 1;

  const pid = String(productId || "").trim();
  if (pid) {
    stats.productOpenClicksByProductId[pid] = (stats.productOpenClicksByProductId[pid] || 0) + 1;
  }

  stats.dailyProductOpenClicks = pruneDailyCounts(stats.dailyProductOpenClicks);

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
