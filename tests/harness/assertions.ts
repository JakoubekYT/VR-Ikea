/**
 * Domain-specific Assertions for IKEA Space Planner
 * Provides strict, verifiable assertions for CAD sub-parts, SAT bounding collisions, BOM math, and RFC CSV.
 */

import assert from 'node:assert/strict';
import type {
  ApartmentRoom,
  BomSummary,
  Furniture3DSpec,
  IkeaProduct,
  PlacedFurnitureItem,
} from '../../src/types/ikea.js';
import { checkFurnitureCollision } from '../../src/utils/roomLogic.js';

export function assertCADPartCount(
  spec: Furniture3DSpec,
  min = 20,
  max = 40
): void {
  assert.ok(spec, 'Spec must be defined');
  assert.ok(Array.isArray(spec.parts), 'Spec.parts must be an array');
  assert.ok(
    spec.parts.length >= min && spec.parts.length <= max,
    `Expected CAD sub-parts to be between ${min} and ${max}, but got ${spec.parts.length}`
  );
  for (const part of spec.parts) {
    assert.ok(part.name, 'Every part must have a name');
    assert.ok(part.shape, `Part ${part.name} missing shape`);
    assert.ok(Array.isArray(part.position) && part.position.length === 3, `Part ${part.name} has invalid position`);
    assert.ok(Array.isArray(part.size) && part.size.length === 3, `Part ${part.name} has invalid size`);
    assert.ok(!part.size.some(isNaN), `Part ${part.name} size contains NaN`);
    assert.ok(!part.position.some(isNaN), `Part ${part.name} position contains NaN`);
    assert.ok(part.size[0] > 0 && part.size[1] > 0 && part.size[2] > 0, `Part ${part.name} size dimensions must be > 0`);
  }
}

export function assertCADDimensionsMatchProduct(
  spec: Furniture3DSpec,
  product: IkeaProduct,
  tolerance = 0.05
): void {
  const expectedWidthM = product.dimensionsCm.width / 100;
  const expectedDepthM = product.dimensionsCm.depth / 100;
  const expectedHeightM = product.dimensionsCm.height / 100;

  assert.ok(
    Math.abs(spec.overallDimensionsMeters.width - expectedWidthM) <= tolerance,
    `Width mismatch: expected ${expectedWidthM}m (+-${tolerance}), got ${spec.overallDimensionsMeters.width}m`
  );
  assert.ok(
    Math.abs(spec.overallDimensionsMeters.depth - expectedDepthM) <= tolerance,
    `Depth mismatch: expected ${expectedDepthM}m (+-${tolerance}), got ${spec.overallDimensionsMeters.depth}m`
  );
  assert.ok(
    Math.abs(spec.overallDimensionsMeters.height - expectedHeightM) <= tolerance,
    `Height mismatch: expected ${expectedHeightM}m (+-${tolerance}), got ${spec.overallDimensionsMeters.height}m`
  );
}

export function assertWithinRoom(
  pos: [number, number, number],
  dimsCm: { width: number; depth: number; height: number },
  room: ApartmentRoom,
  tolerance = 0.02
): void {
  const halfRoomW = room.width / 2;
  const halfRoomL = room.length / 2;

  // Local pos inside room
  const localX = pos[0] - room.position[0];
  const localZ = pos[2] - room.position[1];

  const halfItemW = dimsCm.width / 200;
  const halfItemD = dimsCm.depth / 200;

  const minX = -halfRoomW + halfItemW - tolerance;
  const maxX = halfRoomW - halfItemW + tolerance;
  const minZ = -halfRoomL + halfItemD - tolerance;
  const maxZ = halfRoomL - halfItemD + tolerance;

  assert.ok(
    localX >= minX && localX <= maxX,
    `Item X (${localX}) exceeds room X bounds [${minX}, ${maxX}]`
  );
  assert.ok(
    localZ >= minZ && localZ <= maxZ,
    `Item Z (${localZ}) exceeds room Z bounds [${minZ}, ${maxZ}]`
  );
}

