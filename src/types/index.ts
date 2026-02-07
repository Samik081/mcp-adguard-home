/**
 * Access tier for tool registration.
 * 'read-only' - only read tools are available
 * 'full' - all tools (read + write) are available
 */
export type AccessTier = 'read-only' | 'full';

/**
 * Tool categories matching AdGuard Home API domains.
 */
export type ToolCategory =
  | 'global'
  | 'dns'
  | 'querylog'
  | 'stats'
  | 'filtering'
  | 'safebrowsing'
  | 'parental'
  | 'safesearch'
  | 'clients'
  | 'dhcp'
  | 'rewrites'
  | 'tls'
  | 'blocked_services'
  | 'access'
  | 'install'
  | 'mobile_config';

/**
 * All valid tool categories for validation.
 */
export const VALID_CATEGORIES: ToolCategory[] = [
  'global',
  'dns',
  'querylog',
  'stats',
  'filtering',
  'safebrowsing',
  'parental',
  'safesearch',
  'clients',
  'dhcp',
  'rewrites',
  'tls',
  'blocked_services',
  'access',
  'install',
  'mobile_config',
];

/**
 * Application configuration parsed from environment variables.
 */
export interface AppConfig {
  url: string;
  username: string;
  password: string;
  accessTier: AccessTier;
  categories: ToolCategory[] | null;
  debug: boolean;
  confirmDestructive: boolean;
}

/**
 * Tool registration descriptor passed to registerTool().
 * accessTier indicates the minimum tier needed:
 *   'read-only' = available in both read-only and full modes
 *   'full' = only available in full mode (write operations)
 */
export interface ToolRegistration {
  name: string;
  description: string;
  category: ToolCategory;
  accessTier: AccessTier;
  annotations?: import('@modelcontextprotocol/sdk/types.js').ToolAnnotations;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string>;
}
