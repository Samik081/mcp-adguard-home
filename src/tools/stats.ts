/**
 * Statistics tools: DNS query statistics and configuration.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface StatsResponse {
  time_units: string;
  num_dns_queries: number;
  num_blocked_filtering: number;
  num_replaced_safebrowsing: number;
  num_replaced_parental: number;
  num_replaced_safesearch: number;
  avg_processing_time: number;
  top_queried_domains: Array<Record<string, number>>;
  top_blocked_domains: Array<Record<string, number>>;
  top_clients: Array<Record<string, number>>;
  dns_queries: number[];
  blocked_filtering: number[];
  replaced_safebrowsing: number[];
  replaced_parental: number[];
}

interface StatsConfig {
  interval: number;
  enabled: boolean;
  ignored: string[];
}

// --- Formatters ---

function formatTopList(
  items: Array<Record<string, number>>,
  label: string,
): string[] {
  if (!items || items.length === 0) {
    return [`  ${label}: none`];
  }

  const lines: string[] = [`  ${label}:`];
  for (const item of items) {
    for (const [name, count] of Object.entries(item)) {
      lines.push(`    ${name}: ${count}`);
    }
  }
  return lines;
}

function formatStats(data: StatsResponse): string {
  const lines: string[] = [
    'DNS Statistics',
    `  Time units: ${data.time_units}`,
    `  Total queries: ${data.num_dns_queries}`,
    `  Blocked by filters: ${data.num_blocked_filtering}`,
    `  Replaced (safe browsing): ${data.num_replaced_safebrowsing}`,
    `  Replaced (parental): ${data.num_replaced_parental}`,
    `  Replaced (safe search): ${data.num_replaced_safesearch}`,
    `  Avg processing time: ${(data.avg_processing_time * 1000).toFixed(1)}ms`,
  ];

  lines.push(...formatTopList(data.top_queried_domains, 'Top queried domains'));
  lines.push(...formatTopList(data.top_blocked_domains, 'Top blocked domains'));
  lines.push(...formatTopList(data.top_clients, 'Top clients'));

  return lines.join('\n');
}

function formatStatsConfig(data: StatsConfig): string {
  const lines: string[] = [
    'Statistics Configuration',
    `  Enabled: ${data.enabled ? 'yes' : 'no'}`,
    `  Interval: ${data.interval}ms`,
    `  Ignored domains: ${data.ignored?.length ? data.ignored.join(', ') : 'none'}`,
  ];
  return lines.join('\n');
}

// --- Registration ---

export function registerStatsTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'stats_get',
      description:
        'Retrieve DNS statistics including top domains, blocked counts, and client activity. Optional recent param is milliseconds (must be hourly multiple of 3600000).',
      category: 'stats',
      accessTier: 'read-only',
      inputSchema: {
        recent: z.number().optional(),
      },
      handler: async (args) => {
        let path = 'stats';
        if (args.recent !== undefined) {
          const params = new URLSearchParams();
          params.set('recent', String(args.recent));
          path = `stats?${params}`;
        }
        const data = (await client.get(path)) as StatsResponse;
        return formatStats(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'stats_get_config',
      description: 'Retrieve statistics configuration settings',
      category: 'stats',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('stats/config')) as StatsConfig;
        return formatStatsConfig(data);
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'stats_reset',
      description:
        'Reset all DNS statistics. This is a destructive operation that cannot be undone.',
      category: 'stats',
      accessTier: 'full',
      inputSchema: {
        confirm: z
          .boolean()
          .optional()
          .describe('Set to true to confirm destructive operation'),
      },
      handler: async (args) => {
        if (config.confirmDestructive && !args.confirm) {
          return 'This is a destructive operation that cannot be undone. Set confirm: true to proceed.';
        }
        await client.post('stats_reset');
        return 'Statistics reset.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'stats_set_config',
      description:
        'Update statistics configuration. All fields are optional -- only provided fields are changed.',
      category: 'stats',
      accessTier: 'full',
      inputSchema: {
        enabled: z.boolean().optional().describe('Enable/disable statistics collection'),
        interval: z
          .number()
          .optional()
          .describe('Statistics retention interval in milliseconds'),
        ignored: z
          .array(z.string())
          .optional()
          .describe('List of domains to ignore in statistics'),
      },
      handler: async (args) => {
        const body: Record<string, unknown> = {};
        if (args.enabled !== undefined) body.enabled = args.enabled;
        if (args.interval !== undefined) body.interval = args.interval;
        if (args.ignored !== undefined) body.ignored = args.ignored;
        await client.post('stats/config/update', body);
        return 'Statistics configuration updated.';
      },
    },
    config,
  );
}
