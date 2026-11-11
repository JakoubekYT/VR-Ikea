# Test Suite Readiness Report (`TEST_READY.md`)

**Date**: 2026-11-11  
**Project**: IKEA Space Planner (`VR-Ikea`)  
**Track**: E2E Testing Track  
**Runner**: Node.js v24.22.2 / `tsx` v4.23.15 built-in test runner (`node:test` + `node:assert/strict`)  
**Status**: **100% PASS (113/113 E2E Tests Passing, Exit Code 0)**  

---

## 1. Executive Summary

The comprehensive 4-tier requirement-driven end-to-end (E2E) test suite for the IKEA Space Planner has been successfully designed, authored, and verified.

All tests execute completely headlessly in Node.js without requiring physical browser instances or GPU hardware. The suite rigorously verifies procedural 3D CAD synthesis, 4-tier Gemini fallback with zero-quota resilience, multi-room architectural box segmentation, bilingual Czech/English search with diacritic stripping and typo tolerance, BOM aggregation and multi-format exports (CSV/JSON), OBB Separating Axis Theorem collision and surface stacking, WebXR locomotion and snap-turning math, and full apartment JSON state persistence.

---

## 2. Test Execution & Coverage Summary

| Suite / Tier | Location | Scope & Focus | Required | Implemented | Passed | Failed | Duration | Status |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Tier 1: Feature Coverage** | `tests/e2e/tier1-features/` | Baseline happy paths across all 8 core features | ≥40 | 48 | 48 | 0 | ~1.6s | **PASS** |
| **Tier 2: Boundary & Corner Cases** | `tests/e2e/tier2-boundaries/` | Negative inputs, zero/massive dims, injections, timeouts, corrupt JSON | ≥40 | 48 | 48 | 0 | ~2.6s | **PASS** |
| **Tier 3: Pairwise Interactions** | `tests/e2e/tier3-pairwise/` | Cross-feature multi-module combinations across all 8 features | ≥10 | 12 | 12 | 0 | ~0.6s | **PASS** |
| **Tier 4: Real-World Workloads** | `tests/e2e/tier4-scenarios/` | Realistic complete apartment design workflows (32 m² to 110 m²) | ≥5 | 5 | 5 | 0 | ~0.1s | **PASS** |
| **Total E2E Test Suite** | `tests/e2e/**/*.test.ts` | Complete 4-tier end-to-end verification | **≥95** | **113** | **113** | **0** | **~3.5s** | **PASS** |
| **Full Regression (Unit + E2E)** | `src/utils/roomLogic.test.ts` + `tests/e2e/` | Complete project regression suite | - | 134 | 134 | 0 | ~3.8s | **PASS** |

---

## 3. Tier 1: Feature Coverage Breakdown (48 Tests)

- **Feature 1: Procedural 3D CAD Synthesis** (`tests/e2e/tier1-features/01-cad-synthesis.test.ts`):
  - `T1-F1-01`: Sofa 3-Seat CAD Decomposition (KIVIK) — 20–40 parts, meter scaling, cushions, fabrics.
  - `T1-F1-02`: Bed Frame CAD Decomposition (MALM) — headboard, side rails, frame sub-parts.
  - `T1-F1-03`: Storage & Shelving Decomposition (KALLAX) — outer frame, grid shelves, dividers.
  - `T1-F1-04`: Tables & Desks Decomposition (LISABO) — tabletop, 4 angled legs, aprons.
  - `T1-F1-05`: Floor Lamp CAD Decomposition with Emissive Light (HEKTAR) — cone lampshade, emissive bulb.
  - `T1-F1-06`: Three.js Geometry Construction & Mesh Group (`buildFurnitureGroup`) — rotation compass gizmo, selection bounds.
