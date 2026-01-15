// src/ai/rerank.ts
import OpenAI from "openai";
import { UserContext } from "../models/UserContext";
import { Product } from "../models/Product";

type RankedProduct = {
  product: Product;
  reason: string;
};

type RerankResult = {
  items: RankedProduct[];
  also_items: RankedProduct[];
  notice?: string | null;
};

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY hiányzik. Állítsd be a .env fájlban.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ===================== STABILITÁS SEGÉD ===================== */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function toStatus(err: any): number | null {
  const s = err?.status ?? err?.response?.status ?? err?.cause?.status;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isRetryable(err: any): boolean {
  const status = toStatus(err);
  if (status === 429) return true;
  if (status !== null && status >= 500 && status <= 599) return true;

  const code = String(err?.code || "");
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND") return true;

  const msg = String(err?.message || "").toLowerCase();
  if (msg.includes("timeout") || msg.includes("rate limit") || msg.includes("temporarily")) return true;

  return false;
}

function cut(v: any, n: number): string {
  const s = String(v || "");
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function extractJsonObject(text: string): string | null {
  const s = String(text || "").trim();
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i === -1 || j === -1 || j <= i) return null;
  return s.slice(i, j + 1);
}

/* ===================== TOKEN / HEURISZTIKA ===================== */

const STOP = new Set([
  "a",
  "az",
  "és",
  "meg",
  "de",
  "hogy",
  "nem",
  "is",
  "van",
  "volt",
  "vagy",
  "mert",
  "mint",
  "egy",
  "egyik",
  "másik",
  "valami",
  "nagyon",
  "csak",
  "szeret",
  "szereti",
  "termék",
  "termek",
  "cucc",
  "dolog",
  "pl",
  "például",
  "pl.",
  "kb",
]);

function tokenizeHu(s: string): string[] {
  const t = String(s || "").toLowerCase();
  return t
    .replace(/[^a-z0-9áéíóöőúüű]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 2)
    .filter((w) => !STOP.has(w));
}

function getUserTokens(user: UserContext): string[] {
  const out: string[] = [];
  if (Array.isArray(user.interests)) {
    for (const it of user.interests) out.push(...tokenizeHu(String(it)));
  }
  out.push(...tokenizeHu(user.free_text || ""));
  out.push(...tokenizeHu(user.relationship || ""));
  return [...new Set(out)].slice(0, 80);
}

function getProductTokens(p: Product): Set<string> {
  const hay = `${p.name || ""} ${p.category || ""} ${p.description || ""}`;
  return new Set(tokenizeHu(hay));
}

function findOverlapToken(userTokens: string[], productTokens: Set<string>): string | null {
  for (const t of userTokens) {
    if (productTokens.has(t)) return t;
  }
  return null;
}

function summarizeCatalog(products: Product[]): { cats: string[]; words: string[]; hint: string } {
  const catCount = new Map<string, number>();
  const wordCount = new Map<string, number>();

  for (const p of products) {
    const cat = String(p.category || "").trim().toLowerCase();
    if (cat) catCount.set(cat, (catCount.get(cat) || 0) + 1);

    const hay = `${p.name || ""} ${p.category || ""} ${p.description || ""}`;
    for (const w of tokenizeHu(hay)) {
      wordCount.set(w, (wordCount.get(w) || 0) + 1);
    }
  }

  const cats = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([c]) => c);
  const words = [...wordCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  const bits: string[] = [];
  if (cats.length) bits.push(`kategóriák: ${cats.join(", ")}`);
  if (words.length) bits.push(`kulcsszavak: ${words.join(", ")}`);

  return { cats, words, hint: bits.length ? bits.join(" | ") : "nincs elég adat a katalógus jellegére" };
}

/**
 * Régi mismatch túl "harapós" volt (1 db token sem egyezett => mismatch).
 * Itt enyhítünk: csak akkor mismatch, ha a usernek van érdemi tokenje,
 * és a teljes listában összesen is kb 0 egyezés van.
 */
function estimateMismatch(user: UserContext, products: Product[]): boolean {
  const q = getUserTokens(user);
  if (q.length === 0) return false;

  let hit = 0;
  for (const p of products) {
    const pt = getProductTokens(p);
    for (const t of q) {
      if (pt.has(t)) {
        hit++;
        break;
      }
    }
    if (hit >= 2) return false; // már 2 terméknél volt valami egyezés → nem mismatch
  }
  return true;
}

/* ===================== FALLBACK REASON (rövid, de "salesy") ===================== */

function buildFallbackReason(
  user: UserContext,
  product: Product,
  mismatch: boolean,
  catalogHintShort: string
): string {
  const userTokens = getUserTokens(user);
  const pt = getProductTokens(product);
  const overlap = findOverlapToken(userTokens, pt);

  const price = product.price;
  const hasMax = typeof user.budget_max === "number" && isFinite(user.budget_max as number);
  const inBudget =
    typeof price === "number" &&
    isFinite(price) &&
    hasMax &&
    typeof user.budget_max === "number" &&
    price <= (user.budget_max as number);

  const cat = String(product.category || "").trim();

  if (overlap) {
    return `Kapcsolódik ehhez: „${overlap}” — ezért jó kiinduló választás.${inBudget ? " Árban is belefér a keretbe." : ""}`;
  }

  if (mismatch && userTokens.length > 0) {
    return `Nem a klasszikus „${userTokens[0]}” vonal a bolt kínálata (inkább: ${catalogHintShort}), de ez egy biztonságos, könnyen szerethető választás${cat ? ` a(z) „${cat}” kategóriából` : ""}.`;
  }

  return `Praktikus, ajándék-kompatibilis választás${cat ? ` (kategória: ${cat})` : ""}.${inBudget ? " Árban is belefér a keretbe." : ""}`;
}

/* ===================== DEDUPE ===================== */

function productKey(p: Product): string {
  const id = String((p as any).product_id || "").trim();
  if (id) return `id:${id}`;
  const url = String((p as any).product_url || "").trim();
  if (url) return `url:${url}`;
  const name = String(p.name || "").trim().toLowerCase();
  const price = String((p as any).price ?? "");
  return `np:${name}|${price}`;
}

function uniqueByProduct(items: RankedProduct[]): RankedProduct[] {
  const seen = new Set<string>();
  const out: RankedProduct[] = [];
  for (const it of items) {
    const k = productKey(it.product);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/* ===================== LLM RERANK (2 lista + notice) ===================== */

export async function rerankWithLLM(user: UserContext, products: Product[]): Promise<RerankResult> {
  if (!products || products.length === 0) {
    return { items: [], also_items: [], notice: "Nincs termék a listában." };
  }

  const catalog = summarizeCatalog(products);
  const mismatch = estimateMismatch(user, products);

  const catalogHintShort =
    catalog.cats && catalog.cats.length
      ? catalog.cats.join(", ")
      : catalog.words && catalog.words.length
        ? catalog.words.slice(0, 4).join(", ")
        : "a webshop saját kínálata";

  // prompt méret csökkentés a stabilitásért
  const userForLLM = {
    age: user.age ?? null,
    gender: user.gender ?? "unknown",
    relationship: user.relationship ?? "",
    budget_min: user.budget_min ?? null,
    budget_max: user.budget_max ?? null,
    interests: Array.isArray(user.interests) ? user.interests.slice(0, 30) : [],
    free_text: cut(user.free_text || "", 600),
  };

  const productList = products.map((p, idx) => ({
    index: idx,
    product_id: (p as any).product_id,
    name: p.name,
    price: (p as any).price,
    category: (p as any).category,
    description: cut((p as any).description, 320),
  }));

  const maxTotal = Math.min(14, products.length);
  const maxMain = Math.min(7, products.length);
  const maxAlso = Math.min(10, products.length);

  const minMainTarget = Math.min(3, maxMain); // ✅ ne legyen 0 items
  const minAlsoTarget = Math.min(5, maxAlso); // ✅ legyen rendes AMI MÉG ÉRDEKELHET

  const systemPrompt = `
Te egy magyar nyelvű TERMÉK-AJÁNLÓ asszisztens vagy.

CÉL:
- Két listát adj vissza:
  1) items = "legjobb találatok" (nem kell 100% szó szerinti egyezés; lehet „legközelebbi” találat is)
  2) also_items = "AMI MÉG ÉRDEKELHET" (általánosabb, de vállalható termékek ebből a webshopból)

FONTOS:
- NE írj olyat, hogy „nincs ilyen témájú termék” mint végkövetkeztetés.
  Inkább: „Direkt egyezés most nem egyértelmű, ezért hoztam pár ajándék-kompatibilis alternatívát a bolt kínálatából.”

SZABÁLYOK:
- Csak JSON-t adj vissza, extra szöveg nélkül.
- Az "index" a kapott terméklista indexe.
- items legyen 3-7 elem, ha van elég termék.
- also_items legyen 5-10 elem, ha van elég termék.
- Ne duplikálj: ugyanaz az index ne szerepeljen mindkét listában.
- Az indoklás 1-2 mondat, magyarul, barátságos és értékesítő.
- Csak olyat állíts, ami tényleg látszik a termék adataiból (name/category/description/price). Ne hallucinálj.

KÖTELEZŐ VÁLASZFORMÁTUM:
{
  "notice": "opcionális, rövid és pozitív hangnem",
  "items": [ { "index": 0, "reason": "..." } ],
  "also_items": [ { "index": 1, "reason": "..." } ]
}
`.trim();

  const userPrompt = `
Felhasználói adatok:
${JSON.stringify(userForLLM, null, 2)}

Katalógus jelleg (heurisztika):
${catalog.hint}

Megjegyzés:
${mismatch ? "A direkt kulcsszó-egyezés bizonytalan. Ettől még válassz „legközelebbi” találatokat items-be, és írj kedves, őszinte notice-t." : "Valószínű van átfedés; adj releváns találatokat items-be."}

Terméklista:
${JSON.stringify(productList, null, 2)}
`.trim();

  function mapFromIdxArr(arr: any[], forbidIdx: Set<number>): RankedProduct[] {
    const out: RankedProduct[] = [];
    for (const it of Array.isArray(arr) ? arr : []) {
      const idx = Number(it?.index);
      if (!Number.isFinite(idx)) continue;
      if (idx < 0 || idx >= products.length) continue;
      if (forbidIdx.has(idx)) continue;

      const r0 = String(it?.reason || "").trim();
      const fallback = buildFallbackReason(user, products[idx], mismatch, catalogHintShort);

      out.push({
        product: products[idx],
        reason: r0.length ? r0 : fallback,
      });

      forbidIdx.add(idx);
    }
    return uniqueByProduct(out);
  }

  function fillFromRemaining(
    base: RankedProduct[],
    used: Set<number>,
    targetCount: number,
    allowMismatchText: boolean
  ): RankedProduct[] {
    const out = [...base];
    for (let i = 0; i < products.length && out.length < targetCount; i++) {
      if (used.has(i)) continue;
      used.add(i);
      out.push({
        product: products[i],
        reason: buildFallbackReason(user, products[i], allowMismatchText, catalogHintShort),
      });
    }
    return uniqueByProduct(out);
  }

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        // ✅ kreatívabb, de nem elszállós
        temperature: 0.65,
      });

      const raw = response.choices[0]?.message?.content || "";
      if (!raw) throw new Error("EMPTY_GPT_RESPONSE");

      const jsonStr = extractJsonObject(raw);
      if (!jsonStr) throw new Error("NO_JSON_OBJECT_IN_RESPONSE");

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error("JSON_PARSE_FAILED");
      }

      const used = new Set<number>();

      let items = mapFromIdxArr(parsed?.items || [], used).slice(0, maxMain);
      let also_items = mapFromIdxArr(parsed?.also_items || [], used).slice(0, maxAlso);

      // ✅ ha LLM túl „szűk”, feltöltjük mindkettőt
      items = fillFromRemaining(items, used, minMainTarget, mismatch).slice(0, maxMain);
      also_items = fillFromRemaining(also_items, used, minAlsoTarget, mismatch).slice(0, maxAlso);

      // notice: legyen rövid, pozitív, és ne „nincs ilyen termék”
      let notice = typeof parsed?.notice === "string" ? parsed.notice.trim() : "";
      if (!notice) {
        notice = mismatch
          ? `Direkt egyezés most nem volt egyértelmű, ezért a bolt stílusához illő, ajándék-kompatibilis ötleteket válogattam (${catalogHintShort}).`
          : "";
      }
      if (notice && notice.length > 220) notice = notice.slice(0, 220).trim() + "…";

      // total limit (items elsőbbség)
      const total = [...items, ...also_items].slice(0, maxTotal);
      const finalItems = total.slice(0, Math.min(items.length, maxMain));
      const finalAlso = total.slice(finalItems.length);

      return { items: finalItems, also_items: finalAlso, notice: notice || null };
    } catch (err: any) {
      const status = toStatus(err);
      const msg = String(err?.message || err);

      const retry = isRetryable(err) && attempt < MAX_ATTEMPTS;
      if (retry) {
        const wait = 450 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
        console.warn(
          `[rerank] GPT hiba (attempt ${attempt}/${MAX_ATTEMPTS}) status=${status ?? "-"} msg=${msg}. Retry ${wait}ms...`
        );
        await sleep(wait);
        continue;
      }

      console.error(
        `[rerank] GPT végleges hiba (attempt ${attempt}/${MAX_ATTEMPTS}) status=${status ?? "-"} msg=${msg}. Fallback.`
      );

      // végső fallback: legyen normális UX → items is kapjon párat
      const used = new Set<number>();
      const items: RankedProduct[] = [];
      const also: RankedProduct[] = [];

      // items: első 3
      for (let i = 0; i < Math.min(minMainTarget, products.length); i++) {
        used.add(i);
        items.push({
          product: products[i],
          reason: buildFallbackReason(user, products[i], mismatch, catalogHintShort),
        });
      }
      // also: következő 5-10
      for (let i = 0; i < products.length && also.length < minAlsoTarget; i++) {
        if (used.has(i)) continue;
        used.add(i);
        also.push({
          product: products[i],
          reason: buildFallbackReason(user, products[i], mismatch, catalogHintShort),
        });
      }

      const notice = mismatch
        ? `Direkt egyezés most nem volt egyértelmű, ezért a bolt kínálatából hoztam pár biztos befutó alternatívát (${catalogHintShort}).`
        : "Most nem sikerült pontosan rangsorolni, de hoztam pár vállalható alternatívát.";

      return { items, also_items: also, notice };
    }
  }

  // elvileg nem fut ide
  const items: RankedProduct[] = products.slice(0, Math.min(3, products.length)).map((p) => ({
    product: p,
    reason: buildFallbackReason(user, p, false, "a webshop saját kínálata"),
  }));
  const also: RankedProduct[] = products.slice(items.length, Math.min(items.length + 7, products.length)).map((p) => ({
    product: p,
    reason: buildFallbackReason(user, p, false, "a webshop saját kínálata"),
  }));

  return { items, also_items: also, notice: "Mutatok néhány alternatívát." };
}
