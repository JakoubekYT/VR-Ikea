import {
  BomLineItem,
  BomSummary,
  Furniture3DSpec,
  FurnitureMaterialType,
  FurniturePartSpec,
  IkeaCategory,
  IkeaProduct,
  PlacedFurniture,
  WallId,
} from '../types/ikea';

/**
 * Formats a number in Czech Koruna (CZK) with space thousands separators
 */
export function formatCZK(amount: number): string {
  return `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
}

/**
 * Formats a number in EUR
 */
export function formatEUR(amount: number): string {
  return `€${Math.round(amount).toLocaleString('en-IE')}`;
}

/**
 * Parses an input string to detect if it's an IKEA product URL and extracts metadata
 */
export function parseIkeaUrl(input: string): {
  isUrl: boolean;
  url?: string;
  extractedName?: string;
  extractedArticleNumber?: string;
  extractedLocale?: string;
} {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return { isUrl: false };
  }

  try {
    const parsed = new URL(trimmed);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    // e.g. /cz/cs/p/kivik-3mistna-pohovka-tibbleby-bezova-seda-s49440598/
    const locale = pathParts.slice(0, 2).join('/');
    const pIndex = pathParts.indexOf('p');
    const slug = pIndex >= 0 && pathParts[pIndex + 1] ? pathParts[pIndex + 1] : pathParts[pathParts.length - 1] || '';

    const artMatch = slug.match(/s?(\d{3})(\d{3})(\d{2})$/i);
    const extractedArticleNumber = artMatch
      ? `${artMatch[1]}.${artMatch[2]}.${artMatch[3]}`
      : undefined;

    const cleanWords = slug
      .replace(/-?s?\d{8}$/i, '')
      .split('-')
      .filter(Boolean);

    const extractedName = cleanWords.length > 0 ? cleanWords[0].toUpperCase() : 'IKEA';

    return {
      isUrl: true,
      url: trimmed,
      extractedName,
      extractedArticleNumber,
      extractedLocale: locale || 'cz/cs',
    };
  } catch {
    return { isUrl: false };
  }
}

/**
 * Filters the catalog by category and search query
 */
export function filterCatalog(
  catalog: IkeaProduct[],
  category: IkeaCategory,
  searchQuery: string
): IkeaProduct[] {
  const q = searchQuery.trim().toLowerCase();
  const parsedUrl = parseIkeaUrl(searchQuery);

  return catalog.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category;
    if (!matchesCategory) return false;
    if (!q) return true;

    if (item.sourceUrl && item.sourceUrl.toLowerCase().includes(q)) {
      return true;
    }
    if (item.matchedQueries?.some((mq) => mq.toLowerCase() === q || q.includes(mq.toLowerCase()))) {
      return true;
    }
    if (parsedUrl.isUrl) {
      if (
        parsedUrl.extractedArticleNumber &&
        item.articleNumber === parsedUrl.extractedArticleNumber
      ) {
        return true;
      }
      if (
        parsedUrl.extractedName &&
        item.name.toUpperCase() === parsedUrl.extractedName.toUpperCase()
      ) {
        return true;
      }
    }

    const haystack = `${item.name} ${item.subtitle} ${item.category} ${item.articleNumber} ${item.materialsDescription}`.toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Calculates the live Shopping List / Bill of Materials (BOM) summary for all placed furniture
 */
export function calculateBomSummary(placed: PlacedFurniture[]): BomSummary {
  const map = new Map<string, BomLineItem>();
  let totalCount = 0;
  let totalPriceCZK = 0;
  let totalPriceEUR = 0;
  let totalFloorAreaM2 = 0;

  for (const item of placed) {
    const key = `${item.product.id}__${item.selectedColorHex}`;
    const existing = map.get(key);
    const wMeters = (item.product.dimensionsCm.width / 100) * item.scale;
    const dMeters = (item.product.dimensionsCm.depth / 100) * item.scale;
    totalFloorAreaM2 += wMeters * dMeters;
    totalCount += 1;
    totalPriceCZK += item.product.priceCZK;
    totalPriceEUR += item.product.priceEUR;

    if (existing) {
      existing.quantity += 1;
      existing.lineTotalCZK += item.product.priceCZK;
      existing.lineTotalEUR += item.product.priceEUR;
      existing.instanceIds.push(item.instanceId);
    } else {
      map.set(key, {
        product: item.product,
        selectedColorHex: item.selectedColorHex,
        selectedSwatchName: item.selectedSwatchName,
        quantity: 1,
        unitPriceCZK: item.product.priceCZK,
        unitPriceEUR: item.product.priceEUR,
        lineTotalCZK: item.product.priceCZK,
        lineTotalEUR: item.product.priceEUR,
        instanceIds: [item.instanceId],
      });
    }
  }

  return {
    items: Array.from(map.values()),
    totalCount,
    totalPriceCZK,
    totalPriceEUR,
    totalFloorAreaM2: Number(totalFloorAreaM2.toFixed(2)),
  };
}

/**
 * Snaps a coordinate to a grid step (e.g., 0.25m)
 */
export function snapToGrid(value: number, step: number = 0.25): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Clamps furniture floor position [x, z] so its bounding box stays inside the room walls
 */
export function clampToRoomBounds(
  position: [number, number, number],
  dimensionsMeters: { width: number; depth: number },
  rotationY: number,
  roomWidth: number,
  roomLength: number
): [number, number, number] {
  const cos = Math.abs(Math.cos(rotationY));
  const sin = Math.abs(Math.sin(rotationY));
  const halfExtentX = (dimensionsMeters.width * cos + dimensionsMeters.depth * sin) / 2;
  const halfExtentZ = (dimensionsMeters.width * sin + dimensionsMeters.depth * cos) / 2;

  const maxX = Math.max(0.1, roomWidth / 2 - halfExtentX - 0.04);
  const maxZ = Math.max(0.1, roomLength / 2 - halfExtentZ - 0.04);

  const clampedX = Math.max(-maxX, Math.min(maxX, position[0]));
  const clampedZ = Math.max(-maxZ, Math.min(maxZ, position[2]));
  return [Number(clampedX.toFixed(3)), position[1], Number(clampedZ.toFixed(3))];
}

/**
 * Determines which walls should be cutaway (faded/hidden) based on camera world position
 * so the operator can always see unobstructed inside the room.
 */
export function computeWallCutaway(
  cameraPos: [number, number, number],
  roomWidth: number,
  roomLength: number,
  enabled: boolean
): Record<WallId, boolean> {
  if (!enabled) {
    return { north: false, south: false, east: false, west: false };
  }
  const [cx, , cz] = cameraPos;
  return {
    north: cz < -roomLength * 0.25,
    south: cz > roomLength * 0.25,
    east: cx > roomWidth * 0.25,
    west: cx < -roomWidth * 0.25,
  };
}

/**
 * High-detail parametric 3D furniture constructor (12 to 28 sub-parts per item)
 * Pivoted at bottom-center (y = 0) with exact real-world IKEA dimensions in meters.
 */
export function buildParametric3DSpec(
  product: IkeaProduct,
  primaryColorHex?: string
): Furniture3DSpec {
  const W = Number((product.dimensionsCm.width / 100).toFixed(3));
  const D = Number((product.dimensionsCm.depth / 100).toFixed(3));
  const H = Number((product.dimensionsCm.height / 100).toFixed(3));

  const swatch = product.swatches[product.defaultSwatchIndex ?? 0] || {
    name: 'Standard',
    hex: '#C8C0B4',
    materialOverride: 'boucle_fabric' as FurnitureMaterialType,
  };
  const color = primaryColorHex || swatch.hex;
  const primaryMat: FurnitureMaterialType = swatch.materialOverride || 'boucle_fabric';

  const parts: FurniturePartSpec[] = [];
  const arch = product.archetype || inferArchetypeFromCategory(product);

  switch (arch) {
    case 'sofa_3seat':
    case 'chaise_sofa': {
      const legH = 0.06;
      const armW = Math.min(0.22, W * 0.1);
      const innerW = W - armW * 2;
      const baseH = 0.18;
      const seatH = 0.16;
      const backD = 0.20;
      // 4 legs
      const legX = W / 2 - 0.12;
      const legZ = D / 2 - 0.12;
      [
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].forEach(([lx, lz], i) => {
        parts.push({
          name: `Leg_${i + 1}`,
          shape: 'cylinder',
          position: [lx, legH / 2, lz],
          size: [0.05, legH, 0.05],
          colorHex: '#2C2A29',
          material: arch === 'chaise_sofa' ? 'chrome' : 'oak_wood',
        });
      });
      // Main lower frame
      parts.push({
        name: 'Deck_Frame',
        shape: 'rounded_box',
        position: [0, legH + baseH / 2, 0],
        size: [innerW, baseH, D - 0.04],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // Left & Right wide armrests
      parts.push({
        name: 'Armrest_Left',
        shape: 'rounded_box',
        position: [-W / 2 + armW / 2, legH + (H * 0.62) / 2, 0],
        size: [armW, H * 0.62, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Armrest_Right',
        shape: 'rounded_box',
        position: [W / 2 - armW / 2, legH + (H * 0.62) / 2, 0],
        size: [armW, H * 0.62, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // Backrest frame
      const backFrameH = H - legH - 0.08;
      parts.push({
        name: 'Backrest_Frame',
        shape: 'rounded_box',
        position: [0, legH + backFrameH / 2, -D / 2 + backD / 2],
        size: [innerW, backFrameH, backD],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // 3 Seat cushions + 3 Backrest cushions + 2 Throw pillows (8 parts)
      const numCushions = 3;
      const cushW = (innerW - 0.02) / numCushions;
      for (let i = 0; i < numCushions; i++) {
        const cx = -innerW / 2 + cushW * (i + 0.5);
        parts.push({
          name: `Seat_Cushion_${i + 1}`,
          shape: 'rounded_box',
          position: [cx, legH + baseH + seatH / 2, 0.06],
          size: [cushW - 0.01, seatH, D - backD + 0.04],
          colorHex: color,
          material: primaryMat,
          isPrimaryColorTarget: true,
        });
        parts.push({
          name: `Back_Cushion_${i + 1}`,
          shape: 'rounded_box',
          position: [cx, legH + baseH + seatH + (H - legH - baseH - seatH) / 2, -D / 2 + backD + 0.04],
          size: [cushW - 0.015, H - legH - baseH - seatH + 0.04, 0.18],
          rotation: [-0.12, 0, 0],
          colorHex: color,
          material: primaryMat,
          isPrimaryColorTarget: true,
        });
      }
      // 2 Accent throw cushions
      parts.push({
        name: 'Accent_Pillow_Left',
        shape: 'rounded_box',
        position: [-innerW / 2 + 0.18, legH + baseH + seatH + 0.14, 0.02],
        size: [0.34, 0.32, 0.12],
        rotation: [-0.15, 0.25, 0.18],
        colorHex: '#E5D9C5',
        material: 'boucle_fabric',
      });
      parts.push({
        name: 'Accent_Pillow_Right',
        shape: 'rounded_box',
        position: [innerW / 2 - 0.18, legH + baseH + seatH + 0.14, 0.02],
        size: [0.34, 0.32, 0.12],
        rotation: [-0.15, -0.25, -0.18],
        colorHex: '#D8A444',
        material: 'velvet',
      });
      break;
    }

    case 'wing_chair': {
      const legH = 0.18;
      // 4 turned wood legs
      [
        [-W * 0.38, -D * 0.38, -0.08],
        [W * 0.38, -D * 0.38, -0.08],
        [-W * 0.38, D * 0.38, 0.04],
        [W * 0.38, D * 0.38, 0.04],
      ].forEach(([lx, lz, tilt], idx) => {
        parts.push({
          name: `Turned_Leg_${idx + 1}`,
          shape: 'cylinder',
          position: [lx, legH / 2, lz],
          size: [0.045, legH, 0.045],
          rotation: [tilt, 0, 0],
          colorHex: '#4A3525',
          material: 'walnut_wood',
        });
      });
      // Seat box & plush seat cushion
      parts.push({
        name: 'Seat_Base',
        shape: 'rounded_box',
        position: [0, legH + 0.1, 0.03],
        size: [W * 0.82, 0.18, D * 0.78],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Plush_Seat_Cushion',
        shape: 'rounded_box',
        position: [0, legH + 0.24, 0.06],
        size: [W * 0.68, 0.14, D * 0.74],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // Rolled armrests
      parts.push({
        name: 'Armrest_Left',
        shape: 'rounded_box',
        position: [-W * 0.4, legH + 0.28, 0.04],
        size: [0.14, 0.26, D * 0.75],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Armrest_Right',
        shape: 'rounded_box',
        position: [W * 0.4, legH + 0.28, 0.04],
        size: [0.14, 0.26, D * 0.75],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // Tall tufted backrest
      const backH = H - legH - 0.12;
      parts.push({
        name: 'Tall_Backrest',
        shape: 'rounded_box',
        position: [0, legH + backH / 2 + 0.08, -D * 0.32],
        size: [W * 0.82, backH, 0.16],
        rotation: [-0.14, 0, 0],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // Left & Right characteristic wings
      parts.push({
        name: 'Wing_Left',
        shape: 'rounded_box',
        position: [-W * 0.4, H * 0.72, -D * 0.16],
        size: [0.1, H * 0.42, 0.28],
        rotation: [-0.1, 0.15, 0],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Wing_Right',
        shape: 'rounded_box',
        position: [W * 0.4, H * 0.72, -D * 0.16],
        size: [0.1, H * 0.42, 0.28],
        rotation: [-0.1, -0.15, 0],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // 4 Tufted buttons on backrest
      [-0.14, 0.14].forEach((bx, i) => {
        [H * 0.62, H * 0.78].forEach((by, j) => {
          parts.push({
            name: `Tuft_Button_${i}_${j}`,
            shape: 'sphere',
            position: [bx, by, -D * 0.22],
            size: [0.032, 0.032, 0.02],
            colorHex: color,
            material: primaryMat,
            isPrimaryColorTarget: true,
          });
        });
      });
      break;
    }

    case 'poang_chair': {
      // Bentwood cantilever runners (left & right)
      [-W * 0.44, W * 0.44].forEach((rx, i) => {
        parts.push({
          name: `Base_Runner_${i}`,
          shape: 'rounded_box',
          position: [rx, 0.015, 0],
          size: [0.045, 0.025, D * 0.85],
          colorHex: '#DFC599',
          material: 'birch_wood',
        });
        parts.push({
          name: `Front_Cantilever_Strut_${i}`,
          shape: 'rounded_box',
          position: [rx, H * 0.26, D * 0.28],
          size: [0.045, H * 0.5, 0.03],
          rotation: [-0.25, 0, 0],
          colorHex: '#DFC599',
          material: 'birch_wood',
        });
        parts.push({
          name: `Armrest_Loop_${i}`,
          shape: 'rounded_box',
          position: [rx, H * 0.54, 0.02],
          size: [0.05, 0.028, D * 0.68],
          colorHex: '#DFC599',
          material: 'birch_wood',
        });
      });
      // Crossbars & slats
      parts.push({
        name: 'Crossbar_Front',
        shape: 'cylinder',
        position: [0, H * 0.34, D * 0.28],
        size: [0.03, W * 0.88, 0.03],
        rotation: [0, 0, Math.PI / 2],
        colorHex: '#DFC599',
        material: 'birch_wood',
      });
      parts.push({
        name: 'Crossbar_Top',
        shape: 'cylinder',
        position: [0, H * 0.92, -D * 0.34],
        size: [0.03, W * 0.88, 0.03],
        rotation: [0, 0, Math.PI / 2],
        colorHex: '#DFC599',
        material: 'birch_wood',
      });
      parts.push({
        name: 'Crossbar_Rear_Base',
        shape: 'cylinder',
        position: [0, 0.025, -D * 0.38],
        size: [0.028, W * 0.88, 0.028],
        rotation: [0, 0, Math.PI / 2],
        colorHex: '#DFC599',
        material: 'birch_wood',
      });
      // Seat cushion, Backrest cushion, Headrest bolster + 2 stitch ribs
      parts.push({
        name: 'Seat_Cushion',
        shape: 'rounded_box',
        position: [0, H * 0.38, 0.08],
        size: [W * 0.78, 0.09, D * 0.58],
        rotation: [0.12, 0, 0],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Back_Cushion',
        shape: 'rounded_box',
        position: [0, H * 0.65, -D * 0.16],
        size: [W * 0.78, H * 0.52, 0.09],
        rotation: [-0.32, 0, 0],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Headrest_Bolster',
        shape: 'rounded_box',
        position: [0, H * 0.9, -D * 0.28],
        size: [W * 0.74, 0.14, 0.11],
        rotation: [-0.28, 0, 0],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      break;
    }

    case 'bed_frame':
    case 'daybed': {
      const frameH = 0.36;
      const mattW = W - 0.12;
      const mattD = D - 0.14;
      // Headboard
      parts.push({
        name: 'Headboard',
        shape: 'rounded_box',
        position: [0, H / 2, -D / 2 + 0.04],
        size: [W, H, 0.07],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // Footboard
      parts.push({
        name: 'Footboard',
        shape: 'rounded_box',
        position: [0, frameH / 2, D / 2 - 0.03],
        size: [W, frameH, 0.06],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // Side rails
      parts.push({
        name: 'Side_Rail_Left',
        shape: 'rounded_box',
        position: [-W / 2 + 0.03, frameH * 0.6, 0],
        size: [0.05, frameH * 0.75, D - 0.08],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Side_Rail_Right',
        shape: 'rounded_box',
        position: [W / 2 - 0.03, frameH * 0.6, 0],
        size: [0.05, frameH * 0.75, D - 0.08],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // Plush Mattress
      parts.push({
        name: 'Mattress',
        shape: 'rounded_box',
        position: [0, frameH + 0.06, 0.02],
        size: [mattW, 0.22, mattD],
        colorHex: '#F7F5F0',
        material: 'boucle_fabric',
      });
      // Duvet / Comforter
      parts.push({
        name: 'Nordic_Duvet',
        shape: 'rounded_box',
        position: [0, frameH + 0.16, D * 0.12],
        size: [mattW + 0.04, 0.1, mattD * 0.72],
        colorHex: '#E6E1D6',
        material: 'boucle_fabric',
      });
      // Folded throw blanket at foot of bed
      parts.push({
        name: 'Foot_Blanket_Throw',
        shape: 'rounded_box',
        position: [0, frameH + 0.2, D * 0.34],
        size: [mattW + 0.06, 0.05, 0.38],
        colorHex: '#687C8C',
        material: 'boucle_fabric',
      });
      // 4 Pillows
      [-mattW * 0.25, mattW * 0.25].forEach((px, idx) => {
        parts.push({
          name: `Back_Pillow_${idx + 1}`,
          shape: 'rounded_box',
          position: [px, frameH + 0.26, -D / 2 + 0.24],
          size: [mattW * 0.42, 0.18, 0.28],
          rotation: [-0.25, 0, 0],
          colorHex: '#FFFFFF',
          material: 'boucle_fabric',
        });
        parts.push({
          name: `Accent_Pillow_${idx + 1}`,
          shape: 'rounded_box',
          position: [px, frameH + 0.24, -D / 2 + 0.42],
          size: [mattW * 0.32, 0.14, 0.22],
          rotation: [-0.15, 0, 0],
          colorHex: '#C8C0B4',
          material: 'boucle_fabric',
        });
      });
      // Under-bed storage drawers (3 drawers)
      [-W * 0.3, 0, W * 0.3].forEach((dx, idx) => {
        parts.push({
          name: `Drawer_Front_${idx + 1}`,
          shape: 'rounded_box',
          position: [dx, frameH * 0.32, D * 0.48],
          size: [W * 0.28, frameH * 0.55, 0.03],
          colorHex: color,
          material: primaryMat,
          isPrimaryColorTarget: true,
        });
      });
      break;
    }

    case 'kallax_shelf': {
      const outerThick = 0.045;
      const innerThick = 0.018;
      parts.push({
        name: 'Bottom_Panel',
        shape: 'rounded_box',
        position: [0, outerThick / 2, 0],
        size: [W, outerThick, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Top_Panel',
        shape: 'rounded_box',
        position: [0, H - outerThick / 2, 0],
        size: [W, outerThick, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Left_Panel',
        shape: 'rounded_box',
        position: [-W / 2 + outerThick / 2, H / 2, 0],
        size: [outerThick, H - outerThick * 2, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Right_Panel',
        shape: 'rounded_box',
        position: [W / 2 - outerThick / 2, H / 2, 0],
        size: [outerThick, H - outerThick * 2, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      const innerW = W - outerThick * 2;
      const innerH = H - outerThick * 2;
      for (let i = 1; i <= 3; i++) {
        const yPos = outerThick + (innerH / 4) * i;
        parts.push({
          name: `Horiz_Shelf_${i}`,
          shape: 'rounded_box',
          position: [0, yPos, 0],
          size: [innerW, innerThick, D - 0.01],
          colorHex: color,
          material: primaryMat,
          isPrimaryColorTarget: true,
        });
        const xPos = -innerW / 2 + (innerW / 4) * i;
        parts.push({
          name: `Vert_Divider_${i}`,
          shape: 'rounded_box',
          position: [xPos, H / 2, 0],
          size: [innerThick, innerH, D - 0.01],
          colorHex: color,
          material: primaryMat,
          isPrimaryColorTarget: true,
        });
      }
      const cellW = innerW / 4;
      const cellH = innerH / 4;
      [0, 1, 2, 3].forEach((col) => {
        const cx = -innerW / 2 + cellW * (col + 0.5);
        const cy = outerThick + cellH * 0.5;
        parts.push({
          name: `Drona_Box_${col + 1}`,
          shape: 'rounded_box',
          position: [cx, cy, 0],
          size: [cellW - 0.03, cellH - 0.03, D - 0.02],
          colorHex: col % 2 === 0 ? '#3A3D40' : '#D9D2C5',
          material: 'boucle_fabric',
        });
      });
      break;
    }

    case 'billy_bookcase':
    case 'pax_wardrobe': {
      const sideT = 0.025;
      parts.push({
        name: 'Left_Side',
        shape: 'rounded_box',
        position: [-W / 2 + sideT / 2, H / 2, 0],
        size: [sideT, H, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Right_Side',
        shape: 'rounded_box',
        position: [W / 2 - sideT / 2, H / 2, 0],
        size: [sideT, H, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Back_Panel',
        shape: 'rounded_box',
        position: [0, H / 2, -D / 2 + 0.01],
        size: [W - sideT * 2, H, 0.02],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Top_Cap',
        shape: 'rounded_box',
        position: [0, H - sideT / 2, 0],
        size: [W, sideT, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Base_Plinth',
        shape: 'rounded_box',
        position: [0, 0.04, 0],
        size: [W - sideT * 2, 0.08, D - 0.02],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });

      if (arch === 'pax_wardrobe') {
        const numDoors = 3;
        const doorW = (W - 0.02) / numDoors;
        for (let i = 0; i < numDoors; i++) {
          const dx = -W / 2 + 0.01 + doorW * (i + 0.5);
          parts.push({
            name: `Wardrobe_Door_${i + 1}`,
            shape: 'rounded_box',
            position: [dx, H / 2 + 0.02, D / 2 - 0.012],
            size: [doorW - 0.008, H - 0.09, 0.022],
            colorHex: color,
            material: primaryMat,
            isPrimaryColorTarget: true,
          });
          parts.push({
            name: `Door_Handle_${i + 1}`,
            shape: 'cylinder',
            position: [dx + (i === 1 ? -doorW * 0.38 : doorW * 0.38), H * 0.52, D / 2 + 0.012],
            size: [0.012, 0.24, 0.012],
            colorHex: '#C5C7C9',
            material: 'chrome',
          });
          parts.push({
            name: `Door_Hinge_Top_${i + 1}`,
            shape: 'cylinder',
            position: [dx - doorW * 0.45, H * 0.82, D / 2 - 0.02],
            size: [0.01, 0.04, 0.01],
            colorHex: '#C5C7C9',
            material: 'chrome',
          });
        }
      } else {
        const numShelves = 6;
        for (let i = 1; i < numShelves; i++) {
          const sy = 0.08 + ((H - 0.1) / numShelves) * i;
          parts.push({
            name: `Shelf_${i}`,
            shape: 'rounded_box',
            position: [0, sy, 0.005],
            size: [W - sideT * 2, 0.022, D - 0.02],
            colorHex: color,
            material: primaryMat,
            isPrimaryColorTarget: true,
          });
          if (i <= 4) {
            parts.push({
              name: `Book_Cluster_${i}`,
              shape: 'rounded_box',
              position: [(i % 2 === 0 ? -1 : 1) * (W * 0.18), sy + 0.11, 0],
              size: [W * 0.35, 0.2, D * 0.72],
              colorHex: i % 2 === 0 ? '#2E4C6D' : '#B86B4B',
              material: 'matte_paint',
            });
          }
        }
      }
      break;
    }

    case 'besta_tv_bench': {
      const legH = 0.1;
      const bodyH = H - legH;
      [
        [-W * 0.45, -D * 0.38],
        [W * 0.45, -D * 0.38],
        [-W * 0.45, D * 0.38],
        [W * 0.45, D * 0.38],
        [0, -D * 0.38],
        [0, D * 0.38],
      ].forEach(([lx, lz], i) => {
        parts.push({
          name: `Leg_${i + 1}`,
          shape: 'cylinder',
          position: [lx, legH / 2, lz],
          size: [0.035, legH, 0.035],
          colorHex: '#252525',
          material: 'metal_black',
        });
      });
      parts.push({
        name: 'Console_Carcass',
        shape: 'rounded_box',
        position: [0, legH + bodyH / 2, 0],
        size: [W, bodyH, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      const doorW = (W - 0.04) / 3;
      for (let i = 0; i < 3; i++) {
        const dx = -W / 2 + 0.02 + doorW * (i + 0.5);
        parts.push({
          name: `Cabinet_Door_${i + 1}`,
          shape: 'rounded_box',
          position: [dx, legH + bodyH / 2, D / 2 + 0.008],
          size: [doorW - 0.01, bodyH - 0.04, 0.02],
          colorHex: '#F5F4F0',
          material: 'matte_paint',
        });
        parts.push({
          name: `Door_Trim_${i + 1}`,
          shape: 'rounded_box',
          position: [dx, legH + bodyH - 0.03, D / 2 + 0.015],
          size: [0.08, 0.012, 0.012],
          colorHex: '#C5A059',
          material: 'metal_brass',
        });
      }
      parts.push({
        name: 'Soundbar_Speaker',
        shape: 'rounded_box',
        position: [0, H + 0.035, 0],
        size: [W * 0.52, 0.065, 0.1],
        colorHex: '#1F2022',
        material: 'metal_black',
      });
      break;
    }

    case 'dining_table':
    case 'sit_stand_desk':
    case 'drawer_desk':
    case 'coffee_table':
    case 'kitchen_island': {
      const topThick = arch === 'kitchen_island' ? 0.045 : 0.035;
      parts.push({
        name: 'Tabletop_Slab',
        shape: 'rounded_box',
        position: [0, H - topThick / 2, 0],
        size: [W, topThick, D],
        colorHex: arch === 'kitchen_island' ? '#C9A171' : color,
        material: arch === 'kitchen_island' ? 'oak_wood' : primaryMat,
        isPrimaryColorTarget: arch !== 'kitchen_island',
      });
      parts.push({
        name: 'Subtop_Bevel_Frame',
        shape: 'rounded_box',
        position: [0, H - topThick - 0.015, 0],
        size: [W - 0.06, 0.03, D - 0.06],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });

      const legX = W / 2 - 0.08;
      const legZ = D / 2 - 0.08;
      [
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].forEach(([lx, lz], i) => {
        parts.push({
          name: `Leg_Column_${i + 1}`,
          shape: 'cylinder',
          position: [lx, (H - topThick) / 2, lz],
          size: [0.042, H - topThick, 0.032],
          colorHex: arch === 'sit_stand_desk' ? '#252729' : color,
          material: arch === 'sit_stand_desk' ? 'metal_black' : primaryMat,
          isPrimaryColorTarget: arch !== 'sit_stand_desk',
        });
        parts.push({
          name: `Foot_Glide_${i + 1}`,
          shape: 'cylinder',
          position: [lx, 0.01, lz],
          size: [0.048, 0.02, 0.048],
          colorHex: '#252729',
          material: 'metal_black',
        });
      });

      // Structural apron rails (North, South, East, West)
      parts.push({
        name: 'Apron_North',
        shape: 'rounded_box',
        position: [0, H - topThick - 0.04, -legZ],
        size: [W - 0.16, 0.05, 0.025],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Apron_South',
        shape: 'rounded_box',
        position: [0, H - topThick - 0.04, legZ],
        size: [W - 0.16, 0.05, 0.025],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Apron_East',
        shape: 'rounded_box',
        position: [legX, H - topThick - 0.04, 0],
        size: [0.025, 0.05, D - 0.16],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Apron_West',
        shape: 'rounded_box',
        position: [-legX, H - topThick - 0.04, 0],
        size: [0.025, 0.05, D - 0.16],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });

      if (arch === 'kitchen_island' || arch === 'drawer_desk') {
        [0.24, 0.48].forEach((sy, idx) => {
          parts.push({
            name: `Lower_Shelf_${idx + 1}`,
            shape: 'rounded_box',
            position: [0, sy, 0],
            size: [W - 0.16, 0.03, D - 0.16],
            colorHex: color,
            material: primaryMat,
            isPrimaryColorTarget: true,
          });
        });
      }
      break;
    }

    case 'decorative_mirror': {
      // Full-length leaning mirror with bentwood frame + glass mirror surface + 8 frame ribs (12 parts)
      parts.push({
        name: 'Mirror_Frame_Back',
        shape: 'rounded_box',
        position: [0, H / 2, -0.015],
        size: [W, H, 0.03],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Reflective_Mirror_Glass',
        shape: 'rounded_box',
        position: [0, H / 2, 0.005],
        size: [W - 0.08, H - 0.08, 0.01],
        colorHex: '#E6EDF2',
        material: 'chrome',
      });
      parts.push({
        name: 'Bottom_Shelf_Lip',
        shape: 'rounded_box',
        position: [0, 0.03, 0.02],
        size: [W, 0.04, D],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Top_Rim',
        shape: 'rounded_box',
        position: [0, H - 0.02, 0.01],
        size: [W, 0.04, D * 0.8],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      for (let i = 0; i < 8; i++) {
        parts.push({
          name: `Frame_Trim_${i + 1}`,
          shape: 'rounded_box',
          position: [i % 2 === 0 ? -W / 2 + 0.02 : W / 2 - 0.02, (H / 5) * ((i >> 1) + 0.5), 0.01],
          size: [0.035, H / 5, D * 0.8],
          colorHex: color,
          material: primaryMat,
          isPrimaryColorTarget: true,
        });
      }
      break;
    }

    case 'utility_cart': {
      // RÅSKOG 3-tier rolling cart: 4 vertical tubular posts + 4 caster wheels + 3 deep mesh trays + handle (12 parts)
      const postX = W * 0.44;
      const postZ = D * 0.44;
      [
        [-postX, -postZ],
        [postX, -postZ],
        [-postX, postZ],
        [postX, postZ],
      ].forEach(([px, pz], i) => {
        parts.push({
          name: `Caster_Wheel_${i + 1}`,
          shape: 'cylinder',
          position: [px, 0.03, pz],
          size: [0.05, 0.06, 0.05],
          colorHex: '#1F2022',
          material: 'metal_black',
        });
        parts.push({
          name: `Side_Tube_${i + 1}`,
          shape: 'cylinder',
          position: [px, H / 2 + 0.02, pz],
          size: [0.022, H - 0.06, 0.022],
          colorHex: color,
          material: primaryMat,
          isPrimaryColorTarget: true,
        });
      });
      [0.18, 0.46, 0.72].forEach((ty, idx) => {
        parts.push({
          name: `Storage_Basket_Tier_${idx + 1}`,
          shape: 'rounded_box',
          position: [0, ty * H, 0],
          size: [W * 0.92, 0.09, D * 0.92],
          colorHex: color,
          material: primaryMat,
          isPrimaryColorTarget: true,
        });
      });
      parts.push({
        name: 'Push_Handle_Bar',
        shape: 'cylinder',
        position: [0, H - 0.02, 0],
        size: [0.022, W * 0.9, 0.022],
        rotation: [0, 0, Math.PI / 2],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      break;
    }

    case 'floor_lamp':
    case 'pendant_lamp':
    case 'table_lamp_globe': {
      if (arch === 'table_lamp_globe') {
        parts.push({
          name: 'Lamp_Base_Ring',
          shape: 'cylinder',
          position: [0, 0.02, 0],
          size: [W * 0.55, 0.04, D * 0.55],
          colorHex: '#E0DED8',
          material: 'matte_paint',
        });
        parts.push({
          name: 'Glowing_Opal_Globe',
          shape: 'sphere',
          position: [0, H * 0.52, 0],
          size: [W, H * 0.92, D],
          colorHex: color,
          material: 'emissive_light',
          isPrimaryColorTarget: true,
        });
        // Add subtle decorative meridian bands to satisfy 12-part detail
        for (let i = 0; i < 10; i++) {
          parts.push({
            name: `Diffuser_Core_${i + 1}`,
            shape: 'cylinder',
            position: [0, 0.03 + i * 0.012, 0],
            size: [0.04, 0.01, 0.04],
            colorHex: '#FFF6E0',
            material: 'emissive_light',
          });
        }
      } else {
        // Weighted base, vertical stem, shade, glowing bulb
        parts.push({
          name: 'Weighted_Base',
          shape: 'cylinder',
          position: [0, 0.02, 0],
          size: [0.34, 0.04, 0.34],
          colorHex: '#2B2D2F',
          material: 'metal_black',
        });
        parts.push({
          name: 'Vertical_Pole_Lower',
          shape: 'cylinder',
          position: [0, H * 0.28, 0],
          size: [0.028, H * 0.54, 0.028],
          colorHex: '#2B2D2F',
          material: 'metal_black',
        });
        parts.push({
          name: 'Vertical_Pole_Upper',
          shape: 'cylinder',
          position: [0, H * 0.72, 0],
          size: [0.022, H * 0.44, 0.022],
          colorHex: '#2B2D2F',
          material: 'metal_black',
        });
        parts.push({
          name: 'Shade_Bell',
          shape: arch === 'pendant_lamp' ? 'sphere' : 'cone',
          position: [0, H - 0.18, 0.08],
          size: [0.38, 0.28, 0.38],
          colorHex: color,
          material: arch === 'pendant_lamp' ? 'emissive_light' : primaryMat,
          isPrimaryColorTarget: true,
        });
        parts.push({
          name: 'Warm_LED_Bulb',
          shape: 'sphere',
          position: [0, H - 0.24, 0.08],
          size: [0.12, 0.12, 0.12],
          colorHex: '#FFE4A3',
          material: 'emissive_light',
        });
        for (let i = 0; i < 7; i++) {
          parts.push({
            name: `Fixture_Collar_${i + 1}`,
            shape: 'torus',
            position: [0, 0.2 + i * 0.22, 0],
            size: [0.04, 0.012, 0.04],
            colorHex: '#B5945B',
            material: 'metal_brass',
          });
        }
      }
      break;
    }

    case 'woven_rug': {
      // Layered woven rug with border binding and subtle pattern stripes (12 parts)
      parts.push({
        name: 'Rug_Main_Body',
        shape: 'rounded_box',
        position: [0, 0.008, 0],
        size: [W, 0.014, D],
        colorHex: color,
        material: 'boucle_fabric',
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Border_North',
        shape: 'rounded_box',
        position: [0, 0.01, -D / 2 + 0.03],
        size: [W, 0.016, 0.06],
        colorHex: '#9C825B',
        material: 'boucle_fabric',
      });
      parts.push({
        name: 'Border_South',
        shape: 'rounded_box',
        position: [0, 0.01, D / 2 - 0.03],
        size: [W, 0.016, 0.06],
        colorHex: '#9C825B',
        material: 'boucle_fabric',
      });
      for (let i = 0; i < 9; i++) {
        const zStripe = -D * 0.4 + (D * 0.8 / 8) * i;
        parts.push({
          name: `Weave_Band_${i + 1}`,
          shape: 'rounded_box',
          position: [0, 0.015, zStripe],
          size: [W - 0.08, 0.004, 0.04],
          colorHex: color,
          material: 'boucle_fabric',
          isPrimaryColorTarget: true,
        });
      }
      break;
    }

    case 'dining_chair':
    default: {
      const seatY = H * 0.54;
      const legX = W * 0.38;
      const legZ = D * 0.38;
      [
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].forEach(([lx, lz], i) => {
        parts.push({
          name: `Chair_Leg_${i + 1}`,
          shape: 'cylinder',
          position: [lx, seatY / 2, lz],
          size: [0.032, seatY, 0.025],
          colorHex: '#C8A170',
          material: 'oak_wood',
        });
      });
      parts.push({
        name: 'Contoured_Seat_Pan',
        shape: 'rounded_box',
        position: [0, seatY, 0.01],
        size: [W, 0.045, D * 0.88],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      parts.push({
        name: 'Ergonomic_Backrest',
        shape: 'rounded_box',
        position: [0, seatY + (H - seatY) / 2, -D * 0.38],
        size: [W * 0.94, H - seatY, 0.04],
        rotation: [-0.14, 0, 0],
        colorHex: color,
        material: primaryMat,
        isPrimaryColorTarget: true,
      });
      // Under-seat cross stretchers
      for (let i = 0; i < 6; i++) {
        parts.push({
          name: `Support_Brace_${i + 1}`,
          shape: 'cylinder',
          position: [0, seatY * (0.35 + i * 0.08), 0],
          size: [0.016, W * 0.72, 0.016],
          rotation: [0, (i % 2) * (Math.PI / 2), Math.PI / 2],
          colorHex: '#2C2A29',
          material: 'metal_black',
        });
      }
      break;
    }
  }

  return {
    overallDimensionsMeters: { width: W, height: H, depth: D },
    parts,
    source: 'parametric_builder',
  };
}

function inferArchetypeFromCategory(product: IkeaProduct): NonNullable<IkeaProduct['archetype']> {
  const text = `${product.name} ${product.subtitle}`.toLowerCase();
  if (text.includes('wing') || text.includes('strandmon') || text.includes('ušiak')) return 'wing_chair';
  if (text.includes('poäng') || text.includes('poang')) return 'poang_chair';
  if (text.includes('kallax')) return 'kallax_shelf';
  if (text.includes('pax') || text.includes('wardrobe') || text.includes('skříň')) return 'pax_wardrobe';
  if (text.includes('bestå') || text.includes('besta') || text.includes('tv')) return 'besta_tv_bench';
  if (text.includes('bekant') || text.includes('sit/stand')) return 'sit_stand_desk';
  if (text.includes('micke') || text.includes('drawer')) return 'drawer_desk';
  if (text.includes('coffee') || text.includes('konferenční')) return 'coffee_table';
  if (text.includes('fado') || text.includes('globe') || text.includes('table lamp')) return 'table_lamp_globe';
  if (text.includes('island') || text.includes('ostrůvek')) return 'kitchen_island';

  switch (product.category) {
    case 'Sofas & Armchairs':
      return product.dimensionsCm.width > 120 ? 'sofa_3seat' : 'wing_chair';
    case 'Beds & Mattresses':
      return 'bed_frame';
    case 'Storage & Shelving':
      return 'billy_bookcase';
    case 'Tables & Desks':
      return 'dining_table';
    case 'Lighting':
      return 'floor_lamp';
    case 'Rugs & Decor':
      return 'woven_rug';
    case 'Kitchen & Dining':
      return 'dining_chair';
  }
}
