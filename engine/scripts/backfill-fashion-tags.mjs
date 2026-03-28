// scripts/backfill-fashion-tags.mjs
// Generates structured fashion_tags for existing products that already have ai_description.
// Uses the ai_description + product metadata to extract tags (text-only, cheap).
// For vision-based re-analysis, use --vision flag (slower, more accurate).
//
// Usage:
//   node scripts/backfill-fashion-tags.mjs [site_key] [--force] [--vision]
//     site_key: which catalog to process (default: unreal)
//     --force:  regenerate even if fashion_tags already exists
//     --vision: use gpt-4o-mini vision for image-based products (more accurate, slower)
//
// Progress saved after every batch window → safe to interrupt and resume.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

const SITE_KEY = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "unreal";
const FORCE = process.argv.includes("--force");
const USE_VISION = process.argv.includes("--vision");

const TEXT_BATCH = 50;
const VISION_BATCH = 5;
const TEXT_CONCURRENCY = 5;
const VISION_CONCURRENCY = 3;
const WINDOW_PAUSE_MS = 2000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Fashion tags schema ─────────────────────────────────────────────────────

const FASHION_TAGS_SCHEMA = `
Extract structured fashion tags for each product. Output ONLY valid values from this schema:

{
  "fit": "oversized" | "relaxed" | "regular" | "slim" | "boxy" | "cropped",
  "logo": "none" | "small" | "large" | "embroidered" | "printed",
  "graphic": "none" | "small_print" | "all_over" | "text" | "abstract" | "photo",
  "pattern": "solid" | "striped" | "checkered" | "dotted" | "floral" | "camo" | "tie_dye" | "leopard" | "abstract" | "colorblock",
  "style": ["casual", "sporty", "elegant", "streetwear", "vintage", "minimalist", "bold", "preppy", "grunge", "workwear", "skater", "hip_hop", "retro"],
  "weight": "light" | "medium" | "heavy",
  "material": "cotton" | "polyester" | "fleece" | "denim" | "nylon" | "wool" | "linen" | "silk" | "leather" | "mesh" | "mixed",
  "color": primary color in English lowercase ("black", "white", "grey", "blue", "red", "green", "yellow", "orange", "purple", "pink", "brown", "beige", "navy", "burgundy", "teal", "multicolor")
}

Rules:
- "fit": if not clear, use "regular"
- "logo": "none" = NO visible brand mark at all
- "graphic": "none" = completely plain surface, "text" = lettering/words, "all_over" = fully covered print
- "pattern": "solid" = one color only
- "style": MUST be array, pick 1-3
- "weight": fleece/heavy cotton = "heavy", mesh/thin fabric = "light", normal = "medium"
- Use the ai_description and product data to determine each field accurately
`.trim();

const TEXT_SYSTEM = `You are a fashion product classifier. Given product metadata and an existing AI description, extract structured fashion tags.

${FASHION_TAGS_SCHEMA}

Output JSON:
{
  "tags": [
    { "id": "<product_id>", "tags": { "fit": "...", "logo": "...", "graphic": "...", "pattern": "...", "style": [...], "weight": "...", "material": "...", "color": "..." } }
  ]
}`.trim();

const VISION_SYSTEM = `You are a fashion product classifier. Analyze product images and metadata to extract structured fashion tags.

${FASHION_TAGS_SCHEMA}

Look at each image carefully to determine:
- Is there a visible logo? How big?
- Any graphic print, text, or pattern?
- What is the fit (oversized, slim, etc.)?
- Dominant color?

Output JSON:
{
  "tags": [
    { "id": "<product_id>", "tags": { "fit": "...", "logo": "...", "graphic": "...", "pattern": "...", "style": [...], "weight": "...", "material": "...", "color": "..." } }
  ]
}`.trim();

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID = {
  fit: ["oversized", "relaxed", "regular", "slim", "boxy", "cropped"],
  logo: ["none", "small", "large", "embroidered", "printed"],
  graphic: ["none", "small_print", "all_over", "text", "abstract", "photo"],
  pattern: ["solid", "striped", "checkered", "dotted", "floral", "camo", "tie_dye", "leopard", "abstract", "colorblock"],
  style: ["casual", "sporty", "elegant", "streetwear", "vintage", "minimalist", "bold", "preppy", "grunge", "workwear", "skater", "hip_hop", "retro"],
  weight: ["light", "medium", "heavy"],
  material: ["cotton", "polyester", "fleece", "denim", "nylon", "wool", "linen", "silk", "leather", "mesh", "mixed"],
};

