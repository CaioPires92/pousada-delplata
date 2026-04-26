'use client';

import React from 'react';

interface OccupancyRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

export const OccupancyRing: React.FC<OccupancyRingProps> = ({
  percentage,
  size = 48,
  strokeWidth = 4,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = (percent: number) => {
    if (percent <= 30) return '#ef4444'; // Red-500
    if (percent <= 70) return '#eab308'; // Yellow-500
    return '#22c55e'; // Green-500
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(percentage)}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-slate-700">
        {Math.round(percentage)}%
      </span>
    </div>
  );
};
