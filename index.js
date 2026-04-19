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
const PROXY_URL = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;

app.post('/test-login', async (req, res) => {
  const { email, password, platform } = req.body;
  if (!email || !password || !platform) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  let browser;
  try {
    const loginUrl = `https://${platform}.io/login.php`;

    // Lancer Puppeteer avec le proxy
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--proxy-server=${PROXY_HOST}:${PROXY_PORT}`
      ]
    });

    const page = await browser.newPage();

    // Authentification au proxy
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });

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
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
