import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import { buildParametric3DSpec } from '../../../src/utils/roomLogic.js';
import { buildFurnitureGroup } from '../../../src/three/furnitureBuilder.js';
import {
  assertCADPartCount,
  assertCADDimensionsMatchProduct,
  createMockPlacedItem,
} from '../../harness/index.js';

describe('Tier 1: Feature 1 - Procedural 3D CAD Synthesis', () => {
  it('T1-F1-01: Sofa 3-Seat CAD Decomposition (KIVIK)', () => {
    const product = INITIAL_IKEA_CATALOG.find((p) => p.name === 'KIVIK')!;
    assert.ok(product, 'KIVIK product must exist in catalog');

    const swatch = product.swatches.find((s) => s.hex.toLowerCase() === '#d8cfc2') || product.swatches[0];
    const spec = buildParametric3DSpec(product, swatch.hex, swatch.name);

    assertCADPartCount(spec, 20, 40);
    assertCADDimensionsMatchProduct(spec, product);
    assert.equal(spec.overallDimensionsMeters.width, 2.28);
    assert.equal(spec.overallDimensionsMeters.height, 0.83);
    assert.equal(spec.overallDimensionsMeters.depth, 0.95);

    const hasCushionsOrSeats = spec.parts.some(
      (p) => p.name.toLowerCase().includes('cushion') || p.name.toLowerCase().includes('seat')
    );
    assert.ok(hasCushionsOrSeats, 'Sofa spec must include seat cushions or back cushions');

    const hasFabricMaterial = spec.parts.some(
      (p) => p.materialType === 'boucle_fabric' || p.materialType === 'velvet' || p.materialType === 'leather'
    );
    assert.ok(hasFabricMaterial, 'Sofa spec must use upholstery fabric materials');
  });

  it('T1-F1-02: Bed Frame CAD Decomposition (MALM)', () => {
    const product = INITIAL_IKEA_CATALOG.find(
      (p) => p.name === 'MALM' && p.category === 'Beds & Mattresses'
    )!;
    assert.ok(product, 'MALM bed product must exist in catalog');

    const swatch = product.swatches[0];
    const spec = buildParametric3DSpec(product, swatch.hex, swatch.name);

    assertCADPartCount(spec, 20, 40);
    assertCADDimensionsMatchProduct(spec, product);
    assert.equal(spec.overallDimensionsMeters.width, 1.76);
    assert.equal(spec.overallDimensionsMeters.height, 1.0);
    assert.equal(spec.overallDimensionsMeters.depth, 2.09);

    const hasBedStructure = spec.parts.some(
      (p) => p.name.toLowerCase().includes('headboard') || p.name.toLowerCase().includes('frame') || p.name.toLowerCase().includes('rail')
    );
    assert.ok(hasBedStructure, 'Bed spec must include headboard or frame components');
    assert.ok(spec.parts.some((p) => p.shape === 'rounded_box'), 'Bed parts should include rounded_box shapes');
  });

  it('T1-F1-03: Storage & Shelving Decomposition (KALLAX)', () => {
    const product = INITIAL_IKEA_CATALOG.find((p) => p.name === 'KALLAX')!;
    assert.ok(product, 'KALLAX product must exist in catalog');

    const swatch = product.swatches.find((s) => s.name.toLowerCase().includes('black')) || product.swatches[0];
    const spec = buildParametric3DSpec(product, swatch.hex, swatch.name);

    assertCADPartCount(spec, 20, 40);
    assertCADDimensionsMatchProduct(spec, product);
    assert.equal(spec.overallDimensionsMeters.width, 1.47);
    assert.equal(spec.overallDimensionsMeters.height, 1.47);
    assert.equal(spec.overallDimensionsMeters.depth, 0.39);

    const hasShelvesOrDividers = spec.parts.some(
      (p) => p.name.toLowerCase().includes('shelf') || p.name.toLowerCase().includes('divider') || p.name.toLowerCase().includes('frame')
    );
    assert.ok(hasShelvesOrDividers, 'Storage unit must contain shelves or divider components');
  });

  it('T1-F1-04: Tables & Desks Decomposition (LISABO)', () => {
    const product = INITIAL_IKEA_CATALOG.find((p) => p.name === 'LISABO')!;
    assert.ok(product, 'LISABO product must exist in catalog');

    const swatch = product.swatches[0];
    const spec = buildParametric3DSpec(product, swatch.hex, swatch.name);

    assertCADPartCount(spec, 20, 40);
    assertCADDimensionsMatchProduct(spec, product);
    assert.equal(spec.overallDimensionsMeters.width, 1.4);
    assert.equal(spec.overallDimensionsMeters.height, 0.74);
    assert.equal(spec.overallDimensionsMeters.depth, 0.78);

    const hasTop = spec.parts.some((p) => p.name.toLowerCase().includes('top') || p.name.toLowerCase().includes('tabletop'));
    assert.ok(hasTop, 'Table spec must include tabletop');

    const legs = spec.parts.filter((p) => p.name.toLowerCase().includes('leg'));
    assert.ok(legs.length >= 4, 'Table spec must have at least 4 leg sub-parts');
  });

  it('T1-F1-05: Floor Lamp CAD Decomposition with Emissive Light (HEKTAR)', () => {
    const product = INITIAL_IKEA_CATALOG.find((p) => p.name === 'HEKTAR')!;
    assert.ok(product, 'HEKTAR lamp product must exist in catalog');

    const swatch = product.swatches[0];
    const spec = buildParametric3DSpec(product, swatch.hex, swatch.name);

    assertCADPartCount(spec, 20, 40);
    assertCADDimensionsMatchProduct(spec, product);

    const hasEmissive = spec.parts.some(
      (p) => p.materialType === 'emissive_lamp' || p.materialType === 'emissive_light'
    );
    assert.ok(hasEmissive, 'Lamp CAD spec must contain an emissive lamp light sub-part');

    const hasCurvedShapes = spec.parts.some(
      (p) => p.shape === 'cone' || p.shape === 'cylinder' || p.shape === 'sphere'
    );
    assert.ok(hasCurvedShapes, 'Lamp CAD spec must feature cylindrical or conical geometric elements');
  });

  it('T1-F1-06: Three.js Geometry Construction & Mesh Group (buildFurnitureGroup)', () => {
    const product = INITIAL_IKEA_CATALOG.find((p) => p.name === 'KIVIK')!;
    const item = createMockPlacedItem(product);

    const group = buildFurnitureGroup(item, true);

    assert.equal(group.name, `furniture_${item.instanceId}`);
    assert.ok(group.userData.isFurnitureGroup, 'Group userData.isFurnitureGroup must be true');
    assert.equal(group.userData.instanceId, item.instanceId);

    // Selected state should include parts + selection box + rotation gizmo
    assert.ok(
      group.children.length >= item.spec3D.parts.length,
      `Expected children length (${group.children.length}) >= parts length (${item.spec3D.parts.length})`
    );

    const hasGizmo = group.children.some(
      (c) => c.name === 'gizmo_world_aligned' || c.userData?.isRotationGizmo === true
    );
    assert.ok(hasGizmo, 'Selected furniture group must contain rotation compass or transform gizmo');
  });
});
