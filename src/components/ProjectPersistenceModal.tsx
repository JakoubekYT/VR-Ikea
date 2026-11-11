import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  FileJson,
  Check,
  Copy,
  AlertTriangle,
  FolderOpen,
  Save,
  RotateCcw,
  Sparkles,
  Layers,
  Box,
  Lightbulb,
  Building2,
  Trash2,
  Clock,
} from 'lucide-react';
import type {
  ApartmentRoom,
  IkeaProduct,
  LightingPreset,
  PlacedChandelier,
  PlacedFurnitureItem,
  ViewMode,
} from '../types/ikea';
import { buildParametric3DSpec, calculateBomSummary } from '../utils/roomLogic';
import {
  INITIAL_APARTMENT_ROOMS,
  INITIAL_CHANDELIERS,
  INITIAL_IKEA_CATALOG,
} from '../data/ikeaCatalog';

export interface IkeaProjectFile {
  format: 'ikea-space-planner-project';
  version: '1.0.0';
  projectName: string;
  createdAt: string;
  updatedAt: string;
  environment: {
    lightingPreset: LightingPreset;
    viewMode: ViewMode;
    activeRoomId: string;
    enableGridSnap: boolean;
    enableWallSnap: boolean;
    autoCutaway: boolean;
  };
  rooms: ApartmentRoom[];
  placedItems: PlacedFurnitureItem[];
  chandeliers: PlacedChandelier[];
  summary: {
    totalItems: number;
    totalCzk: number;
    totalEur: number;
    roomCount: number;
  };
  notes?: string;
}

export interface RestoredProjectData {
  projectName?: string;
  rooms: ApartmentRoom[];
  placedItems: PlacedFurnitureItem[];
  chandeliers: PlacedChandelier[];
  lightingPreset?: LightingPreset;
  viewMode?: ViewMode;
  activeRoomId?: string;
  enableGridSnap?: boolean;
  enableWallSnap?: boolean;
  autoCutaway?: boolean;
  customProducts?: IkeaProduct[];
}

interface ProjectPersistenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: ApartmentRoom[];
  placedItems: PlacedFurnitureItem[];
  chandeliers: PlacedChandelier[];
  lightingPreset: LightingPreset;
  viewMode: ViewMode;
  activeRoomId: string;
  enableGridSnap: boolean;
  enableWallSnap: boolean;
  autoCutaway: boolean;
  onRestoreProject: (data: RestoredProjectData) => void;
  isDarkMode?: boolean;
}

interface LocalSavedSlot {
  id: string;
  name: string;
  timestamp: string;
  roomCount: number;
  itemCount: number;
  totalCzk: number;
  data: IkeaProjectFile;
}

const LOCAL_STORAGE_KEY = 'ikea_space_planner_slots_v1';

