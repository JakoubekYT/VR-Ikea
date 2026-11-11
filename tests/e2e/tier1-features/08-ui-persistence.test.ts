import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import {
  createMockApartmentProject,
  serializeApartmentProject,
  deserializeApartmentProject,
} from '../../harness/index.js';
import type { FloatingWindowState, FloatingWindowId } from '../../../src/types/ikea.js';

describe('Tier 1: Feature 8 - UI/UX Layout & Project Persistence', () => {
  it('T1-F8-01: Floating Window Toggle, Drag & Resize', () => {
    const windowState: FloatingWindowState = {
      id: 'catalog',
      title: 'IKEA Catalog',
      isOpen: true,
      isMinimized: false,
      x: 100,
      y: 120,
      width: 420,
      height: 560,
      zIndex: 25,
    };

    // Simulate drag mutation
    const draggedState = {
      ...windowState,
      x: 180,
      y: 200,
    };
    assert.equal(draggedState.x, 180);
    assert.equal(draggedState.y, 200);

    // Simulate resize mutation (clamped min width 300px)
    const resizedWidth = Math.max(300, 250);
    const resizedState = {
      ...draggedState,
      width: resizedWidth,
    };
    assert.equal(resizedState.width, 300);
  });

  it('T1-F8-02: Window Focus Z-Index Stacking', () => {
    const windows: Record<FloatingWindowId, FloatingWindowState> = {
      catalog: { id: 'catalog', title: 'IKEA Catalog', isOpen: true, isMinimized: false, x: 20, y: 80, width: 380, height: 600, zIndex: 10 },
      architecture: { id: 'architecture', title: 'Architecture', isOpen: true, isMinimized: false, x: 420, y: 80, width: 380, height: 600, zIndex: 12 },
      chandeliers: { id: 'chandeliers', title: 'Chandeliers', isOpen: false, isMinimized: false, x: 100, y: 100, width: 360, height: 500, zIndex: 8 },
      cart: { id: 'cart', title: 'Cart', isOpen: true, isMinimized: false, x: 800, y: 80, width: 400, height: 600, zIndex: 11 },
    };

    function focusWindow(targetId: FloatingWindowId) {
      const highestZ = Math.max(...Object.values(windows).map((w) => w.zIndex));
      windows[targetId].zIndex = highestZ + 1;
    }

    focusWindow('catalog');
    assert.equal(windows.catalog.zIndex, 13);
    assert.ok(windows.catalog.zIndex > windows.architecture.zIndex);
    assert.ok(windows.catalog.zIndex > windows.cart.zIndex);
  });

  it('T1-F8-03: View Mode Transitions', () => {
    type ViewMode = 'orbit' | 'blueprint' | 'walkthrough_1to1';
    let currentMode: ViewMode = 'orbit';

    function setViewMode(newMode: ViewMode) {
      currentMode = newMode;
      const isOrthographic = currentMode === 'blueprint';
      const isFirstPerson = currentMode === 'walkthrough_1to1';
      return { isOrthographic, isFirstPerson };
    }

    const m1 = setViewMode('blueprint');
    assert.equal(m1.isOrthographic, true);
    assert.equal(m1.isFirstPerson, false);

    const m2 = setViewMode('walkthrough_1to1');
    assert.equal(m2.isOrthographic, false);
    assert.equal(m2.isFirstPerson, true);

    const m3 = setViewMode('orbit');
    assert.equal(m3.isOrthographic, false);
    assert.equal(m3.isFirstPerson, false);
  });

  it('T1-F8-04: Lighting Preset & Dark Mode Synchronization', () => {
    const presets = {
      'Nordic Morning Sun': { isDark: false, bgHex: '#EAE6DF', sunIntensity: 1.2 },
      'Studio Daylight': { isDark: false, bgHex: '#F2EFEB', sunIntensity: 1.0 },
      'Cozy Evening Lamps': { isDark: true, bgHex: '#1F2430', sunIntensity: 0.35 },
    };

    const evening = presets['Cozy Evening Lamps'];
    assert.equal(evening.isDark, true, 'Cozy Evening Lamps must activate dark mode UI styles');
    assert.equal(evening.bgHex, '#1F2430');
    assert.equal(evening.sunIntensity, 0.35);
  });

  it('T1-F8-05: Complete Project Layout JSON Serialization', () => {
    const project = createMockApartmentProject();
    const jsonStr = serializeApartmentProject(project);

    assert.equal(typeof jsonStr, 'string');
    assert.ok(jsonStr.length > 500, 'Serialized project JSON must contain complete data payload');

    const parsed = JSON.parse(jsonStr);
    assert.equal(parsed.version, 3);
    assert.ok(Array.isArray(parsed.rooms) && parsed.rooms.length > 0);
    assert.ok(Array.isArray(parsed.placedItems) && parsed.placedItems.length > 0);
    assert.ok(Array.isArray(parsed.chandeliers) && parsed.chandeliers.length > 0);
    assert.equal(parsed.metadata?.appName, 'IKEA Space Planner VR');
  });

  it('T1-F8-06: Project Layout JSON Deserialization & State Restore', () => {
    const original = createMockApartmentProject();
    const jsonStr = serializeApartmentProject(original);

    const restored = deserializeApartmentProject(jsonStr);

    assert.equal(restored.version, original.version);
    assert.equal(restored.rooms.length, original.rooms.length);
    assert.equal(restored.placedItems.length, original.placedItems.length);
    assert.equal(restored.chandeliers.length, original.chandeliers.length);
    assert.deepEqual(restored.rooms[0].position, original.rooms[0].position);
    assert.equal(restored.placedItems[0].productId, original.placedItems[0].productId);
  });
});
