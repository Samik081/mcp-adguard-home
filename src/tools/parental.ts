/**
 * Parental filtering tools: parental control status and toggle.
 *
 * PITFALL: The API response uses field 'enable' (not 'enabled').
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AdGuardClient } from "../core/client.js";
import { registerTool } from "../core/tools.js";
import type { AppConfig } from "../types/index.js";

// --- Registration ---

export function registerParentalTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: "parental_get_status",
      title: "Get Parental Filtering Status",
      description: "Retrieve parental filtering status",
      category: "parental",
      accessTier: "read-only",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
      inputSchema: {},
      handler: async () => {
        // CRITICAL: API returns { enable: boolean } not { enabled: boolean }
        const data = (await client.get("parental/status")) as {
          enable: boolean;
        };
        return `Parental Filtering: ${data.enable ? "enabled" : "disabled"}`;
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: "parental_set",
      title: "Set Parental Filtering",
      description:
        "Enable or disable parental filtering (content restrictions)",
      category: "parental",
      accessTier: "full",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
      inputSchema: {
        enabled: z
          .boolean()
          .describe("Whether parental filtering should be enabled"),
      },
      handler: async (args) => {
        const enabled = args.enabled as boolean;
        const endpoint = enabled ? "parental/enable" : "parental/disable";
        await client.post(endpoint);
        return enabled
          ? "Parental filtering enabled."
          : "Parental filtering disabled.";
      },
    },
    config,
  );
}
