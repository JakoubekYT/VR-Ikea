import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { INITIAL_IKEA_CATALOG } from '../data/ikeaCatalog.js';
import {
  buildParametric3DSpec,
  generateSixMatchingIkeaProducts,
  parseIkeaUrl,
} from '../utils/roomLogic.js';
import type { Furniture3DSpec, IkeaCategory, IkeaProduct } from '../types/ikea.js';

let billingDisabledCached = false;
let billingDisabledCheckedAt = 0;
const BILLING_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (billingDisabledCached && Date.now() - billingDisabledCheckedAt < BILLING_COOLDOWN_MS) {
    return null;
  }
  // Vertex AI Express Mode API keys ("AQ....") require vertexai: true in @google/genai
  if (apiKey.startsWith('AQ.')) {
    return new GoogleGenAI({ vertexai: true, apiKey });
  }
  return new GoogleGenAI({ apiKey });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Reliable Free-Tier Fallback helper:
 * Calls gemini-2.5-flash first, and falls back through gemini-3-flash-preview and gemini-3.1-flash-lite-preview.
 */
async function callGeminiWithFallback(
  ai: GoogleGenAI,
  contents: unknown,
  responseSchema: Schema,
  systemInstruction: string,
  timeoutMs = 7500
): Promise<string> {
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
  ];
  let lastErr: unknown = null;

  for (const model of models) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: contents as string,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
          },
        }),
        timeoutMs
      );
      if (response.text) {
        return response.text;
      }
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[gemini:${model}] failed:`, msg);
      if (
        msg.includes('BILLING_DISABLED') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('requires billing to be enabled')
      ) {
        billingDisabledCached = true;
        billingDisabledCheckedAt = Date.now();
        console.warn('[gemini] Detected fatal billing/auth issue. Fast-failing immediately to offline CAD engine.');
        break;
      }
    }
  }
  throw lastErr || new Error('All Gemini fallback models failed');
}

const IKEA_PRODUCT_ARRAY_SCHEMA: Schema = {
  type: Type.ARRAY,
  description: 'List of 6 matching authentic IKEA products with real dimensions and prices.',
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      name: { type: Type.STRING, description: 'IKEA series name in uppercase, e.g. KIVIK, VIMLE, MALM, PAX' },
      typeName: { type: Type.STRING, description: 'Bilingual Czech / English product description' },
      category: {
        type: Type.STRING,
        description:
          'One of: Sofas & Armchairs, Beds & Mattresses, Storage & Shelving, Tables & Desks, Lighting, Rugs & Decor, Kitchen & Dining',
      },
      articleNumber: { type: Type.STRING, description: 'Authentic IKEA article number like 494.405.98' },
      priceCzk: { type: Type.NUMBER, description: 'Price in CZK' },
      priceEur: { type: Type.NUMBER, description: 'Price in EUR' },
      dimensionsCm: {
        type: Type.OBJECT,
        properties: {
          width: { type: Type.NUMBER },
          depth: { type: Type.NUMBER },
          height: { type: Type.NUMBER },
        },
        required: ['width', 'depth', 'height'],
      },
      materialDescription: { type: Type.STRING },
      archetype: {
        type: Type.STRING,
        description:
          'One of: sofa, armchair, bed, shelving, bookcase, chest, wardrobe, tv_unit, dining_table, coffee_table, desk, floor_lamp, table_lamp, rug, dining_chair',
      },
      swatches: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            hex: { type: Type.STRING },
          },
          required: ['name', 'hex'],
        },
      },
    },
    required: [
      'id',
      'name',
      'typeName',
      'category',
      'articleNumber',
      'priceCzk',
      'priceEur',
      'dimensionsCm',
      'materialDescription',
      'archetype',
      'swatches',
    ],
  },
};

const FURNITURE_3D_SPEC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    overallDimensionsMeters: {
      type: Type.OBJECT,
      properties: {
        width: { type: Type.NUMBER },
        height: { type: Type.NUMBER },
        depth: { type: Type.NUMBER },
      },
      required: ['width', 'height', 'depth'],
    },
    parts: {
      type: Type.ARRAY,
      description: '20 to 40 sub-meshes composing the 3D CAD assembly of the IKEA furniture piece.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          shape: {
            type: Type.STRING,
            description: 'rounded_box | cylinder | sphere | torus | cone',
          },
          position: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: '[x, y, z] in meters where y=0 is the floor plane',
          },
          size: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: '[width, height, depth] in meters',
          },
          rotation: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: '[rx, ry, rz] Euler rotation in radians',
          },
          colorHex: { type: Type.STRING },
          materialType: {
            type: Type.STRING,
            description:
              'oak_wood | walnut_wood | white_laminate | boucle_fabric | velvet | leather | brushed_brass | matte_black_metal | chrome | clear_glass | emissive_lamp',
          },
          roughness: { type: Type.NUMBER },
          metalness: { type: Type.NUMBER },
        },
        required: [
          'name',
          'shape',
          'position',
          'size',
          'rotation',
          'colorHex',
          'materialType',
          'roughness',
          'metalness',
        ],
      },
    },
  },
  required: ['overallDimensionsMeters', 'parts'],
};

function detectIkeaArchetypeAndCategory(text: string): {
  archetype: string;
  category: Exclude<IkeaCategory, 'All'>;
} {
  const t = text.toLowerCase();

  // 1. Office chairs & ergonomic seating (must precede general chairs/desks)
  if (
    t.includes('kancelarsk') ||
    t.includes('kancelářsk') ||
    t.includes('office chair') ||
    t.includes('swivel chair') ||
    t.includes('desk chair') ||
    t.includes('herní židle') ||
    t.includes('herni zidle') ||
    t.includes('gaming chair') ||
    t.includes('pracovní židle') ||
    t.includes('pracovni zidle') ||
    t.includes('otočná židle') ||
    t.includes('otocna zidle') ||
    t.includes('markus') ||
    t.includes('jarvfallet') ||
    t.includes('järvfjället') ||
    t.includes('matchspel') ||
    t.includes('flintan') ||
    t.includes('alefjall') ||
    t.includes('alefjäll') ||
    t.includes('langfjall') ||
    t.includes('långfjäll') ||
    t.includes('styrspel') ||
    t.includes('hattefjall') ||
    t.includes('hattefjäll')
  ) {
    return { archetype: 'office_chair', category: 'Tables & Desks' };
  }

  // 2. Mirrors & wall mirrors (category: Rugs & Decor) - check before bathroom vanities
  if (
    t.includes('lettan') ||
    t.includes('lindbyn') ||
    t.includes('storjorm') ||
    t.includes('nissedal') ||
    t.includes('mirror') ||
    t.includes('zrcadl')
  ) {
    return { archetype: 'mirror', category: 'Rugs & Decor' };
  }

  // 3. Bathroom vanities & wash-stands (category: Storage & Shelving)
  if (
    t.includes('godmorgon') ||
    t.includes('angsjon') ||
    t.includes('ängsjön') ||
    t.includes('havback') ||
    t.includes('havbäck') ||
    t.includes('vanity') ||
    t.includes('wash-stand') ||
    t.includes('washstand') ||
    t.includes('wash stand') ||
    t.includes('umyvadl') ||
    t.includes('sink cabinet') ||
    t.includes('skrinka s umyvadlem') ||
    t.includes('skříňka s umyvadlem') ||
    t.includes('koupelnova skrinka') ||
    t.includes('koupelnová skříňka') ||
    (t.includes('enhet') && (t.includes('umyvadl') || t.includes('koupeln'))) ||
    (t.includes('koupeln') && (t.includes('skříň') || t.includes('skrin') || t.includes('skrink') || t.includes('stolek')))
  ) {
    return { archetype: 'vanity_chest', category: 'Storage & Shelving' };
  }

  // 4. Kitchen organizers & accessories (category: Kitchen & Dining)
  if (
    t.includes('hultarp') ||
    t.includes('aptitlig') ||
    t.includes('variera') ||
    t.includes('kungsfors') ||
    t.includes('kuchyn') ||
    t.includes('kuchyň') ||
    t.includes('kitchen rail') ||
    t.includes('cutting board') ||
    t.includes('prkenk') ||
    t.includes('prkénk') ||
    t.includes('pribornik') ||
    t.includes('příborník')
  ) {
    return { archetype: 'kitchen_accessory', category: 'Kitchen & Dining' };
  }

  // 5. Armchairs & single lounge seating
  if (t.includes('ušák') || t.includes('usak') || t.includes('strandmon') || t.includes('křeslo') || t.includes('kreslo') || t.includes('armchair')) {
    return { archetype: 'wing_chair', category: 'Sofas & Armchairs' };
  }
  if (t.includes('poäng') || t.includes('poang')) {
    return { archetype: 'poang_chair', category: 'Sofas & Armchairs' };
  }

  // 6. Corner sofas & chaises
  if (
    t.includes('rohová') ||
    t.includes('rohova') ||
    t.includes('rohový') ||
    t.includes('rohovy') ||
    t.includes('corner') ||
    t.includes('lenošk') ||
    t.includes('lenosk') ||
    t.includes('chaise')
  ) {
    return { archetype: 'corner_sofa', category: 'Sofas & Armchairs' };
  }

  // 7. Standard 3-seat sofas
  if (
    t.includes('pohovka') ||
    t.includes('sofa') ||
    t.includes('sedací souprava') ||
    t.includes('sedaci souprava') ||
    t.includes('kivik') ||
    t.includes('vimle') ||
    t.includes('söderhamn') ||
    t.includes('soderhamn') ||
    t.includes('friheten') ||
    t.includes('ektorp') ||
    t.includes('landskrona') ||
    t.includes('parup') ||
    t.includes('pärup') ||
    t.includes('linanas') ||
    t.includes('linanäs')
  ) {
    return { archetype: 'sofa_3seat', category: 'Sofas & Armchairs' };
  }

  // 8. Storage & Shelving
  if (t.includes('knihovna') || t.includes('bookcase') || t.includes('billy')) {
    return { archetype: 'billy_bookcase', category: 'Storage & Shelving' };
  }
  if (t.includes('kallax') || t.includes('regál') || t.includes('regal') || t.includes('policov')) {
    return { archetype: 'kallax_unit', category: 'Storage & Shelving' };
  }
  if (t.includes('skříň') || t.includes('skrin') || t.includes('šatní') || t.includes('satni') || t.includes('pax') || t.includes('wardrobe')) {
    return { archetype: 'pax_wardrobe', category: 'Storage & Shelving' };
  }

  // 9. Desks & work tables
  if (
    t.includes('psací') ||
    t.includes('psaci') ||
    t.includes('desk') ||
    t.includes('micke') ||
    t.includes('bekant') ||
    t.includes('trotten') ||
    t.includes('mittzon') ||
    t.includes('pracovní') ||
    t.includes('pracovni')
  ) {
    return { archetype: 'drawer_desk', category: 'Tables & Desks' };
  }

  // 10. Coffee & side tables
  if (
    t.includes('konferenční') ||
    t.includes('konferencni') ||
    t.includes('coffee') ||
    t.includes('lack') ||
    t.includes('odkládací') ||
    t.includes('odkladaci') ||
    t.includes('stockholm')
  ) {
    return { archetype: 'coffee_table', category: 'Tables & Desks' };
  }

  // 11. Dining tables
  if (
    t.includes('jídelní stůl') ||
    t.includes('jidelni stul') ||
    t.includes('stůl') ||
    t.includes('stul') ||
    t.includes('table') ||
    t.includes('lisabo') ||
    t.includes('ekedalen') ||
    t.includes('ingatorp')
  ) {
    return { archetype: 'dining_table', category: 'Tables & Desks' };
  }

  // 12. Beds & mattresses
  if (
    t.includes('postel') ||
    t.includes('bed') ||
    t.includes('lůžko') ||
    t.includes('luzko') ||
    t.includes('malm') ||
    t.includes('hemnes') ||
    t.includes('matrace')
  ) {
    return { archetype: 'bed_frame', category: 'Beds & Mattresses' };
  }

  // 13. Dining chairs
  if (t.includes('židle') || t.includes('zidle') || t.includes('chair')) {
    return { archetype: 'dining_chair', category: 'Tables & Desks' };
  }

  // 14. Lighting
  if (
    t.includes('lampa') ||
    t.includes('svítidlo') ||
    t.includes('svitidlo') ||
    t.includes('lamp') ||
    t.includes('osvětlení') ||
    t.includes('osvetleni') ||
    t.includes('lustr')
  ) {
    return { archetype: 'floor_lamp', category: 'Lighting' };
  }

  // 15. Rugs
  if (t.includes('koberec') || t.includes('rug') || t.includes('běhoun') || t.includes('behoun')) {
    return { archetype: 'rug', category: 'Rugs & Decor' };
  }

  return { archetype: 'sofa_3seat', category: 'Sofas & Armchairs' };
}

function parseIkeaDimensions(
  text: string,
  archetype: string
): { width: number; depth: number; height: number } {
  // 1. Triple dimension: e.g. 80x28x202 cm or 228 × 95 × 83 cm
  const triple = text.match(/(\d{2,3})\s*[x×]\s*(\d{2,3})\s*[x×]\s*(\d{2,3})\s*cm/i);
  if (triple) {
    return {
      width: parseInt(triple[1], 10),
      depth: parseInt(triple[2], 10),
      height: parseInt(triple[3], 10),
    };
  }
  // 2. Double dimension: e.g. 160x200 cm (bed) or 140x78 cm (table)
  const double = text.match(/(\d{2,3})\s*[x×]\s*(\d{2,3})\s*cm/i);
  if (double) {
    const d1 = parseInt(double[1], 10);
    const d2 = parseInt(double[2], 10);
    if (archetype === 'bed_frame') {
      return { width: Math.min(d1, d2) + 16, depth: Math.max(d1, d2) + 9, height: 100 };
    }
    if (archetype === 'dining_table') {
      return { width: Math.max(d1, d2), depth: Math.min(d1, d2), height: 75 };
    }
    if (archetype === 'coffee_table') {
      return { width: Math.max(d1, d2), depth: Math.min(d1, d2), height: 45 };
    }
    if (archetype === 'mirror') {
      return { width: Math.min(d1, d2), depth: 4, height: Math.max(d1, d2) };
    }
    if (archetype === 'rug') {
      return { width: Math.min(d1, d2), depth: Math.max(d1, d2), height: 2 };
    }
  }
  // 3. Fallback standard archetype dimensions
  if (archetype === 'wing_chair') return { width: 82, depth: 96, height: 101 };
  if (archetype === 'poang_chair') return { width: 68, depth: 82, height: 100 };
  if (archetype === 'office_chair') return { width: 66, depth: 66, height: 128 };
  if (archetype === 'vanity_chest') return { width: 80, depth: 48, height: 75 };
  if (archetype === 'mirror') return { width: 60, depth: 4, height: 85 };
  if (archetype === 'kitchen_accessory') return { width: 50, depth: 15, height: 10 };
  if (archetype === 'billy_bookcase') return { width: 80, depth: 28, height: 202 };
  if (archetype === 'kallax_unit') return { width: 147, depth: 39, height: 147 };
  if (archetype === 'pax_wardrobe') return { width: 150, depth: 66, height: 236 };
  if (archetype === 'sofa_3seat') return { width: 228, depth: 95, height: 83 };
  if (archetype === 'corner_sofa') return { width: 252, depth: 164, height: 83 };
  if (archetype === 'drawer_desk') return { width: 105, depth: 50, height: 75 };
  if (archetype === 'sit_stand_desk') return { width: 160, depth: 80, height: 75 };
  if (archetype === 'dining_table') return { width: 140, depth: 78, height: 75 };
  if (archetype === 'coffee_table') return { width: 118, depth: 78, height: 45 };
  if (archetype === 'bed_frame') return { width: 176, depth: 209, height: 100 };
  if (archetype === 'dining_chair') return { width: 51, depth: 58, height: 97 };
  if (archetype === 'floor_lamp') return { width: 45, depth: 45, height: 150 };
  if (archetype === 'rug') return { width: 200, depth: 300, height: 2 };
  return { width: 120, depth: 60, height: 80 };
}

function parseIkeaSwatches(text: string): Array<{ name: string; hex: string }> {
  const t = text.toLowerCase();
  if (t.includes('bílá') || t.includes('white')) {
    return [
      { name: 'Classic White / Bílá', hex: '#F5F5F3' },
      { name: 'White Stained Oak / Bělený dub', hex: '#D6BC96' },
      { name: 'Anthracite / Antracit', hex: '#383B3E' },
    ];
  }
  if (t.includes('černá') || t.includes('černohnědá') || t.includes('black')) {
    return [
      { name: 'Black-Brown / Černohnědá', hex: '#292524' },
      { name: 'Matte Black / Matná černá', hex: '#1C1917' },
      { name: 'Warm Oak / Dub', hex: '#C8A27A' },
    ];
  }
  if (t.includes('dub') || t.includes('oak')) {
    return [
      { name: 'Natural Oak / Přírodní dub', hex: '#C8A27A' },
      { name: 'Smoked Walnut / Ořech', hex: '#6E4F3A' },
      { name: 'Crisp White / Bílá', hex: '#F5F5F3' },
    ];
  }
  if (t.includes('jasan') || t.includes('ash')) {
    return [
      { name: 'Ash Veneer / Jasan', hex: '#DFC6A2' },
      { name: 'Black Stained Ash / Černý jasan', hex: '#2E2D2C' },
      { name: 'Clean White / Bílá', hex: '#F5F5F3' },
    ];
  }
  if (t.includes('šedá') || t.includes('grey') || t.includes('gray')) {
    return [
      { name: 'Nordvalla Grey / Šedá', hex: '#484B4E' },
      { name: 'Light Beige / Béžová', hex: '#D8CFC2' },
      { name: 'Dark Green / Tmavě zelená', hex: '#2F483A' },
    ];
  }
  if (t.includes('béžová') || t.includes('beige')) {
    return [
      { name: 'Tibbleby Beige / Béžová', hex: '#D8CFC2' },
      { name: 'Medium Grey / Šedá', hex: '#63666A' },
      { name: 'Golden Yellow / Žlutá', hex: '#E3B227' },
    ];
  }
  if (t.includes('zelená') || t.includes('green') || t.includes('sage')) {
    return [
      { name: 'Sage Green / Šalvějová', hex: '#2F483A' },
      { name: 'Warm Beige / Béžová', hex: '#D8CFC2' },
      { name: 'Anthracite / Antracit', hex: '#383B3E' },
    ];
  }
  if (t.includes('žlutá') || t.includes('yellow')) {
    return [
      { name: 'Skiftebo Yellow / Žlutá', hex: '#E3B227' },
      { name: 'Nordvalla Grey / Šedá', hex: '#484B4E' },
      { name: 'Dark Green Velvet / Zelený samet', hex: '#244235' },
    ];
  }
  return [
    { name: 'Original IKEA Swatch', hex: '#CFC5B4' },
    { name: 'Nordic Oak / Dub', hex: '#C8A27A' },
    { name: 'Matte Anthracite / Černá', hex: '#2B2B2D' },
  ];
}

function parseIkeaPageContent(url: string, html: string): IkeaProduct {
  const parsedUrl = parseIkeaUrl(url);
  const cleanSlugName = parsedUrl.extractedName || '';
  const slugWords = cleanSlugName.split(/\s+/).filter(Boolean);
  const slugSeries = slugWords[0] ? slugWords[0].toUpperCase() : 'IKEA';
  const slugTypeDesc = slugWords.slice(1).join(' ');
  const fallbackArticleNumber = parsedUrl.extractedArticleNumber || '805.123.45';

  const ogTitle =
    (html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i) || [])[1] || '';
  const ogImage =
    (html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) || [])[1] || '';
  const ogDesc =
    (html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i) || [])[1] || '';

  // Validate ogTitle: reject marketing banners like "Stovky výrobků..." or generic landing pages
  const isMarketingTitle =
    /stovky|vyrobk|nabytk|nabytek|vyprodej|sleva|akce|inspirace|produkty|products|kategorie|vitejte/i.test(ogTitle) &&
    !new RegExp(`\\b${slugSeries}\\b`, 'i').test(ogTitle);

  const cleanTitle = (ogTitle && !isMarketingTitle ? ogTitle : cleanSlugName)
    .replace(/\s*-\s*IKEA.*$/i, '')
    .replace(/-/g, ' ')
    .trim();

  // Extract series name (first word from title or slug series)
  const seriesMatch = cleanTitle.match(/^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽÖÄÅØ]{3,})/i);
  let seriesName = seriesMatch ? seriesMatch[1].toUpperCase() : slugSeries;
  if (seriesName === 'STOVKY' || isMarketingTitle) {
    seriesName = slugSeries;
  }

  // Subtitle / type description
  let typeDesc = cleanTitle.replace(new RegExp(`^${seriesName}`, 'i'), '').trim().replace(/^[,\s-]+/, '');
  if (!typeDesc && slugTypeDesc) {
    typeDesc = slugTypeDesc;
  }

  // Article number from parseIkeaUrl (exact XXX.XXX.XX)
  const articleNumber = fallbackArticleNumber;
  const artDigits = articleNumber.replace(/\./g, '');

  // Catalog match check for realistic pricing and dimensions fallback
  let matchedCatalog = artDigits
    ? INITIAL_IKEA_CATALOG.find((p) => p.articleNumber.replace(/\./g, '') === artDigits)
    : undefined;
  if (!matchedCatalog && seriesName !== 'IKEA') {
    matchedCatalog = INITIAL_IKEA_CATALOG.find(
      (p) => p.name.toUpperCase() === seriesName || p.name.toUpperCase().startsWith(seriesName)
    );
  }

  const { archetype, category } = detectIkeaArchetypeAndCategory(
    `${cleanTitle} ${slugTypeDesc} ${url} ${ogDesc}`
  );

  const defaultPriceByArchetype: Record<string, number> = {
    corner_sofa: 19990,
    sofa_3seat: 12990,
    wing_chair: 5990,
    poang_chair: 3490,
    bed_frame: 8990,
    pax_wardrobe: 12990,
    billy_bookcase: 1990,
    kallax_unit: 2490,
    dining_table: 5990,
    coffee_table: 2990,
    drawer_desk: 4290,
    sit_stand_desk: 11990,
    office_chair: 4490,
    dining_chair: 1490,
    vanity_chest: 7990,
    mirror: 990,
    floor_lamp: 1490,
    rug: 2490,
    kitchen_accessory: 499,
  };

  // Price extraction
  const priceMatch =
    html.match(/"(?:price|pipPrice|salesPrice|priceNumerator)"\s*:\s*"?(\d+)"?/i) ||
    html.match(/(\d[\d\s]{1,6})\s*(?:Kč|\,-)/i);
  let priceCzk = matchedCatalog?.priceCzk || defaultPriceByArchetype[archetype] || 2990;
  if (priceMatch && !isMarketingTitle) {
    const parsedPrice = parseInt(priceMatch[1].replace(/\s/g, ''), 10);
    if (parsedPrice > 200) {
      priceCzk = parsedPrice;
    }
  }
  const priceEur = matchedCatalog?.priceEur || Math.round(priceCzk / 25);

  const dimensionsCm =
    matchedCatalog?.dimensionsCm ||
    parseIkeaDimensions(`${cleanTitle} ${ogDesc} ${html}`, matchedCatalog?.archetype || archetype);
  const swatches = matchedCatalog?.swatches || parseIkeaSwatches(`${cleanTitle} ${ogDesc}`);

  let materialDescription =
    matchedCatalog?.materialDescription ||
    'Authentic Scandinavian quality furniture constructed with sustainable materials.';
  if (ogDesc && ogDesc.length > 20 && !isMarketingTitle) {
    materialDescription = ogDesc.slice(0, 220).trim();
  }

  return {
    id: `ikea-${seriesName.toLowerCase()}-${artDigits}`,
    name: seriesName,
    typeName: typeDesc ? `${typeDesc} / ${seriesName}` : matchedCatalog?.typeName || `${seriesName} Scandinavian Furniture`,
    category: matchedCatalog?.category || category,
    articleNumber,
    priceCzk,
    priceEur,
    dimensionsCm,
    materialDescription,
    imageUrl: ogImage || matchedCatalog?.imageUrl || undefined,
    swatches,
    archetype: matchedCatalog?.archetype || archetype,
    sourceUrl: url,
  };
}

async function fetchIkeaLiveByUrl(url: string): Promise<IkeaProduct | null> {
  const parsed = parseIkeaUrl(url);
  const loc = parsed.extractedLocale || 'cz/cs';
  const query = parsed.extractedName?.toLowerCase() || '';
  if (!query) return null;

  try {
    const apiUrl = `https://sik.search.blue.cdtapps.com/${loc}/search-result-page?q=${encodeURIComponent(query)}&size=3&c=sr&v=20210322&types=PRODUCT`;
    const res = await withTimeout(
      fetch(apiUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      }),
      4000
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const items = data.searchResultPage?.products?.main?.items;
    if (!Array.isArray(items) || items.length === 0) return null;

    const raw = items[0];
    const p = raw?.product;
    if (!p || !p.name) return null;

    const seriesName = String(p.name).toUpperCase();
    const typeName = p.typeName ? `${p.typeName} / ${seriesName}` : `${seriesName} Scandinavian Furniture`;
    const artDigits = String(p.itemNoGlobal || p.itemNo || parsed.extractedArticleNumber?.replace(/\./g, '') || '80512345');
    const articleNumber =
      artDigits.length === 8
        ? `${artDigits.slice(0, 3)}.${artDigits.slice(3, 6)}.${artDigits.slice(6, 8)}`
        : parsed.extractedArticleNumber || '805.123.45';

    const priceCzk =
      typeof p.salesPrice?.numeral === 'number' && p.salesPrice.numeral > 50
        ? p.salesPrice.numeral
        : 2990;
    const priceEur = Math.round(priceCzk / 25);

    const fullText = `${seriesName} ${typeName} ${p.itemMeasureReferenceText || ''} ${p.mainImageAlt || ''} ${url}`;
    const { archetype, category } = detectIkeaArchetypeAndCategory(fullText);
    const dimensionsCm = parseIkeaDimensions(fullText, archetype);

    const swatches: Array<{ name: string; hex: string }> = [];
    if (Array.isArray(p.colors) && p.colors.length > 0) {
      for (const c of p.colors) {
        if (c.hex) {
          const hex = c.hex.startsWith('#') ? c.hex : `#${c.hex}`;
          swatches.push({ name: c.name || 'Barva', hex });
        }
      }
    }
    if (swatches.length === 0) {
      swatches.push(...parseIkeaSwatches(fullText));
    }

    const materialDescription =
      p.mainImageAlt ||
      p.validDesignText ||
      'Authentic Scandinavian quality furniture constructed with sustainable materials.';

    return {
      id: `ikea-${seriesName.toLowerCase()}-${artDigits}`,
      name: seriesName,
      typeName,
      category,
      articleNumber,
      priceCzk,
      priceEur,
      dimensionsCm,
      materialDescription,
      imageUrl: p.mainImageUrl || undefined,
      swatches,
      archetype,
      sourceUrl: url,
    };
  } catch (err) {
    console.warn('[scrape:live-api] failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function scrapeExternalIkeaProduct(url: string): Promise<{
  product: IkeaProduct;
  source: 'direct_ikea' | 'jina_ikea' | 'slug_ikea';
}> {
  // Strategy 0: Direct IKEA Live Search API (official CDN photos, exact prices, colors)
  try {
    const liveProd = await fetchIkeaLiveByUrl(url);
    if (liveProd && liveProd.name && liveProd.name !== 'IKEA') {
      return { product: liveProd, source: 'direct_ikea' };
    }
  } catch (err) {
    console.warn('[scrape:live-api] failed:', err instanceof Error ? err.message : String(err));
  }

  // Strategy 1: Direct fetch with desktop browser headers
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
        },
      }),
      4500
    );
    if (res.ok) {
      const html = await res.text();
      if (html.length > 1000 && (html.includes('og:title') || html.includes('pip-product'))) {
        const prod = parseIkeaPageContent(url, html);
        if (prod.name && prod.name !== 'IKEA') {
          return { product: prod, source: 'direct_ikea' };
        }
      }
    }
  } catch (err) {
    console.warn('[scrape:direct] failed:', err instanceof Error ? err.message : String(err));
  }

  // Strategy 2: Jina reader (handles SPA rendering & bypasses network blocks)
  try {
    const jinaRes = await withTimeout(
      fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: 'text/plain' },
      }),
      4500
    );
    if (jinaRes.ok) {
      const text = await jinaRes.text();
      if (
        text.length > 100 &&
        !text.includes('Final URL: https://www.ikea.com/cz/cs/cat/produkty-products/')
      ) {
        const prod = parseIkeaPageContent(url, text);
        return { product: prod, source: 'jina_ikea' };
      }
    }
  } catch (err) {
    console.warn('[scrape:jina] failed:', err instanceof Error ? err.message : String(err));
  }

  // Strategy 3: URL slug and article number parser
  const prod = parseIkeaPageContent(url, '');
  return { product: prod, source: 'slug_ikea' };
}

