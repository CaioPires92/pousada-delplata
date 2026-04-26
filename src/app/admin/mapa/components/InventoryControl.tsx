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
}

export const InventoryControl: React.FC<InventoryControlProps> = ({
  label,
  value,
  onIncrement,
  onDecrement,
  disabled = false,
  isNA = false,
}) => {
  if (isNA) {
    return (
      <div className="flex flex-col items-center gap-1 opacity-50">
        <span className="text-[10px] font-semibold text-slate-500 uppercase">{label}</span>
        <div className="h-8 flex items-center justify-center text-xs font-medium text-slate-400">
          N/A
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold text-slate-500 uppercase">{label}</span>
      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md hover:bg-white hover:shadow-sm transition-all"
          onClick={onDecrement}
          disabled={disabled || value <= 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-6 text-center text-xs font-bold text-slate-700">
          {value}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md hover:bg-white hover:shadow-sm transition-all"
          onClick={onIncrement}
          disabled={disabled}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
