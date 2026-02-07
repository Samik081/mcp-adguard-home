[![npm version](https://img.shields.io/npm/v/@samik081/mcp-adguard-home)](https://www.npmjs.com/package/@samik081/mcp-adguard-home)
[![License: MIT](https://img.shields.io/npm/l/@samik081/mcp-adguard-home)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@samik081/mcp-adguard-home)](https://nodejs.org)

# MCP AdGuard Home

MCP server for [AdGuard Home](https://adguard.com/pl/adguard-home/overview.html). Manage DNS filtering, clients, DHCP, rewrites, and more through natural language in Cursor, Claude Code, and Claude Desktop.

## Features

- **65 tools** across **16 API categories** covering the complete AdGuard Home API
- **Read-only mode** via `ADGUARD_ACCESS_TIER=read-only` for safe monitoring
- **Category filtering** via `ADGUARD_CATEGORIES` to expose only the tools you need
- **Destructive operation guard** with optional confirmation for reset/delete operations
- **Zero HTTP dependencies** -- uses native `fetch` (Node.js 18+)
- **TypeScript/ESM** with full type safety

## Quick Start

Run the server directly with npx:

```bash
ADGUARD_URL="http://your-adguard-ip:3000" \
ADGUARD_USERNAME="your-username" \
ADGUARD_PASSWORD="your-password" \
npx -y @samik081/mcp-adguard-home
```

The server validates your AdGuard Home connection on startup and fails immediately with a clear error if credentials are missing or invalid.

## Configuration

**Claude Code CLI (recommended):**

```bash
claude mcp add --transport stdio adguard-home \
  --env ADGUARD_URL=http://your-adguard-ip:3000 \
  --env ADGUARD_USERNAME=your-username \
  --env ADGUARD_PASSWORD=your-password \
  -- npx -y @samik081/mcp-adguard-home
```

**JSON config** (works with Claude Code `.mcp.json`, Claude Desktop `claude_desktop_config.json`, Cursor `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "adguard-home": {
      "command": "npx",
      "args": ["-y", "@samik081/mcp-adguard-home"],
      "env": {
        "ADGUARD_URL": "http://your-adguard-ip:3000",
        "ADGUARD_USERNAME": "your-username",
        "ADGUARD_PASSWORD": "your-password"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADGUARD_URL` | Yes | -- | AdGuard Home base URL (e.g., `http://192.168.1.1:3000`) |
| `ADGUARD_USERNAME` | Yes | -- | Admin username |
| `ADGUARD_PASSWORD` | Yes | -- | Admin password |
| `ADGUARD_ACCESS_TIER` | No | `full` | `read-only` for read-only tools only, `full` for all tools |
| `ADGUARD_CATEGORIES` | No | *(all)* | Comma-separated category allowlist (e.g., `dns,filtering,stats`) |
| `ADGUARD_CONFIRM_DESTRUCTIVE` | No | `false` | Require `confirm: true` parameter for destructive operations |
| `DEBUG` | No | `false` | Enable debug logging to stderr |

### Available Categories

`global`, `dns`, `querylog`, `stats`, `filtering`, `safebrowsing`, `parental`, `safesearch`, `clients`, `dhcp`, `rewrites`, `tls`, `blocked_services`, `access`, `install`, `mobile_config`

## Tools

<details>
<summary>Global (6 tools)</summary>

| Tool | Description |
|------|-------------|
| `global_get_status` | Retrieve server status including version, DNS addresses, protection state, and ports |
| `global_get_profile` | Retrieve user profile (name, language, theme) |
| `global_check_version` | Check for AdGuard Home updates and compare with current version |
| `global_set_protection` | Enable or disable DNS protection globally, with optional duration for temporary disable |
| `global_update_profile` | Update user profile settings (name, language, theme) |
| `global_begin_update` | Initiate an AdGuard Home software update |

</details>

<details>
<summary>DNS (4 tools)</summary>

| Tool | Description |
|------|-------------|
| `dns_get_info` | Retrieve full DNS configuration including upstreams, cache settings, blocking mode, and DNSSEC |
| `dns_test_upstream` | Test upstream DNS server configuration to verify servers are reachable |
| `dns_set_config` | Update DNS server configuration (19 optional fields for partial update) |
| `dns_clear_cache` | Clear the DNS resolver cache |

</details>

<details>
<summary>Query Log (4 tools)</summary>

| Tool | Description |
|------|-------------|
| `querylog_get` | Search DNS query log with optional filtering by response status, search term, and pagination |
| `querylog_get_config` | Retrieve query log configuration settings |
| `querylog_set_config` | Update query log configuration (enabled, interval, anonymization) |
| `querylog_clear` | Clear the entire DNS query log |

</details>

<details>
<summary>Statistics (4 tools)</summary>

| Tool | Description |
|------|-------------|
| `stats_get` | Retrieve DNS statistics including top domains, blocked counts, and client activity |
| `stats_get_config` | Retrieve statistics configuration settings |
| `stats_reset` | Reset all DNS statistics |
| `stats_set_config` | Update statistics configuration (enabled, interval, ignored domains) |

</details>

<details>
<summary>Filtering (8 tools)</summary>

| Tool | Description |
|------|-------------|
| `filtering_get_status` | Retrieve filtering configuration including blocklists, allowlists, and user rules |
| `filtering_check_host` | Test whether a hostname would be blocked by current filtering rules |
| `filtering_set_config` | Update global filtering configuration (enabled state and update interval) |
| `filtering_add_url` | Add a new filter URL (blocklist or allowlist) |
| `filtering_remove_url` | Remove a filter URL from blocklist or allowlist |
| `filtering_set_url` | Update an existing filter URL (rename, change URL, or enable/disable) |
| `filtering_refresh` | Force refresh of filter lists to fetch latest updates |
| `filtering_set_rules` | Set custom filtering rules (replaces all existing custom rules) |

</details>

<details>
<summary>Safe Browsing (2 tools)</summary>

| Tool | Description |
|------|-------------|
| `safebrowsing_get_status` | Retrieve safe browsing (malware/phishing protection) status |
| `safebrowsing_set` | Enable or disable safe browsing protection |

</details>

<details>
<summary>Parental (2 tools)</summary>

| Tool | Description |
|------|-------------|
| `parental_get_status` | Retrieve parental filtering status |
| `parental_set` | Enable or disable parental filtering (content restrictions) |

</details>

<details>
<summary>Safe Search (2 tools)</summary>

| Tool | Description |
|------|-------------|
| `safesearch_get_status` | Retrieve safe search settings showing per-engine enforcement status |
| `safesearch_set_settings` | Update safe search settings with per-engine configuration (Bing, DuckDuckGo, Google, Pixabay, Yandex, YouTube) |

</details>

<details>
<summary>Clients (5 tools)</summary>

| Tool | Description |
|------|-------------|
| `clients_get` | Retrieve all configured and auto-detected clients with their settings |
| `clients_search` | Search for specific clients by their IDs (IP, MAC, CIDR, or client ID) |
| `clients_add` | Add a new persistent client with per-client settings |
| `clients_update` | Update an existing persistent client by name |
| `clients_delete` | Delete a persistent client by name |

</details>

<details>
<summary>DHCP (9 tools)</summary>

| Tool | Description |
|------|-------------|
| `dhcp_get_status` | Retrieve DHCP server configuration, static leases, and active leases |
| `dhcp_get_interfaces` | Retrieve available network interfaces for DHCP server binding |
| `dhcp_find_active` | Scan for competing DHCP servers on a network interface |
| `dhcp_set_config` | Update DHCP server configuration (enabled state, interface, IPv4/IPv6 settings) |
| `dhcp_add_static_lease` | Add a static DHCP lease mapping a MAC address to an IP |
| `dhcp_remove_static_lease` | Remove a static DHCP lease |
| `dhcp_update_static_lease` | Update a static DHCP lease (remove + add pattern) |
| `dhcp_reset` | Reset DHCP configuration to defaults |
| `dhcp_reset_leases` | Clear all DHCP leases |

</details>

<details>
<summary>Rewrites (6 tools)</summary>

| Tool | Description |
|------|-------------|
| `rewrites_list` | Retrieve all configured DNS rewrite rules |
| `rewrites_get_settings` | Retrieve DNS rewrite module enabled/disabled state |
| `rewrites_add` | Add a new DNS rewrite rule |
| `rewrites_update` | Update a DNS rewrite rule (remove + add pattern) |
| `rewrites_delete` | Delete a DNS rewrite rule |
| `rewrites_set_settings` | Enable or disable the DNS rewrite module |

</details>

<details>
<summary>TLS (3 tools)</summary>

| Tool | Description |
|------|-------------|
| `tls_get_status` | Retrieve TLS configuration and certificate validation status |
| `tls_validate` | Validate TLS configuration without applying changes |
| `tls_set_config` | Update TLS configuration including certificates and HTTPS/DoH/DoT settings |

</details>

<details>
<summary>Blocked Services (3 tools)</summary>

| Tool | Description |
|------|-------------|
| `blocked_services_get_all` | List all available services that can be blocked, organized by group |
| `blocked_services_get` | Retrieve currently blocked services list and schedule |
| `blocked_services_update` | Update the list of blocked services and optional schedule |

</details>

<details>
<summary>Access (2 tools)</summary>

| Tool | Description |
|------|-------------|
| `access_get_list` | Retrieve access control lists: allowed clients, disallowed clients, and blocked hosts |
| `access_set_list` | Set access control lists for allowed clients, disallowed clients, and blocked hosts |

</details>

<details>
<summary>Install (3 tools)</summary>

| Tool | Description |
|------|-------------|
| `install_get_addresses` | Retrieve network interface details and ports for initial setup |
| `install_check_config` | Validate install configuration without applying (checks web/DNS binding, credentials) |
| `install_apply_config` | Apply initial setup configuration (web/DNS binding and admin credentials) |

</details>

<details>
<summary>Mobile Config (2 tools)</summary>

| Tool | Description |
|------|-------------|
| `mobile_config_get_doh` | Generate Apple .mobileconfig profile for DNS-over-HTTPS |
| `mobile_config_get_dot` | Generate Apple .mobileconfig profile for DNS-over-TLS |

</details>

## Verify It Works

After configuring your MCP client, ask your AI assistant:

> "What's my AdGuard Home server status?"

If the connection is working, the assistant will call `global_get_status` and return your server version, DNS addresses, protection state, and port configuration.

## Usage Examples

- **"What's the current DNS protection status?"** -- calls `global_get_status` to show version, addresses, and protection state.
- **"Show me all DNS rewrite rules"** -- calls `rewrites_list` to display all configured DNS rewrites.
- **"Add a DNS rewrite for local.example.com pointing to 192.168.1.100"** -- calls `rewrites_add` to create a new rewrite rule.

## Troubleshooting

### Connection errors

- Verify `ADGUARD_URL` is reachable from the machine running the MCP server
- Ensure the URL includes the port if non-standard (e.g., `http://192.168.1.1:3000`)
- Check that AdGuard Home is running and accessible

### Authentication failures

- Verify `ADGUARD_USERNAME` and `ADGUARD_PASSWORD` are correct
- Check that the user has admin privileges in AdGuard Home

### Tools not showing up

- Check your `ADGUARD_ACCESS_TIER` setting -- `read-only` mode only exposes read tools
- Check `ADGUARD_CATEGORIES` -- only tools in listed categories are registered
- Verify the server started without errors by checking stderr output

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode (auto-reload)
npm run dev

# Open the MCP Inspector for interactive testing
npm run inspect
```

## License

[MIT](LICENSE)
