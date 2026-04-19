const express = require('express');
const cors = require('cors');
const { connect } = require('puppeteer-real-browser');

const app = express();
app.use(cors());
app.use(express.json());

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
    });
    browser = br;

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
