import React from 'react';
import {
  Maximize2,
  Layers,
  PaintBucket,
  DoorOpen,
  Plus,
  Trash2,
  Home,
  Move,
} from 'lucide-react';
import type {
  ApartmentRoom,
  FloorFinishType,
  RoomType,
  WallFinishType,
  WallId,
  WallOpening,
} from '../types/ikea';
import {
  FLOOR_FINISH_OPTIONS,
  ROOM_TYPES,
  WALL_FINISH_OPTIONS,
  WALL_PAINT_SWATCHES,
} from '../data/ikeaCatalog';

interface ArchitecturePanelProps {
  rooms: ApartmentRoom[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  onAddRoom: (roomType: RoomType) => void;
  onDeleteRoom: (roomId: string) => void;
  onUpdateActiveRoom: (updater: (prev: ApartmentRoom) => ApartmentRoom) => void;
  selectedWall: WallId | null;
  onSelectWall: (wall: WallId | null) => void;
}

export const ArchitecturePanel: React.FC<ArchitecturePanelProps> = ({
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddRoom,
  onDeleteRoom,
  onUpdateActiveRoom,
  selectedWall,
  onSelectWall,
}) => {
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0];
  const currentWall: WallId = selectedWall || 'north';
  const currentWallSpec = activeRoom.walls[currentWall];

  const handleDimensionChange = (key: 'width' | 'length' | 'height', value: number) => {
    const min = key === 'height' ? 2.2 : 2.2;
    const max = key === 'height' ? 4.2 : 12.0;
    const clamped = Math.min(max, Math.max(min, Number(value.toFixed(2))));
    onUpdateActiveRoom((prev) => ({
      ...prev,
      [key]: clamped,
    }));
  };

  const handlePositionChange = (axisIndex: 0 | 1, value: number) => {
    const clamped = Math.min(18, Math.max(-18, Number(value.toFixed(2))));
    onUpdateActiveRoom((prev) => {
      const nextPos: [number, number] = [...prev.position];
      nextPos[axisIndex] = clamped;
      return { ...prev, position: nextPos };
    });
  };

  const handleWallUpdate = (wall: WallId, patch: Partial<{ colorHex: string; finish: WallFinishType }>) => {
    onUpdateActiveRoom((prev) => ({
      ...prev,
      walls: {
        ...prev.walls,
        [wall]: {
          ...prev.walls[wall],
          ...patch,
        },
      },
    }));
  };

  const handleApplyToAllWalls = () => {
    const spec = activeRoom.walls[currentWall];
    onUpdateActiveRoom((prev) => ({
      ...prev,
      walls: {
        north: { ...spec },
        south: { ...spec },
        east: { ...spec },
        west: { ...spec },
      },
    }));
  };

  const handleAddOpening = (type: WallOpening['type']) => {
    const isDoorOrArch = type === 'Door' || type === 'Open Archway';
    const newOp: WallOpening = {
      id: `op-${Date.now().toString().slice(-4)}`,
      wall: currentWall,
      type,
      width: type === 'Double Casement Window' ? 1.8 : type === 'Open Archway' ? 1.4 : 1.0,
      height: isDoorOrArch ? 2.1 : type === 'Floor-to-Ceiling Balcony Glazing' ? 2.2 : 1.35,
      sillHeight: isDoorOrArch ? 0 : type === 'Floor-to-Ceiling Balcony Glazing' ? 0.15 : 0.85,
      offset: 0,
    };
    onUpdateActiveRoom((prev) => ({
      ...prev,
      openings: [...prev.openings, newOp],
    }));
  };

  const handleUpdateOpening = (id: string, patch: Partial<WallOpening>) => {
    onUpdateActiveRoom((prev) => ({
      ...prev,
      openings: prev.openings.map((op) => (op.id === id ? { ...op, ...patch } : op)),
    }));
  };

  const handleRemoveOpening = (id: string) => {
    onUpdateActiveRoom((prev) => ({
      ...prev,
      openings: prev.openings.filter((o) => o.id !== id),
    }));
  };

