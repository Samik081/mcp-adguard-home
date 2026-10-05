import { afterEach, describe, expect, it, vi } from "vitest";
import { AdGuardClient } from "../core/client.js";
import { sanitizeMessage } from "../core/errors.js";
import { makeConfig } from "./helpers.js";

const NO_AUTH = { username: undefined, password: undefined };

function stubFetch(status = 200) {
  const fetchMock = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response("{}", {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentHeaders(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.map(
    ([, init]) => (init?.headers ?? {}) as Record<string, string>,
  );
}

describe("AdGuardClient authentication", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Basic Auth on every request when credentials are set", async () => {
    const fetchMock = stubFetch();
    const client = new AdGuardClient(makeConfig());
    await client.get("status");
    await client.post("dns_config", { a: 1 });
    await client.getRaw("apple/doh.mobileconfig");
    await client.validateConnection();

    const expected = `Basic ${Buffer.from("admin:test-password").toString("base64")}`;
    const headers = sentHeaders(fetchMock);
    expect(headers).toHaveLength(4);
    for (const h of headers) {
      expect(h.Authorization).toBe(expected);
    }
  });

  it("sends no Authorization header without credentials", async () => {
    const fetchMock = stubFetch();
    const client = new AdGuardClient(makeConfig(NO_AUTH));
    await client.get("status");
    await client.post("dns_config", { a: 1 });
    await client.getRaw("apple/doh.mobileconfig");
    await client.validateConnection();

    const headers = sentHeaders(fetchMock);
    expect(headers).toHaveLength(4);
    for (const h of headers) {
      expect(h).not.toHaveProperty("Authorization");
    }
    expect(headers[1]["Content-Type"]).toBe("application/json");
  });

  it("reports wrong credentials on 401 when credentials are set", async () => {
    stubFetch(401);
    const client = new AdGuardClient(makeConfig());
    await expect(client.validateConnection()).rejects.toThrow(
      /Authentication failed -- check ADGUARD_USERNAME and ADGUARD_PASSWORD/,
    );
  });

  it("reports missing credentials on 401 when none are set", async () => {
    stubFetch(401);
    const client = new AdGuardClient(makeConfig(NO_AUTH));
    await expect(client.validateConnection()).rejects.toThrow(
      /requires authentication -- set ADGUARD_USERNAME and ADGUARD_PASSWORD/,
    );
  });
});

describe("sanitizeMessage", () => {
  it("redacts credentials and their Base64 form", () => {
    const base64 = Buffer.from("admin:test-password").toString("base64");
    expect(sanitizeMessage(`admin test-password ${base64}`, makeConfig())).toBe(
      "[REDACTED] [REDACTED] [REDACTED]",
    );
  });

  it("leaves the message untouched without credentials", () => {
    const message = "GET status failed: Og== 500";
    expect(sanitizeMessage(message, NO_AUTH)).toBe(message);
  });
});
