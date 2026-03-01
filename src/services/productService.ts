// src/services/productService.ts

import fs from "fs";
import path from "path";
import { Product } from "../models/Product";
import { cacheEmbeddings } from "../ai/embeddingIndex";

type CatalogMap = Record<string, Product[]>;

const catalogs: CatalogMap = {};

// ✅ DATA_DIR env támogatás (Render persistent diskhez)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");

// ✅ Embeddinget KÜLÖN könyvtárba mentjük a termékadatoktól
// Ez megszünteti a ~200MB-os JSON.stringify() memória csúcsot importkor.
const EMBEDDINGS_DIR = path.join(DATA_DIR, "embeddings");

/**
 * Gondoskodunk róla, hogy a data/ mappa létezzen.
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureEmbeddingsDir() {
  if (!fs.existsSync(EMBEDDINGS_DIR)) {
    fs.mkdirSync(EMBEDDINGS_DIR, { recursive: true });
  }
}

function getEmbeddingFilePath(siteKey: string): string {
  return path.join(EMBEDDINGS_DIR, `${siteKey}.json`);
}

// ✅ Katalógus darabszám cache – elkerüli a JSON fájlok teljes beolvasását
// a getCatalogSummaries() hívásakor.
const CATALOG_COUNTS_FILE = path.join(DATA_DIR, "catalog-counts.json");

function readCatalogCounts(): Record<string, number> {
  try {
    if (fs.existsSync(CATALOG_COUNTS_FILE)) {
      return JSON.parse(fs.readFileSync(CATALOG_COUNTS_FILE, "utf8"));
    }
  } catch (_) {}
  return {};
}

function writeCatalogCount(siteKey: string, count: number) {
  try {
    ensureDataDir();
    const counts = readCatalogCounts();
    counts[siteKey] = count;
    fs.writeFileSync(CATALOG_COUNTS_FILE, JSON.stringify(counts, null, 2), "utf8");
  } catch (_) {}
}

function removeCatalogCount(siteKey: string) {
  try {
    if (fs.existsSync(CATALOG_COUNTS_FILE)) {
      const counts = readCatalogCounts();
      delete counts[siteKey];
      fs.writeFileSync(CATALOG_COUNTS_FILE, JSON.stringify(counts, null, 2), "utf8");
    }
  } catch (_) {}
}

/**
 * ✅ Embeddingeket TERMÉKENKÉNT írjuk fájlba (nem egy óriási JSON.stringify-jal).
 * Ez azt jelenti, hogy memóriában egyszerre csak ~60KB van a kiírandó JSON string,
 * nem az egész ~200MB (3072 float × 1649 termék × UTF-16).
 */
