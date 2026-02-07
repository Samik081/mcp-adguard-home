/**
 * Authentication helpers for AdGuard Home HTTP Basic Auth.
 */

/**
 * Create a Basic Auth header value from username and password.
 * Returns the full header value: "Basic <base64>"
 */
export function createAuthHeader(username: string, password: string): string {
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${encoded}`;
}
