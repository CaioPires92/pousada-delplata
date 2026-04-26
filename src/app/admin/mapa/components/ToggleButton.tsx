'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ToggleButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  label,
  active,
  onClick,
  disabled = false,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 py-1 px-2 rounded text-[10px] font-bold transition-all border",
        active
          ? "bg-slate-800 text-white border-slate-800 shadow-sm"
          : "bg-white text-slate-400 border-slate-200 hover:border-slate-300",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );
};
