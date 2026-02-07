/**
 * Environment variable parsing and validation.
 * Reads required and optional config from process.env.
 */

import type { AccessTier, AppConfig, ToolCategory } from '../types/index.js';
import { VALID_CATEGORIES } from '../types/index.js';

/**
 * Load and validate application config from environment variables.
 *
 * Required: ADGUARD_URL, ADGUARD_USERNAME, ADGUARD_PASSWORD
 * Optional: ADGUARD_ACCESS_TIER (default: 'full'), ADGUARD_CATEGORIES (comma-separated), DEBUG
 *
 * Throws clear error (no credentials in message) if required vars are missing.
 */
export function loadConfig(): AppConfig {
  const url = process.env.ADGUARD_URL;
  const username = process.env.ADGUARD_USERNAME;
  const password = process.env.ADGUARD_PASSWORD;

  // Validate required vars
  const missing: string[] = [];
  if (!url) missing.push('ADGUARD_URL');
  if (!username) missing.push('ADGUARD_USERNAME');
  if (!password) missing.push('ADGUARD_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Set these variables to connect to your AdGuard Home instance.',
    );
  }

  // Parse access tier
  const tierRaw = process.env.ADGUARD_ACCESS_TIER;
  let accessTier: AccessTier = 'full';
  if (tierRaw) {
    const normalized = tierRaw.toLowerCase().trim();
    if (normalized !== 'read-only' && normalized !== 'full') {
      throw new Error(
        `Invalid ADGUARD_ACCESS_TIER: "${tierRaw}". Must be "read-only" or "full".`,
      );
    }
    accessTier = normalized as AccessTier;
  }

  // Parse categories
  const categoriesRaw = process.env.ADGUARD_CATEGORIES;
  let categories: ToolCategory[] | null = null;
  if (categoriesRaw) {
    const parsed = categoriesRaw
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c.length > 0);

    // Validate each category
    const invalid = parsed.filter(
      (c) => !VALID_CATEGORIES.includes(c as ToolCategory),
    );
    if (invalid.length > 0) {
      throw new Error(
        `Invalid ADGUARD_CATEGORIES: ${invalid.map((c) => `"${c}"`).join(', ')}. ` +
          `Valid categories: ${VALID_CATEGORIES.join(', ')}`,
      );
    }

    categories = parsed as ToolCategory[];
  }

  // Parse debug flag
  const debug = Boolean(process.env.DEBUG);

  // Parse destructive confirmation flag
  const confirmDestructive =
    process.env.ADGUARD_CONFIRM_DESTRUCTIVE?.toLowerCase() === 'true';

  return {
    url: url!.replace(/\/+$/, ''), // Strip trailing slashes
    username: username!,
    password: password!,
    accessTier,
    categories,
    debug,
    confirmDestructive,
  };
}
