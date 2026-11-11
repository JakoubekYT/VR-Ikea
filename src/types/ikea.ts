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
  | 'birch_wood'
  | 'matte_paint'
  | 'boucle_fabric'
  | 'velvet'
  | 'leather'
  | 'metal_brass'
  | 'metal_black'
  | 'chrome'
  | 'glass'
  | 'emissive_light';

export interface FurniturePartSpec {
  name: string;
  shape: FurnitureShapeType;
  position: [number, number, number]; // x, y, z in meters (relative to bottom-center origin y=0)
  size: [number, number, number];     // width, height, depth in meters
  rotation?: [number, number, number]; // Euler rx, ry, rz in radians
  colorHex: string;
  material: FurnitureMaterialType;
  isPrimaryColorTarget?: boolean;     // Whether recoloring the item updates this part
}

export interface Furniture3DSpec {
  overallDimensionsMeters: {
    width: number;
    height: number;
    depth: number;
  };
  parts: FurniturePartSpec[];
  source: 'parametric_builder' | 'gemini_ai';
}

export interface ColorSwatch {
  name: string;
  hex: string;
  materialOverride?: FurnitureMaterialType;
}

export interface IkeaProduct {
  id: string;
  name: string;               // e.g. "KIVIK"
  subtitle: string;           // e.g. "3-seat sofa, Tibbleby beige/grey"
  category: Exclude<IkeaCategory, 'All'>;
  articleNumber: string;      // e.g. "494.405.98"
  priceCZK: number;           // e.g. 12990
  priceEUR: number;           // e.g. 529
  dimensionsCm: {
    width: number;            // e.g. 228
    depth: number;            // e.g. 95
    height: number;           // e.g. 83
  };
  materialsDescription: string;
  swatches: ColorSwatch[];
  defaultSwatchIndex?: number;
  sourceUrl?: string;
  matchedQueries?: string[];
  isCustomScraped?: boolean;
  archetype?:
    | 'sofa_3seat'
    | 'wing_chair'
    | 'poang_chair'
    | 'chaise_sofa'
    | 'bed_frame'
    | 'daybed'
    | 'kallax_shelf'
    | 'billy_bookcase'
    | 'pax_wardrobe'
    | 'besta_tv_bench'
    | 'dining_table'
    | 'sit_stand_desk'
    | 'drawer_desk'
    | 'coffee_table'
    | 'floor_lamp'
    | 'table_lamp_globe'
    | 'pendant_lamp'
    | 'woven_rug'
    | 'decorative_mirror'
    | 'utility_cart'
    | 'dining_chair'
    | 'kitchen_island';
}

export interface PlacedFurniture {
  instanceId: string;
  productId: string;
  product: IkeaProduct;
  position: [number, number, number]; // [x, y, z] in meters
  rotationY: number;                  // radians
  scale: number;                      // uniform scale multiplier (default 1.0)
  selectedColorHex: string;
  selectedSwatchName: string;
  spec3D: Furniture3DSpec;
  isGenerating?: boolean;
  generationProgress?: number;        // 0 to 100
  showVrPriceTag?: boolean;
}

export type FloorFinishType =
  | 'Scandinavian Oak Parquet'
  | 'Walnut Herringbone'
  | 'Light Ash Planks'
  | 'Polished Concrete'
  | 'Warm Beige Carpet'
  | 'Large Ceramic Tiles';

export type WallFinishPresetName =
  | 'Warm White'
  | 'Sage Green'
  | 'Nordic Slate Blue'
  | 'Terracotta'
  | 'Acoustic Oak Wood Slats'
  | 'Exposed Brick';

export type WallId = 'north' | 'south' | 'east' | 'west';

export type OpeningType =
  | 'Floor-to-Ceiling French Window'
  | 'Double Casement Window'
  | 'Modern Oak Door'
  | 'Industrial Glass Door';

export interface WallOpening {
  id: string;
  type: OpeningType;
  wall: WallId;
  offsetMeters: number; // offset from wall center along wall axis
  widthMeters: number;
  heightMeters: number;
  sillHeightMeters: number;
}

export type TimeOfDayPreset =
  | 'Daylight'
  | 'Golden Hour Sunset'
  | 'Cozy Evening';

export interface WallConfig {
  colorHex: string;
  finishPreset: WallFinishPresetName;
}

export interface RoomConfig {
  width: number;         // X axis in meters (3m - 10m)
  length: number;        // Z axis in meters (3m - 10m)
  ceilingHeight: number; // Y axis in meters (2.4m - 4.0m)
  floorFinish: FloorFinishType;
  walls: Record<WallId, WallConfig>;
  openings: WallOpening[];
  timeOfDay: TimeOfDayPreset;
  smartWallCutaway: boolean;
}

export interface BomLineItem {
  product: IkeaProduct;
  selectedColorHex: string;
  selectedSwatchName: string;
  quantity: number;
  unitPriceCZK: number;
  unitPriceEUR: number;
  lineTotalCZK: number;
  lineTotalEUR: number;
  instanceIds: string[];
}

export interface BomSummary {
  items: BomLineItem[];
  totalCount: number;
  totalPriceCZK: number;
  totalPriceEUR: number;
  totalFloorAreaM2: number;
}

export type CoopSyncMessage =
  | {
      type: 'SYNC_STATE';
      senderId: string;
      timestamp: number;
      roomConfig: RoomConfig;
      placedFurniture: PlacedFurniture[];
      selectedInstanceId: string | null;
    }
  | {
      type: 'VR_CURSOR_MOVE';
      senderId: string;
      position: [number, number, number];
      targetInstanceId: string | null;
    }
  | {
      type: 'PING_STATE_REQUEST';
      senderId: string;
    };
