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

// Product image mapping for your uploaded images in public/images/
const PRODUCT_IMAGES = {
  // Skincare products
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
  
  // Hair products  
  'shampoo': '/images/studio-beige.jpg',
  'conditioner': '/images/wooden-tray.jpg',
  'hair': '/images/studio-beige.jpg',
  'spray': '/images/wooden-tray.jpg',
  'volume': '/images/studio-beige.jpg',
  'curl': '/images/wooden-tray.jpg',
  
  // Men's products
  'beard': '/images/zen-stone-serum.jpg',
  'shaving': '/images/wooden-tray.jpg',
  'aftershave': '/images/hero-almonds.jpg',
  'balm': '/images/studio-beige.jpg',
  
  // Category defaults
  'skin': '/images/WHITE FEMALE.jpg',
  'hair': '/images/studio-beige.jpg',
  'men': '/images/wooden-tray.jpg',
  
  // Fallback
  'default': '/images/AFRICAN AMERICAN BEAUTY.jpg'
};

function selectProductImage(productName, category) {
  const name = productName.toLowerCase();
  
  // Try specific product type matching first
  for (const [keyword, image] of Object.entries(PRODUCT_IMAGES)) {
    if (name.includes(keyword)) {
      return image;
    }
  }
  
  // Category-based selection
  if (category && category.toLowerCase().includes('skin')) return '/images/WHITE FEMALE.jpg';
  if (category && category.toLowerCase().includes('hair')) return '/images/studio-beige.jpg';
  if (category && category.toLowerCase().includes('men')) return '/images/wooden-tray.jpg';
  
  // Rotate through images for variety
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
          // Convert priceCents to price if needed
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

Generate EXACTLY 15-20 realistic salon products that would be perfect for this client. This is very important - you must generate at least 15 products. Return ONLY a valid JSON array with this exact format:

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

IMPORTANT: You must generate exactly 15-20 products. Do not generate fewer than 15 products. Create a variety of different product types including shampoos, conditioners, serums, masks, treatments, oils, sprays, creams, cleansers, toners, moisturizers, and specialized treatments.

Example product types to include:
- Shampoo, Conditioner, Deep Treatment Mask
- Leave-in Treatment, Hair Oil, Heat Protectant
- Facial Cleanser, Toner, Serum  
- Moisturizer, Eye Cream, Night Treatment
- Exfoliant, Face Mask, Spot Treatment
- Styling products, Finishing products
- Specialized treatments for the client's concerns
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
        if (response && Array.isArray(response) && response.length >= 10) {
          console.log(`[AI] Generated ${response.length} products via ${api.name}`);
          // Ensure proper image assignment
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

  // Enhanced fallback - generate more products locally if AI fails
  console.log('[AI] All APIs failed, using enhanced local generation');
  return generateLocalProducts(query, clientNeeds);
}

// Enhanced local product generation as fallback
function generateLocalProducts(query, clientNeeds) {
  const queryLower = query.toLowerCase();
  const products = [];
  let id = 1000;
  
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
    
    // Skin products
    { name: 'Gentle Facial Cleanser', category: 'Skin', basePrice: 2200, type: 'cleanser' },
    { name: 'Balancing Toner', category: 'Skin', basePrice: 1900, type: 'toner' },
    { name: 'Vitamin C Serum', category: 'Skin', basePrice: 3200, type: 'serum' },
    { name: 'Hyaluronic Moisturizer', category: 'Skin', basePrice: 2800, type: 'moisturizer' },
    { name: 'Anti-Aging Night Cream', category: 'Skin', basePrice: 3500, type: 'cream' },
    { name: 'Brightening Eye Cream', category: 'Skin', basePrice: 3800, type: 'cream' },
    { name: 'Exfoliating Treatment', category: 'Skin', basePrice: 2600, type: 'treatment' },
    { name: 'Hydrating Face Mask', category: 'Skin', basePrice: 2400, type: 'mask' },
    
    // Specialized products
    { name: 'Color Protection Shampoo', category: 'Hair', basePrice: 2000, type: 'shampoo' },
    { name: 'Clarifying Treatment', category: 'Hair', basePrice: 2300, type: 'treatment' },
    { name: 'Scalp Therapy Serum', category: 'Hair', basePrice: 2900, type: 'serum' },
    { name: 'Retinol Night Treatment', category: 'Skin', basePrice: 4200, type: 'serum' }
  ];
  
  // Select relevant products based on query and client needs
  const relevantProducts = productTemplates.filter(template => {
    const matchesQuery = template.name.toLowerCase().includes(queryLower) || 
                        template.type.toLowerCase().includes(queryLower) ||
                        template.category.toLowerCase().includes(queryLower);
    
    if (clientNeeds.concerns) {
      const concerns = clientNeeds.concerns.toLowerCase();
      if (concerns.includes('damage') && template.name.toLowerCase().includes('repair')) return true;
      if (concerns.includes('volume') && template.name.toLowerCase().includes('volume')) return true;
      if (concerns.includes('color') && template.name.toLowerCase().includes('color')) return true;
      if (concerns.includes('aging') && template.name.toLowerCase().includes('anti-aging')) return true;
    }
    
    return matchesQuery || !queryLower; // Include all if no specific query
  });
  
  // Generate products from templates
  relevantProducts.forEach(template => {
    const brands = ['Professional', 'Luxe', 'Premium', 'Salon Pro'];
    const priceVariation = Math.random() * 500; // Add some price variation
    
    products.push({
      id: `local-${id++}`,
      name: template.name,
      brand: brands[Math.floor(Math.random() * brands.length)],
      category: template.category,
      price: Math.floor(template.basePrice + priceVariation), // Ensure price is set
      description: `Professional ${template.category.toLowerCase()} treatment designed for salon-quality results.`,
      benefits: ['Professional Grade', 'Salon Quality', 'Long-lasting Results'],
      usage: `Apply to ${template.category === 'Hair' ? 'hair' : 'clean skin'} as directed.`,
      ingredients: 'Premium active ingredients',
      suitableFor: 'All hair and skin types'
    });
  });
  
  // If we don't have enough products, add more variations
  while (products.length < 50) { // Generate up to 50 base products
    const template = productTemplates[products.length % productTemplates.length];
    const variation = products.length % 4;
    const variations = ['Advanced', 'Intensive', 'Ultra', 'Maximum'];
    
    products.push({
      id: `local-${id++}`,
      name: `${variations[variation]} ${template.name}`,
      brand: 'Professional',
      category: template.category,
      price: template.basePrice + (variation * 200), // Ensure price is always set
      description: `${variations[variation]} strength ${template.category.toLowerCase()} treatment.`,
      benefits: ['Professional Grade', 'Enhanced Formula', 'Proven Results'],
      usage: `Apply as directed for best results.`,
      ingredients: 'Advanced active ingredients',
      suitableFor: 'Professional use recommended'
    });
  }
  
  // Generate even more products for 100+ capacity
  const extraProducts = [
    // More hair products
    'Volumizing Shampoo', 'Moisturizing Shampoo', 'Clarifying Shampoo', 'Purple Shampoo',
    'Deep Conditioner', 'Daily Conditioner', 'Co-Wash', 'Leave-In Conditioner',
    'Hair Serum', 'Scalp Oil', 'Argan Oil', 'Coconut Oil Treatment',
    'Root Lift Spray', 'Sea Salt Spray', 'Smoothing Cream', 'Curl Cream',
    'Hair Wax', 'Pomade', 'Hair Gel', 'Mousse',
    
    // More skin products
    'Gel Cleanser', 'Cream Cleanser', 'Oil Cleanser', 'Micellar Water',
    'Niacinamide Serum', 'Peptide Serum', 'Bakuchiol Serum', 'Caffeine Eye Cream',
    'Day Moisturizer', 'Night Moisturizer', 'Face Oil', 'Sleeping Mask',
    'AHA Exfoliant', 'BHA Exfoliant', 'Enzyme Peel', 'Clay Mask',
    
    // Specialty products
    'Beard Oil', 'Mustache Wax', 'Shaving Cream', 'After Shave Balm',
    'Body Lotion', 'Body Scrub', 'Hand Cream', 'Lip Balm',
    'Sunscreen SPF 30', 'Sunscreen SPF 50', 'Bronzing Oil', 'Tanning Serum'
  ];
  
  extraProducts.forEach((productName, index) => {
    if (products.length >= 100) return; // Cap at 100 products
    
    const isHair = productName.toLowerCase().includes('hair') || 
                   productName.toLowerCase().includes('shampoo') ||
                   productName.toLowerCase().includes('conditioner') ||
                   productName.toLowerCase().includes('curl') ||
                   productName.toLowerCase().includes('volume');
                   
    const isMens = productName.toLowerCase().includes('beard') ||
                   productName.toLowerCase().includes('shaving') ||
                   productName.toLowerCase().includes('mustache');
    
    const category = isMens ? 'Men' : (isHair ? 'Hair' : 'Skin');
    const basePrice = 1500 + (index * 50) + Math.floor(Math.random() * 1000); // Vary prices
    
    products.push({
      id: `extra-${id++}`,
      name: productName,
      brand: ['Professional', 'Luxe', 'Premium', 'Salon Pro'][index % 4],
      category: category,
      price: basePrice, // Ensure price is set
      description: `Professional ${category.toLowerCase()} product for salon-quality results.`,
      benefits: ['Professional Grade', 'Salon Quality', 'Effective Results'],
      usage: 'Apply as directed.',
      ingredients: 'Active professional ingredients',
      suitableFor: `All ${category.toLowerCase()} types`
    });
  });
  
  return products.slice(0, 100); // Return up to 100 products
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
      max_tokens: 4000, // Increased for longer responses
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);
  
  const data = await response.json();
  const content = data.content[0]?.text || '';
  
  // Extract JSON from response - be more flexible with parsing
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`[AI] Anthropic returned ${parsed.length} products`);
    return parsed;
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
      max_tokens: 4000, // Increased for longer responses
      temperature: 0.7
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  
  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`[AI] OpenAI returned ${parsed.length} products`);
    return parsed;
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
        maxOutputTokens: 4000, // Increased for longer responses
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
    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`[AI] Gemini returned ${parsed.length} products`);
    return parsed;
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

// Search function
function searchProducts(query = '') {
  if (!query.trim()) return BASE_CATALOG.slice();
  
  const searchTerm = query.toLowerCase();
  return BASE_CATALOG.filter(product => 
    product.name.toLowerCase().includes(searchTerm) ||
    product.brand.toLowerCase().includes(searchTerm) ||
    product.category.toLowerCase().includes(searchTerm)
  );
}

// API Routes
app.get('/api/products', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit) || 20, 50); // Allow up to 50 per request
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
        price: p.price || 0, // Already in cents
        image: selectProductImage(p.name, p.category), // Use actual uploaded images
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
