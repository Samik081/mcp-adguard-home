/**
 * HTTP client for AdGuard Home API.
 * Uses native fetch (Node 18+) with Basic Auth, /control/ base path,
 * credential sanitization, and JSON+text response handling.
 */

import type { AppConfig } from '../types/index.js';
import { createAuthHeader } from './auth.js';
import { AdGuardError, sanitizeMessage } from './errors.js';

/** Request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 30_000;

export class AdGuardClient {
  private readonly config: AppConfig;
  private readonly authHeader: string;
  private readonly baseUrl: string;

  constructor(config: AppConfig) {
    this.config = config;
    this.authHeader = createAuthHeader(config.username, config.password);
    this.baseUrl = `${config.url}/control`;
  }

  /**
   * Send a GET request and return parsed JSON or text.
   * JSON responses (Content-Type includes 'json') are parsed; others returned as text.
   */
  async get(path: string): Promise<unknown> {
    const url = `${this.baseUrl}/${path}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new AdGuardError(
          sanitizeMessage(
            `GET ${path} failed: ${response.status} ${response.statusText}`,
            this.config,
          ),
          response.status,
        );
      }

      return await this.parseResponse(response);
    } catch (err) {
      if (err instanceof AdGuardError) throw err;
      throw new AdGuardError(
        sanitizeMessage(
          err instanceof Error ? err.message : String(err),
          this.config,
        ),
      );
    }
  }

  /**
   * Send a POST request with optional JSON body.
   * Returns parsed JSON, text, or empty string for empty responses.
   */
  async post(path: string, body?: unknown): Promise<unknown> {
    const url = `${this.baseUrl}/${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new AdGuardError(
          sanitizeMessage(
            `POST ${path} failed: ${response.status} ${response.statusText}`,
            this.config,
          ),
          response.status,
        );
      }

      // Some AdGuard POST endpoints return empty 200
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        return '';
      }

      // Try to parse response body; return empty string if no body
      const text = await response.text();
      if (!text) return '';

      // Attempt JSON parse if content type suggests it
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }

      return text;
    } catch (err) {
      if (err instanceof AdGuardError) throw err;
      throw new AdGuardError(
        sanitizeMessage(
          err instanceof Error ? err.message : String(err),
          this.config,
        ),
      );
    }
  }

  /**
   * Send a GET request and always return raw text response.
   * Used for endpoints that return non-JSON data (e.g., mobile config profiles).
   */
  async getRaw(path: string): Promise<string> {
    const url = `${this.baseUrl}/${path}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new AdGuardError(
          sanitizeMessage(
            `GET ${path} failed: ${response.status} ${response.statusText}`,
            this.config,
          ),
          response.status,
        );
      }

      return await response.text();
    } catch (err) {
      if (err instanceof AdGuardError) throw err;
      throw new AdGuardError(
        sanitizeMessage(
          err instanceof Error ? err.message : String(err),
          this.config,
        ),
      );
    }
  }

  /**
   * Validate the connection to AdGuard Home by calling GET /control/status.
   * Throws a sanitized, descriptive error on failure.
   */
  async validateConnection(): Promise<void> {
    const url = `${this.baseUrl}/status`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status === 401 || response.status === 403) {
        throw new AdGuardError(
          'Authentication failed -- check ADGUARD_USERNAME and ADGUARD_PASSWORD',
          response.status,
        );
      }

      if (!response.ok) {
        throw new AdGuardError(
          sanitizeMessage(
            `Connection check failed: ${response.status} ${response.statusText}`,
            this.config,
          ),
          response.status,
        );
      }
    } catch (err) {
      if (err instanceof AdGuardError) throw err;
      throw new AdGuardError(
        sanitizeMessage(
          `Cannot connect to AdGuard Home at ${this.config.url}: ${err instanceof Error ? err.message : String(err)}`,
          this.config,
        ),
      );
    }
  }

  /**
   * Parse response based on Content-Type: JSON for 'json' types, text otherwise.
   */
  private async parseResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('json')) {
      return await response.json();
    }

    return await response.text();
  }
}
