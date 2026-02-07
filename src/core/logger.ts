/**
 * Stderr-only logger. All output goes to stderr to keep stdout
 * reserved exclusively for MCP JSON-RPC messages.
 */

const PREFIX = '[mcp-adguard-home]';

export const logger = {
  info: (...args: unknown[]): void => {
    console.error(PREFIX, 'INFO', ...args);
  },
  warn: (...args: unknown[]): void => {
    console.error(PREFIX, 'WARN', ...args);
  },
  error: (...args: unknown[]): void => {
    console.error(PREFIX, 'ERROR', ...args);
  },
  debug: (...args: unknown[]): void => {
    if (process.env.DEBUG) {
      console.error(PREFIX, 'DEBUG', ...args);
    }
  },
};
