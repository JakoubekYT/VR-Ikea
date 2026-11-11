import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import { snapFurnitureToRoom } from '../../../src/utils/roomLogic.js';
import { createMockPlacedItem } from '../../harness/index.js';

describe('Tier 2: Feature 6 - Spatial Physics Boundaries', () => {
  const standardDims = { width: 100, depth: 80, height: 75 };

  it('T2-F6-01: Snapping Options Completely Disabled', () => {
    const rawPos: [number, number, number] = [0.1234, 0, 0.5678];
    const res = snapFurnitureToRoom(rawPos, 0, standardDims, {
      width: 5.0,
      length: 5.0,
      enableGridSnap: false,
      enableWallSnap: false,
    });

    assert.equal(res.position[0], 0.1234, 'X coordinate must be preserved continuously');
    assert.equal(res.position[2], 0.5678, 'Z coordinate must be preserved continuously');
  });

  it('T2-F6-02: Furniture Item Larger than Room Bounds', () => {
    // 6m item in 3m room
    const giantDims = { width: 600, depth: 100, height: 80 };
    const res = snapFurnitureToRoom([2.5, 0, 0], 0, giantDims, {
      width: 3.0,
      length: 3.0,
      enableGridSnap: false,
      enableWallSnap: false,
    });

    assert.equal(res.position[0], 0, 'Item wider than room must clamp to center X = 0');
    assert.ok(!isNaN(res.position[0]));
    assert.ok(!isNaN(res.position[2]));
  });

  it('T2-F6-03: Extreme Out-of-Bounds Coordinates', () => {
    const res = snapFurnitureToRoom([1000, 0, 1000], 0, standardDims, {
      width: 4.0,
      length: 4.0,
      enableGridSnap: false,
      enableWallSnap: false,
    });

    assert.ok(res.position[0] <= 1.5, 'X clamped within room bound');
    assert.ok(res.position[2] <= 1.6, 'Z clamped within room bound');
    assert.ok(!isNaN(res.position[0]));
    assert.ok(!isNaN(res.position[2]));
  });

  it('T2-F6-04: Snapping at Arbitrary Non-Orthogonal Angle (33°)', () => {
    const res = snapFurnitureToRoom([1.5, 0, 1.5], 33, standardDims, {
      width: 4.0,
      length: 4.0,
      enableGridSnap: false,
      enableWallSnap: false,
    });

    assert.ok(res.position[0] <= 1.5);
    assert.ok(res.position[2] <= 1.6);
    assert.equal(res.rotationY, 33);
  });

  it('T2-F6-05: Invalid Stacking Attempt on Non-Surface Item', () => {
    const lampProduct =
      INITIAL_IKEA_CATALOG.find((p) => p.archetype === 'floor_lamp' || p.name === 'HEKTAR') ||
      INITIAL_IKEA_CATALOG[4];
    const wardrobeProduct =
      INITIAL_IKEA_CATALOG.find((p) => p.archetype === 'pax_wardrobe' || p.name.includes('PAX')) ||
      INITIAL_IKEA_CATALOG[2];
    assert.ok(lampProduct && wardrobeProduct, 'Both lamp and wardrobe products must exist');

    // Place lamp on floor
    const lampItem = createMockPlacedItem(lampProduct, {
      position: [0, 0, 0],
      instanceId: 'lamp-target',
    });

    // Attempt to stack heavy wardrobe onto floor lamp
    const res = snapFurnitureToRoom([0, 0, 0], 0, wardrobeProduct.dimensionsCm, {
      width: 5.0,
      length: 5.0,
      enableGridSnap: false,
      enableWallSnap: false,
      allowStacking: true,
      otherItems: [lampItem],
      itemProduct: wardrobeProduct,
    });

    assert.equal(res.position[1], 0, 'Wardrobe cannot stack on lamp, must remain at y = 0');
    assert.equal(res.parentInstanceId, undefined);
  });

  it('T2-F6-06: Zero-Sized Room Handling', () => {
    const res = snapFurnitureToRoom([1, 0, 1], 0, standardDims, {
      width: 0,
      length: 0,
      enableGridSnap: true,
      enableWallSnap: true,
    });

    assert.deepEqual(res.position, [0, 0, 0]);
    assert.ok(!isNaN(res.position[0]));
    assert.ok(!isNaN(res.position[2]));
  });
});
