import { describe, expect, it } from "vitest";

import {
  assertOutboundProviderPolicy,
  OutboundPolicyError,
} from "./outbound-policy";

const now = new Date("2026-08-10T18:00:00.000Z");
const textMessage = {
  kind: "text" as const,
  recipientId: "5519999999999",
  text: "Olá",
};

describe("outbound provider policy", () => {
  it("allows Evolution text without applying Meta's 24-hour window", () => {
    expect(() => assertOutboundProviderPolicy({
      provider: "evolution",
      message: textMessage,
      lastInboundAt: null,
      now,
    })).not.toThrow();
  });

  it("allows Meta text inside the 24-hour customer care window", () => {
    expect(() => assertOutboundProviderPolicy({
      provider: "meta",
      message: textMessage,
      lastInboundAt: new Date("2026-08-09T18:00:00.000Z"),
      now,
    })).not.toThrow();
  });

  it("blocks Meta free-form text outside the window", () => {
    expect(() => assertOutboundProviderPolicy({
      provider: "meta",
      message: textMessage,
      lastInboundAt: new Date("2026-08-09T17:59:59.999Z"),
      now,
    })).toThrow(OutboundPolicyError);
  });

  it("allows an approved Meta template outside the window", () => {
    expect(() => assertOutboundProviderPolicy({
      provider: "meta",
      message: {
        kind: "template",
        recipientId: "5519999999999",
        templateName: "followup_reserva",
        languageCode: "pt_BR",
        parameters: [],
      },
      lastInboundAt: null,
      now,
    })).not.toThrow();
  });
});
