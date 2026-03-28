// scripts/backfill-visual.mjs
// Regenerates ai_description for all products in a catalog using vision (gpt-4o-mini).
// Usage: node scripts/backfill-visual.mjs [site_key] [--force]
//   site_key: which catalog to process (default: unreal)
//   --force:  regenerate even if ai_description already exists
//
// Progress is saved after every batch → safe to interrupt and resume.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

const SITE_KEY = process.argv[2] || "unreal";
const FORCE = process.argv.includes("--force");

const VISION_BATCH = 5;
const TEXT_BATCH = 50;
const VISION_CONCURRENCY = 3;   // reduced to stay under 200k TPM
const TEXT_CONCURRENCY = 5;
const WINDOW_PAUSE_MS = 3000;   // pause between vision windows

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Prompts (same as generateDescriptions.ts) ────────────────────────────────

const BASE_RULES = `
Rules:
- 80-160 characters per description
- Include: color, material/fabric (if mentioned), cut/fit, notable features or graphics
- COLOR RULE: use the actual color visible in the image as the primary source. If image is unclear, use product name/text.
- Do NOT start with or repeat the product name or brand name
- Do NOT use generic phrases: "Remek választás", "Tökéletes", "Kiváló minőség", "Must-have"
- Write ONLY in Hungarian

Good examples:
✓ "Szürke, laza szabású nehéz pamut póló, cold dyed technikával, Eberkoma kolláborációs grafika."
✓ "Fekete zip hoodie, 100% pamut, laza szabás, kis hímzett logóval mellkason."
✓ "Fehér oversized póló, logo nélküli, nyomott grafikával a hátoldalon."
✓ "Sárga kosárlabdás rövidnadrág, teljesen nyomott minta, sportos bő szabás."
`.trim();

const VISION_SYSTEM = `Generate concise Hungarian product descriptions for a streetwear/fashion webshop.
You will receive product images — analyze them carefully.

${BASE_RULES}

VISUAL ATTRIBUTES to detect from image (include relevant ones):
- Logo/grafika: "logo nélküli" / "kis logóval" / "nagy logóval" / "nyomott grafikával" / "felirattal" / "teli nyomott" / "mintás"
- Fit (if visible): "oversized" / "bő szabás" / "slim" / "normál szabás"
- Color: use the actual color visible in the image
- Pattern: "egyszínű" / "csíkos" / "kockás" / "tarka" / "tie-dye"

Output JSON: {"descriptions": [{"id": "<product_id>", "desc": "<Hungarian description>"}]}`;

