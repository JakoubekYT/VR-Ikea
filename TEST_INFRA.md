# Test Infrastructure Specification (`TEST_INFRA.md`)

This document specifies the architecture, environment, harness utilities, test suites, and execution instructions for the comprehensive 4-tier opaque-box E2E test suite of the IKEA Space Planner (`VR-Ikea`).

---

## 1. Test Architecture & Design Principles

The IKEA Space Planner test infrastructure is built around four fundamental engineering principles:

1. **Opaque-Box Requirement-Driven Testing**: Tests exercise the application strictly against domain contracts defined in `PROJECT.md` and user requirements in `ORIGINAL_REQUEST.md`. Internal private methods are not called directly; public geometric, mathematical, and architectural contracts are validated end-to-end.
2. **Deterministic Headless Execution**: Zero reliance on physical browser binaries, Chromium, or GPU hardware. All Three.js geometry generation, oriented bounding box (OBB) Separating Axis Theorem (SAT) collision math, Bill of Materials (BOM) financial calculations, and WebXR locomotion vectors execute deterministically in Node.js in < 4 seconds for the entire suite.
3. **Resilience & Offline Guarantee**: Validates that the application functions seamlessly even with zero Gemini API quota or complete network disconnection, verifying the 4-tier model cascade and deterministic parametric CAD synthesis fallback.
4. **Progressive 4-Tier Stratification**:
   - **Tier 1 (Core Feature Happy Paths)**: 48 tests (6 per feature across all 8 features).
   - **Tier 2 (Boundary & Corner Cases)**: 48 tests (6 per feature covering zero, negative, maximum, injection, and corrupted states).
   - **Tier 3 (Cross-Feature Pairwise Combinations)**: 12 tests validating multi-feature systemic integration.
   - **Tier 4 (Real-World Apartment Workloads)**: 5 realistic full-apartment architectural design scenarios (32 m² studio to 110 m² 5-room penthouse).

---

## 2. Directory Layout

All test harness files and test suites reside cleanly under the `tests/` directory:

```
tests/
├── harness/
│   ├── index.ts                # Master export facade
│   ├── headlessShim.ts         # Headless DOM, Canvas, Window, and localStorage polyfills
│   ├── mockWebXR.ts            # Simulated WebXR sessions, gamepads, thumbsticks, and haptics
│   ├── testFactory.ts          # Fixtures for rooms, products, placed items, chandeliers, export JSON
│   └── assertions.ts           # Domain assertions: CAD part counts, SAT bounds, BOM math, RFC CSV
└── e2e/
    ├── tier1-features/
    │   ├── 01-cad-synthesis.test.ts        # 6 tests: 20-40 sub-parts, meter scaling, all archetypes
    │   ├── 02-fallback-engine.test.ts      # 6 tests: offline search, 4-tier cascade, localStorage hit
    │   ├── 03-room-geometry.test.ts        # 6 tests: CSG-free wall slicing, window sills, cutaways, room lookup
    │   ├── 04-catalog-search.test.ts       # 6 tests: Czech diacritics, English synonyms, typos, categories
    │   ├── 05-bom-export.test.ts           # 6 tests: item grouping, chandeliers, dual currency, CSV, JSON
    │   ├── 06-spatial-physics.test.ts      # 6 tests: 5cm grid snap, wall magnet snap, stacking, OBB SAT
    │   ├── 07-webxr-walkthrough.test.ts    # 6 tests: HMD heading locomotion, 45° snap turn, teleport arc, haptics
    │   └── 08-ui-persistence.test.ts       # 6 tests: window manager, dark mode, save/load JSON roundtrip
    ├── tier2-boundaries/
    │   ├── 01-cad-boundaries.test.ts       # 6 tests: 0cm dimensions, 1km scale, missing swatches, unknown archetype
    │   ├── 02-fallback-boundaries.test.ts  # 6 tests: whitespace query, 5000-char injection, invalid URL, timeout
    │   ├── 03-room-boundaries.test.ts      # 6 tests: 0 openings, touching openings, oversized window, out-of-bounds
    │   ├── 04-search-boundaries.test.ts    # 6 tests: empty query, gibberish, regex meta-chars, mixed diacritics
    │   ├── 05-bom-boundaries.test.ts       # 6 tests: 0 items, 100+ items, 0 Kč price, RFC-4180 quote escaping
    │   ├── 06-physics-boundaries.test.ts   # 6 tests: snap disabled, item larger than room, 1000m drop, 33° angle
    │   ├── 07-webxr-boundaries.test.ts     # 6 tests: deadzone <= 0.15, upward teleport, outside floor, disconnect
    │   └── 08-persistence-boundaries.test.ts # 6 tests: malformed JSON, missing arrays, legacy schema, offscreen window
    ├── tier3-pairwise/
    │   └── pairwise-interactions.test.ts   # 12 tests: cross-feature pairwise interactions across all 8 features
    └── tier4-scenarios/
        ├── 01-studio-apartment.test.ts        # 32 m² Compact Nordic Studio (7 furniture + 1 chandelier)
        ├── 02-family-two-bedroom.test.ts      # 78 m² 2-Bedroom Family Flat (15 furniture + 3 chandeliers)
        ├── 03-home-office-suite.test.ts       # 45 m² Home Office & Library (10 furniture + 2 chandeliers)
        ├── 04-kitchen-dining-openplan.test.ts # 65 m² Open-Concept Culinary & Lounge (12 furniture + 2 chandeliers)
        └── 05-full-penthouse-walkthrough.test.ts # 110 m² 5-Room Luxury Penthouse (22 furniture + 5 chandeliers)
```

