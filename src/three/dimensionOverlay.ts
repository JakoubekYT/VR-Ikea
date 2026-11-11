import * as THREE from 'three';
import type { PlacedFurnitureItem } from '../types/ikea.js';

export interface DimensionOverlayOptions {
  unitFormat?: 'cm' | 'm' | 'dual'; // 'cm': "120 cm", 'm': "1.20 m", 'dual': "120 cm (1.20 m)"
  showAxisPrefix?: boolean; // true: "W: 120 cm", false: "120 cm"
  theme?: 'ikea' | 'cad' | 'minimal';
  lineColor?: number;
  showTicks?: boolean;
  showArrows?: boolean;
  showHeight?: boolean;
  calloutOffset?: number;
}

export interface DimensionLineGeometryData {
  positions: Float32Array;
  lineCount: number;
  badgePositions: {
    width: [number, number, number];
    depth: [number, number, number];
    height: [number, number, number];
  };
  labels: {
    width: string;
    depth: string;
    height: string;
  };
}

// Global texture cache for reusable badge labels
const badgeTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Format dimension measurement to string based on preferences.
 */
export function formatDimensionValue(
  meters: number,
  axis: 'W' | 'D' | 'H',
  unitFormat: 'cm' | 'm' | 'dual' = 'cm',
  showAxisPrefix = true
): string {
  const cmVal = Math.round(meters * 100);
  const mVal = meters.toFixed(2);
  const prefix = showAxisPrefix ? `${axis}: ` : '';

  switch (unitFormat) {
    case 'm':
      return `${prefix}${mVal} m`;
    case 'dual':
      return `${prefix}${cmVal} cm (${mVal} m)`;
    case 'cm':
    default:
      return `${prefix}${cmVal} cm`;
  }
}

/**
 * Pure math helper: computes all vertex pairs for witness lines, dimension lines,
 * 45-degree CAD ticks, and arrow returns in local coordinate space.
 */
