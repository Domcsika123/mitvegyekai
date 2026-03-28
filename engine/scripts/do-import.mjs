// scripts/do-import.mjs
// Elküldi a sport-catalog-import.json-t a helyi szervernek.
// Használat: node scripts/do-import.mjs <admin-token>

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER = process.env.SERVER || "http://localhost:3001";
const token = process.argv[2];

if (!token) {
  console.error("❌ Hiányzó admin token! Használat: node scripts/do-import.mjs <admin-token>");
  process.exit(1);
}

const filePath = path.join(__dirname, "..", "data", "sport-catalog-import.json");
const raw = fs.readFileSync(filePath, "utf8");
const body = JSON.parse(raw);

if (body.site_key === "CSERE_EZT_A_SITE_KEY_RE") {
  console.error("❌ Cseréld le a site_key értékét a sport-catalog-import.json fájlban!");
  process.exit(1);
}

console.log(`📤 Import: ${body.items.length} termék → site_key="${body.site_key}" @ ${SERVER}`);
console.log("⏳ Ez néhány percig tarthat (embedding + AI leírások + típus kinyerés)...\n");

const res = await fetch(`${SERVER}/api/admin/import-products`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-admin-token": token,
  },
  body: raw,
});

const data = await res.json();

if (!res.ok) {
  console.error("❌ Import sikertelen:", data?.error || res.status);
  process.exit(1);
}

console.log("✅ Import kész!");
console.log(`   Termékek: ${data.count}`);
console.log(`   Embeddingek: ${data.embedded}`);
console.log(`   Típusok kinyerve: ${data.typesExtracted}`);
