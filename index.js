const express = require('express');
const cors = require('cors');
const { connect } = require('puppeteer-real-browser');

const app = express();
app.use(cors());
app.use(express.json());

const delay = ms => new Promise(r => setTimeout(r, ms));

app.post('/test-login', async (req, res) => {
  const { email, password, platform } = req.body;
  if (!email || !password || !platform) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  let browser;
  try {
    const loginUrl = `https://${platform}.io/login.php`;
    const { browser: br, page } = await connect({
      headless: true,
      turnstile: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    browser = br;

    // Masquer webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      delete navigator.__proto__.webdriver;
    });

    // User-Agent réaliste (Windows + Chrome)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });

    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    await page.type('input[type="email"], input[name="email"]', email, { delay: 50 });
    await page.type('input[type="password"]', password, { delay: 50 });
    await delay(1000);

    // Gestion Turnstile : attendre que l'iframe soit résolu (puppeteer-real-browser le fait)
    try {
      await page.waitForFunction(() => {
        const iframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
        return !iframe || iframe.style.display === 'none';
      }, { timeout: 15000 });
    } catch (e) {
      console.log('Pas de Turnstile ou déjà passé');
    }

    await page.click('button:contains("Log in")');
    await page.waitForNavigation({ timeout: 20000 }).catch(() => {});
    await delay(3000);

    const success = !page.url().includes('login.php');
    const cookies = success ? await page.cookies() : [];
    const error = success ? null : await page.evaluate(() => {
      const el = document.querySelector('.alert-danger, .error');
      return el ? el.innerText : 'Login failed';
    });

    await browser.close();
    res.json({ success, cookies, error });
  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
