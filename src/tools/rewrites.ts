/**
 * DNS rewrite tools: list rules and module settings.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface RewriteRule {
  domain: string;
  answer: string;
}

interface RewriteSettings {
  enabled: boolean;
}

// --- Formatters ---

function formatRewrites(rules: RewriteRule[]): string {
  if (rules.length === 0) {
    return 'No rewrite rules configured.';
  }

  const lines: string[] = [`DNS Rewrite Rules (${rules.length})`];
  lines.push('  Domain -> Answer');
  for (const r of rules) {
    lines.push(`  ${r.domain} -> ${r.answer}`);
  }
  return lines.join('\n');
}

// --- Registration ---

export function registerRewritesTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'rewrites_list',
      description: 'Retrieve all configured DNS rewrite rules',
      category: 'rewrites',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get('rewrite/list')) as RewriteRule[];
        return formatRewrites(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'rewrites_get_settings',
      description: 'Retrieve DNS rewrite module enabled/disabled state',
      category: 'rewrites',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get(
          'rewrite/settings',
        )) as RewriteSettings;
        return `DNS Rewrites: ${data.enabled ? 'enabled' : 'disabled'}`;
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'rewrites_add',
      description: 'Add a new DNS rewrite rule',
      category: 'rewrites',
      accessTier: 'full',
      inputSchema: {
        domain: z.string().describe('Domain pattern to rewrite'),
        answer: z.string().describe('Answer to return (IP address, domain, or special value)'),
      },
      handler: async (args) => {
        const domain = args.domain as string;
        const answer = args.answer as string;
        await client.post('rewrite/add', { domain, answer });
        return `Rewrite added: ${domain} -> ${answer}.`;
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'rewrites_update',
      description:
        'Update a DNS rewrite rule (removes existing rule and adds updated one)',
      category: 'rewrites',
      accessTier: 'full',
      inputSchema: {
        domain: z.string().describe('Current domain of the rule to update'),
        answer: z.string().describe('Current answer of the rule to update'),
        new_domain: z
          .string()
          .optional()
          .describe('New domain (defaults to current)'),
        new_answer: z
          .string()
          .optional()
          .describe('New answer (defaults to current)'),
      },
      handler: async (args) => {
        const domain = args.domain as string;
        const answer = args.answer as string;
        const newDomain = (args.new_domain as string) || domain;
        const newAnswer = (args.new_answer as string) || answer;

        // Remove existing rule, then add updated one
        await client.post('rewrite/delete', { domain, answer });
        await client.post('rewrite/add', {
          domain: newDomain,
          answer: newAnswer,
        });
        return 'Rewrite updated.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'rewrites_delete',
      description:
        'Delete a DNS rewrite rule (both domain and answer must match)',
      category: 'rewrites',
      accessTier: 'full',
      inputSchema: {
        domain: z.string().describe('Domain of the rule to delete'),
        answer: z.string().describe('Answer of the rule to delete'),
      },
      handler: async (args) => {
        const domain = args.domain as string;
        const answer = args.answer as string;
        await client.post('rewrite/delete', { domain, answer });
        return 'Rewrite deleted.';
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'rewrites_set_settings',
      description: 'Enable or disable the DNS rewrite module',
      category: 'rewrites',
      accessTier: 'full',
      inputSchema: {
        enabled: z.boolean().describe('Whether to enable or disable DNS rewrites'),
      },
      handler: async (args) => {
        const enabled = args.enabled as boolean;
        await client.post('rewrite/settings/update', { enabled });
        return `Rewrite module ${enabled ? 'enabled' : 'disabled'}.`;
      },
    },
    config,
  );
}
