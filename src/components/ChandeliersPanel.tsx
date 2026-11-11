import React from 'react';
import { Lightbulb, Plus, Trash2, Power, Sun } from 'lucide-react';
import type {
  ApartmentRoom,
  ChandelierCatalogItem,
  PlacedChandelier,
} from '../types/ikea';
import { CHANDELIER_CATALOG } from '../data/ikeaCatalog';
import { kelvinToHex } from '../utils/roomLogic';

interface ChandeliersPanelProps {
  rooms: ApartmentRoom[];
  activeRoomId: string;
  chandeliers: PlacedChandelier[];
  selectedChandelierId: string | null;
  onSelectChandelier: (id: string | null) => void;
  onInsertChandelier: (item: ChandelierCatalogItem) => void;
  onUpdateChandelier: (id: string, patch: Partial<PlacedChandelier>) => void;
  onRemoveChandelier: (id: string) => void;
}

export const ChandeliersPanel: React.FC<ChandeliersPanelProps> = ({
  rooms,
  activeRoomId,
  chandeliers,
  selectedChandelierId,
  onSelectChandelier,
  onInsertChandelier,
  onUpdateChandelier,
  onRemoveChandelier,
}) => {
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0];
  const selectedChandelier =
    chandeliers.find((c) => c.instanceId === selectedChandelierId) ||
    chandeliers.find((c) => c.roomId === activeRoomId) ||
    chandeliers[0] ||
    null;

  return (
    <div className="flex flex-col h-full bg-white text-[#111111] overflow-y-auto p-3.5 space-y-4">
      {/* Selected or Active Ceiling Chandelier Live Controls */}
      {selectedChandelier && (
        <div className="p-3 rounded-xl bg-[#F5F5F5] border border-[#E5E5E5] space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0058A3] block">
                Active Ceiling Fixture (Lustr)
              </span>
              <h4 className="text-sm font-black text-[#111111]">
                {selectedChandelier.catalogItem.name}
              </h4>
              <p className="text-[11px] text-[#555555]">
                {selectedChandelier.catalogItem.typeName}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  onUpdateChandelier(selectedChandelier.instanceId, {
                    isOn: !selectedChandelier.isOn,
                  })
                }
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  selectedChandelier.isOn
                    ? 'bg-[#FFDB00] text-[#111111]'
                    : 'bg-[#E5E5E5] text-[#555555]'
                }`}
              >
                <Power className="w-3 h-3" />
                <span>{selectedChandelier.isOn ? 'ON' : 'OFF'}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveChandelier(selectedChandelier.instanceId)}
                className="p-1.5 rounded bg-white hover:bg-red-50 text-[#767676] hover:text-red-600 border border-[#E5E5E5] cursor-pointer"
                title="Remove Chandelier"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
            <div>
              <label className="font-bold text-[#555555] flex justify-between">
                <span>Drop Cable:</span>
                <span className="font-mono text-[#111111]">
                  {selectedChandelier.dropCableHeight.toFixed(2)}m
                </span>
              </label>
              <input
                type="range"
                min={0.1}
                max={1.6}
                step={0.05}
                value={selectedChandelier.dropCableHeight}
                onChange={(e) =>
                  onUpdateChandelier(selectedChandelier.instanceId, {
                    dropCableHeight: Number(e.target.value),
                  })
                }
                className="w-full accent-[#0058A3]"
              />
            </div>

            <div>
              <label className="font-bold text-[#555555] flex justify-between">
                <span>Fixture Scale:</span>
                <span className="font-mono text-[#111111]">
                  {Math.round(selectedChandelier.scale * 100)}%
                </span>
              </label>
              <input
                type="range"
                min={0.6}
                max={1.8}
                step={0.05}
                value={selectedChandelier.scale}
                onChange={(e) =>
                  onUpdateChandelier(selectedChandelier.instanceId, {
                    scale: Number(e.target.value),
                  })
                }
                className="w-full accent-[#0058A3]"
              />
            </div>

            <div>
              <label className="font-bold text-[#555555] flex justify-between">
                <span>Brightness:</span>
                <span className="font-mono text-[#111111]">
                  {selectedChandelier.brightness}%
                </span>
              </label>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={selectedChandelier.brightness}
                onChange={(e) =>
                  onUpdateChandelier(selectedChandelier.instanceId, {
                    brightness: Number(e.target.value),
                  })
                }
                className="w-full accent-[#0058A3]"
              />
            </div>

            <div>
              <label className="font-bold text-[#555555] flex justify-between items-center">
                <span>Color Temp:</span>
                <span className="font-mono text-[#111111] flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-[#CCCCCC]"
                    style={{ backgroundColor: kelvinToHex(selectedChandelier.colorTempK) }}
                  />
                  {selectedChandelier.colorTempK}K
                </span>
              </label>
              <input
                type="range"
                min={2700}
                max={6000}
                step={100}
                value={selectedChandelier.colorTempK}
                onChange={(e) =>
                  onUpdateChandelier(selectedChandelier.instanceId, {
                    colorTempK: Number(e.target.value),
                  })
                }
                className="w-full accent-[#0058A3]"
              />
            </div>
          </div>

          {/* Placed Chandeliers switcher */}
          {chandeliers.length > 1 && (
            <div className="pt-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {chandeliers.map((ch) => {
                const roomName =
                  rooms.find((r) => r.id === ch.roomId)?.name.split('/')[0].trim() || 'Room';
                const active = ch.instanceId === selectedChandelier.instanceId;
                return (
                  <button
                    key={ch.instanceId}
                    type="button"
                    onClick={() => onSelectChandelier(ch.instanceId)}
                    className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap cursor-pointer border ${
                      active
                        ? 'bg-[#0058A3] text-white border-[#0058A3]'
                        : 'bg-white text-[#333333] border-[#DCDCDC]'
                    }`}
                  >
                    {ch.catalogItem.name.split(' ')[0]} ({roomName})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chandeliers & Ceiling Lights Catalog (Lustry) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0058A3]">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Ceiling Chandeliers Catalog (Lustry)</span>
          </div>
          <span className="text-[10px] text-[#555555]">
            Target: <strong>{activeRoom.name.split('/')[0].trim()}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {CHANDELIER_CATALOG.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-lg bg-[#F5F5F5] hover:bg-[#EAEAEA] border border-[#E5E5E5] flex items-center justify-between gap-2 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#111111] text-[#FFDB00] flex items-center justify-center shrink-0">
                  <Sun className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-[#111111] truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-[#E5E5E5] rounded text-[#555555]">
                      {item.articleNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#555555] truncate">{item.typeName}</p>
                  <span className="text-[11px] font-bold text-[#111111]">
                    {item.priceCzk.toLocaleString('cs-CZ')} Kč / €{item.priceEur}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onInsertChandelier(item)}
                className="px-2.5 py-1.5 bg-[#0058A3] hover:bg-[#004F93] text-white text-[11px] font-bold rounded-md flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#FFDB00]" />
                <span>Mount on Ceiling</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
