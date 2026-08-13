const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildBrightDataRequest,
  buildFetchUrl,
  extractPriceCells,
  extractPricesFromHtml,
  fetchPrices,
  fetchCardHtml,
  parsePrice,
} = require('../scraper');

function withEnv(values, fn) {
  const before = {};
  for (const [key, value] of Object.entries(values)) {
    before[key] = process.env[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(before)) {
        if (value == null) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

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

test('buildFetchUrl can route PriceCharting requests through a proxy base', async () => {
  await withEnv({ PRICE_FETCH_BASE_URL: 'http://proxy.example/pc-proxy/' }, () => {
    assert.equal(
      buildFetchUrl('https://www.pricecharting.com/game/pokemon-base-set/charizard-4'),
      'http://proxy.example/pc-proxy/game/pokemon-base-set/charizard-4'
    );
  });
});

test('buildBrightDataRequest requires a zone when an API key is configured', async () => {
  await withEnv({ BRIGHT_DATA_API_KEY: 'test-key', BRIGHT_DATA_ZONE: null }, () => {
    assert.throws(
      () => buildBrightDataRequest('https://www.pricecharting.com/game/pokemon-base-set/charizard-4'),
      /BRIGHT_DATA_ZONE is required/
    );
  });
});

test('fetchCardHtml sends PriceCharting through Bright Data Web Unlocker', async () => {
  await withEnv(
    {
      BRIGHT_DATA_API_KEY: 'test-key',
      BRIGHT_DATA_ZONE: 'test-zone',
      PRICE_FETCH_BASE_URL: 'http://legacy-proxy.example/pc-proxy',
    },
    async () => {
      const calls = [];
      const fetchImpl = async (url, options) => {
        calls.push({ url, options });
        return { status: 200, text: async () => '<html>unlocked</html>' };
      };

      const target = 'https://www.pricecharting.com/game/pokemon-base-set/charizard-4';
      const response = await fetchCardHtml(target, fetchImpl);

      assert.deepEqual(response, { status: 200, body: '<html>unlocked</html>' });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://api.brightdata.com/request');
      assert.equal(calls[0].options.method, 'POST');
      assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
      assert.deepEqual(JSON.parse(calls[0].options.body), {
        zone: 'test-zone',
        url: target,
        format: 'raw',
      });
    }
  );
});
