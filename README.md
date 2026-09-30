# Steam News Discord

A small Node.js service that checks Steam app news and posts new announcements to a Discord webhook.

## Requirements

- Node.js 18.17 or newer
- A Discord webhook URL
- Steam application IDs

## Installation

```bash
git clone https://github.com/callmepeterz/SteamNewsDiscord
cd SteamNewsDiscord
npm install
```

## Configuration

Create a `.env` file in the project root:

```env
WEBHOOK_URL=https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
STEAM_APP_ID=["1973530","570"]
INTERVAL=300000
TIMEOUT=10000
NEWS_COUNT=5
```

| Variable | Description |
|---|---|
| `WEBHOOK_URL` | Discord webhook URL |
| `STEAM_APP_ID` | JSON array containing Steam app IDs |
| `INTERVAL` | Time between checks in milliseconds |
| `TIMEOUT` | Steam API request timeout in milliseconds |
| `NEWS_COUNT` | Number of news items to fetch per interval |

Do not commit `.env` to source control.

## Running

```bash
node `index.js`
```

The service checks each configured Steam app sequentially. When it finds a news item that has not already been recorded, it posts the item to Discord and saves its ID and date to `data.json`.

## Persistent State

`data.json` stores the latest posted news item for each Steam app. This prevents the same announcement from being posted repeatedly after a restart.

Example:

```json
{
    "1973530": {
        "gid": "1844751498233219",
        "date": 1790661575
    }
}
```

If you want to reset the posting history, stop the service and delete `data.json`.

## Logging

The service logs:

- Newly detected news items
- Request failures
- Discord webhook failures
- Timeout errors
- Non-successful Steam API responses

## License

This project is licensed under the MIT License.