- **Feature 2: Offline / Free Fallback Engine** (`tests/e2e/tier1-features/02-fallback-engine.test.ts`):
  - `T1-F2-01`: Zero-Quota Offline Catalog Search — guaranteed 6 products with source `'fallback'` in <5ms.
  - `T1-F2-02`: Offline URL Scraper with Slug Parsing — extracts series from URL slug without external network.
  - `T1-F2-03`: Offline Photo-to-3D Reconstruction Fallback — generates 20–40 part CAD model from dimension hints.
  - `T1-F2-04`: Deterministic 3D CAD Synthesis Endpoint — HTTP 200 with parametric spec.
  - `T1-F2-05`: Gemini 4-Tier Model Cascade Recovery — seamless recovery to local parametric builder.
  - `T1-F2-06`: LocalStorage 0ms Client Cache Hit — cached 3D spec instant recall.
- **Feature 3: Multi-Room Apartment Geometry & Openings** (`tests/e2e/tier1-features/03-room-geometry.test.ts`):
  - `T1-F3-01`: Multi-Room Apartment Architecture Generation — 3 room sub-groups with walls and floor textures.
  - `T1-F3-02`: CSG-Free Window Cutouts via Box Segmentation — non-overlapping segment boxes around windows.
  - `T1-F3-03`: Door Opening with 55° Ajar Leaf and Frame — door leaf swung ajar for interior walkthroughs.
  - `T1-F3-04`: Dynamic Camera Cutaway Computation — camera-facing walls lowered, back walls full height.
  - `T1-F3-05`: Multi-Room Coordinate Containment (`findRoomForPoint`) — maps world points to rooms.
  - `T1-F3-06`: Interior Ceiling Slab Toggle — walkthrough spawns solid ceiling; orbit hides ceiling.
- **Feature 4: IKEA Catalog Search & Diacritics** (`tests/e2e/tier1-features/04-catalog-search.test.ts`):
  - `T1-F4-01`: Czech Diacritic Insensitive Matching — `"rohová sedačka"` matches corner sofas.
  - `T1-F4-02`: Diacritic Equivalence Invariance — `"křeslo"` and `"kreslo"` produce identical results.
  - `T1-F4-03`: Bilingual Czech & English Synonym Expansion — `"stůl"`, `"psací"`, `"desk"`, `"table"`.
  - `T1-F4-04`: Strict Category Scoping — category filtering isolates selected category exclusively.
  - `T1-F4-05`: Typo Tolerance via Levenshtein Distance — `"kalax"` -> KALLAX, `"sedackaa"` -> sofas.
  - `T1-F4-06`: Article Number Exact Matching — `"392.167.54"` accurately isolates FRIHETEN.
- **Feature 5: BOM Calculations & Multi-Format Export** (`tests/e2e/tier1-features/05-bom-export.test.ts`):
  - `T1-F5-01`: Duplicate Line Item Aggregation — identical products and swatches grouped with quantity.
  - `T1-F5-02`: Multi-Swatch Line Item Separation — distinct swatches produce separate line items.
  - `T1-F5-03`: Ceiling Chandelier Aggregation — ceiling fixtures aggregated into BOM.
  - `T1-F5-04`: Currency Calculation Integrity (CZK & EUR) — total sums match sum of line items.
  - `T1-F5-05`: CSV Export Formatting — RFC-4180 CSV with headers and row counts.
  - `T1-F5-06`: JSON Export Formatting — valid JSON containing totals, lines, and metadata.
- **Feature 6: Spatial Collision, Stacking & Wall Snapping** (`tests/e2e/tier1-features/06-spatial-physics.test.ts`):
  - `T1-F6-01`: 5cm Architectural Grid Snapping — coordinates snap to 0.05m increments.
  - `T1-F6-02`: Room Perimeter Clamping — items clamped inside walls minus half dimensions and wall pad.
  - `T1-F6-03`: Magnetic Wall Snapping within 0.28m Threshold — flush alignment to room perimeter.
  - `T1-F6-04`: Rotated Bounding Box Extent Calculation — 90° rotation swaps effective width/depth.
  - `T1-F6-05`: Vertical Surface Stacking on Desks/Tables — child tabletop items elevate to table surface height.
  - `T1-F6-06`: Oriented Bounding Box (OBB / SAT) Collision Detection — accurate intersection detection.
