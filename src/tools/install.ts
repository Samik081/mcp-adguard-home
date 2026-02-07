/**
 * Install tools: network interface details for initial setup.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface InterfaceInfo {
  name: string;
  mtu: number;
  hardware_address: string;
  ip_addresses: string[];
  flags: string;
}

interface AddressesResponse {
  interfaces: Record<string, InterfaceInfo>;
  web_port: number;
  dns_port: number;
}

// --- Formatters ---

function formatAddresses(data: AddressesResponse): string {
  const lines: string[] = [
    'Install Addresses',
    `  Web port: ${data.web_port}`,
    `  DNS port: ${data.dns_port}`,
  ];

  const interfaces = data.interfaces || {};
  const ifaceEntries = Object.entries(interfaces);

  lines.push('');
  lines.push(`Network Interfaces (${ifaceEntries.length})`);
  if (ifaceEntries.length === 0) {
    lines.push('  No interfaces found.');
  } else {
    for (const [name, iface] of ifaceEntries) {
      lines.push(`  ${name}`);
      if (iface.mtu) {
        lines.push(`    MTU: ${iface.mtu}`);
      }
      if (iface.hardware_address) {
        lines.push(`    Hardware address: ${iface.hardware_address}`);
      }
      if (iface.ip_addresses?.length) {
        lines.push(`    IP addresses: ${iface.ip_addresses.join(', ')}`);
      }
      if (iface.flags) {
        lines.push(`    Flags: ${iface.flags}`);
      }
    }
  }

  return lines.join('\n');
}

// --- Registration ---

export function registerInstallTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'install_get_addresses',
      description:
        'Retrieve network interface details and ports for initial setup',
      category: 'install',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get(
          'install/get_addresses',
        )) as AddressesResponse;
        return formatAddresses(data);
      },
    },
    config,
  );

  // --- Write tools ---

  const installConfigSchema = {
    web: z.object({
      ip: z.string().describe('Web interface bind IP address'),
      port: z.number().describe('Web interface port'),
    }).describe('Web interface configuration'),
    dns: z.object({
      ip: z.string().describe('DNS server bind IP address'),
      port: z.number().describe('DNS server port'),
    }).describe('DNS server configuration'),
    username: z.string().describe('Admin username'),
    password: z.string().describe('Admin password'),
  };

  registerTool(
    server,
    {
      name: 'install_check_config',
      description:
        'Validate install configuration without applying (checks web/DNS binding, credentials)',
      category: 'install',
      accessTier: 'full',
      inputSchema: installConfigSchema,
      handler: async (args) => {
        const body = {
          web: args.web,
          dns: args.dns,
          username: args.username,
          password: args.password,
        };
        const result = (await client.post('install/check_config', body)) as Record<string, unknown>;
        const web = result.web as Record<string, unknown> | undefined;
        const dns = result.dns as Record<string, unknown> | undefined;

        const webStatus = web?.status ?? 'unknown';
        const dnsStatus = dns?.status ?? 'unknown';
        const webPort = (args.web as Record<string, unknown>).port;
        const dnsPort = (args.dns as Record<string, unknown>).port;
        const webIp = (args.web as Record<string, unknown>).ip;
        const dnsIp = (args.dns as Record<string, unknown>).ip;

        return `Install config validation: web ${webIp as string}:${webPort as number} ${webStatus as string}, dns ${dnsIp as string}:${dnsPort as number} ${dnsStatus as string}.`;
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'install_apply_config',
      description:
        'Apply initial setup configuration (web/DNS binding and admin credentials)',
      category: 'install',
      accessTier: 'full',
      inputSchema: installConfigSchema,
      handler: async (args) => {
        const body = {
          web: args.web,
          dns: args.dns,
          username: args.username,
          password: args.password,
        };
        await client.post('install/configure', body);
        return 'Install configuration applied.';
      },
    },
    config,
  );
}
