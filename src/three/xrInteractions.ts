import * as THREE from 'three';
import type { PlacedFurnitureItem } from '../types/ikea';

/**
 * WebXR Immersion & Spatial Interaction Engine
 * Implements:
 * 1. Heading-relative locomotion aligned with HMD gaze direction.
 * 2. 45° snap-turning with deadzone recenter latch.
 * 3. Dynamic parabolic ray arc and visible ground target ring with collision detection against floor planes.
 * 4. Controller haptics for grab, snap, and place events.
 * 5. Grab orientation preservation.
 */

export interface XRSnapTurnState {
  snapLatch: boolean;
  lastTurnTime?: number;
}

export interface XRGrabState {
  instanceId: string | null;
  controller: THREE.Object3D | null;
  initialObjectRotationY: number;
  initialControllerRotationY: number;
  initialPositionOffset: THREE.Vector3;
  lastSnapHapticTime?: number;
}

export interface XRTeleportArcResult {
  points: THREE.Vector3[];
  groundHit: THREE.Vector3 | null;
  hitFloorObject: THREE.Object3D | null;
}

export interface XRTeleportHandleResult {
  hasValidTarget: boolean;
  targetPoint: THREE.Vector3 | null;
  hitObject: THREE.Object3D | null;
  arcMesh: THREE.Line | null;
  ringMesh: THREE.Object3D | null;
  teleport: () => boolean;
}

/**
 * Calculates heading-relative locomotion vector rotated by HMD yaw.
 * Matches standard WebXR Gamepad axes: axes[2] = X (strafe), axes[3] = Z (forward/back).
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
 * Drives smooth locomotion aligned with the user's HMD gaze direction.
 * Left controller thumbstick is preferred for locomotion; falls back to any available stick.
 */
export function handleXRLocomotion(
  session: XRSession | any,
  xrRig: THREE.Object3D,
  hmdCamera: THREE.Camera,
  dt: number,
  speed = 2.2
): void {
  if (!session || !session.inputSources) return;

  // Extract HMD world yaw orientation
  const hmdQuat = new THREE.Quaternion();
  hmdCamera.getWorldQuaternion(hmdQuat);
  const euler = new THREE.Euler().setFromQuaternion(hmdQuat, 'YXZ');
  const hmdYaw = euler.y;

  for (const source of session.inputSources) {
    // Left hand thumbstick or fallback if single controller
    const isLocomotionHand =
      source.handedness === 'left' ||
      source.handedness === 'none' ||
      session.inputSources.length === 1;

    if (!isLocomotionHand) continue;

    const gamepad = source.gamepad;
    if (gamepad && gamepad.axes && gamepad.axes.length >= 2) {
      // Primary thumbstick axes: [2, 3] on standard XR gamepads, fallback to [0, 1]
      const gx =
        gamepad.axes.length >= 4 && (Math.abs(gamepad.axes[2]) > 0.05 || Math.abs(gamepad.axes[3]) > 0.05)
          ? gamepad.axes[2]
          : gamepad.axes[0] || 0;
      const gz =
        gamepad.axes.length >= 4 && (Math.abs(gamepad.axes[2]) > 0.05 || Math.abs(gamepad.axes[3]) > 0.05)
          ? gamepad.axes[3]
          : gamepad.axes[1] || 0;

      const moveVec = calculateHeadingRelativeLocomotion(gx, gz, hmdYaw, 0.15, speed);
      if (moveVec.lengthSq() > 0) {
        xrRig.position.addScaledVector(moveVec, dt);
      }
    }
  }
}

/**
 * Calculates snap-turning rotation for right controller thumbstick.
 * Enforces recenter latch so user must release thumbstick between turns.
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

  // Right flick (stickX > 0) turns view to the right (rig rotation decreases)
  const direction = stickX > 0 ? -1 : 1;
  const newYaw = currentYawRad + direction * snapAngleRad;
  return { newYawRad: newYaw, newLatch: true, didTurn: true };
}

/**
 * Handles 45° snap-turn on controller thumbstick with haptic feedback.
 */
