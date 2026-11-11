import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import {
  buildParametric3DSpec,
  calculateBomSummary,
  checkFurnitureCollision,
} from '../../../src/utils/roomLogic.js';
import { buildApartmentArchitecture } from '../../../src/three/roomArchitectureBuilder.js';
import {
  assertCADPartCount,
  assertBomMath,
  assertValidCsv,
  createMockRoom,
  createMockWallOpening,
  createMockPlacedItem,
  createMockChandelier,
  serializeApartmentProject,
  deserializeApartmentProject,
  exportBomToCsv,
  type ApartmentProjectState,
} from '../../harness/index.js';
import type { ApartmentRoom, PlacedFurnitureItem } from '../../../src/types/ikea.js';

describe('Tier 4: Scenario 4 - Open-Concept Culinary Kitchen, Dining & Lounge (65 m²)', () => {
  it('T4-S04: End-to-End Workflow for Open-Concept Kitchen & Dining Space', () => {
    // 1. Build 65 m² open plan room (10.0m x 6.5m x 3.0m)
    const openings = [
      createMockWallOpening({ wall: 'north', offset: -2.5, width: 1.8, height: 1.45 }),
      createMockWallOpening({ wall: 'north', offset: 0.0, width: 1.8, height: 1.45 }),
      createMockWallOpening({ wall: 'north', offset: 2.5, width: 1.8, height: 1.45 }),
      createMockWallOpening({ wall: 'south', offset: -3.0, type: 'Door', width: 1.05, height: 2.15 }),
      createMockWallOpening({ wall: 'east', offset: 0.0, type: 'Floor-to-Ceiling Balcony Glazing', width: 3.2, height: 2.65 }),
    ];

    const openPlanRoom = createMockRoom({
      id: 'room-openplan',
      name: 'Open Culinary & Dining Lounge',
      width: 10.0,
      length: 6.5,
      height: 3.0,
      floorFinish: 'Marble Tiles',
      openings,
    });

    const aptGroup = buildApartmentArchitecture([openPlanRoom], openPlanRoom.id, [0, 5, 8], [0, 0, 0], false, false);
    assert.ok(aptGroup.children.length > 0);

    // 2. Select products
    const island = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('TORNVIKEN')) || INITIAL_IKEA_CATALOG[1];
    const cart = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('RÅSKOG') || p.name.includes('KUNGSFORS')) || INITIAL_IKEA_CATALOG[2];
    const diningTable = INITIAL_IKEA_CATALOG.find((p) => p.name === 'LISABO')!;
    const chair = INITIAL_IKEA_CATALOG.find((p) => p.name === 'ODGER')!;
    const vimle = INITIAL_IKEA_CATALOG.find((p) => p.name === 'VIMLE')!;
    const coffeeTable = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('STOCKHOLM') || p.name === 'LACK')!;
    const mirror = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('STOCKHOLM') && p.archetype === 'mirror') || INITIAL_IKEA_CATALOG[4];
    const rug = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('LOHALS') || p.name.includes('STOENSE')) || INITIAL_IKEA_CATALOG[0];

    // 3. Assemble 12 placed items
    const islandItem = createMockPlacedItem(island, { instanceId: 'kit-island', position: [-2.5, 0, 1.2], roomId: openPlanRoom.id });
    const cartItem = createMockPlacedItem(cart, { instanceId: 'kit-cart', position: [-2.5, 0, 2.4], roomId: openPlanRoom.id });

    // Verify clearance between island and cart
    assert.equal(checkFurnitureCollision(islandItem, cartItem), false);

    const diningItem = createMockPlacedItem(diningTable, { instanceId: 'din-table', position: [2.0, 0, 1.2], roomId: openPlanRoom.id });
    const ch1 = createMockPlacedItem(chair, { instanceId: 'din-c1', position: [1.4, 0, 1.2], roomId: openPlanRoom.id });
    const ch2 = createMockPlacedItem(chair, { instanceId: 'din-c2', position: [2.6, 0, 1.2], roomId: openPlanRoom.id });
    const ch3 = createMockPlacedItem(chair, { instanceId: 'din-c3', position: [2.0, 0, 0.6], roomId: openPlanRoom.id });
    const ch4 = createMockPlacedItem(chair, { instanceId: 'din-c4', position: [2.0, 0, 1.8], roomId: openPlanRoom.id });

    // Lounge area
    const sofaItem = createMockPlacedItem(vimle, { instanceId: 'lng-sofa', position: [0, 0, -1.8], roomId: openPlanRoom.id });
    const coffeeItem = createMockPlacedItem(coffeeTable, { instanceId: 'lng-coffee', position: [0, 0, -0.6], roomId: openPlanRoom.id });
    const mirrorItem = createMockPlacedItem(mirror, { instanceId: 'lng-mirror', position: [4.9, 1.5, 0], roomId: openPlanRoom.id });
    const rugItem = createMockPlacedItem(rug, { instanceId: 'lng-rug', position: [0, 0, -1.4], roomId: openPlanRoom.id });
    const extraChair = createMockPlacedItem(chair, { instanceId: 'lng-accent-chair', position: [-1.8, 0, -1.2], roomId: openPlanRoom.id });

    const allPlacedItems: PlacedFurnitureItem[] = [
      islandItem,
      cartItem,
      diningItem,
      ch1,
      ch2,
      ch3,
      ch4,
      sofaItem,
      coffeeItem,
      mirrorItem,
      rugItem,
      extraChair,
    ];
    assert.equal(allPlacedItems.length, 12);

    // 4. Install twin glass globe chandeliers over island and dining zones
    const chandeliers = [
      createMockChandelier('glass_globe_cluster', {
        instanceId: 'chan-island',
        position: [-2.5, 3.0, 1.2],
        roomId: openPlanRoom.id,
      }),
      createMockChandelier('glass_globe_cluster', {
        instanceId: 'chan-dining',
        position: [2.0, 3.0, 1.2],
        roomId: openPlanRoom.id,
      }),
    ];
    assert.equal(chandeliers.length, 2);

    // 5. Calculate dual-currency BOM
    const bom = calculateBomSummary(allPlacedItems, chandeliers);
    assertBomMath(bom);
    assert.equal(bom.totalItems, 14, '12 furniture + 2 chandeliers = 14 items');
    assert.ok(bom.totalCzk > 0 && bom.totalEur > 0);
    assert.equal(bom.totalEur, Math.round(bom.lines.reduce((s, l) => s + l.subtotalEur, 0)));

    const csv = exportBomToCsv(bom);
    assertValidCsv(csv, 10);

    // 6. Persistence roundtrip
    const project: ApartmentProjectState = {
      version: 3,
      exportedAt: new Date().toISOString(),
      rooms: [openPlanRoom],
      placedItems: allPlacedItems,
      chandeliers,
      metadata: {
        appName: 'IKEA Space Planner VR',
        lightingPreset: 'Studio Daylight',
        activeRoomId: openPlanRoom.id,
      },
    };

    const serialized = serializeApartmentProject(project);
    const reloaded = deserializeApartmentProject(serialized);

    assert.equal(reloaded.rooms.length, 1);
    assert.equal(reloaded.placedItems.length, 12);
    assert.equal(reloaded.chandeliers.length, 2);
  });
});
