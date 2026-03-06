// Backfill AI descriptions for an existing catalog (run once).
// Usage: node scripts/backfill-descriptions.mjs <site_key>
// Example: node scripts/backfill-descriptions.mjs unreal

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const SITE_KEY = process.argv[2] || "unreal";
const BATCH_SIZE = 50;
const CONCURRENCY = 5;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = SITE_KEY === "default"
  ? path.join(DATA_DIR, "products.json")
  : path.join(DATA_DIR, `products-${SITE_KEY}.json`);

if (!fs.existsSync(FILE)) {
  console.error(`File not found: ${FILE}`);
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
Generate concise Hungarian product descriptions for a streetwear/fashion webshop.

Rules:
- 80-160 characters per description
- Include: color (from name/desc), material/fabric (if mentioned), cut/fit (oversized, slim, etc.), notable features or graphics
- Factual only — do NOT invent attributes not present in the product data
- Do NOT start with or repeat the product name or brand name
- Do NOT use generic phrases: "Remek választás", "Tökéletes", "Kiváló minőség", "Must-have", "Ajánlott"
- Write ONLY in Hungarian

Good examples:
✓ "Szürke, laza szabású nehéz pamut póló, cold dyed technikával, Eberkoma kolláborációs grafika."
✓ "Fehér washed organikus pamut póló, enyhén oversized szabás, portugál gyártás."
✓ "Fekete zip hoodie, 100% pamut, laza szabás, ikonikus logóval az elején."
✓ "Court Purple rövidnadrág, mélyzsebes kialakítás, streetwear stílusban."

Output JSON:
{
  "descriptions": [
    { "id": "<product_id>", "desc": "<Hungarian description>" }
  ]
}
`.trim();

function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function generateBatch(batch) {
  const productList = batch.map((p) => {
    let name = String(p.name || "");
    name = name.replace(/\s*\((?:[^()]*|\([^()]*\))*\)\s*$/, "").trim();
    name = name.replace(/\s*[-–\/|]\s*(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|\d{2,3})\s*$/i, "").trim();
    const desc = stripHtml(String(p.description || "")).slice(0, 200);
    const catLast = (p.category || "").includes(">")
      ? (p.category || "").split(">").pop().trim()
      : (p.category || "");
    return { id: p.product_id, name, category: catLast, desc };
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Generate Hungarian descriptions for these ${batch.length} products:\n${JSON.stringify(productList)}` },
        ],
        temperature: 0.4,
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
      const result = new Map();
      for (const item of (parsed.descriptions || [])) {
        if (item?.id && item?.desc && String(item.desc).length >= 30) {
          result.set(String(item.id), String(item.desc).slice(0, 200));
        }
      }
      return result;
    } catch (err) {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      console.error(`Batch failed after 3 attempts:`, err?.message || err);
      return new Map();
    }
  }
  return new Map();
}

console.log(`Loading catalog: ${FILE}`);
const products = JSON.parse(fs.readFileSync(FILE, "utf8"));
console.log(`Products: ${products.length}`);

const alreadyDone = products.filter(p => p.ai_description).length;
if (alreadyDone > 0) {
  console.log(`${alreadyDone} products already have ai_description, skipping those.`);
}

const todo = products.filter(p => !p.ai_description);
console.log(`Generating descriptions for ${todo.length} products in batches of ${BATCH_SIZE}...`);

// Split into batches
const batches = [];
for (let i = 0; i < todo.length; i += BATCH_SIZE) batches.push(todo.slice(i, i + BATCH_SIZE));

let total = 0;
let completed = 0;
for (let i = 0; i < batches.length; i += CONCURRENCY) {
  const window = batches.slice(i, i + CONCURRENCY);
  const results = await Promise.all(window.map(b => generateBatch(b)));
  for (let j = 0; j < window.length; j++) {
    const batch = window[j];
    const result = results[j];
    for (const p of batch) {
      const desc = result.get(p.product_id);
      if (desc) { p.ai_description = desc; total++; }
    }
  }
  completed += window.reduce((s, b) => s + b.length, 0);
  console.log(`${Math.min(completed, todo.length)}/${todo.length} done (${total} descriptions generated)`);
}

// Update in the full products array
const descMap = new Map(todo.map(p => [p.product_id, p.ai_description]));
for (const p of products) {
  if (!p.ai_description && descMap.has(p.product_id)) {
    p.ai_description = descMap.get(p.product_id);
  }
}

const finalCount = products.filter(p => p.ai_description).length;
console.log(`Writing ${products.length} products (${finalCount} with ai_description) back to file...`);
fs.writeFileSync(FILE, JSON.stringify(products), "utf8");
console.log(`Done! Restart the server to load the new descriptions.`);
