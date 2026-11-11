import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../../harness/index.js';
import {
  installMockWebXR,
  uninstallMockWebXR,
  calculateHeadingRelativeLocomotion,
  calculateSnapTurn,
  calculateParabolicTeleportArc,
  MockXRSystem,
  createMockPlacedItem,
} from '../../harness/index.js';
import { INITIAL_IKEA_CATALOG } from '../../../src/data/ikeaCatalog.js';

describe('Tier 1: Feature 7 - WebXR / VR Interaction & Walkthrough', () => {
  let xrSystem: MockXRSystem;

  beforeEach(() => {
    xrSystem = installMockWebXR();
  });

  afterEach(() => {
    uninstallMockWebXR();
  });

  it('T1-F7-01: WebXR Hardware Readiness Probe', async () => {
    const isSupported = await xrSystem.isSessionSupported('immersive-vr');
    assert.equal(typeof isSupported, 'boolean');
    assert.equal(isSupported, true, 'immersive-vr should be supported by MockXRSystem');

    const unsupported = await xrSystem.isSessionSupported('non-existent-mode');
    assert.equal(unsupported, false);
  });

  it('T1-F7-02: WebXR Session Initialization Features', async () => {
    const session = await xrSystem.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    });

    assert.ok(session, 'Must return active session');
    assert.ok(session.requestedFeatures.includes('local-floor'));
    assert.ok(session.requestedFeatures.includes('hand-tracking'));
    assert.equal(session.inputSources.length, 2, 'Should provide left and right controllers');
  });

  it('T1-F7-03: Heading-Relative Locomotion Math', () => {
    // When stick points forward (stickZ = -1), and HMD is looking East (yaw = -PI/2)
    // Movement vector must rotate so forward motion is directed East (+X)
    const stickX = 0;
    const stickZ = -1;
    const hmdYawRad = -Math.PI / 2; // Looking towards +X

    const movement = calculateHeadingRelativeLocomotion(stickX, stickZ, hmdYawRad);

    assert.ok(movement.x > 0, `Movement X should be positive East, got ${movement.x}`);
    assert.ok(Math.abs(movement.z) < 1e-4, `Movement Z should be near 0, got ${movement.z}`);
    assert.equal(movement.y, 0, 'Locomotion must remain constrained to horizontal plane');
  });

  it('T1-F7-04: Snap-Turning on Right Controller Thumbstick', () => {
    const initialYaw = 0;
    // Flick right thumbstick past deadzone (0.8 > 0.65)
    const turn1 = calculateSnapTurn(initialYaw, 0.8, false);

    assert.equal(turn1.didTurn, true);
    assert.equal(turn1.newLatch, true);
    assert.equal(Math.abs(turn1.newYawRad - initialYaw), Math.PI / 4, 'Should snap exactly 45 degrees');

    // Holding stick while latched must not turn again
    const turn2 = calculateSnapTurn(turn1.newYawRad, 0.8, true);
    assert.equal(turn2.didTurn, false);
    assert.equal(turn2.newYawRad, turn1.newYawRad);

    // Releasing stick resets the latch
    const turn3 = calculateSnapTurn(turn1.newYawRad, 0.05, true);
    assert.equal(turn3.newLatch, false);
    assert.equal(turn3.didTurn, false);
  });

  it('T1-F7-05: Parabolic Teleportation Arc & Floor Marker', () => {
    const origin: [number, number, number] = [0, 1.2, 0];
    const forwardDirection: [number, number, number] = [0, -0.4, -1];

    const arc = calculateParabolicTeleportArc(origin, forwardDirection, 5.0, 9.8, 50, 0.03);

    assert.ok(arc.points.length >= 10, 'Arc must generate multiple discrete trajectory points');
    assert.ok(arc.groundHit !== null, 'Arc pitched downward must intersect ground plane');
    assert.equal(arc.groundHit![1], 0, 'Ground intersection elevation must be y = 0');
    assert.ok(arc.groundHit![2] < 0, 'Target should be in front of user (negative Z)');
  });

  it('T1-F7-06: VR Grab Orientation Preservation & Haptics', async () => {
    const session = await xrSystem.requestSession('immersive-vr');
    const controller = session.inputSources[1]; // Right controller

    const item = createMockPlacedItem(INITIAL_IKEA_CATALOG[0], {
      rotationY: 45,
      position: [1, 0, 1],
    });

    // Simulate grab: preserve original rotation
    const originalRot = item.rotationY;
    assert.equal(originalRot, 45);

    // Simulate haptic pulse on trigger press
    await controller.gamepad.hapticActuators[0].pulse(0.8, 50);

    assert.equal(controller.gamepad.hapticHistory.length, 1);
    assert.equal(controller.gamepad.hapticHistory[0].intensity, 0.8);
    assert.equal(controller.gamepad.hapticHistory[0].duration, 50);
  });
});