export function computeDimensionSegments(
  dimensions: { width: number; height: number; depth: number },
  options: DimensionOverlayOptions = {}
): DimensionLineGeometryData {
  const { width: w, height: h, depth: d } = dimensions;
  const showTicks = options.showTicks ?? true;
  const showArrows = options.showArrows ?? true;
  const showHeight = options.showHeight ?? (h >= 0.06);

  const offset = options.calloutOffset ?? Math.max(0.09, Math.min(0.18, Math.max(w, d) * 0.1));
  const wallGap = 0.02; // 2 cm gap between furniture surface and witness line start
  const overshoot = 0.03; // 3 cm witness line extension past dimension line
  const tickSize = 0.022; // 2.2 cm 45° CAD slash
  const arrowLen = 0.035;
  const arrowWidth = 0.015;
  const floorEpsilon = 0.015; // 1.5 cm above floor to prevent z-fighting

  const segments: number[] = [];

  function addLine(p1: [number, number, number], p2: [number, number, number]) {
    segments.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
  }

  // --------------------------------------------------------------------------
  // 1. WIDTH (X-axis dimension along front face)
  // --------------------------------------------------------------------------
  const zFront = d / 2 + offset;
  // Dimension Line
  addLine([-w / 2, floorEpsilon, zFront], [w / 2, floorEpsilon, zFront]);
  // Witness Lines (Left & Right)
  addLine([-w / 2, floorEpsilon, d / 2 + wallGap], [-w / 2, floorEpsilon, zFront + overshoot]);
  addLine([w / 2, floorEpsilon, d / 2 + wallGap], [w / 2, floorEpsilon, zFront + overshoot]);

  if (showTicks) {
    // 45° CAD slashes in horizontal plane (XZ)
    addLine(
      [-w / 2 - tickSize, floorEpsilon, zFront - tickSize],
      [-w / 2 + tickSize, floorEpsilon, zFront + tickSize]
    );
    addLine(
      [w / 2 - tickSize, floorEpsilon, zFront - tickSize],
      [w / 2 + tickSize, floorEpsilon, zFront + tickSize]
    );
  }

  if (showArrows) {
    // Left arrow pointing inward/outward
    addLine([-w / 2, floorEpsilon, zFront], [-w / 2 + arrowLen, floorEpsilon, zFront - arrowWidth]);
    addLine([-w / 2, floorEpsilon, zFront], [-w / 2 + arrowLen, floorEpsilon, zFront + arrowWidth]);
    // Right arrow
    addLine([w / 2, floorEpsilon, zFront], [w / 2 - arrowLen, floorEpsilon, zFront - arrowWidth]);
    addLine([w / 2, floorEpsilon, zFront], [w / 2 - arrowLen, floorEpsilon, zFront + arrowWidth]);
  }

  // --------------------------------------------------------------------------
  // 2. DEPTH (Z-axis dimension along right face)
  // --------------------------------------------------------------------------
  const xRight = w / 2 + offset;
  // Dimension Line
  addLine([xRight, floorEpsilon, -d / 2], [xRight, floorEpsilon, d / 2]);
  // Witness Lines (Rear & Front)
  addLine([w / 2 + wallGap, floorEpsilon, -d / 2], [xRight + overshoot, floorEpsilon, -d / 2]);
  addLine([w / 2 + wallGap, floorEpsilon, d / 2], [xRight + overshoot, floorEpsilon, d / 2]);

  if (showTicks) {
    // 45° CAD slashes in horizontal plane (XZ)
    addLine(
      [xRight - tickSize, floorEpsilon, -d / 2 - tickSize],
      [xRight + tickSize, floorEpsilon, -d / 2 + tickSize]
    );
    addLine(
      [xRight - tickSize, floorEpsilon, d / 2 - tickSize],
      [xRight + tickSize, floorEpsilon, d / 2 + tickSize]
    );
  }

  if (showArrows) {
    addLine([xRight, floorEpsilon, -d / 2], [xRight - arrowWidth, floorEpsilon, -d / 2 + arrowLen]);
    addLine([xRight, floorEpsilon, -d / 2], [xRight + arrowWidth, floorEpsilon, -d / 2 + arrowLen]);
    addLine([xRight, floorEpsilon, d / 2], [xRight - arrowWidth, floorEpsilon, d / 2 - arrowLen]);
    addLine([xRight, floorEpsilon, d / 2], [xRight + arrowWidth, floorEpsilon, d / 2 - arrowLen]);
  }

  // --------------------------------------------------------------------------
  // 3. HEIGHT (Y-axis vertical dimension at front-left corner)
  // --------------------------------------------------------------------------
  const xLeft = -w / 2 - offset;
  const zLeft = d / 2;

  if (showHeight) {
    // Dimension Line (vertical)
    addLine([xLeft, 0, zLeft], [xLeft, h, zLeft]);
    // Witness Lines (Bottom & Top)
    addLine([-w / 2 - wallGap, 0, zLeft], [xLeft - overshoot, 0, zLeft]);
    addLine([-w / 2 - wallGap, h, zLeft], [xLeft - overshoot, h, zLeft]);

    if (showTicks) {
      // 45° CAD slashes in vertical plane (XY)
      addLine([xLeft - tickSize, -tickSize, zLeft], [xLeft + tickSize, tickSize, zLeft]);
      addLine([xLeft - tickSize, h - tickSize, zLeft], [xLeft + tickSize, h + tickSize, zLeft]);
    }

    if (showArrows) {
      addLine([xLeft, 0, zLeft], [xLeft - arrowWidth, arrowLen, zLeft]);
      addLine([xLeft, 0, zLeft], [xLeft + arrowWidth, arrowLen, zLeft]);
      addLine([xLeft, h, zLeft], [xLeft - arrowWidth, h - arrowLen, zLeft]);
      addLine([xLeft, h, zLeft], [xLeft + arrowWidth, h - arrowLen, zLeft]);
    }
  }

  return {
    positions: new Float32Array(segments),
    lineCount: segments.length / 6,
    badgePositions: {
      width: [0, floorEpsilon + 0.05, zFront],
      depth: [xRight, floorEpsilon + 0.05, 0],
      height: [xLeft, h / 2, zLeft],
    },
    labels: {
      width: formatDimensionValue(w, 'W', options.unitFormat, options.showAxisPrefix),
      depth: formatDimensionValue(d, 'D', options.unitFormat, options.showAxisPrefix),
      height: formatDimensionValue(h, 'H', options.unitFormat, options.showAxisPrefix),
    },
  };
}

/**
 * Creates or retrieves a cached high-DPI CanvasTexture for the badge.
 */
