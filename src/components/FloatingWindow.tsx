import React, { useRef } from 'react';
import { GripHorizontal, Minus, Maximize2, X } from 'lucide-react';
import type { FloatingWindowState } from '../types/ikea';

interface FloatingWindowProps {
  win: FloatingWindowState;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onUpdate: (patch: Partial<FloatingWindowState>) => void;
  onFocus: () => void;
  children: React.ReactNode;
}

export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  win,
  icon,
  badge,
  onUpdate,
  onFocus,
  children,
}) => {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const resizeRef = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);

  if (!win.isOpen) return null;

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    onFocus();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: win.x,
      origY: win.y,
    };

    const handleMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const nx = Math.max(8, Math.min(window.innerWidth - 180, dragRef.current.origX + (ev.clientX - dragRef.current.startX)));
      const ny = Math.max(58, Math.min(window.innerHeight - 52, dragRef.current.origY + (ev.clientY - dragRef.current.startY)));
      onUpdate({ x: nx, y: ny });
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onFocus();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: win.width,
      origH: win.height,
    };

    const handleMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return;
      const nw = Math.max(300, Math.min(720, resizeRef.current.origW + (ev.clientX - resizeRef.current.startX)));
      const nh = Math.max(260, Math.min(window.innerHeight - win.y - 16, resizeRef.current.origH + (ev.clientY - resizeRef.current.startY)));
      onUpdate({ width: nw, height: nh });
    };

    const handleUp = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <section
      onPointerDown={onFocus}
      style={{
        left: `${win.x}px`,
        top: `${win.y}px`,
        width: `${win.width}px`,
        height: win.isMinimized ? 'auto' : `${win.height}px`,
        zIndex: win.zIndex,
      }}
      className="fixed bg-white/96 backdrop-blur-md border border-[#E5E5E5] rounded-xl shadow-[0_14px_38px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden select-none"
    >
      {/* Draggable Window Title Bar */}
      <div
        onPointerDown={handleHeaderPointerDown}
        className="px-3.5 py-2.5 bg-[#F5F5F5] border-b border-[#E5E5E5] flex items-center justify-between cursor-grab active:cursor-grabbing shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-4 h-4 text-[#767676] shrink-0" />
          {icon}
          <span className="text-xs font-bold uppercase tracking-wider text-[#111111] truncate">
            {win.title}
          </span>
          {badge}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onUpdate({ isMinimized: !win.isMinimized })}
            title={win.isMinimized ? 'Expand Window' : 'Minimize Window'}
            className="p-1 rounded hover:bg-[#E5E5E5] text-[#555555] transition-colors"
          >
            {win.isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ isOpen: false })}
            title="Close Window"
            className="p-1 rounded hover:bg-red-100 hover:text-red-700 text-[#555555] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Window Content Body */}
      {!win.isMinimized && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative select-text">
          {children}

          {/* Bottom-Right Corner Resize Handle */}
          <div
            onPointerDown={handleResizePointerDown}
            title="Drag to resize window"
            className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-30 flex items-end justify-end p-1 text-[#767676] hover:text-[#0058A3]"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9M9 5L5 9M9 9H9.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}
    </section>
  );
};
