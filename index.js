const express = require('express');
const cors = require('cors');
const { connect } = require('puppeteer-real-browser');

const app = express();
app.use(cors());
app.use(express.json());

const delay = ms => new Promise(r => setTimeout(r, ms));

app.post('/test-login', async (req, res) => {
  const { email, password, platform, proxyUrl } = req.body;
  if (!email || !password || !platform) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  let browser;
  try {
    const loginUrl = `https://${platform}.io/login.php`;
    const args = proxyUrl ? [`--proxy-server=${proxyUrl}`] : [];
    const { browser: br, page } = await connect({
      headless: true,
      turnstile: true,
      args: args
    });
    browser = br;

    if (proxyUrl && proxyUrl.includes('@')) {
      const match = proxyUrl.match(/^http:\/\/([^:]+):([^@]+)@(.+)$/);
      if (match) await page.authenticate({ username: match[1], password: match[2] });
    }

    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('input[type="email"], input[name="email"]', email);
    await page.type('input[type="password"]', password);
    await delay(1000);

    // Attendre que le Turnstile soit présent (si iframe)
    try {
      await page.waitForSelector('iframe[src*="challenges.cloudflare.com"]', { timeout: 10000 });
      console.log('Turnstile iframe trouvé, attente manuelle...');
      await delay(8000); // laisser le temps à l'utilisateur ou au solver automatique
    } catch (e) {
      console.log('Pas de iframe Turnstile détecté');
    }

    // Clic sur le bouton Log in
    const loginClicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const btn = btns.find(b => b.textContent.trim() === 'Log in');
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!loginClicked) throw new Error('Bouton Log in introuvable');

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
    if (browser) await browser.close().catch(() => {});
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
