// scripts/reextract-types.mjs
// Újrafuttatja a típus kinyerést egy már importált katalóguson.
// Használat: node scripts/reextract-types.mjs <site_key> <admin-token>

const siteKey = process.argv[2];
const token = process.argv[3];
const SERVER = process.env.SERVER || "http://localhost:3001";

if (!siteKey || !token) {
  console.error("Használat: node scripts/reextract-types.mjs <site_key> <admin-token>");
  process.exit(1);
}

// Katalógus lekérése
console.log(`📂 Katalógus lekérése: ${siteKey}...`);
const catRes = await fetch(`${SERVER}/api/admin/catalogs/${siteKey}/products`, {
  headers: { "x-admin-token": token },
});

if (!catRes.ok) {
  // Fallback: import endpoint-on keresztül csak 1 termékkel (nem érdemes)
  // Ehelyett a widget-config apply-preset után külön típus-kinyerés endpoint kell
  console.error("❌ Nincs /catalogs/:siteKey/products endpoint. Használd az import újrafuttatását.");
  process.exit(1);
}
