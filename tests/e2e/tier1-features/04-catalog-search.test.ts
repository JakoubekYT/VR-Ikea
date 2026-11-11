import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import { filterCatalog } from '../../../src/utils/roomLogic.js';

describe('Tier 1: Feature 4 - IKEA Catalog Search & Diacritics', () => {
  it('T1-F4-01: Czech Diacritic Insensitive Matching', () => {
    const matches = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'rohová sedačka');

    assert.ok(matches.length >= 1, 'Should match corner sofas for "rohová sedačka"');
    const names = matches.map((p) => p.name);
    assert.ok(
      names.includes('VIMLE') || names.includes('KIVIK') || names.includes('FRIHETEN'),
      `Expected VIMLE, KIVIK or FRIHETEN, got: ${names.join(', ')}`
    );
  });

  it('T1-F4-02: Diacritic Equivalence Invariance', () => {
    const resA = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'křeslo').map((p) => p.id);
    const resB = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'kreslo').map((p) => p.id);

    assert.ok(resA.length > 0, 'Accented query "křeslo" should return products');
    assert.deepEqual(
      resA,
      resB,
      'Query with diacritics ("křeslo") and unaccented ASCII ("kreslo") must yield identical results'
    );
  });

  it('T1-F4-03: Bilingual Czech & English Synonym Expansion', () => {
    const queries = ['stůl', 'psací', 'desk', 'table'];

    for (const q of queries) {
      const res = filterCatalog(INITIAL_IKEA_CATALOG, 'All', q);
      assert.ok(res.length > 0, `Query "${q}" should return matching items`);
      const names = res.map((p) => p.name);
      const hasDeskOrTable = names.includes('BEKANT') || names.includes('LISABO') || names.includes('MICKE');
      assert.ok(
        hasDeskOrTable,
        `Synonym search "${q}" must include BEKANT, LISABO, or MICKE. Got: ${names.join(', ')}`
      );
    }
  });

  it('T1-F4-04: Strict Category Scoping', () => {
    const lightingProducts = filterCatalog(INITIAL_IKEA_CATALOG, 'Lighting', '');

    assert.ok(lightingProducts.length >= 8, 'Expected at least 8 lighting products in catalog');
    for (const prod of lightingProducts) {
      assert.equal(prod.category, 'Lighting', `Product ${prod.name} should belong strictly to Lighting`);
    }
  });

  it('T1-F4-05: Typo Tolerance via Levenshtein Distance', () => {
    const typoKallax = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'kalax');
    assert.ok(
      typoKallax.some((p) => p.name === 'KALLAX'),
      'Single-character typo "kalax" should match KALLAX shelving'
    );

    const typoSofa = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'sedackaa');
    assert.ok(
      typoSofa.length >= 1,
      'Typo query "sedackaa" should successfully match sofa category items'
    );
  });

  it('T1-F4-06: Article Number Exact Matching', () => {
    const formattedQuery = filterCatalog(INITIAL_IKEA_CATALOG, 'All', '392.167.54');
    assert.ok(
      formattedQuery.some((p) => p.articleNumber === '392.167.54'),
      'Query with standard article number format "392.167.54" should match FRIHETEN'
    );
    assert.equal(formattedQuery[0].name, 'FRIHETEN');
  });
});
