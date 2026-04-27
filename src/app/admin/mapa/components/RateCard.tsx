'use client';

import React from 'react';
import { OccupancyRing } from './OccupancyRing';
import { InventoryControl } from './InventoryControl';
import { ToggleButton } from './ToggleButton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import styles from '../mapa.module.css';

interface RateCardProps {
  status: 'ABERTO' | 'FECHADO';
  occupancy: number;
  inventorySTD: number;
  inventory4P: number;
  price: number;
  minLos: number;
  cta: boolean;
  ctd: boolean;
  is4PNA?: boolean;
  onStatusToggle: () => void;
  onInventorySTDChange: (val: number) => void;
  onInventory4PChange: (val: number) => void;
  onPriceChange: (val: number) => void;
  onMinLosChange: (val: number) => void;
  onCTAToggle: () => void;
  onCTDToggle: () => void;
  onDragStart?: (event: React.MouseEvent, field: string) => void;
  onDragEnter?: (event: React.MouseEvent, field: string) => void;
  selectedFields?: string[];
  disabled?: boolean;
}

export const RateCard: React.FC<RateCardProps> = ({
  status,
  occupancy,
  inventorySTD,
  inventory4P,
  price,
  minLos,
  cta,
  ctd,
  is4PNA = false,
  onStatusToggle,
  onInventorySTDChange,
  onInventory4PChange,
  onPriceChange,
  onMinLosChange,
  onCTAToggle,
  onCTDToggle,
  onDragStart,
  onDragEnter,
  selectedFields = [],
  disabled = false,
}) => {
  const isOpen = status === 'ABERTO';

  return (
    <div className={cn(
      "flex flex-col w-[120px] min-w-[120px] transition-all border-r border-slate-100",
      !isOpen && "bg-red-50/20"
    )}>
      {/* 1. Status Row */}
      <div 
        onMouseDown={(e) => onDragStart?.(e, 'status')}
        onMouseEnter={(e) => onDragEnter?.(e, 'status')}
        data-inventory-selection-cell="true"
        className={cn(
          "h-10 flex items-center justify-center border-b border-slate-100 px-2 cursor-cell select-none",
          selectedFields.includes('status') && styles.inventorySelectionCell
        )}
      >
        <button
          onClick={onStatusToggle}
          disabled={disabled}
          data-no-drag="true"
          className={cn(
            "px-3 py-1 rounded-full text-[9px] font-black tracking-widest transition-all flex items-center gap-1.5",
            isOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          )}
        >
          <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", isOpen ? "bg-emerald-500" : "bg-red-500")} />
          {status}
        </button>
      </div>

      {/* 2. Occupancy Row */}
      <div className="h-12 flex items-center justify-center border-b border-slate-100">
        <OccupancyRing percentage={occupancy} size={36} strokeWidth={4} />
      </div>

      {/* 3. Price Row */}
      <div 
        onMouseDown={(e) => onDragStart?.(e, 'price')}
        onMouseEnter={(e) => onDragEnter?.(e, 'price')}
        data-inventory-selection-cell="true"
        className={cn(
          "h-12 flex items-center justify-center border-b border-slate-100 px-2 cursor-cell select-none",
          selectedFields.includes('price') && styles.inventorySelectionCell
        )}
      >
        <div className="relative w-full">
           <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">R$</span>
            <input
               type="number"
                defaultValue={price || ''}
                onChange={(e) => {
                   const val = parseFloat(e.target.value);
                   if (isNaN(val)) {
                       onPriceChange(0);
                   } else {
                       onPriceChange(val);
                   }
                }}
                onBlur={(e) => {
                   const val = parseFloat(e.target.value);
                   if (!isNaN(val)) {
                       e.target.value = val.toString();
                   }
                }}
               onFocus={(e) => e.target.select()}
               disabled={disabled}
               className="w-full pl-6 pr-1.5 py-1 bg-transparent border-none text-[11px] font-black text-slate-800 focus:outline-none transition-all text-right"
            />
        </div>
      </div>

      {/* 4. Inventory STD Row */}
      <div 
        onMouseDown={(e) => onDragStart?.(e, 'inventory')}
        onMouseEnter={(e) => onDragEnter?.(e, 'inventory')}
        data-inventory-selection-cell="true"
        className={cn(
          "h-12 flex items-center justify-center border-b border-slate-100 px-2 cursor-cell select-none",
          selectedFields.includes('inventory') && styles.inventorySelectionCell
        )}
      >
        <InventoryControl
          label="STD"
          value={inventorySTD}
          onIncrement={() => onInventorySTDChange(inventorySTD + 1)}
          onDecrement={() => onInventorySTDChange(inventorySTD - 1)}
          disabled={disabled}
          hideLabel
        />
      </div>

      {/* 5. Inventory 4P Row */}
      <div 
        onMouseDown={(e) => onDragStart?.(e, 'fourGuestInventory')}
        onMouseEnter={(e) => onDragEnter?.(e, 'fourGuestInventory')}
        data-inventory-selection-cell="true"
        className={cn(
          "h-12 flex items-center justify-center border-b border-slate-100 px-2 cursor-cell select-none",
          selectedFields.includes('fourGuestInventory') && styles.inventorySelectionCell
        )}
      >
        <InventoryControl
          label="4P"
          value={inventory4P}
          onIncrement={() => onInventory4PChange(inventory4P + 1)}
          onDecrement={() => onInventory4PChange(inventory4P - 1)}
          disabled={disabled}
          isNA={is4PNA}
          hideLabel
        />
      </div>

      {/* 6. MinLos Row */}
      <div 
        onMouseDown={(e) => onDragStart?.(e, 'minLos')}
        onMouseEnter={(e) => onDragEnter?.(e, 'minLos')}
        data-inventory-selection-cell="true"
        className={cn(
          "h-12 flex items-center justify-center border-b border-slate-100 px-2 cursor-cell select-none",
          selectedFields.includes('minLos') && styles.inventorySelectionCell
        )}
      >
        <InventoryControl
          label="Min"
          value={minLos}
          onIncrement={() => onMinLosChange(minLos + 1)}
          onDecrement={() => onMinLosChange(minLos - 1)}
          disabled={disabled}
          minValue={1}
          hideLabel
        />
      </div>

      {/* 7. CTA Row */}
      <div 
        onMouseDown={(e) => onDragStart?.(e, 'cta')}
        onMouseEnter={(e) => onDragEnter?.(e, 'cta')}
        data-inventory-selection-cell="true"
        className={cn(
          "h-10 flex items-center justify-center border-b border-slate-100 px-2 cursor-cell select-none",
          selectedFields.includes('cta') && styles.inventorySelectionCell
        )}
      >
        <ToggleButton
          label="Entrada"
          active={cta}
          onClick={onCTAToggle}
          disabled={disabled}
          className="w-full h-6 text-[8px] font-black uppercase tracking-tighter"
          data-no-drag="true"
        />
      </div>

      {/* 8. CTD Row */}
      <div 
        onMouseDown={(e) => onDragStart?.(e, 'ctd')}
        onMouseEnter={(e) => onDragEnter?.(e, 'ctd')}
        data-inventory-selection-cell="true"
        className={cn(
          "h-10 flex items-center justify-center px-2 cursor-cell select-none",
          selectedFields.includes('ctd') && styles.inventorySelectionCell
        )}
      >
        <ToggleButton
          label="Saída"
          active={ctd}
          onClick={onCTDToggle}
          disabled={disabled}
          className="w-full h-6 text-[8px] font-black uppercase tracking-tighter"
          data-no-drag="true"
        />
      </div>
    </div>
  );
};
