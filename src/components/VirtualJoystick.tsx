import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface VirtualJoystickValue {
  x: number; // -1 (left) to +1 (right)
  y: number; // -1 (forward/up) to +1 (backward/down)
  isSprint: boolean;
}

interface VirtualJoystickProps {
  onMove: (val: VirtualJoystickValue) => void;
  visible?: boolean;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onMove,
  visible = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [isSprint, setIsSprint] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const radius = 54; // Max travel radius in px

  const handlePointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null) return;
    const target = ev.currentTarget;
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    centerRef.current = { x: cx, y: cy };
    activePointerIdRef.current = ev.pointerId;
    target.setPointerCapture(ev.pointerId);
    setIsActive(true);

    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    updateKnob(dx, dy);
  };

  const updateKnob = useCallback((dx: number, dy: number) => {
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(radius, dist);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;

    setKnobPos({ x: kx, y: ky });

    const normX = Number((kx / radius).toFixed(3));
    const normY = Number((ky / radius).toFixed(3));
    const autoSprint = clampedDist > radius * 0.88;

    onMove({
      x: normX,
      y: normY,
      isSprint: isSprint || autoSprint,
    });
  }, [isSprint, onMove]);

  const handlePointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== ev.pointerId) return;
    const dx = ev.clientX - centerRef.current.x;
    const dy = ev.clientY - centerRef.current.y;
    updateKnob(dx, dy);
  };

  const handlePointerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== ev.pointerId) return;
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    } catch {
      // Ignored
    }
    activePointerIdRef.current = null;
    setIsActive(false);
    setKnobPos({ x: 0, y: 0 });
    onMove({ x: 0, y: 0, isSprint: false });
  };

  if (!visible) return null;

  return (
    <div
      className="absolute bottom-6 left-6 z-20 flex flex-col items-center gap-2 select-none touch-none pointer-events-auto"
      style={{ touchAction: 'none' }}
    >
      {/* Sprint Toggle Pill */}
      <button
        type="button"
        onClick={() => setIsSprint((prev) => !prev)}
        className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider transition-all shadow-md cursor-pointer ${
          isSprint
            ? 'bg-[#FFDB00] text-black ring-2 ring-[#0058A3]'
            : 'bg-black/50 text-white/80 hover:bg-black/70 backdrop-blur-md border border-white/10'
        }`}
      >
        {isSprint ? '⚡ SPRINT ON' : 'WALK (TAP TO RUN)'}
      </button>

      {/* Outer Joystick Ring */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-32 h-32 rounded-full border-2 transition-all flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-md shadow-2xl ${
          isActive
            ? 'bg-[#0058A3]/30 border-[#0058A3] ring-4 ring-[#0058A3]/20 scale-105'
            : 'bg-black/40 border-white/20 hover:border-white/40'
        }`}
        style={{ touchAction: 'none' }}
      >
        {/* Cardinal Axis Crosshairs */}
        <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-[1px] bg-white/10 pointer-events-none" />
        <div className="absolute inset-y-3 left-1/2 -translate-x-1/2 w-[1px] bg-white/10 pointer-events-none" />

        {/* Direction Labels */}
        <span className="absolute top-1.5 text-[9px] font-bold text-white/40 pointer-events-none">▲</span>
        <span className="absolute bottom-1.5 text-[9px] font-bold text-white/40 pointer-events-none">▼</span>
        <span className="absolute left-2 text-[9px] font-bold text-white/40 pointer-events-none">◀</span>
        <span className="absolute right-2 text-[9px] font-bold text-white/40 pointer-events-none">▶</span>

        {/* Draggable Thumb Knob */}
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform pointer-events-none ${
            isActive
              ? 'bg-gradient-to-tr from-[#0058A3] to-[#0077D4] text-white ring-2 ring-[#FFDB00]'
              : 'bg-white/80 text-black/70 backdrop-blur-sm'
          }`}
          style={{
            transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
            transition: isActive ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
        >
          <div className="w-5 h-5 rounded-full border border-black/20 bg-white/30" />
        </div>
      </div>
    </div>
  );
};
