const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildFetchUrl,
  extractPriceCells,
  extractPricesFromHtml,
  fetchPrices,
  parsePrice,
} = require('../scraper');

function htmlWithPrices(values) {
  return values
    .map((value) => `<span class="price js-price">${value}</span>`)
    .join('\n');
}

test('parsePrice accepts formatted currency values', () => {
  assert.equal(parsePrice('$1,234.56'), 1234.56);
  assert.equal(parsePrice('<strong>$9,999</strong>'), 9999);
  assert.equal(parsePrice('N/A'), null);
});

test('extractPriceCells returns PriceCharting price cells in order', () => {
  const cells = extractPriceCells(htmlWithPrices(['$1', '$2', '$3']));
  assert.deepEqual(cells, ['$1', '$2', '$3']);
});

test('extractPricesFromHtml maps PSA grade cells to price records', () => {
  const prices = extractPricesFromHtml(
    htmlWithPrices(['$10', '$20', '$30', '$900', '$950', '$1,000']),
    'Charizard Pokemon Base Set'
  );

  assert.deepEqual(prices, [
    { card_name: 'Charizard Pokemon Base Set', grade: '9', price: 900 },
    { card_name: 'Charizard Pokemon Base Set', grade: '9.5', price: 950 },
    { card_name: 'Charizard Pokemon Base Set', grade: '10', price: 1000 },
  ]);
});

test('fetchPrices records no prices when upstream blocks every card', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return {
      status: 403,
      text: async () => '<html><title>Just a moment...</title></html>',
    };
  };

  const prices = await fetchPrices({ fetchImpl });
  assert.equal(prices.length, 0);
  assert.equal(calls.length, 5);
});

test('buildFetchUrl can route PriceCharting requests through a proxy base', () => {
  process.env.PRICE_FETCH_BASE_URL = 'http://13.135.99.176/pc-proxy/';
  try {
    assert.equal(
      buildFetchUrl('https://www.pricecharting.com/game/pokemon-base-set/charizard-4'),
      'http://13.135.99.176/pc-proxy/game/pokemon-base-set/charizard-4'
    );
  } finally {
    delete process.env.PRICE_FETCH_BASE_URL;
  }
});
