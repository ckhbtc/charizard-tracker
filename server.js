const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { initDB, insertPrice, getPriceHistory } = require('./db');
const { fetchPrices, cards } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5000;

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Card images (public domain or placeholder)
const cardImages = {
  'Charizard Pokemon Japanese Expansion Pack 1996': '/images/japanese-expansion-pack-1996.jpg',
  'Charizard Pokemon Base Set 2': '/images/base-set-2.jpg',
  'Charizard Pokemon Base Set': '/images/base-set.jpg',
  'Charizard Pokemon Shadowless': '/images/shadowless.jpg',
  'Charizard Pokemon First Edition': '/images/first-edition.jpg',
};

// Helper function for logging with timestamp and ANSI-colored level tag.
// Falls back to plain text when stdout isn't a TTY (e.g. PM2 file logs).
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

// Helper function to make card names concise for logs
function shortCardName(cardName) {
  if (cardName === 'Charizard Pokemon Japanese Expansion Pack 1996') return 'Japanese 1996';
  return cardName.replace('Charizard Pokemon ', '');
}

// Initialize DB
initDB();

logWithTimestamp('check', 'Cron job scheduled!');
cron.schedule('0 * * * *', async () => {
  try {
    logWithTimestamp('check', 'Running scheduled price scrape...');
    const prices = await fetchPrices();
    prices.forEach(({ card_name, grade, price }) => {
      if (!isNaN(price)) {
        insertPrice(card_name, grade, price);
        logWithTimestamp('success', `${shortCardName(card_name)} ${grade}: ${price}`);
      }
    });
  } catch (err) {
    logWithTimestamp('error', `Scheduled scrape failed: ${err}`);
  }
});

// Run once on startup, but only if the most recent scrape is older than
// STARTUP_SCRAPE_MAX_AGE_MS. Avoids hammering pricecharting on PM2 restarts.
const STARTUP_SCRAPE_MAX_AGE_MS = 30 * 60 * 1000;
(async () => {
  const lastTs = await new Promise(resolve => {
    getPriceHistory(cards[0].name, '10', 1, (err, rows) => {
      if (err || !rows || rows.length === 0) return resolve(null);
      resolve(new Date(rows[0].timestamp + ' UTC').getTime());
    });
  });
  if (lastTs && Date.now() - lastTs < STARTUP_SCRAPE_MAX_AGE_MS) {
    logWithTimestamp('check', `Skipping startup scrape — last run ${Math.round((Date.now() - lastTs)/60000)}m ago.`);
    return;
  }
  const prices = await fetchPrices();
  prices.forEach(({ card_name, grade, price }) => {
    if (!isNaN(price)) {
      insertPrice(card_name, grade, price);
      logWithTimestamp('success', `${shortCardName(card_name)} ${grade}: ${price}`);
    }
  });
})();

// Helper to get chart data for all cards
function getAllCardData(callback, limit) {
  const grades = ['9', '9.5', '10'];
  let results = new Array(cards.length);
  let pending = cards.length;
  cards.forEach((card, idx) => {
    let cardData = {
      name: card.name,
      image: cardImages[card.name] || '/images/placeholder.jpg',
      prices: {},
      history: []
    };
    let gradePending = grades.length;
    let allHistories = {};
    grades.forEach(grade => {
      getPriceHistory(card.name, grade, limit, (err, rows) => {
        if (rows && rows.length > 0) {
          cardData.prices['grade_' + grade.replace('.', '_')] = `$${Math.round(rows[rows.length-1].price).toLocaleString()}`;
          allHistories[grade] = rows.map(r => ({ price: r.price, timestamp: r.timestamp }));
        } else {
          cardData.prices['grade_' + grade.replace('.', '_')] = 'N/A';
          allHistories[grade] = [];
        }
        gradePending--;
        if (gradePending === 0) {
          cardData.history9 = allHistories['9'];
          cardData.history95 = allHistories['9.5'];
          cardData.history10 = allHistories['10'];
          results[idx] = cardData;
          pending--;
          if (pending === 0) callback(results);
        }
      });
    });
  });
}

app.get('/', (req, res) => {
  // Get time horizon from query (?range=1w|1m|3m|6m|1y|max)
  const rangeMap = { '1w': 24*7, '1m': 24*30, '3m': 24*90, '6m': 24*180, '1y': 24*365, 'max': 999999 };
  const range = req.query.range || '1m';
  const limit = rangeMap[range] || 24*30;

  getAllCardData(cards => {
    // lastUpdated = max timestamp across all series we already loaded
    let lastUpdated = null;
    cards.forEach(card => {
      ['history9', 'history95', 'history10'].forEach(key => {
        const rows = card[key];
        if (rows && rows.length > 0) {
          const ts = rows[rows.length - 1].timestamp;
          if (!lastUpdated || ts > lastUpdated) lastUpdated = ts;
        }
      });
    });
    res.render('index', { cards, range, lastUpdated });
  }, limit);
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.listen(PORT, () => {
  logWithTimestamp('success', `Server running on http://localhost:${PORT}`);
}); 