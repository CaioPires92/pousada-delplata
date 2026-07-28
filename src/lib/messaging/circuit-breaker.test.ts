import { describe, expect, it, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from "./circuit-breaker";

describe("CircuitBreaker", () => {
  it("opens after consecutive counted failures and blocks the next call", async () => {
    const task = vi.fn().mockRejectedValue(new Error("provider unavailable"));
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 30_000,
      now: () => 1_000,
    });

    await expect(breaker.execute(task)).rejects.toThrow("provider unavailable");
    await expect(breaker.execute(task)).rejects.toThrow("provider unavailable");
    await expect(breaker.execute(task)).rejects.toBeInstanceOf(CircuitBreakerOpenError);

    expect(task).toHaveBeenCalledTimes(2);
    expect(breaker.snapshot()).toEqual({
      state: "open",
      consecutiveFailures: 2,
      openedAt: 1_000,
    });
  });

  it("allows one recovery probe after cooldown and closes on success", async () => {
    let now = 1_000;
    const task = vi.fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("recovered")
      .mockResolvedValueOnce("healthy");
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 500,
      now: () => now,
    });

    await expect(breaker.execute(task)).rejects.toThrow("temporary");
    now = 1_500;
    await expect(breaker.execute(task)).resolves.toBe("recovered");
    await expect(breaker.execute(task)).resolves.toBe("healthy");

    expect(breaker.snapshot()).toEqual({
      state: "closed",
      consecutiveFailures: 0,
      openedAt: null,
    });
  });

  it("does not count permanent failures selected by the classifier", async () => {
    const task = vi.fn().mockRejectedValue({ retryable: false });
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 500,
      shouldCountFailure: error =>
        Boolean(error && typeof error === "object" && "retryable" in error && error.retryable),
    });

    await expect(breaker.execute(task)).rejects.toEqual({ retryable: false });
    await expect(breaker.execute(task)).rejects.toEqual({ retryable: false });

    expect(task).toHaveBeenCalledTimes(2);
    expect(breaker.snapshot().state).toBe("closed");
  });

  it("allows only one half-open recovery probe at a time", async () => {
    let now = 1_000;
    let resolveProbe: ((value: string) => void) | undefined;
    const probe = new Promise<string>(resolve => {
      resolveProbe = resolve;
    });
    const task = vi.fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockReturnValueOnce(probe);
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 500,
      now: () => now,
    });

    await expect(breaker.execute(task)).rejects.toThrow("temporary");
    now = 1_500;
    const recovery = breaker.execute(task);

    await expect(breaker.execute(task)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    expect(task).toHaveBeenCalledTimes(2);

    resolveProbe?.("recovered");
    await expect(recovery).resolves.toBe("recovered");
  });
});
