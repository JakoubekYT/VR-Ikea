export type IkeaCategory =
  | 'All'
  | 'Sofas & Armchairs'
  | 'Beds & Mattresses'
  | 'Storage & Shelving'
  | 'Tables & Desks'
  | 'Lighting'
  | 'Rugs & Decor'
  | 'Kitchen & Dining';

export type FurnitureShapeType =
  | 'rounded_box'
  | 'cylinder'
  | 'sphere'
  | 'torus'
  | 'cone';

export type FurnitureMaterialType =
  | 'oak_wood'
  | 'walnut_wood'
  | 'white_laminate'
  | 'boucle_fabric'
  | 'velvet'
  | 'leather'
  | 'brushed_brass'
  | 'matte_black_metal'
  | 'chrome'
  | 'clear_glass'
  | 'emissive_lamp'
  // Extended aliases handled gracefully by furnitureBuilder
  | 'frosted_glass'
  | 'woven_rug'
  | 'brushed_steel'
  | 'emissive_light';

export interface FurniturePartSpec {
  name: string;
  shape: FurnitureShapeType;
  position: [number, number, number]; // [x, y, z] in meters relative to bottom-center (y=0 floor)
  size: [number, number, number]; // [width, height, depth] in meters
  rotation: [number, number, number]; // Euler [rx, ry, rz] in radians
  colorHex: string;
  materialType: FurnitureMaterialType;
  roughness?: number;
  metalness?: number;
  isPrimaryColorTarget?: boolean;
}

export interface Furniture3DSpec {
  overallDimensionsMeters: {
    width: number;
    height: number;
    depth: number;
  };
  parts: FurniturePartSpec[];
  source?: 'parametric_builder' | 'gemini_ai';
}

export interface ColorSwatch {
  name: string;
  hex: string;
  materialOverride?: FurnitureMaterialType;
}

export interface IkeaProduct {
  id: string;
  name: string;
  typeName: string;
  category: Exclude<IkeaCategory, 'All'>;
  articleNumber: string;
  priceCzk: number;
  priceEur: number;
  dimensionsCm: {
    width: number;
    depth: number;
    height: number;
  };
  materialDescription: string;
  imageUrl?: string;
  swatches: ColorSwatch[];
  defaultSwatchIndex?: number;
  sourceUrl?: string;
  matchedQueries?: string[];
  archetype?: string;
}

export interface PlacedFurnitureItem {
  instanceId: string;
  productId: string;
  product: IkeaProduct;
  swatchName: string;
  swatchHex: string;
  position: [number, number, number]; // World [x, y, z] in meters
  rotationY: number; // Degrees (0..360)
  spec3D: Furniture3DSpec;
  isGenerating?: boolean;
  roomId: string;
  parentInstanceId?: string; // Milestone 2: instanceId of supporting furniture (for tabletop items)
}

export interface CollisionCheckOptions {
  toleranceMeters?: number; // Distance tolerance (default: 0.005m = 5mm)
  ignoreRugs?: boolean; // Treat rugs as floor coverings (default: true)
}

export interface SnapFurnitureOptions {
  width: number;
  length: number;
  enableGridSnap: boolean;
  enableWallSnap: boolean;
  autoRotateToWall?: boolean;
  allowStacking?: boolean;
  otherItems?: PlacedFurnitureItem[];
  roomPosition?: [number, number]; // [centerX, centerZ] of the active room
  currentInstanceId?: string;
  itemProduct?: IkeaProduct;
}

export interface SnappedFurnitureResult {
  position: [number, number, number];
  rotationY: number;
  parentInstanceId?: string;
  hasCollision?: boolean;
  collidingInstanceIds?: string[];
}

export type FloorFinishType =
  | 'Oak Parquet'
  | 'Walnut Herringbone'
  | 'Polished Concrete'
  | 'Marble Tiles'
  | 'Ceramic Tiles'
  | 'Carpet'
  // Legacy finish aliases handled seamlessly in proceduralTextures
  | 'Light Nordic Oak'
  | 'Warm Herringbone Parquet'
  | 'Smoked Dark Walnut'
  | 'Nordic Travertine Stone';

export type WallFinishType =
  | 'Smooth Matte Plaster'
  | 'Warm Microcement'
  | 'Exposed Whitewashed Brick'
  | 'Nordic Acoustic Wood Slats';

export type WallId = 'north' | 'south' | 'east' | 'west';

export type OpeningType =
  | 'Single Window'
  | 'Double Casement Window'
  | 'Floor-to-Ceiling Balcony Glazing'
  | 'Door'
  | 'Open Archway';

export interface WallOpening {
  id: string;
  wall: WallId;
  type: OpeningType;
  width: number;
  height: number;
  sillHeight: number;
  offset: number;
}

export interface WallConfig {
  colorHex: string;
  finish: WallFinishType;
}

export type RoomType =
  | 'Living Room'
  | 'Bedroom'
  | 'Kitchen'
  | 'Bathroom'
  | 'Hallway'
  | 'Office'
  | 'Dining Room'
  | 'Home Office';

export interface ApartmentRoom {
  id: string;
  name: string;
  roomType: RoomType;
  position: [number, number]; // [centerX, centerZ] in world meters
  width: number; // X dimension in meters
  length: number; // Z dimension in meters
  height: number; // Ceiling height in meters
  floorFinish: FloorFinishType;
  floorTintHex: string;
  walls: Record<WallId, WallConfig>;
  openings: WallOpening[];
}

export type ChandelierPresetId =
  | 'multi_ring_led'
  | 'glass_globe_cluster'
  | 'woven_pendant'
  | 'geodesic_chandelier'
  | 'industrial_spider'
  | 'recessed_spotlights';

export interface ChandelierCatalogItem {
  id: ChandelierPresetId;
  name: string;
  typeName: string;
  articleNumber: string;
  priceCzk: number;
  priceEur: number;
  defaultDropMeters: number;
  defaultColorTempK: number;
  dimensionsCm: {
    diameter: number;
    height: number;
  };
  description: string;
}

export interface PlacedChandelier {
  instanceId: string;
  presetId: ChandelierPresetId;
  catalogItem: ChandelierCatalogItem;
  roomId: string;
  position: [number, number, number]; // World [x, y, z]
  dropCableHeight: number; // 0.1m - 1.8m
  scale: number; // 0.5 - 2.0
  isOn: boolean;
  brightness: number; // 10 - 100%
  colorTempK: number; // 2700K - 6000K
}

export type ViewMode = 'orbit' | 'walkthrough_1to1' | 'blueprint';

export type LightingPreset =
  | 'Nordic Morning Sun'
  | 'Golden Hour'
  | 'Cozy Evening Lamps'
  | 'Studio Daylight';

export interface BomLineItem {
  product: {
    id: string;
    name: string;
    articleNumber: string;
  };
  swatchName: string;
  swatchHex: string;
  quantity: number;
  subtotalCzk: number;
  subtotalEur: number;
}

export interface BomSummary {
  lines: BomLineItem[];
  totalCzk: number;
  totalEur: number;
  totalItems: number;
}

export type FloatingWindowId =
  | 'catalog'
  | 'architecture'
  | 'chandeliers'
  | 'cart';

export interface FloatingWindowState {
  id: FloatingWindowId;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}
