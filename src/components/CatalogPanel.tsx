import React, { useState, useEffect } from 'react';
import {
  Search,
  Link2,
  Box,
  Check,
  Sparkles,
  ArrowLeft,
  Ruler,
  Tag,
  Loader2,
  ImagePlus,
  Database,
} from 'lucide-react';
import type { Furniture3DSpec, IkeaCategory, IkeaProduct } from '../types/ikea';
import { IKEA_CATEGORIES } from '../data/ikeaCatalog';
import { ProductSilhouetteThumb } from './ProductSilhouetteThumb';

/**
 * Downscales an image File, Blob, or Data URL to max 1024x1024, JPEG 0.85
 * to strictly prevent HTTP 413 (Vercel 4.5MB serverless limit).
 */
export async function downscaleImageToJpeg(
  source: File | Blob | string,
  maxDimension = 1024,
  quality = 0.85
): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);

    img.onload = () => {
      try {
        if (objectUrl) URL.revokeObjectURL(objectUrl);

        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D canvas context');

        // Fill white background for transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl, mimeType: 'image/jpeg' });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for downscaling'));
    };

    img.src = objectUrl || (source as string);
  });
}

interface CatalogPanelProps {
  products: IkeaProduct[];
  activeCategory: IkeaCategory;
  onSelectCategory: (cat: IkeaCategory) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onTriggerLiveSearch: (queryOrUrl: string) => void;
  onConvertImageTo3D: (params: {
    imageBase64: string;
    mimeType: string;
    dimensionsCm: { width: number; depth: number; height: number };
    nameHint: string;
  }) => Promise<void>;
  isSearchingLive: boolean;
  searchStatusMessage: string | null;
  selectedProduct: IkeaProduct | null;
  onSelectProduct: (product: IkeaProduct | null) => void;
  onInsertProductAs3D: (product: IkeaProduct, swatchHex: string, swatchName: string, prebuiltSpec?: Furniture3DSpec) => void;
  insertingProductId: string | null;
  insertProgress: number;
}

const CZECH_QUICK_SEARCHES = [
  { label: 'Rohová sedačka', query: 'rohová sedačka' },
  { label: 'Psací stůl', query: 'psací stůl' },
  { label: 'Šatní skříň', query: 'šatní skříň' },
  { label: 'Postel', query: 'postel' },
  { label: 'KALLAX', query: 'kallax' },
  { label: 'Židle', query: 'židle' },
];

