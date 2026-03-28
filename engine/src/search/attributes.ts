// src/search/attributes.ts
// Positive attribute detection & hard-filtering on ai_description.
// Detects fashion attributes (pattern, fit, style) from free text and
// filters products whose ai_description confirms (or denies) the attribute.

import { Product, FashionTags } from "../models/Product";

/**
 * Each attribute has:
 *  - synonyms: words the user might type (HU + EN, accent-insensitive)
 *  - matchPattern: regex to find the attribute in ai_description (positive match)
 *  - antiPattern: regex that means the product explicitly LACKS this attribute
 *  - displayHU: Hungarian name for notice messages
 */
export interface AttributeDef {
  key: string;
  synonyms: RegExp;         // matches user free_text
  matchPattern: RegExp;     // matches ai_description → product HAS this attribute
  antiPattern?: RegExp;     // matches ai_description → product definitely LACKS it
  displayHU: string;
}

const _NLK = `n[eé]lk[uü]l[i]?`;

export const ATTRIBUTE_MAP: AttributeDef[] = [
  {
    key: "STRIPED",
    synonyms: /\bcs[ií]k(os|ás)?\b|\bstriped?\b/i,
    matchPattern: /cs[ií]kos|stripe/i,
    displayHU: "csíkos",
  },
  {
    key: "CHECKERED",
    synonyms: /\bkock[aá]s\b|\bcheck(ered)?\b|\bplaid\b|\btartan\b/i,
    matchPattern: /kock[aá]s|check|plaid|tartan/i,
    displayHU: "kockás",
  },
  {
    key: "OVERSIZED",
    synonyms: /\boversized?\b|\bb[őo]\s*szab[aá]s\b/i,
    matchPattern: /oversized?|b[őo] szab[aá]s/i,
    displayHU: "oversized",
  },
  {
    key: "SLIM",
    synonyms: /\bslim\s*fit\b|\bszűk\b|\bsz[uú]k\b/i,
    matchPattern: /slim\s*fit|szűk/i,
    displayHU: "slim fit",
  },
  {
    key: "PRINTED",
    synonyms: /\bnyomott\b|\bprinted\b|\bgrafik[aá]s?\b|\bgraphic\b/i,
    matchPattern: /nyomott|grafik|graphic|printed/i,
    antiPattern: new RegExp(`grafika[\\s\\-]*${_NLK}|nyomat[\\s\\-]*${_NLK}`, "i"),
    displayHU: "nyomott/grafikás",
  },
  {
    key: "LOGO",
    synonyms: /\blog[oó]s\b|\blog[oó]val\b|\bwith\s*logo\b/i,
    matchPattern: /log[oó]val|log[oó]s|kis log[oó]|nagy log[oó]|hímzett log[oó]/i,
    antiPattern: new RegExp(`log[oó][\\s\\-]*${_NLK}`, "i"),
    displayHU: "logós",
  },
  {
    key: "PLAIN",
    synonyms: /\begysz[ií]n[uű]\b|\bsima\b|\bplain\b|\bletisztult\b|\bminimalista\b/i,
    matchPattern: /egysz[ií]n[uű]|sima|letisztult|minimalista|logo n[eé]lk|grafika n[eé]lk/i,
    displayHU: "egyszínű/sima",
  },
  {
    key: "EMBROIDERED",
    synonyms: /\bh[ií]mzett\b|\bembroidere?d?\b/i,
    matchPattern: /h[ií]mzett|embroider/i,
    displayHU: "hímzett",
  },
  {
    key: "WASHED",
    synonyms: /\bwashed\b|\bmosott\b|\bacid\s*wash\b/i,
    matchPattern: /washed|mosott|acid.?wash/i,
    displayHU: "washed",
  },
  {
    key: "KNITTED",
    synonyms: /\bk[oö]t[oö]tt\b|\bknit(ted)?\b/i,
    matchPattern: /k[öo]t[öo]tt|knit/i,
    displayHU: "kötött",
  },
  {
    key: "MESH",
    synonyms: /\bmesh\b|\bháló(s)?\b/i,
    matchPattern: /mesh|háló/i,
    displayHU: "mesh/hálós",
  },
  {
    key: "LEOPARD",
    synonyms: /\bleopárd(os|mint[aá]s)?\b|\bleopard\b/i,
    matchPattern: /leopárd|leopard/i,
    displayHU: "leopárdmintás",
  },
  {
    key: "TIE_DYE",
    synonyms: /\btie[- ]?dye\b|\bbatikolt\b/i,
    matchPattern: /tie[- ]?dye|batikolt/i,
    displayHU: "tie-dye",
  },
  {
    key: "FLORAL",
    synonyms: /\bvir[aá]g(os|mint[aá]s)?\b|\bfloral\b/i,
    matchPattern: /vir[aá]g|floral/i,
    displayHU: "virágmintás",
  },
  {
    key: "CAMO",
    synonyms: /\bterepmint[aá]s?\b|\bcamo(uflage)?\b/i,
    matchPattern: /terepmin|camo/i,
    displayHU: "terepmintás",
  },
  // ── Visual style / concept attributes ──
  // These map natural language style descriptions to visual properties in ai_description
  {
    key: "SPORTY",
    synonyms: /\bsport(os|y)?\b|\batl[eé]tik(us|ai)?\b|\bedzős?\b|\bathletic\b|\bfitness\b/i,
    matchPattern: /sport|athletic|slim\s*fit|fitness|dri[- ]?fit|edz[őo]/i,
    displayHU: "sportos",
  },
  {
    key: "ELEGANT",
    synonyms: /\beleg[aá]ns\b|\bclassy\b|\bformal\b|\b[uü]nnepi\b|\balkalmira?\b/i,
    matchPattern: /eleg[aá]ns|formal|letiszt[uú]lt|slim\s*fit|finom/i,
    displayHU: "elegáns",
  },
  {
    key: "CASUAL",
    synonyms: /\blaza\b|\bcasual\b|\bk[eé]nyelmes\b|\brelaxed\b|\bhétköznapi\b|\bh[eé]tk[oö]znapi\b/i,
    matchPattern: /laza|casual|relaxed|oversized?|b[őo] szab[aá]s|k[eé]nyelmes|loose/i,
    displayHU: "laza/kényelmes",
  },
  {
    key: "BOLD",
    synonyms: /\bfelt[uű]n[oő]\b|\bvag[aá]ny\b|\bl[aá]tv[aá]nyos\b|\bbold\b|\beye[- ]?catching\b|\bstatement\b/i,
    matchPattern: /nagy log[oó]|teli nyomott|felt[uű]n[oő]|grafik|nagy minta|vag[aá]ny/i,
    displayHU: "feltűnő",
  },
  {
    key: "VINTAGE",
    synonyms: /\bvintage\b|\bretro\b|\br[eé]gi\b|\bnostalgikus?\b|\bold[- ]?school\b/i,
    matchPattern: /vintage|retro|washed|acid|old.?school|nostalgik/i,
    displayHU: "vintage/retro",
  },
  {
    key: "SIMPLE",
    synonyms: /\begyszer[uű]\b|\bbasic\b|\bsimple\b|\bminimal(ista)?\b|\bletiszt[uú]lt\b/i,
    matchPattern: /egysz[ií]n[uű]|logo n[eé]lk|grafika n[eé]lk|sima|letiszt|minimal|egyszer[uű]/i,
    antiPattern: /teli nyomott|nagy log[oó]|grafik[aá]val|mint[aá]s/i,
    displayHU: "egyszerű/minimalista",
  },
  {
    key: "STREETWEAR",
    synonyms: /\bstreetwear\b|\burban\b|\butcai\b|\bsk8\b|\bskater?\b|\bsk[eé]ter?\b/i,
    matchPattern: /streetwear|urban|utcai|skate|graffiti|hip.?hop|oversized/i,
    displayHU: "streetwear/utcai",
  },
  {
    key: "HEAVY",
    synonyms: /\bneh[eé]z\b|\bvastag\b|\bheavy\b|\bthick\b|\bheavyweight\b|\bt[eé]li(es)?\b/i,
    matchPattern: /neh[eé]z|vastag|heavy|thick|heavyweight|t[eé]li|meleg|fle[eé]ce/i,
    displayHU: "nehéz/vastag",
  },
  {
    key: "LIGHT",
    synonyms: /\bk[oö]nny[uű]\b|\bv[eé]kony\b|\blight(weight)?\b|\bthin\b|\bny[aá]ri(as)?\b|\bl[eé]gies\b/i,
    matchPattern: /k[öo]nny[uű]|v[eé]kony|light|thin|ny[aá]ri|l[eé]gies|mesh|h[aá]l[oó]s/i,
    displayHU: "könnyű/vékony",
  },
  {
    key: "FELIRAT",
    synonyms: /\bfelirat(os|tal)?\b|\btext\b|\bwriting\b|\bsz[oö]veg(es)?\b/i,
    matchPattern: /felirat(?!\s*n[eé]lk)|szöveg|text|writing/i,
    antiPattern: new RegExp(`felirat[\\s\\-]*${_NLK}`, "i"),
    displayHU: "feliratos",
  },
  {
    key: "PATTERNED",
    synonyms: /\bmint[aá]s\b|\bpatterned\b/i,
    matchPattern: /mint[aá]s|mintával|patterned|teli nyomott/i,
    antiPattern: new RegExp(`minta[\\s\\-]*${_NLK}`, "i"),
    displayHU: "mintás",
  },
];