export function handleXRSnapTurn(
  gamepadOrSource: any,
  xrRig: THREE.Object3D,
  stateRef: { current?: XRSnapTurnState } | XRSnapTurnState,
  snapAngleRad = Math.PI / 4,
  hmdCamera?: THREE.Camera
): boolean {
  if (!gamepadOrSource) return false;

  const gamepad = gamepadOrSource.gamepad ?? gamepadOrSource;
  if (!gamepad || !gamepad.axes || gamepad.axes.length === 0) return false;

  const stickX =
    gamepad.axes.length >= 4 && Math.abs(gamepad.axes[2]) > 0.05
      ? gamepad.axes[2]
      : gamepad.axes[0] || 0;

  const state: XRSnapTurnState = 'current' in stateRef && stateRef.current ? stateRef.current : (stateRef as XRSnapTurnState);
  const result = calculateSnapTurn(xrRig.rotation.y, stickX, state.snapLatch, 0.65, snapAngleRad);

  state.snapLatch = result.newLatch;

  if (result.didTurn) {
    const deltaYaw = result.newYawRad - xrRig.rotation.y;

    if (hmdCamera) {
      // In room-scale VR, pivot xrRig around the user's head position
      const camWorldPos = new THREE.Vector3();
      hmdCamera.getWorldPosition(camWorldPos);

      xrRig.position.sub(camWorldPos);
      xrRig.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaYaw);
      xrRig.position.add(camWorldPos);
    }

    xrRig.rotation.y = result.newYawRad;

    // Trigger haptic feedback on snap
    triggerXRHaptics(gamepadOrSource, 35, 0.45);
    return true;
  }

  return false;
}

/**
 * Calculates parabolic teleport curve intersecting ground floor plane at y = 0.
 * Pure ballistic physics model.
 */
export function calculateParabolicTeleportArc(
  origin: [number, number, number] | THREE.Vector3,
  direction: [number, number, number] | THREE.Vector3,
  velocity = 7.0,
  gravity = 9.8,
  maxSteps = 40,
  dt = 0.03
): { points: Array<[number, number, number]>; groundHit: [number, number, number] | null } {
  const points: Array<[number, number, number]> = [];
  const originArr: [number, number, number] = Array.isArray(origin)
    ? origin
    : [origin.x, origin.y, origin.z];
  const dirArr: [number, number, number] = Array.isArray(direction)
    ? direction
    : [direction.x, direction.y, direction.z];

  const pos = new THREE.Vector3(...originArr);
  const dir = new THREE.Vector3(...dirArr).normalize();
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

const arcRaycaster = new THREE.Raycaster();

/**
 * Computes parabolic ray trajectory with segment raycasting against room floor meshes.
 */
export function computeParabolicArcCollision(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  floorMeshes: THREE.Object3D[],
  velocity = 7.5,
  gravity = 9.8,
  maxSteps = 45,
  dt = 0.03
): XRTeleportArcResult {
  const points: THREE.Vector3[] = [];
  const pos = origin.clone();
  const vel = direction.clone().normalize().multiplyScalar(velocity);

  points.push(pos.clone());

  let groundHit: THREE.Vector3 | null = null;
  let hitFloorObject: THREE.Object3D | null = null;

  const segmentDir = new THREE.Vector3();

  for (let step = 0; step < maxSteps; step++) {
    const nextPos = pos.clone().addScaledVector(vel, dt);
    vel.y -= gravity * dt;

    segmentDir.subVectors(nextPos, pos);
    const segLength = segmentDir.length();
    segmentDir.normalize();

    // Raycast segment against floor planes
    if (floorMeshes.length > 0 && segLength > 0.001) {
      arcRaycaster.set(pos, segmentDir);
      arcRaycaster.far = segLength;

      const hits = arcRaycaster.intersectObjects(floorMeshes, true);
      if (hits.length > 0) {
        groundHit = hits[0].point.clone();
        hitFloorObject = hits[0].object;
        points.push(groundHit);
        return { points, groundHit, hitFloorObject };
      }
    }

    // Mathematical floor plane collision fallback at y = 0
    if (pos.y > 0 && nextPos.y <= 0) {
      const t = (0 - pos.y) / (nextPos.y - pos.y);
      if (t >= 0 && t <= 1) {
        groundHit = new THREE.Vector3(
          pos.x + t * (nextPos.x - pos.x),
          0,
          pos.z + t * (nextPos.z - pos.z)
        );
        points.push(groundHit);
        return { points, groundHit, hitFloorObject: null };
      }
    }

    pos.copy(nextPos);
    points.push(pos.clone());

    if (pos.y < -2.0) {
      break;
    }
  }

  return { points, groundHit, hitFloorObject };
}

/**
 * Constructs a dynamic line mesh for the teleportation parabolic ray arc.
 */
export function createTeleportArcLine(): THREE.Line {
  const maxPoints = 50;
  const positions = new Float32Array(maxPoints * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);

  const material = new THREE.LineBasicMaterial({
    color: 0x0058a3, // IKEA Blue
    transparent: true,
    opacity: 0.9,
    depthTest: true,
  });

  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  line.name = 'teleport_parabolic_arc';
  return line;
}

/**
 * Constructs an architectural ground target ring marker.
 */
export function createTeleportTargetRing(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'teleport_ground_target_ring';

  // Outer primary ring
  const outerGeom = new THREE.RingGeometry(0.24, 0.32, 36);
  outerGeom.rotateX(-Math.PI / 2);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0x0058a3, // IKEA Blue
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });
  const outerMesh = new THREE.Mesh(outerGeom, outerMat);
  group.add(outerMesh);

  // Inner center target disc
  const innerGeom = new THREE.RingGeometry(0.04, 0.1, 24);
  innerGeom.rotateX(-Math.PI / 2);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xffdb00, // IKEA Yellow
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
  });
  const innerMesh = new THREE.Mesh(innerGeom, innerMat);
  group.add(innerMesh);

  // Crosshair ticks
  const tickGeom = new THREE.BoxGeometry(0.025, 0.002, 0.16);
  const tickMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tickN = new THREE.Mesh(tickGeom, tickMat);
  tickN.position.z = -0.38;
  const tickS = new THREE.Mesh(tickGeom, tickMat);
  tickS.position.z = 0.38;
  const tickE = new THREE.Mesh(tickGeom, tickMat);
  tickE.rotation.y = Math.PI / 2;
  tickE.position.x = 0.38;
  const tickW = new THREE.Mesh(tickGeom, tickMat);
  tickW.rotation.y = Math.PI / 2;
  tickW.position.x = -0.38;

  group.add(tickN, tickS, tickE, tickW);
  group.position.y = 0.015;
  group.visible = false;
  return group;
}

