import React from 'react';
import { RotateCw, Copy, Trash2, X } from 'lucide-react';
import type { PlacedFurnitureItem } from '../types/ikea';

interface SelectedItemToolbarProps {
  item: PlacedFurnitureItem;
  onRotate: (deltaDeg: number) => void;
  onChangeSwatch: (swatchHex: string, swatchName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export const SelectedItemToolbar: React.FC<SelectedItemToolbarProps> = ({
  item,
  onRotate,
  onChangeSwatch,
  onDuplicate,
  onDelete,
  onClose,
}) => {
  return (
    <div className="pointer-events-auto bg-white/96 backdrop-blur-md border border-[#E5E5E5] rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.16)] px-4 py-2.5 flex items-center gap-3 flex-wrap max-w-[92vw]">
      {/* Product identity & dimensions */}
      <div className="flex items-center gap-2.5 pr-3 border-r border-[#E5E5E5]">
        <span
          className="w-6 h-6 rounded-md border border-[#CCCCCC] shrink-0"
          style={{ backgroundColor: item.swatchHex }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-[#111111]">{item.product.name}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#F5F5F5] border border-[#E5E5E5] rounded text-[#555555]">
              {item.product.dimensionsCm.width}×{item.product.dimensionsCm.depth}×
              {item.product.dimensionsCm.height} cm
            </span>
          </div>
          <p className="text-[10px] text-[#555555] truncate max-w-[180px]">
            {item.swatchName} • {item.rotationY}°
          </p>
        </div>
      </div>

      {/* Swatches */}
      <div className="flex items-center gap-1.5 pr-3 border-r border-[#E5E5E5]">
        {item.product.swatches.map((sw) => {
          const active = sw.hex.toLowerCase() === item.swatchHex.toLowerCase();
          return (
            <button
              key={sw.name}
              type="button"
              title={sw.name}
              onClick={() => onChangeSwatch(sw.hex, sw.name)}
              className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                active ? 'border-[#0058A3] scale-115' : 'border-[#CCCCCC]'
              }`}
              style={{ backgroundColor: sw.hex }}
            />
          );
        })}
      </div>

      {/* Rotation controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onRotate(-45)}
          className="px-2 py-1 bg-[#F5F5F5] hover:bg-[#E5E5E5] rounded-lg text-[11px] font-bold text-[#111111] flex items-center gap-1 cursor-pointer"
          title="Rotate -45°"
        >
          <RotateCw className="w-3.5 h-3.5 -scale-x-100 text-[#0058A3]" />
          <span>-45°</span>
        </button>
        <button
          type="button"
          onClick={() => onRotate(45)}
          className="px-2 py-1 bg-[#F5F5F5] hover:bg-[#E5E5E5] rounded-lg text-[11px] font-bold text-[#111111] flex items-center gap-1 cursor-pointer"
          title="Rotate +45°"
        >
          <RotateCw className="w-3.5 h-3.5 text-[#0058A3]" />
          <span>+45°</span>
        </button>
        <button
          type="button"
          onClick={() => onRotate(90)}
          className="px-2 py-1 bg-[#F5F5F5] hover:bg-[#E5E5E5] rounded-lg text-[11px] font-bold text-[#111111] cursor-pointer"
          title="Rotate +90°"
        >
          +90°
        </button>
      </div>

      {/* Duplicate & Delete */}
      <div className="flex items-center gap-1 pl-2 border-l border-[#E5E5E5]">
        <button
          type="button"
          onClick={onDuplicate}
          className="px-2.5 py-1 bg-[#F5F5F5] hover:bg-[#E5E5E5] rounded-lg text-[11px] font-bold text-[#111111] flex items-center gap-1 cursor-pointer"
          title="Duplicate item"
        >
          <Copy className="w-3.5 h-3.5 text-[#0058A3]" />
          <span>Duplicate</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          title="Delete item"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-[#767676] hover:text-[#111111] rounded-lg hover:bg-[#F5F5F5] cursor-pointer"
          title="Deselect"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