/**
 * Detect positive attributes from user free text.
 * Returns matching AttributeDef entries.
 */
export function detectAttributes(freeText: string): AttributeDef[] {
  if (!freeText) return [];
  const found: AttributeDef[] = [];
  for (const attr of ATTRIBUTE_MAP) {
    if (attr.synonyms.test(freeText)) {
      found.push(attr);
    }
  }
  return found;
}

// ── fashion_tags → attribute key mapping ──
// Maps attribute keys to fashion_tags field checks for precise structured matching
const ATTR_TO_FASHION_TAGS: Record<string, (tags: FashionTags) => boolean | undefined> = {
  STRIPED:     (t) => t.pattern === "striped",
  CHECKERED:   (t) => t.pattern === "checkered",
  OVERSIZED:   (t) => t.fit === "oversized" || t.fit === "relaxed",
  SLIM:        (t) => t.fit === "slim",
  PRINTED:     (t) => t.graphic !== "none" && t.graphic !== undefined,
  LOGO:        (t) => t.logo !== "none" && t.logo !== undefined,
  PLAIN:       (t) => {
    // "egyszínű/sima" = no loud elements, small/embroidered logo OK
    const quietLogo = t.logo === "none" || t.logo === "small" || t.logo === "embroidered";
    const noGraphic = t.graphic === "none" || t.graphic === undefined;
    const solidPattern = t.pattern === "solid" || t.pattern === undefined;
    return quietLogo && noGraphic && solidPattern;
  },
  EMBROIDERED: (t) => t.logo === "embroidered",
  WASHED:      (t) => t.style?.includes("vintage"),
  KNITTED:     (t) => t.material === "wool",
  MESH:        (t) => t.material === "mesh",
  LEOPARD:     (t) => t.pattern === "leopard",
  TIE_DYE:     (t) => t.pattern === "tie_dye",
  FLORAL:      (t) => t.pattern === "floral",
  CAMO:        (t) => t.pattern === "camo",
  SPORTY:      (t) => !!t.style?.includes("sporty"),
  ELEGANT:     (t) => {
    if (t.style?.includes("elegant")) return true;
    // Visually clean + not sporty/bold = can be elegant
    const quietLogo = t.logo === "none" || t.logo === "small" || t.logo === "embroidered";
    const noLoudGraphic = t.graphic === "none" || t.graphic === "small_print" || t.graphic === undefined;
    const solidPattern = t.pattern === "solid" || t.pattern === undefined;
    const notSporty = !t.style?.includes("sporty") && !t.style?.includes("bold") && !t.style?.includes("grunge");
    return quietLogo && noLoudGraphic && solidPattern && notSporty;
  },
  CASUAL:      (t) => !!t.style?.includes("casual"),
  BOLD:        (t) => !!t.style?.includes("bold") || t.graphic === "all_over" || t.logo === "large",
  VINTAGE:     (t) => !!t.style?.includes("vintage") || !!t.style?.includes("retro"),
  SIMPLE:      (t) => {
    // "minimalist/egyszerű" = style says so, OR visually clean product
    if (t.style?.includes("minimalist")) return true;
    // Strict: all three clean → definitely minimal
    if (t.logo === "none" && t.graphic === "none" && t.pattern === "solid") return true;
    // Relaxed: no loud elements — small logo or embroidered OK, no graphic, solid pattern
    const quietLogo = t.logo === "none" || t.logo === "small" || t.logo === "embroidered";
    const noGraphic = t.graphic === "none" || t.graphic === undefined;
    const solidPattern = t.pattern === "solid" || t.pattern === undefined;
    return quietLogo && noGraphic && solidPattern;
  },
  STREETWEAR:  (t) => !!t.style?.includes("streetwear") || !!t.style?.includes("skater") || !!t.style?.includes("hip_hop"),
  HEAVY:       (t) => t.weight === "heavy",
  LIGHT:       (t) => t.weight === "light",
  FELIRAT:     (t) => t.graphic === "text",
  PATTERNED:   (t) => t.pattern !== "solid" && t.pattern !== undefined,
};

