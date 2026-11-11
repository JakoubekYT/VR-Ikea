import React, { useState, useRef, useMemo } from 'react';
import {
  Compass,
  Grid,
  Sun,
  Glasses,
  ShoppingBag,
  Sliders,
  Eye,
  EyeOff,
  Magnet,
  Lightbulb,
  Footprints,
  ArrowUpLeft,
} from 'lucide-react';
import type {
  ApartmentRoom,
  ChandelierCatalogItem,
  FloatingWindowId,
  FloatingWindowState,
  Furniture3DSpec,
  IkeaCategory,
  IkeaProduct,
  LightingPreset,
  PlacedChandelier,
  PlacedFurnitureItem,
  RoomType,
  ViewMode,
  WallId,
} from './types/ikea';
import {
  INITIAL_APARTMENT_ROOMS,
  INITIAL_CHANDELIERS,
  INITIAL_IKEA_CATALOG,
} from './data/ikeaCatalog';
import {
  buildParametric3DSpec,
  calculateBomSummary,
  filterCatalog,
  snapFurnitureToRoom,
} from './utils/roomLogic';
import {
  convertImageTo3DLive,
  scrapeIkeaUrlLive,
  searchIkeaProductsLive,
  synthesize3DModelLive,
} from './services/geminiClient';
import { StudioViewport } from './components/StudioViewport';
import { CatalogPanel } from './components/CatalogPanel';
import { ArchitecturePanel } from './components/ArchitecturePanel';
import { ChandeliersPanel } from './components/ChandeliersPanel';
import { SelectedItemToolbar } from './components/SelectedItemToolbar';
import { BomDrawer } from './components/BomDrawer';
import { FloatingWindow } from './components/FloatingWindow';

function createInitialPlacedItems(): PlacedFurnitureItem[] {
  const kivik = INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-kivik-3')!;
  const strandmon = INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-strandmon')!;
  const lack = INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-lack-coffee')!;
  const besta = INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-besta-tv')!;
  const stoense = INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-stoense-rug')!;
  const lisabo = INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-lisabo-table')!;
  const malmBed = INITIAL_IKEA_CATALOG.find((p) => p.id === 'ikea-malm-bed')!;

  return [
    {
      instanceId: 'init-rug-1',
      productId: stoense.id,
      product: stoense,
      swatchName: stoense.swatches[0].name,
      swatchHex: stoense.swatches[0].hex,
      position: [0, 0, 0.15],
      rotationY: 0,
      spec3D: buildParametric3DSpec(stoense, stoense.swatches[0].hex, stoense.swatches[0].name),
      roomId: 'room-living',
    },
    {
      instanceId: 'init-sofa-1',
      productId: kivik.id,
      product: kivik,
      swatchName: kivik.swatches[0].name,
      swatchHex: kivik.swatches[0].hex,
      position: [0, 0, -1.45],
      rotationY: 0,
      spec3D: buildParametric3DSpec(kivik, kivik.swatches[0].hex, kivik.swatches[0].name),
      roomId: 'room-living',
    },
    {
      instanceId: 'init-coffee-1',
      productId: lack.id,
      product: lack,
      swatchName: lack.swatches[0].name,
      swatchHex: lack.swatches[0].hex,
      position: [0, 0, -0.2],
      rotationY: 0,
      spec3D: buildParametric3DSpec(lack, lack.swatches[0].hex, lack.swatches[0].name),
      roomId: 'room-living',
    },
    {
      instanceId: 'init-chair-1',
      productId: strandmon.id,
      product: strandmon,
      swatchName: strandmon.swatches[0].name,
      swatchHex: strandmon.swatches[0].hex,
      position: [-1.55, 0, -0.35],
      rotationY: 90,
      spec3D: buildParametric3DSpec(strandmon, strandmon.swatches[0].hex, strandmon.swatches[0].name),
      roomId: 'room-living',
    },
    {
      instanceId: 'init-tv-1',
      productId: besta.id,
      product: besta,
      swatchName: besta.swatches[0].name,
      swatchHex: besta.swatches[0].hex,
      position: [0, 0, 1.85],
      rotationY: 180,
      spec3D: buildParametric3DSpec(besta, besta.swatches[0].hex, besta.swatches[0].name),
      roomId: 'room-living',
    },
    {
      instanceId: 'init-dining-1',
      productId: lisabo.id,
      product: lisabo,
      swatchName: lisabo.swatches[0].name,
      swatchHex: lisabo.swatches[0].hex,
      position: [4.75, 0, 0.0],
      rotationY: 90,
      spec3D: buildParametric3DSpec(lisabo, lisabo.swatches[0].hex, lisabo.swatches[0].name),
      roomId: 'room-kitchen',
    },
    {
      instanceId: 'init-bed-1',
      productId: malmBed.id,
      product: malmBed,
      swatchName: malmBed.swatches[0].name,
      swatchHex: malmBed.swatches[0].hex,
      position: [-1.2, 0, -4.65],
      rotationY: 0,
      spec3D: buildParametric3DSpec(malmBed, malmBed.swatches[0].hex, malmBed.swatches[0].name),
      roomId: 'room-bedroom',
    },
  ];
}

