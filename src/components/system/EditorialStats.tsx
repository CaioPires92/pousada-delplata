import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type EditorialStatIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export type EditorialStatItem = {
  description?: string;
  icon: EditorialStatIcon;
  label: string;
  noWrapDescription?: boolean;
  value: string;
};

interface EditorialStatsProps {
  className?: string;
  footer?: string;
  items: EditorialStatItem[];
}

const editorialStatsStyles = {
  wrapper: "mx-auto w-full",
  grid: "mx-auto grid max-w-6xl justify-center gap-12 md:grid-cols-2 xl:grid-cols-4 xl:gap-0",
  item: "flex items-center justify-center gap-4 text-left xl:px-8",
  itemWithDivider: "flex items-center justify-center gap-4 text-left xl:border-l xl:border-[#b58b58]/18 xl:px-8",
  iconWrapper: "flex shrink-0 items-center justify-center text-[#b58b58]",
  icon: "h-10 w-10",
  content: "min-w-0",
  value: "font-sans text-[2.05rem] font-semibold leading-[1.1] text-[#1d1b19]",
  label: "mt-2 font-sans text-[1.03rem] font-semibold leading-6 text-[#1d1b19]",
  description: "mt-1 max-w-[24ch] font-sans text-[0.98rem] leading-6 text-[#1d1b19]/72",
  footer: "mt-8 text-center text-sm font-normal text-[#1d1b19]/68",
} as const;

export default function EditorialStats({ className, footer, items }: EditorialStatsProps) {
  return (
    <div className={cn(editorialStatsStyles.wrapper, className)}>
      <div className={editorialStatsStyles.grid}>
        {items.map(({ description, icon: Icon, label, noWrapDescription, value }, index) => (
          <div
            key={`${label}-${value}`}
            className={index === 0 ? editorialStatsStyles.item : editorialStatsStyles.itemWithDivider}
          >
            <div className={editorialStatsStyles.iconWrapper}>
              <Icon className={editorialStatsStyles.icon} aria-hidden="true" />
            </div>
            <div className={editorialStatsStyles.content}>
              <h3 className={editorialStatsStyles.value}>{value}</h3>
              <p className={editorialStatsStyles.label}>{label}</p>
              {description ? (
                <p className={cn(editorialStatsStyles.description, noWrapDescription && "whitespace-nowrap text-[0.92rem]")}>
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {footer ? <p className={editorialStatsStyles.footer}>{footer}</p> : null}
    </div>
  );
}
