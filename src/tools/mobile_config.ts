/**
 * Mobile config tools: Apple .mobileconfig profile generation for DoH/DoT.
 *
 * These endpoints return raw XML plist data, not JSON.
 * Uses client.getRaw() instead of client.get().
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Registration ---

export function registerMobileConfigTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'mobile_config_get_doh',
      description:
        'Generate Apple .mobileconfig profile for DNS-over-HTTPS. Returns raw XML plist.',
      category: 'mobile_config',
      accessTier: 'read-only',
      inputSchema: {
        host: z.string().describe('Server hostname for DoH'),
        client_id: z
          .string()
          .optional()
          .describe('Client identifier'),
      },
      handler: async (args) => {
        const params = new URLSearchParams();
        params.set('host', args.host as string);
        if (args.client_id) {
          params.set('client_id', args.client_id as string);
        }
        return await client.getRaw(
          `apple/doh.mobileconfig?${params.toString()}`,
        );
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'mobile_config_get_dot',
      description:
        'Generate Apple .mobileconfig profile for DNS-over-TLS. Returns raw XML plist.',
      category: 'mobile_config',
      accessTier: 'read-only',
      inputSchema: {
        host: z.string().describe('Server hostname for DoT'),
        client_id: z
          .string()
          .optional()
          .describe('Client identifier'),
      },
      handler: async (args) => {
        const params = new URLSearchParams();
        params.set('host', args.host as string);
        if (args.client_id) {
          params.set('client_id', args.client_id as string);
        }
        return await client.getRaw(
          `apple/dot.mobileconfig?${params.toString()}`,
        );
      },
    },
    config,
  );
}
