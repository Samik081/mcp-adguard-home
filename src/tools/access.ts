/**
 * Access control tools: allowed/disallowed clients and blocked hosts.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface AccessList {
  allowed_clients: string[];
  disallowed_clients: string[];
  blocked_hosts: string[];
}

// --- Formatters ---

function formatAccessList(data: AccessList): string {
  const sections: string[] = [];

  const allowed = data.allowed_clients || [];
  sections.push(`Allowed Clients${allowed.length ? ` (${allowed.length})` : ': none'}`);
  for (const c of allowed) {
    sections.push(`  ${c}`);
  }

  sections.push('');
  const disallowed = data.disallowed_clients || [];
  sections.push(`Disallowed Clients${disallowed.length ? ` (${disallowed.length})` : ': none'}`);
  for (const c of disallowed) {
    sections.push(`  ${c}`);
  }

  sections.push('');
  const blocked = data.blocked_hosts || [];
  sections.push(`Blocked Hosts${blocked.length ? ` (${blocked.length})` : ': none'}`);
  for (const h of blocked) {
    sections.push(`  ${h}`);
  }

  return sections.join('\n');
}

// --- Registration ---

export function registerAccessTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'access_get_list',
      description:
        'Retrieve access control lists: allowed clients, disallowed clients, and blocked hosts',
      category: 'access',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('access/list')) as AccessList;
        return formatAccessList(data);
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'access_set_list',
      description:
        'Set access control lists for allowed clients, disallowed clients, and blocked hosts',
      category: 'access',
      accessTier: 'full',
      inputSchema: {
        allowed_clients: z
          .array(z.string())
          .describe('Allowed client IPs/CIDRs/MACs (empty array to clear)'),
        disallowed_clients: z
          .array(z.string())
          .describe('Disallowed client IPs/CIDRs/MACs (empty array to clear)'),
        blocked_hosts: z
          .array(z.string())
          .describe('Blocked hostnames (empty array to clear)'),
      },
      handler: async (args) => {
        await client.post('access/set', {
          allowed_clients: args.allowed_clients,
          disallowed_clients: args.disallowed_clients,
          blocked_hosts: args.blocked_hosts,
        });
        return 'Access control lists updated.';
      },
    },
    config,
  );
}
