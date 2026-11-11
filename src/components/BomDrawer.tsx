import React from 'react';
import { X, ShoppingBag, Plus, Minus, Trash2, Download, Focus } from 'lucide-react';
import { BomSummary, IkeaProduct } from '../types/ikea';
import { formatCZK, formatEUR } from '../utils/roomLogic';
import { ProductSilhouetteThumb } from './ProductSilhouetteThumb';

interface BomDrawerProps {
  isOpen: boolean;
  bomSummary: BomSummary;
  onClose: () => void;
  onIncrementItem: (product: IkeaProduct, colorHex: string) => void;
  onDecrementItem: (instanceId: string) => void;
  onSelectInstance: (instanceId: string) => void;
  onClearRoom: () => void;
}

export const BomDrawer: React.FC<BomDrawerProps> = ({
  isOpen,
  bomSummary,
  onClose,
  onIncrementItem,
  onDecrementItem,
  onSelectInstance,
  onClearRoom,
}) => {
  if (!isOpen) return null;

  const handleExportBom = () => {
    const csvRows = [
      ['Article Number', 'Product Name', 'Subtitle', 'Finish/Color', 'Dimensions (cm)', 'Qty', 'Unit CZK', 'Total CZK', 'Total EUR'].join(','),
      ...bomSummary.items.map((item) =>
        [
          `"${item.product.articleNumber}"`,
          `"${item.product.name}"`,
          `"${item.product.subtitle}"`,
          `"${item.selectedSwatchName}"`,
          `"${item.product.dimensionsCm.width}x${item.product.dimensionsCm.depth}x${item.product.dimensionsCm.height}"`,
          item.quantity,
          item.unitPriceCZK,
          item.lineTotalCZK,
          item.lineTotalEUR,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ikea-room-shopping-list-bom.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bom-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/35"
    >
      <div className="w-full max-w-md bg-white h-full border-l border-[#E5E5E5] flex flex-col justify-between shadow-2xl">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#0058A3] text-[#FFDB00] flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 id="bom-drawer-title" className="text-base font-extrabold text-[#111111]">
                Room Shopping List & BOM
              </h2>
              <p className="text-xs text-[#484848]">
                {bomSummary.totalCount} IKEA items placed · {bomSummary.totalFloorAreaM2} m² footprint
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shopping list drawer"
            className="p-1.5 text-[#484848] hover:text-[#111111] hover:bg-[#EBEBEB] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Itemized List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {bomSummary.items.length === 0 ? (
            <div className="text-center py-12 px-4 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]">
              <p className="text-sm font-semibold text-[#111111]">Your 3D room is empty</p>
              <p className="text-xs text-[#484848] mt-1">
                Select any item from the IKEA Webstore Catalog on the left to insert it into your room.
              </p>
            </div>
          ) : (
            bomSummary.items.map((line) => (
              <div
                key={`${line.product.id}_${line.selectedColorHex}`}
                className="p-3 bg-white border border-[#E5E5E5] rounded-lg flex items-center gap-3"
              >
                <ProductSilhouetteThumb
                  product={line.product}
                  colorHex={line.selectedColorHex}
                  showDimensionsBadge={false}
                  className="w-20 h-20 rounded shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-mono-num text-[#484848]">
                      {line.product.articleNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectInstance(line.instanceIds[0]);
                        onClose();
                      }}
                      className="text-[11px] text-[#0058A3] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Focus className="w-3 h-3" />
                      <span>Locate in 3D</span>
                    </button>
                  </div>

                  <div className="text-sm font-bold text-[#111111] truncate">
                    {line.product.name}
                  </div>
                  <div className="text-xs text-[#484848] truncate">
                    {line.selectedSwatchName} · {line.product.dimensionsCm.width}×{line.product.dimensionsCm.depth} cm
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-sm font-extrabold font-mono-num text-[#111111]">
                      {formatCZK(line.lineTotalCZK)}{' '}
                      <span className="text-xs font-normal text-[#484848]">
                        ({formatEUR(line.lineTotalEUR)})
                      </span>
                    </div>

                    {/* Quantity Steppers */}
                    <div className="flex items-center gap-1 bg-[#F5F5F5] rounded border border-[#E5E5E5] px-1 py-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          onDecrementItem(line.instanceIds[line.instanceIds.length - 1])
                        }
                        aria-label={`Remove one ${line.product.name}`}
                        className="p-1 text-[#111111] hover:bg-white rounded cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold font-mono-num px-1.5">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onIncrementItem(line.product, line.selectedColorHex)}
                        aria-label={`Add another ${line.product.name}`}
                        className="p-1 text-[#111111] hover:bg-white rounded cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Totals & Actions */}
        <div className="p-6 border-t border-[#E5E5E5] bg-[#FAFAFA] space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[#484848]">
              <span>Total Placed Furniture Pieces</span>
              <span className="font-mono-num font-semibold text-[#111111]">
                {bomSummary.totalCount} pcs
              </span>
            </div>
            <div className="flex justify-between text-xs text-[#484848]">
              <span>Total EUR Equivalent</span>
              <span className="font-mono-num font-semibold text-[#111111]">
                {formatEUR(bomSummary.totalPriceEUR)}
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-[#E5E5E5]">
              <span className="text-sm font-bold text-[#111111]">Total Room Budget (CZK)</span>
              <span
                data-testid="bom-total-czk"
                className="text-2xl font-extrabold font-mono-num text-[#0058A3]"
              >
                {formatCZK(bomSummary.totalPriceCZK)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportBom}
              disabled={bomSummary.items.length === 0}
              className="flex-1 py-2.5 px-4 bg-[#0058A3] hover:bg-[#004F93] disabled:bg-[#CCCCCC] text-white text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export IKEA BOM (CSV)</span>
            </button>
            {bomSummary.items.length > 0 && (
              <button
                type="button"
                onClick={onClearRoom}
                className="py-2.5 px-3 bg-white hover:bg-red-50 text-red-600 border border-[#E5E5E5] text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
