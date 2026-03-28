// src/ai/visual.ts
// Visual attribute extraction from product images using GPT-4o-mini vision.

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Analyze a product image and return visual attribute tags.
 * Returns a string of comma-separated tags (e.g. "logo nélküli, oversized, egyszínű")
 * or null if analysis fails.
 */
export async function describeImage(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You analyze fashion/streetwear product images and extract visual attributes as comma-separated Hungarian tags.

Detect these attributes:
- Logo: "logo nélküli" / "kis logóval" / "nagy logóval" / "logós"
- Graphics: "nyomott grafikával" / "felirattal" / "grafika nélküli" / "teli nyomott mintával"
- Fit: "oversized" / "bő szabás" / "slim fit" / "normál szabás"
- Pattern: "egyszínű" / "csíkos" / "kockás" / "mintás" / "tie-dye"
- Color: the dominant color in Hungarian (e.g. "fekete", "fehér", "szürke")

Output ONLY comma-separated tags, nothing else. Example:
fekete, logo nélküli, oversized, egyszínű`,
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      });

      const tags = response.choices[0]?.message?.content?.trim() || null;
      return tags;
    } catch (err: any) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      console.error(`[visual] describeImage failed:`, err?.message || err);
      return null;
    }
  }
  return null;
}
