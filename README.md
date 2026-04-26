# charizard-tracker

A small dashboard that tracks PSA-graded prices for five iconic Charizard cards, scraped hourly and rendered as interactive Chart.js timelines.

![dock UI with five Charizard cards and price sparklines](public/images/base-set.jpg)

## What it tracks

Five cards × three PSA grades (9 / 9.5 / 10):

- Japanese Expansion Pack 1996
- Base Set
- Base Set 2
- Shadowless
- 1st Edition

Each card has its own dock card with current prices and a sparkline; clicking opens a detail panel with a stacked line chart and time-range selector (1W / 1M / 3M / 6M / 1Y / MAX).

## Stack

- Node.js + Express
- EJS for server-rendered HTML
- SQLite (`sqlite3`) for storage
- Puppeteer for scraping
- `node-cron` for the hourly schedule
- Chart.js on the client

No build step, no framework, no bundler.

## Run locally

```sh
npm install
node server.js
# → http://localhost:5000
```

The server initializes `prices.db` if it doesn't exist, kicks off one scrape on startup, and then scrapes every hour on the hour.

## How it works

1. `scraper.js` opens each card's pricecharting.com page in headless Chrome and reads the PSA 9 / 9.5 / 10 prices off the page.
2. `server.js` schedules the scrape and writes results to `prices.db` via `db.js`.
3. The `/` route fetches each card's price history (filtered by `?range=1w|1m|3m|6m|1y|max`) and renders `views/index.ejs`, which builds the dock + detail chart on the client.

## Files

| File | What it does |
| --- | --- |
| `server.js` | Express app, cron schedule, route handlers |
| `scraper.js` | Puppeteer scrape logic, card list |
| `db.js` | sqlite3 helpers (`initDB`, `insertPrice`, `getPriceHistory`) |
| `views/index.ejs` | Single-page UI |
| `public/css/style.css` | Dark theme + glassmorphism |
| `public/images/` | Card thumbnails + background |

## Notes

The price database is not committed — scraped pricing data from pricecharting.com belongs to them. Run the app for an hour or two and you'll have your own.

## License

[ISC](LICENSE)
