/**
 * Client tools: configured and auto-detected client listing and search.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AdGuardClient } from "../core/client.js";
import { registerTool } from "../core/tools.js";
import type { AppConfig } from "../types/index.js";

// --- Local response interfaces ---

interface ConfiguredClient {
  name: string;
  ids: string[];
  use_global_settings: boolean;
  filtering_enabled: boolean;
  safebrowsing_enabled: boolean;
  parental_enabled: boolean;
  blocked_services: string[];
  use_global_blocked_services: boolean;
  tags: string[];
}

interface WhoisInfo {
  [key: string]: string;
}

interface AutoClient {
  ip: string;
  name: string;
  source: string;
  whois_info: WhoisInfo;
}

interface ClientsResponse {
  clients: ConfiguredClient[];
  auto_clients: AutoClient[];
}

interface ClientSearchEntry {
  name?: string;
  ids?: string[];
  use_global_settings?: boolean;
  filtering_enabled?: boolean;
  safebrowsing_enabled?: boolean;
  parental_enabled?: boolean;
  blocked_services?: string[];
  use_global_blocked_services?: boolean;
  whois_info?: WhoisInfo;
  disallowed?: boolean;
  disallowed_rule?: string;
}

type ClientSearchResponse = Array<Record<string, ClientSearchEntry>>;

// --- Formatters ---

function formatBlockedServices(
  services: string[] | undefined,
  useGlobal: boolean | undefined,
): string[] {
  const lines: string[] = [
    `    Blocked services: ${services?.length ? services.join(", ") : "none"}`,
  ];
  if (useGlobal !== undefined) {
    lines.push(`    Global blocked services: ${useGlobal ? "yes" : "no"}`);
  }
  return lines;
}

function formatConfiguredClient(c: ConfiguredClient): string {
  const lines: string[] = [
    `  ${c.name}`,
    `    IDs: ${c.ids.join(", ")}`,
    `    Global settings: ${c.use_global_settings ? "yes" : "no"}`,
    `    Filtering: ${c.filtering_enabled ? "on" : "off"}`,
    `    Safe browsing: ${c.safebrowsing_enabled ? "on" : "off"}`,
    `    Parental: ${c.parental_enabled ? "on" : "off"}`,
    ...formatBlockedServices(c.blocked_services, c.use_global_blocked_services),
  ];
  return lines.join("\n");
}

function formatAutoClient(c: AutoClient): string {
  const lines: string[] = [`  ${c.ip}`];
  if (c.name) {
    lines.push(`    Name: ${c.name}`);
  }
  if (c.whois_info && Object.keys(c.whois_info).length > 0) {
    const whoisParts = Object.entries(c.whois_info)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    lines.push(`    WHOIS: ${whoisParts}`);
  }
  return lines.join("\n");
}

function formatClients(data: ClientsResponse): string {
  const sections: string[] = [];

  sections.push(`Configured Clients (${data.clients.length})`);
  if (data.clients.length === 0) {
    sections.push("  No configured clients.");
  } else {
    for (const c of data.clients) {
      sections.push(formatConfiguredClient(c));
    }
  }

  sections.push("");
  sections.push(`Auto-Detected Clients (${data.auto_clients.length})`);
  if (data.auto_clients.length === 0) {
    sections.push("  No auto-detected clients.");
  } else {
    for (const c of data.auto_clients) {
      sections.push(formatAutoClient(c));
    }
  }

  return sections.join("\n");
}

function formatSearchResult(
  searchedId: string,
  entry: ClientSearchEntry,
): string {
  const lines: string[] = [
    `  Result for ${searchedId}: ${entry.name || "(unnamed)"}`,
  ];
  if (entry.ids?.length) {
    lines.push(`    IDs: ${entry.ids.join(", ")}`);
  }
  if (entry.use_global_settings !== undefined) {
    lines.push(
      `    Global settings: ${entry.use_global_settings ? "yes" : "no"}`,
    );
  }
  if (entry.filtering_enabled !== undefined) {
    lines.push(`    Filtering: ${entry.filtering_enabled ? "on" : "off"}`);
  }
  if (entry.safebrowsing_enabled !== undefined) {
    lines.push(
      `    Safe browsing: ${entry.safebrowsing_enabled ? "on" : "off"}`,
    );
  }
  if (entry.parental_enabled !== undefined) {
    lines.push(`    Parental: ${entry.parental_enabled ? "on" : "off"}`);
  }
  lines.push(
    ...formatBlockedServices(
      entry.blocked_services,
      entry.use_global_blocked_services,
    ),
  );
  if (entry.whois_info && Object.keys(entry.whois_info).length > 0) {
    const whoisParts = Object.entries(entry.whois_info)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    lines.push(`    WHOIS: ${whoisParts}`);
  }
  if (entry.disallowed !== undefined) {
    const rule = entry.disallowed_rule
      ? ` (rule: ${entry.disallowed_rule})`
      : "";
    lines.push(`    Disallowed: ${entry.disallowed ? "yes" : "no"}${rule}`);
  }
  return lines.join("\n");
}

// --- Registration ---

export function registerClientsTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: "clients_get",
      title: "Get Clients",
      description:
        "Retrieve all configured and auto-detected clients with their settings",
      category: "clients",
      accessTier: "read-only",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
      inputSchema: {},
      handler: async () => {
        const data = (await client.get("clients")) as ClientsResponse;
        return formatClients(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: "clients_search",
      title: "Search Clients",
      description:
        "Search for specific clients by their IDs (IP, MAC, CIDR, or client ID)",
      category: "clients",
      accessTier: "read-only",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
      inputSchema: {
        ids: z.array(z.string()).describe("Client identifiers to search for"),
      },
      handler: async (args) => {
        const ids = args.ids as string[];
        // PITFALL: Use POST to clients/search, not deprecated GET clients/find.
        // Response shape: [{"<searched-id>": {…client entry…}}, …]
        const results = (await client.post("clients/search", {
          clients: ids.map((id) => ({ id })),
        })) as ClientSearchResponse;

        const lines: string[] = ["Client Search Results"];
        const matched = new Set<string>();
        for (const resultGroup of results ?? []) {
          for (const [searchedId, entry] of Object.entries(resultGroup)) {
            matched.add(searchedId);
            lines.push(formatSearchResult(searchedId, entry));
          }
        }
        for (const id of ids) {
          if (!matched.has(id)) {
            lines.push(`  Result for ${id}: no match`);
          }
        }
        return lines.join("\n");
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: "clients_add",
      title: "Add Client",
      description: "Add a new persistent client with per-client settings",
      category: "clients",
      accessTier: "full",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
      inputSchema: {
        name: z.string().describe("Client display name"),
        ids: z
          .array(z.string())
          .describe("Client identifiers (IPs, CIDRs, MACs, client IDs)"),
        use_global_settings: z
          .boolean()
          .optional()
          .describe("Use global settings for this client"),
        filtering_enabled: z
          .boolean()
          .optional()
          .describe("Enable filtering for this client"),
        safebrowsing_enabled: z
          .boolean()
          .optional()
          .describe("Enable safe browsing for this client"),
        parental_enabled: z
          .boolean()
          .optional()
          .describe("Enable parental control for this client"),
        use_global_blocked_services: z
          .boolean()
          .optional()
          .describe("Use global blocked services list"),
        blocked_services: z
          .array(z.string())
          .optional()
          .describe("Per-client blocked service IDs"),
        tags: z.array(z.string()).optional().describe("Client tags"),
      },
      handler: async (args) => {
        const body: Record<string, unknown> = {
          name: args.name,
          ids: args.ids,
        };
        if (args.use_global_settings !== undefined)
          body.use_global_settings = args.use_global_settings;
        if (args.filtering_enabled !== undefined)
          body.filtering_enabled = args.filtering_enabled;
        if (args.safebrowsing_enabled !== undefined)
          body.safebrowsing_enabled = args.safebrowsing_enabled;
        if (args.parental_enabled !== undefined)
          body.parental_enabled = args.parental_enabled;
        if (args.use_global_blocked_services !== undefined)
          body.use_global_blocked_services = args.use_global_blocked_services;
        if (args.blocked_services !== undefined)
          body.blocked_services = args.blocked_services;
        if (args.tags !== undefined) body.tags = args.tags;

        await client.post("clients/add", body);
        return `Client '${args.name as string}' added.`;
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: "clients_update",
      title: "Update Client",
      description: "Update an existing persistent client by name",
      category: "clients",
      accessTier: "full",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
      inputSchema: {
        name: z.string().describe("Name of the client to update"),
        data: z
          .object({
            name: z.string().describe("New client display name"),
            ids: z
              .array(z.string())
              .describe("Client identifiers (IPs, CIDRs, MACs, client IDs)"),
            use_global_settings: z
              .boolean()
              .optional()
              .describe("Use global settings"),
            filtering_enabled: z
              .boolean()
              .optional()
              .describe("Enable filtering"),
            safebrowsing_enabled: z
              .boolean()
              .optional()
              .describe("Enable safe browsing"),
            parental_enabled: z
              .boolean()
              .optional()
              .describe("Enable parental control"),
            use_global_blocked_services: z
              .boolean()
              .optional()
              .describe("Use global blocked services"),
            blocked_services: z
              .array(z.string())
              .optional()
              .describe("Per-client blocked service IDs"),
            tags: z.array(z.string()).optional().describe("Client tags"),
          })
          .describe("New client data (name and ids required)"),
      },
      handler: async (args) => {
        const name = args.name as string;
        await client.post("clients/update", { name, data: args.data });
        return `Client '${name}' updated.`;
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: "clients_delete",
      title: "Delete Client",
      description: "Delete a persistent client by name",
      category: "clients",
      accessTier: "full",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
      inputSchema: {
        name: z.string().describe("Name of the client to delete"),
      },
      handler: async (args) => {
        const name = args.name as string;
        await client.post("clients/delete", { name });
        return `Client '${name}' deleted.`;
      },
    },
    config,
  );
}
