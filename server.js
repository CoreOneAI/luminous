// server.js — ES Module version
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const app = express();

// Security middleware
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '1mb' }));

// Static files
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasOpenAI: Boolean(OPENAI_API_KEY),
    model: OPENAI_MODEL,
    timestamp: new Date().toISOString()
  });
});

// Products catalog
let productsCatalog = [];
const PRODUCTS_PATH = path.join(PUBLIC_DIR, 'products.json');

function loadProductsCatalog() {
  try {
    const data = fs.readFileSync(PRODUCTS_PATH, 'utf8');
    const parsedData = JSON.parse(data);
    
    if (Array.isArray(parsedData)) {
      productsCatalog = parsedData;
      console.log(`📦 Loaded ${productsCatalog.length} products`);
    } else {
      throw new Error('Products data is not an array');
    }
  } catch (error) {
    console.error('❌ Failed to load products:', error.message);
    productsCatalog = [];
  }
}

// Initial load
loadProductsCatalog();

// Admin endpoint to reload products
app.post('/admin/reload-products', (req, res) => {
  loadProductsCatalog();
  res.json({ 
    ok: true, 
    count: productsCatalog.length,
    message: 'Products catalog reloaded successfully'
  });
});

// Products API endpoint
app.get('/api/products', (req, res) => {
  const { q = '', category = '', offset = 0, limit = 16 } = req.query;
  
  const searchTerm = q.toString().trim().toLowerCase();
  const categoryFilter = category.toString().trim().toLowerCase();
  const pageOffset = Math.max(0, parseInt(offset, 10));
  const pageLimit = Math.max(1, Math.min(50, parseInt(limit, 10)));

  let filteredProducts = [...productsCatalog];

  // Filter by category
  if (categoryFilter) {
    filteredProducts = filteredProducts.filter(product =>
      (product.category || '').toLowerCase() === categoryFilter
    );
  }

  // Filter by search term
  if (searchTerm) {
    filteredProducts = filteredProducts.filter(product => {
      const searchableText = [
        product.name,
        product.brand,
        product.category,
        product.description,
        ...(Array.isArray(product.tags) ? product.tags : [])
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchableText.includes(searchTerm);
    });
  }

  const total = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice(pageOffset, pageOffset + pageLimit);

  res.json({
    success: true,
    total,
    count: paginatedProducts.length,
    offset: pageOffset,
    limit: pageLimit,
    products: paginatedProducts
  });
});

// AI chat endpoint
app.post('/ask', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Valid message is required' });
    }
    
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI service unavailable' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a friendly, concise beauty stylist assistant. Be clear, calm, and helpful.'
          },
          {
            role: 'user',
            content: message.trim()
          }
        ],
        temperature: 0.6,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API responded with status ${response.status}`);
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || 
                 'Sorry, I couldn\'t process your request at the moment.';

    res.json({
      success: true,
      provider: 'openai',
      model: OPENAI_MODEL,
      reply
    });

  } catch (error) {
    console.error('AI request error:', error.message);
    res.status(500).json({
      error: 'Failed to process your request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Serve SPA for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 OpenAI configured: ${Boolean(OPENAI_API_KEY)}`);
  console.log(`🤖 AI Model: ${OPENAI_MODEL}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});
