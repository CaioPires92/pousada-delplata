'use client';

import React, { useRef, useState } from 'react';
import { RateCard } from './RateCard';
import { getHorizontalSelection } from '../inventory-grid';
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
  onDragStart: (event: any, roomId: string, field: any, dateKey: string) => void;
  onDragEnter: (event: any, roomId: string, field: any, dateKey: string) => void;
  inventoryDragState: any;
  inventorySelection: any;
  is4PNA?: boolean;
}

export const RoomRow: React.FC<RoomRowProps> = ({
  roomType,
  dates,
  calendarData,
  onRateUpdate,
  onDragStart,
  onDragEnter,
  inventoryDragState,
  inventorySelection,
  is4PNA = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      {/* Room Header Banner */}
      <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{roomType.name}</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded-full border border-slate-100">
             Capacidade: {roomType.capacity} pessoas
          </span>
        </div>
      </div>

      <div className="flex">
        {/* Fixed Labels Column */}
        <div className="w-[100px] min-w-[100px] bg-slate-50/50 border-r border-slate-200 flex flex-col">
          {/* Header Placeholder (Matches the date header height) */}
          <div className="h-10 border-b border-slate-100 bg-slate-100/30" />
          
          <div className="h-10 border-b border-slate-100 flex items-center px-4">
            <span className="text-[9px] font-black text-slate-400 uppercase">Status</span>
          </div>
          <div className="h-12 border-b border-slate-100 flex items-center px-4">
            <span className="text-[9px] font-black text-slate-400 uppercase">Ocupação</span>
          </div>
          <div className="h-12 border-b border-slate-100 flex items-center px-4">
            <span className="text-[9px] font-black text-slate-400 uppercase">Preço</span>
          </div>
          <div className="h-12 border-b border-slate-100 flex items-center px-4">
            <span className="text-[9px] font-black text-slate-400 uppercase">STD</span>
          </div>
          <div className="h-12 border-b border-slate-100 flex items-center px-4">
            <span className="text-[9px] font-black text-slate-400 uppercase">4P</span>
          </div>
          <div className="h-12 border-b border-slate-100 flex items-center px-4">
            <span className="text-[9px] font-black text-slate-400 uppercase">Min. Noites</span>
          </div>
          <div className="h-10 border-b border-slate-100 flex items-center px-4">
            <span className="text-[9px] font-black text-slate-400 uppercase">CTA (Entr)</span>
          </div>
          <div className="h-10 flex items-center px-4">
            <span className="text-[9px] font-black text-slate-400 uppercase">CTD (Saída)</span>
          </div>
        </div>

        {/* Scrollable Day Columns */}
        <div 
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={cn(
            "flex overflow-x-auto select-none transition-all scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent hover:scrollbar-thumb-slate-400",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          {dates.map((date) => {
            const data = calendarData[date] || {};
            const occupancy = data.available !== undefined ? (data.bookingsCount / data.capacityTotal) * 100 : 0;
            const status = data.stopSell ? 'FECHADO' : 'ABERTO';
            const inventorySTD = data.totalInventory || 0;
            const inventory4P = data.fourGuestInventory || 0;
            const price = data.price || 0;
            const minLos = data.minLos || 1;
            const cta = data.cta || false;
            const ctd = data.ctd || false;

            const dateObj = new Date(date + 'T00:00:00');
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            // Calculate selection state for visual feedback
            const selectedFields: string[] = [];
            if (inventorySelection && inventorySelection.roomId === roomType.id && inventorySelection.dates.includes(date)) {
              selectedFields.push(inventorySelection.field);
            }
            if (inventoryDragState && inventoryDragState.roomId === roomType.id) {
              const draggedDates = getHorizontalSelection(dates, inventoryDragState.startDate, inventoryDragState.currentDate);
              if (draggedDates.includes(date)) {
                selectedFields.push(inventoryDragState.field);
              }
            }

            return (
              <div key={`${roomType.id}-${date}`} className="flex flex-col">
                {/* Date Header Sub-row */}
                <div className={cn(
                  "h-10 border-b border-slate-100 flex flex-col items-center justify-center px-4 border-r border-slate-50 gap-0.5",
                  isWeekend ? "bg-slate-50/80" : "bg-white"
                )}>
                  <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-wider">
                    {dateObj.toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </span>
                  <span className="text-[10px] font-black text-slate-700 leading-none">
                    {dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>

                <RateCard
                  status={status}
                  occupancy={occupancy}
                  inventorySTD={inventorySTD}
                  inventory4P={inventory4P}
                  price={price}
                  minLos={minLos}
                  cta={cta}
                  ctd={ctd}
                  is4PNA={is4PNA}
                  selectedFields={selectedFields}
                  onStatusToggle={() => onRateUpdate(date, 'stopSell', !data.stopSell)}
                  onInventorySTDChange={(val) => onRateUpdate(date, 'inventory', val)}
                  onInventory4PChange={(val) => onRateUpdate(date, 'fourGuestInventory', val)}
                  onPriceChange={(val) => onRateUpdate(date, 'price', val)}
                  onMinLosChange={(val) => onRateUpdate(date, 'minLos', val)}
                  onCTAToggle={() => onRateUpdate(date, 'cta', !cta)}
                  onCTDToggle={() => onRateUpdate(date, 'ctd', !ctd)}
                  onDragStart={(e, field) => onDragStart(e, roomType.id, field, date)}
                  onDragEnter={(e, field) => onDragEnter(e, roomType.id, field, date)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