export default function App() {
  // Catalog & AI Search State
  const [catalog, setCatalog] = useState<IkeaProduct[]>(INITIAL_IKEA_CATALOG);
  const [activeCategory, setActiveCategory] = useState<IkeaCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [searchStatusMessage, setSearchStatusMessage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<IkeaProduct | null>(null);

  // 3D Insertion Progress State
  const [insertingProductId, setInsertingProductId] = useState<string | null>(null);
  const [insertProgress, setInsertProgress] = useState<number>(0);

  // Multi-Room Apartment & Chandeliers State
  const [rooms, setRooms] = useState<ApartmentRoom[]>(INITIAL_APARTMENT_ROOMS);
  const [activeRoomId, setActiveRoomId] = useState<string>(INITIAL_APARTMENT_ROOMS[0].id);
  const [placedItems, setPlacedItems] = useState<PlacedFurnitureItem[]>(createInitialPlacedItems);
  const [chandeliers, setChandeliers] = useState<PlacedChandelier[]>(INITIAL_CHANDELIERS);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedChandelierId, setSelectedChandelierId] = useState<string | null>(null);
  const [selectedWall, setSelectedWall] = useState<WallId | null>('north');

  // Viewport & Environment Controls
  const [viewMode, setViewMode] = useState<ViewMode>('orbit');
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('Nordic Morning Sun');
  const [autoCutaway, setAutoCutaway] = useState<boolean>(true);
  const [enableGridSnap, setEnableGridSnap] = useState<boolean>(true);
  const [enableWallSnap, setEnableWallSnap] = useState<boolean>(true);

  // Draggable & Resizable Floating UI Windows State
  const [floatingWindows, setFloatingWindows] = useState<Record<FloatingWindowId, FloatingWindowState>>({
    catalog: {
      id: 'catalog',
      title: 'IKEA Webstore & AI 3D',
      isOpen: true,
      isMinimized: false,
      x: 16,
      y: 68,
      width: 390,
      height: 590,
      zIndex: 22,
    },
    architecture: {
      id: 'architecture',
      title: 'Multi-Room Apartment Builder',
      isOpen: false,
      isMinimized: false,
      x: 420,
      y: 68,
      width: 380,
      height: 580,
      zIndex: 21,
    },
    chandeliers: {
      id: 'chandeliers',
      title: 'Chandeliers & Ceiling Lights (Lustry)',
      isOpen: false,
      isMinimized: false,
      x: 440,
      y: 88,
      width: 390,
      height: 520,
      zIndex: 20,
    },
    cart: {
      id: 'cart',
      title: 'Apartment BOM & Shopping List',
      isOpen: false,
      isMinimized: false,
      x: 820,
      y: 68,
      width: 380,
      height: 440,
      zIndex: 19,
    },
  });

  const updateWindow = (id: FloatingWindowId, patch: Partial<FloatingWindowState>) => {
    setFloatingWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const focusWindow = (id: FloatingWindowId) => {
    setFloatingWindows((prev) => {
      const maxZ = Math.max(...Object.values(prev).map((w) => w.zIndex));
      return {
        ...prev,
        [id]: { ...prev[id], zIndex: maxZ + 1, isOpen: true },
      };
    });
  };

  const toggleWindow = (id: FloatingWindowId) => {
    setFloatingWindows((prev) => {
      const target = prev[id];
      const maxZ = Math.max(...Object.values(prev).map((w) => w.zIndex));
      return {
        ...prev,
        [id]: {
          ...target,
          isOpen: !target.isOpen,
          isMinimized: false,
          zIndex: maxZ + 1,
        },
      };
    });
  };

  // WebXR Status
  const [vrStatus, setVrStatus] = useState<{
    supported: boolean;
    active: boolean;
    message?: string;
  }>({ supported: false, active: false });
  const enterVrTriggerRef = useRef<(() => void) | null>(null);

  const filteredProducts = useMemo(
    () => filterCatalog(catalog, activeCategory, searchQuery),
    [catalog, activeCategory, searchQuery]
  );

  const selectedPlacedItem = useMemo(
    () => placedItems.find((i) => i.instanceId === selectedInstanceId) || null,
    [placedItems, selectedInstanceId]
  );

  const bomSummary = useMemo(
    () => calculateBomSummary(placedItems, chandeliers),
    [placedItems, chandeliers]
  );

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) || rooms[0],
    [rooms, activeRoomId]
  );

  // Update a specific room
  const handleUpdateRoom = (roomId: string, updater: (prev: ApartmentRoom) => ApartmentRoom) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? updater(r) : r)));
  };

  // Add a new room to the apartment layout
  const handleAddRoom = (roomType: RoomType) => {
    const offsetIndex = rooms.length;
    const defaultW = roomType === 'Bathroom' || roomType === 'Hallway' ? 3.0 : 4.2;
    const defaultL = roomType === 'Bathroom' ? 2.6 : 3.8;
    const newRoom: ApartmentRoom = {
      id: `room-${Date.now().toString().slice(-4)}`,
      name: `${roomType} #${offsetIndex + 1}`,
      roomType,
      width: defaultW,
      length: defaultL,
      height: 2.7,
      position: [
        Number(((offsetIndex % 2 === 0 ? 1 : -1) * 4.5).toFixed(2)),
        Number((Math.floor(offsetIndex / 2) * 4.2).toFixed(2)),
      ],
      floorFinish:
        roomType === 'Bathroom'
          ? 'Marble Tiles'
          : roomType === 'Kitchen'
          ? 'Polished Concrete'
          : 'Oak Parquet',
      floorTintHex: '#FFFFFF',
      walls: {
        north: { colorHex: '#F7F5F0', finish: 'Smooth Matte Plaster' },
        south: { colorHex: '#F7F5F0', finish: 'Smooth Matte Plaster' },
        east: { colorHex: '#EAE6DF', finish: 'Smooth Matte Plaster' },
        west: { colorHex: '#F7F5F0', finish: 'Smooth Matte Plaster' },
      },
      openings: [
        {
          id: `op-win-${Date.now().toString().slice(-3)}`,
          wall: 'north',
          type: 'Single Window',
          width: 1.2,
          height: 1.35,
          sillHeight: 0.85,
          offset: 0,
        },
        {
          id: `op-arch-${Date.now().toString().slice(-3)}`,
          wall: 'south',
          type: 'Open Archway',
          width: 1.3,
          height: 2.1,
          sillHeight: 0,
          offset: 0,
        },
      ],
    };

    setRooms((prev) => [...prev, newRoom]);
    setActiveRoomId(newRoom.id);
  };

  const handleDeleteRoom = (roomId: string) => {
    if (rooms.length <= 1) return;
    const remaining = rooms.filter((r) => r.id !== roomId);
    setRooms(remaining);
    if (activeRoomId === roomId) {
      setActiveRoomId(remaining[0].id);
    }
  };

  // Live IKEA Search OR URL Scrape (Always returns 6 matching products in CZ/EN)
  const handleTriggerLiveSearch = async (queryOrUrl: string) => {
    setIsSearchingLive(true);
    const isUrl = /^https?:\/\//i.test(queryOrUrl.trim());
    setSearchStatusMessage(
      isUrl
        ? 'Načítám reálný produkt, fotku a rozměry přímo z webu IKEA...'
        : 'Vyhledávám v IKEA katalogu a připravuji 3D modely...'
    );
    try {
      const res = isUrl
        ? await scrapeIkeaUrlLive(queryOrUrl)
        : await searchIkeaProductsLive(queryOrUrl);

      if (res.products && res.products.length > 0) {
        setCatalog((prev) => {
          const existingIds = new Set(res.products.map((p) => p.id));
          return [...res.products, ...prev.filter((p) => !existingIds.has(p.id))];
        });
        setActiveCategory('All');
        setSelectedProduct(isUrl ? res.products[0] : null);
        if (isUrl && res.products[0]) {
          const p = res.products[0];
          setSearchStatusMessage(
            `Načten ${p.name} (${p.typeName}) z IKEA webu! Rozměry: ${p.dimensionsCm.width}×${p.dimensionsCm.depth}×${p.dimensionsCm.height} cm, cena: ${p.priceCzk.toLocaleString('cs-CZ')} Kč.`
          );
        } else {
          setSearchStatusMessage(
            res.source === 'cache'
              ? `Načteno ${res.products.length} produktů z vyrovnávací paměti.`
              : `Nalezeno ${res.products.length} produktů IKEA (${res.source}).`
          );
        }
      }
    } finally {
      setIsSearchingLive(false);
    }
  };

  // Direct Image Upload / Paste (Ctrl+V) to 3D
  const handleConvertImageTo3D = async (params: {
    imageBase64: string;
    mimeType: string;
    dimensionsCm: { width: number; depth: number; height: number };
    nameHint: string;
  }) => {
    setIsSearchingLive(true);
    setSearchStatusMessage('Reconstructing 20–40 part 3D CAD assembly from image...');
    try {
      const res = await convertImageTo3DLive(params);
      setCatalog((prev) => [res.product, ...prev]);
      setSelectedProduct(res.product);
      handleInsertProductAs3D(
        res.product,
        res.product.swatches[0].hex,
        res.product.swatches[0].name,
        res.spec3D
      );
      setSearchStatusMessage(`Reconstructed "${res.product.name}" (${res.spec3D.parts.length} 3D parts) and placed in room!`);
    } finally {
      setIsSearchingLive(false);
    }
  };

  // Insert Product as 20-40 Sub-Part 3D into Active Room with Laser-Scanning Bounding Box
  const handleInsertProductAs3D = async (
    product: IkeaProduct,
    swatchHex: string,
    swatchName: string,
    prebuiltSpec?: Furniture3DSpec
  ) => {
    setInsertingProductId(product.id);
    setInsertProgress(25);

    const instanceId = `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const initialSpec =
      prebuiltSpec || buildParametric3DSpec(product, swatchHex, swatchName);

    const offsetAngle = (placedItems.length * 1.15) % (Math.PI * 2);
    const localCandidate: [number, number, number] = [
      Number((Math.cos(offsetAngle) * 0.45).toFixed(2)),
      0,
      Number((Math.sin(offsetAngle) * 0.45).toFixed(2)),
    ];

    const snapped = snapFurnitureToRoom(localCandidate, 0, product.dimensionsCm, {
      width: activeRoom.width,
      length: activeRoom.length,
      enableGridSnap,
      enableWallSnap,
    });

    const worldPos: [number, number, number] = [
      Number((activeRoom.position[0] + snapped.position[0]).toFixed(2)),
      0,
      Number((activeRoom.position[1] + snapped.position[2]).toFixed(2)),
    ];

    // First spawn with laser-scanning bounding box visible briefly
    const newItem: PlacedFurnitureItem = {
      instanceId,
      productId: product.id,
      product,
      swatchName,
      swatchHex,
      position: worldPos,
      rotationY: snapped.rotationY,
      spec3D: initialSpec,
      isGenerating: true,
      roomId: activeRoom.id,
    };

    setPlacedItems((prev) => [...prev, newItem]);
    setSelectedInstanceId(instanceId);
    setInsertProgress(65);

    if (!prebuiltSpec) {
      const { spec } = await synthesize3DModelLive(product, swatchHex, swatchName);
      setPlacedItems((prev) =>
        prev.map((it) =>
          it.instanceId === instanceId ? { ...it, spec3D: spec, isGenerating: false } : it
        )
      );
    } else {
      setTimeout(() => {
        setPlacedItems((prev) =>
          prev.map((it) =>
            it.instanceId === instanceId ? { ...it, isGenerating: false } : it
          )
        );
      }, 350);
    }

    setInsertProgress(100);
    setInsertingProductId(null);
  };

  // Mount Chandelier on Active Room Ceiling
  const handleInsertChandelier = (item: ChandelierCatalogItem) => {
    const newCh: PlacedChandelier = {
      instanceId: `ch-${Date.now().toString().slice(-4)}`,
      presetId: item.id,
      catalogItem: item,
      roomId: activeRoom.id,
      position: [activeRoom.position[0], activeRoom.height, activeRoom.position[1]],
      dropCableHeight: item.defaultDropMeters,
      scale: 1.0,
      isOn: true,
      brightness: 90,
      colorTempK: 3000,
    };
    setChandeliers((prev) => [...prev, newCh]);
    setSelectedChandelierId(newCh.instanceId);
  };

  const handleUpdateChandelier = (id: string, patch: Partial<PlacedChandelier>) => {
    setChandeliers((prev) =>
      prev.map((ch) => (ch.instanceId === id ? { ...ch, ...patch } : ch))
    );
  };

  const handleRemoveChandelier = (id: string) => {
    setChandeliers((prev) => prev.filter((ch) => ch.instanceId !== id));
    if (selectedChandelierId === id) setSelectedChandelierId(null);
  };

  const handleMoveFurniture = (
    instanceId: string,
    newPos: [number, number, number],
    newRotY: number,
    roomId?: string
  ) => {
    setPlacedItems((prev) =>
      prev.map((item) =>
        item.instanceId === instanceId
          ? {
              ...item,
              position: newPos,
              rotationY: newRotY,
              roomId: roomId || item.roomId,
            }
          : item
      )
    );
  };

  const handleMoveChandelier = (
    chandelierId: string,
    newPos: [number, number, number],
    roomId?: string
  ) => {
    setChandeliers((prev) =>
      prev.map((ch) =>
        ch.instanceId === chandelierId
          ? { ...ch, position: newPos, roomId: roomId || ch.roomId }
          : ch
      )
    );
  };

  const handleRotateSelected = (deltaDeg: number) => {
    if (!selectedInstanceId) return;
    setPlacedItems((prev) =>
      prev.map((item) => {
        if (item.instanceId !== selectedInstanceId) return item;
        const nextRot = (item.rotationY + deltaDeg + 360) % 360;
        return { ...item, rotationY: nextRot };
      })
    );
  };

  const handleChangeSelectedSwatch = (swatchHex: string, swatchName: string) => {
    if (!selectedInstanceId) return;
    setPlacedItems((prev) =>
      prev.map((item) => {
        if (item.instanceId !== selectedInstanceId) return item;
        const updatedSpec = buildParametric3DSpec(item.product, swatchHex, swatchName);
        return {
          ...item,
          swatchHex,
          swatchName,
          spec3D: updatedSpec,
        };
      })
    );
  };

  const handleDuplicateSelected = () => {
    if (!selectedPlacedItem) return;
    const dupId = `item-${Date.now()}`;
    const newItem: PlacedFurnitureItem = {
      ...selectedPlacedItem,
      instanceId: dupId,
      position: [
        Number((selectedPlacedItem.position[0] + 0.45).toFixed(2)),
        0,
        Number((selectedPlacedItem.position[2] + 0.45).toFixed(2)),
      ],
    };
    setPlacedItems((prev) => [...prev, newItem]);
    setSelectedInstanceId(dupId);
  };

  const handleDeleteInstance = (instanceId: string) => {
    setPlacedItems((prev) => prev.filter((i) => i.instanceId !== instanceId));
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
  };

  // Hero 1-Click Action: Enter Inside Apartment (1:1 Walkthrough / VR)
  const handleEnterInsideApartment = () => {
    setViewMode('walkthrough_1to1');
    if (vrStatus.supported) {
      enterVrTriggerRef.current?.();
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F5F5F5] text-[#111111] font-sans select-none">
      {/* Full-bleed 3D & WebXR Apartment Viewport */}
      <StudioViewport
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={setActiveRoomId}
        onUpdateRoom={handleUpdateRoom}
        placedItems={placedItems}
        chandeliers={chandeliers}
        selectedInstanceId={selectedInstanceId}
        selectedChandelierId={selectedChandelierId}
        selectedWall={selectedWall}
        viewMode={viewMode}
        lightingPreset={lightingPreset}
        autoCutaway={autoCutaway}
        enableGridSnap={enableGridSnap}
        enableWallSnap={enableWallSnap}
        onSelectFurniture={setSelectedInstanceId}
        onSelectChandelier={setSelectedChandelierId}
        onSelectWall={setSelectedWall}
        onMoveFurniture={handleMoveFurniture}
        onMoveChandelier={handleMoveChandelier}
        onToggleAllChandeliers={() =>
          setChandeliers((prev) => prev.map((c) => ({ ...c, isOn: !c.isOn })))
        }
        onVrStatusChange={setVrStatus}
        enterVrTriggerRef={enterVrTriggerRef}
      />

      {/* Top Navigation & One-Click Hero Button Bar */}
      <header className="pointer-events-none fixed top-0 left-0 right-0 z-30 p-2.5 flex items-center justify-between gap-2">
        {/* Left: Brand & Floating Window Launchers */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#E5E5E5] shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <div className="px-2 py-1 bg-[#0058A3] rounded font-black text-xs tracking-tighter text-[#FFDB00] mr-1">
            IKEA
          </div>
          <button
            type="button"
            onClick={() => toggleWindow('catalog')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              floatingWindows.catalog.isOpen
                ? 'bg-[#0058A3] text-white'
                : 'text-[#333333] hover:bg-[#F5F5F5]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Catalog & AI 3D</span>
          </button>
          <button
            type="button"
            onClick={() => toggleWindow('architecture')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              floatingWindows.architecture.isOpen
                ? 'bg-[#0058A3] text-white'
                : 'text-[#333333] hover:bg-[#F5F5F5]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Rooms ({rooms.length})</span>
          </button>
          <button
            type="button"
            onClick={() => toggleWindow('chandeliers')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              floatingWindows.chandeliers.isOpen
                ? 'bg-[#0058A3] text-white'
                : 'text-[#333333] hover:bg-[#F5F5F5]'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Lustry ({chandeliers.length})</span>
          </button>
        </div>

        {/* Center: HERO BUTTON "ENTER INSIDE APARTMENT (1:1 Walkthrough / VR)" */}
        <div className="pointer-events-auto flex items-center gap-2">
          {viewMode !== 'walkthrough_1to1' ? (
            <button
              type="button"
              onClick={handleEnterInsideApartment}
              className="px-4 py-2 bg-[#0058A3] hover:bg-[#004F93] text-white font-black text-xs rounded-xl shadow-[0_10px_28px_rgba(0,88,163,0.35)] border-2 border-[#FFDB00] flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <Footprints className="w-4 h-4 text-[#FFDB00]" />
              <span>ENTER INSIDE APARTMENT (1:1 Walkthrough / VR)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setViewMode('orbit')}
              className="px-4 py-2 bg-[#111111] hover:bg-[#222222] text-white font-black text-xs rounded-xl shadow-lg border-2 border-[#FFDB00] flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <ArrowUpLeft className="w-4 h-4 text-[#FFDB00]" />
              <span>Back to Top-Down View</span>
            </button>
          )}
        </div>

        {/* Right: Camera Modes, Lighting, Snapping & BOM Cart */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-[#E5E5E5] shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <div className="flex items-center bg-[#F5F5F5] p-0.5 rounded-lg border border-[#E5E5E5]">
            <button
              type="button"
              onClick={() => setViewMode('orbit')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'orbit'
                  ? 'bg-white text-[#111111] shadow-2xs'
                  : 'text-[#555555] hover:text-[#111111]'
              }`}
              title="Top-Down 3D Dollhouse Orbit"
            >
              <Compass className="w-3.5 h-3.5 text-[#0058A3]" />
              <span>Dollhouse</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('blueprint')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'blueprint'
                  ? 'bg-white text-[#111111] shadow-2xs'
                  : 'text-[#555555] hover:text-[#111111]'
              }`}
              title="2D Floorplan Blueprint"
            >
              <Grid className="w-3.5 h-3.5 text-[#0058A3]" />
              <span>2D Plan</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAutoCutaway((v) => !v)}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
              autoCutaway
                ? 'bg-[#F5F5F5] border-[#CCCCCC] text-[#111111]'
                : 'bg-white border-[#E5E5E5] text-[#767676]'
            }`}
            title="Auto-hide front walls in Dollhouse mode"
          >
            {autoCutaway ? (
              <Eye className="w-3.5 h-3.5 text-[#0058A3]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden xl:inline">Cutaway</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEnableGridSnap((v) => !v);
              setEnableWallSnap((v) => !v);
            }}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
              enableGridSnap
                ? 'bg-[#F5F5F5] border-[#CCCCCC] text-[#111111]'
                : 'bg-white border-[#E5E5E5] text-[#767676]'
            }`}
            title="Toggle 5cm Grid & Magnetic Wall Snapping"
          >
            <Magnet className="w-3.5 h-3.5 text-[#0058A3]" />
            <span className="hidden xl:inline">Snap</span>
          </button>

          <div className="flex items-center gap-1 bg-[#F5F5F5] px-2 py-1 rounded-lg border border-[#E5E5E5]">
            <Sun className="w-3.5 h-3.5 text-[#0058A3]" />
            <select
              value={lightingPreset}
              onChange={(e) => setLightingPreset(e.target.value as LightingPreset)}
              className="bg-transparent text-[11px] font-bold text-[#111111] outline-none cursor-pointer"
            >
              <option value="Nordic Morning Sun">Morning Sun</option>
              <option value="Golden Hour">Golden Hour</option>
              <option value="Cozy Evening Lamps">Cozy Evening</option>
              <option value="Studio Daylight">Studio Daylight</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => enterVrTriggerRef.current?.()}
            className="px-2.5 py-1.5 bg-[#FFDB00] hover:bg-[#f2cf00] text-[#111111] font-black text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
            title="Launch Meta Quest 2 WebXR Hand Tracking & VR"
          >
            <Glasses className="w-3.5 h-3.5 text-[#0058A3]" />
            <span>Quest VR</span>
          </button>

          <button
            type="button"
            onClick={() => toggleWindow('cart')}
            className="px-2.5 py-1.5 bg-[#111111] hover:bg-[#222222] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#FFDB00]" />
            <span>{bomSummary.totalCzk.toLocaleString('cs-CZ')} Kč</span>
          </button>
        </div>
      </header>

      {/* VR Notification Toast */}
      {vrStatus.message && (
        <div className="fixed top-16 right-4 z-40 max-w-sm bg-[#111111] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs flex items-center justify-between gap-3">
          <span>{vrStatus.message}</span>
          <button
            type="button"
            onClick={() => setVrStatus((s) => ({ ...s, message: undefined }))}
            className="text-[#FFDB00] font-bold hover:underline cursor-pointer"
          >
            OK
          </button>
        </div>
      )}

      {/* 1. Floating Window: IKEA Webstore Catalog & AI 3D Engine */}
      <FloatingWindow
        win={floatingWindows.catalog}
        icon={<ShoppingBag className="w-3.5 h-3.5 text-[#0058A3]" />}
        onUpdate={(patch) => updateWindow('catalog', patch)}
        onFocus={() => focusWindow('catalog')}
      >
        <CatalogPanel
          products={filteredProducts}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onTriggerLiveSearch={handleTriggerLiveSearch}
          onConvertImageTo3D={handleConvertImageTo3D}
          isSearchingLive={isSearchingLive}
          searchStatusMessage={searchStatusMessage}
          selectedProduct={selectedProduct}
          onSelectProduct={setSelectedProduct}
          onInsertProductAs3D={handleInsertProductAs3D}
          insertingProductId={insertingProductId}
          insertProgress={insertProgress}
        />
      </FloatingWindow>

      {/* 2. Floating Window: Multi-Room Apartment Builder */}
      <FloatingWindow
        win={floatingWindows.architecture}
        icon={<Sliders className="w-3.5 h-3.5 text-[#0058A3]" />}
        onUpdate={(patch) => updateWindow('architecture', patch)}
        onFocus={() => focusWindow('architecture')}
      >
        <ArchitecturePanel
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoomId}
          onAddRoom={handleAddRoom}
          onDeleteRoom={handleDeleteRoom}
          onUpdateActiveRoom={(updater) => handleUpdateRoom(activeRoomId, updater)}
          selectedWall={selectedWall}
          onSelectWall={setSelectedWall}
        />
      </FloatingWindow>

      {/* 3. Floating Window: Ceiling Chandeliers (Lustry) */}
      <FloatingWindow
        win={floatingWindows.chandeliers}
        icon={<Lightbulb className="w-3.5 h-3.5 text-[#0058A3]" />}
        onUpdate={(patch) => updateWindow('chandeliers', patch)}
        onFocus={() => focusWindow('chandeliers')}
      >
        <ChandeliersPanel
          rooms={rooms}
          activeRoomId={activeRoomId}
          chandeliers={chandeliers}
          selectedChandelierId={selectedChandelierId}
          onSelectChandelier={setSelectedChandelierId}
          onInsertChandelier={handleInsertChandelier}
          onUpdateChandelier={handleUpdateChandelier}
          onRemoveChandelier={handleRemoveChandelier}
        />
      </FloatingWindow>

      {/* 4. Floating Window: Apartment BOM & Shopping Cart */}
      <FloatingWindow
        win={floatingWindows.cart}
        icon={<ShoppingBag className="w-3.5 h-3.5 text-[#0058A3]" />}
        onUpdate={(patch) => updateWindow('cart', patch)}
        onFocus={() => focusWindow('cart')}
      >
        <BomDrawer
          placedItems={placedItems}
          chandeliers={chandeliers}
          onSelectInstance={(id) => setSelectedInstanceId(id)}
          onRemoveInstance={handleDeleteInstance}
          onClearRoom={() => {
            setPlacedItems([]);
            setSelectedInstanceId(null);
          }}
        />
      </FloatingWindow>

      {/* Contextual Selected 3D Furniture Inspector Bar */}
      {selectedPlacedItem && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
          <SelectedItemToolbar
            item={selectedPlacedItem}
            onRotate={handleRotateSelected}
            onChangeSwatch={handleChangeSelectedSwatch}
            onDuplicate={handleDuplicateSelected}
            onDelete={() => handleDeleteInstance(selectedPlacedItem.instanceId)}
            onClose={() => setSelectedInstanceId(null)}
          />
        </div>
      )}
    </div>
  );
}