export const ProjectPersistenceModal: React.FC<ProjectPersistenceModalProps> = ({
  isOpen,
  onClose,
  rooms,
  placedItems,
  chandeliers,
  lightingPreset,
  viewMode,
  activeRoomId,
  enableGridSnap,
  enableWallSnap,
  autoCutaway,
  onRestoreProject,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'templates' | 'slots'>('export');
  const [projectName, setProjectName] = useState<string>('Můj IKEA Bytový Návrh');
  const [copied, setCopied] = useState<boolean>(false);
  const [exportNotes, setExportNotes] = useState<string>('');

  // Import State
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [parsedProject, setParsedProject] = useState<RestoredProjectData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState<boolean>(false);

  // Local Storage Saved Slots
  const [savedSlots, setSavedSlots] = useState<LocalSavedSlot[]>([]);
  const [slotSaveFeedback, setSlotSaveFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compute live budget summary
  const summary = calculateBomSummary(placedItems, chandeliers);

  // Load saved slots from localStorage on mount & when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) setSavedSlots(list);
        }
      } catch (e) {
        console.warn('Failed to read localStorage slots:', e);
      }
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build the standardized export object
  const buildCurrentProjectFile = (): IkeaProjectFile => {
    return {
      format: 'ikea-space-planner-project',
      version: '1.0.0',
      projectName: projectName.trim() || 'IKEA Bytový Návrh',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      environment: {
        lightingPreset,
        viewMode,
        activeRoomId,
        enableGridSnap,
        enableWallSnap,
        autoCutaway,
      },
      rooms,
      placedItems,
      chandeliers,
      summary: {
        totalItems: summary.totalItems,
        totalCzk: summary.totalCzk,
        totalEur: summary.totalEur,
        roomCount: rooms.length,
      },
      notes: exportNotes.trim() || undefined,
    };
  };

  // 1. Download as formatted JSON file
  const handleDownloadJson = () => {
    const projectData = buildCurrentProjectFile();
    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeName = (projectName || 'IKEA_Project')
      .trim()
      .replace(/[^a-zA-Z0-9_\-\u00C0-\u017F]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}_${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 2. Copy JSON to Clipboard
  const handleCopyJson = async () => {
    try {
      const projectData = buildCurrentProjectFile();
      await navigator.clipboard.writeText(JSON.stringify(projectData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  // 3. Quick Save to Browser LocalStorage
  const handleSaveToBrowserSlot = () => {
    const projectData = buildCurrentProjectFile();
    const newSlot: LocalSavedSlot = {
      id: `slot_${Date.now()}`,
      name: projectName.trim() || `Návrh #${savedSlots.length + 1}`,
      timestamp: new Date().toLocaleString('cs-CZ', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
      roomCount: rooms.length,
      itemCount: summary.totalItems,
      totalCzk: summary.totalCzk,
      data: projectData,
    };

    const updated = [newSlot, ...savedSlots.slice(0, 7)]; // Keep last 8 slots
    setSavedSlots(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      setSlotSaveFeedback('Uloženo do paměti prohlížeče!');
      setTimeout(() => setSlotSaveFeedback(null), 3000);
    } catch (e) {
      console.error('LocalStorage write failed:', e);
      setSlotSaveFeedback('Chyba: Nedostatek místa v paměti prohlížeče.');
    }
  };

  const handleDeleteSlot = (slotId: string) => {
    const updated = savedSlots.filter((s) => s.id !== slotId);
    setSavedSlots(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to update localStorage slots:', e);
    }
  };

  // 4. Strict Validation & Normalization for Imported JSON
  const validateAndParseJson = (rawContent: string): RestoredProjectData => {
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err: any) {
      throw new Error(`Neplatný formát JSON: ${err.message || 'Chyba syntaxe'}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Obsah souboru není platný JSON objekt.');
    }

    // Extract rooms: could be directly at parsed.rooms or parsed.layout.rooms
    const candidateRooms = Array.isArray(parsed.rooms)
      ? parsed.rooms
      : parsed.layout && Array.isArray(parsed.layout.rooms)
      ? parsed.layout.rooms
      : null;

    if (!candidateRooms || candidateRooms.length === 0) {
      throw new Error('Chybí data místností: Soubor neobsahuje žádné platné místnosti (rooms array).');
    }

    // Sanitize rooms
    const sanitizedRooms: ApartmentRoom[] = candidateRooms.map((r: any, idx: number) => {
      const id = String(r.id || `room-${idx + 1}`);
      const name = String(r.name || `Pokoj #${idx + 1}`);
      const roomType = r.roomType || 'Living Room';
      const width = Math.max(1.5, Math.min(25, Number(r.width) || 4.2));
      const length = Math.max(1.5, Math.min(25, Number(r.length) || 3.8));
      const height = Math.max(2.0, Math.min(6.0, Number(r.height) || 2.7));
      const position: [number, number] = Array.isArray(r.position) && r.position.length >= 2
        ? [Number(r.position[0]) || 0, Number(r.position[1]) || 0]
        : [0, 0];

      const floorFinish = r.floorFinish || 'Oak Parquet';
      const floorTintHex = typeof r.floorTintHex === 'string' ? r.floorTintHex : '#FFFFFF';
      const walls = r.walls && typeof r.walls === 'object' ? r.walls : {
        north: { colorHex: '#F7F5F0', finish: 'Smooth Matte Plaster' },
        south: { colorHex: '#F7F5F0', finish: 'Smooth Matte Plaster' },
        east: { colorHex: '#EAE6DF', finish: 'Smooth Matte Plaster' },
        west: { colorHex: '#F7F5F0', finish: 'Smooth Matte Plaster' },
      };
      const openings = Array.isArray(r.openings) ? r.openings : [];

      return {
        id,
        name,
        roomType,
        width,
        length,
        height,
        position,
        floorFinish,
        floorTintHex,
        walls,
        openings,
      };
    });

    // Sanitize placed items
    const candidateItems = Array.isArray(parsed.placedItems)
      ? parsed.placedItems
      : Array.isArray(parsed.items)
      ? parsed.items
      : [];

    const customProducts: IkeaProduct[] = [];
    const validRoomIds = new Set(sanitizedRooms.map((r) => r.id));
    const fallbackRoomId = sanitizedRooms[0].id;

    const sanitizedItems: PlacedFurnitureItem[] = candidateItems
      .filter((it: any) => it && (it.product || it.productId))
      .map((it: any, idx: number) => {
        const instanceId = String(it.instanceId || `item-restored-${idx}-${Date.now()}`);
        const productId = String(it.productId || it.product?.id || `restored-prod-${idx}`);
        
        let product: IkeaProduct = it.product;
        if (!product || !product.name) {
          const foundInInit = INITIAL_IKEA_CATALOG.find((p) => p.id === productId);
          product = foundInInit || {
            id: productId,
            name: it.name || 'IKEA Nábytek',
            typeName: it.typeName || 'Restored Model',
            category: 'Sofas & Armchairs',
            articleNumber: it.articleNumber || '000.000.00',
            priceCzk: Number(it.priceCzk) || 1990,
            priceEur: Number(it.priceEur) || 79,
            dimensionsCm: it.dimensionsCm || { width: 80, depth: 80, height: 80 },
            materialDescription: it.materialDescription || 'Standard finish',
            swatches: [{ name: 'Standard', hex: it.swatchHex || '#CCCCCC' }],
          };
        }
        customProducts.push(product);

        const swatchName = String(it.swatchName || product.swatches[0]?.name || 'Standard');
        const swatchHex = String(it.swatchHex || product.swatches[0]?.hex || '#CCCCCC');
        const position: [number, number, number] = Array.isArray(it.position) && it.position.length >= 3
          ? [Number(it.position[0]) || 0, Number(it.position[1]) || 0, Number(it.position[2]) || 0]
          : [0, 0, 0];
        const rotationY = Number(it.rotationY) || 0;
        const roomId = it.roomId && validRoomIds.has(it.roomId) ? it.roomId : fallbackRoomId;

        const spec3D = it.spec3D && Array.isArray(it.spec3D.parts) && it.spec3D.parts.length > 0
          ? it.spec3D
          : buildParametric3DSpec(product, swatchHex, swatchName);

        return {
          instanceId,
          productId,
          product,
          swatchName,
          swatchHex,
          position,
          rotationY,
          spec3D,
          roomId,
          parentInstanceId: it.parentInstanceId,
        };
      });

    // Sanitize chandeliers
    const candidateChandeliers = Array.isArray(parsed.chandeliers) ? parsed.chandeliers : [];
    const sanitizedChandeliers: PlacedChandelier[] = candidateChandeliers
      .filter((ch: any) => ch && (ch.presetId || ch.catalogItem))
      .map((ch: any, idx: number) => {
        const instanceId = String(ch.instanceId || `ch-restored-${idx}`);
        const presetId = ch.presetId || 'multi_ring_led';
        const catalogItem = ch.catalogItem || INITIAL_CHANDELIERS[0]?.catalogItem || {
          id: presetId,
          name: 'LED Luster',
          typeName: 'Stropní osvětlení',
          articleNumber: '904.123.45',
          priceCzk: 2490,
          priceEur: 99,
          defaultDropMeters: 0.6,
          defaultColorTempK: 3000,
          dimensionsCm: { diameter: 60, height: 40 },
          description: 'Restored ceiling lamp',
        };
        const roomId = ch.roomId && validRoomIds.has(ch.roomId) ? ch.roomId : fallbackRoomId;
        const position: [number, number, number] = Array.isArray(ch.position) && ch.position.length >= 3
          ? [Number(ch.position[0]) || 0, Number(ch.position[1]) || 2.7, Number(ch.position[2]) || 0]
          : [0, 2.7, 0];

        return {
          instanceId,
          presetId,
          catalogItem,
          roomId,
          position,
          dropCableHeight: Number(ch.dropCableHeight) || 0.6,
          scale: Number(ch.scale) || 1.0,
          isOn: ch.isOn !== false,
          brightness: Number(ch.brightness) || 90,
          colorTempK: Number(ch.colorTempK) || 3000,
        };
      });

    // Environment settings
    const env = parsed.environment || {};
    const validPresets: LightingPreset[] = [
      'Nordic Morning Sun',
      'Golden Hour',
      'Cozy Evening Lamps',
      'Studio Daylight',
    ];
    const lightingPresetRes: LightingPreset = validPresets.includes(env.lightingPreset)
      ? env.lightingPreset
      : 'Nordic Morning Sun';

    const validViewModes: ViewMode[] = ['orbit', 'walkthrough_1to1', 'blueprint'];
    const viewModeRes: ViewMode = validViewModes.includes(env.viewMode)
      ? env.viewMode
      : 'orbit';

    const activeRoomIdRes = env.activeRoomId && validRoomIds.has(env.activeRoomId)
      ? env.activeRoomId
      : sanitizedRooms[0].id;

    return {
      projectName: parsed.projectName || 'Restored Layout',
      rooms: sanitizedRooms,
      placedItems: sanitizedItems,
      chandeliers: sanitizedChandeliers,
      lightingPreset: lightingPresetRes,
      viewMode: viewModeRes,
      activeRoomId: activeRoomIdRes,
      enableGridSnap: env.enableGridSnap ?? true,
      enableWallSnap: env.enableWallSnap ?? true,
      autoCutaway: env.autoCutaway ?? true,
      customProducts,
    };
  };

  // Handle file select or drag-and-drop
  const handleFileProcess = (file: File) => {
    setValidationError(null);
    setParsedProject(null);
    setRestoreConfirmed(false);
    setImportFileName(file.name);

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
      setValidationError('Vybraný soubor musí být typu .json');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setImportJsonText(text);
      try {
        const validated = validateAndParseJson(text);
        setParsedProject(validated);
      } catch (err: any) {
        setValidationError(err.message || 'Nepodařilo se zpracovat soubor JSON.');
      }
    };
    reader.onerror = () => {
      setValidationError('Nepodařilo se přečíst soubor z disku.');
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    if (!parsedProject) return;
    onRestoreProject(parsedProject);
    onClose();
  };

  // 5. Curated Template Layouts
  const handleLoadTemplate = (templateKey: 'scandi_3room' | 'cozy_studio' | 'executive_loft') => {
    if (templateKey === 'scandi_3room') {
      const templateData: RestoredProjectData = {
        projectName: 'Skandinávský 3-pokojový byt',
        rooms: INITIAL_APARTMENT_ROOMS,
        placedItems: [
          {
            instanceId: `tmpl-kivik-${Date.now()}`,
            productId: 'ikea-kivik-3',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-kivik-3')!,
            swatchName: 'Tibbleby Charcoal',
            swatchHex: '#2E3238',
            position: [0, 0, -1.45],
            rotationY: 0,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-kivik-3')!,
              '#2E3238',
              'Tibbleby Charcoal'
            ),
            roomId: 'room-living',
          },
          {
            instanceId: `tmpl-strandmon-${Date.now()}`,
            productId: 'ikea-strandmon',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-strandmon')!,
            swatchName: 'Nordvalla Dark Gray',
            swatchHex: '#3D4148',
            position: [-1.55, 0, -0.35],
            rotationY: 90,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-strandmon')!,
              '#3D4148',
              'Nordvalla Dark Gray'
            ),
            roomId: 'room-living',
          },
          {
            instanceId: `tmpl-lack-${Date.now()}`,
            productId: 'ikea-lack-coffee',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-lack-coffee')!,
            swatchName: 'White',
            swatchHex: '#FFFFFF',
            position: [0, 0, -0.2],
            rotationY: 0,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-lack-coffee')!,
              '#FFFFFF',
              'White'
            ),
            roomId: 'room-living',
          },
          {
            instanceId: `tmpl-tv-${Date.now()}`,
            productId: 'ikea-besta-tv',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-besta-tv')!,
            swatchName: 'White Oak Veneer',
            swatchHex: '#D7C4A5',
            position: [0, 0, 1.85],
            rotationY: 180,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-besta-tv')!,
              '#D7C4A5',
              'White Oak Veneer'
            ),
            roomId: 'room-living',
          },
          {
            instanceId: `tmpl-dining-${Date.now()}`,
            productId: 'ikea-lisabo-table',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-lisabo-table')!,
            swatchName: 'Ash Veneer',
            swatchHex: '#E2D3BA',
            position: [4.75, 0, 0.0],
            rotationY: 90,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-lisabo-table')!,
              '#E2D3BA',
              'Ash Veneer'
            ),
            roomId: 'room-kitchen',
          },
          {
            instanceId: `tmpl-bed-${Date.now()}`,
            productId: 'ikea-malm-bed',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-malm-bed')!,
            swatchName: 'White Stained Oak',
            swatchHex: '#D8C7B0',
            position: [-1.2, 0, -4.65],
            rotationY: 0,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-malm-bed')!,
              '#D8C7B0',
              'White Stained Oak'
            ),
            roomId: 'room-bedroom',
          },
        ],
        chandeliers: INITIAL_CHANDELIERS,
        lightingPreset: 'Nordic Morning Sun',
        viewMode: 'orbit',
        activeRoomId: 'room-living',
      };
      onRestoreProject(templateData);
      onClose();
    } else if (templateKey === 'cozy_studio') {
      const studioRoom: ApartmentRoom = {
        id: 'room-studio-1',
        name: 'Open Studio Space (1+kk)',
        roomType: 'Living Room',
        position: [0, 0],
        width: 5.4,
        length: 4.8,
        height: 2.7,
        floorFinish: 'Light Nordic Oak',
        floorTintHex: '#FFFFFF',
        walls: {
          north: { colorHex: '#F2EFEB', finish: 'Warm Microcement' },
          south: { colorHex: '#F7F5F0', finish: 'Smooth Matte Plaster' },
          east: { colorHex: '#EBE7DE', finish: 'Nordic Acoustic Wood Slats' },
          west: { colorHex: '#F7F5F0', finish: 'Smooth Matte Plaster' },
        },
        openings: [
          {
            id: 'win-st-1',
            wall: 'north',
            type: 'Floor-to-Ceiling Balcony Glazing',
            width: 2.4,
            height: 2.4,
            sillHeight: 0,
            offset: 0,
          },
          {
            id: 'door-st-1',
            wall: 'south',
            type: 'Door',
            width: 0.9,
            height: 2.1,
            sillHeight: 0,
            offset: -1.2,
          },
        ],
      };

      const templateData: RestoredProjectData = {
        projectName: 'Útulný Studio Byt 1+kk',
        rooms: [studioRoom],
        placedItems: [
          {
            instanceId: `studio-sofa-${Date.now()}`,
            productId: 'ikea-kivik-3',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-kivik-3')!,
            swatchName: 'Hillared Anthracite',
            swatchHex: '#303236',
            position: [0, 0, -1.2],
            rotationY: 0,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-kivik-3')!,
              '#303236',
              'Hillared Anthracite'
            ),
            roomId: studioRoom.id,
          },
          {
            instanceId: `studio-coffee-${Date.now()}`,
            productId: 'ikea-lack-coffee',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-lack-coffee')!,
            swatchName: 'Black-brown',
            swatchHex: '#2B2623',
            position: [0, 0, 0.0],
            rotationY: 0,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-lack-coffee')!,
              '#2B2623',
              'Black-brown'
            ),
            roomId: studioRoom.id,
          },
          {
            instanceId: `studio-tv-${Date.now()}`,
            productId: 'ikea-besta-tv',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-besta-tv')!,
            swatchName: 'Black-brown Walnut',
            swatchHex: '#3D342C',
            position: [0, 0, 1.8],
            rotationY: 180,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-besta-tv')!,
              '#3D342C',
              'Black-brown Walnut'
            ),
            roomId: studioRoom.id,
          },
          {
            instanceId: `studio-table-${Date.now()}`,
            productId: 'ikea-lisabo-table',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-lisabo-table')!,
            swatchName: 'Ash Veneer',
            swatchHex: '#E2D3BA',
            position: [1.8, 0, -0.6],
            rotationY: 90,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-lisabo-table')!,
              '#E2D3BA',
              'Ash Veneer'
            ),
            roomId: studioRoom.id,
          },
        ],
        chandeliers: [
          {
            instanceId: `ch-studio-${Date.now()}`,
            presetId: 'multi_ring_led',
            catalogItem: INITIAL_CHANDELIERS[0].catalogItem,
            roomId: studioRoom.id,
            position: [0, 2.7, 0],
            dropCableHeight: 0.65,
            scale: 1.1,
            isOn: true,
            brightness: 95,
            colorTempK: 2800,
          },
        ],
        lightingPreset: 'Cozy Evening Lamps',
        viewMode: 'orbit',
        activeRoomId: studioRoom.id,
      };
      onRestoreProject(templateData);
      onClose();
    } else {
      // Executive Loft
      const loftLiving: ApartmentRoom = {
        id: 'room-loft-main',
        name: 'Great Room & Gallery Loft',
        roomType: 'Living Room',
        position: [0, 0],
        width: 6.8,
        length: 5.6,
        height: 3.2,
        floorFinish: 'Walnut Herringbone',
        floorTintHex: '#FFFFFF',
        walls: {
          north: { colorHex: '#EAE6DF', finish: 'Exposed Whitewashed Brick' },
          south: { colorHex: '#F7F5F0', finish: 'Smooth Matte Plaster' },
          east: { colorHex: '#272B30', finish: 'Smooth Matte Plaster' },
          west: { colorHex: '#F7F5F0', finish: 'Smooth Matte Plaster' },
        },
        openings: [
          {
            id: 'op-loft-win1',
            wall: 'north',
            type: 'Floor-to-Ceiling Balcony Glazing',
            width: 3.2,
            height: 2.8,
            sillHeight: 0,
            offset: 0,
          },
        ],
      };

      const templateData: RestoredProjectData = {
        projectName: 'Executive Modern Loft',
        rooms: [loftLiving],
        placedItems: [
          {
            instanceId: `loft-sofa-${Date.now()}`,
            productId: 'ikea-kivik-3',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-kivik-3')!,
            swatchName: 'Grann Golden-Brown Leather',
            swatchHex: '#8C5832',
            position: [0, 0, -1.5],
            rotationY: 0,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-kivik-3')!,
              '#8C5832',
              'Grann Golden-Brown Leather'
            ),
            roomId: loftLiving.id,
          },
          {
            instanceId: `loft-armchair-${Date.now()}`,
            productId: 'ikea-strandmon',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-strandmon')!,
            swatchName: 'Djuparp Dark Green-Blue Velvet',
            swatchHex: '#223843',
            position: [-2.1, 0, -0.4],
            rotationY: 75,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-strandmon')!,
              '#223843',
              'Djuparp Dark Green-Blue Velvet'
            ),
            roomId: loftLiving.id,
          },
          {
            instanceId: `loft-tv-${Date.now()}`,
            productId: 'ikea-besta-tv',
            product: INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-besta-tv')!,
            swatchName: 'Black-brown Walnut',
            swatchHex: '#25201C',
            position: [0, 0, 2.2],
            rotationY: 180,
            spec3D: buildParametric3DSpec(
              INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-besta-tv')!,
              '#25201C',
              'Black-brown Walnut'
            ),
            roomId: loftLiving.id,
          },
        ],
        chandeliers: [
          {
            instanceId: `ch-loft-${Date.now()}`,
            presetId: 'geodesic_chandelier',
            catalogItem: INITIAL_CHANDELIERS[0].catalogItem,
            roomId: loftLiving.id,
            position: [0, 3.2, 0],
            dropCableHeight: 1.1,
            scale: 1.35,
            isOn: true,
            brightness: 100,
            colorTempK: 2700,
          },
        ],
        lightingPreset: 'Golden Hour',
        viewMode: 'orbit',
        activeRoomId: loftLiving.id,
      };
      onRestoreProject(templateData);
      onClose();
    }
  };

  // Dark mode style variables
  const containerClasses = isDarkMode
    ? 'bg-[#18181B]/95 text-zinc-100 border-zinc-700/80 shadow-[0_24px_64px_rgba(0,0,0,0.6)] ring-1 ring-amber-500/20'
    : 'bg-white/98 text-[#111111] border-[#E5E5E5] shadow-[0_24px_64px_rgba(0,0,0,0.18)]';

  const headerClasses = isDarkMode
    ? 'bg-[#222226] border-zinc-700/80 text-zinc-100'
    : 'bg-[#F5F5F5] border-[#E5E5E5] text-[#111111]';

  const subtextClasses = isDarkMode ? 'text-zinc-400' : 'text-[#666666]';
  const cardClasses = isDarkMode
    ? 'bg-zinc-800/60 border-zinc-700/70'
    : 'bg-[#FAFAFA] border-[#E5E5E5]';

  const inputClasses = isDarkMode
    ? 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-[#FFDB00]'
    : 'bg-white border-[#CCCCCC] text-[#111111] placeholder-[#767676] focus:border-[#0058A3]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border overflow-hidden backdrop-blur-xl ${containerClasses}`}
      >
        {/* Modal Header */}
        <div className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between shrink-0 ${headerClasses}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#0058A3] text-[#FFDB00] rounded-lg">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Projekt: Uložit & Načíst (Persistence)</span>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-[#0058A3]/10 text-[#0058A3] dark:bg-amber-400/10 dark:text-amber-300 rounded font-bold">
                  JSON v1.0
                </span>
              </h2>
              <p className={`text-xs ${subtextClasses}`}>
                Kompletní záloha pokojů, CAD modelů, lustrů a povrchů
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Zavřít okno (ESC)"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-inherit"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-2 pb-0 border-b border-inherit flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-[#0058A3] dark:border-amber-400 text-[#0058A3] dark:text-amber-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>1. Export & Uložit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
              activeTab === 'import'
                ? 'border-[#0058A3] dark:border-amber-400 text-[#0058A3] dark:text-amber-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>2. Import & Obnovit</span>
            {parsedProject && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('slots')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
              activeTab === 'slots'
                ? 'border-[#0058A3] dark:border-amber-400 text-[#0058A3] dark:text-amber-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>3. Rychlé Slotů ({savedSlots.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
              activeTab === 'templates'
                ? 'border-[#0058A3] dark:border-amber-400 text-[#0058A3] dark:text-amber-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>4. Šablony Vzorů</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: EXPORT & SAVE */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                  Název projektu / Bytové sestavy:
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="např. Můj 3-pokojový byt na Vinohradech"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold outline-none border transition-colors ${inputClasses}`}
                />
              </div>

              {/* Summary Metrics */}
              <div className={`p-4 rounded-xl border grid grid-cols-2 sm:grid-cols-4 gap-3 ${cardClasses}`}>
                <div>
                  <span className={`text-[11px] font-bold block ${subtextClasses}`}>Místnosti</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-4 h-4 text-[#0058A3] dark:text-amber-400" />
                    <span className="text-base font-black">{rooms.length} pokoje</span>
                  </div>
                </div>

                <div>
                  <span className={`text-[11px] font-bold block ${subtextClasses}`}>IKEA Nábytek</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Box className="w-4 h-4 text-[#0058A3] dark:text-amber-400" />
                    <span className="text-base font-black">{placedItems.length} ks</span>
                  </div>
                </div>

                <div>
                  <span className={`text-[11px] font-bold block ${subtextClasses}`}>Lustry & Světla</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Lightbulb className="w-4 h-4 text-[#0058A3] dark:text-amber-400" />
                    <span className="text-base font-black">{chandeliers.length} ks</span>
                  </div>
                </div>

                <div>
                  <span className={`text-[11px] font-bold block ${subtextClasses}`}>Rozpočet (BOM)</span>
                  <div className="mt-0.5 font-black text-sm text-[#0058A3] dark:text-amber-400 truncate">
                    {summary.totalCzk.toLocaleString('cs-CZ')} Kč
                  </div>
                </div>
              </div>

              {/* Notes Input */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                  Poznámky k návrhu (volitelné):
                </label>
                <input
                  type="text"
                  value={exportNotes}
                  onChange={(e) => setExportNotes(e.target.value)}
                  placeholder="např. Varianta s dubovými parketami a tmavě šedou sedačkou KIVIK"
                  className={`w-full px-3 py-2 rounded-lg text-xs outline-none border ${inputClasses}`}
                />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="py-3 px-4 bg-[#0058A3] hover:bg-[#004F93] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer min-h-[44px]"
                >
                  <Download className="w-4 h-4 text-[#FFDB00]" />
                  <span>Stáhnout soubor .JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="py-3 px-4 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300">Zkopírováno!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Kopírovat do schránky</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSaveToBrowserSlot}
                  className="py-3 px-4 bg-[#FFDB00] hover:bg-[#F2CF00] text-[#111111] font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer min-h-[44px]"
                >
                  <Save className="w-4 h-4 text-[#0058A3]" />
                  <span>Rychlé uložení v prohlížeči</span>
                </button>
              </div>

              {slotSaveFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-bold text-center">
                  {slotSaveFeedback}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: IMPORT & RESTORE */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileProcess(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-[#0058A3] bg-[#0058A3]/5 dark:border-amber-400 dark:bg-amber-400/5'
                    : 'border-zinc-300 dark:border-zinc-700 hover:border-[#0058A3] dark:hover:border-amber-400'
                }`}
              >
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[#0058A3] dark:text-amber-400">
                  <FileJson className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-sm font-bold block">
                    Přetáhněte soubor .json sem, nebo klikněte pro výběr
                  </span>
                  <span className={`text-xs ${subtextClasses}`}>
                    Podporuje exporty IKEA Space Planner a kompatibilní architektonické layouty
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileProcess(f);
                  }}
                  className="hidden"
                />
              </div>

              {/* Paste Raw JSON Text */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase tracking-wider block">
                    Nebo vložte obsah JSON přímo ze schránky:
                  </label>
                  {importJsonText && (
                    <button
                      type="button"
                      onClick={() => {
                        setImportJsonText('');
                        setParsedProject(null);
                        setValidationError(null);
                        setImportFileName(null);
                      }}
                      className="text-xs text-red-600 hover:underline cursor-pointer"
                    >
                      Vymazat
                    </button>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={importJsonText}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setImportJsonText(txt);
                    setValidationError(null);
                    setParsedProject(null);
                    if (txt.trim()) {
                      try {
                        const validated = validateAndParseJson(txt);
                        setParsedProject(validated);
                      } catch (err: any) {
                        setValidationError(err.message);
                      }
                    }
                  }}
                  placeholder='Vložte {"format": "ikea-space-planner-project", "rooms": [...], ...}'
                  className={`w-full p-3 font-mono text-xs rounded-xl outline-none border transition-colors ${inputClasses}`}
                />
              </div>

              {/* Validation Error Banner */}
              {validationError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Chyba při validaci JSON:</span>
                    <span>{validationError}</span>
                  </div>
                </div>
              )}

              {/* Validated Project Preview Card */}
              {parsedProject && (
                <div className={`p-4 rounded-xl border space-y-3 ${cardClasses}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Platný návrh připraven k obnovení
                      </span>
                    </div>
                    {importFileName && (
                      <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[200px]">
                        {importFileName}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-black">{parsedProject.projectName}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
                      <span className="font-semibold">
                        🚪 {parsedProject.rooms.length} {parsedProject.rooms.length === 1 ? 'místnost' : 'místnosti'}
                      </span>
                      <span>•</span>
                      <span className="font-semibold">
                        🛋️ {parsedProject.placedItems.length} ks nábytku
                      </span>
                      <span>•</span>
                      <span className="font-semibold">
                        💡 {parsedProject.chandeliers.length} lustrů
                      </span>
                    </div>
                  </div>

                  {/* Safety confirmation checkbox */}
                  <label className="flex items-center gap-2.5 pt-2 text-xs font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={restoreConfirmed}
                      onChange={(e) => setRestoreConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0058A3] cursor-pointer"
                    />
                    <span>
                      Rozumím, že obnovení nahradí aktuální rozestavění bytu v editoru.
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={!restoreConfirmed}
                    onClick={handleApplyImport}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px]"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Obnovit a načíst tento návrh do 3D scény</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SAVED BROWSER SLOTS */}
          {activeTab === 'slots' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${subtextClasses}`}>
                  Uložené verze v paměti vašeho prohlížeče
                </span>
                <button
                  type="button"
                  onClick={handleSaveToBrowserSlot}
                  className="px-3 py-1.5 bg-[#0058A3] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-[#004F93] cursor-pointer min-h-[36px]"
                >
                  <Save className="w-3.5 h-3.5 text-[#FFDB00]" />
                  <span>Uložit aktuální stav</span>
                </button>
              </div>

              {savedSlots.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                  <Clock className="w-8 h-8 text-zinc-400 opacity-60" />
                  <span className="font-semibold">Zatím nemáte uložený žádný rychlý slot.</span>
                  <span>Klikněte na "Uložit aktuální stav" nebo exportujte projekt jako .json soubor.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${cardClasses}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm truncate">{slot.name}</span>
                          <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                            {slot.timestamp}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{slot.roomCount} pokoje</span>
                          <span>•</span>
                          <span>{slot.itemCount} předmětů</span>
                          <span>•</span>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                            {slot.totalCzk.toLocaleString('cs-CZ')} Kč
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const restored = validateAndParseJson(JSON.stringify(slot.data));
                              onRestoreProject(restored);
                              onClose();
                            } catch (e: any) {
                              alert(`Chyba při načtení slotu: ${e.message}`);
                            }
                          }}
                          className="px-3 py-2 bg-[#0058A3] hover:bg-[#004F93] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer min-h-[40px] flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Načíst</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot.id)}
                          title="Smazat slot"
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CURATED TEMPLATE LAYOUTS */}
          {activeTab === 'templates' && (
            <div className="space-y-3">
              <p className={`text-xs ${subtextClasses}`}>
                Vyberte si předpřipravený vzorový apartmán. Načtení šablony okamžitě vygeneruje místnosti, okna, nábytek a osvětlení.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Template 1: Nordic 3-Room */}
                <div
                  onClick={() => handleLoadTemplate('scandi_3room')}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 hover:border-[#0058A3] dark:hover:border-amber-400 transition-all cursor-pointer group ${cardClasses}`}
                >
                  <div>
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-[#0058A3] dark:text-blue-300 rounded-lg w-fit mb-2">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-sm group-hover:text-[#0058A3] dark:group-hover:text-amber-300 transition-colors">
                      Nordic Rodinný 3-Pokojový Byt
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${subtextClasses}`}>
                      Obývací pokoj, prostorná kuchyně a ložnice. Obsahuje KIVIK, STRANDMON, LACK, BESTÅ a MALM.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-inherit flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0058A3] dark:text-amber-400">3 Pokoje / 7 Kusů</span>
                    <span className="font-bold text-xs group-hover:underline">Načíst →</span>
                  </div>
                </div>

                {/* Template 2: Cozy Studio 1+kk */}
                <div
                  onClick={() => handleLoadTemplate('cozy_studio')}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 hover:border-[#0058A3] dark:hover:border-amber-400 transition-all cursor-pointer group ${cardClasses}`}
                >
                  <div>
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300 rounded-lg w-fit mb-2">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-sm group-hover:text-[#0058A3] dark:group-hover:text-amber-300 transition-colors">
                      Útulné Studio 1+kk
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${subtextClasses}`}>
                      Kompaktní otevřený prostor s mikrocementem, akustickým panelem, LED lustrem a večerním nasvícením.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-inherit flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-600 dark:text-amber-400">1 Studio / 4 Kusy</span>
                    <span className="font-bold text-xs group-hover:underline">Načíst →</span>
                  </div>
                </div>

                {/* Template 3: Executive Loft */}
                <div
                  onClick={() => handleLoadTemplate('executive_loft')}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 hover:border-[#0058A3] dark:hover:border-amber-400 transition-all cursor-pointer group ${cardClasses}`}
                >
                  <div>
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 rounded-lg w-fit mb-2">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-sm group-hover:text-[#0058A3] dark:group-hover:text-amber-300 transition-colors">
                      Executive Modern Loft
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${subtextClasses}`}>
                      Vysoké stropy 3.2m, cihlová zeď, ořechové parkety, kožená sedačka a velký lustr.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-inherit flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Galerie / 3 Kusy</span>
                    <span className="font-bold text-xs group-hover:underline">Načíst →</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
