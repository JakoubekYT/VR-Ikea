/**
 * Headless DOM, Document, Canvas, Window, and localStorage Polyfill for Node.js
 * Enables Three.js procedural texture generation and scene graph operations headlessly.
 */

export interface MockCanvasElement {
  width: number;
  height: number;
  getContext(type: string): MockCanvasRenderingContext2D;
  toDataURL(type?: string): string;
  style: Record<string, string>;
  addEventListener(event: string, handler: (...args: any[]) => void): void;
  removeEventListener(event: string, handler: (...args: any[]) => void): void;
}

export interface MockCanvasRenderingContext2D {
  fillStyle: any;
  strokeStyle: any;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  miterLimit: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  shadowBlur: number;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  globalAlpha: number;
  globalCompositeOperation: string;
  canvas: MockCanvasElement;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect(x: number, y: number, w: number, h: number, radii?: number | number[]): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fill(): void;
  stroke(): void;
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  rotate(angle: number): void;
  translate(x: number, y: number): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  resetTransform(): void;
  measureText(text: string): { width: number; actualBoundingBoxAscent: number; actualBoundingBoxDescent: number };
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): any;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): any;
  getImageData(sx: number, sy: number, sw: number, sh: number): { data: Uint8ClampedArray; width: number; height: number };
  putImageData(imagedata: any, dx: number, dy: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  setLineDash(segments: number[]): void;
  getLineDash(): number[];
  drawImage(...args: any[]): void;
}

export class MemoryLocalStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return index >= 0 && index < keys.length ? keys[index] : null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

export function createMockCanvas(width = 512, height = 512): MockCanvasElement {
  const canvas: MockCanvasElement = {
    width,
    height,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    getContext: () => context,
  };

  const context: MockCanvasRenderingContext2D = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowBlur: 0,
    shadowColor: 'transparent',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    canvas,
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    bezierCurveTo: () => {},
    quadraticCurveTo: () => {},
    arc: () => {},
    rect: () => {},
    roundRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    scale: () => {},
    rotate: () => {},
    translate: () => {},
    transform: () => {},
    setTransform: () => {},
    resetTransform: () => {},
    measureText: (text: string) => ({
      width: Math.max(10, (text?.length || 1) * 8),
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    getImageData: (_sx: number, _sy: number, sw: number, sh: number) => ({
      width: sw,
      height: sh,
      data: new Uint8ClampedArray(sw * sh * 4),
    }),
    putImageData: () => {},
    fillText: () => {},
    strokeText: () => {},
    setLineDash: () => {},
    getLineDash: () => [],
    drawImage: () => {},
  };

  return canvas;
}

export const memoryStorage = new MemoryLocalStorage();

export function setupHeadlessEnvironment(): void {
  const g = globalThis as any;

  if (!g.document) {
    g.document = {
      createElement: (tag: string) => {
        if (tag.toLowerCase() === 'canvas') {
          return createMockCanvas(512, 512);
        }
        return {
          style: {},
          addEventListener: () => {},
          removeEventListener: () => {},
          appendChild: () => {},
          removeChild: () => {},
        };
      },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  }

  if (!g.window) {
    g.window = g;
  }
  if (!g.window.document) {
    g.window.document = g.document;
  }
  if (!g.window.localStorage) {
    g.window.localStorage = memoryStorage;
  }
  if (!g.localStorage) {
    g.localStorage = memoryStorage;
  }
  if (!g.window.innerWidth) {
    g.window.innerWidth = 1920;
    g.window.innerHeight = 1080;
  }
  if (!g.window.addEventListener) {
    g.window.addEventListener = () => {};
    g.window.removeEventListener = () => {};
  }
}

// Auto-run on module load so importing headlessShim configures the runtime automatically
setupHeadlessEnvironment();
