/**
 * Tool registration helper. Wraps MCP server.registerTool() with
 * access tier checking, category filtering, and error handling.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { AppConfig, ToolRegistration } from '../types/index.js';
import { sanitizeMessage } from './errors.js';
import { logger } from './logger.js';

/**
 * Register a tool with the MCP server, respecting access tier and category filters.
 *
 * Returns true if the tool was registered, false if it was filtered out.
 */
export function registerTool(
  server: McpServer,
  registration: ToolRegistration,
  config: AppConfig,
): boolean {
  // Check access tier: skip write-only tools in read-only mode
  if (config.accessTier === 'read-only' && registration.accessTier === 'full') {
    logger.debug(
      `Skipping tool "${registration.name}" (requires full access, running in read-only mode)`,
    );
    return false;
  }

  // Check category filter: skip tools outside allowed categories
  if (
    config.categories !== null &&
    !config.categories.includes(registration.category)
  ) {
    logger.debug(
      `Skipping tool "${registration.name}" (category "${registration.category}" not in allowed categories)`,
    );
    return false;
  }

  // Build annotations
  const annotations: ToolAnnotations = {
    readOnlyHint: registration.accessTier === 'read-only',
    destructiveHint: false,
    ...registration.annotations,
  };

  // Register the tool with MCP server
  server.registerTool(
    registration.name,
    {
      description: registration.description,
      inputSchema: registration.inputSchema as Record<string, never>,
      annotations,
    },
    async (args: Record<string, unknown>) => {
      try {
        const result = await registration.handler(args);
        return {
          content: [{ type: 'text' as const, text: result }],
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? sanitizeMessage(err.message, config)
            : 'An unknown error occurred';
        return {
          content: [{ type: 'text' as const, text: message }],
          isError: true,
        };
      }
    },
  );

  logger.debug(`Registered tool: ${registration.name} [${registration.category}]`);
  return true;
}
