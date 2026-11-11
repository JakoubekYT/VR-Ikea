import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildParametric3DSpec,
  calculateBomSummary,
  computeWallCutaway,
  filterCatalog,
  generateSixMatchingIkeaProducts,
  kelvinToHex,
  findRoomForPoint,
  snapFurnitureToRoom,
} from './roomLogic.ts';
import { INITIAL_IKEA_CATALOG, INITIAL_APARTMENT_ROOMS, INITIAL_CHANDELIERS } from '../data/ikeaCatalog.ts';
import type { PlacedFurnitureItem } from '../types/ikea.ts';

describe('Multi-Room Apartment & IKEA 3D Logic Suite', () => {
  it('buildParametric3DSpec decomposes every catalog product into 20 to 40 detailed sub-parts with exact meter dimensions', () => {
    for (const product of INITIAL_IKEA_CATALOG) {
      const spec = buildParametric3DSpec(
        product,
        product.swatches[0].hex,
        product.swatches[0].name
      );

      assert.ok(
        spec.parts.length >= 20 && spec.parts.length <= 40,
        `Expected ${product.name} (${product.category}) to have 20..40 parts, got ${spec.parts.length}`
      );

      assert.equal(spec.overallDimensionsMeters.width, Number((product.dimensionsCm.width / 100).toFixed(3)));
      assert.equal(spec.overallDimensionsMeters.height, Number((product.dimensionsCm.height / 100).toFixed(3)));
      assert.equal(spec.overallDimensionsMeters.depth, Number((product.dimensionsCm.depth / 100).toFixed(3)));
    }
  });

  it('generateSixMatchingIkeaProducts returns 6 real matching IKEA products for Czech & English queries', () => {
    const queries = ['rohová sedačka', 'psací stůl', 'šatní skříň', 'postel', 'kallax', 'malm', 'židle'];
    for (const q of queries) {
      const results = generateSixMatchingIkeaProducts(q, INITIAL_IKEA_CATALOG);
      assert.equal(results.length, 6, `Expected 6 results for "${q}", got ${results.length}`);
      for (const item of results) {
        assert.ok(item.dimensionsCm.width > 0 && item.dimensionsCm.depth > 0 && item.dimensionsCm.height > 0);
        assert.ok(item.priceCzk > 0);
        assert.ok(item.articleNumber.length >= 8);
      }
    }
  });

  it('filterCatalog supports Czech diacritics and bilingual synonyms', () => {
    const cornerSofas = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'rohová sedačka');
    assert.ok(cornerSofas.length >= 1);
    assert.ok(cornerSofas.some((p) => p.name === 'VIMLE' || p.name === 'KIVIK'));

    const desks = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'psací stůl');
    assert.ok(desks.some((p) => p.name === 'BEKANT' || p.name === 'MICKE'));
  });

  it('calculateBomSummary aggregates placed furniture and ceiling chandeliers accurately', () => {
    const kivik = INITIAL_IKEA_CATALOG[0];
    const placed: PlacedFurnitureItem[] = [
      {
        instanceId: 'inst-1',
        productId: kivik.id,
        product: kivik,
        swatchName: kivik.swatches[0].name,
        swatchHex: kivik.swatches[0].hex,
        position: [0, 0, 0],
        rotationY: 0,
        spec3D: buildParametric3DSpec(kivik, kivik.swatches[0].hex, kivik.swatches[0].name),
        roomId: 'room-living',
      },
    ];

    const summary = calculateBomSummary(placed, INITIAL_CHANDELIERS);
    const expectedCzk =
      kivik.priceCzk + INITIAL_CHANDELIERS.reduce((sum, ch) => sum + ch.catalogItem.priceCzk, 0);
    assert.equal(summary.totalCzk, expectedCzk);
    assert.equal(summary.totalItems, 1 + INITIAL_CHANDELIERS.length);
  });

  it('kelvinToHex converts warm 2700K and cool 6000K color temperatures into valid hex strings', () => {
    const warm = kelvinToHex(2700);
    const cool = kelvinToHex(6000);
    assert.match(warm, /^#[0-9a-fA-F]{6}$/);
    assert.match(cool, /^#[0-9a-fA-F]{6}$/);
    assert.notEqual(warm, cool);
  });

  it('findRoomForPoint and computeWallCutaway work across multi-room apartment layouts', () => {
    const livingRoom = findRoomForPoint(0, 0, INITIAL_APARTMENT_ROOMS);
    assert.equal(livingRoom.id, 'room-living');

    const bedroom = findRoomForPoint(-1.2, -4.3, INITIAL_APARTMENT_ROOMS);
    assert.equal(bedroom.id, 'room-bedroom');

    const cutaway = computeWallCutaway([0, 6.5, 8.5], [0, 0, 0], true);
    assert.equal(cutaway.south, true);
    assert.equal(cutaway.north, false);
  });

  it('snapFurnitureToRoom clamps items inside room boundaries', () => {
    const product = INITIAL_IKEA_CATALOG[0];
    const snapped = snapFurnitureToRoom([99, -2, -99], 0, product.dimensionsCm, {
      width: 5,
      length: 4,
      enableGridSnap: true,
      enableWallSnap: true,
    });
    assert.equal(snapped.position[1], 0);
    assert.ok(snapped.position[0] <= 2.5);
    assert.ok(snapped.position[2] >= -2.0);
  });
});
