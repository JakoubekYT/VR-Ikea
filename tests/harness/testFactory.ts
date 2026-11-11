/**
 * Fixture generators and factories for rooms, products, placed items, chandeliers, and projects.
 */

import type {
  ApartmentRoom,
  IkeaProduct,
  PlacedFurnitureItem,
  PlacedChandelier,
  WallOpening,
  Furniture3DSpec,
  ChandelierPresetId,
  BomSummary,
} from '../../src/types/ikea.js';
import {
  INITIAL_IKEA_CATALOG,
  INITIAL_APARTMENT_ROOMS,
  INITIAL_CHANDELIERS,
  CHANDELIER_CATALOG,
} from '../../src/data/ikeaCatalog.js';
import { buildParametric3DSpec, calculateBomSummary } from '../../src/utils/roomLogic.js';

export interface ApartmentProjectState {
  version: number;
  exportedAt: string;
  rooms: ApartmentRoom[];
  placedItems: PlacedFurnitureItem[];
  chandeliers: PlacedChandelier[];
  metadata?: {
    appName: string;
    lightingPreset?: string;
    activeRoomId?: string;
  };
}

let instanceCounter = 1;

export function createMockProduct(overrides?: Partial<IkeaProduct>): IkeaProduct {
  const base = INITIAL_IKEA_CATALOG[0];
  return {
    id: `mock-product-${instanceCounter++}`,
    name: 'MOCK PRODUCT',
    typeName: 'Test Furniture',
    category: 'Sofas & Armchairs',
    articleNumber: '123.456.78',
    priceCzk: 9990,
    priceEur: 399,
    dimensionsCm: { width: 120, depth: 80, height: 75 },
    materialDescription: 'Durable birch plywood and soft foam',
    swatches: [
      { name: 'Warm Beige', hex: '#D8CFC2' },
      { name: 'Dark Grey', hex: '#333333' },
    ],
    defaultSwatchIndex: 0,
    ...overrides,
  };
}

export function createMockWallOpening(overrides?: Partial<WallOpening>): WallOpening {
  return {
    id: `opening-${instanceCounter++}`,
    wall: 'north',
    type: 'Double Casement Window',
    width: 1.8,
    height: 1.45,
    sillHeight: 0.85,
    offset: 0.0,
    ...overrides,
  };
}

export function createMockRoom(overrides?: Partial<ApartmentRoom>): ApartmentRoom {
  return {
    id: `room-test-${instanceCounter++}`,
    name: 'Test Room',
    roomType: 'Living Room',
    position: [0, 0],
    width: 5.0,
    length: 5.0,
    height: 2.85,
    floorFinish: 'Oak Parquet',
    floorTintHex: '#FFFFFF',
    walls: {
      north: { colorHex: '#F4F1EA', finish: 'Smooth Matte Plaster' },
      south: { colorHex: '#F4F1EA', finish: 'Smooth Matte Plaster' },
      east: { colorHex: '#F4F1EA', finish: 'Smooth Matte Plaster' },
      west: { colorHex: '#F4F1EA', finish: 'Smooth Matte Plaster' },
    },
    openings: [],
    ...overrides,
  };
}

export function createMockPlacedItem(
  productOverride?: IkeaProduct,
  itemOverrides?: Partial<PlacedFurnitureItem>
): PlacedFurnitureItem {
  const product = productOverride || INITIAL_IKEA_CATALOG[0];
  const swatch = product.swatches[0] || { name: 'White', hex: '#FFFFFF' };
  const spec3D: Furniture3DSpec = buildParametric3DSpec(product, swatch.hex, swatch.name);

  return {
    instanceId: `placed-${instanceCounter++}`,
    productId: product.id,
    product,
    swatchName: swatch.name,
    swatchHex: swatch.hex,
    position: [0, 0, 0],
    rotationY: 0,
    spec3D,
    roomId: 'room-living',
    ...itemOverrides,
  };
}

export function createMockChandelier(
  presetId: ChandelierPresetId = 'multi_ring_led',
  overrides?: Partial<PlacedChandelier>
): PlacedChandelier {
  const catalogItem =
    CHANDELIER_CATALOG.find((c) => c.id === presetId) || CHANDELIER_CATALOG[0];

  return {
    instanceId: `chandelier-${instanceCounter++}`,
    presetId: catalogItem.id,
    catalogItem,
    roomId: 'room-living',
    position: [0, 2.85, 0],
    dropCableHeight: catalogItem.defaultDropMeters,
    scale: 1.0,
    isOn: true,
    brightness: 100,
    colorTempK: catalogItem.defaultColorTempK,
    ...overrides,
  };
}

export function createMockApartmentProject(overrides?: Partial<ApartmentProjectState>): ApartmentProjectState {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    rooms: JSON.parse(JSON.stringify(INITIAL_APARTMENT_ROOMS)),
    placedItems: [
      createMockPlacedItem(INITIAL_IKEA_CATALOG[0], { position: [-1.2, 0, -1.5], roomId: 'room-living' }),
      createMockPlacedItem(INITIAL_IKEA_CATALOG[1], { position: [1.2, 0, -1.0], roomId: 'room-living' }),
    ],
    chandeliers: JSON.parse(JSON.stringify(INITIAL_CHANDELIERS)),
    metadata: {
      appName: 'IKEA Space Planner VR',
      lightingPreset: 'Nordic Morning Sun',
      activeRoomId: 'room-living',
    },
    ...overrides,
  };
}

export function serializeApartmentProject(project: ApartmentProjectState): string {
  return JSON.stringify(project, null, 2);
}

export function deserializeApartmentProject(jsonStr: string): ApartmentProjectState {
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project JSON: Root must be an object');
  }
  if (!Array.isArray(parsed.rooms)) {
    throw new Error('Invalid project JSON: Missing rooms array');
  }
  return {
    version: parsed.version || 1,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    rooms: parsed.rooms,
    placedItems: Array.isArray(parsed.placedItems) ? parsed.placedItems : [],
    chandeliers: Array.isArray(parsed.chandeliers) ? parsed.chandeliers : [],
    metadata: parsed.metadata || {},
  };
}

export function exportBomToCsv(summary: BomSummary): string {
  const headers = [
    'Název série / Series',
    'Kód artiklu / Article Number',
    'Barevné provedení / Swatch',
    'Množství / Quantity',
    'Cena za kus (Kč) / Unit Price CZK',
    'Cena za kus (€) / Unit Price EUR',
    'Celkem (Kč) / Subtotal CZK',
    'Celkem (€) / Subtotal EUR',
  ];

  const rows = summary.lines.map((line) => {
    const unitCzk = Math.round(line.subtotalCzk / line.quantity);
    const unitEur = Math.round(line.subtotalEur / line.quantity);
    return [
      `"${line.product.name.replace(/"/g, '""')}"`,
      `"${line.product.articleNumber}"`,
      `"${line.swatchName.replace(/"/g, '""')}"`,
      line.quantity,
      unitCzk,
      unitEur,
      line.subtotalCzk,
      line.subtotalEur,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

export function exportBomToJson(summary: BomSummary, rooms: ApartmentRoom[] = []): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      apartmentTotals: {
        totalItems: summary.totalItems,
        totalCzk: summary.totalCzk,
        totalEur: summary.totalEur,
      },
      roomsCount: rooms.length,
      lines: summary.lines,
    },
    null,
    2
  );
}
