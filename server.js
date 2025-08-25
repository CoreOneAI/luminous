// server.js — All‑in‑one (Frontend + API) for Render
// Serves static files from /public and exposes booking + Stripe-ready API.
// Uses a permissive CSP to accommodate inline CSS/JS in index.html for now.
// Later, move inline CSS/JS to external files and tighten the CSP.

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`; // used for Stripe redirects
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const app = express();

// --- Security headers (permissive until we externalize inline CSS/JS) ---
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://images.unsplash.com",
    "connect-src 'self'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests"
  ].join('; '));
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(express.json());

// --- Serve static frontend ---
const staticDir = path.join(__dirname, 'public');
app.get('/favicon.ico', (req, res) => res.redirect(302, '/favicon.svg'));
app.use(express.static(staticDir, {
  setHeaders(res, filePath) {
    // Cache static assets; avoid caching HTML
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Root page (200 OK) to help verify headers
app.get('/', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// --- In-memory bookings store ---
const bookings = new Map();

app.get('/healthz', (_, res) => res.json({ ok: true }));

app.post('/api/bookings/create', (req, res) => {
  try {
    const { service, style, price, datetimeISO, notes } = req.body || {};
    if (!service || !datetimeISO) {
      return res.status(400).json({ success: false, error: 'service and datetimeISO required' });
    }
    const bookingId = 'bk_' + crypto.randomBytes(6).toString('hex');
    const priceNum = Number(price) || 0;
    const amountCents = Math.max(0, Math.round(priceNum * 100));
    const record = {
      bookingId, service, style: style || null, price: priceNum,
      amountCents, currency: 'usd', datetimeISO, notes: notes || '',
      status: 'unpaid', createdAt: new Date().toISOString()
    };
    bookings.set(bookingId, record);

    const checkoutUrl = stripe ? `${PUBLIC_BASE_URL}/api/stripe/checkout?bookingId=${bookingId}` : null;
    res.json({ success: true, bookingId, status: record.status, amountCents, currency: record.currency, checkoutUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

if (stripe) {
  app.get('/api/stripe/checkout', async (req, res) => {
    try {
      const { bookingId } = req.query;
      const b = bookings.get(bookingId);
      if (!b) return res.status(404).send('booking not found');
      const unit_amount = Math.max(50, b.amountCents); // Stripe minimum ~$0.50
      const success_url = `${PUBLIC_BASE_URL}/pay/success?bookingId=${encodeURIComponent(bookingId)}`;
      const cancel_url  = `${PUBLIC_BASE_URL}/pay/cancel?bookingId=${encodeURIComponent(bookingId)}`;
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `${b.service} — ${b.style || 'Consult'}` },
            unit_amount
          },
          quantity: 1
        }],
        metadata: { bookingId },
        success_url, cancel_url
      });
      res.redirect(303, session.url);
    } catch (err) {
      console.error(err);
      res.status(500).send('stripe_error');
    }
  });
} else {
  app.get('/api/stripe/checkout', (req, res) => {
    const { bookingId } = req.query;
    res.send(`<!doctype html><html><body style="font-family:system-ui;">
      <h2>Checkout (stub)</h2>
      <p>Booking: <strong>${bookingId || '-'}</strong></p>
      <p>Stripe is not configured. Add <code>STRIPE_SECRET_KEY</code> to enable real payments.</p>
      <p><a href="/pay/success?bookingId=${encodeURIComponent(bookingId || '')}">Simulate Success</a> ·
         <a href="/pay/cancel?bookingId=${encodeURIComponent(bookingId || '')}">Cancel</a></p>
    </body></html>`);
  });
}

app.get('/pay/success', (req, res) => {
  const { bookingId } = req.query;
  const b = bookings.get(bookingId);
  if (b) b.status = 'paid';
  res.send(`<!doctype html><html><body style="font-family:system-ui;">
    <h2>Payment successful</h2>
    <p>Booking <strong>${bookingId || '-'}</strong> marked as <strong>paid</strong>.</p>
    <p><a href="/">Return to site</a></p>
  </body></html>`);
});

app.get('/pay/cancel', (req, res) => {
  const { bookingId } = req.query;
  const b = bookings.get(bookingId);
  if (b) b.status = 'unpaid';
  res.send(`<!doctype html><html><body style="font-family:system-ui;">
    <h2>Payment canceled</h2>
    <p>Booking <strong>${bookingId || '-'}</strong> remains <strong>unpaid</strong>.</p>
    <p><a href="/">Return to site</a></p>
  </body></html>`);
});

// 404 fallback for non-API routes to support multi-page or SPA style
app.get(/^\/(?!api\/).*$/, (req, res, next) => {
  // If the file exists, it'll be served by express.static already; otherwise serve index.html
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`All‑in‑one app listening on ${PORT}`);
});
