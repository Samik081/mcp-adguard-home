import { vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../types/index.js';
import type { AdGuardClient } from '../core/client.js';

export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    url: 'http://adguard.test:3000',
    username: 'admin',
    password: 'test-password',
    accessTier: 'full',
    categories: null,
    excludeToolTitles: false,
    debug: false,
    transport: 'stdio',
    httpPort: 3000,
    httpHost: '0.0.0.0',
    ...overrides,
  };
}

export function makeMockClient(): AdGuardClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    getRaw: vi.fn().mockResolvedValue(''),
    validateConnection: vi.fn().mockResolvedValue(undefined),
  } as unknown as AdGuardClient;
}

export async function connectTestClient(server: McpServer) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return {
    client,
    cleanup: async () => {
      await client.close();
    },
  };
}
