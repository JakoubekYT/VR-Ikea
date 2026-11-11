import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PlacedFurniture, RoomConfig, WallId } from '../types/ikea';
import { buildRoomArchitecture, BuiltRoomRefs } from '../three/roomArchitectureBuilder';
import { buildFurnitureGroup } from '../three/furnitureBuilder';
import { clampToRoomBounds, computeWallCutaway, snapToGrid } from '../utils/roomLogic';

export type CameraMode = 'orbit3d' | 'floorplan2d' | 'vr_walkthrough';

interface StudioViewportProps {
  roomConfig: RoomConfig;
  placedFurniture: PlacedFurniture[];
  selectedInstanceId: string | null;
  cameraMode: CameraMode;
  gridSnap: boolean;
  vrSessionRequestCounter: number;
  vrModeType: 'immersive-vr' | 'immersive-ar';
  remoteVrCursor: { position: [number, number, number]; targetInstanceId: string | null } | null;
  onSelectFurniture: (instanceId: string | null) => void;
  onMoveFurniture: (instanceId: string, newPosition: [number, number, number], newRotationY?: number) => void;
  onToggleVrPriceTag: (instanceId: string) => void;
  onBroadcastVrCursor: (position: [number, number, number], targetInstanceId: string | null) => void;
  onWebXrStatusChange?: (status: string) => void;
}

const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();
const _floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _intersectPt = new THREE.Vector3();
const _tempMatrix = new THREE.Matrix4();
const _vrRayOrigin = new THREE.Vector3();
const _vrRayDir = new THREE.Vector3();