// Anti-checks: if true, product definitely DOES NOT match
const ATTR_ANTI_FASHION_TAGS: Record<string, (tags: FashionTags) => boolean | undefined> = {
  PRINTED:   (t) => t.graphic === "none",
  LOGO:      (t) => t.logo === "none",
  SIMPLE:    (t) => t.graphic === "all_over" || t.logo === "large" || !!t.style?.includes("bold"),
  FELIRAT:   (t) => t.graphic === "none",
  PATTERNED: (t) => t.pattern === "solid",
};

/**
 * Check if a product matches an attribute.
 * Uses structured fashion_tags if available (precise), falls back to ai_description regex.
 */
export function productMatchesAttribute(product: Product, attr: AttributeDef): boolean {
  const fashionTags = (product as any).fashion_tags as FashionTags | undefined;

  // ── Structured matching (preferred — precise) ──
  if (fashionTags && Object.keys(fashionTags).length > 0) {
    // Anti-check first
    const antiCheck = ATTR_ANTI_FASHION_TAGS[attr.key];
    if (antiCheck && antiCheck(fashionTags)) return false;

    const check = ATTR_TO_FASHION_TAGS[attr.key];
    if (check) return !!check(fashionTags);
  }

  // ── Fallback: ai_description regex matching ──
  const desc = ((product as any).ai_description || "").toLowerCase();
  if (!desc) return false;

  if (attr.antiPattern && attr.antiPattern.test(desc)) return false;
  return attr.matchPattern.test(desc);
}

/**
 * Apply positive attribute hard filter.
 * Returns { matched, unmatched } where:
 *  - matched: products that confirm ALL detected attributes
 *  - unmatched: products that don't match (for also_items fallback)
 */
export function applyPositiveAttributeFilter(
  products: Product[],
  attrs: AttributeDef[]
): { matched: Product[]; unmatched: Product[] } {
  if (attrs.length === 0) return { matched: products, unmatched: [] };

  const matched: Product[] = [];
  const unmatched: Product[] = [];

  for (const p of products) {
    const allMatch = attrs.every((attr) => productMatchesAttribute(p, attr));
    if (allMatch) {
      matched.push(p);
    } else {
      unmatched.push(p);
    }
  }

  return { matched, unmatched };
}

/**
 * Get Hungarian display names for detected attributes (for notice messages).
 */
export function getAttributeDisplayNames(attrs: AttributeDef[]): string {
  return attrs.map((a) => a.displayHU).join(", ");
}
