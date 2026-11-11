import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_APARTMENT_ROOMS } from '../../../src/data/ikeaCatalog.js';
import { buildApartmentArchitecture } from '../../../src/three/roomArchitectureBuilder.js';
import { findRoomForPoint } from '../../../src/utils/roomLogic.js';
import { createMockRoom, createMockWallOpening } from '../../harness/index.js';

describe('Tier 2: Feature 3 - Multi-Room Apartment Geometry Boundaries', () => {
  it('T2-F3-01: Wall with Zero Openings', () => {
    const solidRoom = createMockRoom({
      width: 5.0,
      length: 5.0,
      height: 2.85,
      openings: [],
    });

    const group = buildApartmentArchitecture([solidRoom], solidRoom.id, [0, 5, 8], [0, 0, 0], false, false);
    assert.ok(group.children.length > 0);

    const roomChild = group.children[0];
    const northWall = roomChild.children.find((c) => c.name === `wall_${solidRoom.id}_north`);
    assert.ok(northWall, 'North wall group must exist');

    // Solid wall with zero openings has single segment mesh + baseboard
    const wallMeshes = northWall.children.filter((c) => c.userData?.isWall);
    assert.equal(wallMeshes.length, 1, 'Solid wall should have exactly 1 continuous wall segment mesh');
  });

  it('T2-F3-02: Multiple Touching/Overlapping Openings', () => {
    const win1 = createMockWallOpening({
      wall: 'north',
      type: 'Single Window',
      width: 1.0,
      height: 1.2,
      sillHeight: 0.8,
      offset: -0.6,
    });
    const win2 = createMockWallOpening({
      wall: 'north',
      type: 'Single Window',
      width: 1.0,
      height: 1.2,
      sillHeight: 0.8,
      offset: 0.6,
    });

    const room = createMockRoom({
      width: 4.0,
      length: 4.0,
      openings: [win1, win2],
    });

    assert.doesNotThrow(() => {
      const group = buildApartmentArchitecture([room], room.id, [0, 5, 8], [0, 0, 0], false, false);
      assert.ok(group.children.length > 0);
    });
  });

  it('T2-F3-03: Oversized Opening Clamping', () => {
    // 10m window on 4m wall
    const giantWindow = createMockWallOpening({
      wall: 'north',
      type: 'Single Window',
      width: 10.0,
      height: 5.0,
      sillHeight: 0.5,
      offset: 0,
    });

    const room = createMockRoom({
      width: 4.0,
      length: 4.0,
      height: 2.85,
      openings: [giantWindow],
    });

    assert.doesNotThrow(() => {
      const group = buildApartmentArchitecture([room], room.id, [0, 5, 8], [0, 0, 0], false, false);
      assert.ok(group.children.length > 0);
    });
  });

  it('T2-F3-04: Querying Point Far Outside All Rooms', () => {
    const farPointRoom = findRoomForPoint(1000, 1000, INITIAL_APARTMENT_ROOMS);
    assert.ok(farPointRoom !== null, 'Must not return null');
    assert.ok(farPointRoom.id, 'Should resolve to nearest room center');
  });

  it('T2-F3-05: Empty Rooms Array Exception', () => {
    assert.throws(
      () => findRoomForPoint(0, 0, []),
      /empty rooms array/,
      'findRoomForPoint must throw descriptive error when empty array is passed'
    );
  });

  it('T2-F3-06: Degenerate Zero-Dimension Room', () => {
    const zeroRoom = createMockRoom({
      width: 0.1,
      length: 0.1,
      height: 0.1,
      openings: [],
    });

    assert.doesNotThrow(() => {
      const group = buildApartmentArchitecture([zeroRoom], zeroRoom.id, [0, 5, 8], [0, 0, 0], false, false);
      assert.ok(group.children.length > 0);
    });
  });
});
