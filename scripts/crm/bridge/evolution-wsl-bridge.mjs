import http from "node:http";
import { spawn } from "node:child_process";

const listenPort = Number(process.env.EVOLUTION_BRIDGE_PORT || "8080");
const targetBaseUrl = (process.env.WINDOWS_EVOLUTION_API_URL || "http://localhost:8080").replace(/\/$/, "");
const cmdPath = process.env.EVOLUTION_BRIDGE_CMD || "/mnt/c/Windows/System32/cmd.exe";

function splitCurlResponse(buffer) {
  const raw = buffer.toString("utf8");
  const match = raw.match(/\r?\n\r?\n/);
  if (!match || match.index == null) {
    throw new Error("Bridge did not receive a valid HTTP response from Windows curl");
  }

  const headerEnd = match.index + match[0].length;
  const headerText = raw.slice(0, match.index);
  const body = buffer.subarray(Buffer.byteLength(raw.slice(0, headerEnd), "utf8"));
  const headerLines = headerText.split(/\r?\n/);
  const statusLine = headerLines.shift() || "HTTP/1.1 502 Bad Gateway";
  const statusMatch = statusLine.match(/^HTTP\/\d+(?:\.\d+)?\s+(\d{3})/);
  const statusCode = statusMatch ? Number(statusMatch[1]) : 502;

  const headers = new Headers();
  for (const line of headerLines) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) continue;
    headers.append(key, value);
  }

  return { statusCode, headers, body };
}

function buildCurlArgs(req, targetUrl) {
  const args = ["/c", "curl", "-sS", "-i", "--http1.1", "-X", req.method, targetUrl];

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    if (key.toLowerCase() === "host") continue;
    const rendered = Array.isArray(value) ? value.join(", ") : value;
    args.push("-H", `${key}: ${rendered}`);
  }

  return args;
}

const server = http.createServer((req, res) => {
  const chunks = [];

  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const targetUrl = `${targetBaseUrl}${req.url || "/"}`;
    const args = buildCurlArgs(req, targetUrl);
    const hasBody = body.length > 0 && !["GET", "HEAD"].includes(req.method || "GET");

    if (hasBody) {
      args.push("--data-binary", "@-");
    }

    const child = spawn(cmdPath, args, { stdio: ["pipe", "pipe", "pipe"], cwd: "/mnt/c" });
    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "bridge_spawn_failed", message: error.message }));
    });

    child.on("close", (code) => {
      const stderrText = Buffer.concat(stderrChunks).toString("utf8").trim();
      if (code !== 0) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "bridge_request_failed", code, message: stderrText }));
        return;
      }

      try {
        const { statusCode, headers, body: responseBody } = splitCurlResponse(Buffer.concat(stdoutChunks));
        const responseHeaders = Object.fromEntries(headers.entries());
        delete responseHeaders["transfer-encoding"];
        delete responseHeaders["content-length"];
        responseHeaders["x-evolution-bridge"] = "windows-curl";
        res.writeHead(statusCode, responseHeaders);
        res.end(responseBody);
      } catch (error) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "bridge_parse_failed",
            message: error instanceof Error ? error.message : "Unknown parse error",
            stderr: stderrText,
          }),
        );
      }
    });

    if (hasBody) {
      child.stdin.write(body);
    }
    child.stdin.end();
  });
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(`Evolution WSL bridge listening on http://127.0.0.1:${listenPort} -> ${targetBaseUrl}`);
});