function validateTags(raw) {
  if (!raw || typeof raw !== "object") return null;
  const tags = {};

  if (VALID.fit.includes(raw.fit)) tags.fit = raw.fit;
  if (VALID.logo.includes(raw.logo)) tags.logo = raw.logo;
  if (VALID.graphic.includes(raw.graphic)) tags.graphic = raw.graphic;
  if (VALID.pattern.includes(raw.pattern)) tags.pattern = raw.pattern;
  if (VALID.weight.includes(raw.weight)) tags.weight = raw.weight;
  if (VALID.material.includes(raw.material)) tags.material = raw.material;
  if (typeof raw.color === "string" && raw.color.length > 0) tags.color = raw.color.toLowerCase();

  if (Array.isArray(raw.style)) {
    const validStyles = raw.style.filter(s => typeof s === "string" && VALID.style.includes(s));
    if (validStyles.length > 0) tags.style = validStyles;
  }

  return Object.keys(tags).length >= 3 ? tags : null; // require at least 3 fields
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanName(raw) {
  let name = String(raw || "");
  name = name.replace(/\s*\((?:[^()]*|\([^()]*\))*\)\s*$/, "").trim();
  name = name.replace(/\s*[-–\/|]\s*(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|\d{2,3})\s*$/i, "").trim();
  return name;
}

function productMeta(p) {
  const name = cleanName(p.name || "");
  const desc = stripHtml(String(p.description || "")).slice(0, 150);
  const catLast = (p.category || "").includes(">")
    ? p.category.split(">").pop().trim()
    : (p.category || "");
  return {
    id: p.product_id,
    name,
    category: catLast,
    ai_description: p.ai_description || undefined,
    tags: p.tags ? String(p.tags).slice(0, 100) : undefined,
    desc: desc || undefined,
  };
}

// ─── Batch generators ────────────────────────────────────────────────────────

async function generateTextBatch(batch) {
  const result = new Map();
  const productList = batch.map(productMeta);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TEXT_SYSTEM },
          { role: "user", content: `Extract fashion tags for ${batch.length} products:\n${JSON.stringify(productList)}` },
        ],
        temperature: 0.3,
      });

      const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
      for (const item of (parsed?.tags || [])) {
        if (item?.id && item?.tags) {
          const validated = validateTags(item.tags);
          if (validated) result.set(String(item.id), validated);
        }
      }
      return result;
    } catch (err) {
      const msg = err?.message || "";
      const retryMatch = msg.match(/try again in ([\d.]+)s/);
      const waitMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500 : 2000 * attempt;
      if (attempt < 3) { await new Promise(r => setTimeout(r, waitMs)); continue; }
      console.error("\nText batch failed:", msg);
    }
  }
  return result;
}

async function generateVisionBatch(batch) {
  const result = new Map();
  const content = [{ type: "text", text: `Extract fashion tags for ${batch.length} products:\n` }];

  for (let i = 0; i < batch.length; i++) {
    const m = productMeta(batch[i]);
    content.push({
      type: "text",
      text: `Product ${i + 1}: ${JSON.stringify({ id: m.id, name: m.name, category: m.category, ai_description: m.ai_description })}`,
    });
    content.push({
      type: "image_url",
      image_url: { url: batch[i].image_url, detail: "low" },
    });
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: VISION_SYSTEM },
          { role: "user", content },
        ],
        temperature: 0.3,
      });

      const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
      for (const item of (parsed?.tags || [])) {
        if (item?.id && item?.tags) {
          const validated = validateTags(item.tags);
          if (validated) result.set(String(item.id), validated);
        }
      }
      return result;
    } catch (err) {
      const msg = err?.message || "";
      const retryMatch = msg.match(/try again in ([\d.]+)s/);
      const waitMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500 : 2000 * attempt;
      if (attempt < 5) { await new Promise(r => setTimeout(r, waitMs)); continue; }
      console.error("\nVision batch failed:", msg);
    }
  }
  return result;
}

// ─── Apply + save ────────────────────────────────────────────────────────────

