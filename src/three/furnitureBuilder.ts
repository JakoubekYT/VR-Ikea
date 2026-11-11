import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  FurnitureMaterialType,
  FurniturePartSpec,
  PlacedFurniture,
  TimeOfDayPreset,
} from '../types/ikea';
import { getSharedFabricBumpMap, getSharedWoodBumpMap } from './proceduralTextures';
import { formatCZK, formatEUR } from '../utils/roomLogic';

let sharedContactShadowTexture: THREE.CanvasTexture | null = null;

function getContactShadowTexture(): THREE.CanvasTexture {
  if (sharedContactShadowTexture) return sharedContactShadowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.48);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.44)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.18)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  sharedContactShadowTexture = new THREE.CanvasTexture(canvas);
  sharedContactShadowTexture.colorSpace = THREE.SRGBColorSpace;
  return sharedContactShadowTexture;
}

export function createPbrMaterial(
  matType: FurnitureMaterialType,
  colorHex: string,
  isSoftwareGl: boolean,
  timeOfDay: TimeOfDayPreset
): THREE.Material {
  const color = new THREE.Color(colorHex || '#CCCCCC');

  switch (matType) {
    case 'oak_wood':
    case 'walnut_wood':
    case 'birch_wood':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: matType === 'walnut_wood' ? 0.42 : 0.52,
        metalness: 0.05,
        bumpMap: getSharedWoodBumpMap(),
        bumpScale: 0.005,
      });

    case 'boucle_fabric':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.88,
        metalness: 0.02,
        bumpMap: getSharedFabricBumpMap(),
        bumpScale: 0.008,
      });

    case 'velvet':
      return new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.72,
        metalness: 0.05,
        sheen: isSoftwareGl ? 0 : 0.85,
        sheenRoughness: 0.45,
        sheenColor: new THREE.Color('#ffffff'),
      });

    case 'leather':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.36,
        metalness: 0.08,
        bumpMap: getSharedFabricBumpMap(),
        bumpScale: 0.003,
      });

    case 'metal_brass':
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex || '#C5A059'),
        roughness: 0.24,
        metalness: 0.88,
      });

    case 'metal_black':
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex || '#242629'),
        roughness: 0.38,
        metalness: 0.78,
      });

    case 'chrome':
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex || '#DCDFE4'),
        roughness: 0.14,
        metalness: 0.94,
      });

    case 'glass':
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(colorHex || '#EEF5F9'),
        roughness: 0.08,
        metalness: 0.05,
        transmission: isSoftwareGl ? 0 : 0.88,
        transparent: true,
        opacity: isSoftwareGl ? 0.38 : 1.0,
        ior: 1.52,
        depthWrite: false,
      });

    case 'emissive_light': {
      const isEvening = timeOfDay === 'Cozy Evening';
      const isSunset = timeOfDay === 'Golden Hour Sunset';
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#FFF8E7'),
        emissive: new THREE.Color('#FFCF78'),
        emissiveIntensity: isEvening ? 1.8 : isSunset ? 1.1 : 0.45,
        roughness: 0.25,
        metalness: 0.0,
      });
    }

    case 'matte_paint':
    default:
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.04,
      });
  }
}

function buildPartGeometry(part: FurniturePartSpec): THREE.BufferGeometry {
  const [w, h, d] = part.size.map((v) => Math.max(0.008, v));
  switch (part.shape) {
    case 'cylinder': {
      const rTop = w / 2;
      const rBot = d / 2;
      return new THREE.CylinderGeometry(rTop, rBot, h, 20);
    }
    case 'sphere': {
      const geom = new THREE.SphereGeometry(0.5, 22, 16);
      geom.scale(w, h, d);
      return geom;
    }
    case 'cone': {
      return new THREE.ConeGeometry(w / 2, h, 24, 1, true);
    }
    case 'torus': {
      const r = Math.max(0.015, w / 2);
      const tube = Math.max(0.004, h / 2);
      const geom = new THREE.TorusGeometry(r, tube, 12, 24);
      geom.rotateX(Math.PI / 2);
      return geom;
    }
    case 'rounded_box':
    default: {
      const minDim = Math.min(w, h, d);
      const radius = Math.min(0.028, minDim * 0.16);
      return new RoundedBoxGeometry(w, h, d, 3, radius);
    }
  }
}

/**
 * Creates a floating 3D IKEA Store Price Tag Sprite for VR & studio inspection
 */
export function createIkeaPriceTagSprite(item: PlacedFurniture): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // White card with subtle border and IKEA yellow top accent
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(12, 12, 488, 232, 16);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0058A3';
  ctx.stroke();

  // IKEA blue header pill
  ctx.fillStyle = '#0058A3';
  ctx.fillRect(32, 32, 148, 34);
  ctx.fillStyle = '#FFDB00';
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.fillText(item.product.articleNumber, 44, 56);

  // Product Name & Subtitle
  ctx.fillStyle = '#111111';
  ctx.font = '800 34px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText(item.product.name, 32, 108);

  ctx.fillStyle = '#484848';
  ctx.font = '500 20px Inter, sans-serif';
  const sub =
    item.product.subtitle.length > 36
      ? item.product.subtitle.slice(0, 34) + '…'
      : item.product.subtitle;
  ctx.fillText(sub, 32, 138);

  // Price & Dimensions
  ctx.fillStyle = '#111111';
  ctx.font = '800 38px "JetBrains Mono", Inter, sans-serif';
  ctx.fillText(`${formatCZK(item.product.priceCZK)} / ${formatEUR(item.product.priceEUR)}`, 32, 192);

  ctx.fillStyle = '#0058A3';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  const { width, depth, height } = item.product.dimensionsCm;
  ctx.fillText(`${width} × ${depth} × ${height} cm · ${item.selectedSwatchName}`, 32, 224);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.95, 0.475, 1);
  sprite.position.set(0, item.spec3D.overallDimensionsMeters.height + 0.42, 0);
  sprite.renderOrder = 999;
  sprite.name = 'VR_PRICE_TAG';
  return sprite;
}