---

## 3. Headless Three.js Execution Strategy

Three.js procedural textures (`src/three/proceduralTextures.ts`), badge sprites (`src/three/roomArchitectureBuilder.ts`), and dimension overlays (`src/three/dimensionOverlay.ts`) invoke HTML5 Canvas 2D contexts (`document.createElement('canvas')`).

`tests/harness/headlessShim.ts` provides a high-fidelity in-memory canvas simulation:
- Implements `CanvasRenderingContext2D` paths: `beginPath`, `moveTo`, `lineTo`, `bezierCurveTo`, `quadraticCurveTo`, `arc`, `roundRect`, `stroke`, `fill`.
- Implements text measurement (`measureText`), gradient factories, image data buffers, and line dash utilities.
- Implements `MemoryLocalStorage` backing `globalThis.localStorage` and `globalThis.window.localStorage`.
- Automatically executes upon module import, enabling pure Node.js execution without external browser dependencies.

---

## 4. WebXR Simulation Architecture

Physical WebXR hardware (Meta Quest 2/3/Pro headsets and Touch controllers) is emulated via `tests/harness/mockWebXR.ts`:
- **Session Lifecycle**: Implements `MockXRSystem` and `MockXRSession` handling feature queries (`local-floor`, `bounded-floor`, `hand-tracking`).
- **Locomotion Math**: Implements `calculateHeadingRelativeLocomotion(stickX, stickZ, hmdYawRad)` which rotates thumbstick inputs by HMD gaze yaw with a 0.15 deadzone.
- **Discrete Snap-Turning**: Implements `calculateSnapTurn(currentYaw, stickX, latch)` executing exact 45° (`Math.PI / 4`) increments with recenter latching.
- **Parabolic Teleportation**: Implements `calculateParabolicTeleportArc(origin, direction, velocity, gravity)` tracing ballistic projectile points and calculating ground plane intersections (`y = 0`).
- **Haptic Actuators**: Records intensity, duration, and timestamp for all controller vibration pulses.

---

## 5. Domain Assertion Helpers

Located in `tests/harness/assertions.ts`:
- `assertCADPartCount(spec, min = 20, max = 40)`: Asserts valid sub-part bounds, non-NaN sizes, and positive volume.
- `assertCADDimensionsMatchProduct(spec, product, tolerance = 0.05)`: Verifies cm to meter dimension accuracy.
- `assertWithinRoom(pos, dimsCm, room, tolerance)`: Asserts furniture center remains within interior room bounding box.
- `assertCollision(itemA, itemB)` / `assertNoCollision(itemA, itemB)`: Evaluates 2D/3D Separating Axis Theorem overlap.
- `assertStacked(child, parent, tolerance)`: Verifies vertical surface elevation matching parent height.
- `assertBomMath(summary)`: Sums lines to verify `totalItems`, `totalCzk`, and `totalEur`.
- `assertValidCsv(csvContent, minLines)`: Validates RFC-4180 CSV syntax, column balance, and escaping.
- `assertValidJson<T>(jsonStr)`: Validates JSON syntax and returns parsed object.

---

## 6. Execution Commands & CI/CD Scripts

### Run E2E Test Suite (All 4 Tiers)
```bash
npm test
# Equivalent to: npx tsx --test 'tests/e2e/**/*.test.ts'
```

### Run All Tests (Unit + E2E)
```bash
npm run test:all
# Equivalent to: npx tsx --test src/utils/roomLogic.test.ts 'tests/e2e/**/*.test.ts'
```

### Run Specific Tiers
```bash
# Tier 1: Core Feature Coverage
npx tsx --test 'tests/e2e/tier1-features/*.test.ts'

# Tier 2: Boundary & Corner Cases
npx tsx --test 'tests/e2e/tier2-boundaries/*.test.ts'

# Tier 3: Pairwise Cross-Feature Interactions
npx tsx --test tests/e2e/tier3-pairwise/pairwise-interactions.test.ts

# Tier 4: Real-World Apartment Scenarios
npx tsx --test 'tests/e2e/tier4-scenarios/*.test.ts'
```

### Static Type Check & Lint
```bash
npm run lint
# Equivalent to: tsc --noEmit
```

---

## 7. Quality Gates & Thresholds

| Metric | Required Threshold | Current Suite Status | Gate |
|--------|:------------------:|:--------------------:|:----:|
| **Tier 1 Tests** | ≥40 tests (≥5/feature) | **48 tests** | PASS |
| **Tier 2 Tests** | ≥40 tests (≥5/feature) | **48 tests** | PASS |
| **Tier 3 Tests** | ≥10 pairwise tests | **12 tests** | PASS |
| **Tier 4 Scenarios** | ≥5 complete apartments | **5 scenarios** | PASS |
| **Total Test Count** | ≥95 tests | **113 tests** | PASS |
| **Pass Rate** | 100% (0 failures) | **100% (113/113)** | PASS |
| **Execution Time** | < 15.0 seconds | **~3.5 seconds** | PASS |
| **TypeScript Errors** | 0 errors (`tsc --noEmit`) | **0 errors** | PASS |
