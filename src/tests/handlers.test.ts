import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdGuardClient } from "../core/client.js";
import { createServer } from "../core/server.js";
import { registerAllTools } from "../tools/index.js";
import { connectTestClient, makeConfig, makeMockClient } from "./helpers.js";

describe("handler: global_get_status", () => {
  let cleanup: () => Promise<void>;
  let mcpClient: Client;
  let mockClient: AdGuardClient;

  beforeEach(async () => {
    mockClient = makeMockClient();
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const conn = await connectTestClient(server);
    mcpClient = conn.client;
    cleanup = conn.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("returns formatted status text on success", async () => {
    const fakeStatus = {
      version: "0.107.0",
      language: "en",
      dns_addresses: ["192.168.1.1"],
      dns_port: 53,
      http_port: 80,
      protection_enabled: true,
      protection_disabled_duration: 0,
      running: true,
    };
    vi.mocked(mockClient.get).mockResolvedValueOnce(fakeStatus);

    const result = await mcpClient.callTool({
      name: "global_get_status",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Server Status");
    expect(text).toContain("0.107.0");
    expect(text).toContain("enabled");
  });

  it("returns isError when client throws", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce(
      new Error("connection refused"),
    );

    const result = await mcpClient.callTool({
      name: "global_get_status",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("connection refused");
  });
});

describe("handler: global_set_protection (full tier)", () => {
  it("is not registered in read-only mode", async () => {
    const server = createServer();
    registerAllTools(
      server,
      makeMockClient(),
      makeConfig({ accessTier: "read-only" }),
    );
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("global_set_protection");
    await cleanup();
  });

  it("calls client.post on success", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.post).mockResolvedValueOnce({});
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "global_set_protection",
      arguments: { enabled: true },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalled();
    await cleanup();
  });
});