export const StudioViewport: React.FC<StudioViewportProps> = ({
  roomConfig,
  placedFurniture,
  selectedInstanceId,
  cameraMode,
  gridSnap,
  vrSessionRequestCounter,
  vrModeType,
  remoteVrCursor,
  onSelectFurniture,
  onMoveFurniture,
  onToggleVrPriceTag,
  onBroadcastVrCursor,
  onWebXrStatusChange,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props & callbacks in refs so WebGL scene never tears down on React state updates
  const stateRef = useRef({
    roomConfig,
    placedFurniture,
    selectedInstanceId,
    cameraMode,
    gridSnap,
    onSelectFurniture,
    onMoveFurniture,
    onToggleVrPriceTag,
    onBroadcastVrCursor,
    onWebXrStatusChange,
  });
  stateRef.current = {
    roomConfig,
    placedFurniture,
    selectedInstanceId,
    cameraMode,
    gridSnap,
    onSelectFurniture,
    onMoveFurniture,
    onToggleVrPriceTag,
    onBroadcastVrCursor,
    onWebXrStatusChange,
  };

  const sceneApiRef = useRef<{
    requestRender: () => void;
    rebuildRoom: () => void;
    rebuildFurniture: () => void;
    updateCameraMode: (mode: CameraMode) => void;
    updateRemoteCursor: (cursor: { position: [number, number, number]; targetInstanceId: string | null } | null) => void;
    startWebXrSession: (mode: 'immersive-vr' | 'immersive-ar') => void;
  } | null>(null);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL detection per Three.js skill directive
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.domElement.setAttribute('data-testid', 'studio-webgl-canvas');
    renderer.domElement.className = 'w-full h-full block outline-none cursor-grab active:cursor-grabbing';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene & Studio Environment Map (RoomEnvironment + PMREMGenerator)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeceae4);
    scene.fog = new THREE.FogExp2(0xeceae4, 0.018);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Cameras (Perspective for 3D Orbit & VR Walkthrough, Orthographic for 2D Floorplan)
    const perspCamera = new THREE.PerspectiveCamera(48, width / height, 0.1, 80);
    perspCamera.position.set(5.4, 4.6, 6.2);

    const aspect = width / height;
    const frustumSize = 8.5;
    const orthoCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      50
    );
    orthoCamera.position.set(0, 12, 0);
    orthoCamera.up.set(0, 0, -1);
    orthoCamera.lookAt(0, 0, 0);

    let activeCamera: THREE.Camera = perspCamera;

    const controls = new OrbitControls(perspCamera, renderer.domElement);
    controls.enableDamping = false; // Crisp immediate render-on-demand
    controls.target.set(0, 0.85, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 1.2;
    controls.maxDistance = 18;
    controls.update();

    // 4. Studio & Architectural Lighting Rig (Warm Sun Key Light + Cool Hemisphere Fill + Rim)
    const hemiLight = new THREE.HemisphereLight(0xeef5ff, 0xd8cbb8, 0.85);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e4, 1.95);
    sunLight.position.set(5.5, 8.5, 4.5);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    const shadowBound = 6.5;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 25;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xdbe8ff, 0.55);
    fillLight.position.set(-5, 5, -4);
    scene.add(fillLight);

    // 5. Scene Groups
    const architectureHolder = new THREE.Group();
    scene.add(architectureHolder);

    const furnitureHolder = new THREE.Group();
    scene.add(furnitureHolder);

    // Teleport Ring & Remote VR Co-op Avatar Cursor
    const teleportRing = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.24, 32),
      new THREE.MeshBasicMaterial({
        color: 0x0058a3,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    teleportRing.rotation.x = -Math.PI / 2;
    teleportRing.position.y = 0.008;
    teleportRing.visible = false;
    scene.add(teleportRing);

    const remoteAvatarGroup = new THREE.Group();
    const headsetBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x0058a3, roughness: 0.3, metalness: 0.4 })
    );
    headsetBox.position.set(0, 1.65, 0);
    remoteAvatarGroup.add(headsetBox);
    const laserBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 2.0, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdb00 })
    );
    laserBeam.rotation.x = Math.PI / 2;
    laserBeam.position.set(0, 1.3, 0.9);
    remoteAvatarGroup.add(laserBeam);
    remoteAvatarGroup.visible = false;
    scene.add(remoteAvatarGroup);

    let builtRoomRefs: BuiltRoomRefs | null = null;
    let interactableProxies: THREE.Object3D[] = [];

    // 6. On-demand Render Coalescing + Software-WebGL Pacing
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function updateWallCutawayVisibility() {
      if (!builtRoomRefs) return;
      const cfg = stateRef.current.roomConfig;
      const mode = stateRef.current.cameraMode;
      if (mode === 'floorplan2d' || mode === 'vr_walkthrough') {
        (['north', 'south', 'east', 'west'] as WallId[]).forEach((wid) => {
          builtRoomRefs!.wallGroups[wid].visible = true;
        });
        return;
      }
      const cutaway = computeWallCutaway(
        [perspCamera.position.x, perspCamera.position.y, perspCamera.position.z],
        cfg.width,
        cfg.length,
        cfg.smartWallCutaway
      );
      (['north', 'south', 'east', 'west'] as WallId[]).forEach((wid) => {
        builtRoomRefs!.wallGroups[wid].visible = !cutaway[wid];
      });
    }

    function requestRender() {
      if (renderer.xr.isPresenting) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        updateWallCutawayVisibility();
        renderer.render(scene, activeCamera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    // 7. Rebuild Room & Lighting based on RoomConfig
    function rebuildRoom() {
      const cfg = stateRef.current.roomConfig;
      // Update Time of Day atmosphere
      if (cfg.timeOfDay === 'Daylight') {
        scene.background = new THREE.Color(0xeceae4);
        scene.fog = new THREE.FogExp2(0xeceae4, 0.016);
        sunLight.color.setHex(0xfff6e5);
        sunLight.intensity = 2.0;
        sunLight.position.set(5.5, 8.5, 4.5);
        hemiLight.color.setHex(0xeef5ff);
        hemiLight.groundColor.setHex(0xd8cbb8);
        hemiLight.intensity = 0.9;
      } else if (cfg.timeOfDay === 'Golden Hour Sunset') {
        scene.background = new THREE.Color(0xe6d5c3);
        scene.fog = new THREE.FogExp2(0xe6d5c3, 0.018);
        sunLight.color.setHex(0xff9e54);
        sunLight.intensity = 2.2;
        sunLight.position.set(7.5, 3.6, 5.0);
        hemiLight.color.setHex(0xffd4b2);
        hemiLight.groundColor.setHex(0x8a6d5b);
        hemiLight.intensity = 0.72;
      } else {
        // Cozy Evening
        scene.background = new THREE.Color(0x1e2430);
        scene.fog = new THREE.FogExp2(0x1e2430, 0.022);
        sunLight.color.setHex(0x6c88b5);
        sunLight.intensity = 0.35;
        sunLight.position.set(-4.0, 7.0, -4.0);
        hemiLight.color.setHex(0x415370);
        hemiLight.groundColor.setHex(0x2b2623);
        hemiLight.intensity = 0.42;
      }

      architectureHolder.clear();
      builtRoomRefs = buildRoomArchitecture(
        cfg,
        stateRef.current.gridSnap,
        isSoftwareGl,
        maxAnisotropy
      );
      architectureHolder.add(builtRoomRefs.rootGroup);
      requestRender();
    }

    // 8. Rebuild Placed Furniture
    function rebuildFurniture() {
      furnitureHolder.clear();
      interactableProxies = [];
      const { placedFurniture: list, selectedInstanceId: selId, roomConfig: cfg } = stateRef.current;

      for (const item of list) {
        const group = buildFurnitureGroup(
          item,
          item.instanceId === selId,
          isSoftwareGl,
          cfg.timeOfDay
        );
        furnitureHolder.add(group);
        group.traverse((child) => {
          if (child.userData?.isHitProxy) {
            interactableProxies.push(child);
          }
        });
      }
      requestRender();
    }

    // 9. Camera Mode Switcher
    function updateCameraMode(mode: CameraMode) {
      const cfg = stateRef.current.roomConfig;
      if (mode === 'floorplan2d') {
        const currentAspect =
          (container?.clientWidth || window.innerWidth) /
          (container?.clientHeight || window.innerHeight);
        const span = Math.max(cfg.width, cfg.length) * 1.35;
        orthoCamera.left = (-span * currentAspect) / 2;
        orthoCamera.right = (span * currentAspect) / 2;
        orthoCamera.top = span / 2;
        orthoCamera.bottom = -span / 2;
        orthoCamera.updateProjectionMatrix();
        activeCamera = orthoCamera;
        controls.enabled = false;
        teleportRing.visible = false;
      } else if (mode === 'vr_walkthrough') {
        activeCamera = perspCamera;
        perspCamera.position.set(0, 1.65, cfg.length * 0.36);
        controls.target.set(0, 1.45, -0.5);
        controls.minDistance = 0.1;
        controls.maxDistance = 4.0;
        controls.enabled = true;
        controls.update();
        teleportRing.visible = true;
      } else {
        activeCamera = perspCamera;
        perspCamera.position.set(cfg.width * 0.88, cfg.ceilingHeight * 1.55, cfg.length * 1.08);
        controls.target.set(0, 0.85, 0);
        controls.minDistance = 1.2;
        controls.maxDistance = 18;
        controls.enabled = true;
        controls.update();
        teleportRing.visible = false;
      }
      requestRender();
    }

    // 10. Pointer Raycasting (Select, Drag Furniture on Floor, Teleport in VR Preview, Double-Click VR Price Tag)
    let draggingInstanceId: string | null = null;
    const dragOffset = new THREE.Vector3();
    let pointerDownPos = { x: 0, y: 0 };

    function updateMouseCoords(e: PointerEvent | MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      updateMouseCoords(e);
      _raycaster.setFromCamera(_mouse, activeCamera);

      const hits = _raycaster.intersectObjects(interactableProxies, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData?.instanceId as string;
        if (hitId) {
          stateRef.current.onSelectFurniture(hitId);
          const item = stateRef.current.placedFurniture.find((f) => f.instanceId === hitId);
          if (item && _raycaster.ray.intersectPlane(_floorPlane, _intersectPt)) {
            draggingInstanceId = hitId;
            dragOffset.set(item.position[0] - _intersectPt.x, 0, item.position[2] - _intersectPt.z);
            controls.enabled = false;
          }
          return;
        }
      }
    }

    let lastMoveTime = 0;
    function onPointerMove(e: PointerEvent) {
      const now = performance.now();
      if (now - lastMoveTime < 24) return;
      lastMoveTime = now;

      updateMouseCoords(e);
      _raycaster.setFromCamera(_mouse, activeCamera);

      if (draggingInstanceId) {
        if (_raycaster.ray.intersectPlane(_floorPlane, _intersectPt)) {
          const item = stateRef.current.placedFurniture.find((f) => f.instanceId === draggingInstanceId);
          if (!item) return;
          let nx = _intersectPt.x + dragOffset.x;
          let nz = _intersectPt.z + dragOffset.z;
          if (stateRef.current.gridSnap) {
            nx = snapToGrid(nx, 0.25);
            nz = snapToGrid(nz, 0.25);
          }
          const clamped = clampToRoomBounds(
            [nx, 0, nz],
            {
              width: item.spec3D.overallDimensionsMeters.width * item.scale,
              depth: item.spec3D.overallDimensionsMeters.depth * item.scale,
            },
            item.rotationY,
            stateRef.current.roomConfig.width,
            stateRef.current.roomConfig.length
          );
          stateRef.current.onMoveFurniture(draggingInstanceId, clamped);
        }
        return;
      }

      // In VR Walkthrough mode, move teleport ring on floor & broadcast VR cursor to Co-op Operator
      if (stateRef.current.cameraMode === 'vr_walkthrough') {
        const hits = _raycaster.intersectObjects(interactableProxies, false);
        const targetId = hits.length > 0 ? (hits[0].object.userData?.instanceId as string) : null;
        if (_raycaster.ray.intersectPlane(_floorPlane, _intersectPt)) {
          const cfg = stateRef.current.roomConfig;
          const tx = Math.max(-cfg.width / 2 + 0.3, Math.min(cfg.width / 2 - 0.3, _intersectPt.x));
          const tz = Math.max(-cfg.length / 2 + 0.3, Math.min(cfg.length / 2 - 0.3, _intersectPt.z));
          teleportRing.position.set(tx, 0.008, tz);
          teleportRing.visible = true;
          stateRef.current.onBroadcastVrCursor([Number(tx.toFixed(2)), 0, Number(tz.toFixed(2))], targetId);
          requestRender();
        }
      }
    }

    function onPointerUp(e: PointerEvent) {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (draggingInstanceId) {
        draggingInstanceId = null;
        if (stateRef.current.cameraMode !== 'floorplan2d') {
          controls.enabled = true;
        }
        return;
      }

      if (dist < 6) {
        updateMouseCoords(e);
        _raycaster.setFromCamera(_mouse, activeCamera);
        const hits = _raycaster.intersectObjects(interactableProxies, false);
        if (hits.length === 0) {
          // If in VR Walkthrough mode and clicking floor, teleport 1.65m eye camera there!
          if (
            stateRef.current.cameraMode === 'vr_walkthrough' &&
            _raycaster.ray.intersectPlane(_floorPlane, _intersectPt)
          ) {
            const cfg = stateRef.current.roomConfig;
            const tx = Math.max(-cfg.width / 2 + 0.4, Math.min(cfg.width / 2 - 0.4, _intersectPt.x));
            const tz = Math.max(-cfg.length / 2 + 0.4, Math.min(cfg.length / 2 - 0.4, _intersectPt.z));
            const dx = controls.target.x - perspCamera.position.x;
            const dz = controls.target.z - perspCamera.position.z;
            perspCamera.position.set(tx, 1.65, tz);
            controls.target.set(tx + dx, 1.45, tz + dz);
            controls.update();
            requestRender();
          } else {
            stateRef.current.onSelectFurniture(null);
          }
        }
      }
    }

    function onDoubleClick(e: MouseEvent) {
      updateMouseCoords(e);
      _raycaster.setFromCamera(_mouse, activeCamera);
      const hits = _raycaster.intersectObjects(interactableProxies, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData?.instanceId as string;
        if (hitId) {
          stateRef.current.onToggleVrPriceTag(hitId);
        }
      }
    }

    // 11. Keyboard navigation (WASD / Arrows for VR Walkthrough + R to Rotate, Backspace/Delete)
    function onKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      if (stateRef.current.cameraMode === 'vr_walkthrough') {
        const step = 0.35;
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
          perspCamera.position.z -= step;
          controls.target.z -= step;
          controls.update();
          requestRender();
        } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
          perspCamera.position.z += step;
          controls.target.z += step;
          controls.update();
          requestRender();
        } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
          perspCamera.position.x -= step;
          controls.target.x -= step;
          controls.update();
          requestRender();
        } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
          perspCamera.position.x += step;
          controls.target.x += step;
          controls.update();
          requestRender();
        }
      }
    }

    // 12. Full WebXR Hardware Controller Setup (Left/Right laser rays, selectstart Price Tag, squeezestart Grab & Move, Floor Teleport)
    const xrUserGroup = new THREE.Group();
    xrUserGroup.position.set(0, 0, 1.5);
    scene.add(xrUserGroup);

    let grabbedByController: { controller: THREE.Object3D; instanceId: string } | null = null;

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -4),
      ]);
      const rayLine = new THREE.Line(
        rayGeo,
        new THREE.LineBasicMaterial({ color: i === 0 ? 0x0058a3 : 0xffdb00 })
      );
      controller.add(rayLine);

      // Trigger (selectstart): Toggle 3D IKEA Price Tag on furniture OR teleport to floor point
      controller.addEventListener('selectstart', () => {
        _tempMatrix.identity().extractRotation(controller.matrixWorld);
        _vrRayOrigin.setFromMatrixPosition(controller.matrixWorld);
        _vrRayDir.set(0, 0, -1).applyMatrix4(_tempMatrix).normalize();
        _raycaster.set(_vrRayOrigin, _vrRayDir);

        const hits = _raycaster.intersectObjects(interactableProxies, false);
        if (hits.length > 0) {
          const hitId = hits[0].object.userData?.instanceId as string;
          if (hitId) {
            stateRef.current.onSelectFurniture(hitId);
            stateRef.current.onToggleVrPriceTag(hitId);
            return;
          }
        }
        // Otherwise teleport to floor intersection
        if (_raycaster.ray.intersectPlane(_floorPlane, _intersectPt)) {
          const cfg = stateRef.current.roomConfig;
          const tx = Math.max(-cfg.width / 2 + 0.3, Math.min(cfg.width / 2 - 0.3, _intersectPt.x));
          const tz = Math.max(-cfg.length / 2 + 0.3, Math.min(cfg.length / 2 - 0.3, _intersectPt.z));
          xrUserGroup.position.set(tx, 0, tz);
        }
      });

      // Grip (squeezestart / squeezeend): Grab & slide/rotate IKEA furniture in VR
      controller.addEventListener('squeezestart', () => {
        _tempMatrix.identity().extractRotation(controller.matrixWorld);
        _vrRayOrigin.setFromMatrixPosition(controller.matrixWorld);
        _vrRayDir.set(0, 0, -1).applyMatrix4(_tempMatrix).normalize();
        _raycaster.set(_vrRayOrigin, _vrRayDir);

        const hits = _raycaster.intersectObjects(interactableProxies, false);
        if (hits.length > 0) {
          const hitId = hits[0].object.userData?.instanceId as string;
          if (hitId) {
            grabbedByController = { controller, instanceId: hitId };
            stateRef.current.onSelectFurniture(hitId);
          }
        }
      });

      controller.addEventListener('squeezeend', () => {
        if (grabbedByController?.controller === controller) {
          grabbedByController = null;
        }
      });

      xrUserGroup.add(controller);
    }

    async function startWebXrSession(mode: 'immersive-vr' | 'immersive-ar') {
      const navAny = navigator as unknown as { xr?: { isSessionSupported?: (m: string) => Promise<boolean>; requestSession?: (m: string, opts?: unknown) => Promise<unknown> } };
      if (!navAny.xr || typeof navAny.xr.requestSession !== 'function') {
        stateRef.current.onWebXrStatusChange?.('simulated_vr');
        return;
      }
      try {
        const supported = await navAny.xr.isSessionSupported?.(mode);
        if (!supported) {
          stateRef.current.onWebXrStatusChange?.('simulated_vr');
          return;
        }
        const session = await navAny.xr.requestSession(mode, {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
        });
        renderer.xr.enabled = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await renderer.xr.setSession(session as any);
        stateRef.current.onWebXrStatusChange?.('xr_active');

        renderer.setAnimationLoop(() => {
          if (grabbedByController) {
            const { controller, instanceId } = grabbedByController;
            _tempMatrix.identity().extractRotation(controller.matrixWorld);
            _vrRayOrigin.setFromMatrixPosition(controller.matrixWorld);
            _vrRayDir.set(0, 0, -1).applyMatrix4(_tempMatrix).normalize();
            _raycaster.set(_vrRayOrigin, _vrRayDir);
            if (_raycaster.ray.intersectPlane(_floorPlane, _intersectPt)) {
              const euler = new THREE.Euler().setFromQuaternion(controller.quaternion, 'YXZ');
              stateRef.current.onMoveFurniture(
                instanceId,
                [_intersectPt.x, 0, _intersectPt.z],
                euler.y
              );
            }
          }
          renderer.render(scene, perspCamera);
        });
      } catch {
        stateRef.current.onWebXrStatusChange?.('simulated_vr');
      }
    }

    function updateRemoteCursor(
      cursor: { position: [number, number, number]; targetInstanceId: string | null } | null
    ) {
      if (!cursor) {
        remoteAvatarGroup.visible = false;
      } else {
        remoteAvatarGroup.position.set(cursor.position[0], 0, cursor.position[2]);
        remoteAvatarGroup.visible = true;
      }
      requestRender();
    }

    function onResize() {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (w <= 0 || h <= 0) return;
      perspCamera.aspect = w / h;
      perspCamera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (stateRef.current.cameraMode === 'floorplan2d') {
        updateCameraMode('floorplan2d');
      }
      updateWallCutawayVisibility();
      renderer.render(scene, activeCamera);
    }

    controls.addEventListener('change', requestRender);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    sceneApiRef.current = {
      requestRender,
      rebuildRoom,
      rebuildFurniture,
      updateCameraMode,
      updateRemoteCursor,
      startWebXrSession,
    };

    rebuildRoom();
    rebuildFurniture();
    updateWallCutawayVisibility();
    renderer.render(scene, activeCamera);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.setAnimationLoop(null);
      controls.removeEventListener('change', requestRender);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Trigger room architecture rebuild when roomConfig or gridSnap changes
  useEffect(() => {
    sceneApiRef.current?.rebuildRoom();
  }, [roomConfig, gridSnap]);

  // Trigger furniture rebuild when placedFurniture, selectedInstanceId, or timeOfDay changes
  useEffect(() => {
    sceneApiRef.current?.rebuildFurniture();
  }, [placedFurniture, selectedInstanceId, roomConfig.timeOfDay]);

  // Trigger camera mode transition
  useEffect(() => {
    sceneApiRef.current?.updateCameraMode(cameraMode);
  }, [cameraMode]);

  // Trigger remote VR cursor update
  useEffect(() => {
    sceneApiRef.current?.updateRemoteCursor(remoteVrCursor);
  }, [remoteVrCursor]);

  // Trigger WebXR session start when user requests it
  useEffect(() => {
    if (vrSessionRequestCounter > 0) {
      sceneApiRef.current?.startWebXrSession(vrModeType);
    }
  }, [vrSessionRequestCounter, vrModeType]);

  return (
    <div
      ref={canvasMountRef}
      className="w-full h-full relative select-none"
      aria-label="Interactive 3D Room Configurator Viewport"
    />
  );
};
