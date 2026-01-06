const puppeteer = require('puppeteer');
const path = require('path');
const cron = require('node-cron');

// Helper function for logging with timestamp and emoji
function logWithTimestamp(type, message) {
  const now = new Date().toISOString().replace('T', ' ').replace(/\..+/, '') + ' UTC';
  let emoji = '';
  if (type === 'success') emoji = '✅';
  else if (type === 'check') emoji = '🔍';
  else if (type === 'error') emoji = '❌';
  console.log(`[${now}] ${emoji} ${message}`);
}

const CHROME_PATH = path.join(
  process.env.HOME,
  '.cache/puppeteer/chrome/mac_arm-136.0.7103.92/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
);

const cards = [
  {
    name: 'Charizard Pokemon Japanese Expansion Pack 1996',
    url: 'https://www.pricecharting.com/game/pokemon-japanese-expansion-pack/charizard-6',
  },
  {
    name: 'Charizard Pokemon Base Set 2',
    url: 'https://www.pricecharting.com/game/pokemon-base-set-2/charizard-4',
  },
  {
    name: 'Charizard Pokemon Base Set',
    url: 'https://www.pricecharting.com/game/pokemon-base-set/charizard-4',
  },
  {
    name: 'Charizard Pokemon Shadowless',
    url: 'https://www.pricecharting.com/game/pokemon-base-set/charizard-shadowless-4',
  },
  {
    name: 'Charizard Pokemon First Edition',
    url: 'https://www.pricecharting.com/game/pokemon-base-set/charizard-1st-edition-4',
  },
];

async function fetchPrices() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const results = [];
  for (const card of cards) {
    const page = await browser.newPage();
    try {
      const response = await page.goto(card.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const status = response.status();
      let shortName = card.name.replace('Charizard Pokemon ', '');
      if (card.name === 'Charizard Pokemon Japanese Expansion Pack 1996') {
        shortName = 'Japanese 1996';
      }
      logWithTimestamp('check', `${shortName}: ${status}`);
      if (status === 200) {
        await page.waitForSelector('span.price.js-price', { timeout: 10000 });
        const prices = await page.$$eval('span.price.js-price', els => els.map(e => e.textContent.trim()));
        if (prices.length >= 6) {
          results.push({
            card_name: card.name,
            grade: '9',
            price: parseFloat(prices[3].replace(/[^\d.]/g, ''))
          });
          results.push({
            card_name: card.name,
            grade: '9.5',
            price: parseFloat(prices[4].replace(/[^\d.]/g, ''))
          });
          results.push({
            card_name: card.name,
            grade: '10',
            price: parseFloat(prices[5].replace(/[^\d.]/g, ''))
          });
        }
      }
    } catch (err) {
      console.error(`Error fetching ${card.name}:`, err.message);
    } finally {
      await page.close();
    }
  }
  await browser.close();
  return results;
}

module.exports = {
  fetchPrices,
  cards
}; 