export const CatalogPanel: React.FC<CatalogPanelProps> = ({
  products,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchQueryChange,
  onTriggerLiveSearch,
  onConvertImageTo3D,
  isSearchingLive,
  searchStatusMessage,
  selectedProduct,
  onSelectProduct,
  onInsertProductAs3D,
  insertingProductId,
  insertProgress,
}) => {
  const [inputMode, setInputMode] = useState<'search' | 'url' | 'image'>('search');
  const [selectedSwatchIndex, setSelectedSwatchIndex] = useState(0);

  // Image-to-3D state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string>('image/png');
  const [photoNameHint, setPhotoNameHint] = useState<string>('IKEA Custom Piece');
  const [photoWidthCm, setPhotoWidthCm] = useState<number>(140);
  const [photoDepthCm, setPhotoDepthCm] = useState<number>(65);
  const [photoHeightCm, setPhotoHeightCm] = useState<number>(80);

  const handleOpenProduct = (product: IkeaProduct) => {
    setSelectedSwatchIndex(0);
    onSelectProduct(product);
  };

  // Global Ctrl+V clipboard image paste listener when in Image mode
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            downscaleImageToJpeg(file, 1024, 0.85)
              .then(({ dataUrl, mimeType }) => {
                setPhotoPreview(dataUrl);
                setPhotoMime(mimeType);
                setInputMode('image');
              })
              .catch((err) => {
                console.error('Pasted image downscaling failed:', err);
              });
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const { dataUrl, mimeType } = await downscaleImageToJpeg(file, 1024, 0.85);
      setPhotoPreview(dataUrl);
      setPhotoMime(mimeType);
    } catch (err) {
      console.error('Image downscaling failed:', err);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onTriggerLiveSearch(searchQuery.trim());
    }
  };

  const isUrlInput = /^https?:\/\//i.test(searchQuery.trim()) || inputMode === 'url';

  return (
    <div className="flex flex-col h-full bg-white text-[#111111]">
      {/* Mode Switcher: 1. Live Search, 2. IKEA URL Scraper, 3. Image-to-3D (Ctrl+V) */}
      <div className="px-3.5 pt-2.5 pb-2 border-b border-[#E5E5E5] bg-[#FAFAFA]">
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#EAEAEA] rounded-lg mb-2">
          <button
            type="button"
            onClick={() => setInputMode('search')}
            className={`py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
              inputMode === 'search'
                ? 'bg-[#0058A3] text-white shadow-xs'
                : 'text-[#333333] hover:bg-white/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>1. Search (CZ/EN)</span>
          </button>
          <button
            type="button"
            onClick={() => setInputMode('url')}
            className={`py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
              inputMode === 'url'
                ? 'bg-[#0058A3] text-white shadow-xs'
                : 'text-[#333333] hover:bg-white/60'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>2. IKEA URL</span>
          </button>
          <button
            type="button"
            onClick={() => setInputMode('image')}
            className={`py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
              inputMode === 'image'
                ? 'bg-[#0058A3] text-white shadow-xs'
                : 'text-[#333333] hover:bg-white/60'
            }`}
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span>3. Photo to 3D</span>
          </button>
        </div>

        {inputMode !== 'image' ? (
          <>
            <form onSubmit={handleFormSubmit} className="relative">
              <div className="relative flex items-center">
                {isUrlInput ? (
                  <Link2 className="w-4 h-4 text-[#0058A3] absolute left-3 pointer-events-none" />
                ) : (
                  <Search className="w-4 h-4 text-[#555555] absolute left-3 pointer-events-none" />
                )}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder={
                    inputMode === 'url'
                      ? 'Paste https://www.ikea.com/cz/cs/p/...'
                      : 'Search (rohová sedačka, psací stůl, kallax, malm...)'
                  }
                  className="w-full pl-9 pr-20 py-2 bg-white border border-[#CCCCCC] focus:border-[#0058A3] rounded-lg text-xs text-[#111111] placeholder-[#767676] outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSearchingLive || !searchQuery.trim()}
                  className="absolute right-1.5 px-2.5 py-1 bg-[#0058A3] hover:bg-[#004F93] disabled:opacity-40 text-white text-[11px] font-bold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {isSearchingLive ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>{isUrlInput ? 'Scrape' : 'Search'}</span>
                </button>
              </div>
            </form>

            {/* Quick Czech & English Search Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mt-2 pb-0.5">
              {CZECH_QUICK_SEARCHES.map((item) => (
                <button
                  key={item.query}
                  type="button"
                  onClick={() => {
                    onSearchQueryChange(item.query);
                    onTriggerLiveSearch(item.query);
                  }}
                  className="px-2 py-0.5 bg-white hover:bg-[#0058A3] hover:text-white border border-[#DCDCDC] rounded text-[10px] font-semibold text-[#333333] whitespace-nowrap transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Mode 3: Direct Image Upload / Paste (Ctrl+V) to 3D */
          <div className="bg-white border border-[#DCDCDC] rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#111111]">
                Upload or Paste (Ctrl+V) Furniture Screenshot
              </span>
              <label className="px-2.5 py-1 bg-[#F5F5F5] hover:bg-[#E5E5E5] text-[#111111] rounded text-[11px] font-bold cursor-pointer border border-[#CCCCCC]">
                Choose Image
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {photoPreview && (
              <div className="flex items-center gap-2 bg-[#F5F5F5] p-1.5 rounded">
                <img
                  src={photoPreview}
                  alt="Uploaded preview"
                  className="w-12 h-12 object-cover rounded border border-[#CCCCCC]"
                />
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={photoNameHint}
                    onChange={(e) => setPhotoNameHint(e.target.value)}
                    placeholder="Furniture Name"
                    className="w-full px-2 py-1 text-xs bg-white border border-[#CCCCCC] rounded font-semibold"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[10px] font-bold text-[#555555] block">Width (cm)</label>
                <input
                  type="number"
                  value={photoWidthCm}
                  onChange={(e) => setPhotoWidthCm(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs border border-[#CCCCCC] rounded font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#555555] block">Depth (cm)</label>
                <input
                  type="number"
                  value={photoDepthCm}
                  onChange={(e) => setPhotoDepthCm(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs border border-[#CCCCCC] rounded font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#555555] block">Height (cm)</label>
                <input
                  type="number"
                  value={photoHeightCm}
                  onChange={(e) => setPhotoHeightCm(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs border border-[#CCCCCC] rounded font-semibold"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={isSearchingLive}
              onClick={async () => {
                let imgPayload =
                  photoPreview ||
                  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
                let mimePayload = photoMime;
                if (photoPreview && photoPreview.length > 500000) {
                  try {
                    const downscaled = await downscaleImageToJpeg(photoPreview, 1024, 0.85);
                    imgPayload = downscaled.dataUrl;
                    mimePayload = downscaled.mimeType;
                  } catch (e) {
                    console.warn('Downscaling before send fallback:', e);
                  }
                }
                await onConvertImageTo3D({
                  imageBase64: imgPayload,
                  mimeType: mimePayload,
                  dimensionsCm: {
                    width: photoWidthCm,
                    depth: photoDepthCm,
                    height: photoHeightCm,
                  },
                  nameHint: photoNameHint,
                });
              }}
              className="w-full py-2 bg-[#0058A3] hover:bg-[#004F93] text-white font-bold text-xs rounded-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSearchingLive ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#FFDB00]" />
              )}
              <span>Convert Photo + Dimensions into 3D Model</span>
            </button>
          </div>
        )}

        {searchStatusMessage && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#0058A3] font-medium">
            <Database className="w-3 h-3 shrink-0" />
            <span className="truncate">{searchStatusMessage}</span>
          </div>
        )}
      </div>

      {/* Category Filter Tabs */}
      {!selectedProduct && (
        <div className="px-3 py-1.5 border-b border-[#E5E5E5] bg-[#F5F5F5] flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
          {IKEA_CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#111111] text-white'
                    : 'bg-white text-[#333333] hover:bg-[#E5E5E5] border border-[#E5E5E5]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Product Detail View OR Catalog Grid */}
      {selectedProduct ? (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          <button
            type="button"
            onClick={() => onSelectProduct(null)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0058A3] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to results ({products.length})</span>
          </button>

          <div className="p-3.5 rounded-xl bg-[#F5F5F5] border border-[#E5E5E5] space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0058A3] block">
                  {selectedProduct.category}
                </span>
                <h3 className="text-lg font-black tracking-tight text-[#111111]">
                  {selectedProduct.name}
                </h3>
                <p className="text-xs text-[#555555]">{selectedProduct.typeName}</p>
              </div>
              <span className="px-2 py-1 bg-white border border-[#E5E5E5] rounded text-[11px] font-mono font-bold text-[#111111]">
                {selectedProduct.articleNumber}
              </span>
            </div>

            {selectedProduct.imageUrl ? (
              <div className="relative w-full h-36 bg-white rounded-lg border border-[#E5E5E5] overflow-hidden flex items-center justify-center p-2">
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.silhouette-fallback');
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
                <div className="silhouette-fallback hidden absolute inset-0">
                  <ProductSilhouetteThumb
                    product={selectedProduct}
                    colorHex={selectedProduct.swatches[selectedSwatchIndex]?.hex}
                    className="w-full h-full"
                    showDimensionsBadge={true}
                  />
                </div>
              </div>
            ) : (
              <ProductSilhouetteThumb
                product={selectedProduct}
                colorHex={selectedProduct.swatches[selectedSwatchIndex]?.hex}
                className="w-full h-36 rounded-lg border border-[#E5E5E5]"
                showDimensionsBadge={true}
              />
            )}

            <div className="pt-1 flex items-baseline gap-2">
              <span className="text-xl font-black text-[#111111]">
                {selectedProduct.priceCzk.toLocaleString('cs-CZ')} Kč
              </span>
              <span className="text-xs font-semibold text-[#555555]">
                / €{selectedProduct.priceEur}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#111111] bg-white px-3 py-2 rounded-lg border border-[#E5E5E5]">
              <Ruler className="w-4 h-4 text-[#0058A3] shrink-0" />
              <span className="font-semibold">Exact Dimensions:</span>
              <span className="font-mono">
                {selectedProduct.dimensionsCm.width} × {selectedProduct.dimensionsCm.depth} ×{' '}
                {selectedProduct.dimensionsCm.height} cm
              </span>
            </div>

            <p className="text-xs text-[#444444] leading-relaxed">
              {selectedProduct.materialDescription}
            </p>

            {/* Color Swatches */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#555555] block">
                Finish / Color:{' '}
                <span className="text-[#111111]">
                  {selectedProduct.swatches[selectedSwatchIndex]?.name ||
                    selectedProduct.swatches[0]?.name}
                </span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedProduct.swatches.map((sw, idx) => {
                  const isSel = idx === selectedSwatchIndex;
                  return (
                    <button
                      key={sw.name}
                      type="button"
                      onClick={() => setSelectedSwatchIndex(idx)}
                      title={sw.name}
                      className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-transform cursor-pointer ${
                        isSel ? 'border-[#0058A3] scale-110 shadow-sm' : 'border-[#CCCCCC]'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    >
                      {isSel && (
                        <Check
                          className={`w-3.5 h-3.5 ${
                            sw.hex.toLowerCase() === '#ffffff' || sw.hex.toLowerCase() > '#dddddd'
                              ? 'text-[#111111]'
                              : 'text-white'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                disabled={insertingProductId === selectedProduct.id}
                onClick={() => {
                  const sw =
                    selectedProduct.swatches[selectedSwatchIndex] || selectedProduct.swatches[0];
                  onInsertProductAs3D(selectedProduct, sw.hex, sw.name);
                }}
                className="w-full py-2.5 px-4 bg-[#0058A3] hover:bg-[#004F93] text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Box className="w-4 h-4 text-[#FFDB00]" />
                <span>
                  {insertingProductId === selectedProduct.id
                    ? 'Laser-Scanning 20–40 Part 3D CAD...'
                    : 'Insert as 3D into Active Room'}
                </span>
              </button>

              {insertingProductId === selectedProduct.id && (
                <div className="mt-2 space-y-1">
                  <div className="w-full h-1.5 bg-[#E5E5E5] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0058A3] transition-all duration-150"
                      style={{ width: `${insertProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 gap-2">
          {products.map((product) => {
            const isInserting = insertingProductId === product.id;
            const sw = product.swatches[0] || { name: 'Standard', hex: '#CCCCCC' };
            return (
              <div
                key={product.id}
                onClick={() => handleOpenProduct(product)}
                className="group p-2.5 rounded-lg bg-white hover:bg-[#F5F5F5] border border-[#E5E5E5] hover:border-[#0058A3] transition-all cursor-pointer flex flex-col gap-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {product.imageUrl ? (
                      <div className="w-16 h-14 rounded-md border border-[#E5E5E5] shrink-0 overflow-hidden relative shadow-2xs bg-[#F5F5F5] flex items-center justify-center">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain p-0.5"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.list-silhouette-fallback');
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }}
                        />
                        <div className="list-silhouette-fallback hidden absolute inset-0">
                          <ProductSilhouetteThumb
                            product={product}
                            colorHex={sw.hex}
                            className="w-full h-full"
                            showDimensionsBadge={false}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-14 rounded-md border border-[#E5E5E5] shrink-0 overflow-hidden relative shadow-2xs bg-[#F5F5F5]">
                        <ProductSilhouetteThumb
                          product={product}
                          colorHex={sw.hex}
                          className="w-full h-full"
                          showDimensionsBadge={false}
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs tracking-tight text-[#111111]">
                          {product.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#F5F5F5] border border-[#E5E5E5] rounded text-[#555555]">
                          {product.articleNumber}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#555555] truncate">{product.typeName}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-xs text-[#111111]">
                      {product.priceCzk.toLocaleString('cs-CZ')} Kč
                    </div>
                    <div className="text-[10px] text-[#666666]">€{product.priceEur}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#F0F0F0]">
                  <div className="flex items-center gap-2 text-[10px] text-[#555555] font-mono">
                    <span>
                      {product.dimensionsCm.width}×{product.dimensionsCm.depth}×
                      {product.dimensionsCm.height} cm
                    </span>
                    <div className="flex items-center gap-1">
                      {product.swatches.slice(0, 4).map((s) => (
                        <span
                          key={s.name}
                          className="w-2.5 h-2.5 rounded-xs border border-[#CCCCCC]"
                          style={{ backgroundColor: s.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInsertProductAs3D(product, sw.hex, sw.name);
                    }}
                    className="px-2.5 py-1 bg-[#0058A3] hover:bg-[#004F93] text-white text-[11px] font-bold rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Tag className="w-3 h-3 text-[#FFDB00]" />
                    <span>{isInserting ? `${insertProgress}%` : 'Insert as 3D'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
