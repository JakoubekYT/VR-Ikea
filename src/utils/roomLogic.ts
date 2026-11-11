import type {
  ApartmentRoom,
  BomLineItem,
  BomSummary,
  ChandelierCatalogItem,
  CollisionCheckOptions,
  Furniture3DSpec,
  FurnitureMaterialType,
  FurniturePartSpec,
  FurnitureShapeType,
  IkeaCategory,
  IkeaProduct,
  PlacedChandelier,
  PlacedFurnitureItem,
  SnapFurnitureOptions,
  SnappedFurnitureResult,
  WallId,
} from '../types/ikea.js';
import { INITIAL_IKEA_CATALOG, CHANDELIER_CATALOG } from '../data/ikeaCatalog.js';

/**
 * Strip Unicode combining diacritics and normalize to lowercase for Czech & English search.
 */
function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Convert correlated color temperature (Kelvin, e.g. 2200–6500) to an approximate sRGB hex string.
 */
export function kelvinToHex(kelvin: number): string {
  const clamped = Math.max(1500, Math.min(10000, kelvin || 2700));
  const temp = clamped / 100;

  let r: number;
  let g: number;
  let b: number;

  if (temp <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    b = 255;
  }

  const toHex = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c)))
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Parse a user-entered string to detect an IKEA product URL and extract slug, article number, and locale.
 */