- **Feature 7: WebXR / VR Interaction & Walkthrough** (`tests/e2e/tier1-features/07-webxr-walkthrough.test.ts`):
  - `T1-F7-01`: WebXR Hardware Readiness Probe — `isSessionSupported('immersive-vr')` resolves boolean.
  - `T1-F7-02`: WebXR Session Initialization Features — requests `local-floor` and `hand-tracking`.
  - `T1-F7-03`: Heading-Relative Locomotion Math — thumbstick vectors rotated by HMD gaze yaw.
  - `T1-F7-04`: Snap-Turning on Right Controller Thumbstick — 45° discrete turning with recenter latch.
  - `T1-F7-05`: Parabolic Teleportation Arc & Floor Marker — ballistic arc calculates ground hit at y = 0.
  - `T1-F7-06`: VR Grab Orientation Preservation & Haptics — rotation preserved on grab, haptic pulse recorded.
- **Feature 8: UI/UX Layout & Project Persistence** (`tests/e2e/tier1-features/08-ui-persistence.test.ts`):
  - `T1-F8-01`: Floating Window Toggle, Drag & Resize — coordinate and dimension mutation.
  - `T1-F8-02`: Window Focus Z-Index Stacking — bring-to-front layering.
  - `T1-F8-03`: View Mode Transitions — switches between orbit, blueprint, and 1:1 walkthrough.
  - `T1-F8-04`: Lighting Preset & Dark Mode Synchronization — Cozy Evening Lamps theme synchronization.
  - `T1-F8-05`: Complete Project Layout JSON Serialization — complete apartment layout save.
  - `T1-F8-06`: Project Layout JSON Deserialization & State Restore — 100% loss-free reload.

---

## 4. Tier 2: Boundary & Corner Cases Breakdown (48 Tests)

- **CAD Boundaries** (`01-cad-boundaries.test.ts`): Zero/near-zero dimensions, 1000m scale, unknown archetype fallback, empty swatches, negative dimensions normalization, emoji & special characters in labels.
- **Fallback Boundaries** (`02-fallback-boundaries.test.ts`): Empty/whitespace query, 5,000-character injection, malformed URLs, corrupted base64 image data, empty body 400 rejection, 7,500ms timeout abort window.
- **Room Boundaries** (`03-room-boundaries.test.ts`): Solid walls with zero openings, touching/overlapping openings, oversized opening clamping, coordinates outside all rooms, empty rooms array exception, degenerate zero-size room.
- **Search Boundaries** (`04-search-boundaries.test.ts`): Empty query on category 'All', complete gibberish search string, fallback pool guarantee on gibberish, regex metacharacter injection, mixed casing & diacritic stress test, 2-letter acronym query.
- **BOM Boundaries** (`05-bom-boundaries.test.ts`): Empty inventory state, 100+ items high-volume scale, zero-price items, RFC-4180 quote escaping, extreme currency totals formatting (10M CZK), malformed item recovery.
- **Physics Boundaries** (`06-physics-boundaries.test.ts`): Snapping completely disabled, item larger than room, 1000m out-of-bounds coordinates, non-orthogonal 33° rotation, invalid stacking on non-surface items, zero-sized room.
- **WebXR Boundaries** (`07-webxr-boundaries.test.ts`): Unsupported WebXR mode rejection, thumbstick deadzone (<= 0.15) drift prevention, upward teleport arc without ground hit, teleport aiming outside apartment, mid-air furniture grab release, sudden controller disconnection.
- **Persistence Boundaries** (`08-persistence-boundaries.test.ts`): Corrupted JSON import syntax error, missing optional properties default population, legacy schema migration, floating window offscreen clamping, mobile viewport (<768px) docking, localStorage quota handling.

---

## 5. Tier 3: Pairwise Cross-Feature Interactions Breakdown (12 Tests)

