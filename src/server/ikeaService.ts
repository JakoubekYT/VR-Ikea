import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { INITIAL_IKEA_CATALOG } from '../data/ikeaCatalog.js';
import { buildParametric3DSpec, generateSixMatchingIkeaProducts } from '../utils/roomLogic.js';
import type { Furniture3DSpec, IkeaCategory, IkeaProduct } from '../types/ikea.js';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
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
  timeoutMs = 3200
): Promise<string> {
  const models = [
    'gemini-2.5-flash',
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

async function scrapeExternalIkeaUrl(url: string): Promise<{
  rawText: string;
  ogImage?: string;
  source: 'allorigins+gemini' | 'jina+gemini' | 'fallback';
}> {
  try {
    const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await withTimeout(fetch(allOriginsUrl), 2400);
    if (res.ok) {
      const json = (await res.json()) as { contents?: string };
      if (json.contents && json.contents.length > 100) {
        const html = json.contents;
        const ogImageMatch = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const stripped = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 6500);
        return {
          rawText: `Title: ${titleMatch?.[1] || ''}\nContent: ${stripped}`,
          ogImage: ogImageMatch?.[1],
          source: 'allorigins+gemini',
        };
      }
    }
  } catch {
    // Proceed to r.jina.ai fallback
  }

  try {
    const jinaRes = await withTimeout(
      fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: 'text/plain' },
      }),
      2400
    );
    if (jinaRes.ok) {
      const text = await jinaRes.text();
      if (text && text.length > 60) {
        return {
          rawText: text.slice(0, 6500),
          source: 'jina+gemini',
        };
      }
    }
  } catch {
    // Fallback to URL slug parsing
  }

  return { rawText: '', source: 'fallback' };
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
  source: 'allorigins+gemini' | 'jina+gemini' | 'gemini' | 'fallback';
  scrapedUrl?: string;
}> {
  const url = String(rawUrl || '').trim();
  if (!url) {
    return { products: INITIAL_IKEA_CATALOG.slice(0, 6), source: 'fallback' };
  }

  const scraped = await scrapeExternalIkeaUrl(url);
  const ai = getGeminiClient();

  if (ai) {
    try {
      const text = await callGeminiWithFallback(
        ai,
        `Extract the exact IKEA product from this URL: ${url}
Scraped page text:
${scraped.rawText || '(Use your built-in IKEA product knowledge for the URL slug)'}
Also include 5 closely related/matching IKEA products so the user gets 6 total items. Ensure the first item is the exact product from the URL with exact width, depth, height in cm and price in CZK.`,
        IKEA_PRODUCT_ARRAY_SCHEMA,
        'You are an IKEA product parser and 3D catalog assistant. Extract exact dimensions in cm, CZK price, article number, and color swatches.'
      );
      const parsed = JSON.parse(text) as IkeaProduct[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (scraped.ogImage) {
          parsed[0].imageUrl = scraped.ogImage;
        }
        return {
          products: parsed,
          source: scraped.source === 'fallback' ? 'gemini' : scraped.source,
          scrapedUrl: url,
        };
      }
    } catch {
      // Fallback below
    }
  }

  const fallbackProducts = generateSixMatchingIkeaProducts(url, INITIAL_IKEA_CATALOG);
  if (scraped.ogImage && fallbackProducts[0]) {
    fallbackProducts[0] = { ...fallbackProducts[0], imageUrl: scraped.ogImage };
  }
  return {
    products: fallbackProducts,
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
        4200
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
        3000
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
