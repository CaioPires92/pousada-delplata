export type CircuitBreakerState = "closed" | "open" | "half_open";

export class CircuitBreakerOpenError extends Error {
  readonly code = "circuit_open";

  constructor() {
    super("Messaging provider circuit is open");
    this.name = "CircuitBreakerOpenError";
  }
}

export type CircuitBreakerOptions = {
  failureThreshold: number;
  resetTimeoutMs: number;
  now?: () => number;
  shouldCountFailure?: (error: unknown) => boolean;
};

export class CircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private recoveryProbeInFlight = false;
  private readonly now: () => number;
  private readonly shouldCountFailure: (error: unknown) => boolean;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = Math.max(1, Math.floor(options.failureThreshold));
    this.resetTimeoutMs = Math.max(0, options.resetTimeoutMs);
    this.now = options.now ?? Date.now;
    this.shouldCountFailure = options.shouldCountFailure ?? (() => true);
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.state === "half_open" || this.recoveryProbeInFlight) {
      throw new CircuitBreakerOpenError();
    }

    if (this.state === "open") {
      const elapsed = this.openedAt === null
        ? 0
        : this.now() - this.openedAt;
      if (elapsed < this.resetTimeoutMs || this.recoveryProbeInFlight) {
        throw new CircuitBreakerOpenError();
      }

      this.state = "half_open";
      this.recoveryProbeInFlight = true;
    }

    try {
      const result = await task();
      this.close();
      return result;
    } catch (error) {
      if (this.shouldCountFailure(error)) {
        this.consecutiveFailures += 1;
        if (
          this.state === "half_open"
          || this.consecutiveFailures >= this.failureThreshold
        ) {
          this.state = "open";
          this.openedAt = this.now();
        }
      } else if (this.state === "half_open") {
        this.close();
      }
      throw error;
    } finally {
      this.recoveryProbeInFlight = false;
    }
  }

  snapshot() {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      openedAt: this.openedAt,
    };
  }

  private close() {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }
}
