import React from 'react';
import { X, Glasses, Monitor, Radio, Tag, Move, Navigation } from 'lucide-react';
import { CameraMode } from './StudioViewport';

interface CoopModalProps {
  isOpen: boolean;
  cameraMode: CameraMode;
  connectedPeersCount: number;
  webXrStatus: string;
  onClose: () => void;
  onSelectCameraMode: (mode: CameraMode) => void;
  onStartHardwareWebXr: (mode: 'immersive-vr' | 'immersive-ar') => void;
  onShowAllVrPriceTags: (visible: boolean) => void;
}

export const CoopModal: React.FC<CoopModalProps> = ({
  isOpen,
  cameraMode,
  connectedPeersCount,
  webXrStatus,
  onClose,
  onSelectCameraMode,
  onStartHardwareWebXr,
  onShowAllVrPriceTags,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coop-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
    >
      <div className="bg-white border border-[#E5E5E5] rounded-xl max-w-xl w-full overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
          <div>
            <h2 id="coop-modal-title" className="text-base font-extrabold text-[#111111]">
              Asymmetric Co-op: PC Operator + VR Walkthrough
            </h2>
            <p className="text-xs text-[#484848] mt-0.5">
              Live multi-window sync via BroadcastChannel (&lsquo;nordicspace_ikea_sync&rsquo;)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Co-op modal"
            className="p-1.5 text-[#484848] hover:text-[#111111] hover:bg-[#EBEBEB] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Role Switcher Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                onSelectCameraMode('orbit3d');
                onClose();
              }}
              className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                cameraMode !== 'vr_walkthrough'
                  ? 'border-[#0058A3] bg-[#F0F6FC]'
                  : 'border-[#E5E5E5] bg-white hover:border-[#111111]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Monitor className="w-5 h-5 text-[#0058A3]" />
                <span className="text-[11px] font-semibold text-[#0058A3]">Role 1</span>
              </div>
              <div className="text-sm font-bold text-[#111111]">PC Operator Studio</div>
              <p className="text-xs text-[#484848] mt-1 leading-relaxed">
                Browse the IKEA catalog, scrape live URLs, customize room walls & floors, and drop 3D furniture in Orbit or 2D Floorplan view.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectCameraMode('vr_walkthrough');
                onShowAllVrPriceTags(true);
                onClose();
              }}
              className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                cameraMode === 'vr_walkthrough'
                  ? 'border-[#0058A3] bg-[#F0F6FC]'
                  : 'border-[#E5E5E5] bg-white hover:border-[#111111]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Glasses className="w-5 h-5 text-[#0058A3]" />
                <span className="text-[11px] font-semibold text-[#0058A3]">Role 2</span>
              </div>
              <div className="text-sm font-bold text-[#111111]">1:1 VR Walkthrough (1.65m)</div>
              <p className="text-xs text-[#484848] mt-1 leading-relaxed">
                Explore inside the room at 1.65m human eye height. Point at floor to teleport, drag furniture, and pop up 3D IKEA price tags.
              </p>
            </button>
          </div>

          {/* Hardware WebXR Launchers */}
          <div className="p-4 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111111]">
                WebXR Headset Session (Meta Quest / Vision Pro / PCVR)
              </span>
              <span className="text-[11px] font-mono-num text-[#484848]">
                {webXrStatus === 'xr_active'
                  ? 'WebXR Session Active'
                  : '1.65m Eye-Level Ready'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onSelectCameraMode('vr_walkthrough');
                  onShowAllVrPriceTags(true);
                  onStartHardwareWebXr('immersive-vr');
                  onClose();
                }}
                className="py-2.5 px-3 bg-[#0058A3] hover:bg-[#004F93] text-white text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Glasses className="w-4 h-4" />
                <span>Enter Immersive VR</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectCameraMode('vr_walkthrough');
                  onShowAllVrPriceTags(true);
                  onStartHardwareWebXr('immersive-ar');
                  onClose();
                }}
                className="py-2.5 px-3 bg-white hover:bg-[#EBEBEB] text-[#111111] border border-[#CCCCCC] text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Glasses className="w-4 h-4 text-[#0058A3]" />
                <span>Enter Immersive AR</span>
              </button>
            </div>

            {/* VR Controller Mapping Reference */}
            <div className="pt-2 border-t border-[#E0E0E0] grid grid-cols-3 gap-2 text-[11px] text-[#484848]">
              <div className="flex items-start gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-[#0058A3] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#111111]">Laser Floor Click:</strong> Teleport 1.65m view
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <Move className="w-3.5 h-3.5 text-[#0058A3] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#111111]">Grip (Squeeze):</strong> Grab & slide/rotate
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#0058A3] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#111111]">Trigger / DblClick:</strong> Pop 3D Price Tag
                </span>
              </div>
            </div>
          </div>

          {/* BroadcastChannel Status */}
          <div className="flex items-center justify-between text-xs text-[#484848] pt-1">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#0058A3]" />
              <span>
                Channel: <code className="font-mono-num text-[#111111]">nordicspace_ikea_sync</code> ({connectedPeersCount > 0 ? `${connectedPeersCount} co-op window synced` : 'Ready for multi-window sync'})
              </span>
            </span>
            <button
              type="button"
              onClick={() => onShowAllVrPriceTags(true)}
              className="text-[#0058A3] font-semibold hover:underline cursor-pointer"
            >
              Show All 3D Price Tags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
