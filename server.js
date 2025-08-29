const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// API Keys - Set these as environment variables in Render
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
    "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com https://api.anthropic.com",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'"
  ].join('; '));
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Base catalog for fallback/seed data
let BASE_CATALOG = [];
let SOURCE = 'none';

// Product image mapping for your uploaded images
const PRODUCT_IMAGES = {
  'serum': '/images/zen-stone-serum.jpg',
  'moisturizer': '/images/WHITE FEMALE.jpg', 
  'cleanser': '/images/HISPANIC BEAYTY CARE MODAL.jpg',
  'cream': '/images/WHITE FEMALE BEAUTY CARE MODAL.jpg',
  'toner': '/images/hero-almonds.jpg',
  'mask': '/images/AFRICAN AMERICAN BEAUTY.jpg',
  'treatment': '/images/zen-stone-serum.jpg',
  'oil': '/images/hero-almonds.jpg',
  'eye': '/images/WHITE FEMALE BEAUTY CARE MODAL.jpg',
  'night': '/images/AFRICAN AMERICAN BEAUTY.jpg',
  'shampoo': '/images/studio-beige.jpg',
  'conditioner': '/images/wooden-tray.jpg',
  'hair': '/images/studio-beige.jpg',
  'spray': '/images/wooden-tray.jpg',
  'volume': '/images/studio-beige.jpg',
  'curl': '/images/wooden-tray.jpg',
  'beard': '/images/zen-stone-serum.jpg',
  'shaving': '/images/wooden-tray.jpg',
  'aftershave': '/images/hero-almonds.jpg',
  'balm': '/images/studio-beige.jpg',
  'skin': '/images/WHITE FEMALE.jpg',
  'men': '/images/wooden-tray.jpg',
  'default': '/images/AFRICAN AMERICAN BEAUTY.jpg'
};

function selectProductImage(productName, category) {
  const name = productName.toLowerCase();
  
  for (const [keyword, image] of Object.entries(PRODUCT_IMAGES)) {
    if (name.includes(keyword)) {
      return image;
    }
  }
  
  if (category && category.toLowerCase().includes('skin')) return '/images/WHITE FEMALE.jpg';
  if (category && category.toLowerCase().includes('hair')) return '/images/studio-beige.jpg';
  if (category && category.toLowerCase().includes('men')) return '/images/wooden-tray.jpg';
  
  const allImages = Object.values(PRODUCT_IMAGES).filter(img => img !== '/images/default');
  const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return allImages[hash % allImages.length];
}

// Load base catalog
function loadBaseCatalog() {
  const candidates = [
    path.join(__dirname, 'products.json'),
    path.join(__dirname, 'data', 'products.json'),
    path.join(__dirname, 'public', 'data', 'products.json')
  ];
  
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(data) && data.length > 0) {
          BASE_CATALOG = data.map(p => ({
            ...p,
            price: p.priceCents || p.price || 0,
            image: p.image && p.image.startsWith('http') ? '/images/placeholder.jpg' : p.image
          }));
          SOURCE = filePath;
          console.log(`[CATALOG] Loaded ${BASE_CATALOG.length} base products from ${filePath}`);
          return;
        }
      }
    } catch (error) {
      console.warn(`[CATALOG] Failed to load ${filePath}:`, error.message);
    }
  }
  
  BASE_CATALOG = [
    { id: 'default-1', name: 'Professional Shampoo', brand: 'Salon', category: 'Hair', price: 1800, image: '/images/placeholder.jpg' }
  ];
  SOURCE = 'fallback';
  console.log(`[CATALOG] Using fallback catalog`);
}

loadBaseCatalog();

