/**
 * Safe browsing tools: malware/phishing protection status and toggle.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AdGuardClient } from "../core/client.js";
import { registerTool } from "../core/tools.js";
import type { AppConfig } from "../types/index.js";

// --- Registration ---

export function registerSafebrowsingTools(
  server: McpServer,
  client: AdGuardClient,
  config: AppConfig,
): void {
  registerTool(
    server,
    {
      name: "safebrowsing_get_status",
      title: "Get Safe Browsing Status",
      description:
        "Retrieve safe browsing (malware/phishing protection) status",
      category: "safebrowsing",
      accessTier: "read-only",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
      inputSchema: {},
      handler: async () => {
        const data = (await client.get("safebrowsing/status")) as {
          enabled: boolean;
        };
        return `Safe Browsing: ${data.enabled ? "enabled" : "disabled"}`;
      },
    },
    config,
  );

  // --- Write tools ---

  registerTool(
    server,
    {
      name: "safebrowsing_set",
      title: "Set Safe Browsing",
      description:
        "Enable or disable safe browsing (malware/phishing protection)",
      category: "safebrowsing",
      accessTier: "full",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
      inputSchema: {
        enabled: z
          .boolean()
          .describe("Whether safe browsing should be enabled"),
      },
      handler: async (args) => {
        const enabled = args.enabled as boolean;
        const endpoint = enabled
          ? "safebrowsing/enable"
          : "safebrowsing/disable";
        await client.post(endpoint);
        return enabled ? "Safe browsing enabled." : "Safe browsing disabled.";
      },
    },
    config,
  );
}
