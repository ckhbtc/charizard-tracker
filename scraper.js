const PRICE_FETCH_TIMEOUT_MS = parseInt(process.env.PRICE_FETCH_TIMEOUT_MS || '15000', 10);

const PRICE_HEADERS = {
  'User-Agent':
    process.env.PRICE_USER_AGENT ||
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

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

function logWithTimestamp(type, message) {
  const now = new Date().toISOString().replace('T', ' ').replace(/\..+/, '') + ' UTC';
  const tag = type === 'success' ? '  OK ' : type === 'check' ? ' RUN ' : type === 'error' ? ' ERR ' : '     ';
  console.log(`[${now}] ${tag} ${message}`);
}

function shortCardName(cardName) {
  if (cardName === 'Charizard Pokemon Japanese Expansion Pack 1996') return 'Japanese 1996';
  return cardName.replace('Charizard Pokemon ', '');
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, '');
}

function parsePrice(value) {
  const price = parseFloat(decodeHtml(stripTags(value)).replace(/[^\d.]/g, ''));
  return Number.isFinite(price) && price > 0 ? price : null;
}

function extractPriceCells(html) {
  const cells = [];
  const pattern = /<span\b[^>]*class=["'][^"']*\bprice\b[^"']*\bjs-price\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    cells.push(decodeHtml(stripTags(match[1])).trim());
  }
  return cells;
}

function extractPricesFromHtml(html, cardName) {
  const results = [];
  const prices = extractPriceCells(html);
  if (prices.length < 6) {
    throw new Error(`only ${prices.length} price cells found, expected >= 6`);
  }

  // Indices 3/4/5 = PSA 9 / 9.5 / 10 in the PriceCharting table.
  for (const [grade, idx] of [
    ['9', 3],
    ['9.5', 4],
    ['10', 5],
  ]) {
    const price = parsePrice(prices[idx]);
    if (price == null) {
      throw new Error(`${cardName} grade ${grade}: bad parse "${prices[idx]}"`);
    }
    results.push({ card_name: cardName, grade, price });
  }
  return results;
}

function buildFetchUrl(url) {
  const proxyBaseUrl = process.env.PRICE_FETCH_BASE_URL;
  if (proxyBaseUrl) {
    const source = new URL(url);
    if (source.hostname !== 'www.pricecharting.com') {
      throw new Error(`unsupported proxied host: ${source.hostname}`);
    }
    return `${proxyBaseUrl.replace(/\/$/, '')}${source.pathname}${source.search}`;
  }

  const prefix = process.env.PRICE_FETCH_PREFIX || '';
  return prefix ? `${prefix}${encodeURIComponent(url)}` : url;
}

async function fetchCardHtml(url, fetchImpl = globalThis.fetch) {
  if (!fetchImpl) {
    throw new Error('global fetch is unavailable; run on Node 18+');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PRICE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(buildFetchUrl(url), {
      headers: PRICE_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    const body = await response.text();
    return { status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPrices(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const results = [];

  for (const card of cards) {
    try {
      const response = await fetchCardHtml(card.url, fetchImpl);
      logWithTimestamp('check', `${shortCardName(card.name)}: ${response.status}`);
      if (response.status !== 200) {
        logWithTimestamp('error', `${shortCardName(card.name)}: upstream ${response.status}`);
        continue;
      }

      results.push(...extractPricesFromHtml(response.body, card.name));
    } catch (err) {
      logWithTimestamp('error', `${shortCardName(card.name)}: ${err.message}`);
    }
  }

  return results;
}

module.exports = {
  fetchPrices,
  cards,
  buildFetchUrl,
  extractPriceCells,
  extractPricesFromHtml,
  parsePrice,
}; 
