import { describe, expect, it } from "vitest";

import { extractWhatsAppIdentity } from "./identity";

describe("extractWhatsAppIdentity", () => {
  it("preserves the LID while resolving the phone from remoteJidAlt", () => {
    expect(extractWhatsAppIdentity({
      data: {
        key: {
          fromMe: false,
          remoteJid: "23961740038256@lid",
          remoteJidAlt: "5519998701203@s.whatsapp.net",
          addressingMode: "lid",
        },
        pushName: "Hóspede",
      },
    })).toEqual({
      phone: "5519998701203",
      lid: "23961740038256",
      jid: "5519998701203@s.whatsapp.net",
      pushName: "Hóspede",
    });
  });
});
