/**
 * Filtering tools: filter lists, user rules, and host checking.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface FilterEntry {
  enabled: boolean;
  id: number;
  last_updated: string;
  name: string;
  rules_count: number;
  url: string;
}

interface FilteringStatus {
  enabled: boolean;
  interval: number;
  filters: FilterEntry[];
  whitelist_filters: FilterEntry[];
  user_rules: string[];
}

interface CheckHostRule {
  text: string;
  filter_list_id: number;
}

interface CheckHostResponse {
  reason: string;
  rules: CheckHostRule[];
  service_name?: string;
  cname?: string;
  ip_addrs?: string[];
}

// --- Formatters ---

function formatFilterList(filters: FilterEntry[], label: string): string[] {
  const lines: string[] = [];
  if (!filters || filters.length === 0) {
    lines.push(`${label} (0)`);
    lines.push('  No filters configured.');
    return lines;
  }

  lines.push(`${label} (${filters.length})`);
  for (const f of filters) {
    const status = f.enabled ? 'enabled' : 'disabled';
    const updated = f.last_updated
      ? f.last_updated.replace('T', ' ').substring(0, 19)
      : 'never updated';
    lines.push(
      `  [${status}] ${f.name} -- ${f.rules_count} rules -- ${updated}`,
    );
  }
  return lines;
}

function formatFilteringStatus(data: FilteringStatus): string {
  const lines: string[] = [
    'Filtering Status',
    `  Global filtering: ${data.enabled ? 'enabled' : 'disabled'}`,
    `  Update interval: ${data.interval}h`,
    '',
  ];

  lines.push(...formatFilterList(data.filters, 'Blocklists'));
  lines.push('');
  lines.push(...formatFilterList(data.whitelist_filters, 'Allowlists'));

  // User rules
  lines.push('');
  const rules = data.user_rules || [];
  // Filter out empty strings that can appear in the rules array
  const nonEmpty = rules.filter((r) => r.trim() !== '');
  if (nonEmpty.length === 0) {
    lines.push('User Rules (0)');
    lines.push('  No user rules configured.');
  } else {
    lines.push(`User Rules (${nonEmpty.length})`);
    const show = nonEmpty.slice(0, 10);
    for (const rule of show) {
      lines.push(`  ${rule}`);
    }
    if (nonEmpty.length > 10) {
      lines.push(`  ... (${nonEmpty.length - 10} more)`);
    }
  }

  return lines.join('\n');
}

function formatCheckHost(data: CheckHostResponse): string {
  const lines: string[] = [`Result: ${data.reason}`];

  if (data.rules?.length) {
    for (const rule of data.rules) {
      lines.push(`  Rule: ${rule.text} (filter #${rule.filter_list_id})`);
    }
  }

  if (data.service_name) lines.push(`Service: ${data.service_name}`);
  if (data.cname) lines.push(`CNAME: ${data.cname}`);
  if (data.ip_addrs?.length) lines.push(`IPs: ${data.ip_addrs.join(', ')}`);

  return lines.join('\n');
}

// --- Registration ---

export function registerFilteringTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'filtering_get_status',
      description:
        'Retrieve filtering configuration including blocklists, allowlists, user rules, and global enabled state',
      category: 'filtering',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get(
          'filtering/status',
        )) as FilteringStatus;
        return formatFilteringStatus(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'filtering_check_host',
      description:
        'Test whether a hostname would be blocked by current filtering rules',
      category: 'filtering',
      accessTier: 'read-only',
      inputSchema: {
        name: z.string(),
        client: z.string().optional(),
        qtype: z.string().optional(),
      },
      handler: async (args) => {
        const params = new URLSearchParams({ name: args.name as string });
        if (args.client) params.set('client', args.client as string);
        if (args.qtype) params.set('qtype', args.qtype as string);

        const data = (await client.get(
          `filtering/check_host?${params}`,
        )) as CheckHostResponse;
        return formatCheckHost(data);
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'filtering_set_config',
      description:
        'Update global filtering configuration (enabled state and update interval). Both fields are required -- this is a full replacement.',
      category: 'filtering',
      accessTier: 'full',
      inputSchema: {
        enabled: z.boolean().describe('Whether filtering is globally enabled'),
        interval: z.number().describe('Filter update interval in hours'),
      },
      handler: async (args) => {
        await client.post('filtering/config', {
          enabled: args.enabled,
          interval: args.interval,
        });
        return 'Filtering configuration updated.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'filtering_add_url',
      description:
        'Add a new filter URL (blocklist or allowlist)',
      category: 'filtering',
      accessTier: 'full',
      inputSchema: {
        name: z.string().describe('Display name for the filter'),
        url: z.string().describe('URL of the filter list'),
        whitelist: z
          .boolean()
          .optional()
          .describe('If true, add as allowlist; if false (default), add as blocklist'),
      },
      handler: async (args) => {
        await client.post('filtering/add_url', {
          name: args.name,
          url: args.url,
          whitelist: (args.whitelist as boolean) ?? false,
        });
        return `Filter '${args.name as string}' added.`;
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'filtering_remove_url',
      description: 'Remove a filter URL from blocklist or allowlist',
      category: 'filtering',
      accessTier: 'full',
      inputSchema: {
        url: z.string().describe('URL of the filter to remove'),
        whitelist: z
          .boolean()
          .describe('Whether the filter is in the allowlist (true) or blocklist (false)'),
      },
      handler: async (args) => {
        await client.post('filtering/remove_url', {
          url: args.url,
          whitelist: args.whitelist,
        });
        return 'Filter removed.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'filtering_set_url',
      description:
        'Update an existing filter URL (rename, change URL, or enable/disable)',
      category: 'filtering',
      accessTier: 'full',
      inputSchema: {
        url: z.string().describe('Current URL of the filter to update'),
        whitelist: z
          .boolean()
          .describe('Whether the filter is in the allowlist (true) or blocklist (false)'),
        data: z.object({
          name: z.string().describe('New display name'),
          url: z.string().describe('New URL'),
          enabled: z.boolean().describe('Whether the filter should be enabled'),
        }).describe('New filter data'),
      },
      handler: async (args) => {
        await client.post('filtering/set_url', {
          url: args.url,
          whitelist: args.whitelist,
          data: args.data,
        });
        return 'Filter updated.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'filtering_refresh',
      description: 'Force refresh of filter lists to fetch latest updates',
      category: 'filtering',
      accessTier: 'full',
      inputSchema: {
        whitelist: z
          .boolean()
          .optional()
          .describe('If true, refresh allowlists; if false (default), refresh blocklists'),
      },
      handler: async (args) => {
        const response = (await client.post('filtering/refresh', {
          whitelist: (args.whitelist as boolean) ?? false,
        })) as { updated: number } | string;
        if (typeof response === 'object' && response !== null && 'updated' in response) {
          return `Filters refreshed. Updated: ${response.updated}`;
        }
        return 'Filters refreshed.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'filtering_set_rules',
      description: 'Set custom filtering rules (replaces all existing custom rules)',
      category: 'filtering',
      accessTier: 'full',
      inputSchema: {
        rules: z
          .array(z.string())
          .describe('Array of custom filtering rules'),
      },
      handler: async (args) => {
        const rules = args.rules as string[];
        await client.post('filtering/set_rules', { rules });
        return `Custom rules updated (${rules.length} rules).`;
      },
    },
    config,
  );
}
