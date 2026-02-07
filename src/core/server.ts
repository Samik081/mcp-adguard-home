/**
 * MCP server factory. Creates and starts the MCP server
 * with stdio transport for AdGuard Home tool exposure.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './logger.js';

const SERVER_NAME = 'mcp-adguard-home';
const SERVER_VERSION = '1.0.0';

/**
 * Create a new MCP server instance.
 */
export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  return server;
}

/**
 * Start the MCP server on stdio transport.
 * This is the last call in the entry point -- it blocks
 * until the transport closes.
 */
export async function startServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  logger.info(`${SERVER_NAME} v${SERVER_VERSION} listening on stdio`);
  await server.connect(transport);
}
