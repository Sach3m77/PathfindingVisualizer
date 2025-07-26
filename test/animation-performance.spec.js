const { chromium, firefox, webkit } = require('playwright');

const browsersToTest = [
  { name: 'Chromium', launcher: chromium },
  { name: 'Firefox', launcher: firefox },
  { name: 'WebKit', launcher: webkit },
];

const TEST_RUNS = 5;

(async () => {
  for (const { name, launcher } of browsersToTest) {
    console.log(`\n=== Test wydajności dla ${name} ===`);
    const durations = [];

    const browser = await launcher.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5000');
    await page.waitForLoadState('domcontentloaded', {timeout: 5000});  
    await page.click('#toggleSidebar');
    await page.waitForSelector('#sidebar.active', { timeout: 1000 });
    await page.click('#loadGraphButton');
    await page.waitForSelector('#loadingOverlay', { state: 'hidden', 
      timeout: 30000 });
    await page.mouse.click(700, 300, { button: 'left' });
    await page.waitForSelector('#sidebar:not(.active)', { timeout: 3000 });
    await page.mouse.click(388, 128, { button: 'left' });
    await page.waitForSelector('#toast', { state: 'visible', timeout: 3000 });
    await page.mouse.click(1191, 514, { button: 'right' });
    await page.waitForSelector('#toast', { state: 'visible', timeout: 3000 });
    await page.click('#toggleSidebar');
    await page.waitForSelector('#sidebar.active', { timeout: 1000 });
    await page.uncheck('#showGraph');
    await page.waitForSelector('#showGraph:not(:checked)', { timeout: 3000 });

    for (let i = 0; i < TEST_RUNS; i++) {
      console.log(`\nIteracja ${i + 1}`);

      const startTime = Date.now();
      await page.click('#startButton');
      await page.waitForSelector('#loadGraphButton:not([disabled])', 
        { timeout: 90000 });
      const duration = Date.now() - startTime;

      await page.click('#resetButton');
      await page.waitForSelector('#startButton:not([disabled])', 
        { timeout: 3000 });
      console.log(`Czas trwania: ${duration} ms`);
      durations.push(duration);
    }
    await browser.close();
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    console.log(`\nStatystyki dla ${name}:`);
    console.log(`Min: ${min} ms`);
    console.log(`Avg: ${avg.toFixed(2)} ms`);
    console.log(`Max: ${max} ms`);
  }
})();