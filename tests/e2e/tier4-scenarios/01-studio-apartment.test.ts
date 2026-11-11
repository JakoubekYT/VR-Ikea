import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import {
  buildParametric3DSpec,
  filterCatalog,
  calculateBomSummary,
  snapFurnitureToRoom,
  checkFurnitureCollision,
} from '../../../src/utils/roomLogic.js';
import { buildApartmentArchitecture } from '../../../src/three/roomArchitectureBuilder.js';
import {
  assertCADPartCount,
  assertBomMath,
  assertValidCsv,
  assertValidJson,
  createMockRoom,
  createMockWallOpening,
  createMockPlacedItem,
  createMockChandelier,
  serializeApartmentProject,
  deserializeApartmentProject,
  exportBomToCsv,
  exportBomToJson,
  type ApartmentProjectState,
} from '../../harness/index.js';
import type { PlacedFurnitureItem } from '../../../src/types/ikea.js';

describe('Tier 4: Scenario 1 - Compact Nordic Studio Apartment (32 m²)', () => {
  it('T4-S01: End-to-End Workflow for Compact Nordic Studio', () => {
    // 1. Define 32 m² studio room (6.4m x 5.0m x 2.7m) with 3 wall openings
    const openings = [
      createMockWallOpening({
        id: 'win-north',
        wall: 'north',
        type: 'Double Casement Window',
        width: 2.0,
        height: 1.45,
        sillHeight: 0.85,
        offset: 0.0,
      }),
      createMockWallOpening({
        id: 'door-south',
        wall: 'south',
        type: 'Door',
        width: 1.0,
        height: 2.15,
        sillHeight: 0.0,
        offset: -1.5,
      }),
      createMockWallOpening({
        id: 'balcony-west',
        wall: 'west',
        type: 'Floor-to-Ceiling Balcony Glazing',
        width: 2.4,
        height: 2.45,
        sillHeight: 0.0,
        offset: 0.5,
      }),
    ];

    const studioRoom = createMockRoom({
      id: 'room-studio',
      name: 'Nordic Studio Flat',
      roomType: 'Living Room',
      width: 6.4,
      length: 5.0,
      height: 2.7,
      floorFinish: 'Oak Parquet',
      openings,
    });

    const aptGroup = buildApartmentArchitecture([studioRoom], studioRoom.id, [0, 5, 8], [0, 0, 0], false, false);
    assert.ok(aptGroup.children.length > 0);

    // 2. Search catalog for Scandinavian sofa-bed with Czech diacritic query
    const searchResults = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'rozkládací pohovka');
    assert.ok(searchResults.length > 0);
    const frihetenProduct = searchResults.find((p) => p.name === 'FRIHETEN') || INITIAL_IKEA_CATALOG[0];

    // Other studio furniture
    const lackProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'LACK')!;
    const mickeProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'MICKE')!;
    const odgerProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'ODGER')!;
    const fadoProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FADO')!;
    const billyProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BILLY')!;
    const rugProduct = INITIAL_IKEA_CATALOG.find((p) => p.name === 'STOENSE') || INITIAL_IKEA_CATALOG[0];

    // 3. Synthesize CAD specifications for all furniture
    const products = [frihetenProduct, lackProduct, mickeProduct, odgerProduct, fadoProduct, billyProduct, rugProduct];
    const specs = products.map((prod) => {
      const spec = buildParametric3DSpec(prod, prod.swatches[0].hex, prod.swatches[0].name);
      assertCADPartCount(spec, 20, 40);
      return spec;
    });

    // 4. Place items in studio floorplan with grid and wall snapping
    const sofaItem = createMockPlacedItem(frihetenProduct, {
      instanceId: 'item-sofa',
      position: [-1.8, 0, -1.5],
      rotationY: 0,
      spec3D: specs[0],
      roomId: studioRoom.id,
    });

    const coffeeTableItem = createMockPlacedItem(lackProduct, {
      instanceId: 'item-table',
      position: [-1.8, 0, 0.2],
      rotationY: 0,
      spec3D: specs[1],
      roomId: studioRoom.id,
    });

    const deskItem = createMockPlacedItem(mickeProduct, {
      instanceId: 'item-desk',
      position: [2.0, 0, -1.8],
      rotationY: 0,
      spec3D: specs[2],
      roomId: studioRoom.id,
    });

    const chairItem = createMockPlacedItem(odgerProduct, {
      instanceId: 'item-chair',
      position: [2.0, 0, -1.1],
      rotationY: 180,
      spec3D: specs[3],
      roomId: studioRoom.id,
    });

    // 5. Stack FADO table lamp onto MICKE study desk
    const stackedSnap = snapFurnitureToRoom([2.0, 0, -1.8], 0, fadoProduct.dimensionsCm, {
      width: studioRoom.width,
      length: studioRoom.length,
      enableGridSnap: false,
      enableWallSnap: false,
      allowStacking: true,
      otherItems: [deskItem],
      itemProduct: fadoProduct,
    });

    const lampItem = createMockPlacedItem(fadoProduct, {
      instanceId: 'item-lamp',
      position: stackedSnap.position,
      parentInstanceId: stackedSnap.parentInstanceId,
      spec3D: specs[4],
      roomId: studioRoom.id,
    });
    assert.equal(lampItem.position[1], mickeProduct.dimensionsCm.height / 100);

    const bookcaseItem = createMockPlacedItem(billyProduct, {
      instanceId: 'item-bookcase',
      position: [2.6, 0, 1.2],
      rotationY: 90,
      spec3D: specs[5],
      roomId: studioRoom.id,
    });

    const rugItem = createMockPlacedItem(rugProduct, {
      instanceId: 'item-rug',
      position: [-1.8, 0, -0.6],
      rotationY: 0,
      spec3D: specs[6],
      roomId: studioRoom.id,
    });

    const placedItems = [sofaItem, coffeeTableItem, deskItem, chairItem, lampItem, bookcaseItem, rugItem];

    // Verify non-collision between primary floor pieces
    assert.equal(checkFurnitureCollision(sofaItem, coffeeTableItem), false);
    assert.equal(checkFurnitureCollision(deskItem, chairItem), false);
    assert.equal(checkFurnitureCollision(deskItem, bookcaseItem), false);
    // Stacking prevents desk-lamp collision
    assert.equal(checkFurnitureCollision(deskItem, lampItem), false);

    // 6. Mount ceiling chandelier
    const chandelier = createMockChandelier('multi_ring_led', {
      position: [0, studioRoom.height, 0],
      roomId: studioRoom.id,
    });

    // 7. Calculate BOM Summary
    const bom = calculateBomSummary(placedItems, [chandelier]);
    assertBomMath(bom);
    assert.equal(bom.totalItems, 8, 'Studio scenario must have 7 furniture + 1 chandelier = 8 items');
    assert.ok(bom.totalCzk > 0 && bom.totalEur > 0);

    // 8. Export to CSV & JSON
    const csv = exportBomToCsv(bom);
    assertValidCsv(csv, 8);

    const jsonStr = exportBomToJson(bom, [studioRoom]);
    const parsedBom = assertValidJson<any>(jsonStr);
    assert.equal(parsedBom.apartmentTotals.totalItems, 8);

    // 9. Full project JSON roundtrip persistence
    const project: ApartmentProjectState = {
      version: 3,
      exportedAt: new Date().toISOString(),
      rooms: [studioRoom],
      placedItems,
      chandeliers: [chandelier],
      metadata: {
        appName: 'IKEA Space Planner VR',
        lightingPreset: 'Nordic Morning Sun',
        activeRoomId: studioRoom.id,
      },
    };

    const projectJson = serializeApartmentProject(project);
    const restored = deserializeApartmentProject(projectJson);

    assert.equal(restored.rooms.length, 1);
    assert.equal(restored.placedItems.length, 7);
    assert.equal(restored.chandeliers.length, 1);
    assert.equal(restored.placedItems[4].parentInstanceId, 'item-desk');
  });
});
