# Project: IKEA Space Planner (VR-Ikea)

## Architecture
The application is a high-fidelity 3D interior architecture and furniture planning platform built with React 19, TypeScript, Three.js 0.187, WebXR, and Tailwind CSS v4.

It operates on a pure decoupled 4-tier pipeline:
1. **Geometric Representation Layer (`src/types/ikea.ts`)**: Serializable JSON contracts for rooms, wall openings, furniture CAD specifications, chandeliers, and finishes.
2. **Procedural 3D Synthesis Engine (`src/utils/roomLogic.ts`, `src/server/ikeaService.ts`)**: Deterministic CAD assembly generating 20–40 chamfered sub-parts in <2ms, backed by Gemini 2.5/3 multimodal AI with automatic 4-tier model fallback and client localStorage caching.
3. **Renderer & Scene Graph (`src/three/*`)**: Pure Three.js construct functions building walls, window/door openings (CSG-free box segmentation), procedural PBR canvas textures, realistic lighting presets, and chandeliers.
4. **Interactive Viewport & Spatial Interaction Layer (`src/components/*`)**: OrbitControls, 2D blueprint orthographic view, 1:1 interior walkthrough, and full WebXR immersive VR with controller and hand-tracking support.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Procedural Silhouette Previews | Connect `ProductSilhouetteThumb` in `CatalogPanel` and detail views | M1 | Survey 2 |
| 2 | Robust URL Scraper Fallback | Integrate `parseIkeaUrl` in `ikeaService.ts` for clean metadata extraction | M1 | Survey 2 |
| 3 | Client-Side Image Downscaling | Downscale photo uploads before sending to `/api/ikea/image-to-3d` to avoid HTTP 413 | M1 | Survey 2 |
| 4 | Catalog Breadth Expansion | Add Bathroom vanities/mirrors and ergonomic Office chairs with full CAD specs | M1 | Survey 2 |
| 5 | BOM Multi-Format Export | Add CSV, JSON, and Clipboard export to `BomDrawer` | M1 | Survey 2 |
| 6 | Vertical Surface Stacking | Allow placing tabletop items (lamps, plants, books) onto tables, desks, counters | M2 | Survey 1 |
| 7 | Furniture Collision Avoidance | OBB / SAT bounds checking between placed furniture items | M2 | Survey 1 |
| 8 | Wall Alignment Auto-Rotation | Automatically align furniture rear edge to walls when snapping within threshold | M2 | Survey 1 |
| 9 | 3D Dimension Callout Lines | Render architectural CAD dimension lines with interactive distance callouts | M2 | Survey 1 |
| 10 | WebXR Heading-Relative Locomotion | Align VR joystick movement with user's HMD gaze direction | M3 | Survey 3 |
| 11 | WebXR Snap-Turning | Add 45° snap-turning on right controller thumbstick | M3 | Survey 3 |
| 12 | WebXR Teleport Arc & Ring Marker | Dynamic parabolic teleportation arc and visible ground target ring | M3 | Survey 3 |
| 13 | WebXR Grab Rotation & Haptics | Preserve orientation on grab; trigger haptic pulses on grab, snap, place | M3 | Survey 3 |
| 14 | Responsive Mobile UI Adaptation | Collapsible docked drawers and clean viewport adaptation for mobile screens | M4 | Survey 3 |
| 15 | Project Save / Load / Persistence | Export and import complete apartment layout state via JSON | M4 | Survey 3 |
| 16 | UI Dark Mode Synchronization | Synchronize floating glassmorphic panels with "Cozy Evening Lamps" scene lighting | M4 | Survey 3 |
| 17 | E2E Test Suite (Tiers 1-4) | Comprehensive test suite covering features, boundaries, pairs, and real scenarios | E2E | Dual Track |
| 18 | Adversarial Coverage Hardening | Tier 5 white-box stress testing, bug hunting, and verification | M5 | Final Milestone |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Requirement-driven test suite (Tiers 1-4), harness, TEST_READY.md | none | IN_PROGRESS |
| M1 | Catalog, Search API & Offline Fallback | Silhouettes, URL scraper, image downscale, catalog breadth, BOM export | none | IN_PROGRESS |
| M2 | 3D CAD Synthesis & Spatial Physics | Vertical stacking, collision, wall auto-rotation, 3D dimension callouts | none | IN_PROGRESS |
| M3 | WebXR / VR Immersion & Spatial Polish | Locomotion heading, snap-turn, teleport arc, grab rotation, haptics | M2 | PLANNED |
| M4 | UI/UX Polish, Mobile Ergonomics & Persistence | Mobile layout, project save/load JSON, dark mode sync | M1, M2 | PLANNED |
| M5 | Final Integration, 100% E2E Pass & Adversarial Hardening | Phase 1: 100% E2E pass; Phase 2: Tier 5 adversarial hardening | E2E, M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### M1 (Catalog) ↔ M2 / UI
- `ProductSilhouetteThumb(category: FurnitureShapeType, className?: string)`
- `IkeaProduct`: `articleNumber`, `name`, `category`, `price`, `currency`, `dimensions: { width, depth, height }`, `imageUrl?`, `spec3d?: Furniture3DSpec`
- `BomExport`: `exportToCsv(placedItems, chandeliers)`, `exportToJson(placedItems, chandeliers, rooms)`

### M2 (3D Physics) ↔ StudioViewport
- `snapFurnitureToRoom(pos, dims, room, otherItems, allowStacking)`: returns `{ pos: [x, y, z], rotationY: number, parentInstanceId?: string }`
- `checkFurnitureCollision(itemA, itemB)`: SAT overlap test returning boolean
- `buildDimensionOverlay(item: PlacedFurnitureItem)`: returns `THREE.Group` with arrows, ticks, and canvas text sprites

### M3 (WebXR) ↔ StudioViewport
- `handleXRLocomotion(session, xrRig, hmdCamera, dt)`
- `handleXRSnapTurn(gamepad, xrRig, stateRef)`
- `handleXRTeleport(controller, scene, floorMeshes)`: renders dynamic arc & moves `xrRig`
- `triggerXRHaptics(controller, durationMs, intensity)`

## Code Layout
- Exclusive File Ownership:
  - **M1**: `src/server/ikeaService.ts`, `src/data/ikeaCatalog.ts`, `src/components/CatalogPanel.tsx`, `src/components/BomDrawer.tsx`, `src/components/ProductSilhouetteThumb.tsx`
  - **M2**: `src/three/furnitureBuilder.ts`, `src/three/dimensionOverlay.ts`, `src/utils/roomLogic.ts`, `src/types/ikea.ts`
  - **M3**: `src/components/StudioViewport.tsx` (WebXR section lines 250–500, 920–980), `src/three/xrInteractions.ts`
  - **M4**: `src/App.tsx`, `src/components/FloatingWindow.tsx`, `src/components/ProjectPersistenceModal.tsx`
  - **E2E**: `tests/e2e/*`, `tests/harness/*`, `TEST_INFRA.md`, `TEST_READY.md`