function getOrCreateBadgeTexture(
  text: string,
  theme: 'ikea' | 'cad' | 'minimal' = 'ikea'
): THREE.CanvasTexture {
  const cacheKey = `${text}_${theme}`;
  if (badgeTextureCache.has(cacheKey)) {
    return badgeTextureCache.get(cacheKey)!;
  }

  if (typeof document === 'undefined') {
    // Safe mock for headless Node.js tests
    const dummy = new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
    return dummy;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;

  const isIkea = theme === 'ikea';
  const bgColor = isIkea ? 'rgba(0, 88, 163, 0.92)' : 'rgba(15, 23, 42, 0.90)';
  const borderColor = isIkea ? '#FFDB00' : '#38BDF8';
  const textColor = '#FFFFFF';

  // Pill badge background
  ctx.clearRect(0, 0, 512, 140);
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(14, 18, 484, 104, 20);
  } else {
    ctx.rect(14, 18, 484, 104);
  }
  ctx.fill();

  // Border
  ctx.lineWidth = 4;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  // Text
  ctx.fillStyle = textColor;
  ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 70);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  badgeTextureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Builds a single floating billboard text sprite for a dimension callout.
 */
function createDimensionBadgeSprite(
  text: string,
  pos: [number, number, number],
  scaleFactor: number,
  theme: 'ikea' | 'cad' | 'minimal' = 'ikea'
): THREE.Sprite {
  const texture = getOrCreateBadgeTexture(text, theme);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.position.set(pos[0], pos[1], pos[2]);
  // Base physical size: 0.44m wide x 0.12m high, scaled adaptively
  sprite.scale.set(0.44 * scaleFactor, 0.12 * scaleFactor, 1);
  sprite.renderOrder = 999;
  // Ignore raycasting so the badge never blocks clicking furniture or floor
  sprite.raycast = () => {};

  return sprite;
}

/**
 * Main Builder: Assembles the architectural CAD dimension line group.
 */
export function buildDimensionOverlay(
  item: PlacedFurnitureItem,
  options: DimensionOverlayOptions = {}
): THREE.Group {
  const overlayGroup = new THREE.Group();
  overlayGroup.name = `dimOverlay_${item.instanceId}`;
  overlayGroup.userData = {
    isDimensionOverlay: true,
    instanceId: item.instanceId,
  };

  const w = item.spec3D?.overallDimensionsMeters?.width ?? (item.product.dimensionsCm.width / 100);
  const h = item.spec3D?.overallDimensionsMeters?.height ?? (item.product.dimensionsCm.height / 100);
  const d = item.spec3D?.overallDimensionsMeters?.depth ?? (item.product.dimensionsCm.depth / 100);

  const data = computeDimensionSegments({ width: w, height: h, depth: d }, options);

  // 1. Line Segments (batched in 1 draw call)
  const lineGeom = new THREE.BufferGeometry();
  lineGeom.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));

  const lineColor = options.lineColor ?? (options.theme === 'cad' ? 0x0284c7 : 0x0058a3);
  const lineMat = new THREE.LineBasicMaterial({
    color: lineColor,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
  });

  const lineSegments = new THREE.LineSegments(lineGeom, lineMat);
  lineSegments.renderOrder = 998;
  lineSegments.raycast = () => {};
  overlayGroup.add(lineSegments);

  // 2. Floating Text Badges
  const theme = options.theme ?? 'ikea';
  const badgeScale = Math.min(1.0, Math.max(0.68, Math.max(w, d) * 0.75));

  const widthBadge = createDimensionBadgeSprite(data.labels.width, data.badgePositions.width, badgeScale, theme);
  const depthBadge = createDimensionBadgeSprite(data.labels.depth, data.badgePositions.depth, badgeScale, theme);
  overlayGroup.add(widthBadge);
  overlayGroup.add(depthBadge);

  if (options.showHeight ?? (h >= 0.06)) {
    const heightBadge = createDimensionBadgeSprite(data.labels.height, data.badgePositions.height, badgeScale, theme);
    overlayGroup.add(heightBadge);
  }

  // Attach disposal function handle directly to userData
  overlayGroup.userData.dispose = () => disposeDimensionOverlay(overlayGroup);

  return overlayGroup;
}

/**
 * Cleanly disposes geometries, materials, and textures for an overlay group.
 */
export function disposeDimensionOverlay(overlay: THREE.Group): void {
  overlay.traverse((child) => {
    if (child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    } else if (child instanceof THREE.Sprite) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
  overlay.clear();
}

/**
 * Clears cached CanvasTextures on full application unmount.
 */
export function clearDimensionBadgeCache(): void {
  badgeTextureCache.forEach((texture) => {
    texture.dispose();
  });
  badgeTextureCache.clear();
}
