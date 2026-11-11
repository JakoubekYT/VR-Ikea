import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import {
  filterCatalog,
  generateSixMatchingIkeaProducts,
} from '../../../src/utils/roomLogic.js';

describe('Tier 2: Feature 4 - IKEA Catalog Search Boundaries', () => {
  it("T2-F4-01: Empty Query on Category 'All'", () => {
    const res = filterCatalog(INITIAL_IKEA_CATALOG, 'All', '');
    assert.equal(res.length, INITIAL_IKEA_CATALOG.length, 'Empty search should return all catalog items');
  });

  it('T2-F4-02: Complete Gibberish Search String', () => {
    const res = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'xyzq987_nonexistent');
    assert.deepEqual(res, [], 'Random gibberish should return empty array from filterCatalog');
  });

  it('T2-F4-03: Fallback Pool Guarantee on Gibberish Query', () => {
    const res = generateSixMatchingIkeaProducts('xyzq987_nonexistent', INITIAL_IKEA_CATALOG);

    assert.equal(res.length, 6, 'generateSixMatchingIkeaProducts must always guarantee 6 products');
    for (const prod of res) {
      assert.ok(prod.name.length > 0);
      assert.ok(prod.priceCzk > 0);
      assert.ok(prod.dimensionsCm.width > 0);
    }
  });

  it('T2-F4-04: Regex Metacharacter Injection', () => {
    const regexQuery = '.*+?^${}()|[]\\';
    assert.doesNotThrow(() => {
      const res = filterCatalog(INITIAL_IKEA_CATALOG, 'All', regexQuery);
      assert.ok(Array.isArray(res));
    }, 'Regex injection characters must not cause RegExp syntax errors');
  });

  it('T2-F4-05: Mixed Casing & Diacritics Stress Test', () => {
    const chaoticQuery = 'vÝkOnNá ŠaTNí SKŘÍŇ';
    const res = filterCatalog(INITIAL_IKEA_CATALOG, 'All', chaoticQuery);

    assert.ok(res.length > 0, 'Should match wardrobes despite chaotic accents and casing');
    assert.ok(
      res.some((p) => p.name === 'PAX' || p.name === 'HEMNES' || p.category.includes('Storage')),
      'Should match PAX or HEMNES wardrobe'
    );
  });

  it('T2-F4-06: Ultra-Short Acronym Query', () => {
    const res = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'tv');

    assert.ok(res.length > 0, '2-letter query "tv" should find media furniture');
    assert.ok(
      res.some((p) => p.name === 'BESTÅ' || p.typeName.toLowerCase().includes('tv')),
      'Should match BESTÅ TV bench'
    );
  });
});