function writeEmbeddingsToFile(products: Product[], filePath: string) {
  ensureEmbeddingsDir();
  const fd = fs.openSync(filePath, "w");
  try {
    fs.writeSync(fd, "[");
    let first = true;
    for (const p of products) {
      const emb = Array.isArray((p as any).embedding) ? (p as any).embedding : null;
      if (!emb) continue;
      if (!first) fs.writeSync(fd, ",");
      first = false;
      // Csak egy termék embeddingjét stringifjük egyszerre (~60KB), nem az összeset
      fs.writeSync(fd, JSON.stringify({ id: p.product_id, e: emb }));
    }
    fs.writeSync(fd, "]");
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Embedding fájl beolvasása. Map<product_id, embedding> visszaadva.
 * A ~101MB-os fájl egyszeri olvasás, de importkor már nem kell.
 */
function loadEmbeddingsFromFile(filePath: string): Map<string, number[]> {
  const map = new Map<string, number[]>();
  if (!fs.existsSync(filePath)) return map;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as { id: string; e: number[] }[];
    for (const item of data) {
      if (item.id && Array.isArray(item.e)) {
        map.set(item.id, item.e);
      }
    }
  } catch (err) {
    console.error(`[productService] Hiba az embedding fájl olvasásakor: ${filePath}`, err);
  }
  return map;
}

/**
 * Egy adott site_key katalógusának betöltése fájlrendszerből.
 * - default → products.json
 * - másik → products-<site_key>.json
 * ✅ Embeddingeket a data/embeddings/<siteKey>.json-ból tölti be külön.
 * ✅ Ha az öreg formátum (embeddingek a termék JSON-ban) van, automatikusan migrálja.
 */
function loadCatalogFromDisk(siteKey: string): Product[] {
  ensureDataDir();

  let fileName = "products.json";
  if (siteKey !== "default") {
    fileName = `products-${siteKey}.json`;
  }

  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.warn(
      `Termékfájl nem található [${siteKey}] alatt: ${filePath} – üres katalógus.`
    );
    return [];
  }

  try {
    console.log(`Termékek betöltése [${siteKey}] innen: ${filePath}`);
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      console.warn(
        `A termékfájl nem tömböt tartalmaz [${siteKey}]: ${filePath}`
      );
      return [];
    }

    const products: Product[] = data.map((p: any, idx: number) => ({
      product_id: p.product_id ?? `p_${siteKey}_${idx}`,
      name: p.name ?? "Ismeretlen termék",
      price: Number(p.price) || 0,
      price_currency: p.price_currency ?? undefined,
      category: p.category ?? "",
      description: p.description ?? "",
      image_url: p.image_url ?? "",
      product_url: p.product_url ?? "",

      // Shopify / CSV extra mezők
      tags: p.tags ?? undefined,
      product_type: p.product_type ?? undefined,
      vendor: p.vendor ?? undefined,

      // Embedding csak akkor, ha az öreg formátumban van
      embedding: Array.isArray(p.embedding) ? p.embedding : undefined,
    }));

    // ✅ Embedding betöltés: 1. külön fájlból, 2. ha nincs → migration az öreg formátumból
    const embFilePath = getEmbeddingFilePath(siteKey);
    const embMap = loadEmbeddingsFromFile(embFilePath);

    if (embMap.size > 0) {
      // Új formátum: embeddingek külön fájlból
      console.log(`[productService] Embedding betöltve [${siteKey}]: ${embMap.size} db`);
      const productsForCache = products.map((p) => ({
        ...p,
        embedding: embMap.get(p.product_id),
      }));
      cacheEmbeddings(siteKey, productsForCache);
    } else {
      // Öreg formátum: embeddingek a termék JSON-ban – migration
      const hasEmbeddings = products.some((p) => Array.isArray((p as any).embedding));
      if (hasEmbeddings) {
        console.log(
          `[productService] Migration: embeddingeket külön fájlba írjuk [${siteKey}]`
        );
        cacheEmbeddings(siteKey, products);
        try {
          // Embeddingek külön fájlba (termékenként, nem egy nagy stringify)
          writeEmbeddingsToFile(products, embFilePath);
          // Termékek újraírása EMBEDDING NÉLKÜL (kicsi fájl lesz)
          const productsNoEmb = products.map(({ embedding, ...rest }: any) => rest as Product);
          fs.writeFileSync(filePath, JSON.stringify(productsNoEmb), "utf8");
          console.log(
            `[productService] Migration kész [${siteKey}]: termékfájl újraírva embedding nélkül`
          );
        } catch (migErr) {
          console.error(`[productService] Migration hiba [${siteKey}]:`, migErr);
        }
      }
      // Ha sehol nincs embedding, az is rendben van
    }

    const productsWithoutEmb = products.map(({ embedding, ...rest }: any) => rest as Product);

    console.log(`Betöltött termékek száma [${siteKey}]: ${productsWithoutEmb.length}`);
    writeCatalogCount(siteKey, productsWithoutEmb.length);
    return productsWithoutEmb;
  } catch (err) {
    console.error(
      `Hiba történt a termékfájl betöltése közben [${siteKey}]:`,
      err
    );
    return [];
  }
}

/**
 * Visszaadja az adott site_key-hez tartozó termékeket.
 * Ha nincs ilyen katalógus vagy üres, a "default"-ot használja fallback-ként.
 */
export function getProductsForSite(siteKey: string): Product[] {
  const key = siteKey || "default";

  if (!catalogs[key]) {
    catalogs[key] = loadCatalogFromDisk(key);
  }

  if (catalogs[key] && catalogs[key].length > 0) {
    return catalogs[key];
  }

  // fallback: default katalógus
  if (!catalogs["default"]) {
    catalogs["default"] = loadCatalogFromDisk("default");
  }

  return catalogs["default"] || [];
}

/**
 * Admin import: teljes katalógus csere + opcionális fájlba írás.
 * ✅ A products*.json fájlba NEM írunk embeddinget (tiny file, tiny stringify).
 * ✅ Az embeddingeket külön fájlba írjuk termékenként (nincs óriás JSON.stringify).
 */
