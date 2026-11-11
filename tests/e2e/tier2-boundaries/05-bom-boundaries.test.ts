import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import { calculateBomSummary } from '../../../src/utils/roomLogic.js';
import {
  assertBomMath,
  assertValidCsv,
  createMockPlacedItem,
  exportBomToCsv,
} from '../../harness/index.js';
import type { PlacedFurnitureItem } from '../../../src/types/ikea.js';

describe('Tier 2: Feature 5 - BOM Calculations Boundaries', () => {
  it('T2-F5-01: Empty Placed Inventory State', () => {
    const summary = calculateBomSummary([], []);
    assert.deepEqual(summary, {
      lines: [],
      totalCzk: 0,
      totalEur: 0,
      totalItems: 0,
    });
  });

  it('T2-F5-02: High-Volume Scale (100+ Placed Items)', () => {
    const items: PlacedFurnitureItem[] = [];
    for (let i = 0; i < 120; i++) {
      const prod = INITIAL_IKEA_CATALOG[i % INITIAL_IKEA_CATALOG.length];
      items.push(createMockPlacedItem(prod, { instanceId: `bulk-${i}` }));
    }

    const summary = calculateBomSummary(items, []);
    assertBomMath(summary);

    assert.equal(summary.totalItems, 120);
    assert.ok(summary.totalCzk > 0);
    assert.ok(summary.lines.length <= INITIAL_IKEA_CATALOG.length * 3);
  });

  it('T2-F5-03: Zero-Price Promotional Items', () => {
    const freeProd = {
      ...INITIAL_IKEA_CATALOG[0],
      priceCzk: 0,
      priceEur: 0,
    };
    const item = createMockPlacedItem(freeProd);

    const summary = calculateBomSummary([item], []);
    assertBomMath(summary);

    assert.equal(summary.lines[0].subtotalCzk, 0);
    assert.equal(summary.lines[0].subtotalEur, 0);
    assert.equal(summary.totalCzk, 0);
    assert.equal(summary.totalEur, 0);
    assert.equal(isNaN(summary.totalCzk), false);
  });

  it('T2-F5-04: CSV RFC-4180 Escaping for Quotes and Commas', () => {
    const quoteProd = {
      ...INITIAL_IKEA_CATALOG[0],
      name: 'LACK, "Special" Edition Oak',
    };
    const item = createMockPlacedItem(quoteProd);

    const summary = calculateBomSummary([item], []);
    const csv = exportBomToCsv(summary);

    assertValidCsv(csv, 2);
    assert.ok(csv.includes('"LACK, ""Special"" Edition Oak"'));
  });

  it('T2-F5-05: Extreme Currency Totals Formatting', () => {
    const luxuryProd = {
      ...INITIAL_IKEA_CATALOG[0],
      priceCzk: 10000000,
      priceEur: 400000,
    };
    const item = createMockPlacedItem(luxuryProd);

    const summary = calculateBomSummary([item], []);
    assert.equal(summary.totalCzk, 10000000);
    assert.equal(summary.totalEur, 400000);

    const formatted = summary.totalCzk.toLocaleString('cs-CZ');
    assert.ok(formatted.includes('10') && formatted.includes('000'));
  });

  it('T2-F5-06: Malformed Placed Item Reference Recovery', () => {
    const malformedProd = {
      ...INITIAL_IKEA_CATALOG[0],
      articleNumber: '',
    };
    const item = createMockPlacedItem(malformedProd);

    assert.doesNotThrow(() => {
      const summary = calculateBomSummary([item], []);
      assert.equal(summary.lines.length, 1);
    });
  });
});