  return (
    <div className="flex flex-col h-full bg-white text-[#111111] overflow-y-auto p-3.5 space-y-4">
      {/* 1. Multi-Room Apartment Manager */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0058A3]">
            <Home className="w-3.5 h-3.5" />
            <span>Apartment Rooms ({rooms.length})</span>
          </div>
          {rooms.length > 1 && (
            <button
              type="button"
              onClick={() => onDeleteRoom(activeRoom.id)}
              className="text-[11px] text-red-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete Room</span>
            </button>
          )}
        </div>

        {/* Room Selector Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {rooms.map((r) => {
            const isSel = r.id === activeRoom.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectRoom(r.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  isSel
                    ? 'bg-[#0058A3] text-white border-[#0058A3]'
                    : 'bg-[#F5F5F5] text-[#222222] border-[#E5E5E5] hover:bg-[#EAEAEA]'
                }`}
              >
                {r.name.split('/')[0].trim()} ({r.width.toFixed(1)}×{r.length.toFixed(1)}m)
              </button>
            );
          })}
        </div>

        {/* Add Connected Room Buttons */}
        <div className="p-2.5 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5] space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#555555] block">
            + Add New Room to Apartment:
          </span>
          <div className="grid grid-cols-3 gap-1">
            {ROOM_TYPES.map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => onAddRoom(rt)}
                className="px-2 py-1 bg-white hover:bg-[#0058A3] hover:text-white border border-[#DCDCDC] rounded text-[11px] font-bold text-[#222222] flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{rt}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Exact Numeric Dimensions & 3D Drag Handle Sync */}
      <div className="space-y-2 pt-2 border-t border-[#E5E5E5]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0058A3]">
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Room Dimensions & Position (m)</span>
          </div>
          <span className="text-[10px] font-mono bg-[#F5F5F5] px-2 py-0.5 rounded border border-[#E5E5E5]">
            Area: {(activeRoom.width * activeRoom.length).toFixed(1)} m²
          </span>
        </div>
        <p className="text-[11px] text-[#555555]">
          Tip: Drag the blue 3D wall handles or yellow corner orb in the 3D viewport, or type exact meters below:
        </p>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]">
            <label className="text-[10px] font-bold text-[#555555] block">Width (X m)</label>
            <input
              type="number"
              step={0.1}
              min={2.2}
              max={12.0}
              value={activeRoom.width}
              onChange={(e) => handleDimensionChange('width', Number(e.target.value))}
              className="w-full mt-1 px-2 py-1 bg-white border border-[#CCCCCC] rounded text-xs font-mono font-bold"
            />
          </div>
          <div className="p-2 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]">
            <label className="text-[10px] font-bold text-[#555555] block">Length (Z m)</label>
            <input
              type="number"
              step={0.1}
              min={2.2}
              max={12.0}
              value={activeRoom.length}
              onChange={(e) => handleDimensionChange('length', Number(e.target.value))}
              className="w-full mt-1 px-2 py-1 bg-white border border-[#CCCCCC] rounded text-xs font-mono font-bold"
            />
          </div>
          <div className="p-2 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]">
            <label className="text-[10px] font-bold text-[#555555] block">Ceiling (Y m)</label>
            <input
              type="number"
              step={0.05}
              min={2.2}
              max={4.2}
              value={activeRoom.height}
              onChange={(e) => handleDimensionChange('height', Number(e.target.value))}
              className="w-full mt-1 px-2 py-1 bg-white border border-[#CCCCCC] rounded text-xs font-mono font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5] flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-[#555555] flex items-center gap-1">
              <Move className="w-3 h-3 text-[#0058A3]" /> Pos X (m):
            </span>
            <input
              type="number"
              step={0.2}
              value={activeRoom.position[0]}
              onChange={(e) => handlePositionChange(0, Number(e.target.value))}
              className="w-20 px-2 py-0.5 bg-white border border-[#CCCCCC] rounded text-xs font-mono font-bold text-right"
            />
          </div>
          <div className="p-2 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5] flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-[#555555] flex items-center gap-1">
              <Move className="w-3 h-3 text-[#0058A3]" /> Pos Z (m):
            </span>
            <input
              type="number"
              step={0.2}
              value={activeRoom.position[1]}
              onChange={(e) => handlePositionChange(1, Number(e.target.value))}
              className="w-20 px-2 py-0.5 bg-white border border-[#CCCCCC] rounded text-xs font-mono font-bold text-right"
            />
          </div>
        </div>
      </div>

