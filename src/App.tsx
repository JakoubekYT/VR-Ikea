import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ShoppingBag,
  RotateCcw,
  RotateCw,
  Trash2,
  Grid,
  Tag,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Glasses,
  Sliders,
  Store,
} from 'lucide-react';
import {
  CoopSyncMessage,
  Furniture3DSpec,
  IkeaCategory,
  IkeaProduct,
  PlacedFurniture,
  RoomConfig,
} from './types/ikea';
import { IKEA_CATALOG, INITIAL_ROOM_CONFIG } from './data/ikeaCatalog';
import {
  buildParametric3DSpec,
  calculateBomSummary,
  clampToRoomBounds,
  filterCatalog,
  formatCZK,
  formatEUR,
} from './utils/roomLogic';
import { CameraMode, StudioViewport } from './components/StudioViewport';
import { CatalogPanel } from './components/CatalogPanel';
import { ArchitecturePanel } from './components/ArchitecturePanel';
import { ProductDetailModal } from './components/ProductDetailModal';
import { BomDrawer } from './components/BomDrawer';
import { CoopModal } from './components/CoopModal';

function createInitialPlacedFurniture(): PlacedFurniture[] {
  const findProd = (id: string) => IKEA_CATALOG.find((p) => p.id === id) || IKEA_CATALOG[0];

  const kivik = findProd('ikea-kivik-3seat');
  const strandmon = findProd('ikea-strandmon-wingchair');
  const stockholmTable = findProd('ikea-stockholm-coffee-table');
  const lohalsRug = findProd('ikea-lohals-rug');
  const billy = findProd('ikea-billy-bookcase');
  const hektar = findProd('ikea-hektar-floor-lamp');

  return [
    {
      instanceId: 'init-rug-1',
      productId: lohalsRug.id,
      product: lohalsRug,
      position: [0, 0, 0.15],
      rotationY: Math.PI / 2,
      scale: 1.0,
      selectedColorHex: lohalsRug.swatches[0].hex,
      selectedSwatchName: lohalsRug.swatches[0].name,
      spec3D: buildParametric3DSpec(lohalsRug, lohalsRug.swatches[0].hex),
    },
    {
      instanceId: 'init-kivik-1',
      productId: kivik.id,
      product: kivik,
      position: [0, 0, -1.35],
      rotationY: 0,
      scale: 1.0,
      selectedColorHex: kivik.swatches[0].hex,
      selectedSwatchName: kivik.swatches[0].name,
      spec3D: buildParametric3DSpec(kivik, kivik.swatches[0].hex),
    },
    {
      instanceId: 'init-stockholm-1',
      productId: stockholmTable.id,
      product: stockholmTable,
      position: [0, 0, 0.05],
      rotationY: 0,
      scale: 1.0,
      selectedColorHex: stockholmTable.swatches[0].hex,
      selectedSwatchName: stockholmTable.swatches[0].name,
      spec3D: buildParametric3DSpec(stockholmTable, stockholmTable.swatches[0].hex),
    },
    {
      instanceId: 'init-strandmon-1',
      productId: strandmon.id,
      product: strandmon,
      position: [-1.65, 0, 0.45],
      rotationY: Math.PI / 3,
      scale: 1.0,
      selectedColorHex: strandmon.swatches[1].hex, // Skiftebo Yellow accent
      selectedSwatchName: strandmon.swatches[1].name,
      spec3D: buildParametric3DSpec(strandmon, strandmon.swatches[1].hex),
    },
    {
      instanceId: 'init-billy-1',
      productId: billy.id,
      product: billy,
      position: [2.52, 0, -1.1],
      rotationY: -Math.PI / 2,
      scale: 1.0,
      selectedColorHex: billy.swatches[0].hex,
      selectedSwatchName: billy.swatches[0].name,
      spec3D: buildParametric3DSpec(billy, billy.swatches[0].hex),
    },
    {
      instanceId: 'init-hektar-1',
      productId: hektar.id,
      product: hektar,
      position: [-1.85, 0, -1.6],
      rotationY: Math.PI / 4,
      scale: 1.0,
      selectedColorHex: hektar.swatches[0].hex,
      selectedSwatchName: hektar.swatches[0].name,
      spec3D: buildParametric3DSpec(hektar, hektar.swatches[0].hex),
    },
  ];
}

