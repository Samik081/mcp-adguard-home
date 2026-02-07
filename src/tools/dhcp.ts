/**
 * DHCP tools: server status, interfaces, and active server discovery.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface DhcpV4Config {
  gateway_ip: string;
  subnet_mask: string;
  range_start: string;
  range_end: string;
  lease_duration: number;
}

interface DhcpV6Config {
  range_start: string;
  lease_duration: number;
}

interface StaticLease {
  mac: string;
  ip: string;
  hostname: string;
}

interface ActiveLease {
  mac: string;
  ip: string;
  hostname: string;
  expires: string;
}

interface DhcpStatus {
  enabled: boolean;
  interface_name: string;
  v4: DhcpV4Config;
  v6: DhcpV6Config;
  static_leases: StaticLease[];
  leases: ActiveLease[];
}

interface NetworkInterface {
  name: string;
  hardware_address: string;
  flags: string;
  gateway_ip: string;
  ipv4_addresses: string[];
  ipv6_addresses: string[];
}

interface DhcpServer {
  interface_name: string;
  v4: { gateway_ip: string; server_ip: string };
  v6: { gateway_ip: string; server_ip: string };
}

interface FindActiveResponse {
  other_server: DhcpServer | null;
  static_ip: { static: string; ip: string } | null;
}

// --- Formatters ---

function formatDhcpStatus(data: DhcpStatus): string {
  const sections: string[] = [];

  sections.push(`DHCP Server: ${data.enabled ? 'enabled' : 'disabled'}`);
  if (data.interface_name) {
    sections.push(`Interface: ${data.interface_name}`);
  }

  sections.push('');
  sections.push('IPv4 Configuration');
  sections.push(`  Range: ${data.v4.range_start} - ${data.v4.range_end}`);
  sections.push(`  Subnet mask: ${data.v4.subnet_mask}`);
  sections.push(`  Gateway: ${data.v4.gateway_ip}`);
  sections.push(`  Lease duration: ${data.v4.lease_duration}s`);

  sections.push('');
  sections.push('IPv6 Configuration');
  sections.push(`  Range start: ${data.v6.range_start || '(not set)'}`);
  sections.push(`  Lease duration: ${data.v6.lease_duration}s`);

  sections.push('');
  const statics = data.static_leases || [];
  sections.push(`Static Leases (${statics.length})`);
  if (statics.length === 0) {
    sections.push('  No static leases configured.');
  } else {
    for (const l of statics) {
      sections.push(`  ${l.mac} -> ${l.ip} (${l.hostname})`);
    }
  }

  sections.push('');
  const actives = data.leases || [];
  sections.push(`Active Leases (${actives.length})`);
  if (actives.length === 0) {
    sections.push('  No active leases.');
  } else {
    for (const l of actives) {
      sections.push(`  ${l.mac} -> ${l.ip} (${l.hostname}) expires ${l.expires}`);
    }
  }

  return sections.join('\n');
}

function formatInterfaces(data: NetworkInterface[]): string {
  if (data.length === 0) {
    return 'No network interfaces found.';
  }

  const sections: string[] = [`Network Interfaces (${data.length})`];
  for (const iface of data) {
    sections.push(`  ${iface.name}`);
    sections.push(`    Hardware address: ${iface.hardware_address}`);
    sections.push(`    Flags: ${iface.flags}`);
    if (iface.gateway_ip) {
      sections.push(`    Gateway: ${iface.gateway_ip}`);
    }
    if (iface.ipv4_addresses?.length) {
      sections.push(`    IPv4: ${iface.ipv4_addresses.join(', ')}`);
    }
    if (iface.ipv6_addresses?.length) {
      sections.push(`    IPv6: ${iface.ipv6_addresses.join(', ')}`);
    }
  }
  return sections.join('\n');
}

function formatFindActive(data: FindActiveResponse): string {
  if (!data.other_server) {
    return 'No competing DHCP servers found on this interface.';
  }

  const srv = data.other_server;
  const lines: string[] = ['Competing DHCP server detected'];
  if (srv.interface_name) {
    lines.push(`  Interface: ${srv.interface_name}`);
  }
  if (srv.v4?.gateway_ip) {
    lines.push(`  IPv4 gateway: ${srv.v4.gateway_ip}`);
  }
  if (srv.v4?.server_ip) {
    lines.push(`  IPv4 server: ${srv.v4.server_ip}`);
  }
  if (srv.v6?.gateway_ip) {
    lines.push(`  IPv6 gateway: ${srv.v6.gateway_ip}`);
  }
  if (srv.v6?.server_ip) {
    lines.push(`  IPv6 server: ${srv.v6.server_ip}`);
  }
  return lines.join('\n');
}

// --- Registration ---

export function registerDhcpTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'dhcp_get_status',
      description:
        'Retrieve DHCP server configuration, static leases, and active leases',
      category: 'dhcp',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('dhcp/status')) as DhcpStatus;
        return formatDhcpStatus(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'dhcp_get_interfaces',
      description:
        'Retrieve available network interfaces for DHCP server binding',
      category: 'dhcp',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get(
          'dhcp/interfaces',
        )) as NetworkInterface[];
        return formatInterfaces(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'dhcp_find_active',
      description:
        'Scan for competing DHCP servers on a network interface (may take several seconds)',
      category: 'dhcp',
      accessTier: 'read-only',
      inputSchema: {
        interface: z.string().describe('Network interface name to scan'),
      },
      handler: async (args) => {
        const iface = args.interface as string;
        const data = (await client.post('dhcp/find_active_dhcp', {
          interface: iface,
        })) as FindActiveResponse;
        return formatFindActive(data);
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'dhcp_set_config',
      description:
        'Update DHCP server configuration (enabled state, interface, IPv4/IPv6 settings)',
      category: 'dhcp',
      accessTier: 'full',
      inputSchema: {
        enabled: z.boolean().optional().describe('Enable or disable DHCP server'),
        interface_name: z
          .string()
          .optional()
          .describe('Network interface to bind DHCP server to'),
        v4: z
          .object({
            gateway_ip: z.string().optional().describe('Gateway IP address'),
            subnet_mask: z.string().optional().describe('Subnet mask'),
            range_start: z.string().optional().describe('DHCP range start IP'),
            range_end: z.string().optional().describe('DHCP range end IP'),
            lease_duration: z
              .number()
              .optional()
              .describe('Lease duration in seconds'),
          })
          .optional()
          .describe('IPv4 DHCP configuration'),
        v6: z
          .object({
            range_start: z.string().optional().describe('IPv6 range start address'),
            lease_duration: z
              .number()
              .optional()
              .describe('Lease duration in seconds'),
          })
          .optional()
          .describe('IPv6 DHCP configuration'),
      },
      handler: async (args) => {
        const body: Record<string, unknown> = {};
        if (args.enabled !== undefined) body.enabled = args.enabled;
        if (args.interface_name !== undefined)
          body.interface_name = args.interface_name;
        if (args.v4 !== undefined) body.v4 = args.v4;
        if (args.v6 !== undefined) body.v6 = args.v6;

        await client.post('dhcp/set_config', body);
        return 'DHCP configuration updated.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'dhcp_add_static_lease',
      description: 'Add a static DHCP lease mapping a MAC address to an IP',
      category: 'dhcp',
      accessTier: 'full',
      inputSchema: {
        mac: z.string().describe('MAC address'),
        ip: z.string().describe('IP address to assign'),
        hostname: z.string().describe('Hostname for the lease'),
      },
      handler: async (args) => {
        const mac = args.mac as string;
        const ip = args.ip as string;
        const hostname = args.hostname as string;
        await client.post('dhcp/add_static_lease', { mac, ip, hostname });
        return `Static lease added: ${mac} -> ${ip} (${hostname}).`;
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'dhcp_remove_static_lease',
      description:
        'Remove a static DHCP lease (all three fields must match the existing lease)',
      category: 'dhcp',
      accessTier: 'full',
      inputSchema: {
        mac: z.string().describe('MAC address of the lease to remove'),
        ip: z.string().describe('IP address of the lease to remove'),
        hostname: z.string().describe('Hostname of the lease to remove'),
      },
      handler: async (args) => {
        const mac = args.mac as string;
        const ip = args.ip as string;
        const hostname = args.hostname as string;
        await client.post('dhcp/remove_static_lease', { mac, ip, hostname });
        return 'Static lease removed.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'dhcp_update_static_lease',
      description:
        'Update a static DHCP lease (removes existing lease and adds a new one)',
      category: 'dhcp',
      accessTier: 'full',
      inputSchema: {
        mac: z.string().describe('Current MAC address of the lease'),
        ip: z.string().describe('Current IP address of the lease'),
        hostname: z.string().describe('Current hostname of the lease'),
        new_mac: z
          .string()
          .optional()
          .describe('New MAC address (defaults to current)'),
        new_ip: z
          .string()
          .optional()
          .describe('New IP address (defaults to current)'),
        new_hostname: z
          .string()
          .optional()
          .describe('New hostname (defaults to current)'),
      },
      handler: async (args) => {
        const mac = args.mac as string;
        const ip = args.ip as string;
        const hostname = args.hostname as string;
        const newMac = (args.new_mac as string) || mac;
        const newIp = (args.new_ip as string) || ip;
        const newHostname = (args.new_hostname as string) || hostname;

        // Remove existing lease, then add updated one
        await client.post('dhcp/remove_static_lease', { mac, ip, hostname });
        await client.post('dhcp/add_static_lease', {
          mac: newMac,
          ip: newIp,
          hostname: newHostname,
        });
        return 'Static lease updated.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'dhcp_reset',
      description:
        'Reset DHCP configuration to defaults (destructive -- may require confirmation)',
      category: 'dhcp',
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
        await client.post('dhcp/reset', {});
        return 'DHCP configuration reset to defaults.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'dhcp_reset_leases',
      description:
        'Clear all DHCP leases (destructive -- may require confirmation)',
      category: 'dhcp',
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
        await client.post('dhcp/reset_leases', {});
        return 'All DHCP leases cleared.';
      },
    },
    config,
  );
}
