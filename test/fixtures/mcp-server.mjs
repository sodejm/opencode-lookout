/** Minimal offline MCP fixture: handshake and empty catalogs, no tools or network. */
import { createInterface } from "node:readline";
const input = createInterface({ input: process.stdin });
input.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  const result =
    request.method === "initialize"
      ? {
          protocolVersion: request.params.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: "control-center-fixture", version: "1.0.0" },
        }
      : request.method === "tools/list"
        ? { tools: [] }
        : {};
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\n",
  );
});
