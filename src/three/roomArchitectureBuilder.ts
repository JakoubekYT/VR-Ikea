import * as THREE from 'three';
import { RoomConfig, WallId, WallOpening } from '../types/ikea';
import { getFloorTextures, getWallTextures } from './proceduralTextures';

export interface BuiltRoomRefs {
  rootGroup: THREE.Group;
  wallGroups: Record<WallId, THREE.Group>;
  floorMesh: THREE.Mesh;
}

/**
 * Builds a 3D Window or Door assembly positioned along its wall
 */
function buildOpeningAssembly(
  opening: WallOpening,
  wallThickness: number,
  timeOfDay: RoomConfig['timeOfDay'],
  isSoftwareGl: boolean
): THREE.Group {
  const group = new THREE.Group();
  group.name = `opening_${opening.id}`;

  const W = opening.widthMeters;
  const H = opening.heightMeters;
  const D = wallThickness + 0.05;
  const frameThick = 0.055;

  const isWindow =
    opening.type === 'Floor-to-Ceiling French Window' ||
    opening.type === 'Double Casement Window';
  const isIndustrial = opening.type === 'Industrial Glass Door';

  const frameMat = new THREE.MeshStandardMaterial({
    color: isIndustrial
      ? 0x222426
      : opening.type === 'Modern Oak Door'
      ? 0xc89e6e
      : 0xf6f5f0,
    roughness: isIndustrial ? 0.35 : 0.48,
    metalness: isIndustrial ? 0.8 : 0.05,
  });

  // Outer frame (top, bottom sill, left, right jambs)
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(W, frameThick, D), frameMat);
  topBar.position.set(0, opening.sillHeightMeters + H - frameThick / 2, 0);
  group.add(topBar);

  const botBar = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, frameThick, D + 0.04), frameMat);
  botBar.position.set(0, opening.sillHeightMeters + frameThick / 2, 0.01);
  group.add(botBar);

  const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(frameThick, H, D), frameMat);
  leftJamb.position.set(-W / 2 + frameThick / 2, opening.sillHeightMeters + H / 2, 0);
  group.add(leftJamb);

  const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(frameThick, H, D), frameMat);
  rightJamb.position.set(W / 2 - frameThick / 2, opening.sillHeightMeters + H / 2, 0);
  group.add(rightJamb);

  if (opening.type === 'Modern Oak Door') {
    // Solid oak door panel with recessed lines and brushed steel lever handle
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xd0a878,
      roughness: 0.45,
      metalness: 0.05,
    });
    const doorSlab = new THREE.Mesh(
      new THREE.BoxGeometry(W - frameThick * 2, H - frameThick * 1.5, 0.045),
      panelMat
    );
    doorSlab.position.set(0, opening.sillHeightMeters + H / 2, 0);
    if (!isSoftwareGl) {
      doorSlab.castShadow = true;
      doorSlab.receiveShadow = true;
    }
    group.add(doorSlab);

    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xd6d8dc,
      roughness: 0.2,
      metalness: 0.9,
    });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.022, 0.08), handleMat);
    handle.position.set(W / 2 - 0.14, 1.02, 0.03);
    group.add(handle);
  } else {
    // Sky/daylight backdrop plane + Glass pane + Mullions + Floor sunlight beam patch
    const skyColor =
      timeOfDay === 'Daylight'
        ? 0xd9ecff
        : timeOfDay === 'Golden Hour Sunset'
        ? 0xffcba0
        : 0x1a2639;
    const skyEmissive =
      timeOfDay === 'Daylight'
        ? 0xb8dcff
        : timeOfDay === 'Golden Hour Sunset'
        ? 0xff9e5e
        : 0x101826;

    const skyBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(W - frameThick * 1.5, H - frameThick * 1.5),
      new THREE.MeshStandardMaterial({
        color: skyColor,
        emissive: skyEmissive,
        emissiveIntensity: timeOfDay === 'Cozy Evening' ? 0.2 : 0.75,
        roughness: 0.9,
        side: THREE.DoubleSide,
      })
    );
    skyBackdrop.position.set(0, opening.sillHeightMeters + H / 2, -0.01);
    group.add(skyBackdrop);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef7ff,
      roughness: 0.08,
      metalness: 0.1,
      transmission: isSoftwareGl ? 0 : 0.75,
      transparent: true,
      opacity: isSoftwareGl ? 0.28 : 0.9,
      depthWrite: false,
    });
    const glassPane = new THREE.Mesh(
      new THREE.BoxGeometry(W - frameThick * 2, H - frameThick * 2, 0.015),
      glassMat
    );
    glassPane.position.set(0, opening.sillHeightMeters + H / 2, 0.01);
    group.add(glassPane);

    // Center vertical mullion
    const vMullion = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, H - frameThick * 2, D * 0.85),
      frameMat
    );
    vMullion.position.set(0, opening.sillHeightMeters + H / 2, 0);
    group.add(vMullion);

    // Horizontal transoms
    const hRows = opening.type === 'Double Casement Window' ? 1 : 2;
    for (let r = 1; r <= hRows; r++) {
      const hy = opening.sillHeightMeters + (H / (hRows + 1)) * r;
      const hMullion = new THREE.Mesh(
        new THREE.BoxGeometry(W - frameThick * 2, 0.03, D * 0.8),
        frameMat
      );
      hMullion.position.set(0, hy, 0);
      group.add(hMullion);
    }

    // Realistic window sunlight patch cast onto the room floor during Daylight & Sunset
    if (isWindow && timeOfDay !== 'Cozy Evening') {
      const patchColor = timeOfDay === 'Golden Hour Sunset' ? 0xffb36b : 0xfff8e8;
      const patchOpacity = timeOfDay === 'Golden Hour Sunset' ? 0.26 : 0.18;
      const sunPatchGeo = new THREE.PlaneGeometry(W * 0.92, 1.65);
      const sunPatchMat = new THREE.MeshBasicMaterial({
        color: patchColor,
        transparent: true,
        opacity: patchOpacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const sunPatch = new THREE.Mesh(sunPatchGeo, sunPatchMat);
      sunPatch.rotation.x = -Math.PI / 2;
      sunPatch.position.set(0, 0.003, 1.05);
      group.add(sunPatch);
    }
  }

  return group;
}

