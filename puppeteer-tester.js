const puppeteer = require('puppeteer');
const path = require('path');

const CHROME_PATH = path.join(
  process.env.HOME,
  '.cache/puppeteer/chrome/mac_arm-136.0.7103.92/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
);

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: CHROME_PATH });
  const page = await browser.newPage();
  try {
    const url = 'https://www.pricecharting.com/game/pokemon-japanese-expansion-pack/charizard-6';
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('Status:', response.status());
    const content = await page.content();
    console.log('Page content (first 1000 chars):\n', content.substring(0, 1000));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await page.close();
    await browser.close();
  }
})();