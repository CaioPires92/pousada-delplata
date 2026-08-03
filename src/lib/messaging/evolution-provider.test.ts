import { describe, expect, it, vi } from "vitest";
import {
  EvolutionMessagingProvider,
  EvolutionMessagingProviderError,
  evolutionMessagingConfigFromEnv,
} from "./evolution-provider";

const config = {
  apiUrl: "http://evolution.test",
  apiKey: "synthetic-api-key",
  instanceName: "delplata-test",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("EvolutionMessagingProvider", () => {
  it("sends text through the Evolution v2 contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ key: { id: "EVO_TEST_001" } }));
    const provider = new EvolutionMessagingProvider(
      config,
      fetchMock,
      () => new Date("2026-08-03T12:00:00.000Z"),
    );

    await expect(provider.send({
      kind: "text",
      recipientId: "5511999990001",
      text: "Mensagem sintética",
    })).resolves.toEqual({
      externalMessageId: "EVO_TEST_001",
      acceptedAt: "2026-08-03T12:00:00.000Z",
      status: "sent",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://evolution.test/message/sendText/delplata-test",
      {
        method: "POST",
        headers: { apikey: "synthetic-api-key", "content-type": "application/json" },
        body: JSON.stringify({ number: "5511999990001", text: "Mensagem sintética" }),
      },
    );
  });

  it("preserves supported WhatsApp JIDs and reply context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ data: { key: { id: "EVO_REPLY_001" } } }));
    const provider = new EvolutionMessagingProvider(config, fetchMock);

    await provider.send({
      kind: "text",
      recipientId: "123456789012345@lid",
      text: "Resposta",
      replyToExternalMessageId: "EVO_INBOUND_001",
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      number: "123456789012345@lid",
      text: "Resposta",
      quoted: { key: { id: "EVO_INBOUND_001" } },
    });
  });

  it("rejects templates and invalid recipients before HTTP", async () => {
    const fetchMock = vi.fn();
    const provider = new EvolutionMessagingProvider(config, fetchMock);

    await expect(provider.send({
      kind: "template",
      recipientId: "5511999990001",
      templateName: "teste",
      languageCode: "pt_BR",
      parameters: [],
    })).rejects.toMatchObject({ code: "invalid_message" });
    await expect(provider.send({
      kind: "text",
      recipientId: "destino inválido",
      text: "Teste",
    })).rejects.toMatchObject({ code: "invalid_message" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries transient failures and does not expose provider details", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: "sensitive detail" }, 500))
      .mockResolvedValueOnce(response({ key: { id: "EVO_RETRY_001" } }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const provider = new EvolutionMessagingProvider(config, fetchMock, undefined, { sleep });

    await expect(provider.send({
      kind: "text",
      recipientId: "5511999990001",
      text: "Teste",
    })).resolves.toMatchObject({ externalMessageId: "EVO_RETRY_001" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);

    const failed = new EvolutionMessagingProvider(
      config,
      vi.fn().mockResolvedValue(response({ error: "sensitive detail" }, 401)),
    );
    const error = await failed.send({
      kind: "text",
      recipientId: "5511999990001",
      text: "Teste",
    }).catch(value => value);
    expect(error).toBeInstanceOf(EvolutionMessagingProviderError);
    expect(error).toMatchObject({ code: "request_failed", status: 401, retryable: false });
    expect(error.message).not.toContain("sensitive detail");
    expect(error.message).not.toContain(config.apiKey);
  });

  it("fails on malformed successful responses", async () => {
    const provider = new EvolutionMessagingProvider(config, vi.fn().mockResolvedValue(response({})));
    await expect(provider.send({
      kind: "text",
      recipientId: "5511999990001",
      text: "Teste",
    })).rejects.toMatchObject({ code: "invalid_response", status: 200 });
  });

  it.each(["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE_NAME"])(
    "fails closed when %s is missing",
    missing => {
      const environment: Record<string, string> = {
        EVOLUTION_API_URL: "http://evolution.test/",
        EVOLUTION_API_KEY: "synthetic-api-key",
        EVOLUTION_INSTANCE_NAME: "delplata-test",
      };
      delete environment[missing];
      expect(() => evolutionMessagingConfigFromEnv(environment)).toThrow(
        `Missing Evolution messaging configuration: ${missing}`,
      );
    },
  );

  it("normalizes the configured base URL", () => {
    expect(evolutionMessagingConfigFromEnv({
      EVOLUTION_API_URL: "http://evolution.test///",
      EVOLUTION_API_KEY: "synthetic-api-key",
      EVOLUTION_INSTANCE_NAME: "delplata-test",
    }).apiUrl).toBe("http://evolution.test");
  });
});
