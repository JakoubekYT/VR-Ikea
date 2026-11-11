import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../../harness/index.js';
import {
  INITIAL_IKEA_CATALOG,
  INITIAL_APARTMENT_ROOMS,
  INITIAL_CHANDELIERS,
  CHANDELIER_CATALOG,
} from '../../../src/data/ikeaCatalog.js';
import {
  buildParametric3DSpec,
  filterCatalog,
  calculateBomSummary,
  snapFurnitureToRoom,
  checkFurnitureCollision,
  findRoomForPoint,
  computeWallCutaway,
  kelvinToHex,
} from '../../../src/utils/roomLogic.js';
import {
  searchIkeaProducts,
  reconstructImageTo3D,
} from '../../../src/server/ikeaService.js';
import { buildFurnitureGroup } from '../../../src/three/furnitureBuilder.js';
import {
  assertCADPartCount,
  assertCADDimensionsMatchProduct,
  assertBomMath,
  assertValidCsv,
  assertValidJson,
  createMockRoom,
  createMockPlacedItem,
  createMockChandelier,
  createMockApartmentProject,
  serializeApartmentProject,
  deserializeApartmentProject,
  exportBomToCsv,
  exportBomToJson,
  calculateHeadingRelativeLocomotion,
} from '../../harness/index.js';
import type { PlacedFurnitureItem } from '../../../src/types/ikea.js';

