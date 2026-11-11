import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG, INITIAL_CHANDELIERS } from '../../../src/data/ikeaCatalog.js';
import { calculateBomSummary } from '../../../src/utils/roomLogic.js';
import {
  assertBomMath,
  assertValidCsv,
  assertValidJson,
  createMockPlacedItem,
  exportBomToCsv,
  exportBomToJson,
} from '../../harness/index.js';

describe('Tier 1: Feature 5 - BOM Calculations & Multi-Format Export', () => {
  it('T1-F5-01: Duplicate Line Item Aggregation', () => {
    const product = INITIAL_IKEA_CATALOG.find((p) => p.name === 'KIVIK')!;
    const swatch = product.swatches[0];

    const items = [
      createMockPlacedItem(product, { instanceId: 'k1', swatchName: swatch.name, swatchHex: swatch.hex }),
      createMockPlacedItem(product, { instanceId: 'k2', swatchName: swatch.name, swatchHex: swatch.hex }),
      createMockPlacedItem(product, { instanceId: 'k3', swatchName: swatch.name, swatchHex: swatch.hex }),
    ];

    const summary = calculateBomSummary(items, []);
    assertBomMath(summary);

    assert.equal(summary.lines.length, 1);
    assert.equal(summary.lines[0].quantity, 3);
    assert.equal(summary.lines[0].subtotalCzk, 3 * product.priceCzk);
    assert.equal(summary.lines[0].subtotalEur, 3 * product.priceEur);
    assert.equal(summary.totalItems, 3);
  });

  it('T1-F5-02: Multi-Swatch Line Item Separation', () => {
    const product = INITIAL_IKEA_CATALOG.find((p) => p.name === 'KIVIK')!;
    const swatchA = product.swatches[0];
    const swatchB = product.swatches[1];

    const items = [
      createMockPlacedItem(product, { instanceId: 'k1', swatchName: swatchA.name, swatchHex: swatchA.hex }),
      createMockPlacedItem(product, { instanceId: 'k2', swatchName: swatchB.name, swatchHex: swatchB.hex }),
    ];

    const summary = calculateBomSummary(items, []);
    assertBomMath(summary);

    assert.equal(summary.lines.length, 2, 'Different swatches of same product must form separate line items');
    assert.equal(summary.totalItems, 2);
    assert.notEqual(summary.lines[0].swatchName, summary.lines[1].swatchName);
  });

  it('T1-F5-03: Ceiling Chandelier Aggregation', () => {
    const summary = calculateBomSummary([], INITIAL_CHANDELIERS);
    assertBomMath(summary);

    assert.equal(summary.totalItems, INITIAL_CHANDELIERS.length);
    assert.ok(
      summary.lines.some((l) => l.product.name.includes('Multi-Ring') || l.product.name.includes('Lustr') || l.product.name.includes('Cluster')),
      'Summary lines must contain chandelier presets'
    );
  });

  it('T1-F5-04: Currency Calculation Integrity (CZK & EUR)', () => {
    const items = [
      createMockPlacedItem(INITIAL_IKEA_CATALOG[0]),
      createMockPlacedItem(INITIAL_IKEA_CATALOG[1]),
      createMockPlacedItem(INITIAL_IKEA_CATALOG[2]),
    ];

    const summary = calculateBomSummary(items, INITIAL_CHANDELIERS);
    assertBomMath(summary);

    const sumCzk = summary.lines.reduce((acc, l) => acc + l.subtotalCzk, 0);
    const sumEur = summary.lines.reduce((acc, l) => acc + l.subtotalEur, 0);

    assert.equal(summary.totalCzk, sumCzk);
    assert.equal(summary.totalEur, sumEur);
    assert.ok(summary.totalCzk > 0);
    assert.ok(summary.totalEur > 0);
  });

  it('T1-F5-05: CSV Export Formatting', () => {
    const items = [
      createMockPlacedItem(INITIAL_IKEA_CATALOG[0], { instanceId: 'it-1' }),
      createMockPlacedItem(INITIAL_IKEA_CATALOG[0], { instanceId: 'it-2' }),
      createMockPlacedItem(INITIAL_IKEA_CATALOG[1], { instanceId: 'it-3' }),
    ];
    const summary = calculateBomSummary(items, INITIAL_CHANDELIERS.slice(0, 1));
    const csv = exportBomToCsv(summary);

    assertValidCsv(csv, 3);
    assert.ok(csv.includes(INITIAL_IKEA_CATALOG[0].articleNumber));
    assert.ok(csv.includes(INITIAL_IKEA_CATALOG[1].articleNumber));
  });

  it('T1-F5-06: JSON Export Formatting', () => {
    const items = [createMockPlacedItem(INITIAL_IKEA_CATALOG[0])];
    const summary = calculateBomSummary(items, INITIAL_CHANDELIERS.slice(0, 1));

    const jsonStr = exportBomToJson(summary);
    const parsed = assertValidJson<any>(jsonStr);

    assert.ok(parsed.apartmentTotals);
    assert.equal(parsed.apartmentTotals.totalItems, summary.totalItems);
    assert.equal(parsed.apartmentTotals.totalCzk, summary.totalCzk);
    assert.equal(parsed.apartmentTotals.totalEur, summary.totalEur);
    assert.ok(Array.isArray(parsed.lines));
    assert.equal(parsed.lines.length, summary.lines.length);
  });
});