const TEXT_SYSTEM = `Generate concise Hungarian product descriptions for a streetwear/fashion webshop.

${BASE_RULES}

Output JSON: {"descriptions": [{"id": "<product_id>", "desc": "<Hungarian description>"}]}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanName(raw) {
  let name = String(raw || "");
  name = name.replace(/\s*\((?:[^()]*|\([^()]*\))*\)\s*$/, "").trim();
  name = name.replace(/\s*[-–\/|]\s*(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|\d{2,3})\s*$/i, "").trim();
  return name;
}

function meta(p) {
  const desc = stripHtml(String(p.description || "")).slice(0, 200);
  const catLast = (p.category || "").includes(">")
    ? p.category.split(">").pop().trim()
    : (p.category || "");
  const name = cleanName(p.name || "");
  return { id: p.product_id, name, category: catLast, desc: desc || undefined };
}

async function visionBatch(batch) {
  const result = new Map();
  const content = [{ type: "text", text: `Analyze ${batch.length} products:\n` }];
  for (let i = 0; i < batch.length; i++) {
    const m = meta(batch[i]);
    content.push({ type: "text", text: `Product ${i + 1}: ${JSON.stringify({ id: m.id, name: m.name, category: m.category })}` });
    content.push({ type: "image_url", image_url: { url: batch[i].image_url, detail: "low" } });
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: VISION_SYSTEM }, { role: "user", content }],
        temperature: 0.4,
      });
      const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
      for (const item of (parsed?.descriptions || [])) {
        if (item?.id && item?.desc && String(item.desc).trim().length >= 30) {
          result.set(String(item.id), String(item.desc).trim().slice(0, 200));
        }
      }
      return result;
    } catch (err) {
      // 429: extract retry-after from error message
      const msg = err?.message || "";
      const retryMatch = msg.match(/try again in ([\d.]+)s/);
      const waitMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500 : 2000 * attempt;
      if (attempt < 5) { await new Promise(r => setTimeout(r, waitMs)); continue; }
      console.error("Vision batch failed:", msg);
    }
  }
  return result;
}

async function textBatch(batch) {
  const result = new Map();
  const productList = batch.map(meta);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TEXT_SYSTEM },
          { role: "user", content: `Generate descriptions for ${batch.length} products:\n${JSON.stringify(productList)}` },
        ],
        temperature: 0.4,
      });
      const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
      for (const item of (parsed?.descriptions || [])) {
        if (item?.id && item?.desc && String(item.desc).trim().length >= 30) {
          result.set(String(item.id), String(item.desc).trim().slice(0, 200));
        }
      }
      return result;
    } catch (err) {
      if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue; }
      console.error("Text batch failed:", err?.message || err);
    }
  }
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const filePath = resolve(DATA_DIR, `products-${SITE_KEY}.json`);
if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

console.log(`\n[backfill-visual] Loading ${filePath}...`);
const products = JSON.parse(readFileSync(filePath, "utf8"));

// Deduplicate: process only the first variant per base product
// (all variants of same product get the same description anyway)
const basesSeen = new Set();
const toProcess = FORCE
  ? products
  : products.filter(p => {
      if (p.ai_description) return false; // already has description
      const base = p.product_id.includes("__") ? p.product_id.split("__")[0] : p.product_id;
      if (basesSeen.has(base)) return false;
      basesSeen.add(base);
      return true;
    });

console.log(`[backfill-visual] ${products.length} total, ${toProcess.length} to process (${FORCE ? "force mode" : "skipping existing"})`);

if (toProcess.length === 0) {
  console.log("[backfill-visual] Nothing to do.");
  process.exit(0);
}

const withImage = toProcess.filter(p => p.image_url);
const noImage = toProcess.filter(p => !p.image_url);
console.log(`[backfill-visual] ${withImage.length} with image (vision), ${noImage.length} without image (text)\n`);

const descMap = new Map();

// Vision batches
const vBatches = [];
for (let i = 0; i < withImage.length; i += VISION_BATCH) vBatches.push(withImage.slice(i, i + VISION_BATCH));
let vDone = 0;
for (let i = 0; i < vBatches.length; i += VISION_CONCURRENCY) {
  const window = vBatches.slice(i, i + VISION_CONCURRENCY);
  const results = await Promise.all(window.map(b => visionBatch(b)));
  results.forEach(r => r.forEach((v, k) => descMap.set(k, v)));
  vDone += window.reduce((s, b) => s + b.length, 0);
  process.stdout.write(`\r[vision] ${Math.min(vDone, withImage.length)}/${withImage.length} done`);

  // Save progress every 5 windows
  if ((i / VISION_CONCURRENCY) % 5 === 4) {
    applyAndSave(products, descMap, filePath);
    process.stdout.write(" ✓ saved");
  }

  // Pause between windows to avoid TPM rate limit
  if (i + VISION_CONCURRENCY < vBatches.length) {
    await new Promise(r => setTimeout(r, WINDOW_PAUSE_MS));
  }
}
if (withImage.length > 0) console.log();

// Text batches
const tBatches = [];
for (let i = 0; i < noImage.length; i += TEXT_BATCH) tBatches.push(noImage.slice(i, i + TEXT_BATCH));
let tDone = 0;
for (let i = 0; i < tBatches.length; i += TEXT_CONCURRENCY) {
  const window = tBatches.slice(i, i + TEXT_CONCURRENCY);
  const results = await Promise.all(window.map(b => textBatch(b)));
  results.forEach(r => r.forEach((v, k) => descMap.set(k, v)));
  tDone += window.reduce((s, b) => s + b.length, 0);
  process.stdout.write(`\r[text] ${Math.min(tDone, noImage.length)}/${noImage.length} done`);
}
if (noImage.length > 0) console.log();

// Final save: apply descriptions to ALL variants sharing the same base
function applyAndSave(allProducts, map, path) {
  // Build base→desc lookup
  const baseDescMap = new Map();
  for (const [id, desc] of map) {
    const base = id.includes("__") ? id.split("__")[0] : id;
    baseDescMap.set(base, desc);
    baseDescMap.set(id, desc); // exact match too
  }

  let applied = 0;
  for (const p of allProducts) {
    const exactDesc = baseDescMap.get(p.product_id);
    if (exactDesc) { p.ai_description = exactDesc; applied++; continue; }
    const base = p.product_id.includes("__") ? p.product_id.split("__")[0] : p.product_id;
    const baseDesc = baseDescMap.get(base);
    if (baseDesc) { p.ai_description = baseDesc; applied++; }
  }
  writeFileSync(path, JSON.stringify(allProducts, null, 2));
  return applied;
}

const applied = applyAndSave(products, descMap, filePath);
console.log(`\n[backfill-visual] Done! ${descMap.size} descriptions generated, ${applied} products updated.`);
console.log(`[backfill-visual] Saved to ${filePath}`);
console.log(`\nNext step: restart the server to pick up the new descriptions.`);