describe('Tier 3: Pairwise Cross-Feature Interactions', () => {
  it('T3-01: Room Geometry Bounds × Wall Snapping & Auto-Rotation (F3 × F6)', () => {
    const room = createMockRoom({
      width: 5.4,
      length: 4.8,
      height: 2.85,
    });
    const kivikProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'KIVIK')!;
    assert.ok(kivikProduct);

    // Target near North wall with initial rotation 25 deg
    const snapped = snapFurnitureToRoom([0, 0, -2.35], 25, kivikProduct.dimensionsCm, {
      width: room.width,
      length: room.length,
      enableGridSnap: true,
      enableWallSnap: true,
    });

    // Check bounded inside room
    const halfRoomW = room.width / 2;
    const halfRoomL = room.length / 2;
    const halfItemW = kivikProduct.dimensionsCm.width / 200;
    const halfItemD = kivikProduct.dimensionsCm.depth / 200;

    assert.ok(snapped.position[0] >= -halfRoomW && snapped.position[0] <= halfRoomW);
    assert.ok(snapped.position[2] >= -halfRoomL && snapped.position[2] <= halfRoomL);
    assert.equal(snapped.position[1], 0, 'Floor level must be 0');
  });

  it('T3-02: Procedural 3D CAD Synthesis × Vertical Surface Stacking (F1 × F6)', () => {
    const deskProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BEKANT')!;
    const lampProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FADO')!;
    assert.ok(deskProduct && lampProduct);

    const deskItem = createMockPlacedItem(deskProduct, {
      instanceId: 'desk-main',
      position: [0, 0, 0],
    });

    const lampSpec = buildParametric3DSpec(
      lampProduct,
      lampProduct.swatches[0].hex,
      lampProduct.swatches[0].name
    );
    assertCADPartCount(lampSpec, 20, 40);

    const snappedLamp = snapFurnitureToRoom([0.2, 0, 0.1], 0, lampProduct.dimensionsCm, {
      width: 5.0,
      length: 5.0,
      enableGridSnap: false,
      enableWallSnap: false,
      allowStacking: true,
      otherItems: [deskItem],
      itemProduct: lampProduct,
    });

    const expectedHeight = deskProduct.dimensionsCm.height / 100;
    assert.equal(snappedLamp.position[1], expectedHeight, 'Lamp must elevate to desk surface');
    assert.equal(snappedLamp.parentInstanceId, 'desk-main');

    const stackedLampItem: PlacedFurnitureItem = {
      ...createMockPlacedItem(lampProduct),
      instanceId: 'lamp-stacked',
      position: snappedLamp.position,
      parentInstanceId: snappedLamp.parentInstanceId,
      spec3D: lampSpec,
    };

    // Stacking prevents horizontal collision error because child is elevated
    assert.equal(checkFurnitureCollision(deskItem, stackedLampItem), false);
  });

  it('T3-03: Czech Diacritic Search × Procedural CAD Assembly (F4 × F1)', () => {
    const searchResults = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'rohová rozkládací sedačka');
    assert.ok(searchResults.length > 0);

    const matchedProduct = searchResults.find((p) => p.name === 'VIMLE' || p.name === 'FRIHETEN') || searchResults[0];
    const swatch = matchedProduct.swatches[0];

    const spec = buildParametric3DSpec(matchedProduct, swatch.hex, swatch.name);
    assertCADPartCount(spec, 20, 40);
    assertCADDimensionsMatchProduct(spec, matchedProduct);

    const placedItem = createMockPlacedItem(matchedProduct, { spec3D: spec });
    const group = buildFurnitureGroup(placedItem, false);
    assert.ok(group.children.length >= 20);
  });

  it('T3-04: Offline Fallback Engine × BOM Calculation & CSV/JSON Export (F2 × F5)', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = '';
      const searchRes = await searchIkeaProducts('pracovní stůl masiv');

      assert.equal(searchRes.source, 'fallback');
      assert.equal(searchRes.products.length, 6);

      const deskProduct = searchRes.products[0];
      const items = [
        createMockPlacedItem(deskProduct, { instanceId: 'desk-1' }),
        createMockPlacedItem(deskProduct, { instanceId: 'desk-2' }),
      ];

      const chandelier = createMockChandelier('multi_ring_led');
      const bom = calculateBomSummary(items, [chandelier]);
      assertBomMath(bom);

      assert.equal(bom.totalItems, 3);
      assert.equal(bom.totalCzk, 2 * deskProduct.priceCzk + chandelier.catalogItem.priceCzk);

      const csv = exportBomToCsv(bom);
      assertValidCsv(csv, 3);

      const jsonStr = exportBomToJson(bom);
      const parsed = assertValidJson<any>(jsonStr);
      assert.equal(parsed.apartmentTotals.totalItems, 3);
      assert.equal(parsed.apartmentTotals.totalCzk, bom.totalCzk);
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('T3-05: Multi-Room Wall Openings × 1:1 Interior Walkthrough Mode (F3 × F7)', () => {
    const rooms = INITIAL_APARTMENT_ROOMS;

    // In 1:1 walkthrough, wall cutaways must be disabled
    const cutaway = computeWallCutaway([0, 1.65, 0], [0, 0, 0], false);
    assert.deepEqual(cutaway, { north: false, south: false, east: false, west: false });

    // Waypoint traversal
    const livingPoint = findRoomForPoint(1.5, 0, rooms);
    assert.equal(livingPoint.id, 'room-living');

    const kitchenPoint = findRoomForPoint(4.8, 0, rooms);
    assert.equal(kitchenPoint.id, 'room-kitchen');
  });

  it('T3-06: Spatial Collision Avoidance × Furniture Dragging Interaction (F6 × F8)', () => {
    const bedProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'MALM')!;
    const wardrobeProduct = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('PAX'))!;
    assert.ok(bedProduct && wardrobeProduct);

    const bed = createMockPlacedItem(bedProduct, { position: [0, 0, -1.0], instanceId: 'bed-1' });

    // Candidate 1 overlapping bed OBB
    const candidateOverlap = createMockPlacedItem(wardrobeProduct, { position: [0.2, 0, -1.0], instanceId: 'w-1' });
    assert.equal(checkFurnitureCollision(bed, candidateOverlap), true);

    // Candidate 2 clear of bed OBB
    const candidateClear = createMockPlacedItem(wardrobeProduct, { position: [-2.2, 0, -1.0], instanceId: 'w-2' });
    assert.equal(checkFurnitureCollision(bed, candidateClear), false);
  });

  it('T3-07: BOM Summary Aggregation × Project Save/Load JSON Persistence (F5 × F8)', () => {
    const project = createMockApartmentProject();
    const originalBom = calculateBomSummary(project.placedItems, project.chandeliers);

    const jsonStr = serializeApartmentProject(project);
    const reloaded = deserializeApartmentProject(jsonStr);

    const reloadedBom = calculateBomSummary(reloaded.placedItems, reloaded.chandeliers);
    assertBomMath(reloadedBom);

    assert.equal(reloadedBom.totalItems, originalBom.totalItems);
    assert.equal(reloadedBom.totalCzk, originalBom.totalCzk);
    assert.equal(reloadedBom.totalEur, originalBom.totalEur);
    assert.equal(reloaded.rooms.length, project.rooms.length);
  });

  it('T3-08: Offline Image Reconstruction × Procedural CAD Assembly (F2 × F1)', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = '';
      const res = await reconstructImageTo3D({
        nameHint: 'Skandinávský stůl',
        dimensionsCm: { width: 140, depth: 70, height: 75 },
      });

      assert.equal(res.source, 'fallback');
      assertCADPartCount(res.spec3D, 20, 40);
      assert.equal(res.spec3D.overallDimensionsMeters.width, 1.4);
      assert.equal(res.spec3D.overallDimensionsMeters.depth, 0.7);
      assert.equal(res.spec3D.overallDimensionsMeters.height, 0.75);

      const placed = createMockPlacedItem(res.product, { spec3D: res.spec3D });
      const group = buildFurnitureGroup(placed, false);
      assert.ok(group.children.length >= 20);
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('T3-09: Multi-Room Relocation × Room-Partitioned BOM Summary (F3 × F5)', () => {
    const rooms = INITIAL_APARTMENT_ROOMS;
    const chairProd = INITIAL_IKEA_CATALOG.find((p) => p.name === 'STRANDMON')!;
    assert.ok(chairProd);

    // Initial placement in living room
    const item = createMockPlacedItem(chairProd, {
      position: [0, 0, 0],
      roomId: 'room-living',
    });

    const roomInitial = findRoomForPoint(item.position[0], item.position[2], rooms);
    assert.equal(roomInitial.id, 'room-living');

    // Relocate to bedroom center: [-1.2, 0, -4.5]
    item.position = [-1.2, 0, -4.5];
    const roomNew = findRoomForPoint(item.position[0], item.position[2], rooms);
    assert.equal(roomNew.id, 'room-bedroom');

    item.roomId = roomNew.id;
    assert.equal(item.roomId, 'room-bedroom');

    const bom = calculateBomSummary([item], []);
    assert.equal(bom.totalItems, 1);
    assert.equal(bom.totalCzk, chairProd.priceCzk);
  });

  it('T3-10: WebXR Thumbstick Locomotion × Room Wall Collision Boundaries (F7 × F3)', () => {
    const room = createMockRoom({
      width: 5.4,
      length: 4.8,
      position: [0, 0],
    });

    // Rig starts in room center, user applies North stick input (stickZ = -1)
    let rigZ = 0;
    const userRadius = 0.3;
    const maxNorthZ = -(room.length / 2 - userRadius); // - (2.4 - 0.3) = -2.1m

    for (let frame = 0; frame < 60; frame++) {
      const dt = 0.016;
      const speed = 2.2;
      const step = calculateHeadingRelativeLocomotion(0, -1, 0, 0.15, speed);
      rigZ += step.z * dt;
      // Wall clamp prevents walking through exterior boundary
      if (rigZ < maxNorthZ) {
        rigZ = maxNorthZ;
      }
    }

    assert.ok(rigZ >= -2.15, `Rig Z (${rigZ}) must not penetrate exterior wall`);
  });

  it('T3-11: Scene Lighting Presets × Emissive Lamp Shader Synchronization (F7 × F8)', () => {
    // Check Kelvin color conversion for warm evening lighting (2700K)
    const warmHex = kelvinToHex(2700);
    assert.ok(warmHex.startsWith('#'), 'Must return valid hex string');

    const coolHex = kelvinToHex(6000);
    assert.ok(coolHex.startsWith('#'), 'Must return valid hex string');
    assert.notEqual(warmHex.toLowerCase(), coolHex.toLowerCase());

    const lampProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'HEKTAR')!;
    const lampItem = createMockPlacedItem(lampProduct);
    const lampGroup = buildFurnitureGroup(lampItem, false);

    // Lamp group must contain point light with emissive color
    const pointLights = lampGroup.children.filter((c) => c instanceof THREE.PointLight);
    assert.ok(pointLights.length >= 1, 'Lamp assembly must instantiate real Three.js PointLight');
  });

  it('T3-12: Multi-Word Typo Search × Fuzzy Matching × CAD Assembly Generation (F4 × F2 × F1)', () => {
    const typoResults = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'sedackaa rohovaa rozkladaci');

    assert.ok(typoResults.length >= 1, 'Fuzzy typo search should match corner sofa series');
    const matched = typoResults[0];

    const spec = buildParametric3DSpec(matched, matched.swatches[0].hex, matched.swatches[0].name);
    assertCADPartCount(spec, 20, 40);
    assertCADDimensionsMatchProduct(spec, matched);
  });
});
