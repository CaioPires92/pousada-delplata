'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InventoryControlProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  isNA?: boolean;
  hideLabel?: boolean;
  minValue?: number;
}

export const InventoryControl: React.FC<InventoryControlProps> = ({
  label,
  value,
  onIncrement,
  onDecrement,
  disabled = false,
  isNA = false,
  hideLabel = false,
  minValue = 0,
}) => {
  if (isNA) {
    return (
      <div className="flex flex-col items-center gap-1 opacity-50">
        {!hideLabel && <span className="text-[10px] font-semibold text-slate-500 uppercase">{label}</span>}
        <div className="h-8 flex items-center justify-center text-[10px] font-bold text-slate-400">
          N/A
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {!hideLabel && <span className="text-[10px] font-semibold text-slate-500 uppercase">{label}</span>}
      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-md hover:bg-white hover:shadow-sm transition-all"
          onClick={onDecrement}
          disabled={disabled || value <= minValue}
          data-no-drag="true"
        >
          <Minus className="h-2.5 w-2.5" />
        </Button>
        <span className="w-5 text-center text-[10px] font-bold text-slate-700">
          {value}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-md hover:bg-white hover:shadow-sm transition-all"
          onClick={onIncrement}
          disabled={disabled}
          data-no-drag="true"
        >
          <Plus className="h-2.5 w-2.5" />
        </Button>
      </div>
    </div>
  );
};
