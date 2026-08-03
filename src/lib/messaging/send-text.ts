import { createMessagingProvider } from "./provider-factory";

export async function sendMessagingText(recipientId: string, text: string) {
  const provider = createMessagingProvider();
  const result = await provider.send({ kind: "text", recipientId, text });
  return { provider: provider.name, ...result };
}