- `T3-01`: Room Geometry Bounds × Wall Snapping & Auto-Rotation (F3 × F6)
- `T3-02`: Procedural 3D CAD Synthesis × Vertical Surface Stacking (F1 × F6)
- `T3-03`: Czech Diacritic Search × Procedural CAD Assembly (F4 × F1)
- `T3-04`: Offline Fallback Engine × BOM Calculation & CSV/JSON Export (F2 × F5)
- `T3-05`: Multi-Room Wall Openings × 1:1 Interior Walkthrough Mode (F3 × F7)
- `T3-06`: Spatial Collision Avoidance × Furniture Dragging Interaction (F6 × F8)
- `T3-07`: BOM Summary Aggregation × Project Save/Load JSON Persistence (F5 × F8)
- `T3-08`: Offline Image Reconstruction × Procedural CAD Assembly (F2 × F1)
- `T3-09`: Multi-Room Relocation × Room-Partitioned BOM Summary (F3 × F5)
- `T3-10`: WebXR Thumbstick Locomotion × Room Wall Collision Boundaries (F7 × F3)
- `T3-11`: Scene Lighting Presets × Emissive Lamp Shader Synchronization (F7 × F8)
- `T3-12`: Multi-Word Typo Search × Fuzzy Matching × CAD Assembly Generation (F4 × F2 × F1)

---

## 6. Tier 4: Real-World Apartment Scenarios Breakdown (5 Scenarios)

1. **Scenario 1: Compact Nordic Studio Apartment (32 m²)** (`01-studio-apartment.test.ts`):
   - Single open-plan studio (6.4m × 5.0m × 2.7m), 3 wall openings.
   - 7 furniture items + 1 chandelier = 8 total items.
   - FADO lamp vertically stacked on MICKE study desk.
   - Dual currency BOM, RFC CSV, JSON persistence roundtrip.
2. **Scenario 2: 2-Bedroom Family Flat (78 m²)** (`02-family-two-bedroom.test.ts`):
   - 4 interconnected rooms: Living, Kitchen, Master Bed, Kids Room.
   - 15 furniture pieces + 3 ceiling chandeliers = 18 total items.
   - Point containment across all 4 rooms, room-partitioned budget.
3. **Scenario 3: Modern Home Office & Creative Studio (45 m²)** (`03-home-office-suite.test.ts`):
   - Dual-room layout: Executive Office (Acoustic Wood Slats) + Library & Lounge (Exposed Brick).
   - 10 furniture items + 2 chandeliers = 12 total items.
   - Bookcase flush to wall, Cozy Evening Lamps dark mode synchronization.
4. **Scenario 4: Open-Concept Culinary Kitchen, Dining & Lounge (65 m²)** (`04-kitchen-dining-openplan.test.ts`):
   - 65 m² open-concept space with 3 casement windows and 3.2m balcony glazing.
   - 12 furniture pieces + 2 chandeliers = 14 total items.
   - Clearance between island and utility cart, twin globe chandeliers.
5. **Scenario 5: Multi-Room Luxury Penthouse Suite (110 m², 5 Rooms)** (`05-full-penthouse-walkthrough.test.ts`):
   - 5 rooms: Grand Living, Gourmet Kitchen, Master Suite, Spa Bathroom, Gallery Hallway.
   - 22 furniture items + 5 chandeliers = 27 total items.
   - 231 pairwise collision checks, 5-room walkthrough trajectory, >70k CZK budget.

---

## 7. Instructions to Run

```bash
# 1. Run the entire 4-tier E2E test suite (113 tests)
npm test

# 2. Run both the unit test suite and E2E test suite (134 tests)
npm run test:all

# 3. Run typecheck and linting
npm run lint

# 4. Run Vite production build
npm run build
```

---

## 8. Verification & Sign-Off

- **E2E Tests Executed**: 113
- **Passed**: 113
- **Failed**: 0
- **TypeScript Errors**: 0 (`tsc --noEmit` exits with code 0)
- **Production Bundle**: Builds cleanly in < 200ms (`vite build` exits with code 0)
- **Suite Execution Time**: ~3.5 seconds
- **Verification Exit Code**: 0 (Clean)
