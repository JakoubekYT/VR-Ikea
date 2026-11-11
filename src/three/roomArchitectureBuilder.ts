import * as THREE from 'three';
import type { ApartmentRoom, WallId, WallOpening } from '../types/ikea';
import { getFloorTexture, getWallTexture } from './proceduralTextures';
import { computeWallCutaway } from '../utils/roomLogic';

const WALL_THICKNESS = 0.12;

interface WallSegmentBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function buildWallSegmentsWithOpenings(
  wallLength: number,
  wallHeight: number,
  openings: WallOpening[]
): WallSegmentBox[] {
  const halfLen = wallLength / 2;
  if (openings.length === 0) {
    return [{ x0: -halfLen, x1: halfLen, y0: 0, y1: wallHeight }];
  }

  const sorted = [...openings]
    .map((op) => {
      const w = Math.min(wallLength - 0.3, Math.max(0.4, op.width));
      const h = Math.min(wallHeight - 0.15, Math.max(0.5, op.height));
      const y0 = op.type === 'Door' || op.type === 'Open Archway' ? 0 : Math.max(0.1, op.sillHeight);
      const y1 = Math.min(wallHeight - 0.08, y0 + h);
      const maxOffset = Math.max(0, halfLen - w / 2 - 0.12);
      const cx = Math.max(-maxOffset, Math.min(maxOffset, op.offset));
      return {
        x0: cx - w / 2,
        x1: cx + w / 2,
        y0,
        y1,
      };
    })
    .sort((a, b) => a.x0 - b.x0);

  const boxes: WallSegmentBox[] = [];
  let cursor = -halfLen;

  for (const op of sorted) {
    if (op.x0 > cursor + 0.02) {
      boxes.push({ x0: cursor, x1: op.x0, y0: 0, y1: wallHeight });
    }
    if (op.y0 > 0.02) {
      boxes.push({ x0: op.x0, x1: op.x1, y0: 0, y1: op.y0 });
    }
    if (op.y1 < wallHeight - 0.02) {
      boxes.push({ x0: op.x0, x1: op.x1, y0: op.y1, y1: wallHeight });
    }
    cursor = Math.max(cursor, op.x1);
  }

  if (cursor < halfLen - 0.02) {
    boxes.push({ x0: cursor, x1: halfLen, y0: 0, y1: wallHeight });
  }

  return boxes;
}

