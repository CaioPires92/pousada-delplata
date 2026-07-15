import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WebVitalsReporter from "./WebVitalsReporter";

const useReportWebVitals = vi.fn();

vi.mock("next/web-vitals", () => ({
  useReportWebVitals: (callback: (metric: unknown) => void) => useReportWebVitals(callback),
}));

describe("WebVitalsReporter", () => {
  beforeEach(() => {
    useReportWebVitals.mockReset();
    delete (window as Window & { gtag?: unknown }).gtag;
  });

  it("envia a métrica ao GA4 sem dados pessoais", () => {
    const gtag = vi.fn();
    (window as Window & { gtag?: typeof gtag }).gtag = gtag;
    render(<WebVitalsReporter />);

    useReportWebVitals.mock.calls[0][0]({
      id: "v4-123",
      name: "LCP",
      value: 1875.5,
      rating: "good",
    });

    expect(gtag).toHaveBeenCalledWith("event", "web_vitals", {
      metric_id: "v4-123",
      metric_name: "LCP",
      metric_value: 1875.5,
      metric_rating: "good",
      non_interaction: true,
    });
  });

  it("não falha antes de o GA4 estar disponível", () => {
    render(<WebVitalsReporter />);
    expect(() =>
      useReportWebVitals.mock.calls[0][0]({
        id: "v4-456",
        name: "CLS",
        value: 0.04,
        rating: "good",
      }),
    ).not.toThrow();
  });
});