function applyAndSave(allProducts, tagsMap, filePath) {
  // Build base→tags lookup (for size variants sharing same base product)
  const baseMap = new Map();
  for (const [id, tags] of tagsMap) {
    const base = id.includes("__") ? id.split("__")[0] : id;
    baseMap.set(base, tags);
    baseMap.set(id, tags);
  }

  let applied = 0;
  for (const p of allProducts) {
    const exact = baseMap.get(p.product_id);
    if (exact) { p.fashion_tags = exact; applied++; continue; }
    const base = p.product_id.includes("__") ? p.product_id.split("__")[0] : p.product_id;
    const baseTags = baseMap.get(base);
    if (baseTags) { p.fashion_tags = baseTags; applied++; }
  }

  writeFileSync(filePath, JSON.stringify(allProducts, null, 2));
  return applied;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const filePath = resolve(DATA_DIR, SITE_KEY === "default" ? "products.json" : `products-${SITE_KEY}.json`);
if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

console.log(`\n[backfill-fashion-tags] Loading ${filePath}...`);
const products = JSON.parse(readFileSync(filePath, "utf8"));

// Deduplicate: process only first variant per base product
const basesSeen = new Set();
const toProcess = products.filter(p => {
  if (!FORCE && p.fashion_tags && Object.keys(p.fashion_tags).length >= 3) return false;
  const base = p.product_id.includes("__") ? p.product_id.split("__")[0] : p.product_id;
  if (basesSeen.has(base)) return false;
  basesSeen.add(base);
  return true;
});

const existingCount = products.filter(p => p.fashion_tags).length;
console.log(`[backfill-fashion-tags] ${products.length} total, ${existingCount} already have tags, ${toProcess.length} to process`);

if (toProcess.length === 0) {
  console.log("[backfill-fashion-tags] Nothing to do.");
  process.exit(0);
}

const tagsMap = new Map();

if (USE_VISION) {
  // Vision mode: use images for products that have them
  const withImage = toProcess.filter(p => p.image_url);
  const noImage = toProcess.filter(p => !p.image_url);
  console.log(`[backfill-fashion-tags] Vision mode: ${withImage.length} with image, ${noImage.length} text-only\n`);

  // Vision batches
  const vBatches = [];
  for (let i = 0; i < withImage.length; i += VISION_BATCH) vBatches.push(withImage.slice(i, i + VISION_BATCH));

  let vDone = 0;
  for (let i = 0; i < vBatches.length; i += VISION_CONCURRENCY) {
    const window = vBatches.slice(i, i + VISION_CONCURRENCY);
    const results = await Promise.all(window.map(b => generateVisionBatch(b)));
    results.forEach(r => r.forEach((v, k) => tagsMap.set(k, v)));
    vDone += window.reduce((s, b) => s + b.length, 0);
    process.stdout.write(`\r[vision] ${Math.min(vDone, withImage.length)}/${withImage.length}`);

    if ((i / VISION_CONCURRENCY) % 5 === 4) {
      applyAndSave(products, tagsMap, filePath);
      process.stdout.write(" (saved)");
    }
    if (i + VISION_CONCURRENCY < vBatches.length) {
      await new Promise(r => setTimeout(r, WINDOW_PAUSE_MS));
    }
  }
  if (withImage.length > 0) console.log();

  // Text batches for products without images
  if (noImage.length > 0) {
    const tBatches = [];
    for (let i = 0; i < noImage.length; i += TEXT_BATCH) tBatches.push(noImage.slice(i, i + TEXT_BATCH));

    let tDone = 0;
    for (let i = 0; i < tBatches.length; i += TEXT_CONCURRENCY) {
      const window = tBatches.slice(i, i + TEXT_CONCURRENCY);
      const results = await Promise.all(window.map(b => generateTextBatch(b)));
      results.forEach(r => r.forEach((v, k) => tagsMap.set(k, v)));
      tDone += window.reduce((s, b) => s + b.length, 0);
      process.stdout.write(`\r[text] ${Math.min(tDone, noImage.length)}/${noImage.length}`);
    }
    console.log();
  }
} else {
  // Text-only mode: use ai_description + metadata (cheap & fast)
  console.log(`[backfill-fashion-tags] Text mode: extracting tags from ai_description + metadata\n`);

  const batches = [];
  for (let i = 0; i < toProcess.length; i += TEXT_BATCH) batches.push(toProcess.slice(i, i + TEXT_BATCH));

  let done = 0;
  for (let i = 0; i < batches.length; i += TEXT_CONCURRENCY) {
    const window = batches.slice(i, i + TEXT_CONCURRENCY);
    const results = await Promise.all(window.map(b => generateTextBatch(b)));
    results.forEach(r => r.forEach((v, k) => tagsMap.set(k, v)));
    done += window.reduce((s, b) => s + b.length, 0);
    process.stdout.write(`\r[text] ${Math.min(done, toProcess.length)}/${toProcess.length} (${tagsMap.size} tags)`);

    // Save progress every 5 windows
    if ((i / TEXT_CONCURRENCY) % 5 === 4) {
      applyAndSave(products, tagsMap, filePath);
      process.stdout.write(" (saved)");
    }
  }
  console.log();
}

// Final save
const applied = applyAndSave(products, tagsMap, filePath);
const finalCount = products.filter(p => p.fashion_tags).length;

console.log(`\n[backfill-fashion-tags] Done!`);
console.log(`  ${tagsMap.size} tags generated, ${applied} products updated`);
console.log(`  ${finalCount}/${products.length} products now have fashion_tags`);
console.log(`  Saved to ${filePath}`);
console.log(`\nRestart the server to load the new tags.`);
