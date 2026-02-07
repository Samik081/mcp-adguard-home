/**
 * Query log tools: DNS query history and configuration.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface QueryLogEntry {
  time: string;
  question: {
    name: string;
    type: string;
  };
  client: string;
  client_info?: {
    name?: string;
  };
  answer?: Array<{
    type: string;
    value: string;
    ttl: number;
  }>;
  status: string;
  elapsed_ms: string;
  reason: string;
  rule?: string;
  filterId?: number;
  rules?: Array<{ text: string; filter_list_id: number }>;
}

interface QueryLogResponse {
  data: QueryLogEntry[];
  oldest: string;
}

interface QueryLogConfig {
  enabled: boolean;
  interval: number;
  anonymize_client_ip: boolean;
}

// --- Formatters ---

function formatQueryLog(data: QueryLogResponse): string {
  const entries = data.data || [];
  if (entries.length === 0) {
    return 'No query log entries.';
  }

  const lines: string[] = [`Query Log (${entries.length} entries)`];

  for (const entry of entries) {
    const ts = entry.time ? entry.time.replace('T', ' ').substring(0, 19) : '?';
    const domain = entry.question?.name || '?';
    const qtype = entry.question?.type || '?';
    const clientIp = entry.client || '?';
    const rcode = entry.status || '?';
    const elapsed = entry.elapsed_ms || '?';
    const reason = entry.reason || 'NotFiltered';

    let filterInfo = reason;
    if (entry.rules?.length) {
      const ruleText = entry.rules[0].text;
      filterInfo = `${reason} (rule: ${ruleText})`;
    }

    lines.push(
      `  ${ts} | ${domain} ${qtype} | ${clientIp} | ${rcode} | ${elapsed}ms | ${filterInfo}`,
    );
  }

  if (data.oldest) {
    lines.push('');
    lines.push(`Oldest entry: ${data.oldest}`);
  }

  return lines.join('\n');
}

function formatQueryLogConfig(data: QueryLogConfig): string {
  const lines: string[] = [
    'Query Log Configuration',
    `  Enabled: ${data.enabled ? 'yes' : 'no'}`,
    `  Interval: ${data.interval}h`,
    `  Anonymize client IP: ${data.anonymize_client_ip ? 'yes' : 'no'}`,
  ];
  return lines.join('\n');
}

// --- Registration ---

export function registerQuerylogTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'querylog_get',
      description:
        'Search DNS query log with optional filtering by response status, search term, and pagination',
      category: 'querylog',
      accessTier: 'read-only',
      inputSchema: {
        older_than: z.string().optional(),
        offset: z.number().optional(),
        limit: z.number().optional(),
        search: z.string().optional(),
        response_status: z
          .enum([
            'all',
            'filtered',
            'blocked',
            'blocked_safebrowsing',
            'blocked_parental',
            'whitelisted',
            'rewritten',
            'safe_search',
            'processed',
          ])
          .optional(),
      },
      handler: async (args) => {
        const params = new URLSearchParams();
        if (args.older_than)
          params.set('older_than', args.older_than as string);
        if (args.offset !== undefined)
          params.set('offset', String(args.offset));
        if (args.limit !== undefined) params.set('limit', String(args.limit));
        if (args.search) params.set('search', args.search as string);
        if (args.response_status)
          params.set('response_status', args.response_status as string);

        const query = params.toString();
        const path = query ? `querylog?${query}` : 'querylog';
        const data = (await client.get(path)) as QueryLogResponse;
        return formatQueryLog(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'querylog_get_config',
      description: 'Retrieve query log configuration settings',
      category: 'querylog',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('querylog/config')) as QueryLogConfig;
        return formatQueryLogConfig(data);
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'querylog_set_config',
      description:
        'Update query log configuration. All fields are optional -- only provided fields are changed.',
      category: 'querylog',
      accessTier: 'full',
      inputSchema: {
        enabled: z.boolean().optional().describe('Enable/disable query logging'),
        interval: z
          .number()
          .optional()
          .describe('Query log retention interval in milliseconds'),
        anonymize_client_ip: z
          .boolean()
          .optional()
          .describe('Anonymize client IP addresses in the log'),
      },
      handler: async (args) => {
        const body: Record<string, unknown> = {};
        if (args.enabled !== undefined) body.enabled = args.enabled;
        if (args.interval !== undefined) body.interval = args.interval;
        if (args.anonymize_client_ip !== undefined)
          body.anonymize_client_ip = args.anonymize_client_ip;
        await client.post('querylog/config/update', body);
        return 'Query log configuration updated.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'querylog_clear',
      description:
        'Clear the entire DNS query log. This is a destructive operation that cannot be undone.',
      category: 'querylog',
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
        await client.post('querylog_clear');
        return 'Query log cleared.';
      },
    },
    config,
  );
}
