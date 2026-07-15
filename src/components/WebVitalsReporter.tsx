"use client";

import { useReportWebVitals } from "next/web-vitals";

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const gtag = (window as GtagWindow).gtag;
    if (typeof gtag !== "function") return;

    gtag("event", "web_vitals", {
      metric_id: metric.id,
      metric_name: metric.name,
      metric_value: metric.value,
      metric_rating: metric.rating,
      non_interaction: true,
    });
  });

  return null;
}
