import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import type {
  ApartmentRoom,
  LightingPreset,
  PlacedChandelier,
  PlacedFurnitureItem,
  ViewMode,
  WallId,
} from '../types/ikea';
import { buildApartmentArchitecture } from '../three/roomArchitectureBuilder';
import { buildFurnitureGroup } from '../three/furnitureBuilder';
import { buildChandelierGroup } from '../three/chandelierBuilder';
import { findRoomForPoint, snapFurnitureToRoom } from '../utils/roomLogic';
import { WALL_PAINT_SWATCHES } from '../data/ikeaCatalog';
import {
  handleXRLocomotion,
  handleXRSnapTurn,
  handleXRTeleport,
  triggerXRHaptics,
  handleXRGrabStart,
  handleXRGrabMove,
  handleXRGrabEnd,
  createTeleportTargetRing,
  type XRSnapTurnState,
  type XRGrabState,
} from '../three/xrInteractions';

interface StudioViewportProps {
  rooms: ApartmentRoom[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  onUpdateRoom: (roomId: string, updater: (prev: ApartmentRoom) => ApartmentRoom) => void;
  placedItems: PlacedFurnitureItem[];
  chandeliers: PlacedChandelier[];
  selectedInstanceId: string | null;
  selectedChandelierId: string | null;
  selectedWall: WallId | null;
  viewMode: ViewMode;
  lightingPreset: LightingPreset;
  autoCutaway: boolean;
  enableGridSnap: boolean;
  enableWallSnap: boolean;
  onSelectFurniture: (instanceId: string | null) => void;
  onSelectChandelier: (chandelierId: string | null) => void;
  onSelectWall: (wall: WallId | null) => void;
  onMoveFurniture: (instanceId: string, newPos: [number, number, number], newRotY: number, roomId?: string) => void;
  onMoveChandelier: (chandelierId: string, newPos: [number, number, number], roomId?: string) => void;
  onToggleAllChandeliers: () => void;
  onVrStatusChange: (status: { supported: boolean; active: boolean; message?: string }) => void;
  enterVrTriggerRef: React.MutableRefObject<(() => void) | null>;
}

export const StudioViewport: React.FC<StudioViewportProps> = ({
  rooms,
  activeRoomId,
  onSelectRoom,
  onUpdateRoom,
  placedItems,
  chandeliers,
  selectedInstanceId,
  selectedChandelierId,
  selectedWall,
  viewMode,
  lightingPreset,
  autoCutaway,
  enableGridSnap,
  enableWallSnap,
  onSelectFurniture,
  onSelectChandelier,
  onSelectWall,
  onMoveFurniture,
  onMoveChandelier,
  onToggleAllChandeliers,
  onVrStatusChange,
  enterVrTriggerRef,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [walkSpeedHint, setWalkSpeedHint] = useState(false);
  const [activeGizmoFeedback, setActiveGizmoFeedback] = useState<{
    type: 'rotate' | 'move';
    value: string;
  } | null>(null);

  const latestProps = useRef({
    rooms,
    activeRoomId,
    onSelectRoom,
    onUpdateRoom,
    placedItems,
    chandeliers,
    selectedInstanceId,
    selectedChandelierId,
    selectedWall,
    viewMode,
    lightingPreset,
    autoCutaway,
    enableGridSnap,
    enableWallSnap,
    onSelectFurniture,
    onSelectChandelier,
    onSelectWall,
    onMoveFurniture,
    onMoveChandelier,
    onToggleAllChandeliers,
  });
  latestProps.current = {
    rooms,
    activeRoomId,
    onSelectRoom,
    onUpdateRoom,
    placedItems,
    chandeliers,
    selectedInstanceId,
    selectedChandelierId,
    selectedWall,
    viewMode,
    lightingPreset,
    autoCutaway,
    enableGridSnap,
    enableWallSnap,
    onSelectFurniture,
    onSelectChandelier,
    onSelectWall,
    onMoveFurniture,
    onMoveChandelier,
    onToggleAllChandeliers,
  };

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const perspCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const xrRigRef = useRef<THREE.Group | null>(null);

  const archGroupRef = useRef<THREE.Group | null>(null);
  const furnitureRootRef = useRef<THREE.Group | null>(null);
  const chandelierRootRef = useRef<THREE.Group | null>(null);

  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  const cameraPosTupleRef = useRef<[number, number, number]>([6.5, 6.2, 7.2]);
  const rebuildArchRef = useRef<(() => void) | null>(null);

  // First-person camera state when viewMode === 'walkthrough_1to1'
  const fpPoseRef = useRef<{
    pos: THREE.Vector3;
    yaw: number;
    pitch: number;
    isFlyingIn: boolean;
    flyProgress: number;
    flyStartPos: THREE.Vector3;
    flyTargetPos: THREE.Vector3;
  }>({
    pos: new THREE.Vector3(0, 1.65, 1.15),
    yaw: 0,
    pitch: -0.05,
    isFlyingIn: false,
    flyProgress: 0,
    flyStartPos: new THREE.Vector3(6.5, 6.2, 7.2),
    flyTargetPos: new THREE.Vector3(0, 1.65, 1.15),
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1efe9);
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const glContext = renderer.getContext();
    const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info');
    const rendererName = debugInfo
      ? String(glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
      : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|Software/i.test(rendererName);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = false;
    renderer.domElement.style.touchAction = 'none';
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const perspCam = new THREE.PerspectiveCamera(50, width / height, 0.08, 120);
    perspCam.position.set(6.5, 6.2, 7.2);
    perspCameraRef.current = perspCam;

    const frustumSize = 11.5;
    const aspect = width / height;
    const orthoCam = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      80
    );
    orthoCam.position.set(0, 16, 0.001);
    orthoCam.lookAt(0, 0, 0);
    orthoCameraRef.current = orthoCam;

    const xrRig = new THREE.Group();
    xrRig.name = 'xr_user_rig';
    scene.add(xrRig);
    xrRigRef.current = xrRig;

    const controls = new OrbitControls(perspCam, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0.8, 0.7, -0.5);
    controls.minDistance = 1.4;
    controls.maxDistance = 26;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controlsRef.current = controls;

    // Exterior architectural ground patio + subtle meter grid
    const groundGeom = new THREE.PlaneGeometry(48, 48);
    groundGeom.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xe6e3dc,
      roughness: 0.95,
      metalness: 0.0,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.position.y = -0.082;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const gridHelper = new THREE.GridHelper(28, 28, 0xc8c4bc, 0xdcd9d0);
    gridHelper.position.y = -0.078;
    scene.add(gridHelper);

    // Lighting rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd8d0c5, 0.85);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.38);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(0xfff7e8, 1.85);
    sunLight.position.set(7.5, 11.0, 6.5);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = isSoftwareGl ? 512 : 2048;
    sunLight.shadow.mapSize.height = isSoftwareGl ? 512 : 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 32;
    const d = 10.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const archRoot = new THREE.Group();
    scene.add(archRoot);
    archGroupRef.current = archRoot;

    const furnitureRoot = new THREE.Group();
    scene.add(furnitureRoot);
    furnitureRootRef.current = furnitureRoot;

    const chandelierRoot = new THREE.Group();
    scene.add(chandelierRoot);
    chandelierRootRef.current = chandelierRoot;

    // Teleportation target ring for VR
    const teleportRing = createTeleportTargetRing();
    scene.userData.teleportRing = teleportRing;
    scene.add(teleportRing);

    // WebXR Controllers + Quest 2 Hand Tracking + 3D Spatial Wrist Menu
    const controllerModelFactory = new XRControllerModelFactory();
    const handModelFactory = new XRHandModelFactory();

    const xrSnapState: XRSnapTurnState = { snapLatch: false };
    const vrGrabState: XRGrabState = {
      instanceId: null,
      controller: null,
      initialObjectRotationY: 0,
      initialControllerRotationY: 0,
      initialPositionOffset: new THREE.Vector3(),
    };
    const xrControllers: THREE.XRTargetRaySpace[] = [];

    // Build 3D Spatial Wrist Menu attached to controller 0
    const buildWristMenu = () => {
      const wristGroup = new THREE.Group();
      wristGroup.position.set(0, 0.09, -0.12);
      wristGroup.rotation.x = -Math.PI / 4;

      const panelMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.14, 0.01),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 })
      );
      wristGroup.add(panelMesh);

