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
  
  // Minimal fallback if no file found
  BASE_CATALOG = [
    { id: 'default-1', name: 'Professional Shampoo', brand: 'Salon', category: 'Hair', price: 1800, image: '/images/placeholder.jpg' }
  ];
  SOURCE = 'fallback';
  console.log(`[CATALOG] Using fallback catalog`);
}

loadBaseCatalog();

// AI-powered product generation
async function generateProductsWithAI(query, clientNeeds = {}) {
  const prompt = `
You are a professional salon product expert. Based on this client request: "${query}"

Client details: ${JSON.stringify(clientNeeds)}

Generate 8-12 realistic salon products that would be perfect for this client. Return ONLY a valid JSON array with this exact format:

[
  {
    "id": "unique-product-id",
    "name": "Product Name",
    "brand": "Brand Name", 
    "category": "Hair|Skin|Nails",
    "price": 2400,
    "image": "/images/placeholder.jpg",
    "description": "2-3 sentence product description",
    "benefits": ["benefit 1", "benefit 2", "benefit 3"],
    "usage": "How to use this product",
    "ingredients": "Key active ingredients",
    "suitableFor": "Who this product is perfect for"
  }
]

Focus on professional salon-grade products. Price should be in cents (1800 = $18.00). Make products realistic and specific to the client's needs.
`;

  // Try APIs in order of preference
  const apis = [
    { name: 'anthropic', key: ANTHROPIC_API_KEY, func: callAnthropicAPI },
    { name: 'openai', key: OPENAI_API_KEY, func: callOpenAIAPI },
    { name: 'gemini', key: GEMINI_API_KEY, func: callGeminiAPI }
  ];

  for (const api of apis) {
    if (api.key) {
      try {
        console.log(`[AI] Attempting ${api.name} API...`);
        const response = await api.func(prompt, api.key);
        if (response && Array.isArray(response)) {
          console.log(`[AI] Generated ${response.length} products via ${api.name}`);
          return response;
        }
      } catch (error) {
        console.warn(`[AI] ${api.name} failed:`, error.message);
      }
    }
  }

  // Fallback to base catalog if all APIs fail
  console.log('[AI] All APIs failed, using base catalog');
  return BASE_CATALOG.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.category.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);
}

// Anthropic API call
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
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);
  
  const data = await response.json();
  const content = data.content[0]?.text || '';
  
  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('No valid JSON in response');
}

// OpenAI API call
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
      max_tokens: 2000,
      temperature: 0.7
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  
  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('No valid JSON in response');
}

// Gemini API call
async function callGeminiAPI(prompt, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.7
      }
    })
  });

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  
  const data = await response.json();
  const content = data.candidates[0]?.content?.parts[0]?.text || '';
  
  // Extract JSON from response
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

  // Try to get AI response
  const apis = [
    { key: ANTHROPIC_API_KEY, func: callAnthropicAPI },
    { key: OPENAI_API_KEY, func: callOpenAIAPI },
    { key: GEMINI_API_KEY, func: callGeminiAPI }
  ];

  for (const api of apis) {
    if (api.key) {
      try {
        // For chat, we want text response, not JSON
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

  // Fallback response
  return 'I can help you find the perfect products for your needs. Try being more specific about your hair or skin concerns.';
}

// API Routes
app.get('/api/products', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit) || 25, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    // Extract client needs from query params
    const clientNeeds = {
      hairType: req.query.hairType || '',
      skinType: req.query.skinType || '',
      concerns: req.query.concerns || '',
      budget: req.query.budget || ''
    };

    console.log(`[API] Products request: "${query}" with needs:`, clientNeeds);

    let products = [];
    
    if (query.trim()) {
      // Use AI to generate products for this specific query
      products = await generateProductsWithAI(query, clientNeeds);
    } else {
      // No query - show base catalog
      products = BASE_CATALOG.slice();
    }

    // Apply pagination
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
        image: p.image || '/images/placeholder.jpg',
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

// Debug endpoint
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

// Health check
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
