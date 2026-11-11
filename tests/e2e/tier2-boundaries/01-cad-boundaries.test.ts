import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import { buildParametric3DSpec } from '../../../src/utils/roomLogic.js';
import { buildFurnitureGroup } from '../../../src/three/furnitureBuilder.js';
import type { IkeaProduct, PlacedFurnitureItem } from '../../../src/types/ikea.js';

describe('Tier 2: Feature 1 - Procedural 3D CAD Boundaries', () => {
  it('T2-F1-01: Zero/Near-Zero Dimensions Clamping', () => {
    const zeroProduct: IkeaProduct = {
      ...INITIAL_IKEA_CATALOG[0],
      id: 'zero-dims-prod',
      dimensionsCm: { width: 0, depth: 0, height: 0 },
    };

    const spec = buildParametric3DSpec(zeroProduct, '#ffffff', 'Default');

    assert.ok(spec.overallDimensionsMeters.width > 0, 'Width must clamp to positive default');
    assert.ok(spec.overallDimensionsMeters.height > 0, 'Height must clamp to positive default');
    assert.ok(spec.overallDimensionsMeters.depth > 0, 'Depth must clamp to positive default');

    for (const part of spec.parts) {
      assert.ok(!part.size.some(isNaN), `Part ${part.name} size has NaN`);
      assert.ok(!part.position.some(isNaN), `Part ${part.name} position has NaN`);
      assert.ok(part.size[0] > 0 && part.size[1] > 0 && part.size[2] > 0, `Part ${part.name} size must be positive`);
    }
  });

  it('T2-F1-02: Massive Architectural Scale (1,000 Meters)', () => {
    const giantProduct: IkeaProduct = {
      ...INITIAL_IKEA_CATALOG[0],
      id: 'giant-prod',
      dimensionsCm: { width: 100000, depth: 100000, height: 100000 },
    };

    const spec = buildParametric3DSpec(giantProduct, '#ffffff', 'Default');
    assert.equal(spec.overallDimensionsMeters.width, 1000);
    assert.equal(spec.overallDimensionsMeters.height, 1000);
    assert.equal(spec.overallDimensionsMeters.depth, 1000);

    const placedItem: PlacedFurnitureItem = {
      instanceId: 'giant-item',
      productId: giantProduct.id,
      product: giantProduct,
      swatchName: 'Default',
      swatchHex: '#ffffff',
      position: [0, 0, 0],
      rotationY: 0,
      spec3D: spec,
      roomId: 'room-living',
    };

    const group = buildFurnitureGroup(placedItem, false);
    assert.ok(group.children.length >= 20, 'Massive CAD scale must synthesize all sub-meshes cleanly');
  });

  it('T2-F1-03: Unknown Product Archetype Fallback', () => {
    const unknownProduct: IkeaProduct = {
      id: 'unknown-quantum',
      name: 'Quantum Pod',
      typeName: 'Experimental Seat',
      category: 'Sofas & Armchairs',
      archetype: 'quantum_couch' as any,
      articleNumber: '000.000.00',
      priceCzk: 9990,
      priceEur: 399,
      dimensionsCm: { width: 150, depth: 90, height: 80 },
      materialDescription: 'Composite nanomaterials',
      swatches: [{ name: 'Red', hex: '#FF0000' }],
    };

    const spec = buildParametric3DSpec(unknownProduct, '#ff0000', 'Red');
    assert.ok(spec.parts.length >= 20 && spec.parts.length <= 40, 'Unknown archetype should fall back to valid 20-40 parts');
  });

  it('T2-F1-04: Empty Swatches Array Handling', () => {
    const emptySwatchesProduct: IkeaProduct = {
      ...INITIAL_IKEA_CATALOG[0],
      id: 'no-swatches-prod',
      swatches: [],
    };

    const spec = buildParametric3DSpec(emptySwatchesProduct, '#ffffff', 'Default');
    assert.ok(spec.parts.length >= 20, 'Must generate valid spec despite empty swatches array');
    assert.ok(spec.parts.every((p) => p.colorHex && p.colorHex.startsWith('#')));
  });

  it('T2-F1-05: Negative Dimensions Normalization', () => {
    const negativeProduct: IkeaProduct = {
      ...INITIAL_IKEA_CATALOG[0],
      id: 'neg-dims-prod',
      dimensionsCm: { width: -120, depth: -80, height: -75 },
    };

    const spec = buildParametric3DSpec(negativeProduct, '#ffffff', 'Default');
    const placedItem: PlacedFurnitureItem = {
      instanceId: 'neg-item',
      productId: negativeProduct.id,
      product: negativeProduct,
      swatchName: 'Default',
      swatchHex: '#ffffff',
      position: [0, 0, 0],
      rotationY: 0,
      spec3D: spec,
      roomId: 'room-living',
    };

    // buildFurnitureGroup calls createPartGeometry which clamps part size: Math.max(0.008, ...)
    const group = buildFurnitureGroup(placedItem, false);
    assert.ok(group.children.length >= 20);
    for (const child of group.children as any[]) {
      if (child.isMesh && child.geometry) {
        assert.ok(child.geometry.getAttribute('position').count > 0, 'Geometry buffers must not be empty');
      }
    }
  });

  it('T2-F1-06: Special Characters and Emoji in Labels', () => {
    const specialProd: IkeaProduct = {
      ...INITIAL_IKEA_CATALOG[0],
      id: 'special-char-prod',
      name: 'KALLAX 🪑 <script>alert("xss")</script> & \'"`',
      dimensionsCm: { width: 147, depth: 39, height: 147 },
    };

    const spec = buildParametric3DSpec(specialProd, '#ffffff', 'Default');
    const placedItem: PlacedFurnitureItem = {
      instanceId: 'special-item',
      productId: specialProd.id,
      product: specialProd,
      swatchName: 'Default',
      swatchHex: '#ffffff',
      position: [0, 0, 0],
      rotationY: 0,
      spec3D: spec,
      roomId: 'room-living',
      isGenerating: true, // Triggers laser scan label rendering
    };

    assert.doesNotThrow(() => {
      const group = buildFurnitureGroup(placedItem, false);
      assert.ok(group.children.length > 0);
    });
  });
});
