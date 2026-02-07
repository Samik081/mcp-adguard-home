/**
 * Blocked services tools: available service catalog and current block list.
 *
 * PITFALL: icon_svg contains Base64-encoded SVG data that is excluded from output.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import { AdGuardClient } from '../core/client.js';
import { registerTool } from '../core/tools.js';

// --- Local response interfaces ---

interface BlockedService {
  id: string;
  name: string;
  icon_svg: string;
  group_id: string;
}

interface DaySchedule {
  start: number;
  end: number;
}

interface BlockedServicesSchedule {
  time_zone: string;
  sun?: DaySchedule;
  mon?: DaySchedule;
  tue?: DaySchedule;
  wed?: DaySchedule;
  thu?: DaySchedule;
  fri?: DaySchedule;
  sat?: DaySchedule;
}

interface BlockedServicesGetResponse {
  ids: string[];
  schedule: BlockedServicesSchedule;
}

// --- Formatters ---

function formatAllServices(services: BlockedService[]): string {
  if (services.length === 0) {
    return 'No blocked services available.';
  }

  // Group by group_id
  const groups = new Map<string, { id: string; name: string }[]>();
  for (const s of services) {
    const group = s.group_id || 'other';
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    // Exclude icon_svg from output
    groups.get(group)!.push({ id: s.id, name: s.name });
  }

  const lines: string[] = [`Available Blocked Services (${services.length})`];
  for (const [group, items] of groups) {
    lines.push(`  ${group}`);
    for (const item of items) {
      lines.push(`    ${item.id} - ${item.name}`);
    }
  }
  return lines.join('\n');
}

function formatBlockedServices(data: BlockedServicesGetResponse): string {
  const lines: string[] = [];

  if (!data.ids || data.ids.length === 0) {
    lines.push('No services are currently blocked.');
  } else {
    lines.push(`Blocked Services (${data.ids.length})`);
    for (const id of data.ids) {
      lines.push(`  ${id}`);
    }
  }

  if (data.schedule) {
    lines.push('');
    lines.push('Schedule');
    lines.push(`  Time zone: ${data.schedule.time_zone || '(not set)'}`);
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    for (const day of days) {
      const d = data.schedule[day];
      if (d) {
        lines.push(`  ${day}: ${d.start}-${d.end}`);
      }
    }
  }

  return lines.join('\n');
}

// --- Registration ---

export function registerBlockedServicesTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: 'blocked_services_get_all',
      description:
        'List all available services that can be blocked, organized by group',
      category: 'blocked_services',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get(
          'blocked_services/all',
        )) as BlockedService[];
        return formatAllServices(data);
      },
    },
    config,
  );

  registerTool(
    server,
    {
      name: 'blocked_services_get',
      description:
        'Retrieve currently blocked services list and schedule',
      category: 'blocked_services',
      accessTier: 'read-only',
      inputSchema: {},
      handler: async () => {
        const data = (await client.get(
          'blocked_services/get',
        )) as BlockedServicesGetResponse;
        return formatBlockedServices(data);
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: 'blocked_services_update',
      description:
        'Update the list of blocked services and optional schedule',
      category: 'blocked_services',
      accessTier: 'full',
      inputSchema: {
        ids: z
          .array(z.string())
          .describe('Service IDs to block (use blocked_services_get_all for available IDs)'),
        schedule: z
          .object({
            time_zone: z.string().optional().describe('IANA time zone name'),
            sun: z
              .object({
                start: z.number().optional().describe('Start time in ms from midnight'),
                end: z.number().optional().describe('End time in ms from midnight'),
              })
              .optional()
              .describe('Sunday schedule'),
            mon: z
              .object({
                start: z.number().optional().describe('Start time in ms from midnight'),
                end: z.number().optional().describe('End time in ms from midnight'),
              })
              .optional()
              .describe('Monday schedule'),
            tue: z
              .object({
                start: z.number().optional().describe('Start time in ms from midnight'),
                end: z.number().optional().describe('End time in ms from midnight'),
              })
              .optional()
              .describe('Tuesday schedule'),
            wed: z
              .object({
                start: z.number().optional().describe('Start time in ms from midnight'),
                end: z.number().optional().describe('End time in ms from midnight'),
              })
              .optional()
              .describe('Wednesday schedule'),
            thu: z
              .object({
                start: z.number().optional().describe('Start time in ms from midnight'),
                end: z.number().optional().describe('End time in ms from midnight'),
              })
              .optional()
              .describe('Thursday schedule'),
            fri: z
              .object({
                start: z.number().optional().describe('Start time in ms from midnight'),
                end: z.number().optional().describe('End time in ms from midnight'),
              })
              .optional()
              .describe('Friday schedule'),
            sat: z
              .object({
                start: z.number().optional().describe('Start time in ms from midnight'),
                end: z.number().optional().describe('End time in ms from midnight'),
              })
              .optional()
              .describe('Saturday schedule'),
          })
          .optional()
          .describe('Blocking schedule by day of week'),
      },
      handler: async (args) => {
        const ids = args.ids as string[];
        const body: Record<string, unknown> = { ids };
        if (args.schedule !== undefined) body.schedule = args.schedule;

        await client.post('blocked_services/update', body);
        return `Blocked services updated (${ids.length} services).`;
      },
    },
    config,
  );
}