export function parseIkeaUrl(input: string): {
  isUrl: boolean;
  url?: string;
  extractedName?: string;
  extractedArticleNumber?: string;
  extractedLocale?: string;
} {
  const trimmed = input.trim();
  const isUrl =
    /^https?:\/\//i.test(trimmed) ||
    /(?:^|\.)ikea\.com\//i.test(trimmed);

  if (!isUrl) {
    return { isUrl: false };
  }

  const normalizedUrl = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(normalizedUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);

    let extractedLocale: string | undefined;
    if (segments.length >= 2 && segments[0].length === 2 && segments[1].length === 2) {
      extractedLocale = `${segments[0]}/${segments[1]}`;
    }

    const pIndex = segments.indexOf('p');
    const slugSegment = pIndex >= 0 && segments[pIndex + 1]
      ? segments[pIndex + 1]
      : segments[segments.length - 1] || '';

    let extractedArticleNumber: string | undefined;
    const artMatch = slugSegment.match(/(?:s)?(\d{8}|\d{3}\.\d{3}\.\d{2})$/i);
    if (artMatch) {
      const digits = artMatch[1].replace(/\./g, '');
      extractedArticleNumber = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 8)}`;
    }

    const cleanSlug = slugSegment
      .replace(/-?s?\d{8}$/i, '')
      .replace(/-?\d{3}\.\d{3}\.\d{2}$/, '')
      .replace(/-/g, ' ')
      .trim();

    const extractedName = cleanSlug
      ? cleanSlug.replace(/\b\w/g, (ch) => ch.toUpperCase())
      : undefined;

    return {
      isUrl: true,
      url: normalizedUrl,
      extractedName,
      extractedArticleNumber,
      extractedLocale,
    };
  } catch {
    return {
      isUrl: true,
      url: normalizedUrl,
    };
  }
}

const SEARCH_SYNONYMS: Array<[string[], string[]]> = [
  [['sedacka', 'pohovka', 'gauc', 'valenda', 'rohova', 'rozkladaci', 'sofa', 'couch', 'divan'], ['sofa', 'couch', 'loveseat', 'sectional', 'chaise', 'corner', 'kivik', 'vimle', 'ektorp', 'landskrona', 'friheten', 'soderhamn']],
  [['kreslo', 'usak', 'lenoska', 'armchair', 'lounge', 'wing'], ['armchair', 'chair', 'wing', 'poang', 'strandmon', 'vedbo', 'ekenaset']],
  [['zidle', 'stolicka', 'sedatko', 'barovka', 'barova', 'chair', 'stool'], ['chair', 'dining', 'stool', 'odger', 'ingolf', 'stefan', 'franklin']],
  [['stul', 'stolek', 'psaci', 'pracovni', 'jidelni', 'konferencni', 'servirovaci', 'desk', 'table'], ['desk', 'table', 'coffee', 'dining', 'island', 'lisabo', 'lack', 'bekant', 'micke', 'stockholm', 'ekedalen', 'ingatorp', 'melltorp', 'gladom', 'alex']],
  [['postel', 'luzko', 'dvouluzko', 'jednoluzko', 'letiste', 'matrace', 'bed', 'daybed'], ['bed', 'daybed', 'frame', 'mattress', 'malm', 'hemnes', 'neiden', 'nordli', 'idanas', 'brimnes', 'slakt']],
  [['skrin', 'satni', 'garderoba', 'satnik', 'wardrobe', 'closet'], ['wardrobe', 'pax', 'chest', 'cabinet', 'brimnes', 'forsand']],
  [['komoda', 'supliky', 'zasuvky', 'chest', 'dresser'], ['chest', 'drawer', 'malm', 'hemnes', 'alex']],
  [['knihovna', 'regal', 'police', 'policka', 'shelf', 'bookcase', 'shelving'], ['bookcase', 'shelf', 'shelving', 'billy', 'kallax', 'eket', 'ivar', 'bror']],
  [['tv', 'televize', 'stolek pod tv', 'media', 'besta'], ['tv', 'media', 'besta', 'bench', 'console']],
  [['lampa', 'svetlo', 'svitidlo', 'osvetleni', 'lustr', 'lamp', 'light'], ['lamp', 'lighting', 'pendant', 'floor', 'table lamp', 'hektar', 'fado', 'regolit', 'ranarp', 'tertial', 'arstid', 'dejs']],
  [['koberec', 'behoun', 'rohoz', 'rug', 'carpet'], ['rug', 'pile', 'woven', 'stoense', 'lohals', 'vindum']],
  [['zrcadlo', 'mirror'], ['mirror', 'stockholm', 'nissedal']],
  [['rostlina', 'kytka', 'fikus', 'kvetina', 'plant', 'flower', 'tree'], ['plant', 'fejka', 'pot', 'ficus']],
  [['obraz', 'ram', 'frame', 'picture'], ['frame', 'ribba', 'gallery']],
  [['vaza', 'vase', 'decor', 'keramika'], ['vase', 'gradvis', 'stoneware']],
  [['vozik', 'ostruvek', 'linka', 'kuchyn', 'cart', 'trolley', 'kitchen', 'island'], ['cart', 'utility', 'island', 'kitchen', 'tornviken', 'raskog', 'enhet', 'knoxhult']],
];

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[a.length][b.length];
}

function expandQueryTokens(query: string): string[] {
  const norm = normalizeText(query);
  if (!norm) return [];
  const rawTokens = norm.split(/\s+/).filter(Boolean);
  const expanded = new Set<string>(rawTokens);

  for (const token of rawTokens) {
    for (const [triggers, aliases] of SEARCH_SYNONYMS) {
      if (triggers.some((t) => normalizeText(t) === token || token.includes(normalizeText(t)))) {
        for (const alias of aliases) {
          expanded.add(normalizeText(alias));
        }
      }
    }
  }
  return Array.from(expanded);
}

/**
 * Filter an IKEA catalog array by category and search query (supporting Czech & English diacritic-insensitive matching and fuzzy typo tolerance).
 */
export function filterCatalog(
  catalog: IkeaProduct[],
  category: IkeaCategory,
  searchQuery: string
): IkeaProduct[] {
  const byCategory =
    category === 'All'
      ? catalog
      : catalog.filter((item) => item.category === category);

  const normQuery = normalizeText(searchQuery);
  if (!normQuery) return byCategory;

  const rawTokens = normQuery.split(/\s+/).filter(Boolean);
  const expandedTokens = expandQueryTokens(searchQuery);

  const matches = byCategory.filter((item) => {
    const haystack = normalizeText(
      [
        item.name,
        item.typeName,
        item.articleNumber,
        item.category,
        item.materialDescription,
        ...(item.matchedQueries || []),
      ].join(' ')
    );

    if (haystack.includes(normQuery)) return true;
    if (rawTokens.every((tok) => haystack.includes(tok))) return true;
    return expandedTokens.some((tok) => haystack.includes(tok));
  });

  if (matches.length > 0) {
    return matches;
  }

  // Fuzzy match for minor typos (e.g. "sedackaa", "pohofka", "kalax", "malmm", "stull")
  return byCategory.filter((item) => {
    const hayTokens = normalizeText([item.name, item.typeName, item.category].join(' ')).split(/\s+/);
    return rawTokens.some((qTok) => {
      if (qTok.length < 3) return false;
      const maxDist = qTok.length <= 4 ? 1 : 2;
      return hayTokens.some((hTok) => {
        if (Math.abs(hTok.length - qTok.length) > maxDist) return false;
        return levenshtein(qTok, hTok) <= maxDist;
      });
    });
  });
}

const EXTENDED_IKEA_FALLBACK_PRODUCTS: IkeaProduct[] = [
  {
    id: 'ikea-friheten-corner',
    name: 'FRIHETEN',
    typeName: 'Corner sofa-bed with storage',
    category: 'Sofas & Armchairs',
    articleNumber: '392.167.54',
    priceCzk: 12990,
    priceEur: 520,
    dimensionsCm: { width: 230, depth: 151, height: 66 },
    materialDescription: 'Skiftebo dark grey woven polyester upholstery with kiln-dried pine frame',
    swatches: [
      { name: 'Skiftebo Dark Grey', hex: '#4B4E53' },
      { name: 'Hyllie Beige', hex: '#D8CFC2' },
      { name: 'Bomstad Black', hex: '#262626' },
    ],
    archetype: 'corner_sofa',
  },
  {
    id: 'ikea-soderhamn-chaise',
    name: 'SÖDERHAMN',
    typeName: '3-seat sofa with chaise longue',
    category: 'Sofas & Armchairs',
    articleNumber: '693.056.25',
    priceCzk: 17990,
    priceEur: 720,
    dimensionsCm: { width: 285, depth: 151, height: 83 },
    materialDescription: 'Fridtuna light beige cotton-polyester bouclé, slim steel legs',
    swatches: [
      { name: 'Fridtuna Light Beige', hex: '#DDD5C7' },
      { name: 'Viarp Beige/Brown', hex: '#A79986' },
      { name: 'Tonerud Grey', hex: '#5D6166' },
    ],
    archetype: 'chaise_sofa',
  },
  {
    id: 'ikea-vimle-corner',
    name: 'VIMLE',
    typeName: '4-seat corner sofa',
    category: 'Sofas & Armchairs',
    articleNumber: '494.006.19',
    priceCzk: 22990,
    priceEur: 920,
    dimensionsCm: { width: 249, depth: 249, height: 83 },
    materialDescription: 'Hallarp beige wool-look fabric over pocket-sprung core',
    swatches: [
      { name: 'Hallarp Beige', hex: '#D3C9BA' },
      { name: 'Gunnared Medium Grey', hex: '#6E7275' },
      { name: 'Saxemara Black-Blue', hex: '#2B3645' },
    ],
    archetype: 'corner_sofa',
  },
  {
    id: 'ikea-idanas-bed',
    name: 'IDANÄS',
    typeName: 'Upholstered storage bed frame',
    category: 'Beds & Mattresses',
    articleNumber: '204.589.64',
    priceCzk: 13990,
    priceEur: 560,
    dimensionsCm: { width: 170, depth: 224, height: 121 },
    materialDescription: 'Gunnared dark grey upholstery with solid birch legs',
    swatches: [
      { name: 'Gunnared Dark Grey', hex: '#4E5257' },
      { name: 'Gunnared Pale Pink', hex: '#D9C3C3' },
    ],
    archetype: 'bed',
  },
  {
    id: 'ikea-stockholm-mirror',
    name: 'STOCKHOLM',
    typeName: 'Walnut veneer round wall mirror',
    category: 'Rugs & Decor',
    articleNumber: '605.037.91',
    priceCzk: 2990,
    priceEur: 120,
    dimensionsCm: { width: 80, depth: 10, height: 80 },
    materialDescription: 'Walnut veneer frame and silver-backed tempered mirror glass',
    swatches: [
      { name: 'Walnut Veneer', hex: '#7A5438' },
      { name: 'Ash Veneer', hex: '#D4BC93' },
    ],
    archetype: 'mirror',
  },
];

function inferArchetypeFromQuery(query: string): {
  category: Exclude<IkeaCategory, 'All'>;
  archetype: string;
  defaultW: number;
  defaultD: number;
  defaultH: number;
  defaultPriceCzk: number;
} {
  const norm = normalizeText(query);
  if (/roh|corner|l-?shape|l-?sed/.test(norm)) {
    return { category: 'Sofas & Armchairs', archetype: 'corner_sofa', defaultW: 245, defaultD: 165, defaultH: 83, defaultPriceCzk: 18990 };
  }
  if (/sedack|pohovk|gauc|sofa|couch|loveseat/.test(norm)) {
    return { category: 'Sofas & Armchairs', archetype: 'sofa_3seat', defaultW: 228, defaultD: 95, defaultH: 83, defaultPriceCzk: 14990 };
  }
  if (/kresl|poang|strandmon|armchair|lounge/.test(norm)) {
    return { category: 'Sofas & Armchairs', archetype: 'armchair', defaultW: 82, defaultD: 94, defaultH: 98, defaultPriceCzk: 6990 };
  }
  if (/postel|bed|luzk|daybed/.test(norm)) {
    return { category: 'Beds & Mattresses', archetype: 'bed', defaultW: 176, defaultD: 210, defaultH: 105, defaultPriceCzk: 9990 };
  }
  if (/psac|desk|kancelar|pracovn|bekant|micke/.test(norm)) {
    return { category: 'Tables & Desks', archetype: 'desk', defaultW: 140, defaultD: 65, defaultH: 75, defaultPriceCzk: 4990 };
  }
  if (/konferen|coffee|lack/.test(norm)) {
    return { category: 'Tables & Desks', archetype: 'coffee_table', defaultW: 118, defaultD: 78, defaultH: 45, defaultPriceCzk: 1990 };
  }
  if (/jideln|stul|dining|table|kuchyn|ostruv|island/.test(norm)) {
    return { category: 'Kitchen & Dining', archetype: 'dining_table', defaultW: 160, defaultD: 85, defaultH: 75, defaultPriceCzk: 7990 };
  }
  if (/zidl|chair/.test(norm)) {
    return { category: 'Kitchen & Dining', archetype: 'dining_chair', defaultW: 48, defaultD: 52, defaultH: 82, defaultPriceCzk: 1990 };
  }
  if (/skrin|wardrobe|pax|satn/.test(norm)) {
    return { category: 'Storage & Shelving', archetype: 'pax_wardrobe', defaultW: 150, defaultD: 60, defaultH: 236, defaultPriceCzk: 10990 };
  }
  if (/komod|chest|suplik|malm/.test(norm)) {
    return { category: 'Storage & Shelving', archetype: 'chest', defaultW: 120, defaultD: 48, defaultH: 78, defaultPriceCzk: 3990 };
  }
  if (/knihov|regal|kallax|billy|shelf|bookcase/.test(norm)) {
    return { category: 'Storage & Shelving', archetype: 'kallax_shelf', defaultW: 147, defaultD: 39, defaultH: 147, defaultPriceCzk: 3490 };
  }
  if (/tv|besta|media/.test(norm)) {
    return { category: 'Storage & Shelving', archetype: 'besta_tv_bench', defaultW: 180, defaultD: 42, defaultH: 48, defaultPriceCzk: 4990 };
  }
  if (/lamp|svet|light/.test(norm)) {
    return { category: 'Lighting', archetype: 'floor_lamp', defaultW: 36, defaultD: 36, defaultH: 168, defaultPriceCzk: 1890 };
  }
  if (/koberec|rug|carpet/.test(norm)) {
    return { category: 'Rugs & Decor', archetype: 'woven_rug', defaultW: 200, defaultD: 300, defaultH: 2, defaultPriceCzk: 2990 };
  }
  if (/rostlin|kytk|fikus|kvetin|plant|flower|tree/.test(norm)) {
    return { category: 'Rugs & Decor', archetype: 'decor_plant', defaultW: 45, defaultD: 45, defaultH: 110, defaultPriceCzk: 1290 };
  }
  if (/zrcadl|mirror/.test(norm)) {
    return { category: 'Rugs & Decor', archetype: 'mirror', defaultW: 80, defaultD: 10, defaultH: 80, defaultPriceCzk: 2990 };
  }
  if (/obraz|ram|frame|vaza|vase|decor/.test(norm)) {
    return { category: 'Rugs & Decor', archetype: 'decor_accessory', defaultW: 50, defaultD: 10, defaultH: 70, defaultPriceCzk: 499 };
  }
  if (/ostruv|island|linka|vozik|cart|trolley/.test(norm)) {
    return { category: 'Kitchen & Dining', archetype: 'kitchen_island', defaultW: 120, defaultD: 65, defaultH: 90, defaultPriceCzk: 5990 };
  }
  return { category: 'Storage & Shelving', archetype: 'shelving', defaultW: 120, defaultD: 42, defaultH: 120, defaultPriceCzk: 3490 };
}

/**
 * Return strictly 6 matching IKEA products for a Czech or English query,
 * falling back seamlessly through extended catalog items and synthesized matches when Gemini API is offline.
 */
export function generateSixMatchingIkeaProducts(
  query: string,
  baseCatalog: IkeaProduct[] = INITIAL_IKEA_CATALOG
): IkeaProduct[] {
  const combinedPool = [...baseCatalog];
  const seenIds = new Set(combinedPool.map((p) => p.id));
  for (const ext of EXTENDED_IKEA_FALLBACK_PRODUCTS) {
    if (!seenIds.has(ext.id)) {
      combinedPool.push(ext);
      seenIds.add(ext.id);
    }
  }

  const matched = filterCatalog(combinedPool, 'All', query);
  const results: IkeaProduct[] = matched.slice(0, 6);

  if (results.length < 6) {
    const inferred = inferArchetypeFromQuery(query);
    const sameCategory = combinedPool.filter(
      (p) => p.category === inferred.category && !results.some((r) => r.id === p.id)
    );
    for (const item of sameCategory) {
      if (results.length >= 6) break;
      results.push(item);
    }
  }

  const CLEAN_SERIES_NAMES = ['ÅRSTID', 'NORDMÄRKE', 'VALLENTUNA', 'LOMMARP', 'SKRUVSTA', 'ÄPPLARYD'];
  let synthIdx = 0;
  while (results.length < 6) {
    const inferred = inferArchetypeFromQuery(query);
    const cleanLabel = query.trim().slice(0, 42) || 'Scandinavian Edition';
    const series = CLEAN_SERIES_NAMES[synthIdx % CLEAN_SERIES_NAMES.length];
    const variantPrice = inferred.defaultPriceCzk + synthIdx * 800;
    const widthDelta = (synthIdx % 3) * 15;
    results.push({
      id: `ikea-synth-${normalizeText(cleanLabel).replace(/[^a-z0-9]+/g, '-')}-${synthIdx}`,
      name: series,
      typeName: `${cleanLabel} (${inferred.category})`,
      category: inferred.category,
      articleNumber: `${300 + synthIdx * 11}.${410 + synthIdx * 7}.${20 + synthIdx * 3}`,
      priceCzk: variantPrice,
      priceEur: Math.round(variantPrice / 25),
      dimensionsCm: {
        width: inferred.defaultW + widthDelta,
        depth: inferred.defaultD,
        height: inferred.defaultH,
      },
      materialDescription: `Birch veneer, powder-coated steel, and woven Nordic textile inspired by ${series}`,
      swatches: [
        { name: 'Nordic Beige', hex: '#D8CFC2' },
        { name: 'White Oak', hex: '#D4BA91' },
        { name: 'Anthracite', hex: '#43464B' },
      ],
      archetype: inferred.archetype,
    });
    synthIdx++;
  }

  return results.slice(0, 6);
}

/**
 * Compute Bill of Materials & shopping list totals across placed furniture and chandeliers.
 */
export function calculateBomSummary(
  placedItems: PlacedFurnitureItem[],
  chandeliers: PlacedChandelier[] = []
): BomSummary {
  const lineMap = new Map<string, BomLineItem>();

  for (const item of placedItems) {
    const key = `${item.product.id}::${item.swatchName}`;
    const existing = lineMap.get(key);
    const priceCzk = Number(item.product.priceCzk) || 0;
    const priceEur = Number(item.product.priceEur) || Math.round(priceCzk / 25);

    if (existing) {
      existing.quantity += 1;
      existing.subtotalCzk += priceCzk;
      existing.subtotalEur += priceEur;
    } else {
      lineMap.set(key, {
        product: {
          id: item.product.id,
          name: item.product.name,
          articleNumber: item.product.articleNumber,
        },
        swatchName: item.swatchName,
        swatchHex: item.swatchHex,
        quantity: 1,
        subtotalCzk: priceCzk,
        subtotalEur: priceEur,
      });
    }
  }

  for (const ch of chandeliers) {
    const cat = ch.catalogItem;
    const finishName = `${ch.colorTempK}K Ceiling Fixture`;
    const colorHex = kelvinToHex(ch.colorTempK);
    const key = `chandelier::${cat.id}`;
    const existing = lineMap.get(key);
    const priceCzk = Number(cat.priceCzk) || 0;
    const priceEur = Number(cat.priceEur) || Math.round(priceCzk / 25);

    if (existing) {
      existing.quantity += 1;
      existing.subtotalCzk += priceCzk;
      existing.subtotalEur += priceEur;
    } else {
      lineMap.set(key, {
        product: {
          id: cat.id,
          name: cat.name,
          articleNumber: cat.articleNumber || '705.120.44',
        },
        swatchName: finishName,
        swatchHex: colorHex,
        quantity: 1,
        subtotalCzk: priceCzk,
        subtotalEur: priceEur,
      });
    }
  }

  const lines = Array.from(lineMap.values());
  const totalCzk = lines.reduce((sum, l) => sum + l.subtotalCzk, 0);
  const totalEur = lines.reduce((sum, l) => sum + l.subtotalEur, 0);
  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0);

  return {
    lines,
    totalCzk,
    totalEur,
    totalItems,
  };
}

/**
 * Determine which walls of a room should be cut away (low cutaway lip) so the dollhouse orbital camera
 * can see unobstructed into the interior without blocking walls.
 */
export function computeWallCutaway(
  cameraPos: [number, number, number],
  roomCenter: [number, number, number],
  enabled: boolean
): Record<WallId, boolean> {
  if (!enabled) {
    return { north: false, south: false, east: false, west: false };
  }

  const dx = cameraPos[0] - roomCenter[0];
  const dz = cameraPos[2] - roomCenter[2];

  return {
    north: dz < -0.55,
    south: dz > 0.55,
    west: dx < -0.55,
    east: dx > 0.55,
  };
}

/**
 * Locate the apartment room containing world XZ coordinates (x, z), falling back to nearest room center.
 */
export function findRoomForPoint(
  x: number,
  z: number,
  rooms: ApartmentRoom[]
): ApartmentRoom {
  if (rooms.length === 0) {
    throw new Error('findRoomForPoint called with empty rooms array');
  }

  for (const room of rooms) {
    const halfW = room.width / 2;
    const halfL = room.length / 2;
    if (
      x >= room.position[0] - halfW - 0.05 &&
      x <= room.position[0] + halfW + 0.05 &&
      z >= room.position[1] - halfL - 0.05 &&
      z <= room.position[1] + halfL + 0.05
    ) {
      return room;
    }
  }

  let best = rooms[0];
  let bestDist = Infinity;
  for (const room of rooms) {
    const dx = x - room.position[0];
    const dz = z - room.position[1];
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = room;
    }
  }
  return best;
}

// ============================================================================
// MILESTONE 2: SPATIAL PHYSICS, STACKING & COLLISION (OBB/SAT)
// ============================================================================

/**
 * Compute axis-aligned half-extents (meters) for a rectangular bounding box rotated by degrees about Y.
 */
export function getAxisAlignedHalfExtents(
  rotationDeg: number,
  widthMeters: number,
  depthMeters: number
): { halfW: number; halfD: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    halfW: (cos * widthMeters + sin * depthMeters) / 2,
    halfD: (sin * widthMeters + cos * depthMeters) / 2,
  };
}

/**
 * Minimal circular angular distance (0..180 degrees) between two angles.
 */
export function angularDistanceDeg(aDeg: number, bDeg: number): number {
  const diff = Math.abs(((aDeg - bDeg) % 360 + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Check if a product or placed item is tabletop decor / lighting intended to sit on a surface.
 */
export function isTabletopItem(item: PlacedFurnitureItem | IkeaProduct): boolean {
  const p = 'product' in item ? item.product : item;
  const arch = p.archetype || '';
  const cat = p.category;
  const type = (p.typeName || '').toLowerCase();

  if (
    arch === 'table_lamp' ||
    arch === 'table_lamp_globe' ||
    arch === 'decor_plant' ||
    arch === 'decor_accessory'
  ) {
    return true;
  }
  if (
    cat === 'Lighting' &&
    (type.includes('table lamp') ||
      type.includes('stoln') ||
      type.includes('work lamp') ||
      type.includes('pracovn') ||
      type.includes('arm work lamp'))
  ) {
    return true;
  }
  if (
    cat === 'Rugs & Decor' &&
    arch !== 'woven_rug' &&
    arch !== 'rug' &&
    arch !== 'mirror' &&
    (type.includes('plant') ||
      type.includes('rostlin') ||
      type.includes('váza') ||
      type.includes('vaza') ||
      type.includes('vase') ||
      type.includes('rám') ||
      type.includes('ram') ||
      type.includes('frame') ||
      type.includes('decor') ||
      type.includes('dekorat') ||
      type.includes('hodiny') ||
      type.includes('clock'))
  ) {
    return true;
  }
  return false;
}

/**
 * Check if a product or placed item provides a horizontal top surface capable of supporting tabletop items.
 */
export function isSurfaceFurniture(item: PlacedFurnitureItem | IkeaProduct): boolean {
  const p = 'product' in item ? item.product : item;
  const cat = p.category;
  const arch = p.archetype || '';
  const type = (p.typeName || '').toLowerCase();
  const hM = (p.dimensionsCm.height || 0) / 100;

  if (cat === 'Tables & Desks') return true;

  if (
    cat === 'Kitchen & Dining' &&
    (arch === 'kitchen_island' ||
      arch === 'utility_cart' ||
      arch === 'dining_table' ||
      type.includes('island') ||
      type.includes('ostrůvek') ||
      type.includes('ostruvek') ||
      type.includes('vozík') ||
      type.includes('vozik') ||
      type.includes('cart') ||
      type.includes('stůl') ||
      type.includes('stul') ||
      type.includes('table') ||
      type.includes('base unit') ||
      type.includes('skříňka') ||
      type.includes('skrinka'))
  ) {
    return true;
  }

  // Low storage units (chests, credenzas, TV benches) under 1.35m height
  if (
    cat === 'Storage & Shelving' &&
    hM <= 1.35 &&
    (arch === 'chest_of_drawers' ||
      arch === 'besta_tv_bench' ||
      arch === 'shelving_unit' ||
      type.includes('komoda') ||
      type.includes('chest') ||
      type.includes('tv bench') ||
      type.includes('tv stolek') ||
      type.includes('skříňka') ||
      type.includes('skrinka'))
  ) {
    return true;
  }

  return false;
}

/**
 * Check if a product or placed item is a floor rug / mat (exempt from collision checks).
 */
export function isRugItem(item: PlacedFurnitureItem | IkeaProduct): boolean {
  const p = 'product' in item ? item.product : item;
  return (
    p.archetype === 'woven_rug' ||
    p.archetype === 'rug' ||
    (p.category === 'Rugs & Decor' && (p.dimensionsCm.height || 0) <= 5)
  );
}

/**
 * Helper to retrieve meter dimensions [width, depth, height] for an item or product.
 */
export function getFurnitureDimensionsMeters(item: PlacedFurnitureItem | IkeaProduct): {
  width: number;
  depth: number;
  height: number;
} {
  if (item && 'spec3D' in item && item.spec3D?.overallDimensionsMeters) {
    return item.spec3D.overallDimensionsMeters;
  }
  const p = item && 'product' in item ? item.product : item;
  const dims = p && typeof p === 'object' && 'dimensionsCm' in p ? p.dimensionsCm : null;
  return {
    width: (dims?.width || 60) / 100,
    depth: (dims?.depth || 60) / 100,
    height: (dims?.height || 60) / 100,
  };
}

/**
 * Test whether a world point (worldX, worldZ) falls within the horizontal rectangular surface bounds
 * of a parent furniture item, accounting for the parent's position and rotation around Y.
 */
export function isPointOverFurnitureSurface(
  worldX: number,
  worldZ: number,
  parent: PlacedFurnitureItem,
  marginMeters = 0.05
): boolean {
  const dx = worldX - parent.position[0];
  const dz = worldZ - parent.position[2];
  const rad = (parent.rotationY * Math.PI) / 180;
  // Rotate by -rad to bring into parent local coordinate space
  const lx = dx * Math.cos(rad) - dz * Math.sin(rad);
  const lz = dx * Math.sin(rad) + dz * Math.cos(rad);

  const dims = getFurnitureDimensionsMeters(parent);
  const halfW = dims.width / 2 + marginMeters;
  const halfD = dims.depth / 2 + marginMeters;

  return Math.abs(lx) <= halfW && Math.abs(lz) <= halfD;
}

/**
 * Find the highest supporting surface beneath a candidate tabletop item.
 */
export function findStackingSurface(
  candidateWorldPos: [number, number, number],
  candidateProduct: IkeaProduct | PlacedFurnitureItem,
  placedItems: PlacedFurnitureItem[],
  candidateInstanceId?: string
): PlacedFurnitureItem | null {
  if (!isTabletopItem(candidateProduct)) return null;

  const candidates: PlacedFurnitureItem[] = [];
  for (const item of placedItems) {
    if (candidateInstanceId && item.instanceId === candidateInstanceId) continue;
    if (!isSurfaceFurniture(item)) continue;
    if (isPointOverFurnitureSurface(candidateWorldPos[0], candidateWorldPos[2], item)) {
      candidates.push(item);
    }
  }

  if (candidates.length === 0) return null;

  // Pick the highest top surface
  return candidates.reduce((best, curr) => {
    const bestTopY = best.position[1] + getFurnitureDimensionsMeters(best).height;
    const currTopY = curr.position[1] + getFurnitureDimensionsMeters(curr).height;
    return currTopY > bestTopY ? curr : best;
  });
}

function dot2D(a: [number, number], b: [number, number]): number {
  return a[0] * b[0] + a[1] * b[1];
}

/**
 * 2D Oriented Bounding Box (OBB) Separating Axis Theorem (SAT) collision check in the XZ plane.
 */
export function checkObbSat2D(
  boxA: { cx: number; cz: number; hx: number; hz: number; rotDeg: number },
  boxB: { cx: number; cz: number; hx: number; hz: number; rotDeg: number },
  toleranceMeters = 0.005
): boolean {
  const radA = (boxA.rotDeg * Math.PI) / 180;
  const radB = (boxB.rotDeg * Math.PI) / 180;

  const uA1: [number, number] = [Math.cos(radA), -Math.sin(radA)];
  const uA2: [number, number] = [Math.sin(radA), Math.cos(radA)];
  const uB1: [number, number] = [Math.cos(radB), -Math.sin(radB)];
  const uB2: [number, number] = [Math.sin(radB), Math.cos(radB)];

  const axes: [number, number][] = [uA1, uA2, uB1, uB2];
  const D: [number, number] = [boxB.cx - boxA.cx, boxB.cz - boxA.cz];

  for (const L of axes) {
    const d = Math.abs(dot2D(D, L));
    const rA = boxA.hx * Math.abs(dot2D(uA1, L)) + boxA.hz * Math.abs(dot2D(uA2, L));
    const rB = boxB.hx * Math.abs(dot2D(uB1, L)) + boxB.hz * Math.abs(dot2D(uB2, L));
    if (d > rA + rB - toleranceMeters) {
      return false; // Separating axis exists: no collision
    }
  }
  return true;
}

/**
 * Check 3D collision between two upright placed furniture items using:
 * 1. 1D vertical interval overlap test.
 * 2. 4-axis 2D Separating Axis Theorem in the horizontal XZ plane.
 * Handles exemptions: self-collision, parent-child stacking, and floor rugs.
 */
export function checkFurnitureCollision(
  itemA: PlacedFurnitureItem,
  itemB: PlacedFurnitureItem,
  options?: CollisionCheckOptions
): boolean {
  if (itemA.instanceId && itemA.instanceId === itemB.instanceId) return false;
  if (
    (itemA.parentInstanceId && itemA.parentInstanceId === itemB.instanceId) ||
    (itemB.parentInstanceId && itemB.parentInstanceId === itemA.instanceId)
  ) {
    return false;
  }

  const ignoreRugs = options?.ignoreRugs ?? true;
  if (ignoreRugs && (isRugItem(itemA) || isRugItem(itemB))) {
    return false;
  }

  const tol = options?.toleranceMeters ?? 0.005;
  const dimsA = getFurnitureDimensionsMeters(itemA);
  const dimsB = getFurnitureDimensionsMeters(itemB);

  const bottomA = itemA.position[1];
  const topA = bottomA + dimsA.height;
  const bottomB = itemB.position[1];
  const topB = bottomB + dimsB.height;

  // 1D vertical clearance check
  if (topA <= bottomB + tol || bottomA >= topB - tol) {
    return false;
  }

  // 2D OBB SAT check
  return checkObbSat2D(
    {
      cx: itemA.position[0],
      cz: itemA.position[2],
      hx: dimsA.width / 2,
      hz: dimsA.depth / 2,
      rotDeg: itemA.rotationY || 0,
    },
    {
      cx: itemB.position[0],
      cz: itemB.position[2],
      hx: dimsB.width / 2,
      hz: dimsB.depth / 2,
      rotDeg: itemB.rotationY || 0,
    },
    tol
  );
}

/**
 * Filter all items that collide with the target item.
 */
export function findCollidingFurniture(
  targetItem: PlacedFurnitureItem,
  allItems: PlacedFurnitureItem[],
  options?: CollisionCheckOptions
): PlacedFurnitureItem[] {
  return allItems.filter((item) => checkFurnitureCollision(targetItem, item, options));
}

/**
 * Snap furniture local coordinates inside a room to a 5cm architectural grid,
 * align flush against inner walls, auto-rotate furniture so its back faces the wall,
 * and support vertical surface stacking for tabletop decor.
 */
export function snapFurnitureToRoom(
  localPos: [number, number, number],
  rotationYDeg: number,
  dimensionsCm: { width: number; depth: number; height: number },
  opts: SnapFurnitureOptions
): SnappedFurnitureResult {
  const wM = Math.max(0.15, (dimensionsCm.width || 60) / 100);
  const dM = Math.max(0.15, (dimensionsCm.depth || 60) / 100);

  const wallPad = 0.02; // 2cm clearance to prevent mesh/wall coplanar z-fighting
  const snapThreshold = 0.28; // 28cm magnetic wall snap threshold
  const cornerHysteresis = 0.04; // 4cm threshold to avoid jitter in corner tie-breaking

  let x = localPos[0] || 0;
  let y = Math.max(0, localPos[1] || 0);
  let z = localPos[2] || 0;

  // 1. Grid Snapping (5cm architectural increments)
  if (opts.enableGridSnap) {
    const step = 0.05;
    x = Math.round(x / step) * step;
    z = Math.round(z / step) * step;
  }

  let parentInstanceId: string | undefined = undefined;

  // 2. Vertical Stacking Check (if tabletop item placed over surface)
  if (opts.allowStacking && opts.otherItems && opts.otherItems.length > 0 && opts.itemProduct) {
    const roomPosX = opts.roomPosition ? opts.roomPosition[0] : 0;
    const roomPosZ = opts.roomPosition ? opts.roomPosition[1] : 0;
    const candidateWorldPos: [number, number, number] = [roomPosX + x, y, roomPosZ + z];

    const surfaceParent = findStackingSurface(
      candidateWorldPos,
      opts.itemProduct,
      opts.otherItems,
      opts.currentInstanceId
    );

    if (surfaceParent) {
      const parentDims = getFurnitureDimensionsMeters(surfaceParent);
      y = surfaceParent.position[1] + parentDims.height;
      parentInstanceId = surfaceParent.instanceId;
    }
  }

  let finalRotation = ((rotationYDeg % 360) + 360) % 360;

  // 3. Wall Snapping & Alignment Auto-Rotation (bypassed if stacked on a surface)
  if (opts.enableWallSnap && !parentInstanceId) {
    const { halfW: currHalfW, halfD: currHalfD } = getAxisAlignedHalfExtents(finalRotation, wM, dM);
    const currMaxX = Math.max(0, opts.width / 2 - currHalfW - wallPad);
    const currMaxZ = Math.max(0, opts.length / 2 - currHalfD - wallPad);

    // One-sided distances to each inner wall snap target
    const distWest = x <= -currMaxX ? 0 : x - (-currMaxX);
    const distEast = x >= currMaxX ? 0 : currMaxX - x;
    const distNorth = z <= -currMaxZ ? 0 : z - (-currMaxZ);
    const distSouth = z >= currMaxZ ? 0 : currMaxZ - z;

    const candX = distWest <= distEast ? 'west' : 'east';
    const distX = Math.min(distWest, distEast);
    const nearX = distX <= snapThreshold;

    const candZ = distNorth <= distSouth ? 'north' : 'south';
    const distZ = Math.min(distNorth, distSouth);
    const nearZ = distZ <= snapThreshold;

    // Cardinal orientations: back (-Z in local space) faces the snapped wall
    // North wall (Z = -L/2): 0°
    // West wall (X = -W/2): 90°
    // South wall (Z = +L/2): 180°
    // East wall (X = +W/2): 270°
    const rotX = candX === 'west' ? 90 : 270;
    const rotZ = candZ === 'north' ? 0 : 180;

    // Check if the rotated item physically fits inside the room along perpendicular axis
    const fitsAlongZ = wM + wallPad * 2 <= opts.length;
    const fitsAlongX = wM + wallPad * 2 <= opts.width;

    if (opts.autoRotateToWall !== false) {
      if (nearX && nearZ) {
        // Corner edge case: both X and Z walls are within snap threshold
        if (distX < distZ - cornerHysteresis && fitsAlongZ) {
          finalRotation = rotX;
        } else if (distZ < distX - cornerHysteresis && fitsAlongX) {
          finalRotation = rotZ;
        } else {
          // Equidistant within hysteresis: pick orientation requiring minimum angular change
          const diffX = angularDistanceDeg(rotationYDeg, rotX);
          const diffZ = angularDistanceDeg(rotationYDeg, rotZ);
          if (diffX < diffZ && fitsAlongZ) {
            finalRotation = rotX;
          } else if (diffZ < diffX && fitsAlongX) {
            finalRotation = rotZ;
          } else {
            finalRotation = distX < distZ && fitsAlongZ ? rotX : rotZ;
          }
        }
      } else if (nearX && fitsAlongZ) {
        finalRotation = rotX;
      } else if (nearZ && fitsAlongX) {
        finalRotation = rotZ;
      }
    }

    // Recalculate Bounding Extents with the Final Rotation
    const { halfW: finalHalfW, halfD: finalHalfD } = getAxisAlignedHalfExtents(finalRotation, wM, dM);
    const finalMaxX = Math.max(0, opts.width / 2 - finalHalfW - wallPad);
    const finalMaxZ = Math.max(0, opts.length / 2 - finalHalfD - wallPad);

    if (nearX) x = candX === 'west' ? -finalMaxX : finalMaxX;
    if (nearZ) z = candZ === 'north' ? -finalMaxZ : finalMaxZ;

    x = Math.max(-finalMaxX, Math.min(finalMaxX, x));
    z = Math.max(-finalMaxZ, Math.min(finalMaxZ, z));
  } else {
    // Non-wall-snap fallback clamping
    const { halfW: finalHalfW, halfD: finalHalfD } = getAxisAlignedHalfExtents(finalRotation, wM, dM);
    const finalMaxX = Math.max(0, opts.width / 2 - finalHalfW - wallPad);
    const finalMaxZ = Math.max(0, opts.length / 2 - finalHalfD - wallPad);

    x = Math.max(-finalMaxX, Math.min(finalMaxX, x));
    z = Math.max(-finalMaxZ, Math.min(finalMaxZ, z));
  }

  // 4. Collision Detection check against other items if requested
  let hasCollision = false;
  let collidingInstanceIds: string[] | undefined = undefined;

  if (opts.otherItems && opts.otherItems.length > 0 && opts.itemProduct) {
    const roomPosX = opts.roomPosition ? opts.roomPosition[0] : 0;
    const roomPosZ = opts.roomPosition ? opts.roomPosition[1] : 0;

    const tempItem: PlacedFurnitureItem = {
      instanceId: opts.currentInstanceId || 'temp-test-item',
      productId: opts.itemProduct.id,
      product: opts.itemProduct,
      swatchName: opts.itemProduct.swatches[0]?.name || '',
      swatchHex: opts.itemProduct.swatches[0]?.hex || '#CCCCCC',
      position: [roomPosX + x, y, roomPosZ + z],
      rotationY: finalRotation,
      spec3D: {
        parts: [],
        overallDimensionsMeters: {
          width: wM,
          depth: dM,
          height: (dimensionsCm.height || 60) / 100,
        },
      },
      roomId: '',
      parentInstanceId,
    };

    const colliders = findCollidingFurniture(tempItem, opts.otherItems);
    if (colliders.length > 0) {
      hasCollision = true;
      collidingInstanceIds = colliders.map((c) => c.instanceId);
    }
  }

  return {
    position: [Number(x.toFixed(4)), Number(y.toFixed(4)), Number(z.toFixed(4))],
    rotationY: finalRotation,
    parentInstanceId,
    hasCollision,
    collidingInstanceIds,
  };
}

// ============================================================================
// PARAMETRIC 20–40 SUB-PART 3D ARCHITECTURAL FURNITURE BUILDER
// ============================================================================

function p(
  name: string,
  shape: FurnitureShapeType,
  position: [number, number, number],
  size: [number, number, number],
  colorHex: string,
  materialType: FurnitureMaterialType,
  roughness: number,
  metalness: number,
  rotation: [number, number, number] = [0, 0, 0],
  isPrimaryColorTarget = false
): FurniturePartSpec {
  return {
    name,
    shape,
    position: [
      Number(position[0].toFixed(4)),
      Number(position[1].toFixed(4)),
      Number(position[2].toFixed(4)),
    ],
    size: [
      Math.max(0.01, Number(size[0].toFixed(4))),
      Math.max(0.01, Number(size[1].toFixed(4))),
      Math.max(0.01, Number(size[2].toFixed(4))),
    ],
    rotation: [
      Number(rotation[0].toFixed(4)),
      Number(rotation[1].toFixed(4)),
      Number(rotation[2].toFixed(4)),
    ],
    colorHex,
    materialType,
    roughness,
    metalness,
    isPrimaryColorTarget,
  };
}

function inferFabricMaterial(materialDesc: string): FurnitureMaterialType {
  const m = normalizeText(materialDesc);
  if (m.includes('velvet') || m.includes('samet')) return 'velvet';
  if (m.includes('leather') || m.includes('kuze')) return 'leather';
  return 'boucle_fabric';
}

function inferWoodMaterial(materialDesc: string): FurnitureMaterialType {
  const m = normalizeText(materialDesc);
  if (m.includes('walnut') || m.includes('orech') || m.includes('black-brown')) {
    return 'walnut_wood';
  }
  return 'oak_wood';
}

function buildSofaParts(
  w: number,
  d: number,
  h: number,
  mainHex: string,
  fabricMat: FurnitureMaterialType,
  isCorner: boolean,
  hasChaise: boolean
): FurniturePartSpec[] {
  const parts: FurniturePartSpec[] = [];
  const legH = 0.14;
  const deckH = 0.11;
  const seatH = 0.16;
  const armW = Math.min(0.18, w * 0.1);
  const armH = Math.min(0.64, h * 0.78);
  const backD = Math.min(0.2, d * 0.22);

  const mainD = hasChaise || isCorner ? Math.min(d, 0.96) : d;
  const mainZOffset = hasChaise || isCorner ? -(d - mainD) / 2 : 0;

  const legXs = [-w / 2 + 0.08, 0, w / 2 - 0.08];
  const legZs = [mainZOffset - mainD / 2 + 0.08, mainZOffset + mainD / 2 - 0.08];
  legXs.forEach((lx, xi) => {
    legZs.forEach((lz, zi) => {
      if (xi === 1 && w < 1.8) return;
      parts.push(
        p(`leg_${xi}_${zi}`, 'cylinder', [lx, legH / 2, lz], [0.045, legH, 0.045], '#B98C57', 'oak_wood', 0.55, 0),
        p(`ferrule_${xi}_${zi}`, 'cylinder', [lx, 0.015, lz], [0.048, 0.03, 0.048], '#C5A059', 'brushed_brass', 0.28, 0.85)
      );
    });
  });

  parts.push(
    p('base_plinth', 'rounded_box', [0, legH + deckH * 0.45, mainZOffset], [w - armW * 0.3, deckH * 0.9, mainD - 0.04], mainHex, fabricMat, 0.88, 0, [0, 0, 0], true),
    p('trim_rail', 'rounded_box', [0, legH + 0.02, mainZOffset], [w - 0.06, 0.035, mainD - 0.06], '#7A5438', 'walnut_wood', 0.5, 0)
  );

  parts.push(
    p('backrest_frame', 'rounded_box', [0, legH + deckH + (h - legH - deckH) * 0.45, mainZOffset - mainD / 2 + backD / 2], [w, h - legH - deckH, backD], mainHex, fabricMat, 0.9, 0, [0, 0, 0], true),
    p('backrest_cap', 'rounded_box', [0, h - 0.03, mainZOffset - mainD / 2 + backD / 2], [w - 0.02, 0.06, backD * 0.9], mainHex, fabricMat, 0.85, 0, [0, 0, 0], true),
    p('armrest_left', 'rounded_box', [-w / 2 + armW / 2, legH + (armH - legH) / 2, mainZOffset + 0.02], [armW, armH - legH, mainD - 0.04], mainHex, fabricMat, 0.88, 0, [0, 0, 0], true),
    p('armrest_right', 'rounded_box', [w / 2 - armW / 2, legH + (armH - legH) / 2, mainZOffset + 0.02], [armW, armH - legH, mainD - 0.04], mainHex, fabricMat, 0.88, 0, [0, 0, 0], true),
    p('armpad_left', 'rounded_box', [-w / 2 + armW - 0.01, armH + 0.015, mainZOffset + 0.02], [armW * 0.92, 0.05, mainD - 0.06], mainHex, fabricMat, 0.92, 0, [0, 0, 0], true),
    p('armpad_right', 'rounded_box', [w / 2 - armW + 0.01, armH + 0.015, mainZOffset + 0.02], [armW * 0.92, 0.05, mainD - 0.06], mainHex, fabricMat, 0.92, 0, [0, 0, 0], true)
  );

  const innerW = w - armW * 2 - 0.02;
  const seatCount = innerW > 1.35 ? 3 : 2;
  const cushionW = (innerW - (seatCount - 1) * 0.018) / seatCount;
  const seatY = legH + deckH + seatH / 2 - 0.01;
  const seatZ = mainZOffset + backD * 0.45;
  const seatD = mainD - backD - 0.04;

  for (let i = 0; i < seatCount; i++) {
    const cx = -innerW / 2 + cushionW / 2 + i * (cushionW + 0.018);
    parts.push(
      p(`seat_cushion_${i}`, 'rounded_box', [cx, seatY, seatZ], [cushionW, seatH, seatD], mainHex, fabricMat, 0.9, 0, [0, 0, 0], true),
      p(
        `back_cushion_${i}`,
        'rounded_box',
        [cx, seatY + seatH * 0.5 + 0.16, mainZOffset - mainD / 2 + backD + 0.1],
        [cushionW - 0.02, 0.34, 0.16],
        mainHex,
        fabricMat,
        0.92,
        0,
        [-0.14, 0, 0],
        true
      )
    );
  }

  parts.push(
    p('throw_pillow_left', 'rounded_box', [-w / 2 + armW + 0.16, seatY + seatH * 0.65, mainZOffset - 0.06], [0.36, 0.34, 0.13], '#E8DFD1', 'boucle_fabric', 0.92, 0, [-0.15, 0.32, 0.12]),
    p('throw_pillow_right', 'rounded_box', [w / 2 - armW - 0.16, seatY + seatH * 0.65, mainZOffset - 0.06], [0.36, 0.34, 0.13], '#4B6378', 'velvet', 0.85, 0, [-0.15, -0.32, -0.12])
  );

  if (hasChaise || isCorner) {
    const extW = isCorner ? Math.min(1.05, w * 0.42) : Math.min(0.88, w * 0.36);
    const extD = d - mainD;
    const extX = w / 2 - armW - extW / 2;
    const extZ = mainZOffset + mainD / 2 + extD / 2 - 0.02;
    parts.push(
      p('chaise_base', 'rounded_box', [extX, legH + deckH * 0.45, extZ], [extW, deckH * 0.9, extD + 0.04], mainHex, fabricMat, 0.88, 0, [0, 0, 0], true),
      p('chaise_cushion', 'rounded_box', [extX, seatY, extZ], [extW - 0.02, seatH, extD + 0.02], mainHex, fabricMat, 0.9, 0, [0, 0, 0], true),
      p('chaise_leg_l', 'cylinder', [extX - extW / 2 + 0.07, legH / 2, extZ + extD / 2 - 0.07], [0.045, legH, 0.045], '#B98C57', 'oak_wood', 0.55, 0),
      p('chaise_leg_r', 'cylinder', [extX + extW / 2 - 0.07, legH / 2, extZ + extD / 2 - 0.07], [0.045, legH, 0.045], '#B98C57', 'oak_wood', 0.55, 0)
    );
  }

  return parts;
}

function buildArmchairParts(
  w: number,
  d: number,
  h: number,
  mainHex: string,
  fabricMat: FurnitureMaterialType,
  isPoang: boolean
): FurniturePartSpec[] {
  const parts: FurniturePartSpec[] = [];
  const legH = 0.24;
  const seatY = 0.4;
  const legMat: FurnitureMaterialType = 'oak_wood';
  const frameHex = isPoang ? '#C9A472' : '#4A3628';

  const legOffsets: Array<[number, number]> = [
    [-w / 2 + 0.08, -d / 2 + 0.08],
    [w / 2 - 0.08, -d / 2 + 0.08],
    [-w / 2 + 0.08, d / 2 - 0.08],
    [w / 2 - 0.08, d / 2 - 0.08],
  ];
  legOffsets.forEach(([lx, lz], i) => {
    parts.push(
      p(`chair_leg_${i}`, 'cylinder', [lx, legH / 2, lz], [0.042, legH, 0.042], frameHex, legMat, 0.55, 0),
      p(`chair_glide_${i}`, 'cylinder', [lx, 0.012, lz], [0.045, 0.024, 0.045], '#222222', 'matte_black_metal', 0.5, 0.4)
    );
  });

  parts.push(
    p('rail_left', 'rounded_box', [-w / 2 + 0.08, legH, 0], [0.045, 0.045, d - 0.14], frameHex, legMat, 0.55, 0),
    p('rail_right', 'rounded_box', [w / 2 - 0.08, legH, 0], [0.045, 0.045, d - 0.14], frameHex, legMat, 0.55, 0),
    p('rail_front', 'rounded_box', [0, legH, d / 2 - 0.09], [w - 0.16, 0.045, 0.045], frameHex, legMat, 0.55, 0),
    p('seat_deck', 'rounded_box', [0, legH + 0.05, 0], [w - 0.12, 0.09, d - 0.12], mainHex, fabricMat, 0.88, 0, [0, 0, 0], true),
    p('seat_cushion', 'rounded_box', [0, seatY, 0.04], [w - 0.24, 0.14, d - 0.22], mainHex, fabricMat, 0.9, 0, [0, 0, 0], true),
    p('lumbar_pillow', 'rounded_box', [0, seatY + 0.13, -d * 0.15], [w * 0.54, 0.18, 0.11], '#E7DFD3', 'boucle_fabric', 0.92, 0, [-0.15, 0, 0]),
    p('backrest_panel', 'rounded_box', [0, (seatY + h) * 0.52, -d / 2 + 0.12], [w - 0.16, h - seatY + 0.05, 0.16], mainHex, fabricMat, 0.88, 0, [-0.14, 0, 0], true),
    p('wing_left', 'rounded_box', [-w / 2 + 0.11, h - 0.24, -d / 2 + 0.22], [0.1, 0.42, 0.24], mainHex, fabricMat, 0.88, 0, [0, 0, 0], true),
    p('wing_right', 'rounded_box', [w / 2 - 0.11, h - 0.24, -d / 2 + 0.22], [0.1, 0.42, 0.24], mainHex, fabricMat, 0.88, 0, [0, 0, 0], true),
    p('arm_left', 'rounded_box', [-w / 2 + 0.08, legH + 0.22, 0.02], [0.14, 0.22, d - 0.14], isPoang ? frameHex : mainHex, isPoang ? legMat : fabricMat, 0.85, 0, [0, 0, 0], !isPoang),
    p('arm_right', 'rounded_box', [w / 2 - 0.08, legH + 0.22, 0.02], [0.14, 0.22, d - 0.14], isPoang ? frameHex : mainHex, isPoang ? legMat : fabricMat, 0.85, 0, [0, 0, 0], !isPoang)
  );

  [-0.14, 0, 0.14].forEach((bx, i) => {
    parts.push(
      p(`tuft_button_${i}`, 'sphere', [bx, seatY + 0.34, -d / 2 + 0.21], [0.03, 0.03, 0.03], mainHex, fabricMat, 0.8, 0)
    );
  });

  return parts;
}

function buildBedParts(
  w: number,
  d: number,
  h: number,
  mainHex: string,
  woodMat: FurnitureMaterialType
): FurniturePartSpec[] {
  const parts: FurniturePartSpec[] = [];
  const legH = 0.15;
  const railH = 0.2;
  const matW = w - 0.14;
  const matD = d - 0.16;
  const matH = 0.22;

  const legCoords: Array<[number, number]> = [
    [-w / 2 + 0.07, -d / 2 + 0.07],
    [w / 2 - 0.07, -d / 2 + 0.07],
    [-w / 2 + 0.07, d / 2 - 0.07],
    [w / 2 - 0.07, d / 2 - 0.07],
    [0, -d * 0.15],
    [0, d * 0.15],
  ];
  legCoords.forEach(([lx, lz], i) => {
    parts.push(
      p(`bed_leg_${i}`, 'cylinder', [lx, legH / 2, lz], [0.055, legH, 0.055], mainHex, woodMat, 0.55, 0, [0, 0, 0], true)
    );
  });

  const railY = legH + railH / 2;
  parts.push(
    p('rail_left', 'rounded_box', [-w / 2 + 0.04, railY, 0], [0.06, railH, d - 0.06], mainHex, woodMat, 0.55, 0, [0, 0, 0], true),
    p('rail_right', 'rounded_box', [w / 2 - 0.04, railY, 0], [0.06, railH, d - 0.06], mainHex, woodMat, 0.55, 0, [0, 0, 0], true),
    p('footboard', 'rounded_box', [0, railY, d / 2 - 0.04], [w, railH, 0.06], mainHex, woodMat, 0.55, 0, [0, 0, 0], true),
    p('center_beam', 'rounded_box', [0, legH + 0.06, 0], [0.06, 0.08, d - 0.16], '#C9B18B', 'oak_wood', 0.65, 0),
    p('slat_deck', 'rounded_box', [0, legH + 0.1, 0], [matW - 0.04, 0.03, matD - 0.04], '#D9C4A1', 'oak_wood', 0.7, 0),
    p('headboard_main', 'rounded_box', [0, legH + (h - legH) / 2, -d / 2 + 0.045], [w, h - legH, 0.08], mainHex, woodMat, 0.55, 0, [0, 0, 0], true),
    p('headboard_cap', 'rounded_box', [0, h - 0.02, -d / 2 + 0.045], [w + 0.02, 0.04, 0.095], mainHex, woodMat, 0.5, 0, [0, 0, 0], true),
    p('headboard_panel_l', 'rounded_box', [-w * 0.25, legH + (h - legH) * 0.58, -d / 2 + 0.088], [w * 0.42, (h - legH) * 0.65, 0.018], '#EAE6DF', 'white_laminate', 0.6, 0),
    p('headboard_panel_r', 'rounded_box', [w * 0.25, legH + (h - legH) * 0.58, -d / 2 + 0.088], [w * 0.42, (h - legH) * 0.65, 0.018], '#EAE6DF', 'white_laminate', 0.6, 0)
  );

  const matY = legH + 0.11 + matH / 2;
  const pilW = Math.min(0.68, matW * 0.42);
  parts.push(
    p('mattress', 'rounded_box', [0, matY, 0.02], [matW, matH, matD], '#F7F5F0', 'boucle_fabric', 0.92, 0),
    p('mattress_piping', 'rounded_box', [0, matY + matH * 0.46, 0.02], [matW + 0.01, 0.025, matD + 0.01], '#EAE5DC', 'boucle_fabric', 0.9, 0),
    p('duvet', 'rounded_box', [0, matY + matH * 0.52, d * 0.14], [matW + 0.03, 0.09, matD * 0.68], '#ECEAE3', 'boucle_fabric', 0.94, 0),
    p('throw_blanket', 'rounded_box', [0, matY + matH * 0.58, d * 0.34], [matW + 0.05, 0.06, matD * 0.22], '#8E9AA0', 'velvet', 0.88, 0),
    p('pillow_back_l', 'rounded_box', [-matW * 0.24, matY + matH * 0.65, -d / 2 + 0.25], [pilW, 0.15, 0.38], '#FFFFFF', 'boucle_fabric', 0.92, 0, [0.22, 0, 0]),
    p('pillow_back_r', 'rounded_box', [matW * 0.24, matY + matH * 0.65, -d / 2 + 0.25], [pilW, 0.15, 0.38], '#FFFFFF', 'boucle_fabric', 0.92, 0, [0.22, 0, 0]),
    p('pillow_front_l', 'rounded_box', [-matW * 0.23, matY + matH * 0.62, -d / 2 + 0.43], [pilW * 0.85, 0.14, 0.3], '#D9CFC0', 'boucle_fabric', 0.9, 0, [0.3, 0.08, 0]),
    p('pillow_front_r', 'rounded_box', [matW * 0.23, matY + matH * 0.62, -d / 2 + 0.43], [pilW * 0.85, 0.14, 0.3], '#D9CFC0', 'boucle_fabric', 0.9, 0, [0.3, -0.08, 0])
  );

  return parts;
}

function buildTableOrDeskParts(
  w: number,
  d: number,
  h: number,
  mainHex: string,
  woodMat: FurnitureMaterialType,
  isCoffee: boolean,
  isDesk: boolean
): FurniturePartSpec[] {
  const parts: FurniturePartSpec[] = [];
  const topT = isCoffee ? 0.032 : 0.038;
  const legH = h - topT;
  const legMat: FurnitureMaterialType = isDesk ? 'matte_black_metal' : woodMat;
  const legHex = isDesk ? '#2B2E33' : mainHex;

  parts.push(
    p('tabletop', 'rounded_box', [0, h - topT / 2, 0], [w, topT, d], mainHex, woodMat, 0.48, 0, [0, 0, 0], true),
    p('under_apron', 'rounded_box', [0, h - topT - 0.025, 0], [w - 0.1, 0.05, d - 0.1], legHex, legMat, 0.52, isDesk ? 0.35 : 0)
  );

  const legCorners: Array<[number, number]> = [
    [-w / 2 + 0.07, -d / 2 + 0.07],
    [w / 2 - 0.07, -d / 2 + 0.07],
    [-w / 2 + 0.07, d / 2 - 0.07],
    [w / 2 - 0.07, d / 2 - 0.07],
  ];
  legCorners.forEach(([lx, lz], i) => {
    const tiltX = lz < 0 ? 0.04 : -0.04;
    const tiltZ = lx < 0 ? -0.04 : 0.04;
    parts.push(
      p(`table_leg_${i}`, 'cylinder', [lx, legH / 2, lz], [0.042, legH, 0.042], legHex, legMat, 0.45, isDesk ? 0.5 : 0, [tiltX, 0, tiltZ]),
      p(`foot_pad_${i}`, 'cylinder', [lx, 0.012, lz], [0.055, 0.024, 0.055], '#1F2022', 'matte_black_metal', 0.4, 0.6),
      p(`corner_bracket_${i}`, 'rounded_box', [lx, h - topT - 0.025, lz], [0.09, 0.04, 0.09], '#C4A15C', 'brushed_brass', 0.32, 0.85)
    );
  });

  parts.push(
    p('cross_rail_back', 'rounded_box', [0, legH * 0.42, -d / 2 + 0.08], [w - 0.18, 0.03, 0.03], legHex, legMat, 0.45, isDesk ? 0.5 : 0),
    p('cross_rail_l', 'rounded_box', [-w / 2 + 0.08, legH * 0.25, 0], [0.03, 0.03, d - 0.18], legHex, legMat, 0.45, isDesk ? 0.5 : 0),
    p('cross_rail_r', 'rounded_box', [w / 2 - 0.08, legH * 0.25, 0], [0.03, 0.03, d - 0.18], legHex, legMat, 0.45, isDesk ? 0.5 : 0),
    p(
      isCoffee ? 'lower_magazine_shelf' : 'drawer_box',
      'rounded_box',
      [0, isCoffee ? legH * 0.35 : h - topT - 0.06, isCoffee ? 0 : d * 0.12],
      [isCoffee ? w - 0.22 : w * 0.35, 0.028, isCoffee ? d - 0.22 : d * 0.55],
      mainHex,
      woodMat,
      0.5,
      0,
      [0, 0, 0],
      true
    ),
    p('book_bottom', 'rounded_box', [-w * 0.18, h + 0.012, d * 0.05], [0.22, 0.024, 0.28], '#EAE6DC', 'white_laminate', 0.7, 0),
    p('book_top', 'rounded_box', [-w * 0.17, h + 0.035, d * 0.04], [0.19, 0.02, 0.25], '#39556E', 'boucle_fabric', 0.8, 0, [0, 0.18, 0]),
    p('ceramic_vessel', 'cylinder', [w * 0.18, h + 0.06, -d * 0.06], [0.1, 0.12, 0.1], '#F1EEE8', 'white_laminate', 0.4, 0),
    p('coaster', 'cylinder', [w * 0.04, h + 0.004, d * 0.14], [0.09, 0.008, 0.09], '#B89566', 'oak_wood', 0.6, 0)
  );

  return parts;
}

function buildShelvingOrWardrobeParts(
  w: number,
  d: number,
  h: number,
  mainHex: string,
  matType: FurnitureMaterialType,
  variant: 'bookcase' | 'kallax' | 'chest' | 'wardrobe' | 'tv_unit'
): FurniturePartSpec[] {
  const parts: FurniturePartSpec[] = [];
  const t = 0.026;
  const plinthH = variant === 'kallax' ? 0.04 : 0.08;

  parts.push(
    p('plinth_front', 'rounded_box', [0, plinthH / 2, d / 2 - 0.03], [w - 0.04, plinthH, 0.03], mainHex, matType, 0.5, 0, [0, 0, 0], true),
    p('plinth_back', 'rounded_box', [0, plinthH / 2, -d / 2 + 0.03], [w - 0.04, plinthH, 0.03], mainHex, matType, 0.5, 0, [0, 0, 0], true),
    p('side_left', 'rounded_box', [-w / 2 + t / 2, plinthH + (h - plinthH) / 2, 0], [t, h - plinthH, d], mainHex, matType, 0.5, 0, [0, 0, 0], true),
    p('side_right', 'rounded_box', [w / 2 - t / 2, plinthH + (h - plinthH) / 2, 0], [t, h - plinthH, d], mainHex, matType, 0.5, 0, [0, 0, 0], true),
    p('top_panel', 'rounded_box', [0, h - t / 2, 0], [w, t, d], mainHex, matType, 0.48, 0, [0, 0, 0], true),
    p('bottom_panel', 'rounded_box', [0, plinthH + t / 2, 0], [w - t * 2, t, d], mainHex, matType, 0.5, 0, [0, 0, 0], true)
  );

  if (variant !== 'kallax') {
    parts.push(
      p('back_board', 'rounded_box', [0, plinthH + (h - plinthH) / 2, -d / 2 + 0.008], [w - t, h - plinthH - t, 0.015], mainHex, matType, 0.65, 0, [0, 0, 0], true)
    );
  }

  const bodyH = h - plinthH - t * 2;
  const innerW = w - t * 2;

  if (variant === 'chest' || variant === 'wardrobe' || variant === 'tv_unit') {
    const cols = w >= 1.1 ? (variant === 'tv_unit' ? 3 : 2) : 1;
    const rows = variant === 'chest' ? 3 : variant === 'wardrobe' ? 1 : 2;
    const cellW = innerW / cols;
    const cellH = bodyH / rows;

    for (let c = 1; c < cols; c++) {
      const dx = -innerW / 2 + c * cellW;
      parts.push(p(`divider_v_${c}`, 'rounded_box', [dx, plinthH + t + bodyH / 2, 0], [0.02, bodyH, d - 0.03], mainHex, matType, 0.5, 0));
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = -innerW / 2 + cellW / 2 + c * cellW;
        const cy = plinthH + t + cellH / 2 + r * cellH;
        const isOpenCenterTv = variant === 'tv_unit' && c === 1 && r === 1;
        if (isOpenCenterTv) {
          parts.push(p('media_shelf', 'rounded_box', [cx, cy - cellH * 0.45, 0], [cellW - 0.02, 0.02, d - 0.04], mainHex, matType, 0.5, 0));
        } else {
          parts.push(
            p(`door_front_${r}_${c}`, 'rounded_box', [cx, cy, d / 2 - 0.012], [cellW - 0.008, cellH - 0.01, 0.022], mainHex, matType, 0.45, 0, [0, 0, 0], true),
            p(`handle_${r}_${c}`, 'cylinder', [variant === 'wardrobe' ? cx + (c === 0 ? 0.06 : -0.06) : cx, cy, d / 2 + 0.012], [0.014, variant === 'wardrobe' ? 0.18 : 0.1, 0.014], '#222426', 'matte_black_metal', 0.35, 0.8, [0, 0, variant === 'wardrobe' ? 0 : Math.PI / 2])
          );
        }
      }
    }
  } else {
    const shelfCount = h > 1.7 ? 5 : 4;
    const colCount = variant === 'kallax' && w >= 1.2 ? 3 : w >= 1.0 ? 2 : 1;
    for (let s = 1; s < shelfCount; s++) {
      const sy = plinthH + t + (bodyH / shelfCount) * s;
      parts.push(p(`shelf_${s}`, 'rounded_box', [0, sy, 0], [innerW, 0.022, d - 0.02], mainHex, matType, 0.5, 0, [0, 0, 0], true));
    }
    for (let c = 1; c < colCount; c++) {
      const cx = -innerW / 2 + (innerW / colCount) * c;
      parts.push(p(`v_divider_${c}`, 'rounded_box', [cx, plinthH + t + bodyH / 2, 0], [0.02, bodyH, d - 0.02], mainHex, matType, 0.5, 0, [0, 0, 0], true));
    }
    for (let b = 0; b < 6; b++) {
      const row = (b % (shelfCount - 1)) + 1;
      const sy = plinthH + t + (bodyH / shelfCount) * row;
      const bx = -innerW * 0.32 + (b % 3) * (innerW * 0.28);
      const bookColors = ['#3B5978', '#C6A372', '#E2DDD3', '#6C7D72', '#9D5B47', '#44484D'];
      parts.push(
        p(`book_prop_${b}`, 'rounded_box', [bx, sy + 0.11, 0.02], [0.04, 0.2, 0.18], bookColors[b % bookColors.length], 'white_laminate', 0.7, 0)
      );
    }
  }

  for (let i = 0; i < 6 && parts.length < 22; i++) {
    parts.push(
      p(
        `foot_leveler_${i}`,
        'cylinder',
        [-w / 2 + 0.06 + (i % 3) * ((w - 0.12) / 2), 0.01, i < 3 ? -d / 2 + 0.06 : d / 2 - 0.06],
        [0.036, 0.02, 0.036],
        '#2A2C2E',
        'matte_black_metal',
        0.5,
        0.7
      )
    );
  }

  return parts;
}

function buildLightingParts(
  w: number,
  h: number,
  mainHex: string,
  isFloorLamp: boolean,
  isGlobe: boolean
): FurniturePartSpec[] {
  const parts: FurniturePartSpec[] = [];
  const baseR = Math.min(0.24, Math.max(0.11, w * 0.42));

  parts.push(
    p('base_plinth', 'cylinder', [0, 0.015, 0], [baseR * 2, 0.03, baseR * 2], mainHex, 'matte_black_metal', 0.35, 0.75, [0, 0, 0], true),
    p('base_step', 'cylinder', [0, 0.038, 0], [baseR * 1.4, 0.016, baseR * 1.4], '#C5A059', 'brushed_brass', 0.28, 0.88),
    p('strain_relief', 'cylinder', [0, 0.055, 0], [0.04, 0.025, 0.04], '#222222', 'matte_black_metal', 0.4, 0.6),
    p('foot_switch', 'cylinder', [baseR * 1.15, 0.015, 0], [0.07, 0.028, 0.07], '#222222', 'matte_black_metal', 0.5, 0.3)
  );

  const stemTop = isGlobe ? 0.07 : isFloorLamp ? h * 0.76 : h * 0.64;
  const segCount = 3;
  const segH = (stemTop - 0.06) / segCount;
  for (let i = 0; i < segCount; i++) {
    const sy = 0.06 + segH / 2 + i * segH;
    parts.push(
      p(`stem_seg_${i}`, 'cylinder', [0, sy, 0], [0.028, segH, 0.028], mainHex, 'matte_black_metal', 0.35, 0.8, [0, 0, 0], true),
      p(`knuckle_${i}`, 'cylinder', [0, sy + segH / 2, 0], [0.042, 0.022, 0.042], '#C5A059', 'brushed_brass', 0.28, 0.9)
    );
  }

  if (isGlobe) {
    const r = Math.min(0.22, w / 2);
    parts.push(
      p('opal_globe_outer', 'sphere', [0, 0.06 + r, 0], [r * 2, r * 2, r * 2], '#FFFBF0', 'clear_glass', 0.2, 0.05),
      p('emissive_core', 'sphere', [0, 0.06 + r, 0], [r * 1.1, r * 1.1, r * 1.1], '#FFDA94', 'emissive_lamp', 0.1, 0),
      p('inner_socket', 'cylinder', [0, 0.08, 0], [0.045, 0.05, 0.045], '#C5A059', 'brushed_brass', 0.3, 0.85)
    );
  } else {
    const shadeH = Math.max(0.22, h - stemTop + 0.04);
    const shadeR = Math.max(0.18, w * 0.85);
    const shadeY = h - shadeH / 2;
    parts.push(
      p('shade_cone', 'cone', [0, shadeY, 0], [shadeR, shadeH, shadeR], mainHex, 'matte_black_metal', 0.38, 0.72, [0, 0, 0], true),
      p('shade_rim', 'torus', [0, h - shadeH, 0], [shadeR * 0.98, 0.015, shadeR * 0.98], '#C5A059', 'brushed_brass', 0.25, 0.9, [Math.PI / 2, 0, 0]),
      p('diffuser_disc', 'cylinder', [0, shadeY - 0.02, 0], [shadeR * 0.7, 0.02, shadeR * 0.7], '#FFF8EA', 'emissive_lamp', 0.15, 0),
      p('bulb_core', 'sphere', [0, shadeY - 0.04, 0], [0.09, 0.1, 0.09], '#FFD98E', 'emissive_lamp', 0.1, 0)
    );
  }

  for (let i = 0; i < 8 && parts.length < 21; i++) {
    const ang = (i / 8) * Math.PI * 2;
    parts.push(
      p(
        `base_spoke_${i}`,
        'rounded_box',
        [Math.cos(ang) * baseR * 0.65, 0.022, Math.sin(ang) * baseR * 0.65],
        [baseR * 0.55, 0.012, 0.014],
        '#C5A059',
        'brushed_brass',
        0.3,
        0.85,
        [0, -ang, 0]
      )
    );
  }

  return parts;
}

function buildRugOrMirrorParts(
  w: number,
  d: number,
  h: number,
  mainHex: string,
  isMirror: boolean
): FurniturePartSpec[] {
  const parts: FurniturePartSpec[] = [];
  if (isMirror) {
    const r = Math.min(w, h) / 2;
    parts.push(
      p('mirror_glass', 'cylinder', [0, r, 0.01], [r * 1.9, 0.015, r * 1.9], '#DDE6EC', 'clear_glass', 0.05, 0.95, [Math.PI / 2, 0, 0]),
      p('mirror_frame', 'torus', [0, r, 0], [r * 1.94, 0.08, r * 1.94], mainHex, 'walnut_wood', 0.48, 0, [0, 0, 0], true)
    );
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      parts.push(
        p(`rim_segment_${i}`, 'rounded_box', [Math.cos(ang) * r * 0.97, r + Math.sin(ang) * r * 0.97, 0], [0.06, 0.06, 0.09], mainHex, 'walnut_wood', 0.5, 0, [0, 0, ang])
      );
    }
    return parts;
  }

  const pileH = Math.max(0.014, h);
  parts.push(
    p('rug_underlay', 'rounded_box', [0, 0.004, 0], [w - 0.03, 0.008, d - 0.03], '#D6D0C6', 'boucle_fabric', 0.95, 0),
    p('rug_pile', 'rounded_box', [0, pileH / 2 + 0.004, 0], [w, pileH, d], mainHex, 'boucle_fabric', 0.95, 0, [0, 0, 0], true),
    p('rug_border_n', 'rounded_box', [0, pileH + 0.005, -d / 2 + 0.14], [w - 0.16, 0.005, 0.06], '#EFECE6', 'boucle_fabric', 0.92, 0),
    p('rug_border_s', 'rounded_box', [0, pileH + 0.005, d / 2 - 0.14], [w - 0.16, 0.005, 0.06], '#EFECE6', 'boucle_fabric', 0.92, 0),
    p('rug_border_w', 'rounded_box', [-w / 2 + 0.14, pileH + 0.005, 0], [0.06, 0.005, d - 0.28], '#EFECE6', 'boucle_fabric', 0.92, 0),
    p('rug_border_e', 'rounded_box', [w / 2 - 0.14, pileH + 0.005, 0], [0.06, 0.005, d - 0.28], '#EFECE6', 'boucle_fabric', 0.92, 0)
  );

  for (let t = 0; t < 8; t++) {
    const tx = -w * 0.42 + (t / 7) * (w * 0.84);
    parts.push(
      p(`fringe_n_${t}`, 'rounded_box', [tx, 0.006, -d / 2 - 0.035], [0.03, 0.008, 0.07], '#EFECE6', 'boucle_fabric', 0.95, 0),
      p(`fringe_s_${t}`, 'rounded_box', [tx, 0.006, d / 2 + 0.035], [0.03, 0.008, 0.07], '#EFECE6', 'boucle_fabric', 0.95, 0)
    );
  }
  return parts;
}

function buildDiningChairParts(
  w: number,
  d: number,
  h: number,
  mainHex: string,
  woodMat: FurnitureMaterialType
): FurniturePartSpec[] {
  const parts: FurniturePartSpec[] = [];
  const seatY = 0.45;
  const corners: Array<[number, number]> = [
    [-w / 2 + 0.05, -d / 2 + 0.05],
    [w / 2 - 0.05, -d / 2 + 0.05],
    [-w / 2 + 0.05, d / 2 - 0.05],
    [w / 2 - 0.05, d / 2 - 0.05],
  ];
  corners.forEach(([lx, lz], i) => {
    parts.push(
      p(`chair_leg_${i}`, 'cylinder', [lx, seatY / 2, lz], [0.034, seatY, 0.034], mainHex, woodMat, 0.5, 0, [0, 0, 0], true),
      p(`chair_glide_${i}`, 'cylinder', [lx, 0.008, lz], [0.036, 0.016, 0.036], '#222222', 'matte_black_metal', 0.4, 0.5)
    );
  });

  parts.push(
    p('seat_rail_l', 'rounded_box', [-w / 2 + 0.05, seatY - 0.04, 0], [0.025, 0.035, d - 0.1], mainHex, woodMat, 0.5, 0),
    p('seat_rail_r', 'rounded_box', [w / 2 - 0.05, seatY - 0.04, 0], [0.025, 0.035, d - 0.1], mainHex, woodMat, 0.5, 0),
    p('seat_rail_f', 'rounded_box', [0, seatY - 0.04, d / 2 - 0.05], [w - 0.1, 0.035, 0.025], mainHex, woodMat, 0.5, 0),
    p('seat_rail_b', 'rounded_box', [0, seatY - 0.04, -d / 2 + 0.05], [w - 0.1, 0.035, 0.025], mainHex, woodMat, 0.5, 0),
    p('seat_pan', 'rounded_box', [0, seatY + 0.015, 0.01], [w - 0.02, 0.035, d - 0.03], mainHex, woodMat, 0.45, 0, [0, 0, 0], true),
    p('seat_pad', 'rounded_box', [0, seatY + 0.04, 0.02], [w - 0.06, 0.03, d - 0.08], '#E5DED1', 'boucle_fabric', 0.88, 0),
    p('back_post_l', 'cylinder', [-w / 2 + 0.05, (seatY + h) / 2, -d / 2 + 0.04], [0.032, h - seatY, 0.032], mainHex, woodMat, 0.5, 0, [-0.1, 0, 0], true),
    p('back_post_r', 'cylinder', [w / 2 - 0.05, (seatY + h) / 2, -d / 2 + 0.04], [0.032, h - seatY, 0.032], mainHex, woodMat, 0.5, 0, [-0.1, 0, 0], true),
    p('back_crest', 'rounded_box', [0, h - 0.08, -d / 2 + 0.02], [w - 0.04, 0.15, 0.035], mainHex, woodMat, 0.45, 0, [-0.12, 0, 0], true),
    p('back_lumbar', 'rounded_box', [0, seatY + 0.18, -d / 2 + 0.045], [w - 0.06, 0.08, 0.03], mainHex, woodMat, 0.48, 0, [-0.1, 0, 0], true),
    p('stretcher_mid', 'cylinder', [0, 0.16, 0], [0.02, w - 0.1, 0.02], mainHex, woodMat, 0.55, 0, [0, 0, Math.PI / 2]),
    p('stretcher_front', 'cylinder', [0, 0.16, d / 2 - 0.05], [0.02, w - 0.1, 0.02], mainHex, woodMat, 0.55, 0, [0, 0, Math.PI / 2])
  );

  return parts;
}

function buildDecorPlantParts(
  w: number,
  d: number,
  h: number,
  potHex: string,
  leafHex: string
): FurniturePartSpec[] {
  const parts: FurniturePartSpec[] = [];
  const potRadius = Math.max(0.12, Math.min(w, d) * 0.35);
  const potH = h * 0.32;

  // Planter Pot + Rim + Soil
  parts.push(
    p('plant_pot_body', 'cylinder', [0, potH / 2, 0], [potRadius * 2, potH, potRadius * 2], potHex, 'white_laminate', 0.4, 0.05, [0, 0, 0], true),
    p('plant_pot_rim', 'torus', [0, potH, 0], [potRadius * 2.05, 0.02, potRadius * 2.05], potHex, 'white_laminate', 0.4, 0.05),
    p('plant_soil', 'cylinder', [0, potH * 0.94, 0], [potRadius * 1.85, 0.04, potRadius * 1.85], '#2D231B', 'boucle_fabric', 0.95, 0)
  );

  // 4 wooden tripod/stand legs
  const legR = potRadius * 0.9;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const lx = Math.cos(angle) * legR;
    const lz = Math.sin(angle) * legR;
    parts.push(
      p(`stand_leg_${i}`, 'cylinder', [lx, potH * 0.25, lz], [0.024, potH * 0.5, 0.024], '#C69E70', 'oak_wood', 0.55, 0.02)
    );
  }

  // Trunk & 3 branches
  const trunkH = h - potH * 0.9;
  parts.push(
    p('plant_main_trunk', 'cylinder', [0, potH + trunkH * 0.4, 0], [0.038, trunkH * 0.8, 0.038], '#4A3D31', 'oak_wood', 0.7, 0),
    p('plant_branch_l', 'cylinder', [-0.06, potH + trunkH * 0.45, 0.04], [0.02, trunkH * 0.35, 0.02], '#4A3D31', 'oak_wood', 0.7, 0, [0.3, 0, -0.4]),
    p('plant_branch_r', 'cylinder', [0.07, potH + trunkH * 0.6, -0.05], [0.02, trunkH * 0.35, 0.02], '#4A3D31', 'oak_wood', 0.7, 0, [-0.3, 0, 0.4]),
    p('plant_branch_t', 'cylinder', [0, potH + trunkH * 0.75, 0.06], [0.018, trunkH * 0.3, 0.018], '#4A3D31', 'oak_wood', 0.7, 0, [0.35, 0, 0])
  );

  // 12 Lush Fiddle-Leaf Fig leaves radiating upwards and outwards
  const leafCount = 12;
  const leafColors = [leafHex, '#2E5E38', '#387345', '#42854F'];
  for (let i = 0; i < leafCount; i++) {
    const fraction = i / leafCount;
    const ly = potH + trunkH * (0.28 + fraction * 0.7);
    const angle = i * 2.39996; // Golden angle phyllotaxis
    const radiusOut = (w * 0.3) * (0.4 + fraction * 0.6);
    const lx = Math.cos(angle) * radiusOut;
    const lz = Math.sin(angle) * radiusOut;
    const lw = 0.16 + fraction * 0.08;
    const lh = 0.012;
    const ld = 0.22 + fraction * 0.1;
    const col = leafColors[i % leafColors.length];

    parts.push(
      p(
        `leaf_${i}`,
        'rounded_box',
        [lx, ly, lz],
        [lw, lh, ld],
        col,
        'velvet',
        0.55,
        0.05,
        [Math.sin(angle) * 0.35, angle, Math.cos(angle) * -0.3]
      )
    );
  }

  return parts;
}

function buildKitchenIslandParts(
  w: number,
  d: number,
  h: number,
  mainHex: string,
  woodMat: FurnitureMaterialType
): FurniturePartSpec[] {
  const parts: FurniturePartSpec[] = [];
  const topH = 0.045;
  const legSize = 0.06;
  const bodyH = h - topH;

  // Solid butcher block oak worktop
  parts.push(
    p('butcher_block_top', 'rounded_box', [0, h - topH / 2, 0], [w, topH, d], '#C9A374', 'oak_wood', 0.45, 0.02, [0, 0, 0]),
    p('island_subframe', 'rounded_box', [0, h - topH - 0.03, 0], [w - 0.08, 0.05, d - 0.08], mainHex, woodMat, 0.45, 0.05)
  );

  // 4 corner legs
  const legX = w / 2 - legSize / 2 - 0.04;
  const legZ = d / 2 - legSize / 2 - 0.04;
  const corners: Array<[number, number]> = [
    [-legX, -legZ],
    [legX, -legZ],
    [-legX, legZ],
    [legX, legZ],
  ];

  corners.forEach(([lx, lz], i) => {
    parts.push(
      p(`island_leg_${i}`, 'rounded_box', [lx, bodyH / 2, lz], [legSize, bodyH, legSize], mainHex, woodMat, 0.45, 0.05, [0, 0, 0], true),
      p(`island_glide_${i}`, 'cylinder', [lx, 0.01, lz], [legSize * 0.85, 0.02, legSize * 0.85], '#222222', 'matte_black_metal', 0.4, 0.6)
    );
  });

  // Solid carcass panels (left, right, back)
  parts.push(
    p('carcass_left', 'rounded_box', [-legX + 0.015, bodyH * 0.55, 0], [0.025, bodyH * 0.85, d - 0.16], mainHex, woodMat, 0.45, 0.05),
    p('carcass_right', 'rounded_box', [legX - 0.015, bodyH * 0.55, 0], [0.025, bodyH * 0.85, d - 0.16], mainHex, woodMat, 0.45, 0.05),
    p('carcass_back', 'rounded_box', [0, bodyH * 0.55, -legZ + 0.015], [w - 0.16, bodyH * 0.85, 0.025], mainHex, woodMat, 0.45, 0.05)
  );

  // Slatted lower wooden shelf
  const shelfY = 0.18;
  parts.push(
    p('shelf_frame', 'rounded_box', [0, shelfY, 0], [w - 0.12, 0.03, d - 0.12], '#BFA175', 'oak_wood', 0.5, 0.02)
  );
  for (let s = 0; s < 5; s++) {
    const sx = -w * 0.32 + s * (w * 0.16);
    parts.push(
      p(`slat_${s}`, 'cylinder', [sx, shelfY + 0.02, 0], [0.02, d - 0.14, 0.02], '#C9A374', 'oak_wood', 0.5, 0.02, [Math.PI / 2, 0, 0])
    );
  }

  // Front drawers / doors (2 panels)
  const drawerH = 0.22;
  const drawerW = (w - 0.22) / 2;
  const drawerY = bodyH - 0.16;
  parts.push(
    p('drawer_front_l', 'rounded_box', [-drawerW / 2 - 0.01, drawerY, legZ - 0.01], [drawerW, drawerH, 0.022], mainHex, woodMat, 0.45, 0.05, [0, 0, 0], true),
    p('drawer_front_r', 'rounded_box', [drawerW / 2 + 0.01, drawerY, legZ - 0.01], [drawerW, drawerH, 0.022], mainHex, woodMat, 0.45, 0.05, [0, 0, 0], true),
    p('drawer_handle_l', 'cylinder', [-drawerW / 2 - 0.01, drawerY, legZ + 0.015], [0.016, 0.14, 0.016], '#CCCCCC', 'chrome', 0.2, 0.85, [0, 0, Math.PI / 2]),
    p('drawer_handle_r', 'cylinder', [drawerW / 2 + 0.01, drawerY, legZ + 0.015], [0.016, 0.14, 0.016], '#CCCCCC', 'chrome', 0.2, 0.85, [0, 0, Math.PI / 2])
  );

  // Side towel rail bar
  parts.push(
    p('towel_rail', 'cylinder', [w / 2 + 0.035, bodyH * 0.75, 0], [0.018, d * 0.65, 0.018], '#CCCCCC', 'chrome', 0.2, 0.85, [Math.PI / 2, 0, 0])
  );

  return parts;
}

/**
 * Generate a 20–40 sub-part multi-material parametric 3D Furniture3DSpec (world meters, floor at y=0)
 * tailored to the IKEA product's exact dimensions, swatch hex, material, and archetype.
 */
export function buildParametric3DSpec(
  product: IkeaProduct,
  swatchHex?: string,
  swatchName?: string
): Furniture3DSpec {
  const chosenHex = swatchHex || product.swatches?.[0]?.hex || '#D8CFC2';
  const chosenSwatch = swatchName || product.swatches?.[0]?.name || 'Natural';
  const w = Number(((product.dimensionsCm?.width || 120) / 100).toFixed(3));
  const d = Number(((product.dimensionsCm?.depth || 80) / 100).toFixed(3));
  const h = Number(((product.dimensionsCm?.height || 75) / 100).toFixed(3));

  const arch = (product.archetype || '').toLowerCase();
  const desc = `${product.name} ${product.typeName} ${product.materialDescription} ${chosenSwatch}`;
  const fabricMat = inferFabricMaterial(desc);
  const woodMat = inferWoodMaterial(desc);

  let parts: FurniturePartSpec[];

  if (arch.includes('corner') || arch.includes('chaise') || arch === 'sofa' || arch === 'sofa_3seat') {
    parts = buildSofaParts(w, d, h, chosenHex, fabricMat, arch.includes('corner'), arch.includes('chaise'));
  } else if (arch.includes('armchair') || arch.includes('wing') || arch.includes('poang')) {
    parts = buildArmchairParts(w, d, h, chosenHex, fabricMat, arch.includes('poang'));
  } else if (arch.includes('bed') || arch.includes('daybed')) {
    parts = buildBedParts(w, d, h, chosenHex, woodMat);
  } else if (arch.includes('plant')) {
    parts = buildDecorPlantParts(w, d, h, '#222325', chosenHex || '#2E5E38');
  } else if (arch.includes('island') || arch.includes('kitchen') || arch.includes('cart')) {
    parts = buildKitchenIslandParts(w, d, h, chosenHex, woodMat);
  } else if (arch.includes('coffee') || arch.includes('dining_table') || arch.includes('desk') || arch.includes('table')) {
    parts = buildTableOrDeskParts(
      w,
      d,
      h,
      chosenHex,
      woodMat,
      arch.includes('coffee'),
      arch.includes('desk')
    );
  } else if (arch.includes('kallax') || arch.includes('shelf') || arch.includes('shelving')) {
    parts = buildShelvingOrWardrobeParts(w, d, h, chosenHex, woodMat, 'kallax');
  } else if (arch.includes('bookcase') || arch.includes('billy')) {
    parts = buildShelvingOrWardrobeParts(w, d, h, chosenHex, woodMat, 'bookcase');
  } else if (arch.includes('chest')) {
    parts = buildShelvingOrWardrobeParts(w, d, h, chosenHex, woodMat, 'chest');
  } else if (arch.includes('wardrobe') || arch.includes('pax')) {
    parts = buildShelvingOrWardrobeParts(w, d, h, chosenHex, woodMat, 'wardrobe');
  } else if (arch.includes('tv') || arch.includes('besta')) {
    parts = buildShelvingOrWardrobeParts(w, d, h, chosenHex, woodMat, 'tv_unit');
  } else if (arch.includes('lamp') || arch.includes('pendant')) {
    parts = buildLightingParts(w, h, chosenHex, arch.includes('floor'), arch.includes('globe'));
  } else if (arch.includes('rug') || arch.includes('mirror') || arch.includes('decor')) {
    parts = buildRugOrMirrorParts(w, d, h, chosenHex, arch.includes('mirror') || arch.includes('decor'));
  } else if (arch.includes('chair') || arch.includes('stool')) {
    parts = buildDiningChairParts(w, d, h, chosenHex, woodMat);
  } else if (product.category === 'Sofas & Armchairs') {
    parts = buildSofaParts(w, d, h, chosenHex, fabricMat, false, false);
  } else if (product.category === 'Beds & Mattresses') {
    parts = buildBedParts(w, d, h, chosenHex, woodMat);
  } else if (product.category === 'Lighting') {
    parts = buildLightingParts(w, h, chosenHex, h > 1.0, h <= 0.35);
  } else if (product.category === 'Rugs & Decor') {
    parts = buildRugOrMirrorParts(w, d, h, chosenHex, d < 0.25 && h > 0.4);
  } else {
    parts = buildShelvingOrWardrobeParts(w, d, h, chosenHex, woodMat, 'bookcase');
  }

  let padIdx = 0;
  while (parts.length < 20) {
    const px = -w * 0.35 + (padIdx % 4) * (w * 0.22);
    const pz = padIdx < 4 ? -d * 0.35 : d * 0.35;
    parts.push(
      p(`detail_cleat_${padIdx}`, 'cylinder', [px, 0.015, pz], [0.025, 0.015, 0.025], '#9E9B95', 'matte_black_metal', 0.5, 0.6)
    );
    padIdx++;
  }
  if (parts.length > 40) {
    parts = parts.slice(0, 40);
  }

  return {
    overallDimensionsMeters: {
      width: w,
      height: h,
      depth: d,
    },
    parts,
    source: 'parametric_builder',
  };
}

/**
 * Automatically furnish a room based on its architectural type and dimensions,
 * placing authentic IKEA furniture pieces with 20-40 part 3D specs clamped within boundaries.
 */
export function autoFurnishRoom(
  room: ApartmentRoom,
  catalog: IkeaProduct[] = INITIAL_IKEA_CATALOG
): PlacedFurnitureItem[] {
  const findItem = (id: string, fallbackCat: IkeaCategory): IkeaProduct => {
    const direct = catalog.find((p) => p.id === id);
    if (direct) return direct;
    const byCat = catalog.find((p) => p.category === fallbackCat);
    if (byCat) return byCat;
    return catalog[0];
  };

  interface PresetItemDef {
    id: string;
    category: IkeaCategory;
    localPos: [number, number, number];
    rotationY: number;
  }

  let defs: PresetItemDef[] = [];
  const rt = room.roomType;
  const w = room.width;
  const l = room.length;

  if (rt === 'Living Room') {
    defs = [
      { id: 'ikea-kivik-3', category: 'Sofas & Armchairs', localPos: [0, 0, -l * 0.28], rotationY: 0 },
      { id: 'ikea-lack-coffee', category: 'Tables & Desks', localPos: [0, 0, 0], rotationY: 0 },
      { id: 'ikea-stoense-rug', category: 'Rugs & Decor', localPos: [0, 0, 0.05], rotationY: 0 },
      { id: 'ikea-strandmon', category: 'Sofas & Armchairs', localPos: [-w * 0.32, 0, 0], rotationY: 90 },
      { id: 'ikea-besta-tv', category: 'Storage & Shelving', localPos: [0, 0, l * 0.36], rotationY: 180 },
      { id: 'ikea-hektar-lamp', category: 'Lighting', localPos: [w * 0.36, 0, -l * 0.3], rotationY: 225 },
      { id: 'ikea-fejka-plant', category: 'Rugs & Decor', localPos: [-w * 0.36, 0, l * 0.34], rotationY: 0 },
    ];
  } else if (rt === 'Bedroom') {
    defs = [
      { id: 'ikea-malm-bed', category: 'Beds & Mattresses', localPos: [0, 0, -l * 0.24], rotationY: 0 },
      { id: 'ikea-malm-chest-6', category: 'Storage & Shelving', localPos: [-w * 0.34, 0, -l * 0.24], rotationY: 90 },
      { id: 'ikea-pax-wardrobe', category: 'Storage & Shelving', localPos: [w * 0.34, 0, 0], rotationY: 270 },
      { id: 'ikea-lohals-rug', category: 'Rugs & Decor', localPos: [0, 0, 0.28], rotationY: 0 },
      { id: 'ikea-nissedal-mirror', category: 'Rugs & Decor', localPos: [0, 0, l * 0.38], rotationY: 180 },
      { id: 'ikea-arstid-lamp', category: 'Lighting', localPos: [-w * 0.34, 0, 0.3], rotationY: 0 },
    ];
  } else if (rt === 'Kitchen') {
    defs = [
      { id: 'ikea-ekedalen-table', category: 'Tables & Desks', localPos: [0, 0, 0], rotationY: 0 },
      { id: 'ikea-odger-chair', category: 'Kitchen & Dining', localPos: [-0.55, 0, -0.65], rotationY: 0 },
      { id: 'ikea-odger-chair', category: 'Kitchen & Dining', localPos: [0.55, 0, -0.65], rotationY: 0 },
      { id: 'ikea-odger-chair', category: 'Kitchen & Dining', localPos: [-0.55, 0, 0.65], rotationY: 180 },
      { id: 'ikea-odger-chair', category: 'Kitchen & Dining', localPos: [0.55, 0, 0.65], rotationY: 180 },
      { id: 'ikea-tornviken-island', category: 'Kitchen & Dining', localPos: [w * 0.35, 0, 0], rotationY: 90 },
      { id: 'ikea-raskog-trolley', category: 'Kitchen & Dining', localPos: [-w * 0.35, 0, 0], rotationY: 270 },
    ];
  } else if (rt === 'Dining Room') {
    defs = [
      { id: 'ikea-ekedalen-table', category: 'Tables & Desks', localPos: [0, 0, 0], rotationY: 0 },
      { id: 'ikea-odger-chair', category: 'Kitchen & Dining', localPos: [-0.6, 0, -0.65], rotationY: 0 },
      { id: 'ikea-odger-chair', category: 'Kitchen & Dining', localPos: [0.6, 0, -0.65], rotationY: 0 },
      { id: 'ikea-odger-chair', category: 'Kitchen & Dining', localPos: [-0.6, 0, 0.65], rotationY: 180 },
      { id: 'ikea-odger-chair', category: 'Kitchen & Dining', localPos: [0.6, 0, 0.65], rotationY: 180 },
      { id: 'ikea-stoense-rug', category: 'Rugs & Decor', localPos: [0, 0, 0], rotationY: 0 },
      { id: 'ikea-hemnes-chest-8', category: 'Storage & Shelving', localPos: [w * 0.35, 0, 0], rotationY: 270 },
      { id: 'ikea-arstid-lamp', category: 'Lighting', localPos: [w * 0.35, 0, 0.4], rotationY: 0 },
    ];
  } else if (rt === 'Office' || rt === 'Home Office') {
    defs = [
      { id: 'ikea-bekant-desk', category: 'Tables & Desks', localPos: [0, 0, -l * 0.25], rotationY: 0 },
      { id: 'ikea-odger-chair', category: 'Kitchen & Dining', localPos: [0, 0, -l * 0.25 + 0.65], rotationY: 180 },
      { id: 'ikea-kallax-4x4', category: 'Storage & Shelving', localPos: [-w * 0.34, 0, 0], rotationY: 90 },
      { id: 'ikea-billy-bookcase', category: 'Storage & Shelving', localPos: [w * 0.34, 0, 0], rotationY: 270 },
      { id: 'ikea-tertial-lamp', category: 'Lighting', localPos: [-0.55, 0, -l * 0.25], rotationY: 0 },
      { id: 'ikea-stoense-rug', category: 'Rugs & Decor', localPos: [0, 0, 0.3], rotationY: 0 },
    ];
  } else if (rt === 'Bathroom') {
    defs = [
      { id: 'ikea-enhet-cabinet', category: 'Kitchen & Dining', localPos: [0, 0, -l * 0.34], rotationY: 0 },
      { id: 'ikea-stockholm-mirror', category: 'Rugs & Decor', localPos: [0, 0, -l * 0.42], rotationY: 0 },
      { id: 'ikea-raskog-trolley', category: 'Kitchen & Dining', localPos: [w * 0.32, 0, 0], rotationY: 90 },
      { id: 'ikea-fejka-plant', category: 'Rugs & Decor', localPos: [-w * 0.32, 0, 0], rotationY: 0 },
    ];
  } else {
    defs = [
      { id: 'ikea-besta-tv', category: 'Storage & Shelving', localPos: [0, 0, -l * 0.34], rotationY: 0 },
      { id: 'ikea-pax-wardrobe', category: 'Storage & Shelving', localPos: [w * 0.32, 0, 0], rotationY: 90 },
      { id: 'ikea-nissedal-mirror', category: 'Rugs & Decor', localPos: [0, 0, -l * 0.42], rotationY: 0 },
      { id: 'ikea-lohals-rug', category: 'Rugs & Decor', localPos: [0, 0, 0], rotationY: 90 },
    ];
  }

  return defs.map((def, idx) => {
    const prod = findItem(def.id, def.category);
    const swatch = prod.swatches?.[0] || { name: 'Standard', hex: '#C8A27A' };

    const snapped = snapFurnitureToRoom(
      def.localPos,
      def.rotationY,
      prod.dimensionsCm,
      {
        width: room.width,
        length: room.length,
        enableGridSnap: true,
        enableWallSnap: true,
      }
    );

    const worldPos: [number, number, number] = [
      Number((room.position[0] + snapped.position[0]).toFixed(2)),
      snapped.position[1],
      Number((room.position[1] + snapped.position[2]).toFixed(2)),
    ];

    const spec3D = buildParametric3DSpec(prod, swatch.hex, swatch.name);

    return {
      instanceId: `auto-${room.id}-${prod.id.replace('ikea-', '')}-${idx + 1}`,
      productId: prod.id,
      product: prod,
      swatchName: swatch.name,
      swatchHex: swatch.hex,
      position: worldPos,
      rotationY: snapped.rotationY,
      spec3D,
      roomId: room.id,
    };
  });
}

/**
 * Select the optimal ceiling chandelier fixture for an architectural room type.
 */
export function autoSelectChandelier(
  room: ApartmentRoom,
  chandelierCatalog: ChandelierCatalogItem[] = CHANDELIER_CATALOG
): PlacedChandelier {
  let targetId = 'multi_ring_led';
  const rt = room.roomType;
  if (rt === 'Bedroom') targetId = 'woven_pendant';
  else if (rt === 'Kitchen') targetId = 'glass_globe_cluster';
  else if (rt === 'Dining Room') targetId = 'multi_ring_led';
  else if (rt === 'Bathroom' || rt === 'Hallway') targetId = 'recessed_spotlights';
  else if (rt === 'Office' || rt === 'Home Office') targetId = 'geodesic_chandelier';

  const item = chandelierCatalog.find((c) => c.id === targetId) || chandelierCatalog[0];

  return {
    instanceId: `ch-${room.id}-${Date.now().toString().slice(-4)}`,
    presetId: item.id,
    catalogItem: item,
    roomId: room.id,
    position: [room.position[0], room.height, room.position[1]],
    dropCableHeight: item.defaultDropMeters,
    scale: 1.0,
    isOn: true,
    brightness: 90,
    colorTempK: item.defaultColorTempK,
  };
}