// Generate local products (AI fallback)
function generateLocalProducts(query, clientNeeds) {
  const queryLower = query.toLowerCase();
  const products = [];
  let id = 1000;
  
  // Check if this is a brand search
  const isBrandSearch = queryLower.includes('revlon') || queryLower.includes('olaplex') || 
                       queryLower.includes('loreal') || queryLower.includes('matrix') ||
                       queryLower.includes('redken') || queryLower.includes('paul mitchell');
  
  const extractedBrand = isBrandSearch ? 
    (queryLower.includes('revlon') ? 'Revlon' :
     queryLower.includes('olaplex') ? 'Olaplex' :
     queryLower.includes('loreal') ? "L'Oréal" :
     queryLower.includes('matrix') ? 'Matrix' :
     queryLower.includes('redken') ? 'Redken' :
     queryLower.includes('paul mitchell') ? 'Paul Mitchell' : 'Professional') : 'Professional';

  const productTemplates = [
    // Hair products
    { name: 'Sulfate-Free Shampoo', category: 'Hair', basePrice: 1800, type: 'shampoo' },
    { name: 'Hydrating Conditioner', category: 'Hair', basePrice: 1900, type: 'conditioner' },
    { name: 'Deep Repair Mask', category: 'Hair', basePrice: 2400, type: 'treatment' },
    { name: 'Leave-In Treatment', category: 'Hair', basePrice: 2200, type: 'treatment' },
    { name: 'Hair Oil Elixir', category: 'Hair', basePrice: 2800, type: 'oil' },
    { name: 'Heat Protection Spray', category: 'Hair', basePrice: 2000, type: 'spray' },
    { name: 'Volume Boosting Mousse', category: 'Hair', basePrice: 1750, type: 'spray' },
    { name: 'Curl Defining Cream', category: 'Hair', basePrice: 2100, type: 'cream' },
    { name: 'Color Protection Shampoo', category: 'Hair', basePrice: 2000, type: 'shampoo' },
    { name: 'Clarifying Treatment', category: 'Hair', basePrice: 2300, type: 'treatment' },
    { name: 'Scalp Therapy Serum', category: 'Hair', basePrice: 2900, type: 'serum' },
    { name: 'Smoothing Serum', category: 'Hair', basePrice: 2400, type: 'serum' },
    { name: 'Texture Spray', category: 'Hair', basePrice: 1850, type: 'spray' },
    { name: 'Hair Styling Gel', category: 'Hair', basePrice: 1700, type: 'gel' },
    { name: 'Anti-Frizz Cream', category: 'Hair', basePrice: 2200, type: 'cream' },
    
    // Skin products
    { name: 'Gentle Facial Cleanser', category: 'Skin', basePrice: 2200, type: 'cleanser' },
    { name: 'Balancing Toner', category: 'Skin', basePrice: 1900, type: 'toner' },
    { name: 'Vitamin C Serum', category: 'Skin', basePrice: 3200, type: 'serum' },
    { name: 'Hyaluronic Moisturizer', category: 'Skin', basePrice: 2800, type: 'moisturizer' },
    { name: 'Anti-Aging Night Cream', category: 'Skin', basePrice: 3500, type: 'cream' },
    { name: 'Brightening Eye Cream', category: 'Skin', basePrice: 3800, type: 'cream' },
    { name: 'Exfoliating Treatment', category: 'Skin', basePrice: 2600, type: 'treatment' },
    { name: 'Hydrating Face Mask', category: 'Skin', basePrice: 2400, type: 'mask' },
    { name: 'Retinol Night Treatment', category: 'Skin', basePrice: 4200, type: 'serum' },
    { name: 'Sunscreen SPF 30', category: 'Skin', basePrice: 2500, type: 'treatment' }
  ];
  
  // Generate products from templates - more for brand searches
  const targetCount = isBrandSearch ? 60 : 40;
  
  for (let i = 0; i < targetCount; i++) {
    const template = productTemplates[i % productTemplates.length];
    const variation = Math.floor(i / productTemplates.length);
    const variations = ['Professional', 'Advanced', 'Intensive', 'Ultra', 'Maximum'];
    const priceVariation = Math.random() * 800 + (variation * 300);
    
    const productName = variation > 0 ? 
      `${variations[variation]} ${template.name}` : template.name;
    
    products.push({
      id: `local-${id++}`,
      name: productName,
      brand: extractedBrand,
      category: template.category,
      price: Math.floor(template.basePrice + priceVariation),
      description: `${isBrandSearch ? extractedBrand : 'Professional'} ${template.category.toLowerCase()} treatment designed for salon-quality results.`,
      benefits: ['Professional Grade', 'Salon Quality', 'Long-lasting Results'],
      usage: `Apply to ${template.category === 'Hair' ? 'hair' : 'clean skin'} as directed.`,
      ingredients: 'Premium active ingredients',
      suitableFor: 'All hair and skin types'
    });
  }
  
  console.log(`[LOCAL] Generated ${products.length} products for query: "${query}"`);
  return products;
}

