import { describe, it, expect } from 'vitest';
import { createServer } from '../core/server.js';
import { registerAllTools } from '../tools/index.js';
import { makeConfig, makeMockClient, connectTestClient } from './helpers.js';

describe('tool registration', () => {
  it('registers all tools at full tier', async () => {
    const server = createServer();
    registerAllTools(server, makeMockClient(), makeConfig());
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(65);
    await cleanup();
  });

  it('registers only read-only tools in read-only mode', async () => {
    const server = createServer();
    registerAllTools(server, makeMockClient(), makeConfig({ accessTier: 'read-only' }));
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(29);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, `${tool.name} missing readOnlyHint`).toBe(true);
    }
    await cleanup();
  });

  it('filters to only global category tools', async () => {
    const server = createServer();
    registerAllTools(server, makeMockClient(), makeConfig({ categories: ['global'] }));
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^global_/);
    }
    await cleanup();
  });

  it('registers fewer tools when category filter is applied', async () => {
    const fullServer = createServer();
    registerAllTools(fullServer, makeMockClient(), makeConfig());
    const fullConn = await connectTestClient(fullServer);
    const { tools: allTools } = await fullConn.client.listTools();

    const filteredServer = createServer();
    registerAllTools(filteredServer, makeMockClient(), makeConfig({ categories: ['dns', 'global'] }));
    const filteredConn = await connectTestClient(filteredServer);
    const { tools: filteredTools } = await filteredConn.client.listTools();

    expect(filteredTools.length).toBeGreaterThan(0);
    expect(filteredTools.length).toBeLessThan(allTools.length);

    await fullConn.cleanup();
    await filteredConn.cleanup();
  });

  describe('annotations', () => {
    it('global_get_status: readOnly, not destructive, idempotent', async () => {
      const server = createServer();
      registerAllTools(server, makeMockClient(), makeConfig());
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === 'global_get_status');
      expect(tool).toBeDefined();
      expect(tool!.annotations?.readOnlyHint).toBe(true);
      expect(tool!.annotations?.destructiveHint).toBe(false);
      expect(tool!.annotations?.idempotentHint).toBe(true);
      await cleanup();
    });

    it('safebrowsing_set: not readOnly, destructive, idempotent', async () => {
      const server = createServer();
      registerAllTools(server, makeMockClient(), makeConfig());
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === 'safebrowsing_set');
      expect(tool).toBeDefined();
      expect(tool!.annotations?.readOnlyHint).toBe(false);
      expect(tool!.annotations?.destructiveHint).toBe(true);
      expect(tool!.annotations?.idempotentHint).toBe(true);
      await cleanup();
    });
  });
});
