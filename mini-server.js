const { fetchPrices, cards } = require('./scraper');
console.log('Loaded cards:', cards);

(async () => {
  const prices = await fetchPrices();
  console.log('Prices:', prices);
})();