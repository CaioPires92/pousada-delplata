import { describe, expect, it } from "vitest";

import {
  createAutomationPausedUntil,
  isAutomationMode,
  isAutomationPaused,
  isConversationAutomationActive,
  resolveAutomationMode,
} from "./automationPause";

describe("automationPause", () => {
  const now = new Date("2026-05-10T12:00:00.000Z");

  it("creates a default 30 minute pause window", () => {
    expect(createAutomationPausedUntil(now).toISOString()).toBe("2026-05-10T12:30:00.000Z");
  });

  it("detects active and expired pauses", () => {
    expect(isAutomationPaused("2026-05-10T12:01:00.000Z", now)).toBe(true);
    expect(isAutomationPaused("2026-05-10T11:59:00.000Z", now)).toBe(false);
    expect(isAutomationPaused(null, now)).toBe(false);
  });

  it("requires chatbot enabled and no active pause", () => {
    expect(isConversationAutomationActive({ chatbotEnabled: true, automationPausedUntil: null }, now)).toBe(true);
    expect(isConversationAutomationActive({ chatbotEnabled: false, automationPausedUntil: null }, now)).toBe(false);
    expect(isConversationAutomationActive({ chatbotEnabled: true, automationPausedUntil: "2026-05-10T12:10:00.000Z" }, now)).toBe(false);
  });

  it("supports off, supervised and auto while preserving legacy boolean records", () => {
    expect(isAutomationMode("off")).toBe(true);
    expect(isAutomationMode("supervised")).toBe(true);
    expect(isAutomationMode("auto")).toBe(true);
    expect(isAutomationMode("invalid")).toBe(false);
    expect(resolveAutomationMode({ chatbotEnabled: true, automationPausedUntil: null })).toBe("auto");
    expect(resolveAutomationMode({ chatbotEnabled: false, automationPausedUntil: null })).toBe("off");
    expect(isConversationAutomationActive({
      chatbotEnabled: false,
      automationMode: "supervised",
      automationPausedUntil: null,
    }, now)).toBe(false);
    expect(isConversationAutomationActive({
      chatbotEnabled: true,
      automationMode: "auto",
      automationPausedUntil: null,
    }, now)).toBe(true);
  });
});
