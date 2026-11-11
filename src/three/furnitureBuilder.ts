import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { FurniturePartSpec, PlacedFurnitureItem } from '../types/ikea.js';
import { getFabricWeaveTexture } from './proceduralTextures.js';
import {
  buildDimensionOverlay,
  disposeDimensionOverlay,
  type DimensionOverlayOptions,
} from './dimensionOverlay.js';

function createPartGeometry(part: FurniturePartSpec): THREE.BufferGeometry {
  const [w, h, d] = part.size.map((v) => Math.max(0.008, Number(v) || 0.05));

  switch (part.shape) {
    case 'cylinder': {
      const radius = Math.max(w, d) / 2;
      return new THREE.CylinderGeometry(radius, radius * 0.92, h, 20);
    }
    case 'sphere': {
      const radius = Math.max(w, h, d) / 2;
      const geom = new THREE.SphereGeometry(radius, 24, 18);
      geom.scale(w / (radius * 2), h / (radius * 2), d / (radius * 2));
      return geom;
    }
    case 'cone': {
      const radius = Math.max(w, d) / 2;
      return new THREE.ConeGeometry(radius, h, 24, 1, true);
    }
    case 'torus': {
      const radius = Math.max(w, d) / 2;
      const tube = Math.max(0.008, Math.min(h / 2, radius * 0.25));
      const geom = new THREE.TorusGeometry(radius, tube, 14, 28);
      geom.rotateX(Math.PI / 2);
      return geom;
    }
    case 'rounded_box':
    default: {
      const minSide = Math.min(w, h, d);
      const radius = Math.min(0.035, minSide * 0.18);
      return new RoundedBoxGeometry(w, h, d, 3, radius);
    }
  }
}

function createPartMaterial(part: FurniturePartSpec): THREE.Material {
  const color = new THREE.Color(part.colorHex || '#CCCCCC');
  const matType = part.materialType;

  if (matType === 'clear_glass' || matType === 'frosted_glass') {
    return new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: matType === 'clear_glass' ? 0.36 : 0.72,
      roughness: matType === 'clear_glass' ? 0.08 : 0.25,
      metalness: 0.05,
      transmission: matType === 'clear_glass' ? 0.55 : 0.3,
    });
  }

  if (matType === 'emissive_lamp' || matType === 'emissive_light') {
    return new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.0,
    });
  }

  if (matType === 'boucle_fabric' || matType === 'velvet' || matType === 'woven_rug') {
    const map = getFabricWeaveTexture(part.colorHex || '#CCCCCC');
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      roughness: matType === 'velvet' ? 0.72 : 0.9,
      metalness: 0.02,
    });
  }

  if (matType === 'brushed_brass' || matType === 'chrome' || matType === 'matte_black_metal' || matType === 'brushed_steel') {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: matType === 'chrome' ? 0.16 : matType === 'brushed_brass' ? 0.28 : 0.42,
      metalness: matType === 'matte_black_metal' ? 0.68 : 0.88,
    });
  }

  if (matType === 'white_laminate') {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.32,
      metalness: 0.04,
    });
  }

  return new THREE.MeshStandardMaterial({
    color,
    roughness: Math.min(1, Math.max(0.05, part.roughness ?? 0.5)),
    metalness: Math.min(1, Math.max(0, part.metalness ?? 0.05)),
  });
}

function createLaserScanLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0, 88, 163, 0.92)';
  ctx.beginPath();
  ctx.roundRect(12, 16, 488, 96, 16);
  ctx.fill();

  ctx.strokeStyle = '#FFDB00';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.95, 0.24, 1);
  return sprite;
}