// AI-powered product generation
async function generateProductsWithAI(query, clientNeeds = {}) {
  const isBrandSearch = query.toLowerCase().includes('revlon') || query.toLowerCase().includes('olaplex') || 
                       query.toLowerCase().includes('loreal') || query.toLowerCase().includes('matrix');
  
  const prompt = `
You are a professional salon product expert. Based on this client request: "${query}"

Client details: ${JSON.stringify(clientNeeds)}

${isBrandSearch ? 
`BRAND SEARCH: Generate 30-40 professional salon products that sound like they could be from the "${query}" brand family. Include various product types like shampoos, conditioners, serums, treatments, styling products, etc.` :
`Generate 25-30 realistic salon products that would be perfect for this client's needs.`}

Return ONLY a valid JSON array with this exact format:

[
  {
    "id": "unique-product-id",
    "name": "Product Name",
    "brand": "Brand Name", 
    "category": "Hair|Skin|Nails",
    "price": 2400,
    "description": "2-3 sentence product description",
    "benefits": ["benefit 1", "benefit 2", "benefit 3"],
    "usage": "How to use this product",
    "ingredients": "Key active ingredients",
    "suitableFor": "Who this product is perfect for"
  }
]

Focus on professional salon-grade products. Price should be in cents (1800 = $18.00). Make products realistic and specific to the client's needs.

IMPORTANT: Generate at least 25 products. For brand searches, create 30-40 products that sound authentic to that brand family.
`;

  const apis = [
    { name: 'anthropic', key: ANTHROPIC_API_KEY, func: callAnthropicAPI },
    { name: 'openai', key: OPENAI_API_KEY, func: callOpenAIAPI },
    { name: 'gemini', key: GEMINI_API_KEY, func: callGeminiAPI }
  ];

  for (const api of apis) {
    if (api.key) {
      try {
        console.log(`[AI] Attempting ${api.name} API for query: "${query}"`);
        const response = await api.func(prompt, api.key);
        if (response && Array.isArray(response) && response.length >= 15) {
          console.log(`[AI] Generated ${response.length} products via ${api.name}`);
          return response.map(product => ({
            ...product,
            image: selectProductImage(product.name, product.category)
          }));
        } else if (response && Array.isArray(response)) {
          console.log(`[AI] ${api.name} returned ${response.length} products, trying next API...`);
        }
      } catch (error) {
        console.warn(`[AI] ${api.name} failed:`, error.message);
      }
    }
  }

  console.log('[AI] All APIs failed, using local generation');
  return generateLocalProducts(query, clientNeeds);
}

// API call functions
async function callAnthropicAPI(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);
  
  const data = await response.json();
  const content = data.content[0]?.text || '';
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('No valid JSON in response');
}

async function callOpenAIAPI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.7
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  
  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('No valid JSON in response');
}

async function callGeminiAPI(prompt, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.7
      }
    })
  });

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  
  const data = await response.json();
  const content = data.candidates[0]?.content?.parts[0]?.text || '';
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('No valid JSON in response');
}

// Enhanced chat with AI
async function generateChatResponse(message) {
  const prompt = `You are a professional salon consultant. A client says: "${message}"

Provide helpful, professional advice about hair care, skin care, or beauty treatments. Keep your response to 2-3 sentences, warm and professional. Focus on actionable recommendations they can discuss with their stylist.`;

  const apis = [
    { key: ANTHROPIC_API_KEY },
    { key: OPENAI_API_KEY },
    { key: GEMINI_API_KEY }
  ];

  for (const api of apis) {
    if (api.key) {
      try {
        const chatPrompt = prompt + '\n\nRespond with plain text only, no JSON.';
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': api.key,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 300,
            messages: [{ role: 'user', content: chatPrompt }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          return data.content[0]?.text || 'I can help you find the perfect products for your needs.';
        }
      } catch (error) {
        console.warn('[CHAT] AI response failed:', error.message);
      }
    }
  }

  return 'I can help you find the perfect products for your needs. Try being more specific about your hair or skin concerns.';
}

// API Routes
app.get('/api/products', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit) || 25, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const clientNeeds = {
      hairType: req.query.hairType || '',
      skinType: req.query.skinType || '',
      concerns: req.query.concerns || '',
      budget: req.query.budget || ''
    };

    console.log(`[API] Products request: "${query}" with needs:`, clientNeeds);

    let products = [];
    
    if (query.trim()) {
      products = await generateProductsWithAI(query, clientNeeds);
    } else {
      products = BASE_CATALOG.slice();
    }

    const total = products.length;
    const paginatedProducts = products.slice(offset, offset + limit);

    const response = {
      success: true,
      total: total,
      offset: offset,
      limit: limit,
      query: query,
      aiGenerated: query.trim() ? true : false,
      items: paginatedProducts.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand || 'Professional',
        category: p.category || 'Beauty',
        price: p.price || 0,
        image: selectProductImage(p.name, p.category),
        description: p.description || '',
        benefits: p.benefits || [],
        usage: p.usage || '',
        ingredients: p.ingredients || '',
        suitableFor: p.suitableFor || ''
      }))
    };
    
    console.log(`[API] Returning ${paginatedProducts.length} of ${total} products`);
    res.json(response);
    
  } catch (error) {
    console.error('[API] Products error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate product recommendations',
      items: []
    });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const message = (req.body?.message || '').trim();
    
    if (!message) {
      return res.json({ 
        success: true, 
        response: 'Hi! I\'m your personal salon consultant. Tell me about your hair or skin concerns and I\'ll recommend the perfect products for you.' 
      });
    }
    
    const response = await generateChatResponse(message);
    res.json({ success: true, response });
    
  } catch (error) {
    console.error('[API] Chat error:', error);
    res.json({ 
      success: true, 
      response: 'I\'m here to help you find the perfect products. What are you looking for today?' 
    });
  }
});

// Debug endpoints
app.get('/api/debug', (req, res) => {
  res.json({
    catalogSize: BASE_CATALOG.length,
    source: SOURCE,
    apis: {
      openai: !!OPENAI_API_KEY,
      gemini: !!GEMINI_API_KEY,
      anthropic: !!ANTHROPIC_API_KEY
    },
    sampleProduct: BASE_CATALOG[0] || null
  });
});

app.get('/healthz', (req, res) => {
  res.json({ 
    status: 'ok', 
    catalog: BASE_CATALOG.length,
    aiEnabled: !!(OPENAI_API_KEY || GEMINI_API_KEY || ANTHROPIC_API_KEY),
    timestamp: new Date().toISOString()
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] AI-Enhanced Salon App listening on port ${PORT}`);
  console.log(`[CATALOG] ${BASE_CATALOG.length} base products loaded`);
  console.log(`[AI] APIs configured:`, {
    openai: !!OPENAI_API_KEY,
    gemini: !!GEMINI_API_KEY, 
    anthropic: !!ANTHROPIC_API_KEY
  });
  console.log(`[SERVER] Ready for AI-powered recommendations`);
});
