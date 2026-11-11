import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import {
  buildParametric3DSpec,
  calculateBomSummary,
  findRoomForPoint,
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
import type { ApartmentRoom, PlacedFurnitureItem } from '../../../src/types/ikea.js';

describe('Tier 4: Scenario 5 - Multi-Room Luxury Penthouse Suite (110 m², 5 Rooms)', () => {
  it('T4-S05: End-to-End Workflow for Multi-Room Luxury Penthouse', () => {
    // 1. Construct 5-room penthouse floorplan (110 m²)
    const rooms: ApartmentRoom[] = [
      createMockRoom({
        id: 'room-living',
        name: 'Grand Living Pavilion',
        roomType: 'Living Room',
        position: [0, 0],
        width: 7.2,
        length: 6.0,
        height: 3.0,
        floorFinish: 'Walnut Herringbone',
      }),
      createMockRoom({
        id: 'room-kitchen',
        name: 'Gourmet Kitchen',
        roomType: 'Kitchen',
        position: [6.0, 0],
        width: 4.8,
        length: 4.5,
        height: 3.0,
        floorFinish: 'Polished Concrete',
      }),
      createMockRoom({
        id: 'room-master',
        name: 'Master Suite',
        roomType: 'Bedroom',
        position: [0, -5.3],
        width: 5.5,
        length: 4.6,
        height: 3.0,
        floorFinish: 'Carpet',
      }),
      createMockRoom({
        id: 'room-spa',
        name: 'Spa Bathroom',
        roomType: 'Bathroom',
        position: [4.55, -5.3],
        width: 3.6,
        length: 3.2,
        height: 3.0,
        floorFinish: 'Marble Tiles',
      }),
      createMockRoom({
        id: 'room-hallway',
        name: 'Gallery Hallway',
        roomType: 'Hallway',
        position: [-0.6, 4.0],
        width: 6.0,
        length: 2.0,
        height: 3.0,
        floorFinish: 'Oak Parquet',
      }),
    ];

    const aptGroup = buildApartmentArchitecture(rooms, 'room-living', [0, 6, 8], [0, 0, 0], false, false);
    assert.equal(aptGroup.children.length, 5, 'Penthouse layout must assemble all 5 rooms');

    // 2. Schedule 22 distinct furniture items across all 5 rooms
    const sofaProd = INITIAL_IKEA_CATALOG.find((p) => p.name === 'KIVIK' || p.name === 'VIMLE')!;
    const chairProd = INITIAL_IKEA_CATALOG.find((p) => p.name === 'STRANDMON')!;
    const coffeeProd = INITIAL_IKEA_CATALOG.find((p) => p.name === 'LACK')!;
    const tvProd = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BESTÅ')!;
    const rugProd = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('STOENSE')) || INITIAL_IKEA_CATALOG[0];

    const islandProd = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('TORNVIKEN')) || INITIAL_IKEA_CATALOG[1];
    const tableProd = INITIAL_IKEA_CATALOG.find((p) => p.name === 'LISABO')!;
    const dinChairProd = INITIAL_IKEA_CATALOG.find((p) => p.name === 'ODGER')!;

    const bedProd = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('MALM') || p.name.includes('IDANÄS'))!;
    const wardrobeProd = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('PAX')) || INITIAL_IKEA_CATALOG[2];

    const mirrorProd = INITIAL_IKEA_CATALOG.find((p) => p.archetype === 'mirror') || INITIAL_IKEA_CATALOG[3];
    const bookcaseProd = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BILLY')!;
    const lampProd = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FADO')!;

    const placedItems: PlacedFurnitureItem[] = [
      // Grand Living (6 items)
      createMockPlacedItem(sofaProd, { instanceId: 'p-liv-sofa', position: [0, 0, -1.5], roomId: 'room-living' }),
      createMockPlacedItem(chairProd, { instanceId: 'p-liv-ch1', position: [-2.0, 0, 0], roomId: 'room-living' }),
      createMockPlacedItem(chairProd, { instanceId: 'p-liv-ch2', position: [2.0, 0, 0], roomId: 'room-living' }),
      createMockPlacedItem(coffeeProd, { instanceId: 'p-liv-tab', position: [0, 0, 0], roomId: 'room-living' }),
      createMockPlacedItem(tvProd, { instanceId: 'p-liv-tv', position: [0, 0, 2.2], roomId: 'room-living' }),
      createMockPlacedItem(rugProd, { instanceId: 'p-liv-rug', position: [0, 0, -0.6], roomId: 'room-living' }),

      // Gourmet Kitchen (8 items)
      createMockPlacedItem(islandProd, { instanceId: 'p-kit-isl', position: [6.0, 0, 1.4], roomId: 'room-kitchen' }),
      createMockPlacedItem(tableProd, { instanceId: 'p-kit-tab', position: [6.0, 0, -0.8], roomId: 'room-kitchen' }),
      createMockPlacedItem(dinChairProd, { instanceId: 'p-kit-c1', position: [5.4, 0, -0.8], roomId: 'room-kitchen' }),
      createMockPlacedItem(dinChairProd, { instanceId: 'p-kit-c2', position: [6.6, 0, -0.8], roomId: 'room-kitchen' }),
      createMockPlacedItem(dinChairProd, { instanceId: 'p-kit-c3', position: [6.0, 0, -1.4], roomId: 'room-kitchen' }),
      createMockPlacedItem(dinChairProd, { instanceId: 'p-kit-c4', position: [6.0, 0, -0.2], roomId: 'room-kitchen' }),
      createMockPlacedItem(dinChairProd, { instanceId: 'p-kit-c5', position: [5.4, 0, -1.4], roomId: 'room-kitchen' }),
      createMockPlacedItem(dinChairProd, { instanceId: 'p-kit-c6', position: [6.6, 0, -1.4], roomId: 'room-kitchen' }),

      // Master Suite (4 items)
      createMockPlacedItem(bedProd, { instanceId: 'p-mas-bed', position: [0, 0, -5.5], roomId: 'room-master' }),
      createMockPlacedItem(coffeeProd, { instanceId: 'p-mas-side1', position: [-1.4, 0, -5.5], roomId: 'room-master' }),
      createMockPlacedItem(coffeeProd, { instanceId: 'p-mas-side2', position: [1.4, 0, -5.5], roomId: 'room-master' }),
      createMockPlacedItem(wardrobeProd, { instanceId: 'p-mas-pax', position: [2.0, 0, -4.2], roomId: 'room-master' }),

      // Spa Bathroom (2 items)
      createMockPlacedItem(mirrorProd, { instanceId: 'p-spa-mir', position: [4.55, 1.4, -4.0], roomId: 'room-spa' }),
      createMockPlacedItem(tableProd, { instanceId: 'p-spa-vanity', position: [4.55, 0, -4.0], roomId: 'room-spa' }),

      // Gallery Hallway (2 items)
      createMockPlacedItem(bookcaseProd, { instanceId: 'p-hal-bk', position: [-0.6, 0, 4.6], roomId: 'room-hallway' }),
      createMockPlacedItem(lampProd, { instanceId: 'p-hal-lamp', position: [1.5, 0, 4.0], roomId: 'room-hallway' }),
    ];

    assert.equal(placedItems.length, 22);

    // 3. Mount 5 ceiling chandeliers across all 5 rooms
    const chandeliers = [
      createMockChandelier('multi_ring_led', { instanceId: 'chan-1', position: [0, 3.0, 0], roomId: 'room-living' }),
      createMockChandelier('recessed_spotlights', { instanceId: 'chan-2', position: [6.0, 3.0, 0], roomId: 'room-kitchen' }),
      createMockChandelier('woven_pendant', { instanceId: 'chan-3', position: [0, 3.0, -5.3], roomId: 'room-master' }),
      createMockChandelier('recessed_spotlights', { instanceId: 'chan-4', position: [4.55, 3.0, -5.3], roomId: 'room-spa' }),
      createMockChandelier('geodesic_chandelier', { instanceId: 'chan-5', position: [-0.6, 3.0, 4.0], roomId: 'room-hallway' }),
    ];
    assert.equal(chandeliers.length, 5);

    // 4. Verify continuous walkthrough trajectory traverses all 5 rooms
    const trajectoryWaypoints: [number, number][] = [
      [-0.6, 4.0],  // Gallery Hallway
      [0.0, 0.0],   // Grand Living
      [6.0, 0.0],   // Gourmet Kitchen
      [0.0, -5.3],  // Master Suite
      [4.55, -5.3], // Spa Bathroom
    ];

    const visitedRoomIds = trajectoryWaypoints.map(([x, z]) => findRoomForPoint(x, z, rooms).id);
    assert.deepEqual(visitedRoomIds, ['room-hallway', 'room-living', 'room-kitchen', 'room-master', 'room-spa']);

    // 5. Calculate Penthouse BOM Summary
    const bom = calculateBomSummary(placedItems, chandeliers);
    assertBomMath(bom);
    assert.equal(bom.totalItems, 27, '22 furniture + 5 chandeliers = 27 items');
    assert.ok(bom.totalCzk > 70000, 'Luxury Penthouse budget must exceed 70k CZK');
    assert.ok(bom.totalEur > 2500, 'EUR total must be computed');

    // 6. Multi-format export
    const csv = exportBomToCsv(bom);
    assertValidCsv(csv, 15);

    const jsonStr = exportBomToJson(bom, rooms);
    const parsedBom = assertValidJson<any>(jsonStr);
    assert.equal(parsedBom.apartmentTotals.totalItems, 27);
    assert.equal(parsedBom.roomsCount, 5);

    // 7. Full project state serialization & deserialization stress test
    const project: ApartmentProjectState = {
      version: 3,
      exportedAt: new Date().toISOString(),
      rooms,
      placedItems,
      chandeliers,
      metadata: {
        appName: 'IKEA Space Planner VR',
        lightingPreset: 'Cozy Evening Lamps',
        activeRoomId: 'room-living',
      },
    };

    const projectJson = serializeApartmentProject(project);
    const restored = deserializeApartmentProject(projectJson);

    assert.equal(restored.rooms.length, 5);
    assert.equal(restored.placedItems.length, 22);
    assert.equal(restored.chandeliers.length, 5);
    assert.equal(restored.metadata?.activeRoomId, 'room-living');
  });
});
