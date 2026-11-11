import React, { useEffect, useState } from 'react';
import { X, Box, Sparkles, Check, Ruler, Layers } from 'lucide-react';
import { IkeaProduct } from '../types/ikea';
import { formatCZK, formatEUR } from '../utils/roomLogic';
import { ProductSilhouetteThumb } from './ProductSilhouetteThumb';

interface ProductDetailModalProps {
  product: IkeaProduct | null;
  onClose: () => void;
  onInsertIntoRoom: (
    product: IkeaProduct,
    swatchIndex: number,
    useGeminiSynthesis: boolean,
    onProgress: (pct: number) => void
  ) => Promise<void>;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onInsertIntoRoom,
}) => {
  const [selectedSwatchIndex, setSelectedSwatchIndex] = useState(0);
  const [useGeminiSynthesis, setUseGeminiSynthesis] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (product) {
      setSelectedSwatchIndex(product.defaultSwatchIndex ?? 0);
      setUseGeminiSynthesis(Boolean(product.isCustomScraped));
      setIsGenerating(false);
      setProgress(0);
    }
  }, [product]);

  if (!product) return null;

  const activeSwatch = product.swatches[selectedSwatchIndex] || product.swatches[0];

  const handleInsertClick = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setProgress(8);
    try {
      await onInsertIntoRoom(product, selectedSwatchIndex, useGeminiSynthesis, (pct) => {
        setProgress(pct);
      });
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
    >
      <div className="bg-white border border-[#E5E5E5] rounded-xl max-w-2xl w-full overflow-hidden shadow-xl">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="flex items-center gap-2 text-xs text-[#484848]">
            <span className="font-semibold text-[#0058A3]">{product.category}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">Article No. {product.articleNumber}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product detail card"
            className="p-1.5 text-[#484848] hover:text-[#111111] hover:bg-[#EBEBEB] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Left Preview Column */}
          <div className="flex flex-col justify-between bg-[#F5F5F5] rounded-lg p-4 border border-[#E5E5E5]">
            <ProductSilhouetteThumb
              product={product}
              colorHex={activeSwatch?.hex}
              className="w-full h-56 rounded"
            />

            <div className="mt-4 pt-3 border-t border-[#E0E0E0] grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[11px] text-[#484848]">Width</div>
                <div className="text-sm font-bold font-mono-num text-[#111111]">
                  {product.dimensionsCm.width} cm
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#484848]">Depth</div>
                <div className="text-sm font-bold font-mono-num text-[#111111]">
                  {product.dimensionsCm.depth} cm
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#484848]">Height</div>
                <div className="text-sm font-bold font-mono-num text-[#111111]">
                  {product.dimensionsCm.height} cm
                </div>
              </div>
            </div>
          </div>

          {/* Right Specifications & Purchase / 3D Spawner Module */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <h2
                  id="product-detail-title"
                  className="text-2xl font-extrabold tracking-tight text-[#111111]"
                >
                  {product.name}
                </h2>
                <span className="text-xs font-mono-num font-semibold text-[#111111] bg-[#FFDB00] px-2 py-0.5 rounded">
                  {product.articleNumber}
                </span>
              </div>
              <p className="text-sm text-[#484848] mt-1">{product.subtitle}</p>

              {/* Bold Price Tag */}
              <div className="mt-4 pb-4 border-b border-[#E5E5E5]">
                <div className="text-2xl font-extrabold font-mono-num text-[#111111]">
                  {formatCZK(product.priceCZK)}
                  <span className="text-base font-medium text-[#484848] ml-2">
                    / {formatEUR(product.priceEUR)}
                  </span>
                </div>
                <div className="text-xs text-[#484848] mt-1 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#0058A3]" />
                  <span>
                    Exact 1:1 CAD Scale: {(product.dimensionsCm.width / 100).toFixed(2)}m ×{' '}
                    {(product.dimensionsCm.depth / 100).toFixed(2)}m ×{' '}
                    {(product.dimensionsCm.height / 100).toFixed(2)}m
                  </span>
                </div>
              </div>

              {/* Materials & Construction Description */}
              <div className="mt-3">
                <h3 className="text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#0058A3]" />
                  <span>Materials & Construction</span>
                </h3>
                <p className="text-xs text-[#484848] leading-relaxed mt-1">
                  {product.materialsDescription}
                </p>
              </div>

              {/* Selectable Color Swatches */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-[#111111] mb-2">
                  Finish / Color: <span className="font-normal text-[#484848]">{activeSwatch?.name}</span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {product.swatches.map((swatch, idx) => {
                    const selected = idx === selectedSwatchIndex;
                    return (
                      <button
                        key={swatch.name}
                        type="button"
                        onClick={() => setSelectedSwatchIndex(idx)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#0058A3] bg-[#F0F6FC] text-[#111111] font-semibold'
                            : 'border-[#E5E5E5] bg-white text-[#484848] hover:border-[#111111]'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: swatch.hex }}
                        />
                        <span className="truncate max-w-[120px]">{swatch.name}</span>
                        {selected && <Check className="w-3 h-3 text-[#0058A3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3D Synthesis Mode Toggle (Parametric vs Gemini AI CAD Decomposition) */}
              <div className="mt-4 pt-3 border-t border-[#E5E5E5]">
                <label className="flex items-center justify-between gap-2 text-xs text-[#111111] cursor-pointer">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-[#0058A3]" />
                    <span>Synthesize custom 12–30 part CAD via Gemini AI</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={useGeminiSynthesis}
                    onChange={(e) => setUseGeminiSynthesis(e.target.checked)}
                    className="rounded border-[#CCCCCC] text-[#0058A3] focus:ring-[#0058A3]"
                  />
                </label>
              </div>
            </div>

            {/* Primary Action Button + Live 3-Second Generation Progress Bar */}
            <div className="mt-5">
              {isGenerating && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs font-medium text-[#0058A3] mb-1">
                    <span>
                      {useGeminiSynthesis
                        ? 'Gemini AI decomposing IKEA specs into 3D sub-meshes...'
                        : 'Constructing multi-part 3D IKEA model in room...'}
                    </span>
                    <span className="font-mono-num">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0058A3] transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={isGenerating}
                onClick={handleInsertClick}
                className="w-full py-3 px-4 bg-[#0058A3] hover:bg-[#004F93] disabled:bg-[#7A9EC2] text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Box className="w-4 h-4" />
                <span>
                  {isGenerating ? 'Spawning 3D Furniture into Room...' : 'Insert as 3D into Room'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
