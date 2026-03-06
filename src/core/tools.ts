/**
 * Tool registration helper. Wraps MCP server.registerTool() with
 * access tier checking, category filtering, blacklist/whitelist support,
 * and error handling.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { AppConfig, ToolRegistration } from "../types/index.js";
import { sanitizeMessage } from "./errors.js";
import { logger } from "./logger.js";

/** Tracks all tool names seen during registration for post-registration validation. */
const seenToolNames = new Set<string>();

/**
 * Register a tool with the MCP server, respecting blacklist/whitelist,
 * access tier, and category filters.
 *
 * Filter precedence:
 * 1. Blacklist always wins (even over whitelist — logs warning if both)
 * 2. Whitelist bypasses access tier and category filters
 * 3. Access tier gate
 * 4. Category gate
 *
 * Returns true if the tool was registered, false if it was filtered out.
 */
export function registerTool(
  server: McpServer,
  registration: ToolRegistration,
  config: AppConfig,
): boolean {
  seenToolNames.add(registration.name);

  const isBlacklisted = config.toolBlacklist?.includes(registration.name);
  const isWhitelisted = config.toolWhitelist?.includes(registration.name);

  // Blacklist always wins
  if (isBlacklisted) {
    if (isWhitelisted) {
      logger.warn(
        `Tool "${registration.name}" is both blacklisted and whitelisted — blacklist takes precedence, skipping`,
      );
    } else {
      logger.debug(`Skipping tool "${registration.name}" (blacklisted)`);
    }
    return false;
  }

  // Whitelist bypasses tier and category filters
  if (!isWhitelisted) {
    // Check access tier: skip write-only tools in read-only mode
    if (
      config.accessTier === "read-only" &&
      registration.accessTier === "full"
    ) {
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
  }

  // Build annotations
  const annotations: ToolAnnotations = {
    readOnlyHint: registration.accessTier === "read-only",
    destructiveHint: false,
    ...registration.annotations,
  };

  // Register the tool with MCP server
  server.registerTool(
    registration.name,
    {
      ...(!config.excludeToolTitles && { title: registration.title }),
      description: registration.description,
      inputSchema: registration.inputSchema as Record<string, never>,
      annotations,
    },
    async (args: Record<string, unknown>) => {
      try {
        const result = await registration.handler(args);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? sanitizeMessage(err.message, config)
            : "An unknown error occurred";
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }
    },
  );

  if (isWhitelisted) {
    logger.debug(
      `Registered tool: ${registration.name} [${registration.category}] (whitelisted)`,
    );
  } else {
    logger.debug(
      `Registered tool: ${registration.name} [${registration.category}]`,
    );
  }
  return true;
}

/**
 * Validate that all tool names in blacklist/whitelist actually exist.
 * Call after registerAllTools() to warn about typos or stale entries.
 */
export function validateToolLists(config: AppConfig): void {
  for (const name of config.toolBlacklist ?? []) {
    if (!seenToolNames.has(name)) {
      logger.warn(`Blacklisted tool "${name}" does not match any known tool`);
    }
  }
  for (const name of config.toolWhitelist ?? []) {
    if (!seenToolNames.has(name)) {
      logger.warn(`Whitelisted tool "${name}" does not match any known tool`);
    }
  }
}
