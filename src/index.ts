#!/usr/bin/env node

/**
 * MCP AdGuard Home - Entry point.
 * Reads env vars, validates AdGuard Home connection, starts MCP server.
 */

import { loadConfig } from './core/config.js';
import { AdGuardClient } from './core/client.js';
import { createServer, startServer } from './core/server.js';
import { logger } from './core/logger.js';
import { registerAllTools } from './tools/index.js';

async function main(): Promise<void> {
  logger.info('mcp-adguard-home starting...');

  // Load and validate configuration
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Validate connection to AdGuard Home
  const client = new AdGuardClient(config);
  try {
    await client.validateConnection();
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  logger.info(`Connected to AdGuard Home at ${config.url}`);
  logger.info(`Access tier: ${config.accessTier}`);
  logger.info(
    `Categories: ${config.categories ? config.categories.join(', ') : 'all (no filter)'}`,
  );

  // Create MCP server
  const server = createServer();

  // Register all tools (categories and access tier are filtered internally)
  registerAllTools(server, client, config);

  // Start listening on stdio transport
  await startServer(server);
}

main().catch((err) => {
  logger.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