/**
 * Constructs a complete Three.js Group for a PlacedFurniture instance
 */
export function buildFurnitureGroup(
  item: PlacedFurniture,
  isSelected: boolean,
  isSoftwareGl: boolean,
  timeOfDay: TimeOfDayPreset
): THREE.Group {
  const group = new THREE.Group();
  group.name = `furniture_${item.instanceId}`;
  group.userData = {
    instanceId: item.instanceId,
    isFurnitureRoot: true,
    product: item.product,
  };

  const { width: W, height: H, depth: D } = item.spec3D.overallDimensionsMeters;

  // 1. Soft radial contact shadow on floor (offset at y = 0.005 so no Z-fighting)
  const shadowGeo = new THREE.PlaneGeometry(W * 1.18, D * 1.18);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: item.product.category === 'Rugs & Decor' ? 0.15 : 0.46,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.004;
  group.add(shadowMesh);

  // 2. Invisible fast raycast proxy bounding box for effortless selection & dragging
  const hitBoxGeo = new THREE.BoxGeometry(Math.max(0.25, W), Math.max(0.08, H), Math.max(0.25, D));
  const hitBoxMat = new THREE.MeshBasicMaterial({
    visible: false,
  });
  const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
  hitBox.position.set(0, Math.max(0.04, H / 2), 0);
  hitBox.userData = {
    instanceId: item.instanceId,
    isHitProxy: true,
  };
  group.add(hitBox);

  // 3. If generating via AI/Catalog progress bar, show architectural CAD wireframe box placeholder
  if (item.isGenerating) {
    const wireBoxGeo = new THREE.BoxGeometry(W, Math.max(0.12, H), D);
    const edges = new THREE.EdgesGeometry(wireBoxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0058a3,
      transparent: true,
      opacity: 0.9,
    });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.position.set(0, Math.max(0.06, H / 2), 0);
    group.add(wireframe);

    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x0058a3,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const fillBox = new THREE.Mesh(wireBoxGeo, fillMat);
    fillBox.position.set(0, Math.max(0.06, H / 2), 0);
    group.add(fillBox);
  } else {
    // 4. Build all 12-30 composite sub-parts
    for (const part of item.spec3D.parts) {
      const geom = buildPartGeometry(part);
      const effectiveColor = part.isPrimaryColorTarget ? item.selectedColorHex : part.colorHex;
      const mat = createPbrMaterial(part.material, effectiveColor, isSoftwareGl, timeOfDay);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(part.position[0], part.position[1], part.position[2]);
      if (part.rotation) {
        mesh.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2]);
      }
      if (!isSoftwareGl && item.product.category !== 'Rugs & Decor') {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      mesh.userData = { instanceId: item.instanceId };
      group.add(mesh);
    }

    // 5. If this is an IKEA Lamp and Time of Day is Cozy Evening or Sunset, emit warm PointLight
    const hasLightPart =
      item.product.category === 'Lighting' ||
      item.spec3D.parts.some((p) => p.material === 'emissive_light');
    if (hasLightPart && (timeOfDay === 'Cozy Evening' || timeOfDay === 'Golden Hour Sunset')) {
      const lampLight = new THREE.PointLight(
        0xffb86c,
        timeOfDay === 'Cozy Evening' ? 3.2 : 1.4,
        5.5,
        1.8
      );
      lampLight.position.set(0, Math.max(0.25, H * 0.78), 0);
      lampLight.castShadow = false;
      group.add(lampLight);
    }
  }

  // 6. Selection outline ring on floor when selected
  if (isSelected) {
    const pad = 0.08;
    const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(W + pad, 0.02, D + pad));
    const borderMat = new THREE.LineBasicMaterial({ color: 0x0058a3 });
    const borderLine = new THREE.LineSegments(borderGeo, borderMat);
    borderLine.position.set(0, 0.015, 0);
    group.add(borderLine);

    // Subtle IKEA yellow corner handles
    const cornerGeo = new THREE.BoxGeometry(0.06, 0.03, 0.06);
    const cornerMat = new THREE.MeshBasicMaterial({ color: 0xffdb00 });
    [
      [-(W + pad) / 2, -(D + pad) / 2],
      [(W + pad) / 2, -(D + pad) / 2],
      [-(W + pad) / 2, (D + pad) / 2],
      [(W + pad) / 2, (D + pad) / 2],
    ].forEach(([cx, cz]) => {
      const corner = new THREE.Mesh(cornerGeo, cornerMat);
      corner.position.set(cx, 0.018, cz);
      group.add(corner);
    });
  }

  // 7. Floating 3D VR / Studio Price Tag Sprite
  if (item.showVrPriceTag) {
    const tagSprite = createIkeaPriceTagSprite(item);
    group.add(tagSprite);
  }

  group.position.set(item.position[0], item.position[1], item.position[2]);
  group.rotation.y = item.rotationY;
  group.scale.setScalar(item.scale);

  return group;
}
