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
  createMockRoom,
  createMockPlacedItem,
  createMockChandelier,
  serializeApartmentProject,
  deserializeApartmentProject,
  exportBomToCsv,
  type ApartmentProjectState,
} from '../../harness/index.js';
import type { ApartmentRoom, PlacedFurnitureItem } from '../../../src/types/ikea.js';

describe('Tier 4: Scenario 2 - 2-Bedroom Family Flat (78 m²)', () => {
  it('T4-S02: End-to-End Workflow for 2-Bedroom Family Flat', () => {
    // 1. Construct 4-room layout (Living, Kitchen, Master Bed, Kids Room)
    const rooms: ApartmentRoom[] = [
      createMockRoom({
        id: 'room-living',
        name: 'Living Room',
        roomType: 'Living Room',
        position: [0, 0],
        width: 5.4,
        length: 4.8,
        height: 2.85,
        floorFinish: 'Oak Parquet',
      }),
      createMockRoom({
        id: 'room-kitchen',
        name: 'Kitchen & Dining',
        roomType: 'Kitchen',
        position: [4.8, 0],
        width: 4.2,
        length: 4.8,
        height: 2.85,
        floorFinish: 'Marble Tiles',
      }),
      createMockRoom({
        id: 'room-master',
        name: 'Master Bedroom',
        roomType: 'Bedroom',
        position: [0, -4.4],
        width: 4.8,
        length: 4.0,
        height: 2.85,
        floorFinish: 'Walnut Herringbone',
      }),
      createMockRoom({
        id: 'room-kids',
        name: 'Kids & Guest Room',
        roomType: 'Bedroom',
        position: [4.2, -4.4],
        width: 3.6,
        length: 4.0,
        height: 2.85,
        floorFinish: 'Carpet',
      }),
    ];

    const aptGroup = buildApartmentArchitecture(rooms, 'room-living', [0, 5, 8], [0, 0, 0], false, false);
    assert.equal(aptGroup.children.length, 4, 'Apartment scene graph must build all 4 rooms');

    // 2. Select authentic products across categories
    const kivik = INITIAL_IKEA_CATALOG.find((p) => p.name === 'KIVIK')!;
    const strandmon = INITIAL_IKEA_CATALOG.find((p) => p.name === 'STRANDMON')!;
    const besta = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BESTÅ')!;
    const lack = INITIAL_IKEA_CATALOG.find((p) => p.name === 'LACK')!;
    const rug = INITIAL_IKEA_CATALOG.find((p) => p.name === 'STOENSE') || INITIAL_IKEA_CATALOG[0];

    const lisabo = INITIAL_IKEA_CATALOG.find((p) => p.name === 'LISABO')!;
    const odger = INITIAL_IKEA_CATALOG.find((p) => p.name === 'ODGER')!;
    const tornviken = INITIAL_IKEA_CATALOG.find((p) => p.name === 'TORNVIKEN') || INITIAL_IKEA_CATALOG[1];

    const malm = INITIAL_IKEA_CATALOG.find((p) => p.name === 'MALM' && p.category === 'Beds & Mattresses')!;
    const pax = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('PAX')) || INITIAL_IKEA_CATALOG[2];

    const micke = INITIAL_IKEA_CATALOG.find((p) => p.name === 'MICKE')!;
    const hemnes = INITIAL_IKEA_CATALOG.find((p) => p.name === 'HEMNES') || INITIAL_IKEA_CATALOG[0];

    // 3. Furnish Living Room (5 items)
    const livingItems: PlacedFurnitureItem[] = [
      createMockPlacedItem(kivik, { instanceId: 'liv-sofa', position: [0, 0, -1.5], roomId: 'room-living' }),
      createMockPlacedItem(strandmon, { instanceId: 'liv-armchair', position: [-1.8, 0, 0], roomId: 'room-living' }),
      createMockPlacedItem(besta, { instanceId: 'liv-tv', position: [0, 0, 1.8], roomId: 'room-living' }),
      createMockPlacedItem(lack, { instanceId: 'liv-coffee', position: [0, 0, 0], roomId: 'room-living' }),
      createMockPlacedItem(rug, { instanceId: 'liv-rug', position: [0, 0, -0.5], roomId: 'room-living' }),
    ];

    // 4. Furnish Kitchen & Dining (6 items: dining table + 4 chairs + island)
    const kitchenItems: PlacedFurnitureItem[] = [
      createMockPlacedItem(lisabo, { instanceId: 'kit-table', position: [4.8, 0, 0], roomId: 'room-kitchen' }),
      createMockPlacedItem(odger, { instanceId: 'kit-ch1', position: [4.2, 0, 0], roomId: 'room-kitchen' }),
      createMockPlacedItem(odger, { instanceId: 'kit-ch2', position: [5.4, 0, 0], roomId: 'room-kitchen' }),
      createMockPlacedItem(odger, { instanceId: 'kit-ch3', position: [4.8, 0, -0.6], roomId: 'room-kitchen' }),
      createMockPlacedItem(odger, { instanceId: 'kit-ch4', position: [4.8, 0, 0.6], roomId: 'room-kitchen' }),
      createMockPlacedItem(tornviken, { instanceId: 'kit-island', position: [4.8, 0, 1.6], roomId: 'room-kitchen' }),
    ];

    // 5. Furnish Master Bedroom (2 items: bed + wardrobe)
    const masterItems: PlacedFurnitureItem[] = [
      createMockPlacedItem(malm, { instanceId: 'm-bed', position: [0, 0, -5.0], roomId: 'room-master' }),
      createMockPlacedItem(pax, { instanceId: 'm-pax', position: [1.8, 0, -3.8], roomId: 'room-master' }),
    ];

    // 6. Furnish Kids Room (2 items: daybed + study desk)
    const kidsItems: PlacedFurnitureItem[] = [
      createMockPlacedItem(hemnes, { instanceId: 'k-bed', position: [4.2, 0, -5.2], roomId: 'room-kids' }),
      createMockPlacedItem(micke, { instanceId: 'k-desk', position: [4.2, 0, -3.8], roomId: 'room-kids' }),
    ];

    const allPlacedItems = [...livingItems, ...kitchenItems, ...masterItems, ...kidsItems];
    assert.equal(allPlacedItems.length, 15);

    // Verify room assignment via findRoomForPoint
    for (const item of allPlacedItems) {
      const detectedRoom = findRoomForPoint(item.position[0], item.position[2], rooms);
      assert.equal(
        detectedRoom.id,
        item.roomId,
        `Item ${item.product.name} at [${item.position[0]}, ${item.position[2]}] mapped to wrong room`
      );
    }

    // 7. Mount ceiling lighting in 3 rooms
    const chandeliers = [
      createMockChandelier('multi_ring_led', { instanceId: 'chan-living', position: [0, 2.85, 0], roomId: 'room-living' }),
      createMockChandelier('glass_globe_cluster', { instanceId: 'chan-kitchen', position: [4.8, 2.85, 0], roomId: 'room-kitchen' }),
      createMockChandelier('woven_pendant', { instanceId: 'chan-master', position: [0, 2.85, -4.4], roomId: 'room-master' }),
    ];

    // 8. Calculate total BOM
    const bom = calculateBomSummary(allPlacedItems, chandeliers);
    assertBomMath(bom);
    assert.equal(bom.totalItems, 18, 'Expected 15 furniture + 3 chandeliers = 18 total items');
    assert.ok(bom.totalCzk > 50000, 'Family flat budget should exceed 50k CZK');

    // 9. Export BOM to CSV
    const csv = exportBomToCsv(bom);
    assertValidCsv(csv, 10);

    // 10. Save and restore project JSON state
    const projectState: ApartmentProjectState = {
      version: 3,
      exportedAt: new Date().toISOString(),
      rooms,
      placedItems: allPlacedItems,
      chandeliers,
      metadata: {
        appName: 'IKEA Space Planner VR',
        lightingPreset: 'Studio Daylight',
        activeRoomId: 'room-living',
      },
    };

    const serialized = serializeApartmentProject(projectState);
    const restored = deserializeApartmentProject(serialized);

    assert.equal(restored.rooms.length, 4);
    assert.equal(restored.placedItems.length, 15);
    assert.equal(restored.chandeliers.length, 3);
  });
});
