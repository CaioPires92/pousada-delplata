"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface GlowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Glow({ children, className, ...props }: GlowProps) {
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className="magicui-glow-pulse pointer-events-none absolute -inset-4 rounded-full bg-emerald-400/25 blur-2xl"
      />
      <span
        aria-hidden="true"
        className="magicui-glow-spin pointer-events-none absolute -inset-2 rounded-full bg-[conic-gradient(from_90deg,rgba(16,185,129,0.05),rgba(34,197,94,0.55),rgba(16,185,129,0.05))] blur-lg"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 rounded-full ring-1 ring-emerald-200/70"
      />
      {children}
      <style jsx>{`
        @media (prefers-reduced-motion: no-preference) {
          .magicui-glow-spin {
            animation: magicuiGlowSpin 5.5s linear infinite;
          }
          .magicui-glow-pulse {
            animation: magicuiGlowPulse 2.8s ease-in-out infinite;
          }
        }
        @keyframes magicuiGlowSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes magicuiGlowPulse {
          0%,
          100% {
            opacity: 0.55;
            transform: scale(0.98);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.04);
          }
        }
      `}</style>
    </div>
  )
}
