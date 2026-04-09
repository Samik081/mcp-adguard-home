#!/usr/bin/env node

/**
 * MCP AdGuard Home - Entry point.
 * Reads env vars, validates AdGuard Home connection, starts MCP server.
 */

import { AdGuardClient } from "./core/client.js";
import { loadConfig } from "./core/config.js";
import { logger } from "./core/logger.js";
import { createServer, startServer } from "./core/server.js";
import { registerAllTools } from "./tools/index.js";
import type { AppConfig } from "./types/index.js";

async function main(): Promise<void> {
  logger.info("mcp-adguard-home starting...");

  // Load and validate configuration
  let config: AppConfig;
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
    `Categories: ${config.categories ? config.categories.join(", ") : "all (no filter)"}`,
  );

  // Create MCP server
  const serverFactory = () => {
    const s = createServer();
    registerAllTools(s, client, config);
    return s;
  };
  const server = serverFactory();
  await startServer(server, config, serverFactory);
}

main().catch((err) => {
  logger.error(
    `Fatal error: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
