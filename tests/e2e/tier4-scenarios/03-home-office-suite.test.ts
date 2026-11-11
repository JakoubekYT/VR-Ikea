import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';
import {
  buildParametric3DSpec,
  calculateBomSummary,
  snapFurnitureToRoom,
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

describe('Tier 4: Scenario 3 - Modern Home Office & Creative Studio (45 m²)', () => {
  it('T4-S03: End-to-End Workflow for Executive Office Suite', () => {
    // 1. Initialize dual-room layout (Office: 5.2x4.5m, Lounge: 4.2x4.5m)
    const officeRoom = createMockRoom({
      id: 'room-office',
      name: 'Executive Studio Office',
      roomType: 'Office',
      position: [0, 0],
      width: 5.2,
      length: 4.5,
      height: 2.8,
      floorFinish: 'Polished Concrete',
      walls: {
        north: { colorHex: '#F4F1EA', finish: 'Smooth Matte Plaster' },
        south: { colorHex: '#F4F1EA', finish: 'Smooth Matte Plaster' },
        east: { colorHex: '#F4F1EA', finish: 'Smooth Matte Plaster' },
        west: { colorHex: '#C8A27A', finish: 'Nordic Acoustic Wood Slats' },
      },
    });

    const loungeRoom = createMockRoom({
      id: 'room-lounge',
      name: 'Library & Lounge',
      roomType: 'Living Room',
      position: [4.7, 0],
      width: 4.2,
      length: 4.5,
      height: 2.8,
      floorFinish: 'Oak Parquet',
      walls: {
        north: { colorHex: '#EAE6DF', finish: 'Exposed Whitewashed Brick' },
        south: { colorHex: '#F4F1EA', finish: 'Smooth Matte Plaster' },
        east: { colorHex: '#F4F1EA', finish: 'Smooth Matte Plaster' },
        west: { colorHex: '#F4F1EA', finish: 'Smooth Matte Plaster' },
      },
    });

    const rooms: ApartmentRoom[] = [officeRoom, loungeRoom];
    const aptGroup = buildApartmentArchitecture(rooms, officeRoom.id, [0, 5, 8], [0, 0, 0], false, false);
    assert.equal(aptGroup.children.length, 2);

    // 2. Select office & lounge furniture
    const bekant = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BEKANT')!;
    const markus = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('MARKUS') || p.category.includes('Office')) || INITIAL_IKEA_CATALOG[2];
    const billy = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BILLY')!;
    const fado = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FADO')!;
    const fejka = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('FEJKA') || p.category.includes('Rugs')) || INITIAL_IKEA_CATALOG[3];

    const poang = INITIAL_IKEA_CATALOG.find((p) => p.name === 'POÄNG')!;
    const stockholmTable = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('STOCKHOLM') || p.name === 'LACK')!;
    const hektar = INITIAL_IKEA_CATALOG.find((p) => p.name === 'HEKTAR')!;

    // 3. Office furniture (5 items)
    const deskItem = createMockPlacedItem(bekant, { instanceId: 'off-desk', position: [0, 0, 0], roomId: officeRoom.id });
    const chairItem = createMockPlacedItem(markus, { instanceId: 'off-chair', position: [0, 0, -0.8], roomId: officeRoom.id });

    // Snap bookcase flush to West acoustic wall (x = -2.6 + 0.14 = -2.46)
    const bookcaseSnap = snapFurnitureToRoom([-2.4, 0, 0], 90, billy.dimensionsCm, {
      width: officeRoom.width,
      length: officeRoom.length,
      enableGridSnap: false,
      enableWallSnap: true,
    });
    const bookcaseItem = createMockPlacedItem(billy, {
      instanceId: 'off-bookcase',
      position: bookcaseSnap.position,
      rotationY: bookcaseSnap.rotationY,
      roomId: officeRoom.id,
    });

    // Stack FADO lamp on top of bookcase shelf
    const lampItem = createMockPlacedItem(fado, {
      instanceId: 'off-lamp',
      position: [bookcaseSnap.position[0], 1.2, bookcaseSnap.position[2]],
      parentInstanceId: 'off-bookcase',
      roomId: officeRoom.id,
    });

    const plantItem = createMockPlacedItem(fejka, { instanceId: 'off-plant', position: [1.8, 0, 1.5], roomId: officeRoom.id });

    // 4. Lounge furniture (5 items)
    const armchairItem = createMockPlacedItem(poang, { instanceId: 'lng-chair', position: [4.7, 0, -1.0], roomId: loungeRoom.id });
    const tableItem = createMockPlacedItem(stockholmTable, { instanceId: 'lng-table', position: [4.7, 0, 0.2], roomId: loungeRoom.id });
    const floorLampItem = createMockPlacedItem(hektar, { instanceId: 'lng-floorlamp', position: [3.4, 0, -1.2], roomId: loungeRoom.id });
    const loungeBookcase1 = createMockPlacedItem(billy, { instanceId: 'lng-bk1', position: [6.4, 0, -1.5], roomId: loungeRoom.id });
    const loungeBookcase2 = createMockPlacedItem(billy, { instanceId: 'lng-bk2', position: [6.4, 0, -0.6], roomId: loungeRoom.id });

    const allPlacedItems: PlacedFurnitureItem[] = [
      deskItem,
      chairItem,
      bookcaseItem,
      lampItem,
      plantItem,
      armchairItem,
      tableItem,
      floorLampItem,
      loungeBookcase1,
      loungeBookcase2,
    ];
    assert.equal(allPlacedItems.length, 10);

    // 5. Mount chandeliers in Office and Lounge
    const chandeliers = [
      createMockChandelier('industrial_spider', { instanceId: 'chan-office', position: [0, 2.8, 0], roomId: officeRoom.id }),
      createMockChandelier('woven_pendant', { instanceId: 'chan-lounge', position: [4.7, 2.8, 0], roomId: loungeRoom.id }),
    ];
    assert.equal(chandeliers.length, 2);

    // 6. Calculate BOM Summary
    const bom = calculateBomSummary(allPlacedItems, chandeliers);
    assertBomMath(bom);
    assert.equal(bom.totalItems, 12, '10 furniture + 2 chandeliers = 12 items');

    const csv = exportBomToCsv(bom);
    assertValidCsv(csv, 8);

    // 7. Full project state persistence roundtrip
    const project: ApartmentProjectState = {
      version: 3,
      exportedAt: new Date().toISOString(),
      rooms,
      placedItems: allPlacedItems,
      chandeliers,
      metadata: {
        appName: 'IKEA Space Planner VR',
        lightingPreset: 'Cozy Evening Lamps',
        activeRoomId: officeRoom.id,
      },
    };

    const jsonStr = serializeApartmentProject(project);
    const reloaded = deserializeApartmentProject(jsonStr);

    assert.equal(reloaded.rooms.length, 2);
    assert.equal(reloaded.placedItems.length, 10);
    assert.equal(reloaded.chandeliers.length, 2);
    assert.equal(reloaded.metadata?.lightingPreset, 'Cozy Evening Lamps');
  });
});
