'use client';

import React from 'react';
import { RateCard } from './RateCard';
import { cn } from '@/lib/utils';

interface RoomRowProps {
  roomType: {
    id: string;
    name: string;
    capacity: number;
    description?: string;
  };
  dates: string[];
  calendarData: Record<string, any>;
  onRateUpdate: (date: string, field: string, value: any) => void;
  is4PNA?: boolean;
}

export const RoomRow: React.FC<RoomRowProps> = ({
  roomType,
  dates,
  calendarData,
  onRateUpdate,
  is4PNA = false,
}) => {
  return (
    <div className="flex flex-col gap-4 mb-10 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
      {/* Room Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-xl font-black text-slate-800 tracking-tight">{roomType.name}</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             Capacidade: {roomType.capacity} pessoas
          </span>
        </div>
        
        {/* Bulk Quick Actions (Optional for later) */}
        <div className="flex gap-2">
          {/* Add quick action buttons here if needed */}
        </div>
      </div>

      {/* Horizontal Scrollable Area */}
      <div className="relative group">
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {dates.map((date) => {
            const data = calendarData[date] || {};
            const occupancy = data.occupancy || 0;
            const status = data.status || 'ABERTO';
            const inventorySTD = data.inventory || 0;
            const inventory4P = data.fourGuestInventory || 0;
            const price = data.price || 0;
            const cta = data.cta || false;
            const ctd = data.ctd || false;

            return (
              <div key={`${roomType.id}-${date}`} className="flex flex-col gap-2">
                <div className="text-[10px] font-black text-slate-400 text-center uppercase tracking-tighter">
                  {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </div>
                <RateCard
                  status={status as 'ABERTO' | 'FECHADO'}
                  occupancy={occupancy}
                  inventorySTD={inventorySTD}
                  inventory4P={inventory4P}
                  price={price}
                  cta={cta}
                  ctd={ctd}
                  is4PNA={is4PNA}
                  onStatusToggle={() => onRateUpdate(date, 'status', status === 'ABERTO' ? 'FECHADO' : 'ABERTO')}
                  onInventorySTDChange={(val) => onRateUpdate(date, 'inventory', val)}
                  onInventory4PChange={(val) => onRateUpdate(date, 'fourGuestInventory', val)}
                  onPriceChange={(val) => onRateUpdate(date, 'price', val)}
                  onCTAToggle={() => onRateUpdate(date, 'cta', !cta)}
                  onCTDToggle={() => onRateUpdate(date, 'ctd', !ctd)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
