import React, { useRef, useState, useEffect } from 'react';
import { GripHorizontal, Minus, Maximize2, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { FloatingWindowState } from '../types/ikea';

interface FloatingWindowProps {
  win: FloatingWindowState;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onUpdate: (patch: Partial<FloatingWindowState>) => void;
  onFocus: () => void;
  children: React.ReactNode;
  isDarkMode?: boolean;
  isMobile?: boolean;
  onClose?: () => void;
}

export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  win,
  icon,
  badge,
  onUpdate,
  onFocus,
  children,
  isDarkMode = false,
  isMobile: isMobileProp,
  onClose,
}) => {
  // Mobile viewport detection fallback
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = isMobileProp !== undefined ? isMobileProp : isMobileViewport;

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
    if (isMobile) return; // Disable desktop free-drag on mobile drawer
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
      const nx = Math.max(
        8,
        Math.min(window.innerWidth - 180, dragRef.current.origX + (ev.clientX - dragRef.current.startX))
      );
      const ny = Math.max(
        58,
        Math.min(window.innerHeight - 52, dragRef.current.origY + (ev.clientY - dragRef.current.startY))
      );
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
    if (isMobile) return;
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
      const nw = Math.max(
        300,
        Math.min(window.innerWidth - 16, resizeRef.current.origW + (ev.clientX - resizeRef.current.startX))
      );
      const nh = Math.max(
        260,
        Math.min(window.innerHeight - win.y - 16, resizeRef.current.origH + (ev.clientY - resizeRef.current.startY))
      );
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

  const handleClose = () => {
    if (onClose) onClose();
    onUpdate({ isOpen: false });
  };

  // Dark Mode vs Light Mode Glassmorphic Panel Styles
  const containerStyleClasses = isDarkMode
    ? 'bg-[#18181B]/95 text-zinc-100 border-zinc-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-amber-500/20'
    : 'bg-white/96 text-[#111111] border-[#E5E5E5] shadow-[0_14px_38px_rgba(0,0,0,0.12)]';

  const headerStyleClasses = isDarkMode
    ? 'bg-[#222226] border-zinc-700/80 text-zinc-100'
    : 'bg-[#F5F5F5] border-[#E5E5E5] text-[#111111]';

  const buttonHoverClasses = isDarkMode
    ? 'hover:bg-zinc-700/80 text-zinc-300 hover:text-white'
    : 'hover:bg-[#E5E5E5] text-[#555555] hover:text-[#111111]';

  // MOBILE: Collapsible Docked Drawer Layout (< 768px)
  if (isMobile) {
    return (
      <section
        onPointerDown={onFocus}
        style={{
          zIndex: win.zIndex,
        }}
        className={`fixed inset-x-0 bottom-0 w-full backdrop-blur-xl border-t border-x rounded-t-2xl rounded-b-none flex flex-col overflow-hidden select-none transition-all duration-200 ${containerStyleClasses} ${
          win.isMinimized ? 'h-14 shadow-lg' : 'h-[78vh] max-h-[85vh] shadow-2xl'
        }`}
      >
        {/* Mobile Pull Bar & Touch Drag Handle */}
        <div
          onClick={() => onUpdate({ isMinimized: !win.isMinimized })}
          className={`px-3 py-1.5 border-b flex flex-col items-center justify-between cursor-pointer shrink-0 ${headerStyleClasses}`}
        >
          {/* Pill touch indicator */}
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600 mb-1" />

          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {icon}
              <span className="text-xs font-bold uppercase tracking-wider truncate">
                {win.title}
              </span>
              {badge}
            </div>

            {/* Touch-friendly buttons (min 44px tap targets) */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onUpdate({ isMinimized: !win.isMinimized })}
                title={win.isMinimized ? 'Rozbalit panel' : 'Minimalizovat panel'}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${buttonHoverClasses}`}
              >
                {win.isMinimized ? (
                  <ChevronUp className="w-5 h-5 text-[#0058A3] dark:text-amber-400" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                title="Zavřít panel"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-600 text-zinc-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Body */}
        {!win.isMinimized && (
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto relative select-text">
            {children}
          </div>
        )}
      </section>
    );
  }

  // DESKTOP: Draggable & Resizable Floating Glassmorphic Window (>= 768px)
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
      className={`fixed backdrop-blur-xl border rounded-xl flex flex-col overflow-hidden select-none transition-shadow ${containerStyleClasses}`}
    >
      {/* Draggable Window Title Bar */}
      <div
        onPointerDown={handleHeaderPointerDown}
        className={`px-3.5 py-2 border-b flex items-center justify-between cursor-grab active:cursor-grabbing shrink-0 ${headerStyleClasses}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-4 h-4 text-zinc-400 shrink-0" />
          {icon}
          <span className="text-xs font-bold uppercase tracking-wider truncate">
            {win.title}
          </span>
          {badge}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onUpdate({ isMinimized: !win.isMinimized })}
            title={win.isMinimized ? 'Expand Window' : 'Minimize Window'}
            className={`min-h-[36px] min-w-[36px] p-1.5 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${buttonHoverClasses}`}
          >
            {win.isMinimized ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Close Window"
            className="min-h-[36px] min-w-[36px] p-1.5 flex items-center justify-center rounded-lg hover:bg-red-500/15 hover:text-red-600 text-zinc-400 transition-colors cursor-pointer"
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
            className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-30 flex items-end justify-end p-1 text-zinc-400 hover:text-[#0058A3] dark:hover:text-amber-400 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M9 1L1 9M9 5L5 9M9 9H9.01"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      )}
    </section>
  );
};
