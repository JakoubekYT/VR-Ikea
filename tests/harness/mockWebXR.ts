/**
 * WebXR Session, Controller, Thumbstick, and Haptics Simulator
 * Provides faithful emulation of WebXR device APIs and spatial locomotion math.
 */

import * as THREE from 'three';

export interface MockHapticRecord {
  intensity: number;
  duration: number;
  timestamp: number;
}

export interface MockXRGamepad {
  axes: number[];
  buttons: Array<{ pressed: boolean; touched: boolean; value: number }>;
  hapticActuators: Array<{
    pulse: (intensity: number, duration: number) => Promise<boolean>;
  }>;
  hapticHistory: MockHapticRecord[];
}

export interface MockXRInputSource {
  handedness: 'left' | 'right' | 'none';
  targetRayMode: 'gaze' | 'tracked-pointer' | 'screen';
  gamepad: MockXRGamepad;
  targetRaySpace: THREE.Object3D;
  gripSpace: THREE.Object3D;
}

export interface MockXRSessionInit {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
}

export class MockXRSession {
  inputSources: MockXRInputSource[] = [];
  isEnded = false;
  requestedFeatures: string[] = [];

  constructor(features: string[] = ['local-floor', 'bounded-floor', 'hand-tracking']) {
    this.requestedFeatures = features;
    this.inputSources = [
      this.createController('left'),
      this.createController('right'),
    ];
  }

  createController(handedness: 'left' | 'right' | 'none'): MockXRInputSource {
    const hapticHistory: MockHapticRecord[] = [];
    const gamepad: MockXRGamepad = {
      axes: [0, 0, 0, 0], // [0, 1] standard stick/pad, [2, 3] primary thumbstick (gx, gz)
      buttons: [
        { pressed: false, touched: false, value: 0 }, // Trigger
        { pressed: false, touched: false, value: 0 }, // Grip
        { pressed: false, touched: false, value: 0 }, // Stick click
        { pressed: false, touched: false, value: 0 }, // A/X
        { pressed: false, touched: false, value: 0 }, // B/Y
      ],
      hapticActuators: [
        {
          pulse: async (intensity: number, duration: number) => {
            hapticHistory.push({ intensity, duration, timestamp: Date.now() });
            return true;
          },
        },
      ],
      hapticHistory,
    };

    const targetRaySpace = new THREE.Object3D();
    const gripSpace = new THREE.Object3D();

    if (handedness === 'left') {
      gripSpace.position.set(-0.2, 1.2, -0.3);
    } else {
      gripSpace.position.set(0.2, 1.2, -0.3);
    }

    return {
      handedness,
      targetRayMode: 'tracked-pointer',
      gamepad,
      targetRaySpace,
      gripSpace,
    };
  }

  async requestReferenceSpace(type: string): Promise<any> {
    return { type, originOffset: new THREE.Matrix4() };
  }

  async end(): Promise<void> {
    this.isEnded = true;
  }

  addEventListener(_event: string, _handler: (...args: any[]) => void): void {}
  removeEventListener(_event: string, _handler: (...args: any[]) => void): void {}
}

export class MockXRSystem {
  supportedModes = new Set(['immersive-vr', 'inline']);
  activeSession: MockXRSession | null = null;

  async isSessionSupported(mode: string): Promise<boolean> {
    return this.supportedModes.has(mode);
  }

  async requestSession(mode: string, options?: MockXRSessionInit): Promise<MockXRSession> {
    if (!this.supportedModes.has(mode)) {
      throw new Error(`WebXR mode '${mode}' not supported`);
    }
    const features = [
      ...(options?.requiredFeatures || []),
      ...(options?.optionalFeatures || []),
    ];
    const session = new MockXRSession(features);
    this.activeSession = session;
    return session;
  }
}

/**
 * Calculates heading-relative locomotion vector rotated by HMD yaw.
 */
export function calculateHeadingRelativeLocomotion(
  stickX: number,
  stickZ: number,
  hmdYawRad: number,
  deadzone = 0.15,
  speed = 2.2
): THREE.Vector3 {
  if (Math.abs(stickX) <= deadzone && Math.abs(stickZ) <= deadzone) {
    return new THREE.Vector3(0, 0, 0);
  }

  const raw = new THREE.Vector3(stickX * speed, 0, stickZ * speed);
  const rotated = raw.applyAxisAngle(new THREE.Vector3(0, 1, 0), hmdYawRad);
  return rotated;
}

/**
 * Calculates snap-turning rotation for right controller thumbstick.
 */
export function calculateSnapTurn(
  currentYawRad: number,
  stickX: number,
  recenterLatch: boolean,
  deadzone = 0.65,
  snapAngleRad = Math.PI / 4
): { newYawRad: number; newLatch: boolean; didTurn: boolean } {
  if (Math.abs(stickX) < deadzone) {
    return { newYawRad: currentYawRad, newLatch: false, didTurn: false };
  }

  if (recenterLatch) {
    // Stick is still held past deadzone, do not turn again until released
    return { newYawRad: currentYawRad, newLatch: true, didTurn: false };
  }

  const direction = stickX > 0 ? -1 : 1; // Right flick turns view right (rig rotates negative or vice versa)
  const newYaw = currentYawRad + direction * snapAngleRad;
  return { newYawRad: newYaw, newLatch: true, didTurn: true };
}

/**
 * Calculates parabolic teleport curve intersecting ground floor plane at y = 0.
 */
export function calculateParabolicTeleportArc(
  origin: [number, number, number],
  direction: [number, number, number],
  velocity = 6.0,
  gravity = 9.8,
  maxSteps = 40,
  dt = 0.03
): { points: Array<[number, number, number]>; groundHit: [number, number, number] | null } {
  const points: Array<[number, number, number]> = [];
  const pos = new THREE.Vector3(...origin);
  const dir = new THREE.Vector3(...direction).normalize();
  const vel = dir.multiplyScalar(velocity);

  points.push([pos.x, pos.y, pos.z]);

  let groundHit: [number, number, number] | null = null;

  for (let i = 0; i < maxSteps; i++) {
    vel.y -= gravity * dt;
    pos.addScaledVector(vel, dt);

    if (pos.y <= 0) {
      // Clamped to floor
      groundHit = [pos.x, 0, pos.z];
      points.push(groundHit);
      break;
    }

    points.push([pos.x, pos.y, pos.z]);
  }

  return { points, groundHit };
}

let originalXR: any = undefined;

export function installMockWebXR(): MockXRSystem {
  const g = globalThis as any;
  if (!g.navigator) {
    g.navigator = {};
  }
  originalXR = g.navigator.xr;
  const mockSystem = new MockXRSystem();
  g.navigator.xr = mockSystem;
  return mockSystem;
}

export function uninstallMockWebXR(): void {
  const g = globalThis as any;
  if (g.navigator) {
    g.navigator.xr = originalXR;
  }
}
