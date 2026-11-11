import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import {
  snapFurnitureToRoom,
  checkFurnitureCollision,
} from '../../../src/utils/roomLogic.js';
import {
  assertCollision,
  assertNoCollision,
  createMockPlacedItem,
} from '../../harness/index.js';

describe('Tier 1: Feature 6 - Spatial Collision, Stacking & Wall Snapping', () => {
  const roomDimensions = { width: 5.0, length: 5.0 };
  const standardDims = { width: 100, depth: 80, height: 75 };

  it('T1-F6-01: 5cm Architectural Grid Snapping', () => {
    const localPos: [number, number, number] = [0.03, 0, 0.04];
    const res = snapFurnitureToRoom(localPos, 0, standardDims, {
      ...roomDimensions,
      enableGridSnap: true,
      enableWallSnap: false,
    });

    assert.equal(res.position[0], 0.05, 'X coordinate should round to nearest 0.05m');
    assert.equal(res.position[2], 0.05, 'Z coordinate should round to nearest 0.05m');
    assert.equal(res.position[1], 0, 'Y elevation defaults to floor level 0');
  });

  it('T1-F6-02: Room Perimeter Clamping', () => {
    // Room is 4x4m (halfW = 2.0, halfL = 2.0). Item is 100x80cm (halfItemW = 0.5, halfItemD = 0.4).
    // Wall pad is 0.02. Max X = 2.0 - 0.5 - 0.02 = 1.48m. Max Z = 2.0 - 0.4 - 0.02 = 1.58m.
    const res = snapFurnitureToRoom([10, 0, 10], 0, standardDims, {
      width: 4.0,
      length: 4.0,
      enableGridSnap: false,
      enableWallSnap: false,
    });

    assert.equal(res.position[0], 1.48, 'X should clamp within room perimeter');
    assert.equal(res.position[2], 1.58, 'Z should clamp within room perimeter');
  });

  it('T1-F6-03: Magnetic Wall Snapping within 0.28m Threshold', () => {
    // Room is 4x4m (maxZ = 1.58m). Drag item to z = -1.50m (within 0.28m from North wall at -1.58m).
    const res = snapFurnitureToRoom([0, 0, -1.5], 0, standardDims, {
      width: 4.0,
      length: 4.0,
      enableGridSnap: false,
      enableWallSnap: true,
    });

    assert.equal(res.position[2], -1.58, 'Item should snap flush to the North wall');
  });

  it('T1-F6-04: Rotated Bounding Box Extent Calculation', () => {
    // When rotated 90 degrees, width and depth swap roles in XZ extent
    // Item width=100cm, depth=80cm. At 90 deg, extentX is based on depth (0.8m) -> half is 0.4m
    // In a 4x4m room: maxX = 2.0 - 0.4 - 0.02 = 1.58m
    const res = snapFurnitureToRoom([10, 0, 0], 90, standardDims, {
      width: 4.0,
      length: 4.0,
      enableGridSnap: false,
      enableWallSnap: false,
    });

    assert.equal(res.position[0], 1.58, 'Rotated 90 deg item X clamp uses depth half-extent');
    assert.equal(res.rotationY, 90);
  });

  it('T1-F6-05: Vertical Surface Stacking on Desks/Tables', () => {
    const bekantProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BEKANT')!;
    const fadoProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FADO')!;
    assert.ok(bekantProduct && fadoProduct);

    // Place BEKANT desk at [0, 0, 0] in room
    const deskItem = createMockPlacedItem(bekantProduct, {
      position: [0, 0, 0],
      instanceId: 'desk-1',
    });

    // Attempt to place FADO lamp directly over desk footprint
    const snapResult = snapFurnitureToRoom([0.2, 0, 0.1], 0, fadoProduct.dimensionsCm, {
      width: 5.0,
      length: 5.0,
      enableGridSnap: false,
      enableWallSnap: false,
      allowStacking: true,
      otherItems: [deskItem],
      itemProduct: fadoProduct,
    });

    const expectedTableHeight = bekantProduct.dimensionsCm.height / 100;
    assert.equal(
      snapResult.position[1],
      expectedTableHeight,
      `Lamp Y elevation (${snapResult.position[1]}m) should equal desk surface height (${expectedTableHeight}m)`
    );
    assert.equal(snapResult.parentInstanceId, 'desk-1', 'Child item parentInstanceId must point to desk');
  });

  it('T1-F6-06: Oriented Bounding Box (OBB / SAT) Collision Detection', () => {
    const kivikProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'KIVIK')!;
    const bekantProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BEKANT')!;

    // Overlapping items
    const itemA = createMockPlacedItem(kivikProduct, { position: [0, 0, 0], instanceId: 'a' });
    const itemB = createMockPlacedItem(bekantProduct, { position: [0.3, 0, 0.2], instanceId: 'b' });

    assertCollision(itemA, itemB);

    // Separated items
    const itemC = createMockPlacedItem(bekantProduct, { position: [3.5, 0, 0], instanceId: 'c' });
    assertNoCollision(itemA, itemC);
  });
});
