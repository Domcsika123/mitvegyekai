// src/models/Product.ts

/**
 * Structured fashion tags extracted at import time by AI vision/text analysis.
 * Each field has a fixed set of possible values for precise deterministic matching.
 */
export interface FashionTags {
  fit?: "oversized" | "relaxed" | "regular" | "slim" | "boxy" | "cropped";
  logo?: "none" | "small" | "large" | "embroidered" | "printed";
  graphic?: "none" | "small_print" | "all_over" | "text" | "abstract" | "photo";
  pattern?: "solid" | "striped" | "checkered" | "dotted" | "floral" | "camo" | "tie_dye" | "leopard" | "abstract" | "colorblock";
  style?: string[];  // e.g. ["streetwear", "casual"] — multiple allowed
  weight?: "light" | "medium" | "heavy";
  material?: string; // e.g. "cotton", "polyester", "fleece"
  color?: string;    // primary color in English: "black", "white", "grey", "blue" etc.
}

/** All recognized style values for FashionTags.style */
export const FASHION_STYLES = [
  "casual", "sporty", "elegant", "streetwear", "vintage", "minimalist",
  "bold", "preppy", "grunge", "workwear", "skater", "hip_hop", "retro",
] as const;

export type Product = {
  product_id: string;
  name: string;
  price: number;
  category: string;        // pl. "sport", "tech", "alcohol", "erotic", stb.
  image_url?: string;      // opcionális
  product_url?: string;    // termékoldal linkje
  description?: string;    // rövid leírás

  // ✅ Shopify / CSV importból származó extra mezők
  tags?: string;           // vesszővel elválasztott tag-ek (pl. "kék, férfi, pamut")
  product_type?: string;   // pl. "Pulóver", "T-Shirt"
  vendor?: string;         // márka / gyártó
  visual_tags?: string;    // pl. "kék, férfi, pamut"

  // ✅ Importkor töltjük (előre legyártott termék embedding)
  embedding?: number[];

  // ✅ Import-time AI description (Hungarian, generated once, used as reason at recommendation time)
  ai_description?: string;

  // ✅ Import-time structured fashion tags (deterministic matching at search time)
  fashion_tags?: FashionTags;
};
