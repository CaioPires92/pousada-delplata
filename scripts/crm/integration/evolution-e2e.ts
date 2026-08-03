import { runEvolutionMessagingE2E } from "../../../src/lib/messaging/evolution-e2e";

async function main() {
  try {
    const result = await runEvolutionMessagingE2E();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evolution E2E failed";
    process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
    process.exitCode = 1;
  }
}

void main();
