const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/test-login', (req, res) => {
  const { email, password, platform } = req.body;
  console.log('✅ Requête reçue par le mode test !', { email, platform });
  res.json({ success: false, error: 'Test API OK (mode sans navigateur)' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API test running on port ${PORT}`));
