import React, { useState } from 'react';
import {
  ShoppingBag,
  Trash2,
  Download,
  FileSpreadsheet,
  FileJson,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
  const summary = calculateBomSummary(placedItems, chandeliers);

  const getIkeaStoreUrl = (articleNumber: string): string => {
    const cleanArt = (articleNumber || '').replace(/[^0-9]/g, '');
    return cleanArt.length >= 8
      ? `https://www.ikea.com/cz/cs/p/-${cleanArt}/`
      : 'https://www.ikea.com/cz/cs/';
  };

  const handleExportCsv = () => {
    if (summary.lines.length === 0) return;

    const headers = [
      'Název série / Series',
      'Kód artiklu / Article Number',
      'Barevné provedení / Swatch',
      'Množství / Quantity',
      'Cena za kus (Kč) / Unit Price CZK',
      'Cena za kus (€) / Unit Price EUR',
      'Celkem (Kč) / Subtotal CZK',
      'Celkem (€) / Subtotal EUR',
      'Odkaz do obchodu IKEA / Store URL',
    ];

    const rows = summary.lines.map((line) => {
      const unitCzk = Math.round(line.subtotalCzk / line.quantity);
      const unitEur = Math.round(line.subtotalEur / line.quantity);
      const url = getIkeaStoreUrl(line.product.articleNumber);
      return [
        `"${line.product.name.replace(/"/g, '""')}"`,
        `"${line.product.articleNumber}"`,
        `"${line.swatchName.replace(/"/g, '""')}"`,
        line.quantity,
        unitCzk,
        unitEur,
        line.subtotalCzk,
        line.subtotalEur,
        `"${url}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `IKEA_Apartment_BOM_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleExportJson = () => {
    if (summary.lines.length === 0) return;

    const exportData = {
      exportedAt: new Date().toISOString(),
      apartmentTotals: {
        totalItems: summary.totalItems,
        totalCzk: summary.totalCzk,
        totalEur: summary.totalEur,
      },
      placedItemsCount: placedItems.length,
      chandeliersCount: chandeliers.length,
      billOfMaterials: summary.lines.map((line) => ({
        name: line.product.name,
        articleNumber: line.product.articleNumber,
        swatchName: line.swatchName,
        swatchHex: line.swatchHex,
        quantity: line.quantity,
        unitPriceCzk: Math.round(line.subtotalCzk / line.quantity),
        unitPriceEur: Math.round(line.subtotalEur / line.quantity),
        subtotalCzk: line.subtotalCzk,
        subtotalEur: line.subtotalEur,
        ikeaPurchaseUrl: getIkeaStoreUrl(line.product.articleNumber),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `IKEA_Apartment_BOM_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const generateBomClipboardText = (): string => {
    const lines = [
      '==================================================',
      'IKEA Space Planner — Bill of Materials (BOM)',
      `Exported: ${new Date().toLocaleDateString('cs-CZ')}`,
      `Total items: ${summary.totalItems} pcs`,
      `Total budget: ${summary.totalCzk.toLocaleString('cs-CZ')} Kč (€${summary.totalEur.toLocaleString('en-IE')})`,
      '==================================================\n',
    ];

    summary.lines.forEach((line, idx) => {
      const unitCzk = Math.round(line.subtotalCzk / line.quantity);
      const unitEur = Math.round(line.subtotalEur / line.quantity);
      const storeUrl = getIkeaStoreUrl(line.product.articleNumber);
      lines.push(
        `${idx + 1}. ${line.product.name} — ${line.swatchName}`,
        `   Kód / Article: ${line.product.articleNumber}`,
        `   Množství / Qty: ${line.quantity}×`,
        `   Cena za kus: ${unitCzk.toLocaleString('cs-CZ')} Kč (€${unitEur})`,
        `   Mezisoučet / Subtotal: ${line.subtotalCzk.toLocaleString('cs-CZ')} Kč (€${line.subtotalEur})`,
        `   IKEA Store: ${storeUrl}\n`
      );
    });

    lines.push('==================================================');
    return lines.join('\n');
  };

  const handleExportClipboard = async () => {
    if (summary.lines.length === 0) return;
    const text = generateBomClipboardText();

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white text-[#111111]">
      {/* Header & Budget Total */}
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

      {/* Export Toolbar */}
      {summary.lines.length > 0 && (
        <div className="px-3 py-1.5 bg-[#F9F9F8] border-b border-[#E5E5E5] flex items-center gap-1.5 justify-between">
          <span className="text-[11px] font-bold text-[#555555] flex items-center gap-1">
            <Download className="w-3.5 h-3.5 text-[#0058A3]" />
            <span>Export Shopping List:</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2.5 py-1 bg-white hover:bg-[#E5E5E5] border border-[#CCCCCC] rounded text-[11px] font-bold text-[#111111] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              title="Download UTF-8 CSV with Czech diacritics for Excel & Numbers"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="px-2.5 py-1 bg-white hover:bg-[#E5E5E5] border border-[#CCCCCC] rounded text-[11px] font-bold text-[#111111] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              title="Download raw JSON data structure"
            >
              <FileJson className="w-3 h-3 text-[#0058A3]" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={handleExportClipboard}
              className={`px-2.5 py-1 border rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs ${
                copied
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                  : 'bg-white hover:bg-[#E5E5E5] border-[#CCCCCC] text-[#111111]'
              }`}
              title="Copy formatted shopping list to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-[#555555]" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#E5E5E5]">
        {summary.lines.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#666666] flex flex-col items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-[#999999]" />
            <span>No IKEA items placed in the apartment yet.</span>
            <span className="text-[11px] text-[#888888]">
              Browse the catalog and click "Add 3D Model" to place items in your rooms.
            </span>
          </div>
        ) : (
          summary.lines.map((line) => {
            const storeUrl = getIkeaStoreUrl(line.product.articleNumber);
            return (
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
                    <div className="flex items-center gap-1.5 flex-wrap">
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

                  {/* Official IKEA Store Link */}
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-[#0058A3] hover:bg-[#E5F0FA] rounded-md transition-colors cursor-pointer"
                    title="Open in official IKEA Czech store (nové okno)"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {placedItems.some((i) => i.productId === line.product.id) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const match = placedItems.find((i) => i.productId === line.product.id);
                        if (match) onRemoveInstance(match.instanceId);
                      }}
                      className="p-1.5 text-[#767676] hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                      title="Remove one instance"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
