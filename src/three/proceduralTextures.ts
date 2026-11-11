import * as THREE from 'three';
import { FloorFinishType, WallFinishPresetName } from '../types/ikea';

const textureCache = new Map<string, { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture }>();

function configureTexturePair(
  colorCanvas: HTMLCanvasElement,
  bumpCanvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeatX, repeatY);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

/**
 * Generates procedural PBR color + bump textures for any FloorFinishType
 */
export function getFloorTextures(
  floorFinish: FloorFinishType,
  roomWidth: number,
  roomLength: number,
  maxAnisotropy: number = 4
): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughness: number;
  metalness: number;
  bumpScale: number;
} {
  const key = `floor_${floorFinish}_${Math.round(roomWidth)}_${Math.round(roomLength)}`;
  let pair = textureCache.get(key);

  if (!pair) {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext('2d')!;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d')!;

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    if (floorFinish === 'Scandinavian Oak Parquet' || floorFinish === 'Light Ash Planks') {
      const isAsh = floorFinish === 'Light Ash Planks';
      const baseColors = isAsh
        ? ['#E7D6BC', '#E1CEB1', '#EADBC3', '#DECAB0']
        : ['#D2B083', '#CAA677', '#D8B78C', '#C49F70'];

      const rows = 8;
      const cols = 2;
      const plankH = size / rows;
      const plankW = size / cols;

      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (plankW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * plankW + offset;
          const y = r * plankH;
          ctx.fillStyle = baseColors[(r * 3 + c + 4) % baseColors.length];
          ctx.fillRect(x, y, plankW, plankH);

          // Wood grain streaks
          ctx.fillStyle = isAsh ? 'rgba(175, 145, 110, 0.14)' : 'rgba(135, 95, 55, 0.16)';
          for (let g = 0; g < 14; g++) {
            const gy = y + ((g + 0.5) / 14) * plankH;
            ctx.fillRect(x + 2, gy, plankW - 4, 1.5);
          }

          // Grout / plank seam
          ctx.strokeStyle = isAsh ? '#B8A287' : '#9B784E';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, plankW, plankH);

          bCtx.strokeStyle = '#303030';
          bCtx.lineWidth = 3;
          bCtx.strokeRect(x, y, plankW, plankH);
        }
      }
    } else if (floorFinish === 'Walnut Herringbone') {
      ctx.fillStyle = '#6D4B36';
      ctx.fillRect(0, 0, size, size);
      const tones = ['#6E4C36', '#61412D', '#79553E', '#583A27'];
      const step = 64;
      for (let y = -step; y < size + step; y += step) {
        for (let x = -step; x < size + step; x += step) {
          ctx.save();
          ctx.translate(x, y);
          const idx = Math.abs((x / step + y / step) | 0) % tones.length;
          ctx.fillStyle = tones[idx];
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(0, 0, step * 0.96, step * 0.34);
          ctx.strokeStyle = '#3E2719';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(0, 0, step * 0.96, step * 0.34);
          ctx.restore();

          bCtx.save();
          bCtx.translate(x, y);
          bCtx.rotate(Math.PI / 4);
          bCtx.strokeStyle = '#383838';
          bCtx.lineWidth = 2;
          bCtx.strokeRect(0, 0, step * 0.96, step * 0.34);
          bCtx.restore();
        }
      }
    } else if (floorFinish === 'Polished Concrete') {
      ctx.fillStyle = '#C6C7C4';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 600; i++) {
        const x = (i * 73) % size;
        const y = (i * 137) % size;
        const r = 10 + (i % 35);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(80,82,85,0.04)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        bCtx.fillStyle = i % 2 === 0 ? '#8c8c8c' : '#747474';
        bCtx.fillRect(x, y, 4, 4);
      }
      // Subtle expansion joint grid
      ctx.strokeStyle = 'rgba(110,112,115,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, size - 4, size - 4);
    } else if (floorFinish === 'Warm Beige Carpet') {
      ctx.fillStyle = '#D9D0C1';
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 4) {
        for (let x = 0; x < size; x += 4) {
          const v = ((x * 13 + y * 29) % 18) - 9;
          ctx.fillStyle = v > 0 ? 'rgba(255,250,242,0.22)' : 'rgba(145,130,110,0.18)';
          ctx.fillRect(x, y, 3, 3);
          bCtx.fillStyle = v > 0 ? '#B0B0B0' : '#555555';
          bCtx.fillRect(x, y, 2, 2);
        }
      }
    } else {
      // Large Ceramic Tiles
      ctx.fillStyle = '#E8E6E1';
      ctx.fillRect(0, 0, size, size);
      const grid = 2;
      const cell = size / grid;
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#EAE8E3' : '#E3E0DA';
          ctx.fillRect(c * cell + 3, r * cell + 3, cell - 6, cell - 6);
          ctx.strokeStyle = '#B8B4AC';
          ctx.lineWidth = 4;
          ctx.strokeRect(c * cell, r * cell, cell, cell);

          bCtx.strokeStyle = '#252525';
          bCtx.lineWidth = 5;
          bCtx.strokeRect(c * cell, r * cell, cell, cell);
        }
      }
    }

    pair = configureTexturePair(colorCanvas, bumpCanvas, roomWidth / 1.8, roomLength / 1.8, maxAnisotropy);
    textureCache.set(key, pair);
  }

  switch (floorFinish) {
    case 'Scandinavian Oak Parquet':
    case 'Light Ash Planks':
      return { ...pair, roughness: 0.42, metalness: 0.04, bumpScale: 0.008 };
    case 'Walnut Herringbone':
      return { ...pair, roughness: 0.35, metalness: 0.06, bumpScale: 0.01 };
    case 'Polished Concrete':
      return { ...pair, roughness: 0.26, metalness: 0.08, bumpScale: 0.005 };
    case 'Warm Beige Carpet':
      return { ...pair, roughness: 0.92, metalness: 0.0, bumpScale: 0.02 };
    case 'Large Ceramic Tiles':
      return { ...pair, roughness: 0.2, metalness: 0.08, bumpScale: 0.012 };
  }
}

