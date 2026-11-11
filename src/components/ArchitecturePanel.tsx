import React, { useState } from 'react';
import {
  Sun,
  Sunset,
  Moon,
  Plus,
  Trash2,
  Eye,
  Maximize2,
  Paintbrush,
  DoorOpen,
} from 'lucide-react';
import {
  FloorFinishType,
  OpeningType,
  RoomConfig,
  TimeOfDayPreset,
  WallFinishPresetName,
  WallId,
  WallOpening,
} from '../types/ikea';
import { WALL_SWATCH_PRESETS } from '../data/ikeaCatalog';

interface ArchitecturePanelProps {
  roomConfig: RoomConfig;
  onUpdateRoomConfig: (updater: (prev: RoomConfig) => RoomConfig) => void;
}

const FLOOR_OPTIONS: Array<{ name: FloorFinishType; swatchHex: string; subtitle: string }> = [
  { name: 'Scandinavian Oak Parquet', swatchHex: '#D2B083', subtitle: 'Natural warm Nordic oak planks' },
  { name: 'Walnut Herringbone', swatchHex: '#6D4B36', subtitle: 'Classic 45° chevron walnut parquet' },
  { name: 'Light Ash Planks', swatchHex: '#E7D6BC', subtitle: 'Bleached wide-plank Nordic ash' },
  { name: 'Polished Concrete', swatchHex: '#C6C7C4', subtitle: 'Architectural satin micro-cement' },
  { name: 'Warm Beige Carpet', swatchHex: '#D9D0C1', subtitle: 'Soft woven wool-blend pile' },
  { name: 'Large Ceramic Tiles', swatchHex: '#E8E6E1', subtitle: '60×60 cm travertine stone tiles' },
];

const OPENING_TEMPLATES: Array<{
  type: OpeningType;
  widthMeters: number;
  heightMeters: number;
  sillHeightMeters: number;
}> = [
  {
    type: 'Floor-to-Ceiling French Window',
    widthMeters: 2.0,
    heightMeters: 2.2,
    sillHeightMeters: 0.15,
  },
  {
    type: 'Double Casement Window',
    widthMeters: 1.4,
    heightMeters: 1.3,
    sillHeightMeters: 0.85,
  },
  {
    type: 'Modern Oak Door',
    widthMeters: 0.95,
    heightMeters: 2.1,
    sillHeightMeters: 0.0,
  },
  {
    type: 'Industrial Glass Door',
    widthMeters: 1.4,
    heightMeters: 2.15,
    sillHeightMeters: 0.0,
  },
];

