const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());
app.use(express.json());

// Configuration du proxy
const PROXY_HOST = '23.26.71.145';
const PROXY_PORT = '5628';
const PROXY_USER = 'Finoana123';
const PROXY_PASS = 'Finoana123';

app.post('/test-login', async (req, res) => {
  const { email, password, platform } = req.body;
  if (!email || !password || !platform) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  let browser;
  try {
    const loginUrl = `https://${platform}.io/login.php`;

    // Lancer Puppeteer avec le proxy (sans authentification dans l'URL)
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--proxy-server=${PROXY_HOST}:${PROXY_PORT}`,
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      // Augmenter le timeout pour le démarrage
      timeout: 60000
    });

    const page = await browser.newPage();

    // Authentification au proxy (doit être faite avant toute navigation)
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });

    // Tester que le proxy fonctionne (optionnel)
    try {
      await page.goto('https://api.ipify.org?format=json', { timeout: 10000 });
      const body = await page.evaluate(() => document.body.textContent);
      const ip = JSON.parse(body).ip;
      console.log(`🌍 IP via proxy : ${ip}`);
    } catch (e) {
      console.warn('Proxy test failed, continuing anyway...');
    }

    // User-agent réaliste
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });

    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('input[type="email"], input[name="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button:contains("Log in")');
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});

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
    // Renvoyer l'erreur complète pour le débogage
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
