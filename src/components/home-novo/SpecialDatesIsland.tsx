"use client";

import { useMemo } from "react";

import SpecialDatesSection from "@/components/SpecialDatesSection";
import { SPECIAL_DATES } from "@/constants/specialDates";
import { gaEvent } from "@/lib/analytics";

export default function SpecialDatesIsland() {
  const dates = useMemo(() => SPECIAL_DATES.filter((specialDate) => specialDate.enabled), []);

  return (
    <SpecialDatesSection
      dates={dates}
      onDateClick={(specialDate) => gaEvent("home_special_dates_click", { special_date_id: specialDate.id })}
    />
  );
}
