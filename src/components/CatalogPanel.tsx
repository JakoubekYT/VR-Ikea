import React, { useState } from 'react';
import { Search, Globe, Loader2, Plus, ArrowUpRight } from 'lucide-react';
import { IKEA_CATEGORIES } from '../data/ikeaCatalog';
import { IkeaCategory, IkeaProduct } from '../types/ikea';
import { formatCZK, formatEUR, parseIkeaUrl } from '../utils/roomLogic';
import { ProductSilhouetteThumb } from './ProductSilhouetteThumb';

interface CatalogPanelProps {
  catalog: IkeaProduct[];
  selectedCategory: IkeaCategory;
  searchQuery: string;
  isSearchingLive: boolean;
  liveSearchStatus: string | null;
  onSelectCategory: (cat: IkeaCategory) => void;
  onSearchChange: (q: string) => void;
  onTriggerLiveSearch: (queryOrUrl: string) => void;
  onOpenProductDetail: (product: IkeaProduct) => void;
  onQuickInsertProduct: (product: IkeaProduct, swatchIndex?: number) => void;
}

export const CatalogPanel: React.FC<CatalogPanelProps> = ({
  catalog,
  selectedCategory,
  searchQuery,
  isSearchingLive,
  liveSearchStatus,
  onSelectCategory,
  onSearchChange,
  onTriggerLiveSearch,
  onOpenProductDetail,
  onQuickInsertProduct,
}) => {
  const [activeSwatches, setActiveSwatches] = useState<Record<string, number>>({});

  const parsedUrl = parseIkeaUrl(searchQuery);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onTriggerLiveSearch(searchQuery.trim());
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search & Live URL Scraper Bar */}
      <div className="p-4 border-b border-[#E5E5E5] bg-[#FFFFFF]">
        <form onSubmit={handleFormSubmit} className="space-y-2">
          <label htmlFor="ikea-store-search" className="block text-xs font-semibold text-[#111111]">
            Search IKEA Catalog or Paste Product URL
          </label>
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#484848] absolute left-3 pointer-events-none" />
            <input
              id="ikea-store-search"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="e.g. ergonomic chair, hemnes, or https://www.ikea.com/cz/cs/p/..."
              className="w-full pl-9 pr-24 py-2 text-xs bg-[#F5F5F5] border border-[#DFDFDF] rounded-md text-[#111111] placeholder-[#767676] focus:bg-white focus:border-[#0058A3] focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isSearchingLive || !searchQuery.trim()}
              className="absolute right-1 top-1 bottom-1 px-2.5 bg-[#0058A3] hover:bg-[#004F93] disabled:bg-[#CCCCCC] text-white text-[11px] font-semibold rounded transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSearchingLive ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Fetching</span>
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3" />
                  <span>{parsedUrl.isUrl ? 'Scrape URL' : 'AI Search'}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick-try sample queries / URLs */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[11px] text-[#484848]">
          <span className="text-[#767676]">Try live:</span>
          <button
            type="button"
            onClick={() => {
              const q = 'https://www.ikea.com/cz/cs/p/landskrona-3mistna-pohovka-gunnared-svetle-zelena-drevo-s39270326/';
              onSearchChange(q);
              onTriggerLiveSearch(q);
            }}
            className="underline hover:text-[#0058A3] transition-colors cursor-pointer whitespace-nowrap"
          >
            URL: LANDSKRONA
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => {
              const q = 'ergonomic chair';
              onSearchChange(q);
              onTriggerLiveSearch(q);
            }}
            className="underline hover:text-[#0058A3] transition-colors cursor-pointer whitespace-nowrap"
          >
            &ldquo;ergonomic chair&rdquo;
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => {
              const q = 'dětská postel';
              onSearchChange(q);
              onTriggerLiveSearch(q);
            }}
            className="underline hover:text-[#0058A3] transition-colors cursor-pointer whitespace-nowrap"
          >
            &ldquo;dětská postel&rdquo;
          </button>
          {searchQuery && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="text-[#0058A3] font-medium hover:underline cursor-pointer"
              >
                Clear
              </button>
            </>
          )}
        </div>

        {liveSearchStatus && (
          <div className="mt-2 px-2.5 py-1.5 bg-[#F5F5F5] border border-[#E5E5E5] rounded text-[11px] text-[#111111] flex items-center justify-between">
            <span className="truncate">{liveSearchStatus}</span>
          </div>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div
        role="tablist"
        aria-label="IKEA Product Categories"
        className="px-4 py-2.5 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center gap-1.5 overflow-x-auto shrink-0"
      >
        {IKEA_CATEGORIES.map((category) => {
          const active = selectedCategory === category;
          return (
            <button
              key={category}
              role="tab"
              aria-selected={active}
              onClick={() => onSelectCategory(category)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#0058A3] text-white'
                  : 'bg-white text-[#484848] border border-[#E5E5E5] hover:border-[#111111] hover:text-[#111111]'
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {catalog.length === 0 ? (
          <div className="text-center py-10 px-4 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]">
            <p className="text-sm font-semibold text-[#111111]">
              No local match for &ldquo;{searchQuery}&rdquo;
            </p>
            <p className="text-xs text-[#484848] mt-1 mb-4">
              Search live across the IKEA catalog or scrape any IKEA product URL via Gemini AI.
            </p>
            <button
              type="button"
              onClick={() => onTriggerLiveSearch(searchQuery)}
              disabled={isSearchingLive}
              className="px-4 py-2 bg-[#0058A3] hover:bg-[#004F93] text-white text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              {isSearchingLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              <span>Search Live IKEA Store via Gemini</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {catalog.map((product) => {
              const swatchIdx = activeSwatches[product.id] ?? product.defaultSwatchIndex ?? 0;
              const currentSwatch = product.swatches[swatchIdx] || product.swatches[0];

              return (
                <article
                  key={product.id}
                  className="bg-white border border-[#E5E5E5] hover:border-[#0058A3] rounded-lg overflow-hidden transition-colors group"
                >
                  <div className="flex">
                    {/* Left Silhouette Thumbnail (clickable for detail modal) */}
                    <button
                      type="button"
                      onClick={() => onOpenProductDetail(product)}
                      className="w-32 shrink-0 relative text-left cursor-pointer focus:outline-none"
                      aria-label={`Inspect ${product.name} details`}
                    >
                      <ProductSilhouetteThumb
                        product={product}
                        colorHex={currentSwatch?.hex}
                        className="w-32 h-full min-h-[124px]"
                      />
                    </button>

                    {/* Right Content */}
                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div>
                        {/* Unboxed quiet metadata line */}
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#484848]">
                          <span className="font-mono-num">{product.articleNumber}</span>
                          <span>·</span>
                          <span className="truncate">{product.category}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenProductDetail(product)}
                          className="mt-0.5 text-left group-hover:text-[#0058A3] transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <h3 className="text-sm font-bold tracking-tight text-[#111111] group-hover:text-[#0058A3]">
                            {product.name}
                          </h3>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#0058A3] transition-opacity" />
                        </button>

                        <p className="text-xs text-[#484848] line-clamp-1 mt-0.5">
                          {product.subtitle}
                        </p>
                      </div>

                      {/* Price & Color Swatches + Quick Insert */}
                      <div className="mt-2.5 pt-2 border-t border-[#F0F0F0] flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold font-mono-num text-[#111111] whitespace-nowrap">
                            {formatCZK(product.priceCZK)}
                            <span className="text-[11px] font-normal text-[#484848] ml-1">
                              ({formatEUR(product.priceEUR)})
                            </span>
                          </div>
                          {/* Color Swatch Dots */}
                          <div className="flex items-center gap-1.5 mt-1" role="group" aria-label={`Color swatches for ${product.name}`}>
                            {product.swatches.map((sw, idx) => (
                              <button
                                key={sw.name}
                                type="button"
                                title={sw.name}
                                aria-label={`Select color ${sw.name} for ${product.name}`}
                                onClick={() =>
                                  setActiveSwatches((prev) => ({ ...prev, [product.id]: idx }))
                                }
                                className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                                  idx === swatchIdx
                                    ? 'border-[#0058A3] ring-1 ring-[#0058A3] scale-110'
                                    : 'border-[#CCCCCC] hover:scale-105'
                                }`}
                                style={{ backgroundColor: sw.hex }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenProductDetail(product)}
                            className="px-2.5 py-1.5 text-[11px] font-medium text-[#111111] bg-[#F5F5F5] hover:bg-[#E5E5E5] rounded transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickInsertProduct(product, swatchIdx)}
                            className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#0058A3] hover:bg-[#004F93] rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                            aria-label={`Insert ${product.name} as 3D into Room`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Insert 3D</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
