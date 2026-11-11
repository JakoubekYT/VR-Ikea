import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildParametric3DSpec,
  calculateBomSummary,
  checkFurnitureCollision,
  checkObbSat2D,
  computeWallCutaway,
  filterCatalog,
  findCollidingFurniture,
  findRoomForPoint,
  findStackingSurface,
  generateSixMatchingIkeaProducts,
  getAxisAlignedHalfExtents,
  getFurnitureDimensionsMeters,
  isPointOverFurnitureSurface,
  isRugItem,
  isSurfaceFurniture,
  isTabletopItem,
  kelvinToHex,
  snapFurnitureToRoom,
} from './roomLogic.js';
import { computeDimensionSegments, formatDimensionValue } from '../three/dimensionOverlay.js';
import { INITIAL_IKEA_CATALOG, INITIAL_APARTMENT_ROOMS, INITIAL_CHANDELIERS } from '../data/ikeaCatalog.js';
import type { PlacedFurnitureItem } from '../types/ikea.js';

describe('Multi-Room Apartment & IKEA 3D Logic Suite', () => {
  it('buildParametric3DSpec decomposes every catalog product into 20 to 40 detailed sub-parts with exact meter dimensions', () => {
    assert.ok(
      INITIAL_IKEA_CATALOG.length >= 50,
      `Expected 50+ catalog products, got ${INITIAL_IKEA_CATALOG.length}`
    );

    for (const product of INITIAL_IKEA_CATALOG) {
      const spec = buildParametric3DSpec(
        product,
        product.swatches[0].hex,
        product.swatches[0].name
      );

      assert.ok(
        spec.parts.length >= 20 && spec.parts.length <= 40,
        `Expected ${product.name} (${product.category}) to have 20..40 parts, got ${spec.parts.length}`
      );

      assert.equal(spec.overallDimensionsMeters.width, Number((product.dimensionsCm.width / 100).toFixed(3)));
      assert.equal(spec.overallDimensionsMeters.height, Number((product.dimensionsCm.height / 100).toFixed(3)));
      assert.equal(spec.overallDimensionsMeters.depth, Number((product.dimensionsCm.depth / 100).toFixed(3)));
    }
  });

  it('generateSixMatchingIkeaProducts returns 6 real matching IKEA products for Czech & English queries', () => {
    const queries = ['rohová sedačka', 'psací stůl', 'šatní skříň', 'postel', 'kallax', 'malm', 'židle', 'květina', 'váza', 'ostrůvek'];
    for (const q of queries) {
      const results = generateSixMatchingIkeaProducts(q, INITIAL_IKEA_CATALOG);
      assert.equal(results.length, 6, `Expected 6 results for "${q}", got ${results.length}`);
      for (const item of results) {
        assert.ok(item.dimensionsCm.width > 0 && item.dimensionsCm.depth > 0 && item.dimensionsCm.height > 0);
        assert.ok(item.priceCzk > 0);
        assert.ok(item.articleNumber.length >= 8);
      }
    }
  });

  it('filterCatalog supports Czech diacritics, bilingual synonyms, and typo tolerance', () => {
    const cornerSofas = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'rohová sedačka');
    assert.ok(cornerSofas.length >= 1);
    assert.ok(cornerSofas.some((p) => p.name === 'VIMLE' || p.name === 'KIVIK' || p.name === 'FRIHETEN'));

    const desks = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'psací stůl');
    assert.ok(desks.some((p) => p.name === 'BEKANT' || p.name === 'MICKE' || p.name === 'ALEX'));

    // Fuzzy typo matching
    const fuzzySofas = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'sedackaa');
    assert.ok(fuzzySofas.length >= 1);

    const fuzzyKallax = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'kalax');
    assert.ok(fuzzyKallax.some((p) => p.name === 'KALLAX'));

    const plants = filterCatalog(INITIAL_IKEA_CATALOG, 'All', 'rostlina');
    assert.ok(plants.some((p) => p.name === 'FEJKA'));
  });

  it('calculateBomSummary aggregates placed furniture and ceiling chandeliers accurately', () => {
    const kivik = INITIAL_IKEA_CATALOG[0];
    const placed: PlacedFurnitureItem[] = [
      {
        instanceId: 'inst-1',
        productId: kivik.id,
        product: kivik,
        swatchName: kivik.swatches[0].name,
        swatchHex: kivik.swatches[0].hex,
        position: [0, 0, 0],
        rotationY: 0,
        spec3D: buildParametric3DSpec(kivik, kivik.swatches[0].hex, kivik.swatches[0].name),
        roomId: 'room-living',
      },
    ];

    const summary = calculateBomSummary(placed, INITIAL_CHANDELIERS);
    const expectedCzk =
      kivik.priceCzk + INITIAL_CHANDELIERS.reduce((sum, ch) => sum + ch.catalogItem.priceCzk, 0);
    assert.equal(summary.totalCzk, expectedCzk);
    assert.equal(summary.totalItems, 1 + INITIAL_CHANDELIERS.length);
  });

  it('kelvinToHex converts warm 2700K and cool 6000K color temperatures into valid hex strings', () => {
    const warm = kelvinToHex(2700);
    const cool = kelvinToHex(6000);
    assert.match(warm, /^#[0-9a-fA-F]{6}$/);
    assert.match(cool, /^#[0-9a-fA-F]{6}$/);
    assert.notEqual(warm, cool);
  });

  it('findRoomForPoint and computeWallCutaway work across multi-room apartment layouts', () => {
    const livingRoom = findRoomForPoint(0, 0, INITIAL_APARTMENT_ROOMS);
    assert.equal(livingRoom.id, 'room-living');

    const bedroom = findRoomForPoint(-1.2, -4.3, INITIAL_APARTMENT_ROOMS);
    assert.equal(bedroom.id, 'room-bedroom');

    const cutaway = computeWallCutaway([0, 6.5, 8.5], [0, 0, 0], true);
    assert.equal(cutaway.south, true);
    assert.equal(cutaway.north, false);
  });

  it('buildParametric3DSpec rapidly constructs 20+ CAD sub-parts for custom scraped IKEA dimensions', () => {
    const customScrapedProduct: any = {
      id: 'ikea-scraped-custom',
      name: 'CUSTOM_SERIES',
      typeName: 'Skandinávský nábytek / Custom Scraped Piece',
      category: 'Storage & Shelving',
      articleNumber: '123.456.78',
      priceCzk: 3490,
      priceEur: 140,
      dimensionsCm: { width: 90, depth: 35, height: 195 },
      materialDescription: 'Solid pine with natural wax finish',
      archetype: 'billy_bookcase',
      swatches: [{ name: 'Waxed Pine', hex: '#D2B48C' }],
    };

    const spec = buildParametric3DSpec(customScrapedProduct, '#D2B48C', 'Waxed Pine');
    assert.ok(spec.parts.length >= 20);
    assert.equal(spec.overallDimensionsMeters.width, 0.9);
    assert.equal(spec.overallDimensionsMeters.height, 1.95);
    assert.equal(spec.overallDimensionsMeters.depth, 0.35);
  });

  it('snapFurnitureToRoom clamps items inside room boundaries', () => {
    const product = INITIAL_IKEA_CATALOG[0];
    const snapped = snapFurnitureToRoom([99, -2, -99], 0, product.dimensionsCm, {
      width: 5,
      length: 4,
      enableGridSnap: true,
      enableWallSnap: true,
    });
    assert.equal(snapped.position[1], 0);
    assert.ok(snapped.position[0] <= 2.5);
    assert.ok(snapped.position[2] >= -2.0);
  });

  // ==========================================================================
  // MILESTONE 2: SPATIAL PHYSICS, STACKING & COLLISION TESTS
  // ==========================================================================

  it('isTabletopItem, isSurfaceFurniture, and isRugItem correctly classify catalog products', () => {
    const fado = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FADO')!;
    const arstid = INITIAL_IKEA_CATALOG.find((p) => p.name === 'ÅRSTID')!;
    const ranarp = INITIAL_IKEA_CATALOG.find((p) => p.name === 'RANARP')!;
    const fejka = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FEJKA')!;
    const gradvis = INITIAL_IKEA_CATALOG.find((p) => p.name === 'GRADVIS')!;
    const ribba = INITIAL_IKEA_CATALOG.find((p) => p.name === 'RIBBA')!;

    // Tabletop accessories
    assert.equal(isTabletopItem(fado), true, 'FADO lamp must be tabletop');
    assert.equal(isTabletopItem(arstid), true, 'ÅRSTID lamp must be tabletop');
    assert.equal(isTabletopItem(ranarp), true, 'RANARP lamp must be tabletop');
    assert.equal(isTabletopItem(fejka), true, 'FEJKA potted plant must be tabletop');
    assert.equal(isTabletopItem(gradvis), true, 'GRADVIS vase must be tabletop');
    assert.equal(isTabletopItem(ribba), true, 'RIBBA picture frame must be tabletop');

    // Surface furniture
    const bekant = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BEKANT')!;
    const lisabo = INITIAL_IKEA_CATALOG.find((p) => p.name === 'LISABO')!;
    const lack = INITIAL_IKEA_CATALOG.find((p) => p.name === 'LACK')!;
    const besta = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BESTÅ')!;
    const hemnes = INITIAL_IKEA_CATALOG.find(
      (p) => p.name === 'HEMNES' && p.category === 'Storage & Shelving'
    )!;
    const tornviken = INITIAL_IKEA_CATALOG.find((p) => p.name === 'TORNVIKEN')!;

    assert.equal(isSurfaceFurniture(bekant), true, 'BEKANT desk must be a surface');
    assert.equal(isSurfaceFurniture(lisabo), true, 'LISABO table must be a surface');
    assert.equal(isSurfaceFurniture(lack), true, 'LACK table must be a surface');
    assert.equal(isSurfaceFurniture(besta), true, 'BESTÅ TV bench must be a surface');
    assert.equal(isSurfaceFurniture(hemnes), true, 'HEMNES low chest of drawers must be a surface');
    assert.equal(isSurfaceFurniture(tornviken), true, 'TORNVIKEN kitchen island must be a surface');

    // Non-surface tall storage or seating
    const pax = INITIAL_IKEA_CATALOG.find((p) => p.name.includes('PAX'))!;
    const billy = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BILLY')!;
    const kivik = INITIAL_IKEA_CATALOG.find((p) => p.name === 'KIVIK')!;

    assert.equal(isSurfaceFurniture(pax), false, 'PAX tall wardrobe is not a surface');
    assert.equal(isSurfaceFurniture(billy), false, 'BILLY tall bookcase is not a surface');
    assert.equal(isSurfaceFurniture(kivik), false, 'KIVIK sofa is not a tabletop surface');

    // Rugs
    const stoense = INITIAL_IKEA_CATALOG.find((p) => p.name === 'STOENSE')!;
    const lohals = INITIAL_IKEA_CATALOG.find((p) => p.name === 'LOHALS')!;
    const vindum = INITIAL_IKEA_CATALOG.find((p) => p.name === 'VINDUM')!;

    assert.equal(isRugItem(stoense), true, 'STOENSE rug must be a rug item');
    assert.equal(isRugItem(lohals), true, 'LOHALS rug must be a rug item');
    assert.equal(isRugItem(vindum), true, 'VINDUM rug must be a rug item');
    assert.equal(isRugItem(bekant), false, 'BEKANT is not a rug');
  });

  it('isPointOverFurnitureSurface tests rotated rectangular boundaries accurately', () => {
    const bekant = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BEKANT')!; // 160 x 80 x 75 cm
    const deskItem: PlacedFurnitureItem = {
      instanceId: 'desk-1',
      productId: bekant.id,
      product: bekant,
      swatchName: 'Oak',
      swatchHex: '#D2B48C',
      position: [0, 0, 0],
      rotationY: 0,
      spec3D: {
        parts: [],
        overallDimensionsMeters: { width: 1.6, depth: 0.8, height: 0.75 },
      },
      roomId: 'room-living',
    };

    // Point near center of table
    assert.equal(isPointOverFurnitureSurface(0.2, 0.1, deskItem), true);
    // Point outside along X (half-width 0.8m + 0.05 margin = 0.85m)
    assert.equal(isPointOverFurnitureSurface(1.1, 0.1, deskItem), false);
    // Point outside along Z (half-depth 0.4m + 0.05 margin = 0.45m)
    assert.equal(isPointOverFurnitureSurface(0.1, 0.6, deskItem), false);

    // Now rotate desk 90°: width aligns with Z, depth aligns with X
    const rotatedDesk: PlacedFurnitureItem = {
      ...deskItem,
      rotationY: 90,
    };
    assert.equal(isPointOverFurnitureSurface(0.1, 0.6, rotatedDesk), true, 'Along Z is within rotated width');
    assert.equal(isPointOverFurnitureSurface(0.6, 0.1, rotatedDesk), false, 'Along X is outside rotated depth');
  });

  it('findStackingSurface identifies supporting furniture and elevates tabletop items', () => {
    const bekant = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BEKANT')!; // height: 75cm = 0.75m
    const fado = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FADO')!; // 25 x 25 x 24 cm
    const deskItem: PlacedFurnitureItem = {
      instanceId: 'desk-1',
      productId: bekant.id,
      product: bekant,
      swatchName: 'Oak',
      swatchHex: '#D2B48C',
      position: [0, 0, 0],
      rotationY: 0,
      spec3D: {
        parts: [],
        overallDimensionsMeters: { width: 1.6, depth: 0.8, height: 0.75 },
      },
      roomId: 'room-living',
    };

    const surface = findStackingSurface([0.2, 0, 0.1], fado, [deskItem]);
    assert.ok(surface !== null, 'Desk must be found as supporting surface');
    assert.equal(surface.instanceId, 'desk-1');

    const expectedHeight = deskItem.position[1] + getFurnitureDimensionsMeters(deskItem).height;
    assert.equal(expectedHeight, 0.75, 'Desk top surface is at 0.75m');

    // Point placed outside desk footprint returns null
    const noSurface = findStackingSurface([2.0, 0, 2.0], fado, [deskItem]);
    assert.equal(noSurface, null);
  });

  it('Multi-tier stacking accumulates elevation across nested parent surfaces', () => {
    const bekant = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BEKANT')!;
    const fado = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FADO')!;

    const deskItem: PlacedFurnitureItem = {
      instanceId: 'desk-base',
      productId: bekant.id,
      product: bekant,
      swatchName: 'Oak',
      swatchHex: '#D2B48C',
      position: [0, 0, 0],
      rotationY: 0,
      spec3D: {
        parts: [],
        overallDimensionsMeters: { width: 1.6, depth: 0.8, height: 0.75 },
      },
      roomId: 'room-living',
    };

    // A tabletop monitor riser / desk shelf placed on top of the desk
    const riserProduct = {
      ...bekant,
      id: 'riser-shelf',
      name: 'DESK_RISER',
      category: 'Tables & Desks' as const,
      dimensionsCm: { width: 60, depth: 30, height: 15 },
    };

    const riserItem: PlacedFurnitureItem = {
      instanceId: 'riser-tier-2',
      productId: riserProduct.id,
      product: riserProduct,
      swatchName: 'Oak',
      swatchHex: '#D2B48C',
      position: [0.1, 0.75, 0], // Rests at desk top surface (y = 0.75)
      rotationY: 0,
      spec3D: {
        parts: [],
        overallDimensionsMeters: { width: 0.6, depth: 0.3, height: 0.15 },
      },
      roomId: 'room-living',
      parentInstanceId: 'desk-base',
    };

    // Place lamp on the riser: candidate at [0.1, 0, 0]
    const surface = findStackingSurface([0.1, 0, 0], fado, [deskItem, riserItem]);
    assert.ok(surface !== null);
    assert.equal(surface.instanceId, 'riser-tier-2', 'Should pick the higher riser over the lower desk');

    const topElevation = surface.position[1] + getFurnitureDimensionsMeters(surface).height;
    assert.equal(Number(topElevation.toFixed(2)), 0.90, 'Cumulative elevation: 0.75m + 0.15m = 0.90m');
  });

  it('2D/3D OBB SAT accurately detects collisions, vertical clearances, and exemptions', () => {
    const bekant = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BEKANT')!;
    const fado = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FADO')!;
    const stoense = INITIAL_IKEA_CATALOG.find((p) => p.name === 'STOENSE')!;

    const deskA: PlacedFurnitureItem = {
      instanceId: 'desk-a',
      productId: bekant.id,
      product: bekant,
      swatchName: 'Oak',
      swatchHex: '#D2B48C',
      position: [0, 0, 0],
      rotationY: 0,
      spec3D: {
        parts: [],
        overallDimensionsMeters: { width: 1.6, depth: 0.8, height: 0.75 },
      },
      roomId: 'room-living',
    };

    // 1. Parallel non-overlapping desks
    const deskB: PlacedFurnitureItem = {
      ...deskA,
      instanceId: 'desk-b',
      position: [2.5, 0, 0],
    };
    assert.equal(checkFurnitureCollision(deskA, deskB), false, 'Separated along X axis');

    // 2. Parallel overlapping desks
    const deskOverlapping: PlacedFurnitureItem = {
      ...deskA,
      instanceId: 'desk-c',
      position: [0.5, 0, 0],
    };
    assert.equal(checkFurnitureCollision(deskA, deskOverlapping), true, 'Overlapping desks must collide');

    // 3. Vertically separated items (same XZ footprint, different heights)
    const deskFloating: PlacedFurnitureItem = {
      ...deskA,
      instanceId: 'desk-d',
      position: [0, 1.2, 0], // Elevated 1.2m above floor, bottom at 1.2m > top of deskA (0.75m)
    };
    assert.equal(checkFurnitureCollision(deskA, deskFloating), false, 'Vertical clearance separates items');

    // 4. Stacked child exemption (lamp resting on deskA)
    const lampStacked: PlacedFurnitureItem = {
      instanceId: 'lamp-1',
      productId: fado.id,
      product: fado,
      swatchName: 'White',
      swatchHex: '#FFFFFF',
      position: [0.2, 0.75, 0.1],
      rotationY: 0,
      spec3D: {
        parts: [],
        overallDimensionsMeters: { width: 0.25, depth: 0.25, height: 0.24 },
      },
      roomId: 'room-living',
      parentInstanceId: 'desk-a',
    };
    assert.equal(
      checkFurnitureCollision(deskA, lampStacked),
      false,
      'Stacked item does not collide with its supporting parent'
    );

    // 5. Sibling collision on the same tabletop surface
    const lampSibling: PlacedFurnitureItem = {
      ...lampStacked,
      instanceId: 'lamp-2',
      position: [0.22, 0.75, 0.1], // Overlaps lamp-1 on desk
    };
    assert.equal(
      checkFurnitureCollision(lampStacked, lampSibling),
      true,
      'Two items sharing the same surface at the same location must collide'
    );

    // 6. Rug exemption: furniture placed on floor rug
    const rugItem: PlacedFurnitureItem = {
      instanceId: 'rug-1',
      productId: stoense.id,
      product: stoense,
      swatchName: 'Cream',
      swatchHex: '#EAE6DF',
      position: [0, 0, 0],
      rotationY: 0,
      spec3D: {
        parts: [],
        overallDimensionsMeters: { width: 2.0, depth: 3.0, height: 0.02 },
      },
      roomId: 'room-living',
    };
    assert.equal(
      checkFurnitureCollision(deskA, rugItem),
      false,
      'Furniture resting on a floor rug is exempted from collision'
    );

    // 7. findCollidingFurniture returns all colliding items
    const colliders = findCollidingFurniture(deskA, [deskB, deskOverlapping, rugItem]);
    assert.equal(colliders.length, 1);
    assert.equal(colliders[0].instanceId, 'desk-c');
  });

  it('checkObbSat2D separates 45° rotated diamond boxes where naive AABB reports false collision', () => {
    // Two unit boxes rotated 45° with centers at (0, 0) and (0.8, 0.8)
    // In AABB: Box A X spans [-0.707, 0.707], Box B X spans [0.093, 1.507] -> AABB overlap = 0.614m!
    // In 2D SAT: Distance along diagonal axis = 1.131m > radius sum (1.0m) -> Clear separation of 0.131m!
    const boxA = { cx: 0, cz: 0, hx: 0.5, hz: 0.5, rotDeg: 45 };
    const boxB = { cx: 0.8, cz: 0.8, hx: 0.5, hz: 0.5, rotDeg: 45 };

    const isColliding = checkObbSat2D(boxA, boxB);
    assert.equal(isColliding, false, 'OBB SAT must detect separation along rotated diagonal axis');

    // Bringing them closer to (0.65, 0.65): diagonal distance 0.919m < 1.0m -> Now colliding
    const boxBCloser = { cx: 0.65, cz: 0.65, hx: 0.5, hz: 0.5, rotDeg: 45 };
    assert.equal(checkObbSat2D(boxA, boxBCloser), true, 'Closer rotated boxes collide');
  });

  it('snapFurnitureToRoom auto-rotates furniture to face room walls (0°, 90°, 180°, 270°)', () => {
    const sofa = { width: 228, depth: 95, height: 83 }; // 2.28m x 0.95m
    const room = { width: 5.0, length: 4.0, enableGridSnap: true, enableWallSnap: true };

    // 1. North Wall (z = -2.0m): back faces wall (0°)
    const northSnap = snapFurnitureToRoom([0, 0, -1.35], 45, sofa, room);
    assert.equal(northSnap.rotationY, 0, 'North wall must auto-rotate to 0°');
    assert.equal(northSnap.position[2], -1.505, 'Must sit flush with North wall');

    // 2. South Wall (z = +2.0m): back faces wall (180°)
    const southSnap = snapFurnitureToRoom([0, 0, 1.35], 0, sofa, room);
    assert.equal(southSnap.rotationY, 180, 'South wall must auto-rotate to 180°');
    assert.equal(southSnap.position[2], 1.505, 'Must sit flush with South wall');

    // 3. West Wall (x = -2.5m): back faces wall (90°)
    // Bounding extents recalculation: width becomes depth along Z, depth becomes width along X
    const westSnap = snapFurnitureToRoom([-1.30, 0, 0], 0, sofa, room);
    assert.equal(westSnap.rotationY, 90, 'West wall must auto-rotate to 90°');
    assert.equal(westSnap.position[0], -2.005, 'Must recalculate bounds and sit flush against West wall');

    // 4. East Wall (x = +2.5m): back faces wall (270°)
    const eastSnap = snapFurnitureToRoom([1.30, 0, 0], 0, sofa, room);
    assert.equal(eastSnap.rotationY, 270, 'East wall must auto-rotate to 270°');
    assert.equal(eastSnap.position[0], 2.005, 'Must recalculate bounds and sit flush against East wall');

    // 5. Corner Snapping with Hysteresis (North-West corner, closer to North)
    const cornerNorth = snapFurnitureToRoom([-1.20, 0, -1.45], 0, sofa, room);
    assert.equal(cornerNorth.rotationY, 0, 'North is closer than West');
    assert.equal(cornerNorth.position[0], -1.34);
    assert.equal(cornerNorth.position[2], -1.505);

    // 6. Corner Snapping with Hysteresis (North-West corner, closer to West)
    const cornerWest = snapFurnitureToRoom([-1.45, 0, -1.20], 0, sofa, room);
    assert.equal(cornerWest.rotationY, 90, 'West is closer than North');
    assert.equal(cornerWest.position[0], -2.005);
    assert.equal(cornerWest.position[2], -0.84);

    // 7. Middle of the room preserves orientation
    const centerSnap = snapFurnitureToRoom([0, 0, 0], 35, sofa, room);
    assert.equal(centerSnap.rotationY, 35, 'Preserves rotation away from walls');
    assert.deepEqual(centerSnap.position, [0, 0, 0]);

    // 8. autoRotateToWall: false preserves rotation even when snapping position
    const manualSnap = snapFurnitureToRoom([0, 0, -1.4], 45, sofa, { ...room, autoRotateToWall: false });
    assert.equal(manualSnap.rotationY, 45, 'autoRotateToWall: false must preserve rotation');
  });

  it('snapFurnitureToRoom seamlessly integrates vertical surface stacking and collision check', () => {
    const bekant = INITIAL_IKEA_CATALOG.find((p) => p.name === 'BEKANT')!;
    const fado = INITIAL_IKEA_CATALOG.find((p) => p.name === 'FADO')!;

    const deskItem: PlacedFurnitureItem = {
      instanceId: 'desk-placed',
      productId: bekant.id,
      product: bekant,
      swatchName: 'Oak',
      swatchHex: '#D2B48C',
      position: [0, 0, 0],
      rotationY: 0,
      spec3D: {
        parts: [],
        overallDimensionsMeters: { width: 1.6, depth: 0.8, height: 0.75 },
      },
      roomId: 'room-living',
    };

    const room = {
      width: 5.0,
      length: 4.0,
      enableGridSnap: true,
      enableWallSnap: true,
      allowStacking: true,
      otherItems: [deskItem],
      itemProduct: fado,
    };

    // Drop lamp at [0.2, 0, 0.1]
    const snapped = snapFurnitureToRoom([0.2, 0, 0.1], 0, fado.dimensionsCm, room);
    assert.equal(snapped.parentInstanceId, 'desk-placed', 'Lamp recorded parentInstanceId');
    assert.equal(snapped.position[1], 0.75, 'Lamp vertically elevated onto desk');
    assert.equal(snapped.hasCollision, false, 'Stacked lamp does not collide with parent desk');
  });

  it('computeDimensionSegments calculates exact CAD witness lines, ticks, arrows, and formatting', () => {
    // 1. Formatting tests
    assert.equal(formatDimensionValue(1.2, 'W', 'cm'), 'W: 120 cm');
    assert.equal(formatDimensionValue(1.2, 'W', 'm'), 'W: 1.20 m');
    assert.equal(formatDimensionValue(1.2, 'W', 'dual'), 'W: 120 cm (1.20 m)');
    assert.equal(formatDimensionValue(0.85, 'D', 'cm', false), '85 cm');

    // 2. Full 3-axis item (Sofa 228 x 95 x 83 cm)
    const sofaDim = computeDimensionSegments({ width: 2.28, depth: 0.95, height: 0.83 });
    // 27 line segments = 54 vertices * 3 coords = 162 floats
    assert.equal(sofaDim.lineCount, 27, 'Expected 27 batched CAD line segments');
    assert.equal(sofaDim.positions.length, 162, 'Float32Array must have 162 values');
    assert.equal(sofaDim.labels.width, 'W: 228 cm');
    assert.equal(sofaDim.labels.depth, 'D: 95 cm');
    assert.equal(sofaDim.labels.height, 'H: 83 cm');

    // 3. Low-profile floor finish (Rug 200 x 300 x 2 cm)
    // Height < 0.06m omits the vertical height dimension lines
    const rugDim = computeDimensionSegments({ width: 2.0, depth: 3.0, height: 0.02 });
    assert.equal(rugDim.lineCount, 18, 'Expected 18 line segments (Width & Depth only for flat rug)');
    assert.equal(rugDim.positions.length, 108);
  });
});