export function assertNoCollision(
  itemA: PlacedFurnitureItem,
  itemB: PlacedFurnitureItem
): void {
  const isColliding = checkFurnitureCollision(itemA, itemB);
  assert.equal(
    isColliding,
    false,
    `Expected NO collision between ${itemA.product.name} (${itemA.instanceId}) and ${itemB.product.name} (${itemB.instanceId}), but SAT overlap was detected`
  );
}

export function assertCollision(
  itemA: PlacedFurnitureItem,
  itemB: PlacedFurnitureItem
): void {
  const isColliding = checkFurnitureCollision(itemA, itemB);
  assert.equal(
    isColliding,
    true,
    `Expected collision between ${itemA.product.name} (${itemA.instanceId}) and ${itemB.product.name} (${itemB.instanceId}), but SAT detected no overlap`
  );
}

export function assertStacked(
  child: PlacedFurnitureItem,
  parent: PlacedFurnitureItem,
  tolerance = 0.05
): void {
  const expectedElevation = (parent.position[1] || 0) + (parent.product.dimensionsCm.height / 100);
  assert.ok(
    Math.abs(child.position[1] - expectedElevation) <= tolerance,
    `Child item elevation (${child.position[1]}m) does not match parent top surface elevation (${expectedElevation}m)`
  );
  assert.equal(
    child.parentInstanceId,
    parent.instanceId,
    `Child parentInstanceId must match parent instanceId`
  );
}

export function assertBomMath(summary: BomSummary): void {
  assert.ok(summary, 'BOM summary must be defined');
  assert.ok(Array.isArray(summary.lines), 'BOM lines must be an array');

  let computedItems = 0;
  let computedCzk = 0;
  let computedEur = 0;

  for (const line of summary.lines) {
    assert.ok(line.quantity > 0, `Line item ${line.product.name} quantity must be > 0`);
    assert.ok(line.subtotalCzk >= 0, `Line item ${line.product.name} subtotalCzk must be >= 0`);
    assert.ok(line.subtotalEur >= 0, `Line item ${line.product.name} subtotalEur must be >= 0`);

    computedItems += line.quantity;
    computedCzk += line.subtotalCzk;
    computedEur += line.subtotalEur;
  }

  assert.equal(
    summary.totalItems,
    computedItems,
    `totalItems mismatch: summary has ${summary.totalItems}, sum of lines is ${computedItems}`
  );
  assert.equal(
    summary.totalCzk,
    computedCzk,
    `totalCzk mismatch: summary has ${summary.totalCzk}, sum of lines is ${computedCzk}`
  );
  assert.equal(
    summary.totalEur,
    computedEur,
    `totalEur mismatch: summary has ${summary.totalEur}, sum of lines is ${computedEur}`
  );
}

export function assertValidCsv(csvContent: string, minLines = 2): void {
  assert.ok(typeof csvContent === 'string', 'CSV content must be a string');
  const lines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  assert.ok(
    lines.length >= minLines,
    `CSV expected at least ${minLines} lines, got ${lines.length}`
  );

  const headerColumns = lines[0].split(',').length;
  assert.ok(headerColumns >= 4, `CSV header expected at least 4 columns, got ${headerColumns}`);

  // Basic RFC-4180 balance check: quotes must be balanced
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const quoteCount = (line.match(/"/g) || []).length;
    assert.equal(
      quoteCount % 2,
      0,
      `CSV line ${i + 1} has unbalanced quotes: ${line}`
    );
  }
}

export function assertValidJson<T = any>(jsonStr: string): T {
  assert.ok(typeof jsonStr === 'string', 'JSON input must be a string');
  try {
    const parsed = JSON.parse(jsonStr);
    assert.ok(parsed !== null && typeof parsed === 'object', 'Parsed JSON must be an object/array');
    return parsed as T;
  } catch (err: any) {
    assert.fail(`Invalid JSON string: ${err.message}`);
  }
}
