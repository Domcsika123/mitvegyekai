// scripts/generate-sport-catalog.mjs
// Generates a ~1000-product sport/fitness catalog for testing type extraction.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRANDS = [
  "Nike", "Adidas", "Puma", "Under Armour", "Asics", "New Balance",
  "Reebok", "Salomon", "The North Face", "Columbia", "Mammut", "Odlo",
  "Craft", "Mizuno", "Brooks", "Saucony", "Hoka", "On Running",
];

const COLORS = [
  "Black", "White", "Navy Blue", "Red", "Grey", "Green",
  "Orange", "Blue", "Pink", "Purple", "Yellow", "Olive",
];

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const SHOE_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];

const PRODUCT_TYPES = [
  {
    type: "Running Shoes",
    category: "Sports & Fitness > Footwear > Running Shoes",
    basePrice: [18000, 45000],
    tags: "running, shoes, footwear, jogging",
    nameFn: (brand, color) => `${brand} ${pick(["Air", "Gel", "Wave", "Fresh Foam", "Boost", "Cloudboom", "Kinvara"])} ${color} Futócipő`,
    desc: (brand, color) => `${brand} könnyű futócipő ${color.toLowerCase()} színben. Légáteresztő felsőrész, energiavisszatérítő talpközép, hosszú futásokhoz tervezve.`,
    sizes: SHOE_SIZES,
  },
  {
    type: "Training Shoes",
    category: "Sports & Fitness > Footwear > Training Shoes",
    basePrice: [15000, 38000],
    tags: "training, shoes, gym, crossfit",
    nameFn: (brand, color) => `${brand} ${pick(["Metcon", "Nano", "TR", "Flex", "Trainer"])} ${color} Edzőcipő`,
    desc: (brand, color) => `${brand} stabil edzőcipő ${color.toLowerCase()} színben. Széles talpfelület, lapos sarok, cross-training és teremedzéshez.`,
    sizes: SHOE_SIZES,
  },
  {
    type: "Trail Running Shoes",
    category: "Sports & Fitness > Footwear > Trail Running Shoes",
    basePrice: [22000, 52000],
    tags: "trail, running, shoes, outdoor, hiking",
    nameFn: (brand, color) => `${brand} ${pick(["Speedcross", "Wildcross", "Peregrine", "Calvera"])} ${color} Terepfutó Cipő`,
    desc: (brand, color) => `${brand} terepfutó cipő ${color.toLowerCase()} színben. Agresszív talpmintázat, vízálló membrán, hegyi és erdei futásokhoz.`,
    sizes: SHOE_SIZES,
  },
  {
    type: "Running T-Shirt",
    category: "Sports & Fitness > Clothing > Running > T-Shirts",
    basePrice: [5000, 18000],
    tags: "running, t-shirt, top, lightweight",
    nameFn: (brand, color) => `${brand} ${pick(["Dri-Fit", "Climalite", "DryMove", "Swift"])} ${color} Futópóló`,
    desc: (brand, color) => `${brand} technikai futópóló ${color.toLowerCase()} színben. Nedvességelvezető anyag, lapos varratok, könnyű és szellős viselet.`,
    sizes: CLOTHING_SIZES,
  },
  {
    type: "Running Shorts",
    category: "Sports & Fitness > Clothing > Running > Shorts",
    basePrice: [5500, 16000],
    tags: "running, shorts, lightweight, split",
    nameFn: (brand, color) => `${brand} ${pick(["Split", "Stride", "Challenger", "Tempo"])} ${color} Futónadrág`,
    desc: (brand, color) => `${brand} futónadrág ${color.toLowerCase()} színben. Beépített alsónadrág, oldalt hasíték, kis belső zseb kulcshoz.`,
    sizes: CLOTHING_SIZES,
  },
  {
    type: "Leggings",
    category: "Sports & Fitness > Clothing > Leggings",
    basePrice: [7000, 22000],
    tags: "leggings, tights, running, yoga, training",
    nameFn: (brand, color) => `${brand} ${pick(["Pro", "Power", "Flow", "Fast"])} ${color} Leggings`,
    desc: (brand, color) => `${brand} kompressziós leggings ${color.toLowerCase()} színben. Magas derék, nedvességelvezető anyag, futáshoz és edzéshez.`,
    sizes: CLOTHING_SIZES,
  },
  {
    type: "Sports Bra",
    category: "Sports & Fitness > Clothing > Sports Bra",
    basePrice: [6000, 20000],
    tags: "sports bra, bra, running, training, women",
    nameFn: (brand, color) => `${brand} ${pick(["Impact", "Flyaway", "Limitless", "Rival"])} ${color} Sportmelltartó`,
    desc: (brand, color) => `${brand} sportmelltartó ${color.toLowerCase()} színben. Állítható pántok, kivehető betétek, közepes/magas tartás.`,
    sizes: CLOTHING_SIZES,
  },
  {
    type: "Softshell Jacket",
    category: "Sports & Fitness > Clothing > Jackets > Softshell",
    basePrice: [18000, 55000],
    tags: "jacket, softshell, outdoor, running, windproof",
    nameFn: (brand, color) => `${brand} ${pick(["Storm", "Shield", "Element", "Resist"])} ${color} Softshell Kabát`,
    desc: (brand, color) => `${brand} softshell kabát ${color.toLowerCase()} színben. Szélálló, vízlepergető, légáteresztő anyag, könnyű és mozgásbarát.`,
    sizes: CLOTHING_SIZES,
  },
  {
    type: "Fleece",
    category: "Sports & Fitness > Clothing > Fleece",
    basePrice: [12000, 38000],
    tags: "fleece, jacket, outdoor, hiking, warm",
    nameFn: (brand, color) => `${brand} ${pick(["100", "200", "Polartec", "Grid"])} ${color} Fleece`,
    desc: (brand, color) => `${brand} fleece felső ${color.toLowerCase()} színben. Közepes meleg, könnyű, gyorsan szárad, kiváló rétegezési darab.`,
    sizes: CLOTHING_SIZES,
  },
  {
    type: "Compression Socks",
    category: "Sports & Fitness > Clothing > Socks",
    basePrice: [2500, 8000],
    tags: "socks, compression, running, cycling, recovery",
    nameFn: (brand, color) => `${brand} ${pick(["Run", "Bike", "Recovery", "Performance"])} ${color} Kompressziós Zokni`,
    desc: (brand, color) => `${brand} kompressziós sportszokni ${color.toLowerCase()} színben. Anatomikus kialakítás, csúszásgátló talprész, fokozott sarok- és bokavédelem.`,
    sizes: ["S/M", "M/L", "L/XL"],
  },
  {
    type: "Yoga Mat",
    category: "Sports & Fitness > Equipment > Yoga > Mats",
    basePrice: [6000, 28000],
    tags: "yoga, mat, pilates, fitness, non-slip",
    nameFn: (brand, color) => `${brand} ${pick(["Pro", "Studio", "Align", "Reversible"])} ${color} Jógaszőnyeg`,
    desc: (brand, color) => `${brand} jógaszőnyeg ${color.toLowerCase()} színben. Csúszásgátló felület, 4-6mm vastag, könnyű és könnyen hordozható.`,
    sizes: ["Standard (173x61cm)", "Large (183x68cm)"],
  },
  {
    type: "Resistance Band",
    category: "Sports & Fitness > Equipment > Strength Training > Resistance Bands",
    basePrice: [1500, 12000],
    tags: "resistance band, elastic, strength, rehabilitation",
    nameFn: (brand, color) => `${brand} ${pick(["Loop", "Fabric", "Mini", "Hip"])} ${color} Erősítő Gumiszalag`,
    desc: (brand, color) => `${brand} erősítő gumiszalag ${color.toLowerCase()} színben. ${pick(["Könnyű", "Közepes", "Erős", "Extra erős"])} ellenállás, rehabilitációhoz és edzéshez.`,
    sizes: ["Light", "Medium", "Heavy", "X-Heavy"],
  },
  {
    type: "Dumbbell",
    category: "Sports & Fitness > Equipment > Strength Training > Dumbbells",
    basePrice: [2000, 25000],
    tags: "dumbbell, weight, strength, gym",
    nameFn: (brand, color) => `${brand} ${pick(["Pro", "Chrome", "Rubber", "Neoprene"])} ${color} Kézisúlyzó`,
    desc: (brand, color) => `${brand} kézisúlyzó ${color.toLowerCase()} színben. Csúszásgátló markolat, tartós gumi bevonat, párban kapható.`,
    sizes: ["2kg", "4kg", "6kg", "8kg", "10kg", "12kg", "15kg", "20kg"],
  },
  {
    type: "Kettlebell",
    category: "Sports & Fitness > Equipment > Strength Training > Kettlebells",
    basePrice: [4000, 30000],
    tags: "kettlebell, strength, functional, swing",
    nameFn: (brand, color) => `${brand} ${pick(["Cast Iron", "Powder Coat", "Competition", "Pro"])} ${color} Kettlebell`,
    desc: (brand, color) => `${brand} kettlebell ${color.toLowerCase()} bevonattal. Öntöttvas mag, sima szélű fogantyú, egyensúlyedzéshez és erőfejlesztéshez.`,
    sizes: ["8kg", "12kg", "16kg", "20kg", "24kg", "28kg", "32kg"],
  },
  {
    type: "Gym Bag",
    category: "Sports & Fitness > Bags > Gym Bags",
    basePrice: [8000, 30000],
    tags: "gym bag, duffel, sports bag, training",
    nameFn: (brand, color) => `${brand} ${pick(["Duffel", "Tote", "Striker", "Stadium"])} ${color} Sporttáska`,
    desc: (brand, color) => `${brand} sporttáska ${color.toLowerCase()} színben. Cipőtartó rekesz, nedves rész, állítható vállszíj, 30-50 literes kapacitás.`,
    sizes: ["S (30L)", "M (40L)", "L (50L)"],
  },
  {
    type: "Backpack",
    category: "Sports & Fitness > Bags > Backpacks",
    basePrice: [12000, 55000],
    tags: "backpack, running, trail, hydration, hiking",
    nameFn: (brand, color) => `${brand} ${pick(["Trail", "Sense", "Agile", "Active"])} ${color} Hátizsák`,
    desc: (brand, color) => `${brand} sport hátizsák ${color.toLowerCase()} színben. Hidratálóhólyag-kompatibilis, mellső zsebbel, futáshoz és túrához tervezve.`,
    sizes: ["10L", "15L", "20L", "25L"],
  },
  {
    type: "Water Bottle",
    category: "Sports & Fitness > Accessories > Water Bottles",
    basePrice: [2500, 12000],
    tags: "water bottle, hydration, BPA-free, sports",
    nameFn: (brand, color) => `${brand} ${pick(["Chute Mag", "Wide Mouth", "Flip-Top", "Squeeze"])} ${color} Kulacs`,
    desc: (brand, color) => `${brand} sportkulacs ${color.toLowerCase()} színben. BPA-mentes, szivárgásmentes zár, dupla falú, 500-750ml.`,
    sizes: ["500ml", "600ml", "750ml", "1L"],
  },
  {
    type: "Sports Cap",
    category: "Sports & Fitness > Accessories > Caps",
    basePrice: [3500, 12000],
    tags: "cap, hat, running, sun protection, sport",
    nameFn: (brand, color) => `${brand} ${pick(["Dri-Fit", "AeroReady", "Performance", "Stretch"])} ${color} Sportssapka`,
    desc: (brand, color) => `${brand} sportkozmetika ${color.toLowerCase()} színben. Nedvességelvezető anyag, állítható hátrész, UV-szűrős napellenző.`,
    sizes: ["S/M", "M/L", "One Size"],
  },
  {
    type: "Cycling Shorts",
    category: "Sports & Fitness > Cycling > Clothing > Shorts",
    basePrice: [9000, 28000],
    tags: "cycling, shorts, padded, bib, road bike",
    nameFn: (brand, color) => `${brand} ${pick(["Rival", "Endurance", "GF", "Attack"])} ${color} Kerékpáros Nadrág`,
    desc: (brand, color) => `${brand} kerékpáros nadrág ${color.toLowerCase()} színben. Beépített párnázott betét, kompressziós anyag, lapos varratok.`,
    sizes: CLOTHING_SIZES,
  },
  {
    type: "Cycling Jersey",
    category: "Sports & Fitness > Cycling > Clothing > Jerseys",
    basePrice: [12000, 35000],
    tags: "cycling, jersey, road bike, aero, breathable",
    nameFn: (brand, color) => `${brand} ${pick(["Pro Team", "Aero", "Gravel", "Endurance"])} ${color} Kerékpáros Mez`,
    desc: (brand, color) => `${brand} kerékpáros mez ${color.toLowerCase()} színben. Aerodinamikus szabás, hátul 3 zseb, cipzáras nyak, könnyű és szellős anyag.`,
    sizes: CLOTHING_SIZES,
  },
  {
    type: "Swim Goggles",
    category: "Sports & Fitness > Swimming > Goggles",
    basePrice: [3000, 15000],
    tags: "swimming, goggles, pool, triathlon, open water",
    nameFn: (brand, color) => `${brand} ${pick(["Velocity", "Aqua Sphere", "Nemesis", "Vanquisher"])} ${color} Úszószemüveg`,
    desc: (brand, color) => `${brand} úszószemüveg ${color.toLowerCase()} kerettel. Anti-fog bevonat, UV-szűrő, állítható ornyereg, triatlonhoz és versenyúszáshoz.`,
    sizes: ["Junior", "Adult"],
  },
  {
    type: "Swim Cap",
    category: "Sports & Fitness > Swimming > Caps",
    basePrice: [1500, 6000],
    tags: "swimming, cap, silicone, pool",
    nameFn: (brand, color) => `${brand} ${pick(["Comfort", "Elite", "Junior", "Pro"])} ${color} Úszósapka`,
    desc: (brand, color) => `${brand} szilikon úszósapka ${color.toLowerCase()} színben. Rugalmas és tartós anyag, hajvédelem, csökkenti a vízellenállást.`,
    sizes: ["Junior", "Adult"],
  },
  {
    type: "Foam Roller",
    category: "Sports & Fitness > Recovery > Foam Rollers",
    basePrice: [4000, 18000],
    tags: "foam roller, recovery, massage, muscle, myofascial",
    nameFn: (brand, color) => `${brand} ${pick(["Grid", "Rumble", "Deep Tissue", "Smooth"])} ${color} Masszázsrúd`,
    desc: (brand, color) => `${brand} habhengerező ${color.toLowerCase()} színben. Izmok lazításához és regenerációhoz, 30-90cm, különböző felületi mintázattal.`,
    sizes: ["Short (30cm)", "Medium (45cm)", "Long (90cm)"],
  },
  {
    type: "Skipping Rope",
    category: "Sports & Fitness > Equipment > Cardio > Skipping Ropes",
    basePrice: [2000, 9000],
    tags: "skipping rope, jump rope, cardio, boxing, crossfit",
    nameFn: (brand, color) => `${brand} ${pick(["Speed", "Heavy", "Beaded", "Cable"])} ${color} Ugrókötel`,
    desc: (brand, color) => `${brand} ugrókötel ${color.toLowerCase()} markolattal. Csapágyas fordítórendszer, állítható hossz, intervall edzéshez és crossfit-hez.`,
    sizes: ["Standard (2.8m)", "Long (3.2m)"],
  },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roundPrice(price) {
  return Math.round(price / 100) * 100;
}

let id = 1;
const items = [];

for (const pt of PRODUCT_TYPES) {
  const [minP, maxP] = pt.basePrice;
  const sizesForType = pt.sizes;

  // Each type: generate enough size×color×brand combinations to hit ~40-50 per type
  for (const brand of BRANDS) {
    for (const color of COLORS) {
      // Pick 1-2 sizes per brand+color combo
      const numSizes = Math.min(2, sizesForType.length);
      const chosenSizes = [...sizesForType].sort(() => Math.random() - 0.5).slice(0, numSizes);

      for (const size of chosenSizes) {
        const price = roundPrice(randInt(minP, maxP));
        const name = `${pt.nameFn(brand, color)} - ${size}`;
        const product_id = `sport-${String(id).padStart(5, "0")}`;
        id++;

        items.push({
          product_id,
          name,
          price,
          category: pt.category,
          product_type: pt.type,
          description: pt.desc(brand, color),
          tags: pt.tags,
          vendor: brand,
          image_url: `https://placehold.co/400x400?text=${encodeURIComponent(pt.type)}`,
          product_url: `https://sport-demo.example.com/products/${product_id}`,
        });
      }
    }
  }
}

// Shuffle and limit to ~1200
items.sort(() => Math.random() - 0.5);
items.splice(1200);

const output = {
  site_key: "CSERE_EZT_A_SITE_KEY_RE",
  items,
};

const outPath = path.join(__dirname, "..", "data", "sport-catalog-import.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

console.log(`✅ Kész: ${items.length} termék generálva`);
console.log(`📁 Fájl: data/sport-catalog-import.json`);
console.log(`⚠️  Cseréld le a "CSERE_EZT_A_SITE_KEY_RE" értéket a saját site_key-edre!`);