export const ArchitecturePanel: React.FC<ArchitecturePanelProps> = ({
  roomConfig,
  onUpdateRoomConfig,
}) => {
  const [targetWall, setTargetWall] = useState<'all' | WallId>('all');
  const [newOpeningType, setNewOpeningType] = useState<OpeningType>('Double Casement Window');
  const [newOpeningWall, setNewOpeningWall] = useState<WallId>('east');

  const activeWallObj =
    targetWall === 'all' ? roomConfig.walls.north : roomConfig.walls[targetWall];

  const applyWallUpdate = (colorHex: string, finishPreset: WallFinishPresetName) => {
    onUpdateRoomConfig((prev) => {
      if (targetWall === 'all') {
        return {
          ...prev,
          walls: {
            north: { colorHex, finishPreset },
            south: { colorHex, finishPreset },
            east: { colorHex, finishPreset },
            west: { colorHex, finishPreset },
          },
        };
      }
      return {
        ...prev,
        walls: {
          ...prev.walls,
          [targetWall]: { colorHex, finishPreset },
        },
      };
    });
  };

  const handleAddOpening = () => {
    const tmpl =
      OPENING_TEMPLATES.find((t) => t.type === newOpeningType) || OPENING_TEMPLATES[0];
    const newOp: WallOpening = {
      id: `op-${Date.now()}`,
      type: tmpl.type,
      wall: newOpeningWall,
      offsetMeters: 0,
      widthMeters: tmpl.widthMeters,
      heightMeters: Math.min(tmpl.heightMeters, roomConfig.ceilingHeight - 0.25),
      sillHeightMeters: tmpl.sillHeightMeters,
    };
    onUpdateRoomConfig((prev) => ({
      ...prev,
      openings: [...prev.openings, newOp],
    }));
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto p-4 space-y-6">
      {/* 1. Time of Day Lighting Presets */}
      <section aria-labelledby="tod-heading">
        <h3 id="tod-heading" className="text-xs font-bold text-[#111111] mb-2">
          Time of Day & Natural Sunlight
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'Daylight', label: 'Daylight', icon: Sun },
              { id: 'Golden Hour Sunset', label: 'Sunset', icon: Sunset },
              { id: 'Cozy Evening', label: 'Evening', icon: Moon },
            ] as Array<{ id: TimeOfDayPreset; label: string; icon: React.ElementType }>
          ).map(({ id, label, icon: Icon }) => {
            const active = roomConfig.timeOfDay === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onUpdateRoomConfig((prev) => ({ ...prev, timeOfDay: id }))}
                className={`py-2 px-2.5 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#0058A3] text-white border-[#0058A3]'
                    : 'bg-[#F5F5F5] text-[#111111] border-[#E5E5E5] hover:border-[#111111]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Room Dimensions Sliders & Smart Wall Cutaway */}
      <section aria-labelledby="dims-heading" className="pt-4 border-t border-[#E5E5E5] space-y-3">
        <div className="flex items-center justify-between">
          <h3 id="dims-heading" className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-[#0058A3]" />
            <span>Room Dimensions</span>
          </h3>
          <span className="text-xs font-mono-num text-[#484848]">
            {(roomConfig.width * roomConfig.length).toFixed(1)} m²
          </span>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <label htmlFor="room-width-slider" className="text-[#484848]">
              Room Width (X)
            </label>
            <span className="font-semibold font-mono-num text-[#111111]">
              {roomConfig.width.toFixed(1)} m
            </span>
          </div>
          <input
            id="room-width-slider"
            type="range"
            min={3.0}
            max={10.0}
            step={0.2}
            value={roomConfig.width}
            onChange={(e) =>
              onUpdateRoomConfig((prev) => ({ ...prev, width: parseFloat(e.target.value) }))
            }
            className="w-full accent-[#0058A3] cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <label htmlFor="room-length-slider" className="text-[#484848]">
              Room Length (Z)
            </label>
            <span className="font-semibold font-mono-num text-[#111111]">
              {roomConfig.length.toFixed(1)} m
            </span>
          </div>
          <input
            id="room-length-slider"
            type="range"
            min={3.0}
            max={10.0}
            step={0.2}
            value={roomConfig.length}
            onChange={(e) =>
              onUpdateRoomConfig((prev) => ({ ...prev, length: parseFloat(e.target.value) }))
            }
            className="w-full accent-[#0058A3] cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <label htmlFor="room-height-slider" className="text-[#484848]">
              Ceiling Height (Y)
            </label>
            <span className="font-semibold font-mono-num text-[#111111]">
              {roomConfig.ceilingHeight.toFixed(1)} m
            </span>
          </div>
          <input
            id="room-height-slider"
            type="range"
            min={2.4}
            max={4.0}
            step={0.1}
            value={roomConfig.ceilingHeight}
            onChange={(e) =>
              onUpdateRoomConfig((prev) => ({
                ...prev,
                ceilingHeight: parseFloat(e.target.value),
              }))
            }
            className="w-full accent-[#0058A3] cursor-pointer"
          />
        </div>

        <label className="flex items-center justify-between pt-1 text-xs text-[#111111] cursor-pointer">
          <span className="flex items-center gap-1.5 font-medium">
            <Eye className="w-3.5 h-3.5 text-[#0058A3]" />
            <span>Smart Wall Cutaway (Auto-hide near walls)</span>
          </span>
          <input
            type="checkbox"
            checked={roomConfig.smartWallCutaway}
            onChange={(e) =>
              onUpdateRoomConfig((prev) => ({ ...prev, smartWallCutaway: e.target.checked }))
            }
            className="rounded border-[#CCCCCC] text-[#0058A3]"
          />
        </label>
      </section>

      {/* 3. Custom Floor Finishes */}
      <section aria-labelledby="floors-heading" className="pt-4 border-t border-[#E5E5E5]">
        <h3 id="floors-heading" className="text-xs font-bold text-[#111111] mb-2.5">
          Custom Floors
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {FLOOR_OPTIONS.map((fl) => {
            const active = roomConfig.floorFinish === fl.name;
            return (
              <button
                key={fl.name}
                type="button"
                onClick={() =>
                  onUpdateRoomConfig((prev) => ({ ...prev, floorFinish: fl.name }))
                }
                className={`p-2.5 rounded-md border text-left transition-colors flex items-start gap-2.5 cursor-pointer ${
                  active
                    ? 'border-[#0058A3] bg-[#F0F6FC]'
                    : 'border-[#E5E5E5] bg-white hover:border-[#111111]'
                }`}
              >
                <span
                  className="w-5 h-5 rounded border border-black/15 shrink-0 mt-0.5"
                  style={{ backgroundColor: fl.swatchHex }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#111111] truncate">{fl.name}</div>
                  <div className="text-[10px] text-[#484848] truncate">{fl.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Custom Walls (Per-Wall or All Walls + RGB Color Picker + Designer Swatches) */}
      <section aria-labelledby="walls-heading" className="pt-4 border-t border-[#E5E5E5] space-y-3">
        <div className="flex items-center justify-between">
          <h3 id="walls-heading" className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
            <Paintbrush className="w-3.5 h-3.5 text-[#0058A3]" />
            <span>Custom Walls & Finishes</span>
          </h3>
        </div>

        {/* Wall Target Selector */}
        <div className="flex items-center gap-1 bg-[#F5F5F5] p-1 rounded-md">
          {(
            [
              { id: 'all', label: 'All Walls' },
              { id: 'north', label: 'North' },
              { id: 'south', label: 'South' },
              { id: 'east', label: 'East' },
              { id: 'west', label: 'West' },
            ] as Array<{ id: 'all' | WallId; label: string }>
          ).map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setTargetWall(w.id)}
              className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                targetWall === w.id
                  ? 'bg-white text-[#111111] shadow-xs font-semibold'
                  : 'text-[#484848] hover:text-[#111111]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        {/* Designer Swatches */}
        <div className="grid grid-cols-2 gap-2">
          {WALL_SWATCH_PRESETS.map((sw) => {
            const active =
              activeWallObj.finishPreset === sw.name &&
              activeWallObj.colorHex.toLowerCase() === sw.hex.toLowerCase();
            return (
              <button
                key={sw.name}
                type="button"
                onClick={() => applyWallUpdate(sw.hex, sw.name)}
                className={`p-2 rounded-md border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-[#0058A3] bg-[#F0F6FC]'
                    : 'border-[#E5E5E5] bg-white hover:border-[#111111]'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                  style={{ backgroundColor: sw.hex }}
                />
                <span className="text-xs font-medium text-[#111111] truncate">{sw.name}</span>
              </button>
            );
          })}
        </div>

        {/* Full RGB Custom Color Picker */}
        <div className="flex items-center justify-between bg-[#F5F5F5] px-3 py-2 rounded-md border border-[#E5E5E5]">
          <label htmlFor="wall-rgb-picker" className="text-xs font-medium text-[#111111]">
            Custom RGB Wall Paint
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono-num text-[#484848]">
              {activeWallObj.colorHex.toUpperCase()}
            </span>
            <input
              id="wall-rgb-picker"
              type="color"
              value={activeWallObj.colorHex}
              onChange={(e) => applyWallUpdate(e.target.value, 'Warm White')}
              className="w-7 h-7 rounded cursor-pointer border border-[#CCCCCC]"
            />
          </div>
        </div>
      </section>

      {/* 5. Windows & Doors Customizer */}
      <section aria-labelledby="openings-heading" className="pt-4 border-t border-[#E5E5E5] space-y-3">
        <h3 id="openings-heading" className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
          <DoorOpen className="w-3.5 h-3.5 text-[#0058A3]" />
          <span>Windows & Doors ({roomConfig.openings.length})</span>
        </h3>

        {/* Add New Window or Door */}
        <div className="p-3 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5] space-y-2.5">
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label htmlFor="new-opening-type" className="block text-[11px] text-[#484848] mb-1">
                Element Type
              </label>
              <select
                id="new-opening-type"
                value={newOpeningType}
                onChange={(e) => setNewOpeningType(e.target.value as OpeningType)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DFDFDF] rounded text-[#111111]"
              >
                {OPENING_TEMPLATES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.type} ({t.widthMeters}×{t.heightMeters}m)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="new-opening-wall" className="block text-[11px] text-[#484848] mb-1">
                  Wall Placement
                </label>
                <select
                  id="new-opening-wall"
                  value={newOpeningWall}
                  onChange={(e) => setNewOpeningWall(e.target.value as WallId)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DFDFDF] rounded text-[#111111]"
                >
                  <option value="north">North Wall (Back)</option>
                  <option value="south">South Wall (Front)</option>
                  <option value="east">East Wall (Right)</option>
                  <option value="west">West Wall (Left)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddOpening}
                className="px-3 py-1.5 bg-[#0058A3] hover:bg-[#004F93] text-white text-xs font-semibold rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Wall</span>
              </button>
            </div>
          </div>
        </div>

        {/* Placed Openings List */}
        <div className="space-y-2">
          {roomConfig.openings.map((op) => (
            <div
              key={op.id}
              className="p-2.5 bg-white border border-[#E5E5E5] rounded-md space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-[#111111]">{op.type}</div>
                  <div className="text-[11px] text-[#484848] capitalize">
                    {op.wall} wall · {op.widthMeters}m × {op.heightMeters}m
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateRoomConfig((prev) => ({
                      ...prev,
                      openings: prev.openings.filter((item) => item.id !== op.id),
                    }))
                  }
                  aria-label={`Remove ${op.type}`}
                  className="p-1 text-[#484848] hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#484848] whitespace-nowrap">Wall Offset:</span>
                <input
                  type="range"
                  min={-2.5}
                  max={2.5}
                  step={0.1}
                  value={op.offsetMeters}
                  aria-label={`Wall offset for ${op.type}`}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onUpdateRoomConfig((prev) => ({
                      ...prev,
                      openings: prev.openings.map((item) =>
                        item.id === op.id ? { ...item, offsetMeters: val } : item
                      ),
                    }));
                  }}
                  className="flex-1 accent-[#0058A3] cursor-pointer"
                />
                <span className="text-[11px] font-mono-num text-[#111111] w-10 text-right">
                  {op.offsetMeters > 0 ? `+${op.offsetMeters.toFixed(1)}` : op.offsetMeters.toFixed(1)}m
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