/**
 * Constructs the full 3D Room Architecture Group (floor, 4 independent walls, baseboards, windows & doors)
 */
export function buildRoomArchitecture(
  config: RoomConfig,
  gridSnapEnabled: boolean,
  isSoftwareGl: boolean,
  maxAnisotropy: number
): BuiltRoomRefs {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'ROOM_ARCHITECTURE';

  const W = config.width;
  const L = config.length;
  const H = config.ceilingHeight;
  const wallT = 0.14;

  // 1. Floor Mesh + Architectural Plinth
  const floorTex = getFloorTextures(config.floorFinish, W, L, maxAnisotropy);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: floorTex.map,
    bumpMap: floorTex.bumpMap,
    bumpScale: floorTex.bumpScale,
    roughness: floorTex.roughness,
    metalness: floorTex.metalness,
  });

  const floorGeo = new THREE.PlaneGeometry(W, L);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = !isSoftwareGl;
  floorMesh.name = 'ROOM_FLOOR';
  rootGroup.add(floorMesh);

  // Subtle architectural slab underneath floor
  const slabGeo = new THREE.BoxGeometry(W + wallT * 2, 0.12, L + wallT * 2);
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0xd8d5ce,
    roughness: 0.85,
    metalness: 0.02,
  });
  const slabMesh = new THREE.Mesh(slabGeo, slabMat);
  slabMesh.position.set(0, -0.062, 0);
  rootGroup.add(slabMesh);

  // Optional 0.25m Grid Snap Helper slightly above floor (y = 0.002)
  if (gridSnapEnabled) {
    const divisions = Math.round(Math.max(W, L) / 0.25);
    const gridHelper = new THREE.GridHelper(
      Math.max(W, L),
      divisions,
      0x0058a3,
      0x99badd
    );
    gridHelper.position.y = 0.002;
    gridHelper.scale.set(W / Math.max(W, L), 1, L / Math.max(W, L));
    const gridMat = gridHelper.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.28;
    gridMat.depthWrite = false;
    rootGroup.add(gridHelper);
  }

  // 2. Four Independent Walls (North: -Z, South: +Z, East: +X, West: -X)
  const wallDefs: Array<{
    id: WallId;
    span: number;
    pos: [number, number, number];
    rotY: number;
  }> = [
    { id: 'north', span: W + wallT * 2, pos: [0, 0, -L / 2 - wallT / 2], rotY: 0 },
    { id: 'south', span: W + wallT * 2, pos: [0, 0, L / 2 + wallT / 2], rotY: Math.PI },
    { id: 'east', span: L, pos: [W / 2 + wallT / 2, 0, 0], rotY: -Math.PI / 2 },
    { id: 'west', span: L, pos: [-W / 2 - wallT / 2, 0, 0], rotY: Math.PI / 2 },
  ];

  const baseboardMat = new THREE.MeshStandardMaterial({
    color: 0xf7f6f2,
    roughness: 0.45,
    metalness: 0.02,
  });

  const wallGroups = {} as Record<WallId, THREE.Group>;

  for (const def of wallDefs) {
    const wGroup = new THREE.Group();
    wGroup.name = `WALL_${def.id}`;
    wGroup.position.set(def.pos[0], def.pos[1], def.pos[2]);
    wGroup.rotation.y = def.rotY;

    const wallSpec = config.walls[def.id];
    const wTex = getWallTextures(
      wallSpec.finishPreset,
      wallSpec.colorHex,
      def.span,
      H,
      maxAnisotropy
    );

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: wTex.map,
      bumpMap: wTex.bumpMap,
      bumpScale: wTex.bumpScale,
      roughness: wTex.roughness,
      metalness: 0.02,
    });

    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(def.span, H, wallT), wallMat);
    wallMesh.position.set(0, H / 2, 0);
    if (!isSoftwareGl) {
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
    }
    wGroup.add(wallMesh);

    // Scandinavian interior baseboard molding along inside face (+Z in local wall coords)
    const baseboard = new THREE.Mesh(
      new THREE.BoxGeometry(def.span - wallT, 0.09, 0.02),
      baseboardMat
    );
    baseboard.position.set(0, 0.045, wallT / 2 + 0.01);
    wGroup.add(baseboard);

    // Attach any windows or doors assigned to this wall
    const wallOpenings = config.openings.filter((o) => o.wall === def.id);
    for (const op of wallOpenings) {
      const opGroup = buildOpeningAssembly(op, wallT, config.timeOfDay, isSoftwareGl);
      const maxOffset = Math.max(0, def.span / 2 - op.widthMeters / 2 - 0.2);
      const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, op.offsetMeters));
      opGroup.position.set(clampedOffset, 0, 0);
      wGroup.add(opGroup);
    }

    rootGroup.add(wGroup);
    wallGroups[def.id] = wGroup;
  }

  return {
    rootGroup,
    wallGroups,
    floorMesh,
  };
}
