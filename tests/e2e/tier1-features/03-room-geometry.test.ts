import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import { INITIAL_APARTMENT_ROOMS } from '../../../src/data/ikeaCatalog.js';
import { buildApartmentArchitecture } from '../../../src/three/roomArchitectureBuilder.js';
import { computeWallCutaway, findRoomForPoint } from '../../../src/utils/roomLogic.js';
import { createMockRoom, createMockWallOpening } from '../../harness/index.js';

describe('Tier 1: Feature 3 - Multi-Room Apartment Geometry & Openings', () => {
  it('T1-F3-01: Multi-Room Apartment Architecture Generation', () => {
    const group = buildApartmentArchitecture(
      INITIAL_APARTMENT_ROOMS,
      'room-living',
      [0, 6, 8],
      [0, 0, 0],
      true,
      false,
      'north'
    );

    assert.equal(group.name, 'apartment_architecture');
    assert.equal(group.children.length, INITIAL_APARTMENT_ROOMS.length);
    for (const roomGroup of group.children) {
      assert.ok(roomGroup.userData?.roomId, 'Each child room group must have userData.roomId');
    }
  });

  it('T1-F3-02: CSG-Free Window Cutouts via Box Segmentation', () => {
    const windowOpening = createMockWallOpening({
      wall: 'west',
      type: 'Double Casement Window',
      width: 1.8,
      height: 1.45,
      sillHeight: 0.85,
      offset: 0.2,
    });
    const room = createMockRoom({
      width: 4.8,
      length: 4.8,
      height: 2.85,
      openings: [windowOpening],
    });

    const group = buildApartmentArchitecture([room], room.id, [0, 5, 8], [0, 0, 0], false, false);
    assert.ok(group.children.length > 0);

    const roomChild = group.children[0];
    const westWallGroup = roomChild.children.find((c) => c.name === `wall_${room.id}_west`);
    assert.ok(westWallGroup, 'West wall group must exist');

    // Box segmentation slices around opening into at least 3-4 segments (left, right, bottom sill, top lintel)
    const westMeshes = westWallGroup.children.filter((c) => c.userData?.wallId === 'west');
    assert.ok(
      westMeshes.length >= 3,
      `Expected at least 3 wall segment meshes around window opening, got ${westMeshes.length}`
    );
  });

  it('T1-F3-03: Door Opening with 55° Ajar Leaf and Frame', () => {
    const doorOpening = createMockWallOpening({
      wall: 'east',
      type: 'Door',
      width: 1.05,
      height: 2.15,
      sillHeight: 0,
      offset: 0,
    });
    const room = createMockRoom({
      openings: [doorOpening],
    });

    const group = buildApartmentArchitecture([room], room.id, [0, 5, 8], [0, 0, 0], false, false);
    const roomChild = group.children[0];

    // Find door leaf or door pivot group swung ajar at 55° = (55 * Math.PI) / 180 ≈ 0.9599 rad
    let foundAjarLeaf = false;
    roomChild.traverse((obj: any) => {
      if (Math.abs(obj.rotation?.y - (55 * Math.PI) / 180) < 0.05) {
        foundAjarLeaf = true;
      }
    });

    assert.ok(foundAjarLeaf, 'Door opening must include an ajar door leaf rotated by ~55°');
  });

  it('T1-F3-04: Dynamic Camera Cutaway Computation', () => {
    // Camera is placed south of room looking towards center
    const cameraPos: [number, number, number] = [0, 5, 10];
    const roomCenter: [number, number, number] = [0, 0, 0];

    const cutaway = computeWallCutaway(cameraPos, roomCenter, true);
    assert.equal(cutaway.south, true, 'South wall facing camera should cut away');
    assert.equal(cutaway.north, false, 'North rear wall should remain full height');

    // When cutaway is disabled, all walls should be false
    const disabledCutaway = computeWallCutaway(cameraPos, roomCenter, false);
    assert.deepEqual(disabledCutaway, { north: false, south: false, east: false, west: false });
  });

  it('T1-F3-05: Multi-Room Coordinate Containment (findRoomForPoint)', () => {
    const roomLiving = findRoomForPoint(0, 0, INITIAL_APARTMENT_ROOMS);
    assert.equal(roomLiving.id, 'room-living');

    const roomBedroom = findRoomForPoint(-1.2, -4.3, INITIAL_APARTMENT_ROOMS);
    assert.equal(roomBedroom.id, 'room-bedroom');

    const roomKitchen = findRoomForPoint(4.8, 0, INITIAL_APARTMENT_ROOMS);
    assert.equal(roomKitchen.id, 'room-kitchen');
  });

  it('T1-F3-06: Interior Ceiling Slab Toggle', () => {
    const orbitGroup = buildApartmentArchitecture(
      INITIAL_APARTMENT_ROOMS,
      'room-living',
      [0, 5, 8],
      [0, 0, 0],
      true,
      false // Dollhouse orbit mode
    );
    let orbitHasCeiling = false;
    orbitGroup.children[0].traverse((obj: any) => {
      if (obj.userData?.isCeiling) orbitHasCeiling = true;
    });

    const walkthroughGroup = buildApartmentArchitecture(
      INITIAL_APARTMENT_ROOMS,
      'room-living',
      [0, 1.65, 0],
      [0, 1.65, -1],
      false,
      true // Walkthrough interior mode
    );
    let walkthroughHasCeiling = false;
    walkthroughGroup.children[0].traverse((obj: any) => {
      if (obj.userData?.isCeiling || (obj.isMesh && obj.position?.y > 2.5)) {
        walkthroughHasCeiling = true;
      }
    });

    assert.equal(orbitHasCeiling, false, 'Dollhouse orbit view should omit ceiling slab');
    assert.equal(walkthroughHasCeiling, true, 'Walkthrough 1:1 interior view must instantiate solid ceiling slab');
  });
});