export function buildFurnitureGroup(
  item: PlacedFurnitureItem,
  isSelected: boolean,
  dimensionOptions?: DimensionOverlayOptions
): THREE.Group {
  const group = new THREE.Group();
  group.name = `furniture_${item.instanceId}`;
  group.userData = {
    instanceId: item.instanceId,
    productId: item.productId,
    isFurnitureGroup: true,
  };

  const { width, height, depth } = item.spec3D.overallDimensionsMeters;

  // If currently generating via Gemini, show a 3D laser-scanning bounding box on the floor with exact cm dimensions
  if (item.isGenerating) {
    const boxGeom = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(boxGeom);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0058a3 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.position.set(0, height / 2, 0);
    group.add(wireframe);

    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x0058a3,
      transparent: true,
      opacity: 0.1,
    });
    const fillMesh = new THREE.Mesh(boxGeom, fillMat);
    fillMesh.position.set(0, height / 2, 0);
    group.add(fillMesh);

    // Laser scanning horizontal slice ring
    const laserRingGeom = new THREE.BoxGeometry(width + 0.04, 0.018, depth + 0.04);
    const laserRingMat = new THREE.MeshBasicMaterial({
      color: 0xffdb00,
      transparent: true,
      opacity: 0.85,
    });
    const laserRing = new THREE.Mesh(laserRingGeom, laserRingMat);
    laserRing.position.set(0, height * 0.55, 0);
    group.add(laserRing);

    const label = createLaserScanLabelSprite(
      `AI 3D CAD: ${item.product.dimensionsCm.width}×${item.product.dimensionsCm.depth}×${item.product.dimensionsCm.height} cm`
    );
    label.position.set(0, height + 0.22, 0);
    group.add(label);
  } else {
    for (const part of item.spec3D.parts) {
      const geom = createPartGeometry(part);
      const mat = createPartMaterial(part);
      const mesh = new THREE.Mesh(geom, mat);

      mesh.position.set(
        part.position?.[0] || 0,
        part.position?.[1] || 0,
        part.position?.[2] || 0
      );
      mesh.rotation.set(
        part.rotation?.[0] || 0,
        part.rotation?.[1] || 0,
        part.rotation?.[2] || 0
      );
      mesh.castShadow = part.materialType !== 'woven_rug';
      mesh.receiveShadow = true;
      mesh.userData = {
        instanceId: item.instanceId,
        partName: part.name,
      };
      group.add(mesh);

      if (part.materialType === 'emissive_lamp' || part.materialType === 'emissive_light') {
        const bulbLight = new THREE.PointLight(part.colorHex || '#FFF1D0', 0.85, 3.8);
        bulbLight.position.set(
          part.position[0] || 0,
          part.position[1] || 0,
          part.position[2] || 0
        );
        group.add(bulbLight);
      }
    }
  }

  // Selection outline ring & interactive 3D Transform Gizmo
  if (isSelected) {
    const pad = 0.04;
    const selGeom = new THREE.BoxGeometry(width + pad, height + pad, depth + pad);
    const selEdges = new THREE.EdgesGeometry(selGeom);
    const selMat = new THREE.LineBasicMaterial({ color: 0x0058a3 });
    const selBox = new THREE.LineSegments(selEdges, selMat);
    selBox.position.set(0, height / 2, 0);
    group.add(selBox);

    const ringRadius = Math.max(width, depth) * 0.58 + 0.12;

    // Sub-group counter-rotated so translation arrows and compass ticks remain world-aligned
    const gizmoWorldGroup = new THREE.Group();
    gizmoWorldGroup.name = 'gizmo_world_aligned';
    gizmoWorldGroup.rotation.y = -(item.rotationY * Math.PI) / 180;
    group.add(gizmoWorldGroup);

    // 1. Rotation Compass Ring on Floor (World-aligned compass circle)
    const ringGeom = new THREE.RingGeometry(ringRadius - 0.022, ringRadius + 0.022, 64);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffdb00,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.position.set(0, 0.008, 0);
    ringMesh.userData = { isRotationGizmo: true, instanceId: item.instanceId };
    gizmoWorldGroup.add(ringMesh);

    // Front Grab Handle Sphere for 3D continuous rotation (attached to object so it indicates heading)
    const grabGeom = new THREE.SphereGeometry(0.065, 16, 16);
    const grabMat = new THREE.MeshStandardMaterial({
      color: 0xffdb00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.6,
    });
    const grabHandle = new THREE.Mesh(grabGeom, grabMat);
    grabHandle.position.set(0, 0.04, ringRadius);
    grabHandle.userData = { isRotationGizmo: true, instanceId: item.instanceId };
    group.add(grabHandle);

    // Cardinal angle tick markers (0°, 90°, 180°, 270°) aligned to world axes
    for (let c = 0; c < 4; c++) {
      const angle = (c * Math.PI) / 2;
      const tick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
      );
      tick.position.set(Math.sin(angle) * ringRadius, 0.012, Math.cos(angle) * ringRadius);
      tick.userData = { isRotationGizmo: true, instanceId: item.instanceId };
      gizmoWorldGroup.add(tick);
    }

    // 2. Translation Gizmo (World-aligned Red X Arrow + Blue Z Arrow + Center Grab Disk)
    const arrowLen = Math.min(0.65, ringRadius * 0.75);

    // Center free move disc
    const centerDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.09, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x0058a3, side: THREE.DoubleSide })
    );
    centerDisc.position.y = 0.012;
    centerDisc.userData = { isTranslateGizmo: true, axis: 'xz', instanceId: item.instanceId };
    gizmoWorldGroup.add(centerDisc);

    // Red X Arrow (Points along World +X)
    const xGroup = new THREE.Group();
    const xShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, arrowLen, 12).rotateZ(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe02424 })
    );
    xShaft.position.x = arrowLen / 2;
    const xHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.038, 0.11, 16).rotateZ(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe02424 })
    );
    xHead.position.x = arrowLen + 0.05;
    xGroup.add(xShaft, xHead);
    xGroup.position.y = 0.02;
    xGroup.traverse((c) => {
      c.userData = { isTranslateGizmo: true, axis: 'x', instanceId: item.instanceId };
    });
    gizmoWorldGroup.add(xGroup);

    // Blue Z Arrow (Points along World +Z)
    const zGroup = new THREE.Group();
    const zShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, arrowLen, 12).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x1a56db })
    );
    zShaft.position.z = arrowLen / 2;
    const zHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.038, 0.11, 16).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x1a56db })
    );
    zHead.position.z = arrowLen + 0.05;
    zGroup.add(zShaft, zHead);
    zGroup.position.y = 0.02;
    zGroup.traverse((c) => {
      c.userData = { isTranslateGizmo: true, axis: 'z', instanceId: item.instanceId };
    });
    gizmoWorldGroup.add(zGroup);

    // 3. Architectural CAD Dimension Callouts (Width, Depth, Height)
    const dimensionOverlay = buildDimensionOverlay(item, dimensionOptions);
    group.add(dimensionOverlay);
  }

  group.position.set(item.position[0], item.position[1], item.position[2]);
  group.rotation.y = (item.rotationY * Math.PI) / 180;

  return group;
}

/**
 * Cleanly disposes all geometries, materials, textures, and child dimension overlays
 * in a furniture group to prevent WebGL memory leaks during item selection and drag updates.
 */
export function disposeFurnitureGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj.userData?.isDimensionOverlay && typeof obj.userData.dispose === 'function') {
      obj.userData.dispose();
      return;
    }
    if ('geometry' in obj && obj.geometry instanceof THREE.BufferGeometry) {
      obj.geometry.dispose();
    }
    if ('material' in obj && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (mat.map && mat.map instanceof THREE.Texture) {
          mat.map.dispose();
        }
        mat.dispose();
      }
    }
  });
  group.clear();
}
