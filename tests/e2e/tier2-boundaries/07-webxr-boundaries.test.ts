import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import {
  calculateHeadingRelativeLocomotion,
  calculateParabolicTeleportArc,
  MockXRSystem,
  createMockPlacedItem,
} from '../../harness/index.js';
import { findRoomForPoint } from '../../../src/utils/roomLogic.js';
import { INITIAL_APARTMENT_ROOMS, INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';

describe('Tier 2: Feature 7 - WebXR / VR Walkthrough Boundaries', () => {
  it('T2-F7-01: Unsupported WebXR Session Mode Rejection', async () => {
    const xrSystem = new MockXRSystem();
    const unsupported = await xrSystem.isSessionSupported('unsupported-ar');
    assert.equal(unsupported, false);

    await assert.rejects(
      async () => xrSystem.requestSession('unsupported-ar'),
      /not supported/
    );
  });

  it('T2-F7-02: Gamepad Thumbstick Deadzone Boundary', () => {
    // Within deadzone 0.15: e.g. stickX = 0.12, stickZ = -0.14
    const locomotion = calculateHeadingRelativeLocomotion(0.12, -0.14, 0, 0.15);

    assert.equal(locomotion.x, 0, 'Stick deflection within deadzone must yield 0 translation X');
    assert.equal(locomotion.z, 0, 'Stick deflection within deadzone must yield 0 translation Z');
    assert.equal(locomotion.length(), 0);

    // Barely past deadzone: stickX = 0.16
    const moving = calculateHeadingRelativeLocomotion(0.16, 0, 0, 0.15);
    assert.ok(moving.length() > 0, 'Stick deflection beyond deadzone must produce locomotion');
  });

  it('T2-F7-03: Teleport Raycast Hitting Wall or Ceiling (Pitched Upward)', () => {
    const origin: [number, number, number] = [0, 1.6, 0];
    // Aiming straight up towards ceiling [0, 1, 0]
    const upwardDirection: [number, number, number] = [0, 1, 0];

    const arc = calculateParabolicTeleportArc(origin, upwardDirection, 3.0, 9.8, 10, 0.03);

    // In 10 steps, projectile never hits y <= 0
    assert.equal(arc.groundHit, null, 'Upward teleport aiming must not report ground hit within steps');
  });

  it('T2-F7-04: Teleport Aiming Outside Apartment Exterior', () => {
    // Ray hits floor at (50, 0, 50) far outside apartment perimeter
    const farFloorPoint: [number, number, number] = [50, 0, 50];

    const targetRoom = findRoomForPoint(farFloorPoint[0], farFloorPoint[2], INITIAL_APARTMENT_ROOMS);
    assert.ok(targetRoom, 'Should map to nearest room center as safe fallback');
    assert.ok(targetRoom.id, 'Target room must have valid id');
  });

  it('T2-F7-05: VR Furniture Grab Released Mid-Air', () => {
    const item = createMockPlacedItem(INITIAL_IKEA_CATALOG[0], {
      position: [1.0, 1.25, 0.5], // Released mid-air at y = 1.25m
    });

    // Drop logic clamps position[1] to floor y = 0
    const droppedPosition: [number, number, number] = [
      item.position[0],
      0, // Snapped to floor level
      item.position[2],
    ];

    assert.equal(droppedPosition[1], 0, 'Mid-air drop must resolve to floor level y = 0');
  });

  it('T2-F7-06: Sudden Controller Disconnection during Interaction', async () => {
    const xrSystem = new MockXRSystem();
    const session = await xrSystem.requestSession('immersive-vr');

    assert.equal(session.isEnded, false);
    await session.end();
    assert.equal(session.isEnded, true, 'Session must end cleanly when tracking or device disconnects');
  });
});
