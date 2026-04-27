/**
 * Portfolio Backend
 * Express + MongoDB contact API for Vercel and local development.
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const { handleContact, handleHealth, json } = require('./lib/contact-service');

const app = express();
const PORT = process.env.PORT || 5000;
const publicDir = path.join(__dirname, 'public');
const indexFile = path.join(publicDir, 'index.html');

app.disable('x-powered-by');
app.use(express.static(publicDir));

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

app.all('/api/contact', asyncRoute(handleContact));
app.all('/api/health', asyncRoute(handleHealth));

app.use('/api', (req, res) => {
  json(res, 404, { error: 'API route not found.' });
});

app.get('*', (req, res) => {
  res.sendFile(indexFile, err => {
    if (err) {
      json(res, 404, {
        error: 'Portfolio page not found. Make sure public/index.html is deployed.'
      });
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (req.path.startsWith('/api')) {
    json(res, 500, { error: 'Internal server error. Please try again later.' });
    return;
  }

  res.status(500).send('Portfolio server error. Check the deployment files.');
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Portfolio server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
