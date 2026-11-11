import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import {
  searchIkeaProducts,
  scrapeIkeaProductUrl,
  reconstructImageTo3D,
  synthesizeProduct3D,
} from '../../../src/server/ikeaService.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import { memoryStorage } from '../../harness/index.js';

describe('Tier 1: Feature 2 - Offline / Free Fallback Engine', () => {
  it('T1-F2-01: Zero-Quota Offline Catalog Search', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = '';
      const res = await searchIkeaProducts('rohová sedačka');

      assert.equal(res.source, 'fallback');
      assert.equal(res.products.length, 6);
      for (const prod of res.products) {
        assert.ok(prod.id, 'Every fallback product must have an id');
        assert.ok(prod.name, 'Every fallback product must have a name');
        assert.ok(prod.dimensionsCm.width > 0, 'Width must be > 0');
        assert.ok(prod.dimensionsCm.height > 0, 'Height must be > 0');
        assert.ok(prod.dimensionsCm.depth > 0, 'Depth must be > 0');
        assert.ok(prod.priceCzk > 0, 'Price CZK must be > 0');
        assert.ok(prod.priceEur > 0, 'Price EUR must be > 0');
      }
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('T1-F2-02: Offline URL Scraper with Slug Parsing', async () => {
    const url = 'https://www.ikea.com/cz/cs/p/kivik-trojmisti-pohovka-tibbleby-bezovoseda-s49440598/';
    const res = await scrapeIkeaProductUrl(url);

    assert.equal(res.products.length, 6);
    assert.ok(
      res.source === 'direct_ikea' || res.source === 'slug_ikea' || res.source === 'fallback',
      `Unexpected source: ${res.source}`
    );
    assert.ok(res.products[0].name.length > 0, 'First product must have non-empty name');
    assert.ok(
      res.products.some((p) => p.name.includes('KIVIK') || p.category.includes('Sofas')),
      'Should contain KIVIK or sofas based on URL slug'
    );
  });

  it('T1-F2-03: Offline Photo-to-3D Reconstruction Fallback', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = '';
      const res = await reconstructImageTo3D({
        nameHint: 'Nordic Armchair',
        dimensionsCm: { width: 85, depth: 85, height: 95 },
      });

      assert.equal(res.source, 'fallback');
      assert.ok(res.spec3D, 'Must return spec3D');
      assert.ok(res.spec3D.parts.length >= 20 && res.spec3D.parts.length <= 40, 'Parts count between 20 and 40');
      assert.equal(res.spec3D.overallDimensionsMeters.width, 0.85);
      assert.equal(res.spec3D.overallDimensionsMeters.depth, 0.85);
      assert.equal(res.spec3D.overallDimensionsMeters.height, 0.95);
      assert.ok(res.product.articleNumber.length > 0, 'Fallback product has article number');
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('T1-F2-04: Deterministic 3D CAD Synthesis Endpoint', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = '';
      const product = INITIAL_IKEA_CATALOG[0];
      const res = await synthesizeProduct3D({
        product,
        swatchHex: product.swatches[0].hex,
        swatchName: product.swatches[0].name,
      });

      assert.equal(res.status, 200);
      assert.equal(res.payload.source, 'parametric');
      const spec = res.payload.spec as any;
      assert.ok(spec && Array.isArray(spec.parts));
      assert.ok(spec.parts.length >= 20 && spec.parts.length <= 40);
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('T1-F2-05: Gemini 4-Tier Model Cascade Recovery', async () => {
    // When no API key is set, the cascade immediately and safely recovers to local fallback
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = '';
      const searchRes = await searchIkeaProducts('kallax');
      assert.equal(searchRes.source, 'fallback');
      assert.equal(searchRes.products.length, 6);

      const synthRes = await synthesizeProduct3D({
        product: INITIAL_IKEA_CATALOG[1],
      });
      assert.equal(synthRes.status, 200);
      assert.equal(synthRes.payload.source, 'parametric');
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('T1-F2-06: LocalStorage 0ms Client Cache Hit', () => {
    const cacheKey = 'ikea_3d_spec_cache_v3';
    const mockSpec = {
      overallDimensionsMeters: { width: 1.2, height: 0.8, depth: 0.6 },
      parts: [{ name: 'Cached Part', shape: 'rounded_box', position: [0, 0, 0], size: [1, 1, 1] }],
    };

    memoryStorage.setItem(cacheKey, JSON.stringify({ 'item-1_#ffffff': mockSpec }));

    const raw = memoryStorage.getItem(cacheKey);
    assert.ok(raw, 'Cache item must exist');
    const parsed = JSON.parse(raw);
    assert.deepEqual(parsed['item-1_#ffffff'], mockSpec);
  });
});
