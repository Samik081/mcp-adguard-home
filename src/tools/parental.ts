/**
 * Parental filtering tools: parental control status and toggle.
 *
 * PITFALL: The API response uses field 'enable' (not 'enabled').
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Registration ---

export function registerParentalTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'parental_get_status',
      description: 'Retrieve parental filtering status',
      category: 'parental',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        // CRITICAL: API returns { enable: boolean } not { enabled: boolean }
        const data = (await client.get('parental/status')) as {
          enable: boolean;
        };
        return `Parental Filtering: ${data.enable ? 'enabled' : 'disabled'}`;
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'parental_set',
      description: 'Enable or disable parental filtering (content restrictions)',
      category: 'parental',
      accessTier: 'full',
      inputSchema: {
        enabled: z.boolean().describe('Whether parental filtering should be enabled'),
      },
      handler: async (args) => {
        const enabled = args.enabled as boolean;
        const endpoint = enabled
          ? 'parental/enable'
          : 'parental/disable';
        await client.post(endpoint);
        return enabled
          ? 'Parental filtering enabled.'
          : 'Parental filtering disabled.';
      },
    },
    config,
  );
}
