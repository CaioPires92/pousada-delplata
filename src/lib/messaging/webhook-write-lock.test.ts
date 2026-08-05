import { describe, expect, it } from "vitest";

import { withWebhookWriteLock } from "./webhook-write-lock";

describe("withWebhookWriteLock", () => {
  it("serializes concurrent webhook write sections", async () => {
    const trace: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });

    const first = withWebhookWriteLock(async () => {
      trace.push("first:start");
      await firstGate;
      trace.push("first:end");
    });
    const second = withWebhookWriteLock(async () => {
      trace.push("second:start");
      trace.push("second:end");
    });

    await Promise.resolve();
    expect(trace).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(trace).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });

  it("releases the next webhook when an operation fails", async () => {
    await expect(withWebhookWriteLock(async () => {
      throw new Error("synthetic failure");
    })).rejects.toThrow("synthetic failure");

    await expect(withWebhookWriteLock(async () => "processed")).resolves.toBe("processed");
  });
});
