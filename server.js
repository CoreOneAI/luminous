const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(function(req, res, next){
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'"
  ].join('; '));
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Product catalog
let CATALOG = [];
let SOURCE = 'none';

// Generate sample catalog for testing
function generateSampleCatalog() {
  const brands = ['Salon Pro', 'Luxe', 'Natural', 'Premium'];
  const hairProducts = ['Shampoo', 'Conditioner', 'Mask', 'Serum', 'Spray', 'Oil', 'Cream', 'Treatment'];
  const skinProducts = ['Cleanser', 'Toner', 'Serum', 'Moisturizer', 'Mask', 'Exfoliant', 'Eye Cream', 'SPF'];
  
  const products = [];
  let id = 1;
  
  // Generate hair products
  for (let i = 0; i < 50; i++) {
    const product = hairProducts[i % hairProducts.length];
    const brand = brands[i % brands.length];
    const price = Math.floor(Math.random() * 3000) + 1200; // $12-42
    
    products.push({
      id: `hair-${id.toString().padStart(3, '0')}`,
      name: `${product} ${brand}`,
      brand: brand,
      category: 'Hair',
      price: price, // Store as cents
      image: `/images/placeholder-hair.jpg`
    });
    id++;
  }
  
  // Generate skin products  
  for (let i = 0; i < 50; i++) {
    const product = skinProducts[i % skinProducts.length];
    const brand = brands[i % brands.length];
    const price = Math.floor(Math.random() * 4000) + 1500; // $15-55
    
    products.push({
      id: `skin-${id.toString().padStart(3, '0')}`,
      name: `${product} ${brand}`,
      brand: brand,
      category: 'Skin',
      price: price, // Store as cents
      image: `/images/placeholder-skin.jpg`
    });
    id++;
  }
  
  return products;
}

function loadCatalog() {
  // Try to load from various locations
  const candidates = [
    path.join(__dirname, 'products.json'),
    path.join(__dirname, 'data', 'products.json'),
    path.join(__dirname, 'public', 'data', 'products.json')
  ];
  
  console.log('[CATALOG] Loading from candidates:', candidates);
  
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(data) && data.length > 0) {
          // Convert priceCents to price if needed
          CATALOG = data.map(p => ({
            ...p,
            price: p.priceCents || p.price || 0,
            image: p.image && p.image.startsWith('http') ? '/images/placeholder.jpg' : p.image
          }));
          SOURCE = filePath;
          console.log(`[CATALOG] Loaded ${CATALOG.length} products from ${filePath}`);
          return;
        }
      }
    } catch (error) {
      console.warn(`[CATALOG] Failed to load ${filePath}:`, error.message);
    }
  }
  
  // Generate sample catalog if no file found
  CATALOG = generateSampleCatalog();
  SOURCE = 'generated';
  console.log(`[CATALOG] Generated ${CATALOG.length} sample products`);
}

loadCatalog();

// Search function
function searchProducts(query = '') {
  if (!query.trim()) return CATALOG.slice();
  
  const searchTerm = query.toLowerCase();
  return CATALOG.filter(product => 
    product.name.toLowerCase().includes(searchTerm) ||
    product.brand.toLowerCase().includes(searchTerm) ||
    product.category.toLowerCase().includes(searchTerm)
  );
}

// API Routes
app.get('/api/products', (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const filteredProducts = searchProducts(query);
    const paginatedProducts = filteredProducts.slice(offset, offset + limit);
    
    const response = {
      success: true,
      total: filteredProducts.length,
      offset: offset,
      limit: limit,
      source: SOURCE,
      items: paginatedProducts.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand || '—',
        category: p.category || '—',
        price: p.price || 0, // Already in cents
        image: p.image || '/images/placeholder.jpg'
      }))
    };
    
    console.log(`[API] Products: query="${query}", total=${response.total}, returned=${paginatedProducts.length}`);
    res.json(response);
  } catch (error) {
    console.error('[API] Products error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/chat', (req, res) => {
  try {
    const message = (req.body?.message || '').trim();
    
    if (!message) {
      return res.json({ 
        success: true, 
        response: 'Hi! Ask me about hair care, skin care, or any beauty products.' 
      });
    }
    
    // Simple response logic
    let response = 'I can help you find the right products. Try searching for specific items like "shampoo", "moisturizer", or "serum".';
    
    if (message.toLowerCase().includes('hair')) {
      response = 'For hair care, I recommend starting with a sulfate-free shampoo, moisturizing conditioner, and heat protectant if you style with heat.';
    } else if (message.toLowerCase().includes('skin')) {
      response = 'For skin care, a good routine includes cleanser, toner, serum (like Vitamin C), moisturizer, and SPF during the day.';
    } else if (message.toLowerCase().includes('dry')) {
      response = 'For dry hair or skin, look for products with hydrating ingredients like hyaluronic acid, ceramides, or natural oils.';
    }
    
    res.json({ success: true, response });
  } catch (error) {
    console.error('[API] Chat error:', error);
    res.json({ success: true, response: 'Sorry, I had trouble processing that. Please try again.' });
  }
});

// Debug endpoints
app.get('/api/debug', (req, res) => {
  res.json({
    catalogSize: CATALOG.length,
    source: SOURCE,
    sampleProduct: CATALOG[0] || null,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.post('/api/reload-catalog', (req, res) => {
  loadCatalog();
  res.json({ 
    success: true, 
    catalogSize: CATALOG.length, 
    source: SOURCE 
  });
});

// Health check
app.get('/healthz', (req, res) => {
  res.json({ 
    status: 'ok', 
    catalog: CATALOG.length,
    timestamp: new Date().toISOString()
  });
});

// Serve static files
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
  console.log(`[CATALOG] ${CATALOG.length} products loaded from ${SOURCE}`);
  console.log(`[SERVER] Ready for requests`);
});