      // 4 color buttons + 1 chandelier toggle button on wrist menu
      const colors = [
        WALL_PAINT_SWATCHES[0].hex,
        WALL_PAINT_SWATCHES[2].hex,
        WALL_PAINT_SWATCHES[4].hex,
        '#FFDB00',
      ];
      colors.forEach((hex, idx) => {
        const btn = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, 0.045, 0.016),
          new THREE.MeshStandardMaterial({ color: hex, roughness: 0.3 })
        );
        btn.position.set(-0.082 + idx * 0.055, 0.02, 0.008);
        btn.userData = {
          isWristButton: true,
          wristAction: idx === 3 ? 'toggle_chandeliers' : 'paint_wall',
          colorHex: hex,
        };
        wristGroup.add(btn);
      });

      return wristGroup;
    };

    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();

    const handleXrStartGrabOrAction = (interactor: THREE.Object3D) => {
      tempMatrix.identity().extractRotation(interactor.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(interactor.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

      // 1. Check 3D Spatial Wrist Menu buttons first
      const wristHits = raycaster.intersectObjects(xrRig.children, true);
      const wristBtnHit = wristHits.find((h) => h.object.userData?.isWristButton);
      if (wristBtnHit) {
        triggerXRHaptics(interactor, 40, 0.5);
        const { wristAction, colorHex } = wristBtnHit.object.userData as {
          wristAction?: string;
          colorHex?: string;
        };
        if (wristAction === 'toggle_chandeliers') {
          latestProps.current.onToggleAllChandeliers();
          return;
        }
        if (wristAction === 'paint_wall' && colorHex) {
          const targetRoomId = latestProps.current.activeRoomId;
          latestProps.current.onUpdateRoom(targetRoomId, (prev) => ({
            ...prev,
            walls: {
              north: { ...prev.walls.north, colorHex },
              south: { ...prev.walls.south, colorHex },
              east: { ...prev.walls.east, colorHex },
              west: { ...prev.walls.west, colorHex },
            },
          }));
          return;
        }
      }

      // 2. Check furniture objects to grab (preserves rotation & triggers grab haptic)
      if (furnitureRootRef.current) {
        const hits = raycaster.intersectObjects(furnitureRootRef.current.children, true);
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          while (obj && !obj.userData?.isFurnitureGroup) {
            obj = obj.parent;
          }
          if (obj?.userData?.instanceId) {
            const id = obj.userData.instanceId as string;
            const item = latestProps.current.placedItems.find((p) => p.instanceId === id);
            latestProps.current.onSelectFurniture(id);

            if (item) {
              const grab = handleXRGrabStart(interactor, item);
              vrGrabState.instanceId = grab.instanceId;
              vrGrabState.controller = grab.controller;
              vrGrabState.initialObjectRotationY = grab.initialObjectRotationY;
              vrGrabState.initialControllerRotationY = grab.initialControllerRotationY;
              vrGrabState.initialPositionOffset.copy(grab.initialPositionOffset);
            } else {
              vrGrabState.instanceId = id;
              vrGrabState.controller = interactor;
              vrGrabState.initialObjectRotationY = 0;
              vrGrabState.initialControllerRotationY = 0;
              triggerXRHaptics(interactor, 65, 0.7);
            }
            return;
          }
        }
      }

      // 3. Dynamic parabolic teleport execution
      const floorMeshes: THREE.Object3D[] = [];
      if (archGroupRef.current) {
        archGroupRef.current.traverse((child) => {
          if (child.userData?.isFloor) {
            floorMeshes.push(child);
          }
        });
      }
      floorMeshes.push(groundMesh);

      const teleportResult = handleXRTeleport(interactor, scene, floorMeshes, xrRig, true);
      if (teleportResult.hasValidTarget) {
        return;
      }

      if (archGroupRef.current) {
        const archHits = raycaster.intersectObjects(archGroupRef.current.children, true);
        if (archHits.length > 0 && archHits[0].object.userData?.isFloor) {
          const pt = archHits[0].point;
          xrRig.position.set(pt.x, 0, pt.z);
          triggerXRHaptics(interactor, 50, 0.6);
        }
      }
    };

    const handleXrEndGrab = () => {
      if (vrGrabState.instanceId) {
        handleXRGrabEnd(vrGrabState);
        vrGrabState.instanceId = null;
        vrGrabState.controller = null;
      }
    };

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      const laserGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -4.5),
      ]);
      const laserLine = new THREE.Line(
        laserGeom,
        new THREE.LineBasicMaterial({ color: 0x0058a3, transparent: true, opacity: 0.75 })
      );
      controller.add(laserLine);

      if (i === 0) {
        controller.add(buildWristMenu());
      }

      controller.addEventListener('connected', (event: any) => {
        controller.userData.inputSource = event.data;
      });
      controller.addEventListener('selectstart', () => handleXrStartGrabOrAction(controller));
      controller.addEventListener('selectend', handleXrEndGrab);
      xrRig.add(controller);
      xrControllers.push(controller);

      const grip = renderer.xr.getControllerGrip(i);
      grip.add(controllerModelFactory.createControllerModel(grip));
      xrRig.add(grip);

      // Quest 2 Hand Tracking (pinch = selectstart / selectend)
      const hand = renderer.xr.getHand(i);
      hand.add(handModelFactory.createHandModel(hand, 'mesh'));
      hand.addEventListener('connected', (event: any) => {
        hand.userData.inputSource = event.data;
      });
      hand.addEventListener('selectstart', () => handleXrStartGrabOrAction(hand));
      hand.addEventListener('selectend', handleXrEndGrab);
      xrRig.add(hand);
    }

    // Check WebXR support
    if ('xr' in navigator && navigator.xr) {
      navigator.xr
        .isSessionSupported('immersive-vr')
        .then((supported) => {
          onVrStatusChange({ supported, active: false });
        })
        .catch(() => {
          onVrStatusChange({ supported: false, active: false });
        });
    } else {
      onVrStatusChange({ supported: false, active: false });
    }

    // Trigger WebXR session
    let currentXrSession: XRSession | null = null;
    enterVrTriggerRef.current = async () => {
      if (!('xr' in navigator) || !navigator.xr) {
        onVrStatusChange({
          supported: false,
          active: false,
          message: 'Switched to 1:1 Interior Walkthrough (WASD + Mouse Look). Open on Meta Quest Browser for WebXR.',
        });
        return;
      }

      try {
        if (currentXrSession) {
          await currentXrSession.end();
          return;
        }
        const session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
        });
        currentXrSession = session;
        renderer.xr.enabled = true;
        await renderer.xr.setSession(session);
        xrRig.position.set(0, 0, 1.1);
        onVrStatusChange({ supported: true, active: true });

        session.addEventListener('end', () => {
          currentXrSession = null;
          renderer.xr.enabled = false;
          onVrStatusChange({ supported: true, active: false });
        });
      } catch {
        onVrStatusChange({
          supported: false,
          active: false,
          message: 'Switched to 1:1 Interior Walkthrough (WASD + Mouse Look).',
        });
      }
    };

    // Desktop Pointer Interaction:
    // - Drag furniture on floor
    // - Drag chandeliers on ceiling plane
    // - Drag 3D room wall/corner resize handles
    // - Drag window/door opening handles along wall
    // - First-person mouse look when dragging in walkthrough_1to1 mode
    const pointerNdc = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragIntersectPoint = new THREE.Vector3();

    let draggingMode:
      | { type: 'furniture'; id: string; offset: THREE.Vector3 }
      | {
          type: 'rotate_gizmo';
          id: string;
          center: THREE.Vector3;
          initialRotationY: number;
          initialPointerAngle: number;
        }
      | {
          type: 'translate_gizmo';
          id: string;
          axis: 'x' | 'z' | 'xz';
          offset: THREE.Vector3;
          origPos: [number, number, number];
        }
      | { type: 'chandelier'; id: string; offset: THREE.Vector3 }
      | {
          type: 'room_handle';
          roomId: string;
          axis: 'north' | 'south' | 'east' | 'west' | 'move';
          startPoint: THREE.Vector3;
          origRoom: ApartmentRoom;
        }
      | {
          type: 'opening_handle';
          roomId: string;
          openingId: string;
          wallId: WallId;
          startPoint: THREE.Vector3;
          origOffset: number;
        }
      | {
          type: 'fp_look';
          startX: number;
          startY: number;
          origYaw: number;
          origPitch: number;
        }
      | null = null;

    let pointerDownScreen = { x: 0, y: 0 };

    const getActiveCamera = () =>
      latestProps.current.viewMode === 'blueprint' ? orthoCam : perspCam;

    const updateNdc = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      pointerDownScreen = { x: ev.clientX, y: ev.clientY };
      updateNdc(ev);
      const cam = getActiveCamera();
      raycaster.setFromCamera(pointerNdc, cam);

      // 1. Check 3D Room Resize Handles first (in Dollhouse / Blueprint view)
      if (archGroupRef.current && latestProps.current.viewMode !== 'walkthrough_1to1') {
        const archHits = raycaster.intersectObjects(archGroupRef.current.children, true);
        const handleHit = archHits.find((h) => h.object.userData?.isRoomResizeHandle);
        if (handleHit) {
          const roomId = handleHit.object.userData.roomId as string;
          const axis = handleHit.object.userData.handleAxis as 'north' | 'south' | 'east' | 'west' | 'move';
          const origRoom = latestProps.current.rooms.find((r) => r.id === roomId);
          if (origRoom && raycaster.ray.intersectPlane(floorPlane, dragIntersectPoint)) {
            latestProps.current.onSelectRoom(roomId);
            draggingMode = {
              type: 'room_handle',
              roomId,
              axis,
              startPoint: dragIntersectPoint.clone(),
              origRoom: structuredClone(origRoom),
            };
            controls.enabled = false;
            return;
          }
        }

        // Check Window / Door Opening Handle
        const openingHit = archHits.find((h) => h.object.userData?.isOpeningHandle);
        if (openingHit) {
          const roomId = openingHit.object.userData.roomId as string;
          const openingId = openingHit.object.userData.openingId as string;
          const wallId = openingHit.object.userData.wallId as WallId;
          const room = latestProps.current.rooms.find((r) => r.id === roomId);
          const op = room?.openings.find((o) => o.id === openingId);
          if (room && op && raycaster.ray.intersectPlane(floorPlane, dragIntersectPoint)) {
            latestProps.current.onSelectRoom(roomId);
            latestProps.current.onSelectWall(wallId);
            draggingMode = {
              type: 'opening_handle',
              roomId,
              openingId,
              wallId,
              startPoint: dragIntersectPoint.clone(),
              origOffset: op.offset,
            };
            controls.enabled = false;
            return;
          }
        }
      }

      // 2. Check Chandeliers
      if (chandelierRootRef.current) {
        const chHits = raycaster.intersectObjects(chandelierRootRef.current.children, true);
        if (chHits.length > 0) {
          let obj: THREE.Object3D | null = chHits[0].object;
          while (obj && !obj.userData?.isChandelierGroup) {
            obj = obj.parent;
          }
          if (obj?.userData?.chandelierId) {
            const chId = obj.userData.chandelierId as string;
            latestProps.current.onSelectChandelier(chId);
            latestProps.current.onSelectFurniture(null);
            if (raycaster.ray.intersectPlane(floorPlane, dragIntersectPoint)) {
              const offset = new THREE.Vector3().subVectors(obj.position, dragIntersectPoint);
              draggingMode = { type: 'chandelier', id: chId, offset };
              controls.enabled = false;
            }
            return;
          }
        }
      }

      // 3. Check 3D Transform Gizmos & Furniture Items
      if (furnitureRootRef.current) {
        const hits = raycaster.intersectObjects(furnitureRootRef.current.children, true);
        if (hits.length > 0) {
          // Check if user clicked the Rotation Ring or Grab Handle Gizmo
          const rotHit = hits.find((h) => h.object.userData?.isRotationGizmo);
          if (rotHit && raycaster.ray.intersectPlane(floorPlane, dragIntersectPoint)) {
            const instId = rotHit.object.userData.instanceId as string;
            const item = latestProps.current.placedItems.find((i) => i.instanceId === instId);
            if (item) {
              latestProps.current.onSelectFurniture(instId);
              controls.enabled = false;
              const center = new THREE.Vector3(item.position[0], 0, item.position[2]);
              const initialPointerAngle = Math.atan2(
                dragIntersectPoint.x - center.x,
                dragIntersectPoint.z - center.z
              );
              draggingMode = {
                type: 'rotate_gizmo',
                id: instId,
                center,
                initialRotationY: item.rotationY,
                initialPointerAngle,
              };
              setActiveGizmoFeedback({ type: 'rotate', value: `${item.rotationY}°` });
              return;
            }
          }

          // Check if user clicked the Translation Axis Arrows (X or Z or XZ)
          const transHit = hits.find((h) => h.object.userData?.isTranslateGizmo);
          if (transHit && raycaster.ray.intersectPlane(floorPlane, dragIntersectPoint)) {
            const instId = transHit.object.userData.instanceId as string;
            const axis = transHit.object.userData.axis as 'x' | 'z' | 'xz';
            const item = latestProps.current.placedItems.find((i) => i.instanceId === instId);
            if (item) {
              latestProps.current.onSelectFurniture(instId);
              controls.enabled = false;
              draggingMode = {
                type: 'translate_gizmo',
                id: instId,
                axis,
                offset: new THREE.Vector3(item.position[0] - dragIntersectPoint.x, 0, item.position[2] - dragIntersectPoint.z),
                origPos: [...item.position],
              };
              setActiveGizmoFeedback({ type: 'move', value: `${item.position[0]}m, ${item.position[2]}m` });
              return;
            }
          }

          let obj: THREE.Object3D | null = hits[0].object;
          while (obj && !obj.userData?.isFurnitureGroup) {
            obj = obj.parent;
          }
          if (obj?.userData?.instanceId) {
            const instanceId = obj.userData.instanceId as string;
            latestProps.current.onSelectFurniture(instanceId);
            latestProps.current.onSelectChandelier(null);
            latestProps.current.onSelectWall(null);

            if (raycaster.ray.intersectPlane(floorPlane, dragIntersectPoint)) {
              const offset = new THREE.Vector3().subVectors(obj.position, dragIntersectPoint);
              draggingMode = { type: 'furniture', id: instanceId, offset };
              controls.enabled = false;
            }
            return;
          }
        }
      }

      // 4. If in 1:1 Walkthrough mode, dragging empty space rotates first-person look
      if (latestProps.current.viewMode === 'walkthrough_1to1') {
        draggingMode = {
          type: 'fp_look',
          startX: ev.clientX,
          startY: ev.clientY,
          origYaw: fpPoseRef.current.yaw,
          origPitch: fpPoseRef.current.pitch,
        };
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!draggingMode) return;
      updateNdc(ev);
      const cam = getActiveCamera();
      raycaster.setFromCamera(pointerNdc, cam);

      if (draggingMode.type === 'fp_look') {
        const dx = ev.clientX - draggingMode.startX;
        const dy = ev.clientY - draggingMode.startY;
        fpPoseRef.current.yaw = draggingMode.origYaw - dx * 0.0045;
        fpPoseRef.current.pitch = Math.max(
          -Math.PI / 2.6,
          Math.min(Math.PI / 2.6, draggingMode.origPitch - dy * 0.004)
        );
        return;
      }

      if (!raycaster.ray.intersectPlane(floorPlane, dragIntersectPoint)) return;

      if (draggingMode.type === 'rotate_gizmo') {
        const mode = draggingMode;
        const currentAngle = Math.atan2(
          dragIntersectPoint.x - mode.center.x,
          dragIntersectPoint.z - mode.center.z
        );
        let diff = currentAngle - mode.initialPointerAngle;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;

        const deltaDeg = (diff * 180) / Math.PI;
        let nextRot = (mode.initialRotationY + deltaDeg) % 360;
        if (nextRot < 0) nextRot += 360;
        if (latestProps.current.enableGridSnap) {
          nextRot = Math.round(nextRot / 15) * 15;
          if (nextRot >= 360) nextRot = 0;
        } else {
          nextRot = Math.round(nextRot);
        }
        const item = latestProps.current.placedItems.find((i) => i.instanceId === mode.id);
        if (item) {
          latestProps.current.onMoveFurniture(item.instanceId, item.position, nextRot, item.roomId);
          setActiveGizmoFeedback({ type: 'rotate', value: `${nextRot}°` });
        }
        return;
      }

      if (draggingMode.type === 'translate_gizmo') {
        const mode = draggingMode;
        const item = latestProps.current.placedItems.find((i) => i.instanceId === mode.id);
        if (!item) return;

        const rawX =
          mode.axis === 'z'
            ? mode.origPos[0]
            : dragIntersectPoint.x + mode.offset.x;
        const rawZ =
          mode.axis === 'x'
            ? mode.origPos[2]
            : dragIntersectPoint.z + mode.offset.z;

        const targetRoom = findRoomForPoint(rawX, rawZ, latestProps.current.rooms);
        const localX = rawX - targetRoom.position[0];
        const localZ = rawZ - targetRoom.position[1];

        const snapped = snapFurnitureToRoom(
          [localX, 0, localZ],
          item.rotationY,
          item.product.dimensionsCm,
          {
            width: targetRoom.width,
            length: targetRoom.length,
            enableGridSnap: latestProps.current.enableGridSnap,
            enableWallSnap: latestProps.current.enableWallSnap,
          }
        );

        const finalX =
          mode.axis === 'z'
            ? mode.origPos[0]
            : Number((targetRoom.position[0] + snapped.position[0]).toFixed(2));
        const finalZ =
          mode.axis === 'x'
            ? mode.origPos[2]
            : Number((targetRoom.position[1] + snapped.position[2]).toFixed(2));

        latestProps.current.onMoveFurniture(
          item.instanceId,
          [finalX, 0, finalZ],
          snapped.rotationY,
          targetRoom.id
        );
        setActiveGizmoFeedback({ type: 'move', value: `X: ${finalX}m, Z: ${finalZ}m` });
        return;
      }

      if (draggingMode.type === 'furniture') {
        const draggedId = draggingMode.id;
        const rawX = dragIntersectPoint.x + draggingMode.offset.x;
        const rawZ = dragIntersectPoint.z + draggingMode.offset.z;
        const item = latestProps.current.placedItems.find((i) => i.instanceId === draggedId);
        if (!item) return;

        const targetRoom = findRoomForPoint(rawX, rawZ, latestProps.current.rooms);
        const localX = rawX - targetRoom.position[0];
        const localZ = rawZ - targetRoom.position[1];

        const snapped = snapFurnitureToRoom(
          [localX, 0, localZ],
          item.rotationY,
          item.product.dimensionsCm,
          {
            width: targetRoom.width,
            length: targetRoom.length,
            enableGridSnap: latestProps.current.enableGridSnap,
            enableWallSnap: latestProps.current.enableWallSnap,
          }
        );

        latestProps.current.onMoveFurniture(
          draggingMode.id,
          [
            Number((targetRoom.position[0] + snapped.position[0]).toFixed(2)),
            0,
            Number((targetRoom.position[1] + snapped.position[2]).toFixed(2)),
          ],
          snapped.rotationY,
          targetRoom.id
        );
      } else if (draggingMode.type === 'chandelier') {
        const rawX = dragIntersectPoint.x + draggingMode.offset.x;
        const rawZ = dragIntersectPoint.z + draggingMode.offset.z;
        const targetRoom = findRoomForPoint(rawX, rawZ, latestProps.current.rooms);
        const clampedX = Math.max(
          targetRoom.position[0] - targetRoom.width / 2 + 0.4,
          Math.min(targetRoom.position[0] + targetRoom.width / 2 - 0.4, rawX)
        );
        const clampedZ = Math.max(
          targetRoom.position[1] - targetRoom.length / 2 + 0.4,
          Math.min(targetRoom.position[1] + targetRoom.length / 2 - 0.4, rawZ)
        );
        latestProps.current.onMoveChandelier(
          draggingMode.id,
          [Number(clampedX.toFixed(2)), targetRoom.height, Number(clampedZ.toFixed(2))],
          targetRoom.id
        );
      } else if (draggingMode.type === 'room_handle') {
        const dx = dragIntersectPoint.x - draggingMode.startPoint.x;
        const dz = dragIntersectPoint.z - draggingMode.startPoint.z;
        const orig = draggingMode.origRoom;
        const axis = draggingMode.axis;

        latestProps.current.onUpdateRoom(draggingMode.roomId, (prev) => {
          if (axis === 'move') {
            return {
              ...prev,
              position: [
                Number((orig.position[0] + dx).toFixed(2)),
                Number((orig.position[1] + dz).toFixed(2)),
              ],
            };
          }
          if (axis === 'east' || axis === 'west') {
            const sign = axis === 'east' ? 1 : -1;
            const newW = Math.max(2.2, Math.min(12.0, Number((orig.width + dx * sign).toFixed(2))));
            const shiftX = ((newW - orig.width) / 2) * sign;
            return {
              ...prev,
              width: newW,
              position: [Number((orig.position[0] + shiftX).toFixed(2)), orig.position[1]],
            };
          } else {
            const sign = axis === 'south' ? 1 : -1;
            const newL = Math.max(2.2, Math.min(12.0, Number((orig.length + dz * sign).toFixed(2))));
            const shiftZ = ((newL - orig.length) / 2) * sign;
            return {
              ...prev,
              length: newL,
              position: [orig.position[0], Number((orig.position[1] + shiftZ).toFixed(2))],
            };
          }
        });
      } else if (draggingMode.type === 'opening_handle') {
        const dx = dragIntersectPoint.x - draggingMode.startPoint.x;
        const dz = dragIntersectPoint.z - draggingMode.startPoint.z;
        const deltaAlong =
          draggingMode.wallId === 'north' || draggingMode.wallId === 'south' ? dx : dz;
        const { roomId, openingId, origOffset } = draggingMode;

        latestProps.current.onUpdateRoom(roomId, (prev) => ({
          ...prev,
          openings: prev.openings.map((o) =>
            o.id === openingId
              ? { ...o, offset: Number((origOffset + deltaAlong).toFixed(2)) }
              : o
          ),
        }));
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      const distMoved = Math.hypot(ev.clientX - pointerDownScreen.x, ev.clientY - pointerDownScreen.y);

      if (draggingMode) {
        draggingMode = null;
        setActiveGizmoFeedback(null);
        if (latestProps.current.viewMode !== 'walkthrough_1to1') {
          controls.enabled = true;
        }
        return;
      }

      if (distMoved < 6 && archGroupRef.current) {
        updateNdc(ev);
        const cam = getActiveCamera();
        raycaster.setFromCamera(pointerNdc, cam);
        const archHits = raycaster.intersectObjects(archGroupRef.current.children, true);
        if (archHits.length > 0) {
          const hitObj = archHits[0].object;
          if (hitObj.userData?.roomId) {
            latestProps.current.onSelectRoom(hitObj.userData.roomId as string);
          }
          if (hitObj.userData?.isWall && hitObj.userData?.wallId) {
            latestProps.current.onSelectWall(hitObj.userData.wallId as WallId);
            latestProps.current.onSelectFurniture(null);
            latestProps.current.onSelectChandelier(null);
            return;
          }
        }
        latestProps.current.onSelectFurniture(null);
        latestProps.current.onSelectChandelier(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Keyboard WASD / Arrows walking in 1:1 Walkthrough & Orbit pan
    const keysPressed = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      keysPressed.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        setWalkSpeedHint(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      perspCam.aspect = w / h;
      perspCam.updateProjectionMatrix();

      const asp = w / h;
      orthoCam.left = (-frustumSize * asp) / 2;
      orthoCam.right = (frustumSize * asp) / 2;
      orthoCam.top = frustumSize / 2;
      orthoCam.bottom = -frustumSize / 2;
      orthoCam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // Render loop
    const clock = new THREE.Clock();
    let lastCutawayKey = '';

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.1);
      const isXrPresenting = renderer.xr.isPresenting;
      const mode = latestProps.current.viewMode;

      if (!isXrPresenting) {
        if (mode === 'walkthrough_1to1') {
          controls.enabled = false;
          const fp = fpPoseRef.current;

          if (fp.isFlyingIn) {
            fp.flyProgress = Math.min(1, fp.flyProgress + dt * 1.8);
            const t = 1 - Math.pow(1 - fp.flyProgress, 3);
            fp.pos.lerpVectors(fp.flyStartPos, fp.flyTargetPos, t);
            if (fp.flyProgress >= 1) {
              fp.isFlyingIn = false;
            }
          }

          // WASD / Arrow first-person walking at human eye level y = 1.65m
          const speed = (keysPressed.has('ShiftLeft') ? 4.4 : 2.6) * dt;
          const forward = new THREE.Vector3(-Math.sin(fp.yaw), 0, -Math.cos(fp.yaw));
          const right = new THREE.Vector3(Math.cos(fp.yaw), 0, -Math.sin(fp.yaw));

          if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp')) {
            fp.pos.addScaledVector(forward, speed);
          }
          if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown')) {
            fp.pos.addScaledVector(forward, -speed);
          }
          if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight')) {
            fp.pos.addScaledVector(right, speed);
          }
          if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft')) {
            fp.pos.addScaledVector(right, -speed);
          }
          fp.pos.y = 1.65;

          perspCam.position.copy(fp.pos);
          const lookTarget = new THREE.Vector3(
            fp.pos.x - Math.sin(fp.yaw) * Math.cos(fp.pitch),
            fp.pos.y + Math.sin(fp.pitch),
            fp.pos.z - Math.cos(fp.yaw) * Math.cos(fp.pitch)
          );
          perspCam.lookAt(lookTarget);
        } else {
          controls.enabled = draggingMode === null;
          controls.update();

          // Optional WASD pan in Dollhouse mode
          if (keysPressed.size > 0) {
            const moveSpeed = 3.2 * dt;
            const forward = new THREE.Vector3();
            perspCam.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();
            const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

            if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp')) {
              perspCam.position.addScaledVector(forward, moveSpeed);
              controls.target.addScaledVector(forward, moveSpeed);
            }
            if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown')) {
              perspCam.position.addScaledVector(forward, -moveSpeed);
              controls.target.addScaledVector(forward, -moveSpeed);
            }
            if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight')) {
              perspCam.position.addScaledVector(right, moveSpeed);
              controls.target.addScaledVector(right, moveSpeed);
            }
            if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft')) {
              perspCam.position.addScaledVector(right, -moveSpeed);
              controls.target.addScaledVector(right, -moveSpeed);
            }
          }
        }

        // Dynamic wall cutaway check in Dollhouse mode
        const camPos: [number, number, number] = [
          perspCam.position.x,
          perspCam.position.y,
          perspCam.position.z,
        ];
        cameraPosTupleRef.current = camPos;
        const cutawayKey = `${mode}_${Math.round(camPos[0])}_${Math.round(camPos[2])}_${latestProps.current.autoCutaway}`;
        if (cutawayKey !== lastCutawayKey) {
          lastCutawayKey = cutawayKey;
          rebuildArchRef.current?.();
        }
      } else {
        // WebXR session active: heading-relative locomotion, 45° snap-turn, teleport arc & grabbed furniture tracking
        const session = renderer.xr.getSession();
        const hmdCamera = renderer.xr.getCamera();

        if (session) {
          // 1. Heading-relative locomotion: joystick directions aligned with user's HMD gaze direction
          handleXRLocomotion(session, xrRig, hmdCamera, dt);

          // 2. 45° Snap-turning on right controller thumbstick
          for (const source of session.inputSources) {
            if (source.handedness === 'right' || session.inputSources.length === 1) {
              if (source.gamepad) {
                handleXRSnapTurn(source.gamepad, xrRig, xrSnapState, Math.PI / 4, hmdCamera);
              }
            }
          }
        }

        // 3. Track grabbed furniture preserving orientation & wrist rotation
        if (vrGrabState.instanceId && vrGrabState.controller) {
          tempMatrix.identity().extractRotation(vrGrabState.controller.matrixWorld);
          raycaster.ray.origin.setFromMatrixPosition(vrGrabState.controller.matrixWorld);
          raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
          if (raycaster.ray.intersectPlane(floorPlane, dragIntersectPoint)) {
            const targetRoom = findRoomForPoint(dragIntersectPoint.x, dragIntersectPoint.z, latestProps.current.rooms);
            const { pos, rotY } = handleXRGrabMove(
              vrGrabState,
              vrGrabState.controller,
              dragIntersectPoint,
              true
            );

            latestProps.current.onMoveFurniture(
              vrGrabState.instanceId,
              pos,
              rotY,
              targetRoom.id
            );
          }
        } else {
          // 4. Update dynamic parabolic teleport arc & visible ground target ring when aiming
          const floorMeshes: THREE.Object3D[] = [];
          if (archGroupRef.current) {
            archGroupRef.current.traverse((child) => {
              if (child.userData?.isFloor) {
                floorMeshes.push(child);
              }
            });
          }
          floorMeshes.push(groundMesh);

          for (const ctrl of xrControllers) {
            handleXRTeleport(ctrl, scene, floorMeshes, xrRig, false);
          }
        }
      }

      const activeCamera =
        mode === 'blueprint' && !isXrPresenting ? orthoCam : perspCam;
      renderer.render(scene, activeCamera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  // Rebuild Multi-Room Apartment Architecture
  useEffect(() => {
    const rebuild = () => {
      const archRoot = archGroupRef.current;
      if (!archRoot) return;
      archRoot.clear();

      const built = buildApartmentArchitecture(
        rooms,
        activeRoomId,
        cameraPosTupleRef.current,
        [0, 0, 0],
        viewMode === 'blueprint' ? false : autoCutaway,
        viewMode === 'walkthrough_1to1',
        selectedWall
      );
      archRoot.add(built);

      if (sceneRef.current && rendererRef.current && perspCameraRef.current && orthoCameraRef.current) {
        const activeCam = viewMode === 'blueprint' ? orthoCameraRef.current : perspCameraRef.current;
        rendererRef.current.render(sceneRef.current, activeCam);
      }
    };
    rebuildArchRef.current = rebuild;
    rebuild();
  }, [rooms, activeRoomId, autoCutaway, selectedWall, viewMode]);

  // Rebuild Placed Furniture
  useEffect(() => {
    const furnitureRoot = furnitureRootRef.current;
    if (!furnitureRoot) return;
    furnitureRoot.clear();

    for (const item of placedItems) {
      const group = buildFurnitureGroup(item, item.instanceId === selectedInstanceId);
      furnitureRoot.add(group);
    }

    if (sceneRef.current && rendererRef.current && perspCameraRef.current && orthoCameraRef.current) {
      const activeCam = viewMode === 'blueprint' ? orthoCameraRef.current : perspCameraRef.current;
      rendererRef.current.render(sceneRef.current, activeCam);
    }
  }, [placedItems, selectedInstanceId, viewMode]);

  // Rebuild Ceiling Chandeliers
  useEffect(() => {
    const chRoot = chandelierRootRef.current;
    if (!chRoot) return;
    chRoot.clear();

    for (const ch of chandeliers) {
      const room = rooms.find((r) => r.id === ch.roomId) || rooms[0];
      const group = buildChandelierGroup(ch, room, ch.instanceId === selectedChandelierId);
      chRoot.add(group);
    }

    if (sceneRef.current && rendererRef.current && perspCameraRef.current && orthoCameraRef.current) {
      const activeCam = viewMode === 'blueprint' ? orthoCameraRef.current : perspCameraRef.current;
      rendererRef.current.render(sceneRef.current, activeCam);
    }
  }, [chandeliers, rooms, selectedChandelierId, viewMode]);

  // Update ViewMode & Smooth Camera Fly-In to 1:1 Interior Eye Level (y = 1.65m)
  useEffect(() => {
    const perspCam = perspCameraRef.current;
    const controls = controlsRef.current;
    if (!perspCam || !controls) return;

    const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0];

    if (viewMode === 'walkthrough_1to1') {
      fpPoseRef.current.flyStartPos.copy(perspCam.position);
      fpPoseRef.current.flyTargetPos.set(
        activeRoom.position[0],
        1.65,
        activeRoom.position[1] + activeRoom.length * 0.25
      );
      fpPoseRef.current.pos.copy(fpPoseRef.current.flyStartPos);
      fpPoseRef.current.yaw = 0;
      fpPoseRef.current.pitch = -0.04;
      fpPoseRef.current.flyProgress = 0;
      fpPoseRef.current.isFlyingIn = true;
    } else if (viewMode === 'orbit') {
      perspCam.position.set(
        activeRoom.position[0] + 5.8,
        5.8,
        activeRoom.position[1] + 6.4
      );
      controls.target.set(activeRoom.position[0], 0.7, activeRoom.position[1]);
      controls.update();
    }
  }, [viewMode]);

  // Update Lighting Presets
  useEffect(() => {
    const scene = sceneRef.current;
    const sun = sunLightRef.current;
    const hemi = hemiLightRef.current;
    const amb = ambientLightRef.current;
    if (!scene || !sun || !hemi || !amb) return;

    if (lightingPreset === 'Nordic Morning Sun') {
      scene.background = new THREE.Color(0xf1efe9);
      sun.color.setHex(0xfff7e8);
      sun.intensity = 1.9;
      sun.position.set(7.5, 11.0, 6.5);
      hemi.intensity = 0.85;
      amb.intensity = 0.38;
    } else if (lightingPreset === 'Golden Hour') {
      scene.background = new THREE.Color(0xeae2d6);
      sun.color.setHex(0xffbe7b);
      sun.intensity = 2.1;
      sun.position.set(9.5, 4.5, 7.2);
      hemi.intensity = 0.6;
      amb.intensity = 0.3;
    } else if (lightingPreset === 'Cozy Evening Lamps') {
      scene.background = new THREE.Color(0x1f2430);
      sun.color.setHex(0x6b88b8);
      sun.intensity = 0.35;
      sun.position.set(-5, 8, -5);
      hemi.intensity = 0.28;
      amb.intensity = 0.22;
    } else {
      scene.background = new THREE.Color(0xe7eaee);
      sun.color.setHex(0xffffff);
      sun.intensity = 1.05;
      sun.position.set(2, 13, 2);
      hemi.intensity = 1.1;
      amb.intensity = 0.55;
    }
  }, [lightingPreset]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none touch-none">
      <div ref={containerRef} className="w-full h-full touch-none" />

      {/* Subtle First-Person Controls Banner when inside 1:1 Walkthrough */}
      {viewMode === 'walkthrough_1to1' && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-[#111111]/85 text-white px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-3 shadow-lg">
          <span className="text-[#FFDB00] font-bold">1:1 INTERIOR WALKTHROUGH (Eye Level 1.65m)</span>
          <span>•</span>
          <span>WASD / Arrows to Walk</span>
          <span>•</span>
          <span>Drag Mouse to Look Around</span>
          <span>•</span>
          <span>Click & Drag Furniture to Move</span>
          {walkSpeedHint && <span className="text-emerald-300 font-semibold">• Walking Active</span>}
        </div>
      )}

      {/* Real-time 3D Transform Gizmo Feedback Badge */}
      {activeGizmoFeedback && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-20 bg-[#111111]/92 backdrop-blur-md text-white border-2 border-[#FFDB00] px-4 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <span className="text-[#FFDB00] uppercase tracking-wider">
            {activeGizmoFeedback.type === 'rotate' ? '3D Rotation' : '3D Translation'}
          </span>
          <span className="text-[#888888]">•</span>
          <span className="text-white text-sm">{activeGizmoFeedback.value}</span>
        </div>
      )}
    </div>
  );
};
