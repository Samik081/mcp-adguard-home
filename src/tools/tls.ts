/**
 * TLS tools: certificate status and configuration validation.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface TlsStatus {
  enabled: boolean;
  server_name: string;
  port_https: number;
  port_dns_over_tls: number;
  port_dns_over_quic: number;
  force_https: boolean;
  valid_cert: boolean;
  valid_chain: boolean;
  valid_key: boolean;
  valid_pair: boolean;
  subject: string;
  issuer: string;
  not_before: string;
  not_after: string;
  dns_names: string[];
  key_type: string;
  warning_validation: string;
}

interface TlsValidation {
  valid_cert: boolean;
  valid_chain: boolean;
  valid_key: boolean;
  valid_pair: boolean;
  subject: string;
  issuer: string;
  dns_names: string[];
  warning_validation: string;
}

// --- Formatters ---

function formatTlsStatus(data: TlsStatus): string {
  const lines: string[] = [
    `TLS Status: ${data.enabled ? 'enabled' : 'disabled'}`,
    `  Server name: ${data.server_name || '(not set)'}`,
    `  HTTPS port: ${data.port_https}`,
    `  DNS-over-TLS port: ${data.port_dns_over_tls}`,
    `  DNS-over-QUIC port: ${data.port_dns_over_quic}`,
    `  Force HTTPS: ${data.force_https ? 'yes' : 'no'}`,
    '',
    'Certificate Status',
    `  Valid certificate: ${data.valid_cert ? 'yes' : 'no'}`,
    `  Valid chain: ${data.valid_chain ? 'yes' : 'no'}`,
    `  Valid key: ${data.valid_key ? 'yes' : 'no'}`,
    `  Valid pair: ${data.valid_pair ? 'yes' : 'no'}`,
    `  Subject: ${data.subject || '(none)'}`,
    `  Issuer: ${data.issuer || '(none)'}`,
    `  Not before: ${data.not_before || '(none)'}`,
    `  Not after: ${data.not_after || '(none)'}`,
    `  DNS names: ${data.dns_names?.length ? data.dns_names.join(', ') : '(none)'}`,
    `  Key type: ${data.key_type || '(none)'}`,
  ];

  if (data.warning_validation) {
    lines.push(`  Warning: ${data.warning_validation}`);
  }

  return lines.join('\n');
}

function formatTlsValidation(data: TlsValidation): string {
  const lines: string[] = [
    'TLS Validation Results',
    `  Valid certificate: ${data.valid_cert ? 'yes' : 'no'}`,
    `  Valid chain: ${data.valid_chain ? 'yes' : 'no'}`,
    `  Valid key: ${data.valid_key ? 'yes' : 'no'}`,
    `  Valid pair: ${data.valid_pair ? 'yes' : 'no'}`,
    `  Subject: ${data.subject || '(none)'}`,
    `  Issuer: ${data.issuer || '(none)'}`,
    `  DNS names: ${data.dns_names?.length ? data.dns_names.join(', ') : '(none)'}`,
  ];

  if (data.warning_validation) {
    lines.push(`  Warning: ${data.warning_validation}`);
  }

  return lines.join('\n');
}

// --- Registration ---

export function registerTlsTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'tls_get_status',
      description:
        'Retrieve TLS configuration and certificate validation status',
      category: 'tls',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('tls/status')) as TlsStatus;
        return formatTlsStatus(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'tls_validate',
      description:
        'Validate TLS configuration without applying changes. Tests certificate and key validity.',
      category: 'tls',
      accessTier: 'read-only',
      inputSchema: {
        certificate_chain: z
          .string()
          .optional()
          .describe('PEM-encoded certificate chain'),
        private_key: z
          .string()
          .optional()
          .describe('PEM-encoded private key'),
        certificate_path: z
          .string()
          .optional()
          .describe('Path to certificate file on server'),
        private_key_path: z
          .string()
          .optional()
          .describe('Path to private key file on server'),
        server_name: z
          .string()
          .optional()
          .describe('Server hostname'),
        port_https: z
          .number()
          .optional()
          .describe('HTTPS port'),
        port_dns_over_tls: z
          .number()
          .optional()
          .describe('DNS-over-TLS port'),
        port_dns_over_quic: z
          .number()
          .optional()
          .describe('DNS-over-QUIC port'),
        force_https: z
          .boolean()
          .optional()
          .describe('Force HTTPS redirect'),
      },
      handler: async (args) => {
        const data = (await client.post(
          'tls/validate',
          args,
        )) as TlsValidation;
        return formatTlsValidation(data);
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'tls_set_config',
      description:
        'Update TLS configuration including certificates and HTTPS/DoH/DoT settings',
      category: 'tls',
      accessTier: 'full',
      inputSchema: {
        enabled: z.boolean().optional().describe('Enable or disable TLS'),
        server_name: z.string().optional().describe('Server hostname'),
        force_https: z
          .boolean()
          .optional()
          .describe('Force HTTPS redirect for web interface'),
        port_https: z.number().optional().describe('HTTPS port'),
        port_dns_over_tls: z
          .number()
          .optional()
          .describe('DNS-over-TLS port'),
        port_dns_over_quic: z
          .number()
          .optional()
          .describe('DNS-over-QUIC port'),
        certificate_chain: z
          .string()
          .optional()
          .describe('PEM-encoded certificate chain'),
        private_key: z
          .string()
          .optional()
          .describe('PEM-encoded private key'),
        certificate_path: z
          .string()
          .optional()
          .describe('Path to certificate file on server filesystem'),
        private_key_path: z
          .string()
          .optional()
          .describe('Path to private key file on server filesystem'),
      },
      handler: async (args) => {
        const body: Record<string, unknown> = {};
        if (args.enabled !== undefined) body.enabled = args.enabled;
        if (args.server_name !== undefined) body.server_name = args.server_name;
        if (args.force_https !== undefined) body.force_https = args.force_https;
        if (args.port_https !== undefined) body.port_https = args.port_https;
        if (args.port_dns_over_tls !== undefined)
          body.port_dns_over_tls = args.port_dns_over_tls;
        if (args.port_dns_over_quic !== undefined)
          body.port_dns_over_quic = args.port_dns_over_quic;
        if (args.certificate_chain !== undefined)
          body.certificate_chain = args.certificate_chain;
        if (args.private_key !== undefined) body.private_key = args.private_key;
        if (args.certificate_path !== undefined)
          body.certificate_path = args.certificate_path;
        if (args.private_key_path !== undefined)
          body.private_key_path = args.private_key_path;

        await client.post('tls/configure', body);
        return 'TLS configuration updated.';
      },
    },
    config,
  );
}
