import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MetaMessagingProvider,
  MetaMessagingProviderError,
  metaMessagingConfigFromEnv,
} from "./meta-provider";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const config = {
  accessToken: "synthetic-access-token",
  phoneNumberId: "PHONE_NUMBER_TEST_001",
  graphApiVersion: "v99.0",
};

describe("MetaMessagingProvider", () => {
  afterEach(() => {
    delete process.env.META_WHATSAPP_ACCESS_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.META_WHATSAPP_GRAPH_API_VERSION;
  });

  it("sends text using the Cloud API contract and returns the wamid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      messaging_product: "whatsapp",
      messages: [{ id: "wamid.TEST_OUTBOUND_001" }],
    }));
    const provider = new MetaMessagingProvider(
      config,
      fetchMock,
      () => new Date("2026-07-28T16:30:00.000Z"),
    );

    await expect(provider.send({
      kind: "text",
      recipientId: "15550000001",
      text: "Mensagem sintética",
    })).resolves.toEqual({
      externalMessageId: "wamid.TEST_OUTBOUND_001",
      acceptedAt: "2026-07-28T16:30:00.000Z",
      status: "accepted",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v99.0/PHONE_NUMBER_TEST_001/messages",
      {
        method: "POST",
        headers: {
          authorization: "Bearer synthetic-access-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "15550000001",
          type: "text",
          text: {
            preview_url: false,
            body: "Mensagem sintética",
          },
        }),
      },
    );
  });

  it("includes context when replying to an external message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      messages: [{ id: "wamid.TEST_REPLY_001" }],
    }));
    const provider = new MetaMessagingProvider(config, fetchMock);

    await provider.send({
      kind: "text",
      recipientId: "15550000001",
      text: "Resposta sintética",
      replyToExternalMessageId: "wamid.TEST_INBOUND_001",
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      context: { message_id: "wamid.TEST_INBOUND_001" },
    });
  });

  it("returns a controlled error without embedding the provider response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      error: { message: "sensitive provider detail", code: 190 },
    }, 401));
    const provider = new MetaMessagingProvider(config, fetchMock);

    const error = await provider.send({
      kind: "text",
      recipientId: "15550000001",
      text: "Mensagem sintética",
    }).catch(value => value);

    expect(error).toBeInstanceOf(MetaMessagingProviderError);
    expect(error).toMatchObject({ code: "request_failed", status: 401 });
    expect(error.message).not.toContain("sensitive provider detail");
    expect(error.message).not.toContain(config.accessToken);
  });

  it("rejects a successful response without an external message ID", async () => {
    const provider = new MetaMessagingProvider(
      config,
      vi.fn().mockResolvedValue(response({ messages: [] })),
    );

    await expect(provider.send({
      kind: "text",
      recipientId: "15550000001",
      text: "Mensagem sintética",
    })).rejects.toMatchObject({ code: "invalid_response", status: 200 });
  });

  it("leaves templates for the dedicated template microtask without calling HTTP", async () => {
    const fetchMock = vi.fn();
    const provider = new MetaMessagingProvider(config, fetchMock);

    await expect(provider.send({
      kind: "template",
      recipientId: "15550000001",
      templateName: "synthetic_template",
      languageCode: "pt_BR",
      parameters: [],
    })).rejects.toMatchObject({ code: "unsupported_message" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["META_WHATSAPP_ACCESS_TOKEN", {
      META_WHATSAPP_PHONE_NUMBER_ID: "PHONE_NUMBER_TEST_001",
      META_WHATSAPP_GRAPH_API_VERSION: "v99.0",
    }],
    ["META_WHATSAPP_PHONE_NUMBER_ID", {
      META_WHATSAPP_ACCESS_TOKEN: "synthetic-access-token",
      META_WHATSAPP_GRAPH_API_VERSION: "v99.0",
    }],
    ["META_WHATSAPP_GRAPH_API_VERSION", {
      META_WHATSAPP_ACCESS_TOKEN: "synthetic-access-token",
      META_WHATSAPP_PHONE_NUMBER_ID: "PHONE_NUMBER_TEST_001",
    }],
  ])("fails closed when %s is missing", (name, environment) => {
    Object.assign(process.env, environment);

    expect(() => metaMessagingConfigFromEnv()).toThrow(
      `Missing Meta messaging configuration: ${name}`,
    );
  });
});
