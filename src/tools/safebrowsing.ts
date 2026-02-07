/**
 * Safe browsing tools: malware/phishing protection status and toggle.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Registration ---

export function registerSafebrowsingTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'safebrowsing_get_status',
      description:
        'Retrieve safe browsing (malware/phishing protection) status',
      category: 'safebrowsing',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('safebrowsing/status')) as {
          enabled: boolean;
        };
        return `Safe Browsing: ${data.enabled ? 'enabled' : 'disabled'}`;
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'safebrowsing_set',
      description:
        'Enable or disable safe browsing (malware/phishing protection)',
      category: 'safebrowsing',
      accessTier: 'full',
      inputSchema: {
        enabled: z.boolean().describe('Whether safe browsing should be enabled'),
      },
      handler: async (args) => {
        const enabled = args.enabled as boolean;
        const endpoint = enabled
          ? 'safebrowsing/enable'
          : 'safebrowsing/disable';
        await client.post(endpoint);
        return enabled
          ? 'Safe browsing enabled.'
          : 'Safe browsing disabled.';
      },
    },
    config,
  );
}
