'use client';

import React from 'react';
import { OccupancyRing } from './OccupancyRing';
import { InventoryControl } from './InventoryControl';
import { ToggleButton } from './ToggleButton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface RateCardProps {
  status: 'ABERTO' | 'FECHADO';
  occupancy: number;
  inventorySTD: number;
  inventory4P: number;
  price: number;
  cta: boolean;
  ctd: boolean;
  is4PNA?: boolean;
  onStatusToggle: () => void;
  onInventorySTDChange: (val: number) => void;
  onInventory4PChange: (val: number) => void;
  onPriceChange: (val: number) => void;
  onCTAToggle: () => void;
  onCTDToggle: () => void;
  disabled?: boolean;
}

export const RateCard: React.FC<RateCardProps> = ({
  status,
  occupancy,
  inventorySTD,
  inventory4P,
  price,
  cta,
  ctd,
  is4PNA = false,
  onStatusToggle,
  onInventorySTDChange,
  onInventory4PChange,
  onPriceChange,
  onCTAToggle,
  onCTDToggle,
  disabled = false,
}) => {
  const isOpen = status === 'ABERTO';

  return (
    <div className={cn(
      "flex flex-col w-[160px] min-w-[160px] bg-white border rounded-xl overflow-hidden transition-all",
      isOpen ? "border-slate-200 shadow-sm" : "border-red-100 bg-red-50/30 opacity-80"
    )}>
      {/* Status Header */}
      <button
        onClick={onStatusToggle}
        disabled={disabled}
        className={cn(
          "w-full py-1.5 text-[10px] font-black tracking-widest text-center transition-colors uppercase",
          isOpen ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
        )}
      >
        {status}
      </button>

      <div className="p-3 flex flex-col gap-4">
        {/* Occupancy Section */}
        <div className="flex justify-center">
          <OccupancyRing percentage={occupancy} size={56} strokeWidth={5} />
        </div>

        {/* Price Section */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase text-center">Preço</span>
          <div className="relative group">
             <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">R$</span>
             <input
                type="number"
                value={price}
                onChange={(e) => onPriceChange(parseFloat(e.target.value))}
                disabled={disabled}
                className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all text-right"
             />
          </div>
        </div>

        {/* Inventory Section */}
        <div className="grid grid-cols-2 gap-2">
          <InventoryControl
            label="STD"
            value={inventorySTD}
            onIncrement={() => onInventorySTDChange(inventorySTD + 1)}
            onDecrement={() => onInventorySTDChange(inventorySTD - 1)}
            disabled={disabled}
          />
          <InventoryControl
            label="4P"
            value={inventory4P}
            onIncrement={() => onInventory4PChange(inventory4P + 1)}
            onDecrement={() => onInventory4PChange(inventory4P - 1)}
            disabled={disabled}
            isNA={is4PNA}
          />
        </div>

        {/* Rules Section (CTA/CTD) */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase text-center">Regras</span>
          <div className="flex gap-1">
            <ToggleButton
              label="CTA"
              active={cta}
              onClick={onCTAToggle}
              disabled={disabled}
            />
            <ToggleButton
              label="CTD"
              active={ctd}
              onClick={onCTDToggle}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
