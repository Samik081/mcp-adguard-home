/**
 * DNS tools: configuration info and upstream server testing.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface DnsInfo {
  upstream_dns: string[];
  upstream_dns_file: string;
  bootstrap_dns: string[];
  fallback_dns: string[];
  protection_enabled: boolean;
  rate_limit: number;
  blocking_mode: string;
  blocking_ipv4: string;
  blocking_ipv6: string;
  edns_cs_enabled: boolean;
  edns_cs_use_custom: boolean;
  edns_cs_custom_ip: string;
  dnssec_enabled: boolean;
  disable_ipv6: boolean;
  upstream_mode: string;
  cache_size: number;
  cache_ttl_min: number;
  cache_ttl_max: number;
  cache_optimistic: boolean;
  resolve_clients: boolean;
  use_private_ptr_resolvers: boolean;
  local_ptr_upstreams: string[];
  default_local_ptr_upstreams: string[];
}

// --- Formatters ---

function formatDnsInfo(data: DnsInfo): string {
  const lines: string[] = ['DNS Configuration'];

  lines.push(
    `  Upstream servers: ${data.upstream_dns.length ? data.upstream_dns.join(', ') : 'none'}`,
  );
  lines.push(
    `  Bootstrap servers: ${data.bootstrap_dns.length ? data.bootstrap_dns.join(', ') : 'none'}`,
  );
  lines.push(
    `  Fallback servers: ${data.fallback_dns?.length ? data.fallback_dns.join(', ') : 'none'}`,
  );
  lines.push(
    `  Protection: ${data.protection_enabled ? 'enabled' : 'disabled'}`,
  );
  lines.push(`  Rate limit: ${data.rate_limit} req/s`);
  lines.push(`  Blocking mode: ${data.blocking_mode}`);
  lines.push(
    `  Cache: ${data.cache_size > 0 ? `enabled (${data.cache_size} entries)` : 'disabled'}`,
  );
  lines.push(`  Cache TTL min: ${data.cache_ttl_min}s`);
  lines.push(`  Cache TTL max: ${data.cache_ttl_max}s`);
  lines.push(`  DNSSEC: ${data.dnssec_enabled ? 'enabled' : 'disabled'}`);
  lines.push(
    `  EDNS Client Subnet: ${data.edns_cs_enabled ? 'enabled' : 'disabled'}`,
  );
  lines.push(
    `  EDNS custom IP: ${data.edns_cs_use_custom ? 'enabled' : 'disabled'}`,
  );
  lines.push(
    `  Default local PTR upstreams: ${data.default_local_ptr_upstreams?.length ? data.default_local_ptr_upstreams.join(', ') : 'none'}`,
  );
  lines.push(
    `  Resolve clients: ${data.resolve_clients ? 'yes' : 'no'}`,
  );
  lines.push(
    `  Use private PTR resolvers: ${data.use_private_ptr_resolvers ? 'yes' : 'no'}`,
  );

  return lines.join('\n');
}

function formatUpstreamTest(data: Record<string, string>): string {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return 'No upstream servers tested.';
  }

  const lines: string[] = ['Upstream Test Results'];
  for (const [server, result] of entries) {
    const status = result === 'OK' ? 'PASS' : `FAIL (${result})`;
    lines.push(`  ${server}: ${status}`);
  }
  return lines.join('\n');
}

// --- Registration ---

export function registerDnsTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'dns_get_info',
      description:
        'Retrieve full DNS server configuration including upstreams, bootstrap servers, cache settings, blocking mode, and DNSSEC status',
      category: 'dns',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('dns_info')) as DnsInfo;
        return formatDnsInfo(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'dns_test_upstream',
      description:
        'Test upstream DNS server configuration to verify servers are reachable and responding',
      category: 'dns',
      accessTier: 'read-only',
      inputSchema: {
        upstream_dns: z.array(z.string()),
        bootstrap_dns: z.array(z.string()),
        fallback_dns: z.array(z.string()).optional(),
        private_upstream: z.array(z.string()).optional(),
      },
      handler: async (args) => {
        const body: Record<string, unknown> = {
          upstream_dns: args.upstream_dns,
          bootstrap_dns: args.bootstrap_dns,
        };
        if (args.fallback_dns) body.fallback_dns = args.fallback_dns;
        if (args.private_upstream)
          body.private_upstream = args.private_upstream;

        const data = (await client.post(
          'test_upstream_dns',
          body,
        )) as Record<string, string>;
        return formatUpstreamTest(data);
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'dns_set_config',
      description:
        'Update DNS server configuration. All fields are optional -- only provided fields are changed.',
      category: 'dns',
      accessTier: 'full',
      inputSchema: {
        upstream_dns: z.array(z.string()).optional().describe('Upstream DNS server URLs'),
        bootstrap_dns: z.array(z.string()).optional().describe('Bootstrap DNS server URLs'),
        fallback_dns: z.array(z.string()).optional().describe('Fallback DNS server URLs'),
        protection_enabled: z.boolean().optional().describe('Enable/disable DNS protection'),
        rate_limit: z.number().optional().describe('Rate limit in requests per second'),
        blocking_mode: z.string().optional().describe('Blocking mode (default, refused, nxdomain, null_ip, custom_ip)'),
        blocking_ipv4: z.string().optional().describe('Custom blocking IPv4 address'),
        blocking_ipv6: z.string().optional().describe('Custom blocking IPv6 address'),
        edns_cs_enabled: z.boolean().optional().describe('Enable EDNS Client Subnet'),
        dnssec_enabled: z.boolean().optional().describe('Enable DNSSEC'),
        disable_ipv6: z.boolean().optional().describe('Disable IPv6 resolution'),
        upstream_mode: z.string().optional().describe('Upstream mode (load_balance, parallel, fastest_addr)'),
        cache_size: z.number().optional().describe('DNS cache size in entries'),
        cache_ttl_min: z.number().optional().describe('Minimum cache TTL in seconds'),
        cache_ttl_max: z.number().optional().describe('Maximum cache TTL in seconds'),
        cache_optimistic: z.boolean().optional().describe('Enable optimistic caching'),
        resolve_clients: z.boolean().optional().describe('Resolve client hostnames'),
        use_private_ptr_resolvers: z.boolean().optional().describe('Use private PTR resolvers'),
        local_ptr_upstreams: z.array(z.string()).optional().describe('Local PTR upstream servers'),
      },
      handler: async (args) => {
        const body: Record<string, unknown> = {};
        const fields = [
          'upstream_dns', 'bootstrap_dns', 'fallback_dns', 'protection_enabled',
          'rate_limit', 'blocking_mode', 'blocking_ipv4', 'blocking_ipv6',
          'edns_cs_enabled', 'dnssec_enabled', 'disable_ipv6', 'upstream_mode',
          'cache_size', 'cache_ttl_min', 'cache_ttl_max', 'cache_optimistic',
          'resolve_clients', 'use_private_ptr_resolvers', 'local_ptr_upstreams',
        ];
        for (const field of fields) {
          if (args[field] !== undefined) {
            body[field] = args[field];
          }
        }
        await client.post('dns_config', body);
        return 'DNS configuration updated.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'dns_clear_cache',
      description: 'Clear the DNS resolver cache',
      category: 'dns',
      accessTier: 'full',
      inputSchema: {},
      handler: async () => {
        await client.post('cache_clear');
        return 'DNS cache cleared.';
      },
    },
    config,
  );
}
