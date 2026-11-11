import * as THREE from 'three';
import type { FloorFinishType, WallFinishType } from '../types/ikea';

const textureCache = new Map<string, THREE.CanvasTexture>();

function createCanvas(width = 512, height = 512): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

export function getFloorTexture(
  finish: FloorFinishType,
  repeatX: number,
  repeatY: number
): THREE.CanvasTexture {
  const key = `floor_${finish}_${repeatX.toFixed(1)}_${repeatY.toFixed(1)}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const { canvas, ctx } = createCanvas(512, 512);

  if (
    finish === 'Oak Parquet' ||
    finish === 'Light Nordic Oak' ||
    finish === 'Walnut Herringbone' ||
    finish === 'Warm Herringbone Parquet' ||
    finish === 'Smoked Dark Walnut'
  ) {
    const isDark = finish === 'Smoked Dark Walnut';
    const isWalnut = finish === 'Walnut Herringbone' || finish === 'Warm Herringbone Parquet';
    const baseColor = isDark ? '#4B382A' : isWalnut ? '#8A6240' : '#D5BC9B';
    const plankStroke = isDark ? '#35261B' : isWalnut ? '#69472B' : '#B89D7A';

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    const rows = 8;
    const cols = 4;
    const plankW = 512 / cols;
    const plankH = 512 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const offset = (r % 2) * (plankW / 2);
        const x = (c * plankW + offset) % 512;
        const y = r * plankH;

        const delta = ((r * 7 + c * 13) % 14) - 7;
        ctx.fillStyle =
          delta > 0 ? 'rgba(255, 246, 232, 0.09)' : 'rgba(30, 18, 8, 0.08)';
        ctx.fillRect(x, y, plankW - 2, plankH - 2);

        // Wood grain fibers
        ctx.strokeStyle = isDark
          ? 'rgba(25,15,8,0.22)'
          : 'rgba(115,80,45,0.16)';
        ctx.lineWidth = 1;
        for (let g = 1; g < 6; g++) {
          ctx.beginPath();
          ctx.moveTo(x + 3, y + (plankH / 6) * g);
          ctx.bezierCurveTo(
            x + plankW * 0.35,
            y + (plankH / 6) * g + ((g % 2) * 3 - 1.5),
            x + plankW * 0.7,
            y + (plankH / 6) * g - ((g % 2) * 3 - 1.5),
            x + plankW - 3,
            y + (plankH / 6) * g
          );
          ctx.stroke();
        }

        ctx.strokeStyle = plankStroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, plankW, plankH);
      }
    }
  } else if (finish === 'Marble Tiles') {
    ctx.fillStyle = '#F2F0EC';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle Carrara marble veining
    ctx.strokeStyle = 'rgba(150, 152, 160, 0.28)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      const startY = (i * 42) % 512;
      ctx.moveTo(0, startY);
      ctx.bezierCurveTo(160, startY + 35, 340, startY - 30, 512, startY + 20);
      ctx.stroke();
    }

    // Large marble tile grid
    ctx.strokeStyle = 'rgba(180, 178, 172, 0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.strokeRect(256, 0, 256, 256);
    ctx.strokeRect(0, 256, 256, 256);
    ctx.strokeRect(256, 256, 256, 256);
  } else if (finish === 'Ceramic Tiles' || finish === 'Nordic Travertine Stone') {
    ctx.fillStyle = finish === 'Ceramic Tiles' ? '#E4E0D8' : '#E5DEC9';
    ctx.fillRect(0, 0, 512, 512);

    const tileCount = 4;
    const step = 512 / tileCount;
    for (let r = 0; r < tileCount; r++) {
      for (let c = 0; c < tileCount; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
        ctx.fillRect(c * step + 3, r * step + 3, step - 6, step - 6);
      }
    }

    ctx.strokeStyle = '#C4BEB2';
    ctx.lineWidth = 4;
    for (let i = 0; i <= tileCount; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(512, i * step);
      ctx.stroke();
    }
  } else if (finish === 'Carpet') {
    ctx.fillStyle = '#D9D3C7';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4200; i++) {
      const x = (i * 53) % 512;
      const y = (i * 97) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(95,85,75,0.14)';
      ctx.fillRect(x, y, 2, 2);
    }
  } else {
    // Polished Concrete / Brushed Architectural Concrete
    ctx.fillStyle = '#D4D3CE';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2000; i++) {
      const x = (i * 73) % 512;
      const y = (i * 139) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(80,80,80,0.09)';
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.strokeStyle = 'rgba(130, 128, 122, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.strokeRect(256, 256, 256, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

export function getWallTexture(
  finish: WallFinishType,
  colorHex: string,
  repeatX: number,
  repeatY: number
): THREE.CanvasTexture {
  const key = `wall_${finish}_${colorHex}_${repeatX.toFixed(1)}_${repeatY.toFixed(1)}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const { canvas, ctx } = createCanvas(512, 512);
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 512, 512);

  if (finish === 'Exposed Whitewashed Brick') {
    const rows = 12;
    const cols = 6;
    const bw = 512 / cols;
    const bh = 512 / rows;
    ctx.strokeStyle = 'rgba(165, 160, 150, 0.55)';
    ctx.lineWidth = 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const offset = (r % 2) * (bw / 2);
        const x = (c * bw + offset) % 512;
        const y = r * bh;
        ctx.strokeRect(x, y, bw, bh);
      }
    }
  } else if (finish === 'Nordic Acoustic Wood Slats') {
    const slats = 24;
    const sw = 512 / slats;
    for (let i = 0; i < slats; i++) {
      ctx.fillStyle = '#30241A';
      ctx.fillRect(i * sw, 0, sw * 0.28, 512);
      ctx.fillStyle = '#C8A57B';
      ctx.fillRect(i * sw + sw * 0.28, 0, sw * 0.72, 512);
    }
  } else if (finish === 'Warm Microcement') {
    for (let i = 0; i < 1200; i++) {
      const x = (i * 61) % 512;
      const y = (i * 113) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(90,85,78,0.06)';
      ctx.fillRect(x, y, 6, 4);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

export function getFabricWeaveTexture(colorHex: string): THREE.CanvasTexture {
  const key = `fabric_${colorHex}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const { canvas, ctx } = createCanvas(128, 128);
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let y = 0; y < 128; y += 4) {
    ctx.fillRect(0, y, 128, 1);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let x = 0; x < 128; x += 4) {
    ctx.fillRect(x, 0, 1, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}