/**
 * Handles dynamic parabolic ray arc rendering and teleport locomotion execution.
 */
export function handleXRTeleport(
  controller: THREE.Object3D,
  scene: THREE.Scene,
  floorMeshes: THREE.Object3D[],
  xrRig?: THREE.Object3D,
  executeTeleport = false
): XRTeleportHandleResult {
  // Retrieve or create attached arc line and target ring
  let arcLine = controller.userData.teleportArc as THREE.Line | undefined;
  if (!arcLine) {
    arcLine = createTeleportArcLine();
    controller.userData.teleportArc = arcLine;
    scene.add(arcLine);
  }

  let targetRing = scene.userData.teleportRing as THREE.Group | undefined;
  if (!targetRing) {
    targetRing = createTeleportTargetRing();
    scene.userData.teleportRing = targetRing;
    scene.add(targetRing);
  }

  // Controller origin and forward pointing vector in world space
  const origin = new THREE.Vector3();
  controller.getWorldPosition(origin);

  const direction = new THREE.Vector3(0, 0, -1);
  const rotMatrix = new THREE.Matrix4().extractRotation(controller.matrixWorld);
  direction.applyMatrix4(rotMatrix).normalize();

  // If controller is pointing straight up or backwards, hide arc
  if (direction.y > 0.45) {
    arcLine.geometry.setDrawRange(0, 0);
    targetRing.visible = false;
    return {
      hasValidTarget: false,
      targetPoint: null,
      hitObject: null,
      arcMesh: arcLine,
      ringMesh: targetRing,
      teleport: () => false,
    };
  }

  // Calculate parabolic trajectory with floor collision
  const collision = computeParabolicArcCollision(origin, direction, floorMeshes, 7.5, 9.8, 45, 0.03);

  // Update dynamic arc geometry buffer
  const posAttr = arcLine.geometry.attributes.position as THREE.BufferAttribute;
  const count = Math.min(collision.points.length, posAttr.count);
  for (let i = 0; i < count; i++) {
    const pt = collision.points[i];
    posAttr.setXYZ(i, pt.x, pt.y, pt.z);
  }
  posAttr.needsUpdate = true;
  arcLine.geometry.setDrawRange(0, count);

  const mat = arcLine.material as THREE.LineBasicMaterial;
  if (collision.groundHit) {
    mat.color.setHex(0x0058a3); // IKEA Blue when valid
    mat.opacity = 0.95;
    targetRing.position.set(collision.groundHit.x, collision.groundHit.y + 0.012, collision.groundHit.z);
    targetRing.visible = true;
  } else {
    mat.color.setHex(0xff7744); // Amber when arc has not reached floor
    mat.opacity = 0.4;
    targetRing.visible = false;
  }

  const targetRig = xrRig ?? controller.parent ?? scene.getObjectByName('xr_user_rig');

  const doTeleport = (): boolean => {
    if (!collision.groundHit || !targetRig) return false;

    targetRig.position.set(collision.groundHit.x, targetRig.position.y, collision.groundHit.z);
    targetRing.visible = false;
    arcLine.geometry.setDrawRange(0, 0);

    // Pulse haptics on successful teleport
    triggerXRHaptics(controller, 55, 0.65);
    return true;
  };

  if (executeTeleport) {
    const success = doTeleport();
    return {
      hasValidTarget: !!collision.groundHit,
      targetPoint: collision.groundHit,
      hitObject: collision.hitFloorObject,
      arcMesh: arcLine,
      ringMesh: targetRing,
      teleport: doTeleport,
    };
  }

  return {
    hasValidTarget: !!collision.groundHit,
    targetPoint: collision.groundHit,
    hitObject: collision.hitFloorObject,
    arcMesh: arcLine,
    ringMesh: targetRing,
    teleport: doTeleport,
  };
}