/**
 * Generates procedural PBR textures for wall finishes (including Acoustic Oak Slats & Exposed Brick)
 */
export function getWallTextures(
  finishPreset: WallFinishPresetName,
  colorHex: string,
  wallWidth: number,
  wallHeight: number,
  maxAnisotropy: number = 4
): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughness: number;
  bumpScale: number;
} {
  const key = `wall_${finishPreset}_${colorHex}_${Math.round(wallWidth)}`;
  let pair = textureCache.get(key);

  if (!pair) {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext('2d')!;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d')!;

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    if (finishPreset === 'Acoustic Oak Wood Slats') {
      // Dark acoustic felt backing + vertical solid oak slats
      ctx.fillStyle = '#1E1D1B';
      ctx.fillRect(0, 0, size, size);
      bCtx.fillStyle = '#202020';
      bCtx.fillRect(0, 0, size, size);

      const numSlats = 16;
      const pitch = size / numSlats;
      const slatW = pitch * 0.68;
      for (let i = 0; i < numSlats; i++) {
        const x = i * pitch;
        ctx.fillStyle = i % 2 === 0 ? '#C89E6E' : '#BF9464';
        ctx.fillRect(x, 0, slatW, size);
        // Subtle vertical wood grain
        ctx.fillStyle = 'rgba(110, 75, 40, 0.16)';
        ctx.fillRect(x + slatW * 0.3, 0, 2, size);

        bCtx.fillStyle = '#E0E0E0';
        bCtx.fillRect(x, 0, slatW, size);
      }
    } else if (finishPreset === 'Exposed Brick') {
      // Mortar base
      ctx.fillStyle = '#D5CFC4';
      ctx.fillRect(0, 0, size, size);
      bCtx.fillStyle = '#303030';
      bCtx.fillRect(0, 0, size, size);

      const rows = 12;
      const cols = 4;
      const brickH = size / rows;
      const brickW = size / cols;
      const brickShades = ['#A95542', '#9B4B39', '#B5624D', '#8F4332'];

      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (brickW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * brickW + offset;
          const y = r * brickH;
          ctx.fillStyle = brickShades[Math.abs(r * 3 + c) % brickShades.length];
          ctx.fillRect(x + 3, y + 3, brickW - 6, brickH - 6);

          bCtx.fillStyle = '#C8C8C8';
          bCtx.fillRect(x + 3, y + 3, brickW - 6, brickH - 6);
        }
      }
    } else {
      // Fine Scandinavian plaster micro-grain
      for (let i = 0; i < 900; i++) {
        const x = (i * 97) % size;
        const y = (i * 181) % size;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.025)';
        ctx.fillRect(x, y, 6, 6);
        bCtx.fillStyle = i % 2 === 0 ? '#8A8A8A' : '#767676';
        bCtx.fillRect(x, y, 4, 4);
      }
    }

    const repX = finishPreset === 'Acoustic Oak Wood Slats' ? wallWidth * 1.4 : wallWidth * 0.8;
    const repY = finishPreset === 'Exposed Brick' ? wallHeight * 0.9 : 1;
    pair = configureTexturePair(colorCanvas, bumpCanvas, repX, repY, maxAnisotropy);
    textureCache.set(key, pair);
  }

  return {
    ...pair,
    roughness: finishPreset === 'Acoustic Oak Wood Slats' ? 0.52 : 0.85,
    bumpScale:
      finishPreset === 'Acoustic Oak Wood Slats' || finishPreset === 'Exposed Brick' ? 0.022 : 0.004,
  };
}

let sharedFabricBump: THREE.CanvasTexture | null = null;
let sharedWoodBump: THREE.CanvasTexture | null = null;

export function getSharedFabricBumpMap(): THREE.CanvasTexture {
  if (sharedFabricBump) return sharedFabricBump;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      ctx.fillStyle = (x + y) % 4 === 0 ? '#A8A8A8' : '#585858';
      ctx.fillRect(x, y, 2, 2);
    }
  }
  sharedFabricBump = new THREE.CanvasTexture(canvas);
  sharedFabricBump.colorSpace = THREE.NoColorSpace;
  sharedFabricBump.wrapS = THREE.RepeatWrapping;
  sharedFabricBump.wrapT = THREE.RepeatWrapping;
  sharedFabricBump.repeat.set(6, 6);
  return sharedFabricBump;
}

export function getSharedWoodBumpMap(): THREE.CanvasTexture {
  if (sharedWoodBump) return sharedWoodBump;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? '#989898' : '#686868';
    ctx.fillRect(0, y, size, 1.5);
  }
  sharedWoodBump = new THREE.CanvasTexture(canvas);
  sharedWoodBump.colorSpace = THREE.NoColorSpace;
  sharedWoodBump.wrapS = THREE.RepeatWrapping;
  sharedWoodBump.wrapT = THREE.RepeatWrapping;
  sharedWoodBump.repeat.set(2, 2);
  return sharedWoodBump;
}
