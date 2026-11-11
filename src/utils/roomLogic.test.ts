import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildParametric3DSpec,
  calculateBomSummary,
  clampToRoomBounds,
  computeWallCutaway,
  filterCatalog,
  parseIkeaUrl,
  snapToGrid,
} from './roomLogic';
import { IKEA_CATALOG } from '../data/ikeaCatalog';
import { PlacedFurniture } from '../types/ikea';

test('IKEA catalog contains at least 20 authentic products across all categories', () => {
  assert.ok(IKEA_CATALOG.length >= 20, `Expected >=20 products, got ${IKEA_CATALOG.length}`);
  for (const prod of IKEA_CATALOG) {
    assert.ok(prod.name.length > 0);
    assert.match(prod.articleNumber, /^\d{3}\.\d{3}\.\d{2}$/);
    assert.ok(prod.priceCZK > 0);
    assert.ok(prod.priceEUR > 0);
    assert.ok(prod.dimensionsCm.width > 0);
    assert.ok(prod.dimensionsCm.depth > 0);
    assert.ok(prod.dimensionsCm.height > 0);
  }
});

test('parseIkeaUrl extracts product name, article number, and locale from real IKEA URLs', () => {
  const res = parseIkeaUrl(
    'https://www.ikea.com/cz/cs/p/kivik-3mistna-pohovka-tibbleby-bezova-seda-s49440598/'
  );
  assert.equal(res.isUrl, true);
  assert.equal(res.extractedName, 'KIVIK');
  assert.equal(res.extractedArticleNumber, '494.405.98');
  assert.equal(res.extractedLocale, 'cz/cs');

  const nonUrl = parseIkeaUrl('ergonomic chair');
  assert.equal(nonUrl.isUrl, false);
});

test('filterCatalog filters by category, search query, pasted IKEA URL, and matchedQueries accurately', () => {
  const sofas = filterCatalog(IKEA_CATALOG, 'Sofas & Armchairs', '');
  assert.ok(sofas.length >= 3);
  assert.ok(sofas.every((p) => p.category === 'Sofas & Armchairs'));

  const strandmon = filterCatalog(IKEA_CATALOG, 'All', '203.432.24');
  assert.equal(strandmon.length, 1);
  assert.equal(strandmon[0].name, 'STRANDMON');
  const urlMatches = filterCatalog(IKEA_CATALOG, 'All', 'https://www.ikea.com/cz/cs/p/kivik-3mistna-pohovka-tibbleby-bezova-seda-s49440598/');
  assert.equal(urlMatches.length, 1);
  assert.equal(urlMatches[0].name, 'KIVIK');

  // Verify filtering when user pastes a full IKEA product URL
  const urlFiltered = filterCatalog(
    IKEA_CATALOG,
    'All',
    'https://www.ikea.com/cz/cs/p/kivik-3mistna-pohovka-tibbleby-bezova-seda-s49440598/'
  );
  assert.ok(urlFiltered.length >= 1);
  assert.equal(urlFiltered[0].name, 'KIVIK');
});

test('buildParametric3DSpec decomposes every catalog item into 10 to 28 detailed 3D sub-parts', () => {
  for (const product of IKEA_CATALOG) {
    const spec = buildParametric3DSpec(product);
    assert.equal(spec.overallDimensionsMeters.width, Number((product.dimensionsCm.width / 100).toFixed(3)));
    assert.equal(spec.overallDimensionsMeters.height, Number((product.dimensionsCm.height / 100).toFixed(3)));
    assert.equal(spec.overallDimensionsMeters.depth, Number((product.dimensionsCm.depth / 100).toFixed(3)));
    assert.ok(
      spec.parts.length >= 12 && spec.parts.length <= 28,
      `Product ${product.name} generated ${spec.parts.length} parts`
    );
  }
});

test('calculateBomSummary aggregates quantities, CZK/EUR totals, and floor area accurately', () => {
  const kivik = IKEA_CATALOG[0];
  const strandmon = IKEA_CATALOG[1];

  const placed: PlacedFurniture[] = [
    {
      instanceId: 'inst-1',
      productId: kivik.id,
      product: kivik,
      position: [0, 0, 0],
      rotationY: 0,
      scale: 1,
      selectedColorHex: kivik.swatches[0].hex,
      selectedSwatchName: kivik.swatches[0].name,
      spec3D: buildParametric3DSpec(kivik),
    },
    {
      instanceId: 'inst-2',
      productId: kivik.id,
      product: kivik,
      position: [1, 0, 0],
      rotationY: 0,
      scale: 1,
      selectedColorHex: kivik.swatches[0].hex,
      selectedSwatchName: kivik.swatches[0].name,
      spec3D: buildParametric3DSpec(kivik),
    },
    {
      instanceId: 'inst-3',
      productId: strandmon.id,
      product: strandmon,
      position: [-1, 0, 1],
      rotationY: 0,
      scale: 1,
      selectedColorHex: strandmon.swatches[0].hex,
      selectedSwatchName: strandmon.swatches[0].name,
      spec3D: buildParametric3DSpec(strandmon),
    },
  ];

  const bom = calculateBomSummary(placed);
  assert.equal(bom.totalCount, 3);
  assert.equal(bom.items.length, 2);
  assert.equal(bom.totalPriceCZK, kivik.priceCZK * 2 + strandmon.priceCZK);
  assert.equal(bom.totalPriceEUR, kivik.priceEUR * 2 + strandmon.priceEUR);
  assert.ok(bom.totalFloorAreaM2 > 4.0);
});

test('snapToGrid, clampToRoomBounds, and computeWallCutaway behave deterministically', () => {
  assert.equal(snapToGrid(1.14, 0.25), 1.25);
  assert.equal(snapToGrid(-0.61, 0.25), -0.5);

  const clamped = clampToRoomBounds([5.0, 0, -4.5], { width: 2.0, depth: 1.0 }, 0, 6.0, 5.0);
  assert.ok(clamped[0] <= 2.0);
  assert.ok(clamped[2] >= -2.0);

  const cutaway = computeWallCutaway([0, 3, 4.5], 6.0, 5.0, true);
  assert.equal(cutaway.south, true);
  assert.equal(cutaway.north, false);
});
