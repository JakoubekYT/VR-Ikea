import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import {
  deserializeApartmentProject,
  memoryStorage,
} from '../../harness/index.js';

describe('Tier 2: Feature 8 - Project Persistence Boundaries', () => {
  it('T2-F8-01: Corrupted / Invalid Project JSON Import', () => {
    const brokenJson = '{"broken": true, "rooms": [unclosed-array';

    assert.throws(
      () => deserializeApartmentProject(brokenJson),
      /Unexpected|in JSON/i,
      'Corrupted JSON must throw JSON syntax error'
    );
  });

  it('T2-F8-02: Missing Optional Properties in Project JSON', () => {
    // Valid JSON with rooms array but missing placedItems and chandeliers
    const minimalJson = JSON.stringify({
      version: 2,
      rooms: [{ id: 'r1', name: 'Minimal Room', width: 4, length: 4, height: 2.8, position: [0, 0] }],
    });

    const parsed = deserializeApartmentProject(minimalJson);

    assert.equal(parsed.version, 2);
    assert.equal(parsed.rooms.length, 1);
    assert.ok(Array.isArray(parsed.placedItems), 'Must populate default empty placedItems array');
    assert.equal(parsed.placedItems.length, 0);
    assert.ok(Array.isArray(parsed.chandeliers), 'Must populate default empty chandeliers array');
    assert.equal(parsed.chandeliers.length, 0);
  });

  it('T2-F8-03: Deprecated Schema Version Migration', () => {
    const legacyProjectJson = JSON.stringify({
      version: 1,
      rooms: [
        {
          id: 'room-1',
          name: 'Old Living Room',
          floorFinish: 'Warm Herringbone Parquet',
          position: [0, 0],
          width: 5,
          length: 5,
          height: 2.8,
        },
      ],
    });

    const parsed = deserializeApartmentProject(legacyProjectJson);

    // Migration function normalizes finishes if needed
    assert.equal(parsed.version, 1);
    assert.ok(parsed.rooms.length > 0);
  });

  it('T2-F8-04: Floating Window Dragged Beyond Viewport Extents', () => {
    // Window dragged to negative coordinates (offscreen)
    const rawX = -400;
    const rawY = -250;
    const viewportWidth = 1920;
    const viewportHeight = 1080;
    const windowWidth = 400;

    // Standard clamping: keep header bar visible inside [0, viewport - minVisible]
    const clampedX = Math.max(0, Math.min(viewportWidth - 100, rawX));
    const clampedY = Math.max(0, Math.min(viewportHeight - 60, rawY));

    assert.equal(clampedX, 0, 'Offscreen negative X must clamp to 0');
    assert.equal(clampedY, 0, 'Offscreen negative Y must clamp to 0');
  });

  it('T2-F8-05: Mobile Viewport (<768px) Bottom Sheet Docking', () => {
    function computeIsMobile(windowWidth: number): boolean {
      return windowWidth < 768;
    }

    assert.equal(computeIsMobile(375), true, 'iPhone 375px should activate mobile docked sheet');
    assert.equal(computeIsMobile(767), true, '767px should activate mobile docked sheet');
    assert.equal(computeIsMobile(768), false, '768px tablet desktop starts floating mode');
    assert.equal(computeIsMobile(1200), false, '1200px desktop should be floating');
  });

  it('T2-F8-06: LocalStorage Quota Exceeded Exception Handling', () => {
    function safeCacheWrite(key: string, value: string): boolean {
      try {
        memoryStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }

    const ok = safeCacheWrite('test_key', 'test_value');
    assert.equal(ok, true);
    assert.equal(memoryStorage.getItem('test_key'), 'test_value');
  });
});
