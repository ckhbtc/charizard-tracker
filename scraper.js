const puppeteer = require('puppeteer');

// Helper function for logging with timestamp and ANSI-colored level tag.
const ANSI = process.stdout.isTTY ? {
  reset: '\x1b[0m', dim: '\x1b[2m',
  green: '\x1b[32m', cyan: '\x1b[36m', red: '\x1b[31m'
} : { reset: '', dim: '', green: '', cyan: '', red: '' };
function logWithTimestamp(type, message) {
  const now = new Date().toISOString().replace('T', ' ').replace(/\..+/, '') + ' UTC';
  let tag = '     ';
  if (type === 'success')      tag = `${ANSI.green}  OK ${ANSI.reset}`;
  else if (type === 'check')   tag = `${ANSI.cyan} RUN ${ANSI.reset}`;
  else if (type === 'error')   tag = `${ANSI.red} ERR ${ANSI.reset}`;
  console.log(`${ANSI.dim}[${now}]${ANSI.reset} ${tag} ${message}`);
}

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
          // Indices 3/4/5 = PSA 9 / 9.5 / 10. If pricecharting reshuffles its
          // table this will silently break — sanity-check each value before pushing.
          [['9', 3], ['9.5', 4], ['10', 5]].forEach(([grade, idx]) => {
            const price = parseFloat(prices[idx].replace(/[^\d.]/g, ''));
            if (Number.isFinite(price) && price > 0) {
              results.push({ card_name: card.name, grade, price });
            } else {
              logWithTimestamp('error', `${card.name} grade ${grade}: bad parse "${prices[idx]}"`);
            }
          });
        } else {
          logWithTimestamp('error', `${card.name}: only ${prices.length} price cells found, expected >= 6`);
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