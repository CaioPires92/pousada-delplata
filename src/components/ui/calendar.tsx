"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <>
      <style jsx global>{`
        .rdp-grid7 .rdp-month_grid thead {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }
        .rdp-grid7 .rdp-month_grid tbody {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }
        .rdp-grid7 .rdp-month_grid thead > tr,
        .rdp-grid7 .rdp-month_grid tbody > tr {
          display: contents;
        }
        .rdp-grid7 .rdp-month_grid th,
        .rdp-grid7 .rdp-month_grid td {
          width: 100%;
          text-align: center;
        }
        .rdp-grid7 .rdp-month_grid th {
          white-space: normal;
        }
      `}</style>

      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("p-4 rdp-grid7", className)}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-3",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-base font-semibold text-foreground",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            buttonVariants({ variant: "outline" }),
            "h-8 w-8 bg-white p-0 opacity-70 hover:opacity-100 border border-border/60"
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse",
          head_row: "contents",
          head_cell:
            "text-muted-foreground rounded-md w-full py-1 font-medium text-[0.75rem] text-center uppercase tracking-wide whitespace-normal",
          row: "contents",
          cell: "h-10 w-full text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-lg [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent/40 first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg focus-within:relative focus-within:z-20",
          day: cn(
            buttonVariants({ variant: "ghost" }),
            "h-10 w-10 p-0 font-normal aria-selected:opacity-100 mx-auto rounded-lg hover:bg-accent/40"
          ),
          day_range_end: "day-range-end",
          day_selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside:
            "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle:
            "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          ...classNames,
        }}
        components={{
          Chevron: (props) => {
            const { orientation, ...rest } = props
            if (orientation === "left") {
              return <ChevronLeft className="h-4 w-4" {...rest} />
            }
            return <ChevronRight className="h-4 w-4" {...rest} />
          },
        }}
        {...props}
      />
    </>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