/**
 * Triggers haptic pulse on VR controller actuators across WebXR Gamepad API implementations.
 */
export function triggerXRHaptics(
  target: any,
  durationMs = 50,
  intensity = 0.6
): boolean {
  if (!target) return false;

  const clampedIntensity = Math.min(1, Math.max(0, intensity));

  // 1. Direct actuator on Gamepad or input source
  const actuator =
    target.hapticActuators?.[0] ??
    target.gamepad?.hapticActuators?.[0] ??
    target.userData?.inputSource?.gamepad?.hapticActuators?.[0] ??
    target.userData?.gamepad?.hapticActuators?.[0];

  if (actuator && typeof actuator.pulse === 'function') {
    try {
      actuator.pulse(clampedIntensity, durationMs);
      return true;
    } catch {
      // Fall through to secondary fallbacks
    }
  }

  // 2. vibrationActuator standard fallback
  const vib =
    target.vibrationActuator ??
    target.gamepad?.vibrationActuator ??
    target.userData?.inputSource?.gamepad?.vibrationActuator;

  if (vib && typeof vib.playEffect === 'function') {
    try {
      vib.playEffect('dual-rumble', {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude: clampedIntensity,
        strongMagnitude: clampedIntensity,
      });
      return true;
    } catch {
      // Ignore
    }
  }

  // 3. Fallback to navigator.vibrate if available
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(durationMs);
      return true;
    } catch {
      // Ignore
    }
  }

  return false;
}

/**
 * Initializes grab state preserving original furniture rotation.
 */
export function handleXRGrabStart(
  interactor: THREE.Object3D,
  item: PlacedFurnitureItem
): XRGrabState {
  const euler = new THREE.Euler().setFromRotationMatrix(interactor.matrixWorld, 'YXZ');

  // Trigger grab haptic pulse
  triggerXRHaptics(interactor, 65, 0.7);

  return {
    instanceId: item.instanceId,
    controller: interactor,
    initialObjectRotationY: item.rotationY,
    initialControllerRotationY: euler.y,
    initialPositionOffset: new THREE.Vector3(),
  };
}

/**
 * Calculates updated position and preserved orientation during grab drag.
 */
export function handleXRGrabMove(
  grabState: XRGrabState,
  interactor: THREE.Object3D,
  floorIntersect: THREE.Vector3,
  allowWristRotation = true
): { pos: [number, number, number]; rotY: number } {
  let rotY = grabState.initialObjectRotationY;

  if (allowWristRotation) {
    const euler = new THREE.Euler().setFromRotationMatrix(interactor.matrixWorld, 'YXZ');
    const deltaYawRad = euler.y - grabState.initialControllerRotationY;
    const deltaYawDeg = (deltaYawRad * 180) / Math.PI;
    rotY = Math.round((grabState.initialObjectRotationY + deltaYawDeg) % 360);
    if (rotY < 0) rotY += 360;
  }

  return {
    pos: [
      Number(floorIntersect.x.toFixed(2)),
      Number(floorIntersect.y.toFixed(2)),
      Number(floorIntersect.z.toFixed(2)),
    ],
    rotY,
  };
}

/**
 * Concludes furniture grab and triggers place haptic pulse.
 */
export function handleXRGrabEnd(grabState: XRGrabState | null): void {
  if (grabState?.controller) {
    triggerXRHaptics(grabState.controller, 45, 0.5);
  }
}
