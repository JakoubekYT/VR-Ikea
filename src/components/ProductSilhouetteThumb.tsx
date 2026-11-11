import React from 'react';
import { IkeaProduct } from '../types/ikea';

interface ProductSilhouetteThumbProps {
  product: IkeaProduct;
  colorHex?: string;
  className?: string;
  showDimensionsBadge?: boolean;
}

export const ProductSilhouetteThumb: React.FC<ProductSilhouetteThumbProps> = ({
  product,
  colorHex,
  className = 'w-full h-36',
  showDimensionsBadge = true,
}) => {
  const swatchHex = colorHex || product.swatches[product.defaultSwatchIndex ?? 0]?.hex || '#C8C0B4';
  const cat = product.category;
  const name = product.name.toUpperCase();

  return (
    <div
      className={`relative bg-[#F5F5F5] flex items-center justify-center overflow-hidden select-none ${className}`}
    >
      {/* Subtle studio floor horizon line */}
      <div className="absolute inset-x-0 bottom-0 h-8 bg-[#EBEBEB]" />

      <svg
        viewBox="0 0 200 130"
        className="w-4/5 h-4/5 relative z-10 drop-shadow-sm"
        aria-hidden="true"
      >
        {/* Floor contact shadow */}
        <ellipse cx="100" cy="112" rx="68" ry="8" fill="rgba(0,0,0,0.12)" />

        {cat === 'Sofas & Armchairs' && name.includes('STRANDMON') ? (
          <g>
            {/* Wing chair silhouette */}
            <rect x="70" y="92" width="6" height="18" rx="2" fill="#4A3525" />
            <rect x="124" y="92" width="6" height="18" rx="2" fill="#4A3525" />
            <rect x="64" y="22" width="72" height="72" rx="10" fill={swatchHex} stroke="#222" strokeOpacity="0.15" strokeWidth="1.5" />
            <rect x="56" y="26" width="14" height="44" rx="6" fill={swatchHex} stroke="#222" strokeOpacity="0.18" strokeWidth="1.5" />
            <rect x="130" y="26" width="14" height="44" rx="6" fill={swatchHex} stroke="#222" strokeOpacity="0.18" strokeWidth="1.5" />
            <rect x="58" y="64" width="84" height="30" rx="8" fill={swatchHex} stroke="#222" strokeOpacity="0.2" strokeWidth="1.5" />
            <circle cx="88" cy="44" r="2.5" fill="rgba(0,0,0,0.28)" />
            <circle cx="112" cy="44" r="2.5" fill="rgba(0,0,0,0.28)" />
            <circle cx="88" cy="58" r="2.5" fill="rgba(0,0,0,0.28)" />
            <circle cx="112" cy="58" r="2.5" fill="rgba(0,0,0,0.28)" />
          </g>
        ) : cat === 'Sofas & Armchairs' && (name.includes('POÄNG') || name.includes('POANG')) ? (
          <g>
            {/* Bentwood cantilever chair */}
            <path d="M62 108 H138 M66 108 L76 62 L68 24 H132 L124 62 L134 108" fill="none" stroke="#DFC599" strokeWidth="5" strokeLinecap="round" />
            <rect x="70" y="26" width="60" height="58" rx="8" fill={swatchHex} stroke="#222" strokeOpacity="0.16" strokeWidth="1.5" />
            <rect x="74" y="30" width="52" height="14" rx="5" fill={swatchHex} stroke="#222" strokeOpacity="0.22" strokeWidth="1.5" />
          </g>
        ) : cat === 'Sofas & Armchairs' ? (
          <g>
            {/* 3-Seat Sofa */}
            <rect x="36" y="100" width="6" height="10" rx="1" fill="#2C2A29" />
            <rect x="158" y="100" width="6" height="10" rx="1" fill="#2C2A29" />
            <rect x="38" y="38" width="124" height="44" rx="6" fill={swatchHex} stroke="#111" strokeOpacity="0.16" strokeWidth="1.5" />
            <rect x="26" y="56" width="18" height="44" rx="5" fill={swatchHex} stroke="#111" strokeOpacity="0.2" strokeWidth="1.5" />
            <rect x="156" y="56" width="18" height="44" rx="5" fill={swatchHex} stroke="#111" strokeOpacity="0.2" strokeWidth="1.5" />
            <rect x="44" y="68" width="37" height="32" rx="4" fill={swatchHex} stroke="#111" strokeOpacity="0.2" strokeWidth="1.5" />
            <rect x="81.5" y="68" width="37" height="32" rx="4" fill={swatchHex} stroke="#111" strokeOpacity="0.2" strokeWidth="1.5" />
            <rect x="119" y="68" width="37" height="32" rx="4" fill={swatchHex} stroke="#111" strokeOpacity="0.2" strokeWidth="1.5" />
          </g>
        ) : cat === 'Beds & Mattresses' ? (
          <g>
            {/* Bed frame with headboard & pillows */}
            <rect x="34" y="26" width="132" height="54" rx="4" fill={swatchHex} stroke="#111" strokeOpacity="0.2" strokeWidth="1.5" />
            <rect x="42" y="56" width="116" height="36" rx="6" fill="#F7F5F0" stroke="#111" strokeOpacity="0.14" strokeWidth="1.5" />
            <rect x="50" y="44" width="44" height="18" rx="5" fill="#FFFFFF" stroke="#111" strokeOpacity="0.18" strokeWidth="1.2" />
            <rect x="106" y="44" width="44" height="18" rx="5" fill="#FFFFFF" stroke="#111" strokeOpacity="0.18" strokeWidth="1.2" />
            <rect x="30" y="76" width="140" height="30" rx="3" fill={swatchHex} stroke="#111" strokeOpacity="0.22" strokeWidth="1.5" />
          </g>
        ) : cat === 'Storage & Shelving' && name.includes('KALLAX') ? (
          <g>
            {/* 4x4 KALLAX Cube grid */}
            <rect x="52" y="16" width="96" height="94" rx="2" fill={swatchHex} stroke="#111" strokeOpacity="0.25" strokeWidth="2" />
            {[0, 1, 2, 3].map((r) =>
              [0, 1, 2, 3].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={58 + c * 21.5}
                  y={22 + r * 21}
                  width="18"
                  height="17.5"
                  fill={r === 3 ? (c % 2 === 0 ? '#3A3D40' : '#D9D2C5') : '#E5E4E0'}
                />
              ))
            )}
          </g>
        ) : cat === 'Storage & Shelving' ? (
          <g>
            {/* Bookcase / Wardrobe / TV Bench */}
            <rect x="56" y="16" width="88" height="94" rx="3" fill={swatchHex} stroke="#111" strokeOpacity="0.22" strokeWidth="1.8" />
            <line x1="62" y1="38" x2="138" y2="38" stroke="#111" strokeOpacity="0.2" strokeWidth="2" />
            <line x1="62" y1="60" x2="138" y2="60" stroke="#111" strokeOpacity="0.2" strokeWidth="2" />
            <line x1="62" y1="82" x2="138" y2="82" stroke="#111" strokeOpacity="0.2" strokeWidth="2" />
            <rect x="68" y="24" width="18" height="13" fill="#0058A3" opacity="0.75" />
            <rect x="110" y="45" width="22" height="14" fill="#B86B4B" opacity="0.8" />
          </g>
        ) : cat === 'Tables & Desks' ? (
          <g>
            {/* Table / Desk */}
            <rect x="32" y="44" width="136" height="10" rx="3" fill={swatchHex} stroke="#111" strokeOpacity="0.22" strokeWidth="1.5" />
            <rect x="44" y="54" width="7" height="54" rx="2" fill={swatchHex} stroke="#111" strokeOpacity="0.2" strokeWidth="1.2" />
            <rect x="149" y="54" width="7" height="54" rx="2" fill={swatchHex} stroke="#111" strokeOpacity="0.2" strokeWidth="1.2" />
            <rect x="58" y="54" width="5" height="44" rx="1.5" fill={swatchHex} opacity="0.7" />
            <rect x="137" y="54" width="5" height="44" rx="1.5" fill={swatchHex} opacity="0.7" />
          </g>
        ) : cat === 'Lighting' ? (
          <g>
            {/* Lamp */}
            <circle cx="100" cy="42" r="24" fill="#FFF3D1" opacity="0.75" />
            <path d="M78 46 Q100 18 122 46 Z" fill={swatchHex} stroke="#111" strokeOpacity="0.25" strokeWidth="1.5" />
            <rect x="98" y="46" width="4" height="60" fill="#2B2D2F" />
            <ellipse cx="100" cy="108" rx="24" ry="5" fill="#2B2D2F" />
          </g>
        ) : cat === 'Rugs & Decor' ? (
          <g>
            {/* Flatwoven Rug / Mirror */}
            <polygon
              points="34,94 72,56 166,56 128,94"
              fill={swatchHex}
              stroke="#111"
              strokeOpacity="0.2"
              strokeWidth="1.5"
            />
            <line x1="48" y1="84" x2="142" y2="84" stroke="#FFF" strokeOpacity="0.35" strokeWidth="2" />
            <line x1="60" y1="70" x2="154" y2="70" stroke="#FFF" strokeOpacity="0.35" strokeWidth="2" />
          </g>
        ) : (
          <g>
            {/* Kitchen & Dining */}
            <rect x="66" y="34" width="68" height="36" rx="12" fill={swatchHex} stroke="#111" strokeOpacity="0.2" strokeWidth="1.5" />
            <rect x="62" y="66" width="76" height="10" rx="5" fill={swatchHex} stroke="#111" strokeOpacity="0.25" strokeWidth="1.5" />
            <line x1="74" y1="76" x2="68" y2="108" stroke="#C8A170" strokeWidth="5" strokeLinecap="round" />
            <line x1="126" y1="76" x2="132" y2="108" stroke="#C8A170" strokeWidth="5" strokeLinecap="round" />
          </g>
        )}
      </svg>

      {/* Dimension label in quiet unboxed text at bottom-right */}
      {showDimensionsBadge && (
        <span className="absolute bottom-1.5 right-2.5 text-[11px] font-mono-num text-[#484848]">
          {product.dimensionsCm.width}×{product.dimensionsCm.depth}×{product.dimensionsCm.height} cm
        </span>
      )}
    </div>
  );
};
