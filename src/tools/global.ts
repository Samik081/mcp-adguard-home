/**
 * Global tools: server status, user profile, version check.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface StatusResponse {
  version: string;
  language: string;
  dns_addresses: string[];
  dns_port: number;
  http_port: number;
  protection_enabled: boolean;
  protection_disabled_duration: number;
  running: boolean;
}

interface ProfileResponse {
  name: string;
  language: string;
  theme: string;
}

interface VersionResponse {
  new_version: string;
  announcement: string;
  announcement_url: string;
  can_autoupdate: boolean;
}

// --- Formatters ---

function formatStatus(data: StatusResponse): string {
  const lines: string[] = [
    'Server Status',
    `  Version: ${data.version}`,
    `  Running: ${data.running ? 'yes' : 'no'}`,
    `  Protection: ${data.protection_enabled ? 'enabled' : 'disabled'}`,
    `  DNS addresses: ${data.dns_addresses.length ? data.dns_addresses.join(', ') : 'none'}`,
    `  DNS port: ${data.dns_port}`,
    `  HTTP port: ${data.http_port}`,
    `  Language: ${data.language}`,
  ];
  return lines.join('\n');
}

function formatProfile(data: ProfileResponse): string {
  const lines: string[] = [
    'User Profile',
    `  Name: ${data.name || '(not set)'}`,
    `  Language: ${data.language}`,
    `  Theme: ${data.theme}`,
  ];
  return lines.join('\n');
}

function formatVersion(data: VersionResponse, currentVersion: string): string {
  const hasUpdate =
    data.new_version !== '' && data.new_version !== currentVersion;

  if (!hasUpdate) {
    return `Version: ${currentVersion} (up to date)`;
  }

  const lines: string[] = [
    `Current version: ${currentVersion}`,
    `New version: ${data.new_version}`,
    `Auto-update: ${data.can_autoupdate ? 'available' : 'not available'}`,
  ];
  if (data.announcement) {
    lines.push(`Announcement: ${data.announcement}`);
  }
  if (data.announcement_url) {
    lines.push(`Details: ${data.announcement_url}`);
  }
  return lines.join('\n');
}

// --- Registration ---

export function registerGlobalTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'global_get_status',
      description:
        'Retrieve AdGuard Home server status including version, DNS addresses, protection state, and ports',
      category: 'global',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('status')) as StatusResponse;
        return formatStatus(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'global_get_profile',
      description: 'Retrieve user profile (name, language, theme)',
      category: 'global',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('profile')) as ProfileResponse;
        return formatProfile(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'global_check_version',
      description:
        'Check for AdGuard Home updates and compare with current version',
      category: 'global',
      accessTier: 'read-only',
      inputSchema: {
        recheck_now: z.boolean().optional(),
      },
      handler: async (args) => {
        const recheck = (args.recheck_now as boolean) ?? false;
        const versionData = (await client.post('version.json', {
          recheck_now: recheck,
        })) as VersionResponse;

        // Get current version from status to compare
        const status = (await client.get('status')) as StatusResponse;
        return formatVersion(versionData, status.version);
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'global_set_protection',
      description:
        'Enable or disable DNS protection globally, with optional duration for temporary disable',
      category: 'global',
      accessTier: 'full',
      inputSchema: {
        enabled: z.boolean().describe('Whether DNS protection should be enabled'),
        duration: z
          .number()
          .optional()
          .describe(
            'Duration in seconds to disable protection (0 = permanent). Only used when enabled is false.',
          ),
      },
      handler: async (args) => {
        const body: Record<string, unknown> = {
          protection_enabled: args.enabled as boolean,
        };
        if (args.duration !== undefined) {
          body.protection_disabled_duration = args.duration as number;
        }
        await client.post('dns_config', body);
        const enabled = args.enabled as boolean;
        if (enabled) {
          return 'DNS protection enabled.';
        }
        const duration = args.duration as number | undefined;
        if (duration && duration > 0) {
          return `DNS protection disabled for ${duration} seconds.`;
        }
        return 'DNS protection disabled.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'global_update_profile',
      description:
        'Update user profile settings (name, language, theme). All fields are optional -- only provided fields are updated.',
      category: 'global',
      accessTier: 'full',
      inputSchema: {
        name: z.string().optional().describe('Display name'),
        language: z.string().optional().describe('Language code (e.g. "en")'),
        theme: z
          .string()
          .optional()
          .describe('UI theme (e.g. "auto", "light", "dark")'),
      },
      handler: async (args) => {
        const body: Record<string, unknown> = {};
        if (args.name !== undefined) body.name = args.name;
        if (args.language !== undefined) body.language = args.language;
        if (args.theme !== undefined) body.theme = args.theme;
        await client.post('profile/update', body);
        return 'Profile updated.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'global_begin_update',
      description:
        'Initiate an AdGuard Home software update. The server may restart after this operation.',
      category: 'global',
      accessTier: 'full',
      inputSchema: {},
      handler: async () => {
        await client.post('update');
        return 'Update initiated.';
      },
    },
    config,
  );
}
