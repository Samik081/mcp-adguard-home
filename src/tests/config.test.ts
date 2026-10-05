import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../core/config.js";

describe("loadConfig credentials", () => {
  beforeEach(() => {
    vi.stubEnv("ADGUARD_URL", "http://adguard.test:3000");
    vi.stubEnv("ADGUARD_USERNAME", "");
    vi.stubEnv("ADGUARD_PASSWORD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows both credentials to be unset", () => {
    const config = loadConfig();
    expect(config.username).toBeUndefined();
    expect(config.password).toBeUndefined();
  });

  it("keeps both credentials when set", () => {
    vi.stubEnv("ADGUARD_USERNAME", "admin");
    vi.stubEnv("ADGUARD_PASSWORD", "test-password");
    const config = loadConfig();
    expect(config.username).toBe("admin");
    expect(config.password).toBe("test-password");
  });

  it("rejects a username without a password", () => {
    vi.stubEnv("ADGUARD_USERNAME", "admin");
    expect(() => loadConfig()).toThrow(/ADGUARD_PASSWORD/);
  });

  it("rejects a password without a username", () => {
    vi.stubEnv("ADGUARD_PASSWORD", "test-password");
    expect(() => loadConfig()).toThrow(/ADGUARD_USERNAME/);
  });

  it("still requires ADGUARD_URL", () => {
    vi.stubEnv("ADGUARD_URL", "");
    expect(() => loadConfig()).toThrow(/ADGUARD_URL/);
  });
});