export function replaceCatalog(
  siteKey: string,
  products: Product[],
  persistToDisk = true
) {
  const key = siteKey || "default";

  // Embeddingeket cache-be, catalogs Map-ben csak metaadat
  cacheEmbeddings(key, products);
  const productsWithoutEmb = products.map(({ embedding, ...rest }: any) => rest as Product);
  catalogs[key] = productsWithoutEmb;

  console.log(
    `Katalógus frissítve [${key}], termékek száma: ${products.length}`
  );

  if (!persistToDisk) return;

  ensureDataDir();
  const fileName = key === "default" ? "products.json" : `products-${key}.json`;
  const filePath = path.join(DATA_DIR, fileName);

  try {
    // ✅ Termékek EMBEDDING NÉLKÜL → kicsi JSON, kicsi stringify, nincs OOM
    fs.writeFileSync(filePath, JSON.stringify(productsWithoutEmb), "utf8");
    console.log(`Katalógus fájlba írva [${key}]: ${filePath}`);
    writeCatalogCount(key, productsWithoutEmb.length);
  } catch (err) {
    console.error(
      `Nem sikerült fájlba írni a katalógust [${key}] – ${filePath}`,
      err
    );
  }

  // ✅ Embeddingeket KÜLÖN fájlba, termékenként (~60KB/termék, nem egy ~200MB string)
  try {
    const embFilePath = getEmbeddingFilePath(key);
    writeEmbeddingsToFile(products, embFilePath);
    console.log(`Embeddingek fájlba írva [${key}]: ${embFilePath}`);
  } catch (err) {
    console.error(
      `Nem sikerült fájlba írni az embeddingeket [${key}]:`,
      err
    );
  }
}

/**
 * Katalógus összefoglalók az admin HTML-nek.
 * ✅ Memória-optimalizált: NEM olvassa be a teljes termékfájlt a számláláshoz.
 * Prioritás: 1. in-memory → 2. catalog-counts.json sidecar → 3. teljes JSON parse (legacy)
 */
export function getCatalogSummaries(): { site_key: string; count: number }[] {
  ensureDataDir();

  const summaries: { site_key: string; count: number }[] = [];
  const precomputedCounts = readCatalogCounts();

  try {
    const files = fs.readdirSync(DATA_DIR);
    const productFiles = files.filter(
      (f) => f.startsWith("products") && f.endsWith(".json")
    );

    productFiles.forEach((fileName) => {
      let siteKey = "default";
      if (fileName !== "products.json") {
        // "products-<site_key>.json" → <site_key>
        siteKey = fileName.slice("products-".length, -".json".length);
      }

      // 1. In-memory katalógus – legjobb eset, nincs I/O
      if (catalogs[siteKey] !== undefined) {
        summaries.push({ site_key: siteKey, count: catalogs[siteKey].length });
        return;
      }

      // 2. Sidecar count fájlból – kis JSON, gyors
      if (precomputedCounts[siteKey] !== undefined) {
        summaries.push({ site_key: siteKey, count: precomputedCounts[siteKey] });
        return;
      }

      // 3. Fallback: teljes JSON parse (csak egyszer, legacy adatoknál)
      const filePath = path.join(DATA_DIR, fileName);
      try {
        console.log(`[productService] Első count [${siteKey}] – teljes fájl olvasás (csak egyszer)`);
        const raw = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(raw);
        const count = Array.isArray(data) ? data.length : 0;
        writeCatalogCount(siteKey, count);
        summaries.push({ site_key: siteKey, count });
      } catch (err) {
        console.error(
          `[productService] Nem sikerült beolvasni a katalógust [${siteKey}] (${filePath}):`,
          err
        );
        summaries.push({ site_key: siteKey, count: 0 });
      }
    });
  } catch (err) {
    console.error(
      "[productService] Hiba a katalógus összefoglalók olvasása közben:",
      err
    );
  }

  return summaries;
}

/**
 * Admin felület által használt katalógus-lista.
 */
export function listCatalogs(): { site_key: string; count: number }[] {
  return getCatalogSummaries();
}

/**
 * Régi kód kompatibilitás: default katalógus.
 */
export function getAllProducts(): Product[] {
  return getProductsForSite("default");
}

/**
 * Katalógus törlése.
 * - memóriából törli
 * - products-<site_key>.json fájlt törli (defaultot nem)
 * - embeddings/<site_key>.json fájlt törli
 */
export function deleteCatalog(siteKey: string) {
  const key = siteKey || "default";

  // memóriából
  if (catalogs[key]) {
    delete catalogs[key];
  }

  // default katalógust nem töröljük fájlból
  if (key === "default") {
    return;
  }

  ensureDataDir();
  const fileName = `products-${key}.json`;
  const filePath = path.join(DATA_DIR, fileName);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Katalógus fájl törölve [${key}]: ${filePath}`);
    }
    removeCatalogCount(key);
  } catch (err) {
    console.error(
      `Nem sikerült törölni a katalógus fájlt [${key}] – ${filePath}`,
      err
    );
  }

  // Embedding fájl törlése is
  const embFilePath = getEmbeddingFilePath(key);
  try {
    if (fs.existsSync(embFilePath)) {
      fs.unlinkSync(embFilePath);
      console.log(`Embedding fájl törölve [${key}]: ${embFilePath}`);
    }
  } catch (err) {
    console.error(
      `Nem sikerült törölni az embedding fájlt [${key}] – ${embFilePath}`,
      err
    );
  }
}
