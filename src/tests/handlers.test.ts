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

describe("handler: querylog_get (reason filter)", () => {
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

  it("serializes a reason array as repeated query params", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: [], oldest: "" });

    const result = await mcpClient.callTool({
      name: "querylog_get",
      arguments: { reason: ["FilteredBlackList", "Rewrite"] },
    });

    expect(result.isError).toBeFalsy();
    const path = vi.mocked(mockClient.get).mock.calls[0][0] as string;
    expect(path).toBe("querylog?reason=FilteredBlackList&reason=Rewrite");
  });

  it("still supports the deprecated response_status param", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({ data: [], oldest: "" });

    await mcpClient.callTool({
      name: "querylog_get",
      arguments: { response_status: "blocked" },
    });

    const path = vi.mocked(mockClient.get).mock.calls[0][0] as string;
    expect(path).toBe("querylog?response_status=blocked");
  });

  it("errors when both reason and response_status are supplied", async () => {
    const result = await mcpClient.callTool({
      name: "querylog_get",
      arguments: {
        reason: ["FilteredBlackList"],
        response_status: "blocked",
      },
    });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("mutually exclusive");
    expect(mockClient.get).not.toHaveBeenCalled();
  });
});

describe("handler: clients_get", () => {
  it("lists blocked service IDs and the global flag", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      clients: [
        {
          name: "laptop",
          ids: ["10.0.0.5"],
          use_global_settings: false,
          filtering_enabled: true,
          safebrowsing_enabled: false,
          parental_enabled: false,
          blocked_services: ["youtube", "tiktok"],
          use_global_blocked_services: false,
          tags: [],
        },
      ],
      auto_clients: [],
    });
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "clients_get",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Blocked services: youtube, tiktok");
    expect(text).toContain("Global blocked services: no");
    await cleanup();
  });
});

describe("handler: clients_search", () => {
  it("parses the real clients/search response shape", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.post).mockResolvedValueOnce([
      {
        "192.168.1.20": {
          name: "tv",
          ids: ["192.168.1.20"],
          use_global_settings: true,
          filtering_enabled: true,
          safebrowsing_enabled: false,
          parental_enabled: false,
          blocked_services: ["tiktok"],
          use_global_blocked_services: false,
          whois_info: {},
          disallowed: false,
          disallowed_rule: "",
        },
      },
    ]);
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "clients_search",
      arguments: { ids: ["192.168.1.20", "10.0.0.99"] },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Result for 192.168.1.20: tv");
    expect(text).toContain("Blocked services: tiktok");
    expect(text).toContain("Result for 10.0.0.99: no match");
    await cleanup();
  });

  it("reports disallowed clients with the matching rule", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.post).mockResolvedValueOnce([
      {
        "192.168.1.50": {
          whois_info: { country: "PL" },
          disallowed: true,
          disallowed_rule: "192.168.1.50",
        },
      },
    ]);
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "clients_search",
      arguments: { ids: ["192.168.1.50"] },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Disallowed: yes (rule: 192.168.1.50)");
    expect(text).toContain("WHOIS: country: PL");
    expect(text).toContain("Blocked services: none");
    expect(text).not.toContain("Global blocked services");
    await cleanup();
  });
});

describe("handler: dns_get_info", () => {
  it("prints upstream mode, timeout, optimistic cache, and unknown keys", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      upstream_dns: ["https://dns10.quad9.net/dns-query"],
      upstream_dns_file: "",
      bootstrap_dns: ["9.9.9.10"],
      fallback_dns: ["1.1.1.1"],
      protection_enabled: true,
      ratelimit: 20,
      blocking_mode: "default",
      blocking_ipv4: "",
      blocking_ipv6: "",
      edns_cs_enabled: false,
      edns_cs_use_custom: false,
      edns_cs_custom_ip: "",
      dnssec_enabled: true,
      disable_ipv6: false,
      upstream_mode: "parallel",
      upstream_timeout: 2,
      cache_size: 4194304,
      cache_ttl_min: 60,
      cache_ttl_max: 86400,
      cache_optimistic: true,
      resolve_clients: true,
      use_private_ptr_resolvers: true,
      local_ptr_upstreams: ["192.168.1.1"],
      default_local_ptr_upstreams: [],
      ratelimit_subnet_len_ipv4: 24,
    });
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "dns_get_info",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Upstream mode: parallel");
    expect(text).toContain("Upstream timeout: 2s");
    expect(text).toContain("Rate limit: 20 req/s");
    expect(text).toContain("Optimistic caching: enabled");
    expect(text).toContain("IPv6 resolution: enabled");
    expect(text).toContain("Local PTR upstreams: 192.168.1.1");
    expect(text).toContain("Other settings:");
    expect(text).toContain("ratelimit_subnet_len_ipv4: 24");
    await cleanup();
  });
});

describe("handler: dns_set_config", () => {
  it("passes upstream_timeout through and maps rate_limit to ratelimit", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.post).mockResolvedValueOnce({});
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "dns_set_config",
      arguments: {
        upstream_timeout: 2,
        upstream_mode: "parallel",
        rate_limit: 20,
      },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalledWith("dns_config", {
      upstream_timeout: 2,
      upstream_mode: "parallel",
      ratelimit: 20,
    });
    await cleanup();
  });
});