export default function App() {
  const [catalog, setCatalog] = useState<IkeaProduct[]>(IKEA_CATALOG);
  const [selectedCategory, setSelectedCategory] = useState<IkeaCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [liveSearchStatus, setLiveSearchStatus] = useState<string | null>(null);

  const [leftTab, setLeftTab] = useState<'catalog' | 'architecture'>('catalog');
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(true);
  const [isBottomDockCollapsed, setIsBottomDockCollapsed] = useState(false);

  const [roomConfig, setRoomConfig] = useState<RoomConfig>(INITIAL_ROOM_CONFIG);
  const [placedFurniture, setPlacedFurniture] = useState<PlacedFurniture[]>(
    createInitialPlacedFurniture
  );
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>('init-kivik-1');

  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit3d');
  const [gridSnap, setGridSnap] = useState<boolean>(true);

  const [detailModalProduct, setDetailModalProduct] = useState<IkeaProduct | null>(null);
  const [isBomDrawerOpen, setIsBomDrawerOpen] = useState(false);
  const [isCoopModalOpen, setIsCoopModalOpen] = useState(false);

  const [vrSessionRequestCounter, setVrSessionRequestCounter] = useState(0);
  const [vrModeType, setVrModeType] = useState<'immersive-vr' | 'immersive-ar'>('immersive-vr');
  const [webXrStatus, setWebXrStatus] = useState<string>('ready');
  const [connectedPeersCount, setConnectedPeersCount] = useState(0);
  const [remoteVrCursor, setRemoteVrCursor] = useState<{
    position: [number, number, number];
    targetInstanceId: string | null;
  } | null>(null);

  // Asymmetric Co-op BroadcastChannel('nordicspace_ikea_sync')
  const senderIdRef = useRef(`peer_${Math.random().toString(36).slice(2, 9)}`);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const suppressBroadcastRef = useRef(false);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel('nordicspace_ikea_sync');
    channelRef.current = bc;

    bc.onmessage = (event: MessageEvent<CoopSyncMessage>) => {
      const msg = event.data;
      if (!msg || msg.senderId === senderIdRef.current) return;

      setConnectedPeersCount((c) => Math.max(1, c));

      if (msg.type === 'SYNC_STATE') {
        suppressBroadcastRef.current = true;
        setRoomConfig(msg.roomConfig);
        setPlacedFurniture(msg.placedFurniture);
        setSelectedInstanceId(msg.selectedInstanceId);
        window.setTimeout(() => {
          suppressBroadcastRef.current = false;
        }, 30);
      } else if (msg.type === 'VR_CURSOR_MOVE') {
        setRemoteVrCursor({
          position: msg.position,
          targetInstanceId: msg.targetInstanceId,
        });
      } else if (msg.type === 'PING_STATE_REQUEST') {
        bc.postMessage({
          type: 'SYNC_STATE',
          senderId: senderIdRef.current,
          timestamp: Date.now(),
          roomConfig,
          placedFurniture,
          selectedInstanceId,
        } satisfies CoopSyncMessage);
      }
    };

    bc.postMessage({
      type: 'PING_STATE_REQUEST',
      senderId: senderIdRef.current,
    } satisfies CoopSyncMessage);

    return () => {
      bc.close();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Broadcast state updates to any connected VR / PC Operator co-op windows
  useEffect(() => {
    if (suppressBroadcastRef.current || !channelRef.current) return;
    channelRef.current.postMessage({
      type: 'SYNC_STATE',
      senderId: senderIdRef.current,
      timestamp: Date.now(),
      roomConfig,
      placedFurniture,
      selectedInstanceId,
    } satisfies CoopSyncMessage);
  }, [roomConfig, placedFurniture, selectedInstanceId]);

  const handleBroadcastVrCursor = useCallback(
    (position: [number, number, number], targetInstanceId: string | null) => {
      channelRef.current?.postMessage({
        type: 'VR_CURSOR_MOVE',
        senderId: senderIdRef.current,
        position,
        targetInstanceId,
      } satisfies CoopSyncMessage);
    },
    []
  );

  // Filtered catalog items
  const filteredCatalog = useMemo(
    () => filterCatalog(catalog, selectedCategory, searchQuery),
    [catalog, selectedCategory, searchQuery]
  );

  // Live BOM / Shopping Cart calculation
  const bomSummary = useMemo(() => calculateBomSummary(placedFurniture), [placedFurniture]);

  const selectedFurniture = useMemo(
    () => placedFurniture.find((item) => item.instanceId === selectedInstanceId) || null,
    [placedFurniture, selectedInstanceId]
  );

  // Live IKEA Web Search / URL Scraper via Backend Gemini API
  const handleTriggerLiveSearch = async (queryOrUrl: string) => {
    const trimmed = queryOrUrl.trim();
    if (!trimmed) return;
    setIsSearchingLive(true);
    setLiveSearchStatus('Fetching IKEA specs via Gemini AI...');

    try {
      const response = await fetch('/api/ikea/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        products: IkeaProduct[];
        source?: string;
      };

      if (Array.isArray(data.products) && data.products.length > 0) {
        const qLower = trimmed.toLowerCase();
        setCatalog((prev) => {
          const existingMap = new Map(prev.map((p) => [p.id, p]));
          const newItems: IkeaProduct[] = [];

          for (const prod of data.products) {
            const existing = existingMap.get(prod.id);
            if (existing) {
              existingMap.set(prod.id, {
                ...existing,
                matchedQueries: Array.from(new Set([...(existing.matchedQueries || []), qLower])),
              });
            } else {
              newItems.push({
                ...prod,
                isCustomScraped: true,
                sourceUrl: /^https?:\/\//i.test(trimmed) ? trimmed : prod.sourceUrl,
                matchedQueries: [qLower],
              });
            }
          }
          return [...newItems, ...Array.from(existingMap.values())];
        });
        setSelectedCategory('All');
        setLiveSearchStatus(
          `Found ${data.products.length} IKEA item(s) (${data.source === 'jina_gemini' ? 'Live URL Scraped' : 'Gemini IKEA Catalog'})`
        );
      } else {
        setLiveSearchStatus('No additional products returned.');
      }
    } catch {
      setLiveSearchStatus('Showing matched catalog items.');
    } finally {
      setIsSearchingLive(false);
    }
  };

  // Spawn 3D Furniture into Room (with Wireframe Bounding-Box Placeholder -> Shadowed 3D Mesh)
  const handleSpawnFurniture = useCallback(
    async (
      product: IkeaProduct,
      swatchIndex: number = 0,
      useGeminiSynthesis: boolean = false,
      onProgress?: (pct: number) => void
    ) => {
      const swatch = product.swatches[swatchIndex] || product.swatches[0];
      const instanceId = `ikea_${product.id}_${Date.now()}`;

      // Compute a non-overlapping floor spawn position near room center
      const offsetIdx = placedFurniture.length % 5;
      const rawSpawn: [number, number, number] = [
        (offsetIdx - 2) * 0.35,
        0,
        ((placedFurniture.length % 3) - 1) * 0.35,
      ];

      const initialSpec = buildParametric3DSpec(product, swatch.hex);
      const spawnPos = clampToRoomBounds(
        rawSpawn,
        {
          width: initialSpec.overallDimensionsMeters.width,
          depth: initialSpec.overallDimensionsMeters.depth,
        },
        0,
        roomConfig.width,
        roomConfig.length
      );

      // 1. Insert glowing wireframe bounding-box placeholder first
      const placeholderItem: PlacedFurniture = {
        instanceId,
        productId: product.id,
        product,
        position: spawnPos,
        rotationY: 0,
        scale: 1.0,
        selectedColorHex: swatch.hex,
        selectedSwatchName: swatch.name,
        spec3D: initialSpec,
        isGenerating: true,
        generationProgress: 10,
        showVrPriceTag: cameraMode === 'vr_walkthrough',
      };

      setPlacedFurniture((prev) => [...prev, placeholderItem]);
      setSelectedInstanceId(instanceId);

      // 2. If Gemini AI synthesis is requested (or custom scraped item), fetch CAD decomposition in parallel with progress animation
      const totalDurationMs = useGeminiSynthesis ? 2600 : 550;
      const steps = 10;
      const intervalMs = totalDurationMs / steps;

      let synthesizedSpec: Furniture3DSpec = initialSpec;

      const aiPromise = useGeminiSynthesis
        ? fetch('/api/ikea/generate-3d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product,
              selectedColorHex: swatch.hex,
              selectedSwatchName: swatch.name,
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((res) => {
              if (res?.spec3D?.parts?.length >= 6) {
                synthesizedSpec = res.spec3D;
              }
            })
            .catch(() => {
              // Keep high-detail parametric spec on network error
            })
        : Promise.resolve();

      for (let s = 1; s <= steps; s++) {
        await new Promise((r) => setTimeout(r, intervalMs));
        const pct = Math.min(98, Math.round((s / steps) * 100));
        onProgress?.(pct);
      }

      await aiPromise;
      onProgress?.(100);

      // 3. Pop the shadowed multi-part 3D model into place!
      setPlacedFurniture((prev) =>
        prev.map((item) =>
          item.instanceId === instanceId
            ? {
                ...item,
                spec3D: synthesizedSpec,
                isGenerating: false,
                generationProgress: 100,
              }
            : item
        )
      );
    },
    [placedFurniture.length, roomConfig.width, roomConfig.length, cameraMode]
  );

  // Move / Rotate Furniture handler
  const handleMoveFurniture = useCallback(
    (instanceId: string, newPosition: [number, number, number], newRotationY?: number) => {
      setPlacedFurniture((prev) =>
        prev.map((item) =>
          item.instanceId === instanceId
            ? {
                ...item,
                position: newPosition,
                rotationY: newRotationY !== undefined ? newRotationY : item.rotationY,
              }
            : item
        )
      );
    },
    []
  );

  // Toggle 3D VR Price Tag above furniture
  const handleToggleVrPriceTag = useCallback((instanceId: string) => {
    setPlacedFurniture((prev) =>
      prev.map((item) =>
        item.instanceId === instanceId
          ? { ...item, showVrPriceTag: !item.showVrPriceTag }
          : item
      )
    );
  }, []);

  const handleShowAllVrPriceTags = useCallback((visible: boolean) => {
    setPlacedFurniture((prev) =>
      prev.map((item) => ({ ...item, showVrPriceTag: visible }))
    );
  }, []);

  // Rotate selected furniture by delta radians
  const handleRotateSelected = (deltaRad: number) => {
    if (!selectedInstanceId) return;
    setPlacedFurniture((prev) =>
      prev.map((item) =>
        item.instanceId === selectedInstanceId
          ? { ...item, rotationY: item.rotationY + deltaRad }
          : item
      )
    );
  };

  // Scale selected furniture
  const handleScaleSelected = (deltaScale: number) => {
    if (!selectedInstanceId) return;
    setPlacedFurniture((prev) =>
      prev.map((item) =>
        item.instanceId === selectedInstanceId
          ? {
              ...item,
              scale: Number(Math.max(0.6, Math.min(1.6, item.scale + deltaScale)).toFixed(2)),
            }
          : item
      )
    );
  };

  // Recolor selected furniture
  const handleRecolorSelected = (colorHex: string, swatchName: string) => {
    if (!selectedInstanceId) return;
    setPlacedFurniture((prev) =>
      prev.map((item) =>
        item.instanceId === selectedInstanceId
          ? {
              ...item,
              selectedColorHex: colorHex,
              selectedSwatchName: swatchName,
            }
          : item
      )
    );
  };

  // Duplicate selected furniture
  const handleDuplicateSelected = () => {
    if (!selectedFurniture) return;
    const newId = `ikea_dup_${Date.now()}`;
    const newPos = clampToRoomBounds(
      [selectedFurniture.position[0] + 0.45, 0, selectedFurniture.position[2] + 0.45],
      {
        width: selectedFurniture.spec3D.overallDimensionsMeters.width * selectedFurniture.scale,
        depth: selectedFurniture.spec3D.overallDimensionsMeters.depth * selectedFurniture.scale,
      },
      selectedFurniture.rotationY,
      roomConfig.width,
      roomConfig.length
    );
    const copy: PlacedFurniture = {
      ...selectedFurniture,
      instanceId: newId,
      position: newPos,
    };
    setPlacedFurniture((prev) => [...prev, copy]);
    setSelectedInstanceId(newId);
  };

  // Delete selected furniture
  const handleDeleteInstance = (instanceId: string) => {
    setPlacedFurniture((prev) => prev.filter((item) => item.instanceId !== instanceId));
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#F5F5F5] text-[#111111] overflow-hidden select-none">
      {/* ====================================================================
          TOP NAVIGATION BAR (Strict 3-Zone Contract: Brand — 4 Nav Links — 1 Primary Action)
         ==================================================================== */}
      <header className="h-14 px-6 bg-white border-b border-[#E5E5E5] flex items-center justify-between gap-8 shrink-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setIsLeftDrawerOpen(true);
          }}
          className="text-base font-extrabold tracking-tight text-[#0058A3] whitespace-nowrap shrink-0"
        >
          IKEA KREATIV STUDIO
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav aria-label="Primary Workspace Navigation" className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#484848]">
          <button
            type="button"
            onClick={() => {
              setLeftTab('catalog');
              setIsLeftDrawerOpen(true);
            }}
            className={`hover:text-[#111111] transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
              isLeftDrawerOpen && leftTab === 'catalog'
                ? 'border-[#0058A3] text-[#111111]'
                : 'border-transparent'
            }`}
          >
            Webstore Catalog
          </button>
          <button
            type="button"
            onClick={() => {
              setLeftTab('architecture');
              setIsLeftDrawerOpen(true);
            }}
            className={`hover:text-[#111111] transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
              isLeftDrawerOpen && leftTab === 'architecture'
                ? 'border-[#0058A3] text-[#111111]'
                : 'border-transparent'
            }`}
          >
            Room &amp; Finishes
          </button>
          <button
            type="button"
            onClick={() => setCameraMode((m) => (m === 'floorplan2d' ? 'orbit3d' : 'floorplan2d'))}
            className={`hover:text-[#111111] transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
              cameraMode === 'floorplan2d'
                ? 'border-[#0058A3] text-[#111111]'
                : 'border-transparent'
            }`}
          >
            2D Floorplan
          </button>
          <button
            type="button"
            onClick={() => setIsCoopModalOpen(true)}
            className={`hover:text-[#111111] transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
              cameraMode === 'vr_walkthrough'
                ? 'border-[#0058A3] text-[#111111]'
                : 'border-transparent'
            }`}
          >
            VR &amp; Co-op Mode
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action (Room Shopping Bag & Live Total Budget Counter) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            data-testid="open-bom-drawer-btn"
            onClick={() => setIsBomDrawerOpen(true)}
            className="px-4 py-2 bg-[#0058A3] hover:bg-[#004F93] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#FFDB00]" />
            <span>
              Room Bag ({bomSummary.totalCount}) · {formatCZK(bomSummary.totalPriceCZK)}
            </span>
          </button>
        </div>
      </header>

      {/* ====================================================================
          MAIN STUDIO SPLIT WORKSPACE (Left Collapsible Drawer + Full-Bleed 3D Viewport)
         ==================================================================== */}
      <main className="flex-1 flex relative overflow-hidden">
        {/* Left Collapsible IKEA Webstore & Room Architecture Drawer */}
        <aside
          aria-label="IKEA Webstore and Architecture Customizer"
          className={`bg-white border-r border-[#E5E5E5] flex flex-col shrink-0 transition-all duration-200 z-20 ${
            isLeftDrawerOpen ? 'w-[380px] sm:w-[410px]' : 'w-0 overflow-hidden border-r-0'
          }`}
        >
          {/* Drawer Mode Switcher (IKEA Catalog vs. Room Architecture) */}
          <div className="p-2.5 bg-[#F5F5F5] border-b border-[#E5E5E5] grid grid-cols-2 gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setLeftTab('catalog')}
              className={`py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                leftTab === 'catalog'
                  ? 'bg-white text-[#0058A3] shadow-xs'
                  : 'text-[#484848] hover:text-[#111111]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>IKEA Store ({catalog.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('architecture')}
              className={`py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                leftTab === 'architecture'
                  ? 'bg-white text-[#0058A3] shadow-xs'
                  : 'text-[#484848] hover:text-[#111111]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Room &amp; Finishes</span>
            </button>
          </div>

          {/* Active Drawer Body */}
          <div className="flex-1 min-h-0">
            {leftTab === 'catalog' ? (
              <CatalogPanel
                catalog={filteredCatalog}
                selectedCategory={selectedCategory}
                searchQuery={searchQuery}
                isSearchingLive={isSearchingLive}
                liveSearchStatus={liveSearchStatus}
                onSelectCategory={setSelectedCategory}
                onSearchChange={setSearchQuery}
                onTriggerLiveSearch={handleTriggerLiveSearch}
                onOpenProductDetail={(prod) => setDetailModalProduct(prod)}
                onQuickInsertProduct={(prod, swIdx) =>
                  handleSpawnFurniture(prod, swIdx ?? 0, Boolean(prod.isCustomScraped))
                }
              />
            ) : (
              <ArchitecturePanel
                roomConfig={roomConfig}
                onUpdateRoomConfig={setRoomConfig}
              />
            )}
          </div>
        </aside>

        {/* Collapse / Expand Left Drawer Tab Handle */}
        <button
          type="button"
          onClick={() => setIsLeftDrawerOpen((v) => !v)}
          aria-label={isLeftDrawerOpen ? 'Collapse catalog drawer' : 'Expand catalog drawer'}
          className="absolute top-4 z-20 bg-white border border-[#E5E5E5] hover:border-[#111111] text-[#111111] p-1.5 rounded-r-md shadow-xs transition-all cursor-pointer"
          style={{ left: isLeftDrawerOpen ? undefined : 0 }}
        >
          {isLeftDrawerOpen ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Central 3D Configurator Viewport (100% Unobstructed Center) */}
        <div className="flex-1 h-full relative bg-[#ECEAE4]">
          <StudioViewport
            roomConfig={roomConfig}
            placedFurniture={placedFurniture}
            selectedInstanceId={selectedInstanceId}
            cameraMode={cameraMode}
            gridSnap={gridSnap}
            vrSessionRequestCounter={vrSessionRequestCounter}
            vrModeType={vrModeType}
            remoteVrCursor={remoteVrCursor}
            onSelectFurniture={setSelectedInstanceId}
            onMoveFurniture={handleMoveFurniture}
            onToggleVrPriceTag={handleToggleVrPriceTag}
            onBroadcastVrCursor={handleBroadcastVrCursor}
            onWebXrStatusChange={setWebXrStatus}
          />

          {/* Minimal Top-Left Spec Readout Badge inside Viewport */}
          <div className="absolute top-4 left-12 z-10 bg-white/95 border border-[#E5E5E5] rounded-lg px-3.5 py-2 shadow-xs pointer-events-none flex items-center gap-3 text-xs">
            <span className="font-bold text-[#111111]">
              {roomConfig.width.toFixed(1)}m × {roomConfig.length.toFixed(1)}m Room
            </span>
            <span aria-hidden="true" className="text-[#CCCCCC]">·</span>
            <span className="text-[#484848]">{roomConfig.floorFinish}</span>
            <span aria-hidden="true" className="text-[#CCCCCC]">·</span>
            <span className="text-[#0058A3] font-semibold">
              {cameraMode === 'orbit3d'
                ? '3D Orbit Studio'
                : cameraMode === 'floorplan2d'
                ? '2D Blueprint View'
                : '1:1 VR Walkthrough (1.65m)'}
            </span>
          </div>

          {/* ====================================================================
              UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK (No backdrop-filter over WebGL)
             ==================================================================== */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[min(920px,95vw)] w-full flex flex-col items-center pointer-events-none">
            {/* Collapse / Expand Toggle Handle */}
            <button
              type="button"
              onClick={() => setIsBottomDockCollapsed((v) => !v)}
              className="pointer-events-auto px-3 py-1 bg-white border border-b-0 border-[#E5E5E5] rounded-t-md text-[11px] font-semibold text-[#484848] hover:text-[#111111] flex items-center gap-1 shadow-xs cursor-pointer"
            >
              {isBottomDockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Show Studio Controls</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Hide Controls</span>
                </>
              )}
            </button>

            {!isBottomDockCollapsed && (
              <div className="pointer-events-auto w-full bg-white border border-[#E5E5E5] rounded-xl shadow-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                {/* Left Group: Camera Modes & Grid Snap */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-[#F5F5F5] p-1 rounded-lg border border-[#E5E5E5]">
                    <button
                      type="button"
                      onClick={() => setCameraMode('orbit3d')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        cameraMode === 'orbit3d'
                          ? 'bg-[#0058A3] text-white'
                          : 'text-[#484848] hover:text-[#111111]'
                      }`}
                    >
                      3D Orbit
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraMode('floorplan2d')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        cameraMode === 'floorplan2d'
                          ? 'bg-[#0058A3] text-white'
                          : 'text-[#484848] hover:text-[#111111]'
                      }`}
                    >
                      2D Floorplan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraMode('vr_walkthrough');
                        handleShowAllVrPriceTags(true);
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                        cameraMode === 'vr_walkthrough'
                          ? 'bg-[#0058A3] text-white'
                          : 'text-[#484848] hover:text-[#111111]'
                      }`}
                    >
                      <Glasses className="w-3.5 h-3.5" />
                      <span>1:1 VR (1.65m)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGridSnap((g) => !g)}
                    aria-pressed={gridSnap}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      gridSnap
                        ? 'bg-[#F0F6FC] border-[#0058A3] text-[#0058A3]'
                        : 'bg-white border-[#E5E5E5] text-[#484848] hover:text-[#111111]'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>Snap 25cm</span>
                  </button>
                </div>

                {/* Right Group: Active Furniture Inspector & Transform Gizmo Actions */}
                {selectedFurniture ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="pr-2 border-r border-[#E5E5E5]">
                      <div className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                        <span>{selectedFurniture.product.name}</span>
                        <span className="text-[11px] font-mono-num text-[#0058A3]">
                          {formatCZK(selectedFurniture.product.priceCZK)}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#484848] font-mono-num">
                        {selectedFurniture.product.dimensionsCm.width}×
                        {selectedFurniture.product.dimensionsCm.depth}×
                        {selectedFurniture.product.dimensionsCm.height} cm
                      </div>
                    </div>

                    {/* Swatch Quick Recolor */}
                    <div className="flex items-center gap-1" role="group" aria-label="Selected item color swatches">
                      {selectedFurniture.product.swatches.map((sw) => (
                        <button
                          key={sw.name}
                          type="button"
                          title={`Recolor to ${sw.name}`}
                          aria-label={`Recolor to ${sw.name}`}
                          onClick={() => handleRecolorSelected(sw.hex, sw.name)}
                          className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                            selectedFurniture.selectedColorHex.toLowerCase() ===
                            sw.hex.toLowerCase()
                              ? 'border-[#0058A3] ring-1 ring-[#0058A3] scale-110'
                              : 'border-[#CCCCCC]'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      ))}
                    </div>

                    {/* Rotate -45 / +45 */}
                    <button
                      type="button"
                      onClick={() => handleRotateSelected(-Math.PI / 4)}
                      title="Rotate -45°"
                      aria-label="Rotate left 45 degrees"
                      className="p-1.5 bg-[#F5F5F5] hover:bg-[#E5E5E5] text-[#111111] rounded-md transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRotateSelected(Math.PI / 4)}
                      title="Rotate +45°"
                      aria-label="Rotate right 45 degrees"
                      className="p-1.5 bg-[#F5F5F5] hover:bg-[#E5E5E5] text-[#111111] rounded-md transition-colors cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    {/* Scale - / + */}
                    <button
                      type="button"
                      onClick={() => handleScaleSelected(-0.1)}
                      title="Scale Down"
                      aria-label="Scale furniture down"
                      className="p-1.5 bg-[#F5F5F5] hover:bg-[#E5E5E5] text-[#111111] rounded-md transition-colors cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScaleSelected(0.1)}
                      title="Scale Up"
                      aria-label="Scale furniture up"
                      className="p-1.5 bg-[#F5F5F5] hover:bg-[#E5E5E5] text-[#111111] rounded-md transition-colors cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>

                    {/* Toggle 3D VR Price Tag */}
                    <button
                      type="button"
                      onClick={() => handleToggleVrPriceTag(selectedFurniture.instanceId)}
                      title="Toggle Floating 3D IKEA Price Tag"
                      aria-label="Toggle 3D Price Tag"
                      className={`px-2 py-1 text-xs font-semibold rounded-md border transition-colors flex items-center gap-1 cursor-pointer ${
                        selectedFurniture.showVrPriceTag
                          ? 'bg-[#FFDB00] border-[#E0C000] text-[#111111]'
                          : 'bg-[#F5F5F5] border-[#E5E5E5] text-[#111111] hover:bg-[#E5E5E5]'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>3D Tag</span>
                    </button>

                    {/* Duplicate */}
                    <button
                      type="button"
                      onClick={handleDuplicateSelected}
                      title="Duplicate Item"
                      aria-label="Duplicate selected furniture"
                      className="p-1.5 bg-[#F5F5F5] hover:bg-[#E5E5E5] text-[#111111] rounded-md transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDeleteInstance(selectedFurniture.instanceId)}
                      title="Remove from Room"
                      aria-label="Delete selected furniture"
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-[#484848] flex items-center gap-2">
                    <span>
                      Click any 3D furniture in the room to move, rotate, recolor, or double-click for its 3D IKEA Price Tag.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ====================================================================
          MODALS & SLIDE-OVER DRAWERS
         ==================================================================== */}
      <ProductDetailModal
        product={detailModalProduct}
        onClose={() => setDetailModalProduct(null)}
        onInsertIntoRoom={handleSpawnFurniture}
      />

      <BomDrawer
        isOpen={isBomDrawerOpen}
        bomSummary={bomSummary}
        onClose={() => setIsBomDrawerOpen(false)}
        onIncrementItem={(prod, hex) => {
          const swIdx = Math.max(
            0,
            prod.swatches.findIndex((s) => s.hex.toLowerCase() === hex.toLowerCase())
          );
          handleSpawnFurniture(prod, swIdx, false);
        }}
        onDecrementItem={handleDeleteInstance}
        onSelectInstance={(id) => setSelectedInstanceId(id)}
        onClearRoom={() => {
          setPlacedFurniture([]);
          setSelectedInstanceId(null);
        }}
      />

      <CoopModal
        isOpen={isCoopModalOpen}
        cameraMode={cameraMode}
        connectedPeersCount={connectedPeersCount}
        webXrStatus={webXrStatus}
        onClose={() => setIsCoopModalOpen(false)}
        onSelectCameraMode={setCameraMode}
        onStartHardwareWebXr={(mode) => {
          setVrModeType(mode);
          setVrSessionRequestCounter((c) => c + 1);
        }}
        onShowAllVrPriceTags={handleShowAllVrPriceTags}
      />
    </div>
  );
}
