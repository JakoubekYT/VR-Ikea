import type { Furniture3DSpec, IkeaProduct } from '../types/ikea';
import { INITIAL_IKEA_CATALOG } from '../data/ikeaCatalog';
import { buildParametric3DSpec, generateSixMatchingIkeaProducts } from '../utils/roomLogic';

const SEARCH_CACHE_KEY = 'ikea_search_cache_v3';
const SPEC3D_CACHE_KEY = 'ikea_3d_spec_cache_v3';

function readCache<T>(storageKey: string): Record<string, T> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, T>;
  } catch {
    return {};
  }
}

function writeCache<T>(storageKey: string, key: string, value: T): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const current = readCache<T>(storageKey);
    current[key] = value;
    window.localStorage.setItem(storageKey, JSON.stringify(current));
  } catch {
    // Ignore storage quota errors
  }
}

export interface IkeaSearchResponse {
  products: IkeaProduct[];
  source: 'cache' | 'gemini' | 'direct_ikea' | 'jina_ikea' | 'slug_ikea' | 'ikea+gemini' | 'fallback' | string;
  scrapedUrl?: string;
}

export async function searchIkeaProductsLive(query: string): Promise<IkeaSearchResponse> {
  const normalizedKey = query.trim().toLowerCase();
  if (!normalizedKey) {
    return { products: INITIAL_IKEA_CATALOG.slice(0, 6), source: 'fallback' };
  }

  const cached = readCache<IkeaProduct[]>(SEARCH_CACHE_KEY)[normalizedKey];
  if (cached && Array.isArray(cached) && cached.length >= 6) {
    return { products: cached.slice(0, 6), source: 'cache' };
  }

  try {
    const res = await fetch('/api/ikea/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        writeCache(SEARCH_CACHE_KEY, normalizedKey, data.products);
        return {
          products: data.products,
          source: data.source || 'gemini',
          scrapedUrl: data.scrapedUrl,
        };
      }
    }
  } catch {
    // Fall back to deterministic 6-product generator
  }

  const fallbackProducts = generateSixMatchingIkeaProducts(query, INITIAL_IKEA_CATALOG);
  writeCache(SEARCH_CACHE_KEY, normalizedKey, fallbackProducts);
  return { products: fallbackProducts, source: 'fallback' };
}

export async function scrapeIkeaUrlLive(url: string): Promise<IkeaSearchResponse> {
  const normalizedUrl = url.trim();
  const cached = readCache<IkeaProduct[]>(SEARCH_CACHE_KEY)[`url:${normalizedUrl}`];
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return { products: cached, source: 'cache', scrapedUrl: normalizedUrl };
  }

  try {
    const res = await fetch('/api/ikea/scrape-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        writeCache(SEARCH_CACHE_KEY, `url:${normalizedUrl}`, data.products);
        return {
          products: data.products,
          source: data.source || 'allorigins+gemini',
          scrapedUrl: normalizedUrl,
        };
      }
    }
  } catch {
    // Fall back to slug extraction
  }

  const fallbackProducts = generateSixMatchingIkeaProducts(normalizedUrl, INITIAL_IKEA_CATALOG);
  return { products: fallbackProducts, source: 'fallback', scrapedUrl: normalizedUrl };
}

export interface ImageTo3DResponse {
  product: IkeaProduct;
  spec3D: Furniture3DSpec;
  source: 'gemini' | 'fallback';
}

export async function convertImageTo3DLive(params: {
  imageBase64: string;
  mimeType: string;
  dimensionsCm: { width: number; depth: number; height: number };
  nameHint?: string;
}): Promise<ImageTo3DResponse> {
  try {
    const res = await fetch('/api/ikea/image-to-3d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.product && data.spec3D && Array.isArray(data.spec3D.parts) && data.spec3D.parts.length >= 12) {
        return {
          product: data.product,
          spec3D: data.spec3D,
          source: data.source || 'gemini',
        };
      }
    }
  } catch {
    // Fallback below
  }

  const fallbackProduct: IkeaProduct = {
    id: `ikea-img-${Date.now().toString().slice(-5)}`,
    name: (params.nameHint || 'NORDLI CUSTOM').toUpperCase(),
    typeName: 'Custom 3D Furniture from Photo / Vlastní 3D model z fotky',
    category: 'Storage & Shelving',
    articleNumber: `905.${Math.floor(100 + Math.random() * 899)}.42`,
    priceCzk: 6990,
    priceEur: 279,
    dimensionsCm: params.dimensionsCm,
    materialDescription: 'Solid oak veneer, powder-coated steel, and custom upholstery extracted from reference photo.',
    swatches: [
      { name: 'Photo Original / Původní barva', hex: '#D8C8B4' },
      { name: 'Anthracite / Antracitová', hex: '#2B2B2D' },
      { name: 'White Laminate / Bílá', hex: '#F3F1ED' },
    ],
    archetype: 'shelving',
    imageUrl: params.imageBase64.startsWith('data:')
      ? params.imageBase64
      : `data:${params.mimeType};base64,${params.imageBase64}`,
  };

  const spec3D = buildParametric3DSpec(fallbackProduct, fallbackProduct.swatches[0].hex, fallbackProduct.swatches[0].name);
  return { product: fallbackProduct, spec3D, source: 'fallback' };
}

export async function synthesize3DModelLive(
  product: IkeaProduct,
  swatchHex: string,
  swatchName: string
): Promise<{ spec: Furniture3DSpec; source: 'cache' | 'gemini' | 'parametric' }> {
  const cacheKey = `${product.id}:${swatchHex}:${product.dimensionsCm.width}x${product.dimensionsCm.depth}x${product.dimensionsCm.height}`;
  const cached = readCache<Furniture3DSpec>(SPEC3D_CACHE_KEY)[cacheKey];
  if (cached && Array.isArray(cached.parts) && cached.parts.length >= 20) {
    return { spec: cached, source: 'cache' };
  }

  try {
    const res = await fetch('/api/ikea/generate-3d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product,
        swatchHex,
        swatchName,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.spec && Array.isArray(data.spec.parts) && data.spec.parts.length >= 20) {
        writeCache(SPEC3D_CACHE_KEY, cacheKey, data.spec);
        return { spec: data.spec, source: data.source || 'gemini' };
      }
    }
  } catch {
    // Fallback to 20-40 part parametric builder
  }

  const spec = buildParametric3DSpec(product, swatchHex, swatchName);
  writeCache(SPEC3D_CACHE_KEY, cacheKey, spec);
  return { spec, source: 'parametric' };
}
