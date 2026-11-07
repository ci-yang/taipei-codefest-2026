// Run with NODE_PATH pointing at an installed Playwright package, and the prototype server running.
import { createRequire } from 'node:module';
const loadDependency = createRequire(import.meta.url);
const { chromium } = loadDependency('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const results = [];
  for (const [width, height] of [[320,568],[390,844],[430,932],[768,1024],[844,390]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(process.env.PROTOTYPE_URL || 'http://127.0.0.1:8883');
    await page.locator('#enter-app').click();
    await page.waitForTimeout(300);
    results.push(await page.evaluate(() => {
      const description = document.querySelector('#mode-description');
      return { width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth-innerWidth,
        focus: document.activeElement.id, focusVisible: document.activeElement.matches(':focus-visible'),
        outline: getComputedStyle(document.activeElement).outline,
        startWidth: document.querySelector('#start-guidance').getBoundingClientRect().width,
        descriptionLines: description.getBoundingClientRect().height / parseFloat(getComputedStyle(description).lineHeight),
        mapHeight: document.querySelector('#map').getBoundingClientRect().height };
    }));
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