async function searchIkeaLiveApi(query: string, limit = 6): Promise<IkeaProduct[]> {
  try {
    const apiUrl = `https://sik.search.blue.cdtapps.com/cz/cs/search-result-page?q=${encodeURIComponent(query)}&size=${limit}&c=sr&v=20210322&types=PRODUCT`;
    const res = await withTimeout(
      fetch(apiUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      }),
      4000
    );
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const items = data.searchResultPage?.products?.main?.items;
    if (!Array.isArray(items) || items.length === 0) return [];

    return items.map((raw: any) => {
      const p = raw.product;
      const seriesName = String(p.name || 'IKEA').toUpperCase();
      const typeName = p.typeName ? `${p.typeName} / ${seriesName}` : `${seriesName} Scandinavian Furniture`;
      const artDigits = String(p.itemNoGlobal || p.itemNo || '80512345');
      const articleNumber =
        artDigits.length === 8
          ? `${artDigits.slice(0, 3)}.${artDigits.slice(3, 6)}.${artDigits.slice(6, 8)}`
          : '805.123.45';
      const priceCzk =
        typeof p.salesPrice?.numeral === 'number' && p.salesPrice.numeral > 50
          ? p.salesPrice.numeral
          : 2990;
      const priceEur = Math.round(priceCzk / 25);
      const fullText = `${seriesName} ${typeName} ${p.itemMeasureReferenceText || ''} ${p.mainImageAlt || ''}`;
      const { archetype, category } = detectIkeaArchetypeAndCategory(fullText);
      const dimensionsCm = parseIkeaDimensions(fullText, archetype);

      const swatches: Array<{ name: string; hex: string }> = [];
      if (Array.isArray(p.colors) && p.colors.length > 0) {
        for (const c of p.colors) {
          if (c.hex) {
            const hex = c.hex.startsWith('#') ? c.hex : `#${c.hex}`;
            swatches.push({ name: c.name || 'Barva', hex });
          }
        }
      }
      if (swatches.length === 0) {
        swatches.push(...parseIkeaSwatches(fullText));
      }

      return {
        id: `ikea-${seriesName.toLowerCase()}-${artDigits}`,
        name: seriesName,
        typeName,
        category,
        articleNumber,
        priceCzk,
        priceEur,
        dimensionsCm,
        materialDescription: p.mainImageAlt || 'Authentic Scandinavian furniture.',
        imageUrl: p.mainImageUrl || undefined,
        swatches,
        archetype,
        sourceUrl: p.pipUrl || undefined,
      };
    });
  } catch (err) {
    console.warn('[search:live-api] failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Search 6 matching IKEA products (Czech or English) with Gemini fallback.
 */
export async function searchIkeaProducts(rawQuery: unknown): Promise<{
  products: IkeaProduct[];
  source: 'gemini' | 'fallback';
}> {
  const query = String(rawQuery || '').trim();
  if (!query) {
    return { products: INITIAL_IKEA_CATALOG.slice(0, 6), source: 'fallback' };
  }

  const ai = getGeminiClient();
  if (ai) {
    try {
      const text = await callGeminiWithFallback(
        ai,
        `User searched the IKEA catalog (Czech or English query): "${query}".
Return 6 real, authentic IKEA products matching "${query}" with exact dimensions in cm (width, depth, height), realistic Czech Crown (CZK) and EUR prices, real IKEA series names (e.g. VIMLE, KIVIK, SÖDERHAMN, MALM, PAX, HEMNES, BEKANT, KALLAX, BILLY, POÄNG, STRANDMON, LISABO, EKEDALEN, INGATORP), authentic article numbers, and 3 color swatches each.`,
        IKEA_PRODUCT_ARRAY_SCHEMA,
        'You are an IKEA Czech Republic & European catalog specialist. Always return 6 authentic IKEA products with accurate real-world dimensions in cm and realistic CZK/EUR pricing.'
      );
      const parsed = JSON.parse(text) as IkeaProduct[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { products: parsed.slice(0, 6), source: 'gemini' };
      }
    } catch {
      // Fallback below
    }
  }

  // Live IKEA Search API fallback before static catalog
  const liveItems = await searchIkeaLiveApi(query, 6);
  if (liveItems.length > 0) {
    return { products: liveItems, source: 'fallback' };
  }

  return {
    products: generateSixMatchingIkeaProducts(query, INITIAL_IKEA_CATALOG),
    source: 'fallback',
  };
}

/**
 * Scrape an external IKEA product URL and extract product specs + 5 related items.
 */
export async function scrapeIkeaProductUrl(rawUrl: unknown): Promise<{
  products: IkeaProduct[];
  source: string;
  scrapedUrl?: string;
}> {
  const url = String(rawUrl || '').trim();
  if (!url) {
    return { products: INITIAL_IKEA_CATALOG.slice(0, 6), source: 'fallback' };
  }

  const scraped = await scrapeExternalIkeaProduct(url);
  const primaryProduct = scraped.product;

  // Find 5 complementary products from catalog (deduplicated by articleNumber and id)
  const complementary = INITIAL_IKEA_CATALOG.filter(
    (p) =>
      p.id !== primaryProduct.id &&
      p.articleNumber !== primaryProduct.articleNumber &&
      p.name.toUpperCase() !== primaryProduct.name.toUpperCase()
  );
  const sameCategory = complementary.filter((p) => p.category === primaryProduct.category);
  const otherCategories = complementary.filter((p) => p.category !== primaryProduct.category);
  const defaultFive = [...sameCategory, ...otherCategories].slice(0, 5);

  const ai = getGeminiClient();
  if (ai) {
    try {
      const text = await callGeminiWithFallback(
        ai,
        `User scraped this authentic IKEA product:
- Name: ${primaryProduct.name} (${primaryProduct.typeName})
- Category: ${primaryProduct.category}
- Dimensions: ${primaryProduct.dimensionsCm.width}x${primaryProduct.dimensionsCm.depth}x${primaryProduct.dimensionsCm.height} cm
- Price: ${primaryProduct.priceCzk} CZK
URL: ${url}

Return 5 other authentic, matching IKEA products that complement this item in an apartment room.`,
        IKEA_PRODUCT_ARRAY_SCHEMA,
        'You are an IKEA catalog specialist. Always return 5 authentic complementary IKEA products with realistic dimensions and pricing.',
        7500
      );
      const parsed = JSON.parse(text) as IkeaProduct[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          products: [primaryProduct, ...parsed.slice(0, 5)],
          source: `${scraped.source}+gemini`,
          scrapedUrl: url,
        };
      }
    } catch {
      // Fallback below
    }
  }

  return {
    products: [primaryProduct, ...defaultFive],
    source: scraped.source,
    scrapedUrl: url,
  };
}

/**
 * Reconstruct a 20-40 part 3D furniture spec from an uploaded/pasted photo.
 */
export async function reconstructImageTo3D(body: {
  imageBase64?: string;
  mimeType?: string;
  dimensionsCm?: { width: number; depth: number; height: number };
  nameHint?: string;
}): Promise<{
  product: IkeaProduct;
  spec3D: Furniture3DSpec;
  source: 'gemini' | 'fallback';
}> {
  const { imageBase64, mimeType = 'image/png', dimensionsCm, nameHint } = body || {};

  const dims = {
    width: Math.max(20, Number(dimensionsCm?.width) || 120),
    depth: Math.max(20, Number(dimensionsCm?.depth) || 60),
    height: Math.max(20, Number(dimensionsCm?.height) || 85),
  };

  const cleanBase64 = (imageBase64 || '').replace(/^data:[^;]+;base64,/, '');
  const ai = getGeminiClient();

  if (ai && cleanBase64.length > 64) {
    try {
      const multimodalSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          product: IKEA_PRODUCT_ARRAY_SCHEMA.items as Schema,
          spec3D: FURNITURE_3D_SPEC_SCHEMA,
        },
        required: ['product', 'spec3D'],
      };

      const text = await callGeminiWithFallback(
        ai,
        [
          {
            inlineData: {
              data: cleanBase64,
              mimeType,
            },
          },
          {
            text: `Analyze this furniture photo and convert it into an authentic IKEA catalog item AND a 24-to-36 sub-part 3D CAD assembly.
Target overall dimensions: width=${dims.width}cm (${(dims.width / 100).toFixed(2)}m), depth=${dims.depth}cm (${(dims.depth / 100).toFixed(2)}m), height=${dims.height}cm (${(dims.height / 100).toFixed(2)}m).
Name hint: "${nameHint || 'IKEA Custom Piece'}".
Decompose the visible furniture structure (legs, frame, cushions, shelves, handles, doors, tabletop, trim) into 20 to 40 accurate 3D primitives where y=0 is the floor.`,
          },
        ],
        multimodalSchema,
        'You are a Multimodal 3D CAD Furniture Reconstruction Architect. Convert furniture photos into accurate 20-40 part Three.js assemblies.',
        9000
      );

      const parsed = JSON.parse(text) as { product: IkeaProduct; spec3D: Furniture3DSpec };
      if (parsed?.product && parsed?.spec3D?.parts?.length >= 16) {
        parsed.product.dimensionsCm = dims;
        parsed.product.imageUrl = `data:${mimeType};base64,${cleanBase64}`;
        return { product: parsed.product, spec3D: parsed.spec3D, source: 'gemini' };
      }
    } catch {
      // Fallback below
    }
  }

  const fallbackProduct: IkeaProduct = {
    id: `ikea-photo-${Date.now().toString().slice(-5)}`,
    name: (nameHint || 'STOCKHOLM PHOTO').toUpperCase(),
    typeName: '3D Model Reconstructed from Image / 3D model z obrázku',
    category: (dims.width > 150 && dims.depth > 75
      ? 'Sofas & Armchairs'
      : dims.height > 140
      ? 'Storage & Shelving'
      : 'Tables & Desks') as Exclude<IkeaCategory, 'All'>,
    articleNumber: `805.${Math.floor(100 + Math.random() * 899)}.19`,
    priceCzk: 7490,
    priceEur: 299,
    dimensionsCm: dims,
    materialDescription: 'Reconstructed multi-part 3D CAD assembly matching uploaded reference image and dimensions.',
    swatches: [
      { name: 'Natural Oak / Dub', hex: '#C8A27A' },
      { name: 'Warm Beige / Béžová', hex: '#D8CFC2' },
      { name: 'Matte Black / Černá', hex: '#262628' },
    ],
    archetype: dims.width > 150 && dims.depth > 75 ? 'sofa' : dims.height > 140 ? 'shelving' : 'desk',
    imageUrl: cleanBase64 ? `data:${mimeType};base64,${cleanBase64}` : undefined,
  };

  const spec3D = buildParametric3DSpec(
    fallbackProduct,
    fallbackProduct.swatches[0].hex,
    fallbackProduct.swatches[0].name
  );
  return { product: fallbackProduct, spec3D, source: 'fallback' };
}