function createRoomBadgeSprite(roomName: string, dimsText: string, isActive: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isActive ? 'rgba(0, 88, 163, 0.90)' : 'rgba(17, 17, 17, 0.72)';
  ctx.beginPath();
  ctx.roundRect(24, 20, 464, 88, 14);
  ctx.fill();

  if (isActive) {
    ctx.strokeStyle = '#FFDB00';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(roomName, 256, 56);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '600 20px Inter, sans-serif';
  ctx.fillText(dimsText, 256, 88);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(1.35, 0.34, 1);
  return sprite;
}

export function buildApartmentArchitecture(
  rooms: ApartmentRoom[],
  activeRoomId: string,
  cameraPosition: [number, number, number],
  cameraTarget: [number, number, number],
  autoCutaway: boolean,
  isInsideWalkthrough: boolean,
  selectedWall: WallId | null = null
): THREE.Group {
  const apartmentGroup = new THREE.Group();
  apartmentGroup.name = 'apartment_architecture';

  for (const room of rooms) {
    const isActiveRoom = room.id === activeRoomId;
    const roomGroup = new THREE.Group();
    roomGroup.position.set(room.position[0], 0, room.position[1]);
    roomGroup.userData = { roomId: room.id };

    const { width, length, height } = room;
    const halfW = width / 2;
    const halfL = length / 2;

    // 1. Floor Slab with procedural texture + custom RGB tint
    const floorTex = getFloorTexture(room.floorFinish, width / 1.5, length / 1.5);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      color: new THREE.Color(room.floorTintHex || '#FFFFFF'),
      roughness:
        room.floorFinish === 'Marble Tiles'
          ? 0.22
          : room.floorFinish === 'Polished Concrete'
          ? 0.45
          : room.floorFinish === 'Carpet'
          ? 0.92
          : 0.38,
      metalness: 0.04,
    });
    const floorGeom = new THREE.BoxGeometry(width, 0.08, length);
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.position.set(0, -0.04, 0);
    floorMesh.receiveShadow = true;
    floorMesh.name = 'room_floor';
    floorMesh.userData = { isFloor: true, roomId: room.id };
    roomGroup.add(floorMesh);

    // 2. Solid Ceiling Slab when Inside 1:1 / VR Mode (hidden in Top-Down Dollhouse mode)
    if (isInsideWalkthrough) {
      const ceilingGeom = new THREE.BoxGeometry(width, 0.08, length);
      const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0xf7f6f2,
        roughness: 0.85,
        metalness: 0.02,
      });
      const ceilingMesh = new THREE.Mesh(ceilingGeom, ceilingMat);
      ceilingMesh.position.set(0, height + 0.04, 0);
      ceilingMesh.receiveShadow = true;
      roomGroup.add(ceilingMesh);
    } else {
      // Subtle floating room label in Top-Down Dollhouse View
      const badge = createRoomBadgeSprite(
        room.name.split('/')[0].trim(),
        `${width.toFixed(1)}m × ${length.toFixed(1)}m`,
        isActiveRoom
      );
      badge.position.set(0, 0.14, 0);
      roomGroup.add(badge);
    }

    // Active room perimeter highlight in Dollhouse mode
    if (!isInsideWalkthrough && isActiveRoom) {
      const borderGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(width + 0.04, 0.02, length + 0.04));
      const borderLine = new THREE.LineSegments(
        borderGeom,
        new THREE.LineBasicMaterial({ color: 0x0058a3 })
      );
      borderLine.position.set(0, 0.015, 0);
      roomGroup.add(borderLine);
    }

    // 3. Compute cutaway per room in Dollhouse mode, or full walls in 1:1 / VR mode
    const cutaway = isInsideWalkthrough
      ? { north: false, south: false, east: false, west: false }
      : computeWallCutaway(
          cameraPosition,
          [room.position[0], 0, room.position[1]],
          autoCutaway
        );

    const wallDefs: {
      id: WallId;
      len: number;
      pos: [number, number, number];
      rotY: number;
    }[] = [
      { id: 'north', len: width, pos: [0, 0, -halfL - WALL_THICKNESS / 2], rotY: 0 },
      { id: 'south', len: width, pos: [0, 0, halfL + WALL_THICKNESS / 2], rotY: Math.PI },
      { id: 'east', len: length, pos: [halfW + WALL_THICKNESS / 2, 0, 0], rotY: -Math.PI / 2 },
      { id: 'west', len: length, pos: [-halfW - WALL_THICKNESS / 2, 0, 0], rotY: Math.PI / 2 },
    ];

    for (const wDef of wallDefs) {
      const isCutaway = cutaway[wDef.id];
      const spec = room.walls[wDef.id];
      const wallTex = getWallTexture(spec.finish, spec.colorHex, wDef.len / 2, height / 2);

      const isWallSelected = isActiveRoom && selectedWall === wDef.id;
      const wallGroup = new THREE.Group();
      wallGroup.position.set(...wDef.pos);
      wallGroup.rotation.y = wDef.rotY;
      wallGroup.name = `wall_${room.id}_${wDef.id}`;

      const wallOpenings = room.openings.filter((o) => o.wall === wDef.id);

      if (isCutaway) {
        const stubHeight = 0.24;
        const stubGeom = new THREE.BoxGeometry(wDef.len + WALL_THICKNESS * 2, stubHeight, WALL_THICKNESS);
        const stubMat = new THREE.MeshStandardMaterial({
          color: spec.colorHex,
          roughness: 0.85,
        });
        const stubMesh = new THREE.Mesh(stubGeom, stubMat);
        stubMesh.position.set(0, stubHeight / 2, 0);
        stubMesh.receiveShadow = true;
        stubMesh.userData = { wallId: wDef.id, roomId: room.id, isWall: true };
        wallGroup.add(stubMesh);
      } else {
        const segments = buildWallSegmentsWithOpenings(wDef.len, height, wallOpenings);
        const wallMat = new THREE.MeshStandardMaterial({
          map: wallTex,
          roughness: 0.78,
          metalness: 0.02,
          emissive: isWallSelected ? new THREE.Color(0x0058a3) : new THREE.Color(0x000000),
          emissiveIntensity: isWallSelected ? 0.12 : 0,
        });

        for (const seg of segments) {
          const segW = seg.x1 - seg.x0;
          const segH = seg.y1 - seg.y0;
          const segCx = (seg.x0 + seg.x1) / 2;
          const segCy = (seg.y0 + seg.y1) / 2;

          const geom = new THREE.BoxGeometry(segW, segH, WALL_THICKNESS);
          const mesh = new THREE.Mesh(geom, wallMat);
          mesh.position.set(segCx, segCy, 0);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData = { wallId: wDef.id, roomId: room.id, isWall: true };
          wallGroup.add(mesh);
        }

        // Baseboard along the wall
        const baseMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ed, roughness: 0.45 });
        const doorOpenings = wallOpenings.filter((o) => o.type === 'Door' || o.type === 'Open Archway');
        if (doorOpenings.length === 0) {
          const baseGeom = new THREE.BoxGeometry(wDef.len, 0.075, 0.018);
          const baseMesh = new THREE.Mesh(baseGeom, baseMat);
          baseMesh.position.set(0, 0.0375, WALL_THICKNESS / 2 + 0.008);
          wallGroup.add(baseMesh);
        }

        // Architectural Windows, Doors & Open Archways + 3D Resize/Slide Handles
        for (const op of wallOpenings) {
          const opW = Math.min(wDef.len - 0.3, Math.max(0.4, op.width));
          const opH = Math.min(height - 0.15, Math.max(0.5, op.height));
          const y0 = op.type === 'Door' || op.type === 'Open Archway' ? 0 : Math.max(0.1, op.sillHeight);
          const cy = y0 + opH / 2;
          const maxOffset = Math.max(0, wDef.len / 2 - opW / 2 - 0.12);
          const cx = Math.max(-maxOffset, Math.min(maxOffset, op.offset));

          const frameGroup = new THREE.Group();
          frameGroup.position.set(cx, cy, 0);

          const frameMat = new THREE.MeshStandardMaterial({
            color: op.type === 'Door' || op.type === 'Open Archway' ? 0xf2f0eb : 0x22252a,
            roughness: 0.35,
            metalness: op.type === 'Door' || op.type === 'Open Archway' ? 0.05 : 0.4,
          });

          const frameThick = 0.045;
          const frameDepth = WALL_THICKNESS + 0.025;

          // Top, Left, Right jambs
          const topBar = new THREE.Mesh(
            new THREE.BoxGeometry(opW + frameThick * 2, frameThick, frameDepth),
            frameMat
          );
          topBar.position.set(0, opH / 2 - frameThick / 2, 0);
          frameGroup.add(topBar);

          const leftBar = new THREE.Mesh(
            new THREE.BoxGeometry(frameThick, opH, frameDepth),
            frameMat
          );
          leftBar.position.set(-opW / 2 + frameThick / 2, 0, 0);
          frameGroup.add(leftBar);

          const rightBar = new THREE.Mesh(
            new THREE.BoxGeometry(frameThick, opH, frameDepth),
            frameMat
          );
          rightBar.position.set(opW / 2 - frameThick / 2, 0, 0);
          frameGroup.add(rightBar);

          if (op.type !== 'Door' && op.type !== 'Open Archway') {
            // Window Sill + Glass Pane + Mullions + Sun Patch on Floor
            const sillMesh = new THREE.Mesh(
              new THREE.BoxGeometry(opW + 0.08, 0.035, frameDepth + 0.04),
              new THREE.MeshStandardMaterial({ color: 0xf4f2ed, roughness: 0.35 })
            );
            sillMesh.position.set(0, -opH / 2 + 0.017, 0.01);
            frameGroup.add(sillMesh);

            const glassMat = new THREE.MeshPhysicalMaterial({
              color: 0xdcf0ff,
              transparent: true,
              opacity: 0.3,
              roughness: 0.08,
              transmission: 0.65,
            });
            const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(opW - 0.06, opH - 0.06, 0.014), glassMat);
            glassMesh.userData = { openingId: op.id, roomId: room.id, wallId: wDef.id, isOpeningHandle: true };
            frameGroup.add(glassMesh);

            const vMullion = new THREE.Mesh(new THREE.BoxGeometry(0.024, opH - 0.06, 0.03), frameMat);
            frameGroup.add(vMullion);

            if (op.type === 'Double Casement Window' || op.type === 'Floor-to-Ceiling Balcony Glazing') {
              const hMullion = new THREE.Mesh(new THREE.BoxGeometry(opW - 0.06, 0.024, 0.03), frameMat);
              hMullion.position.set(0, -opH * 0.12, 0);
              frameGroup.add(hMullion);
            }

            // Sunlight beam patch on floor
            const sunPatchGeom = new THREE.PlaneGeometry(opW * 0.92, 1.45);
            sunPatchGeom.rotateX(-Math.PI / 2);
            const sunPatchMat = new THREE.MeshBasicMaterial({
              color: 0xfff8e2,
              transparent: true,
              opacity: 0.2,
              depthWrite: false,
            });
            const sunPatch = new THREE.Mesh(sunPatchGeom, sunPatchMat);
            sunPatch.position.set(0, -cy + 0.004, 0.95);
            frameGroup.add(sunPatch);
          } else if (op.type === 'Door') {
            // Scandinavian paneled interior door swung ajar ~55 deg for walkthrough & sightlines
            const leafW = opW - 0.06;
            const doorPivot = new THREE.Group();
            doorPivot.position.set(-leafW / 2, 0, 0);
            doorPivot.rotation.y = (55 * Math.PI) / 180;

            const leafMat = new THREE.MeshStandardMaterial({
              color: 0xf6f4ef,
              roughness: 0.45,
            });
            const doorLeaf = new THREE.Mesh(
              new THREE.BoxGeometry(leafW, opH - 0.04, 0.042),
              leafMat
            );
            doorLeaf.position.set(leafW / 2, 0, 0);
            doorLeaf.userData = { openingId: op.id, roomId: room.id, wallId: wDef.id, isOpeningHandle: true };
            doorPivot.add(doorLeaf);

            const handleMat = new THREE.MeshStandardMaterial({
              color: 0xd4af37,
              roughness: 0.25,
              metalness: 0.85,
            });
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.08), handleMat);
            handle.position.set(leafW * 0.84, -0.05, 0.03);
            doorPivot.add(handle);

            frameGroup.add(doorPivot);
          }

          wallGroup.add(frameGroup);
        }
      }

      roomGroup.add(wallGroup);
    }

    // 4. Interactive 3D Wall & Corner Drag Handles in Top-Down Dollhouse View for active room
    if (!isInsideWalkthrough && isActiveRoom) {
      const handleMat = new THREE.MeshStandardMaterial({
        color: 0x0058a3,
        emissive: 0x0058a3,
        emissiveIntensity: 0.25,
        roughness: 0.25,
      });
      const cornerMat = new THREE.MeshStandardMaterial({
        color: 0xffdb00,
        emissive: 0xffdb00,
        emissiveIntensity: 0.2,
        roughness: 0.3,
      });

      const wallHandlePositions: {
        axis: 'north' | 'south' | 'east' | 'west';
        pos: [number, number, number];
        rotY: number;
      }[] = [
        { axis: 'north', pos: [0, 0.18, -halfL - 0.18], rotY: 0 },
        { axis: 'south', pos: [0, 0.18, halfL + 0.18], rotY: 0 },
        { axis: 'east', pos: [halfW + 0.18, 0.18, 0], rotY: Math.PI / 2 },
        { axis: 'west', pos: [-halfW - 0.18, 0.18, 0], rotY: Math.PI / 2 },
      ];

      for (const hDef of wallHandlePositions) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.14), handleMat);
        bar.position.set(...hDef.pos);
        bar.rotation.y = hDef.rotY;
        bar.userData = {
          isRoomResizeHandle: true,
          roomId: room.id,
          handleAxis: hDef.axis,
        };
        roomGroup.add(bar);
      }

      // Corner move handle at South-East corner to drag-reposition the entire room
      const moveOrb = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 24), cornerMat);
      moveOrb.position.set(halfW + 0.2, 0.18, halfL + 0.2);
      moveOrb.userData = {
        isRoomResizeHandle: true,
        roomId: room.id,
        handleAxis: 'move',
      };
      roomGroup.add(moveOrb);
    }

    apartmentGroup.add(roomGroup);
  }

  return apartmentGroup;
}
