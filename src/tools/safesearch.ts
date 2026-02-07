/**
 * Safe search tools: per-engine safe search enforcement status and settings.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface SafeSearchStatus {
  enabled: boolean;
  [engine: string]: boolean;
}

// --- Formatters ---

const KNOWN_ENGINES = [
  'bing',
  'duckduckgo',
  'google',
  'pixabay',
  'yandex',
  'youtube',
];

function formatSafeSearch(data: SafeSearchStatus): string {
  const lines: string[] = [
    `Safe Search: ${data.enabled ? 'enabled' : 'disabled'}`,
  ];

  for (const engine of KNOWN_ENGINES) {
    if (engine in data) {
      lines.push(
        `  ${engine}: ${(data as Record<string, boolean>)[engine] ? 'on' : 'off'}`,
      );
    }
  }

  // Include any unknown engines not in the known list
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'enabled' && !KNOWN_ENGINES.includes(key)) {
      lines.push(`  ${key}: ${value ? 'on' : 'off'}`);
    }
  }

  return lines.join('\n');
}

// --- Registration ---

export function registerSafesearchTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'safesearch_get_status',
      description:
        'Retrieve safe search settings showing per-engine enforcement status',
      category: 'safesearch',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get(
          'safesearch/status',
        )) as SafeSearchStatus;
        return formatSafeSearch(data);
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'safesearch_set_settings',
      description:
        'Update safe search settings. Set global enabled state and optionally configure per-engine enforcement.',
      category: 'safesearch',
      accessTier: 'full',
      inputSchema: {
        enabled: z.boolean().describe('Whether safe search is globally enabled'),
        bing: z.boolean().optional().describe('Enforce safe search on Bing'),
        duckduckgo: z.boolean().optional().describe('Enforce safe search on DuckDuckGo'),
        google: z.boolean().optional().describe('Enforce safe search on Google'),
        pixabay: z.boolean().optional().describe('Enforce safe search on Pixabay'),
        yandex: z.boolean().optional().describe('Enforce safe search on Yandex'),
        youtube: z.boolean().optional().describe('Enforce safe search on YouTube'),
      },
      handler: async (args) => {
        const body: Record<string, unknown> = {
          enabled: args.enabled,
        };
        for (const engine of KNOWN_ENGINES) {
          if (args[engine] !== undefined) {
            body[engine] = args[engine];
          }
        }
        await client.post('safesearch/settings', body);
        return 'Safe search settings updated.';
      },
    },
    config,
  );
}
