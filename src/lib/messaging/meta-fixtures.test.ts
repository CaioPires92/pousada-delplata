import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fixturesDirectory = path.join(import.meta.dirname, "fixtures", "meta");

type MetaFixture = {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: Array<Record<string, unknown>>;
        statuses?: Array<Record<string, unknown>>;
      };
    }>;
  }>;
};

async function loadFixtures() {
  const filenames = (await readdir(fixturesDirectory))
    .filter(filename => filename.endsWith(".json"))
    .sort();

  return Promise.all(filenames.map(async filename => ({
    filename,
    raw: await readFile(path.join(fixturesDirectory, filename), "utf8"),
  })));
}

describe("sanitized Meta webhook fixtures", () => {
  it("covers the message formats and delivery statuses required by the roadmap", async () => {
    const fixtures = await loadFixtures();
    const payloads = fixtures.map(fixture => JSON.parse(fixture.raw) as MetaFixture);
    const values = payloads.flatMap(payload =>
      payload.entry.flatMap(entry => entry.changes.map(change => change.value)),
    );
    const messages = values.flatMap(value => value.messages ?? []);
    const statuses = values.flatMap(value => value.statuses ?? []);

    expect(fixtures.map(fixture => fixture.filename)).toEqual([
      "button-message.json",
      "document-message.json",
      "image-message.json",
      "list-message.json",
      "status-events.json",
      "text-message.json",
      "unknown-message.json",
    ]);
    expect(messages.map(message => message.type)).toEqual(
      expect.arrayContaining(["text", "interactive", "image", "document"]),
    );
    expect(statuses.map(status => status.status)).toEqual([
      "sent",
      "delivered",
      "read",
      "failed",
    ]);
  });

  it("uses the documented Meta envelope and explicit synthetic identifiers", async () => {
    const fixtures = await loadFixtures();

    for (const fixture of fixtures) {
      const payload = JSON.parse(fixture.raw) as MetaFixture;
      expect(payload.object).toBe("whatsapp_business_account");
      expect(payload.entry).not.toHaveLength(0);

      for (const entry of payload.entry) {
        expect(entry.id).toMatch(/^WABA_TEST_/);
        for (const change of entry.changes) {
          expect(change.field).toBe("messages");
          expect(change.value.messaging_product).toBe("whatsapp");
          expect(change.value.metadata.phone_number_id).toMatch(/^PHONE_NUMBER_TEST_/);
          for (const message of change.value.messages ?? []) {
            expect(message.id).toMatch(/^wamid\.TEST_/);
          }
          for (const status of change.value.statuses ?? []) {
            expect(status.id).toMatch(/^wamid\.TEST_/);
          }
        }
      }
    }
  });

  it("contains no credential, production URL, Brazilian phone or common secret format", async () => {
    const fixtures = await loadFixtures();
    const combined = fixtures.map(fixture => fixture.raw).join("\n");

    expect(combined).not.toMatch(/https?:\/\//i);
    expect(combined).not.toMatch(/bearer\s+/i);
    expect(combined).not.toMatch(/access[_-]?token|api[_-]?key|client[_-]?secret/i);
    expect(combined).not.toMatch(/(?:\+?55)?(?:1[1-9]|[2-9]\d)9\d{8}/);
    expect(combined).not.toMatch(/EAA[A-Za-z0-9]{20,}/);
  });
});