      {/* 3. Custom Floor Material + RGB Tint per Room */}
      <div className="space-y-2 pt-2 border-t border-[#E5E5E5]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0058A3]">
            <Layers className="w-3.5 h-3.5" />
            <span>Floor Finish & RGB Tint</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#555555] font-semibold">Tint:</span>
            <input
              type="color"
              value={activeRoom.floorTintHex || '#FFFFFF'}
              onChange={(e) =>
                onUpdateActiveRoom((prev) => ({ ...prev, floorTintHex: e.target.value }))
              }
              className="w-6 h-6 rounded border border-[#CCCCCC] cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {FLOOR_FINISH_OPTIONS.map((f) => {
            const active = activeRoom.floorFinish === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  onUpdateActiveRoom((prev) => ({
                    ...prev,
                    floorFinish: f.id as FloorFinishType,
                  }))
                }
                className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  active
                    ? 'border-[#0058A3] bg-[#0058A3]/8 font-bold'
                    : 'border-[#E5E5E5] bg-[#F5F5F5] hover:bg-[#EAEAEA]'
                }`}
              >
                <span
                  className="w-5 h-5 rounded border border-[#CCCCCC] shrink-0"
                  style={{ backgroundColor: f.previewHex }}
                />
                <span className="text-[11px] text-[#111111] truncate">{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Per-Wall Paint Color & Architectural Cladding */}
      <div className="space-y-2 pt-2 border-t border-[#E5E5E5]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0058A3]">
            <PaintBucket className="w-3.5 h-3.5" />
            <span>Per-Wall Finish & Paint</span>
          </div>
          <button
            type="button"
            onClick={handleApplyToAllWalls}
            className="text-[11px] font-bold text-[#0058A3] hover:underline cursor-pointer"
          >
            Apply to all 4 walls
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 bg-[#F5F5F5] p-1 rounded-lg border border-[#E5E5E5]">
          {(['north', 'south', 'east', 'west'] as WallId[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onSelectWall(w)}
              className={`py-1 rounded text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                currentWall === w
                  ? 'bg-[#111111] text-white'
                  : 'text-[#555555] hover:bg-white'
              }`}
            >
              {w}
            </button>
          ))}
        </div>

        <div className="p-2.5 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5] space-y-2">
          <select
            value={currentWallSpec.finish}
            onChange={(e) =>
              handleWallUpdate(currentWall, { finish: e.target.value as WallFinishType })
            }
            className="w-full px-2.5 py-1.5 bg-white border border-[#CCCCCC] rounded text-xs font-semibold text-[#111111]"
          >
            {WALL_FINISH_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#555555]">Custom RGB Color:</span>
            <input
              type="color"
              value={currentWallSpec.colorHex}
              onChange={(e) => handleWallUpdate(currentWall, { colorHex: e.target.value })}
              className="w-7 h-7 rounded border border-[#CCCCCC] cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {WALL_PAINT_SWATCHES.map((sw) => (
              <button
                key={sw.hex}
                type="button"
                onClick={() => handleWallUpdate(currentWall, { colorHex: sw.hex })}
                title={sw.name}
                className={`h-7 rounded border-2 transition-transform cursor-pointer ${
                  currentWallSpec.colorHex.toLowerCase() === sw.hex.toLowerCase()
                    ? 'border-[#0058A3] scale-105'
                    : 'border-[#CCCCCC]'
                }`}
                style={{ backgroundColor: sw.hex }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 5. Resizable Architectural Windows, Doors & Open Archways */}
      <div className="space-y-2 pt-2 border-t border-[#E5E5E5]">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0058A3]">
          <DoorOpen className="w-3.5 h-3.5" />
          <span>Resizable Windows & Doors ({currentWall.toUpperCase()} Wall)</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleAddOpening('Double Casement Window')}
            className="py-1.5 px-2 bg-[#F5F5F5] hover:bg-[#E5E5E5] border border-[#DCDCDC] rounded text-[11px] font-bold text-[#111111] flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3 text-[#0058A3]" />
            <span>Window</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddOpening('Door')}
            className="py-1.5 px-2 bg-[#F5F5F5] hover:bg-[#E5E5E5] border border-[#DCDCDC] rounded text-[11px] font-bold text-[#111111] flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3 text-[#0058A3]" />
            <span>Door</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddOpening('Open Archway')}
            className="py-1.5 px-2 bg-[#F5F5F5] hover:bg-[#E5E5E5] border border-[#DCDCDC] rounded text-[11px] font-bold text-[#111111] flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3 text-[#0058A3]" />
            <span>Archway</span>
          </button>
        </div>

        <div className="space-y-2">
          {activeRoom.openings.map((op) => (
            <div
              key={op.id}
              className="p-2.5 bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#111111] block">{op.type}</span>
                  <span className="text-[10px] font-mono uppercase text-[#0058A3]">
                    {op.wall} Wall
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveOpening(op.id)}
                  className="p-1 text-[#767676] hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <label className="font-bold text-[#555555] block">
                    Width: {op.width.toFixed(2)}m
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={3.2}
                    step={0.05}
                    value={op.width}
                    onChange={(e) => handleUpdateOpening(op.id, { width: Number(e.target.value) })}
                    className="w-full accent-[#0058A3]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#555555] block">
                    Height: {op.height.toFixed(2)}m
                  </label>
                  <input
                    type="range"
                    min={0.6}
                    max={2.5}
                    step={0.05}
                    value={op.height}
                    onChange={(e) => handleUpdateOpening(op.id, { height: Number(e.target.value) })}
                    className="w-full accent-[#0058A3]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#555555] block">
                    Wall Offset: {op.offset.toFixed(2)}m
                  </label>
                  <input
                    type="range"
                    min={-2.2}
                    max={2.2}
                    step={0.05}
                    value={op.offset}
                    onChange={(e) => handleUpdateOpening(op.id, { offset: Number(e.target.value) })}
                    className="w-full accent-[#0058A3]"
                  />
                </div>
                {op.type !== 'Door' && op.type !== 'Open Archway' && (
                  <div>
                    <label className="font-bold text-[#555555] block">
                      Sill Height: {op.sillHeight.toFixed(2)}m
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={1.5}
                      step={0.05}
                      value={op.sillHeight}
                      onChange={(e) =>
                        handleUpdateOpening(op.id, { sillHeight: Number(e.target.value) })
                      }
                      className="w-full accent-[#0058A3]"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
