/**
 * Barrel file -- imports all 16 category registration functions and
 * exposes a single registerAllTools() entry point.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import type { AdGuardClient } from '../core/client.js';

import { registerGlobalTools } from './global.js';
import { registerDnsTools } from './dns.js';
import { registerQuerylogTools } from './querylog.js';
import { registerStatsTools } from './stats.js';
import { registerFilteringTools } from './filtering.js';
import { registerSafebrowsingTools } from './safebrowsing.js';
import { registerParentalTools } from './parental.js';
import { registerSafesearchTools } from './safesearch.js';
import { registerClientsTools } from './clients.js';
import { registerDhcpTools } from './dhcp.js';
import { registerRewritesTools } from './rewrites.js';
import { registerTlsTools } from './tls.js';
import { registerBlockedServicesTools } from './blocked_services.js';
import { registerAccessTools } from './access.js';
import { registerInstallTools } from './install.js';
import { registerMobileConfigTools } from './mobile_config.js';

/**
 * Register all read tools with the MCP server.
 * Each category function checks config.categories and config.accessTier
 * internally, so only permitted tools are actually registered.
 */
export function registerAllTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerGlobalTools(server, client, config);
  registerDnsTools(server, client, config);
  registerQuerylogTools(server, client, config);
  registerStatsTools(server, client, config);
  registerFilteringTools(server, client, config);
  registerSafebrowsingTools(server, client, config);
  registerParentalTools(server, client, config);
  registerSafesearchTools(server, client, config);
  registerClientsTools(server, client, config);
  registerDhcpTools(server, client, config);
  registerRewritesTools(server, client, config);
  registerTlsTools(server, client, config);
  registerBlockedServicesTools(server, client, config);
  registerAccessTools(server, client, config);
  registerInstallTools(server, client, config);
  registerMobileConfigTools(server, client, config);
}
