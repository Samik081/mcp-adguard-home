/**
 * Error handling with credential sanitization.
 * All error messages are scrubbed of credentials before being
 * exposed to logs or LLM context.
 */

/**
 * Sanitize a message by replacing any occurrence of credentials
 * (username, password, or Base64 auth string) with [REDACTED].
 */
export function sanitizeMessage(
  message: string,
  config: { username: string; password: string },
): string {
  let sanitized = message;

  // Replace password first (may be substring of other values)
  if (config.password) {
    sanitized = sanitized.replaceAll(config.password, '[REDACTED]');
  }

  // Replace username
  if (config.username) {
    sanitized = sanitized.replaceAll(config.username, '[REDACTED]');
  }

  // Replace Base64-encoded auth string
  const base64Auth = Buffer.from(
    `${config.username}:${config.password}`,
  ).toString('base64');
  if (base64Auth) {
    sanitized = sanitized.replaceAll(base64Auth, '[REDACTED]');
  }

  return sanitized;
}

/**
 * Custom error class for AdGuard Home API errors.
 */
export class AdGuardError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AdGuardError';
    this.statusCode = statusCode;
  }
}

/**
 * Wrap any error with a sanitized message.
 * Handles Error instances, strings, and unknown thrown values.
 */
export function createSafeError(
  err: unknown,
  config: { username: string; password: string },
): Error {
  if (err instanceof Error) {
    const sanitized = sanitizeMessage(err.message, config);
    const safeError = new Error(sanitized);
    safeError.name = err.name;
    return safeError;
  }

  if (typeof err === 'string') {
    return new Error(sanitizeMessage(err, config));
  }

  return new Error('An unknown error occurred');
}