/**
 * Synthesize a 20-40 sub-part 3D CAD assembly specification for a catalog product and swatch.
 */
export async function synthesizeProduct3D(body: {
  product?: IkeaProduct;
  swatchHex?: string;
  swatchName?: string;
}): Promise<{ status: 200 | 400; payload: Record<string, unknown> }> {
  const { product, swatchHex, swatchName } = body || {};

  if (!product || !product.dimensionsCm) {
    return { status: 400, payload: { error: 'Missing product specification' } };
  }

  const ai = getGeminiClient();
  if (ai) {
    try {
      const W = Number((product.dimensionsCm.width / 100).toFixed(3));
      const H = Number((product.dimensionsCm.height / 100).toFixed(3));
      const D = Number((product.dimensionsCm.depth / 100).toFixed(3));

      const text = await callGeminiWithFallback(
        ai,
        `Construct a detailed 20-to-35 sub-part Three.js 3D CAD assembly for this IKEA product:
- Name: ${product.name} (${product.typeName})
- Category: ${product.category}
- Overall Dimensions in Meters: width=${W}m, height=${H}m, depth=${D}m
- Selected Color Swatch: ${swatchName} (${swatchHex})
- Materials: ${product.materialDescription}

Rules:
1. Return between 20 and 35 sub-parts in the "parts" array.
2. Floor is at y = 0. Every part's position [x, y, z] is the center of that part in meters.
3. Allowed shapes: "rounded_box", "cylinder", "sphere", "torus", "cone".
4. Allowed materialType: "oak_wood", "walnut_wood", "white_laminate", "boucle_fabric", "velvet", "leather", "brushed_brass", "matte_black_metal", "chrome", "clear_glass", "emissive_lamp".`,
        FURNITURE_3D_SPEC_SCHEMA,
        'You are a Scandinavian CAD & Three.js furniture constructor. Decompose IKEA furniture into 20 to 35 accurate geometric sub-meshes.',
        7500
      );

      const parsed = JSON.parse(text) as Furniture3DSpec;
      if (parsed && Array.isArray(parsed.parts) && parsed.parts.length >= 20) {
        return { status: 200, payload: { spec: parsed, source: 'gemini' } };
      }
    } catch {
      // Fallback below
    }
  }

  const fallbackSpec = buildParametric3DSpec(
    product,
    swatchHex || product.swatches?.[0]?.hex || '#C8A27A',
    swatchName || product.swatches?.[0]?.name || 'Default'
  );
  return { status: 200, payload: { spec: fallbackSpec, source: 'parametric' } };
}

/**
 * Shared Web API POST wrapper for Vercel Functions (`api/ikea/*`).
 */
export async function handleVercelPost<TBody = Record<string, unknown>>(
  request: Request,
  handler: (body: TBody) => Promise<{ status?: number; payload: unknown }>
): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as TBody;
    const { status = 200, payload } = await handler(body);
    return Response.json(payload, { status });
  } catch (error) {
    console.error('Vercel API route error:', error);
    return Response.json({ error: 'Internal API error' }, { status: 500 });
  }
}
