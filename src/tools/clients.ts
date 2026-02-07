/**
 * Client tools: configured and auto-detected client listing and search.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

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

interface ClientSearchResult {
  name: string;
  ids: string[];
  use_global_settings: boolean;
  filtering_enabled: boolean;
  safebrowsing_enabled: boolean;
  parental_enabled: boolean;
  blocked_services: string[];
  use_global_blocked_services: boolean;
}

// --- Formatters ---

function formatConfiguredClient(c: ConfiguredClient): string {
  const lines: string[] = [
    `  ${c.name}`,
    `    IDs: ${c.ids.join(', ')}`,
    `    Global settings: ${c.use_global_settings ? 'yes' : 'no'}`,
    `    Filtering: ${c.filtering_enabled ? 'on' : 'off'}`,
    `    Safe browsing: ${c.safebrowsing_enabled ? 'on' : 'off'}`,
    `    Parental: ${c.parental_enabled ? 'on' : 'off'}`,
    `    Blocked services: ${c.blocked_services.length}`,
  ];
  return lines.join('\n');
}

function formatAutoClient(c: AutoClient): string {
  const lines: string[] = [`  ${c.ip}`];
  if (c.name) {
    lines.push(`    Name: ${c.name}`);
  }
  if (c.whois_info && Object.keys(c.whois_info).length > 0) {
    const whoisParts = Object.entries(c.whois_info)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    lines.push(`    WHOIS: ${whoisParts}`);
  }
  return lines.join('\n');
}

function formatClients(data: ClientsResponse): string {
  const sections: string[] = [];

  sections.push(`Configured Clients (${data.clients.length})`);
  if (data.clients.length === 0) {
    sections.push('  No configured clients.');
  } else {
    for (const c of data.clients) {
      sections.push(formatConfiguredClient(c));
    }
  }

  sections.push('');
  sections.push(`Auto-Detected Clients (${data.auto_clients.length})`);
  if (data.auto_clients.length === 0) {
    sections.push('  No auto-detected clients.');
  } else {
    for (const c of data.auto_clients) {
      sections.push(formatAutoClient(c));
    }
  }

  return sections.join('\n');
}

function formatSearchResult(result: ClientSearchResult): string {
  const lines: string[] = [
    `  ${result.name}`,
    `    IDs: ${result.ids.join(', ')}`,
    `    Global settings: ${result.use_global_settings ? 'yes' : 'no'}`,
    `    Filtering: ${result.filtering_enabled ? 'on' : 'off'}`,
    `    Safe browsing: ${result.safebrowsing_enabled ? 'on' : 'off'}`,
    `    Parental: ${result.parental_enabled ? 'on' : 'off'}`,
    `    Blocked services: ${result.blocked_services?.length ?? 0}`,
  ];
  return lines.join('\n');
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
      name: 'clients_get',
      description:
        'Retrieve all configured and auto-detected clients with their settings',
      category: 'clients',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('clients')) as ClientsResponse;
        return formatClients(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'clients_search',
      description:
        'Search for specific clients by their IDs (IP, MAC, CIDR, or client ID)',
      category: 'clients',
      accessTier: 'read-only',
      inputSchema: {
        ids: z.array(z.string()).describe('Client identifiers to search for'),
      },
      handler: async (args) => {
        const ids = args.ids as string[];
        // PITFALL: Use POST to clients/search, not deprecated GET clients/find
        const results = (await client.post(
          'clients/search',
          { clients: ids.map((id) => ({ id })) },
        )) as ClientSearchResult[][];

        if (!results || results.length === 0) {
          return 'No clients found.';
        }

        const lines: string[] = ['Client Search Results'];
        for (const resultGroup of results) {
          for (const r of resultGroup) {
            lines.push(formatSearchResult(r));
          }
        }

        return lines.join('\n');
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'clients_add',
      description:
        'Add a new persistent client with per-client settings',
      category: 'clients',
      accessTier: 'full',
      inputSchema: {
        name: z.string().describe('Client display name'),
        ids: z
          .array(z.string())
          .describe('Client identifiers (IPs, CIDRs, MACs, client IDs)'),
        use_global_settings: z
          .boolean()
          .optional()
          .describe('Use global settings for this client'),
        filtering_enabled: z
          .boolean()
          .optional()
          .describe('Enable filtering for this client'),
        safebrowsing_enabled: z
          .boolean()
          .optional()
          .describe('Enable safe browsing for this client'),
        parental_enabled: z
          .boolean()
          .optional()
          .describe('Enable parental control for this client'),
        use_global_blocked_services: z
          .boolean()
          .optional()
          .describe('Use global blocked services list'),
        blocked_services: z
          .array(z.string())
          .optional()
          .describe('Per-client blocked service IDs'),
        tags: z
          .array(z.string())
          .optional()
          .describe('Client tags'),
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

        await client.post('clients/add', body);
        return `Client '${args.name as string}' added.`;
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'clients_update',
      description:
        'Update an existing persistent client by name',
      category: 'clients',
      accessTier: 'full',
      inputSchema: {
        name: z.string().describe('Name of the client to update'),
        data: z.object({
          name: z.string().describe('New client display name'),
          ids: z
            .array(z.string())
            .describe('Client identifiers (IPs, CIDRs, MACs, client IDs)'),
          use_global_settings: z.boolean().optional().describe('Use global settings'),
          filtering_enabled: z.boolean().optional().describe('Enable filtering'),
          safebrowsing_enabled: z
            .boolean()
            .optional()
            .describe('Enable safe browsing'),
          parental_enabled: z.boolean().optional().describe('Enable parental control'),
          use_global_blocked_services: z
            .boolean()
            .optional()
            .describe('Use global blocked services'),
          blocked_services: z
            .array(z.string())
            .optional()
            .describe('Per-client blocked service IDs'),
          tags: z.array(z.string()).optional().describe('Client tags'),
        }).describe('New client data (name and ids required)'),
      },
      handler: async (args) => {
        const name = args.name as string;
        await client.post('clients/update', { name, data: args.data });
        return `Client '${name}' updated.`;
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'clients_delete',
      description:
        'Delete a persistent client by name',
      category: 'clients',
      accessTier: 'full',
      inputSchema: {
        name: z.string().describe('Name of the client to delete'),
      },
      handler: async (args) => {
        const name = args.name as string;
        await client.post('clients/delete', { name });
        return `Client '${name}' deleted.`;
      },
    },
    config,
  );
}
