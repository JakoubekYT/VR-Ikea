import React from 'react';
import { ShoppingBag, Trash2 } from 'lucide-react';
import type { PlacedChandelier, PlacedFurnitureItem } from '../types/ikea';
import { calculateBomSummary } from '../utils/roomLogic';

interface BomDrawerProps {
  placedItems: PlacedFurnitureItem[];
  chandeliers: PlacedChandelier[];
  onSelectInstance: (instanceId: string) => void;
  onRemoveInstance: (instanceId: string) => void;
  onClearRoom: () => void;
}

export const BomDrawer: React.FC<BomDrawerProps> = ({
  placedItems,
  chandeliers,
  onSelectInstance,
  onRemoveInstance,
  onClearRoom,
}) => {
  const summary = calculateBomSummary(placedItems, chandeliers);

  return (
    <div className="flex flex-col h-full bg-white text-[#111111]">
      <div className="px-3.5 py-2.5 bg-[#F5F5F5] border-b border-[#E5E5E5] flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#555555] block">
            Total Apartment Budget ({summary.totalItems} pcs)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-black text-[#111111]">
              {summary.totalCzk.toLocaleString('cs-CZ')} Kč
            </span>
            <span className="text-xs font-semibold text-[#555555]">
              (€{summary.totalEur.toLocaleString('en-IE')})
            </span>
          </div>
        </div>

        {placedItems.length > 0 && (
          <button
            type="button"
            onClick={onClearRoom}
            className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
          >
            Clear Furniture
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-[#E5E5E5]">
        {summary.lines.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#666666] flex flex-col items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-[#999999]" />
            <span>No IKEA items placed in the apartment yet.</span>
          </div>
        ) : (
          summary.lines.map((line) => (
            <div
              key={`${line.product.id}_${line.swatchName}`}
              onClick={() => {
                const match = placedItems.find((i) => i.productId === line.product.id);
                if (match) onSelectInstance(match.instanceId);
              }}
              className="px-3.5 py-2.5 hover:bg-[#F5F5F5] flex items-center justify-between gap-2 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-4 h-4 rounded-xs border border-[#CCCCCC] shrink-0"
                  style={{ backgroundColor: line.swatchHex }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xs text-[#111111]">
                      {line.quantity}× {line.product.name}
                    </span>
                    <span className="text-[10px] font-mono text-[#666666]">
                      {line.product.articleNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#555555] truncate">{line.swatchName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className="font-bold text-xs text-[#111111]">
                    {line.subtotalCzk.toLocaleString('cs-CZ')} Kč
                  </div>
                  <div className="text-[10px] text-[#666666]">€{line.subtotalEur}</div>
                </div>
                {placedItems.some((i) => i.productId === line.product.id) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const match = placedItems.find((i) => i.productId === line.product.id);
                      if (match) onRemoveInstance(match.instanceId);
                    }}
                    className="p-1 text-[#767676] hover:text-red-600 transition-colors cursor-pointer"
                    title="Remove one instance"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
