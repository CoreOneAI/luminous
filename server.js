import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// API Keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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

// LOAD YOUR ACTUAL PRODUCTS AND FAQS
let SALON_PRODUCTS = [];
let SALON_FAQS = {};

function loadRealData() {
  // Load your actual product inventory
  try {
    const productData = fs.readFileSync('salon_inventory.json', 'utf8');
    SALON_PRODUCTS = JSON.parse(productData);
    console.log(`[PRODUCTS] Loaded ${SALON_PRODUCTS.length} real products`);
  } catch (error) {
    console.warn('[PRODUCTS] Could not load salon_inventory.json:', error.message);
    // Load products.json as fallback
    try {
      const fallbackData = fs.readFileSync('products.json', 'utf8');
      SALON_PRODUCTS = JSON.parse(fallbackData);
      console.log(`[PRODUCTS] Loaded ${SALON_PRODUCTS.length} products from fallback`);
    } catch (fallbackError) {
      console.warn('[PRODUCTS] Could not load products.json:', fallbackError.message);
      SALON_PRODUCTS = [];
    }
  }

  // Load FAQ database
  try {
    const faqData = fs.readFileSync('faqs.json', 'utf8');
    SALON_FAQS = JSON.parse(faqData);
    console.log('[FAQS] Loaded salon FAQ database');
  } catch (error) {
    console.warn('[FAQS] Could not load faqs.json:', error.message);
    SALON_FAQS = {};
  }
}

loadRealData();

// Product image mapping
const PRODUCT_IMAGES = {
  'shampoo': '/images/studio-beige.jpg',
  'conditioner': '/images/wooden-tray.jpg',
  'mask': '/images/AFRICAN AMERICAN BEAUTY.jpg',
  'serum': '/images/zen-stone-serum.jpg',
  'oil': '/images/hero-almonds.jpg',
  'treatment': '/images/WHITE FEMALE BEAUTY CARE MODAL.jpg',
  'cream': '/images/WHITE FEMALE.jpg',
  'spray': '/images/HISPANIC BEAYTY CARE MODAL.jpg',
  'default': '/images/AFRICAN AMERICAN BEAUTY.jpg'
};

function selectProductImage(productName, category) {
  const name = productName.toLowerCase();
  for (const [keyword, image] of Object.entries(PRODUCT_IMAGES)) {
    if (name.includes(keyword)) {
      return image;
    }
  }
  return PRODUCT_IMAGES.default;
}

// FAQ MATCHING FUNCTION
function findFAQMatch(userMessage) {
  const message = userMessage.toLowerCase();
  
  for (const category in SALON_FAQS) {
    const categoryData = SALON_FAQS[category];
    
    // Check if message matches any question
    for (const question of categoryData.questions) {
      const questionWords = question.toLowerCase().split(' ');
      const messageWords = message.split(' ');
      
      // Simple matching - if 60% of question words are in message
      const matchCount = questionWords.filter(word => 
        messageWords.some(msgWord => msgWord.includes(word) || word.includes(msgWord))
      ).length;
      
      if (matchCount / questionWords.length > 0.6) {
        return {
          question: question,
          answer: categoryData.answers[question] || 'Let me help you with that.',
          category: category
        };
      }
    }
  }
  return null;
}

// PRODUCT RECOMMENDATION BASED ON REAL INVENTORY
function getRelevantProducts(query, maxProducts = 20) {
  if (SALON_PRODUCTS.length === 0) {
    return []; // No products loaded
  }

  const queryLower = query.toLowerCase();
  const scored = SALON_PRODUCTS.map(product => {
    let score = 0;
    
    // Exact matches get high scores
    if (product.name.toLowerCase().includes(queryLower)) score += 10;
    if (product.brand.toLowerCase().includes(queryLower)) score += 8;
    if (product.category.toLowerCase().includes(queryLower)) score += 6;
    if (product.description.toLowerCase().includes(queryLower)) score += 5;
    
    // Benefit matches
    if (product.benefits) {
      product.benefits.forEach(benefit => {
        if (benefit.toLowerCase().includes(queryLower)) score += 4;
      });
    }
    
    // Keyword matching
    const keywords = ['damage', 'color', 'frizz', 'dry', 'oily', 'curl', 'straight', 'volume'];
    keywords.forEach(keyword => {
      if (queryLower.includes(keyword)) {
        if (product.name.toLowerCase().includes(keyword) || 
            product.description.toLowerCase().includes(keyword)) {
          score += 3;
        }
      }
    });
    
    return { product, score };
  });
  
  // Return products with scores > 0, sorted by score
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxProducts)
    .map(item => item.product);
}

// AI CHAT WITH REAL PRODUCTS INJECTED
async function generateChatResponse(message) {
  // First check if it matches an FAQ
  const faqMatch = findFAQMatch(message);
  if (faqMatch) {
    return faqMatch.answer;
  }

  // Get relevant products for this query
  const relevantProducts = getRelevantProducts(message, 10);
  
  let productContext = '';
  if (relevantProducts.length > 0) {
    productContext = `
    
PRODUCTS AVAILABLE TO RECOMMEND:
${relevantProducts.map(p => 
  `- ${p.name} by ${p.brand} ($${typeof p.price === 'number' ? p.price.toFixed(2) : p.price}) - ${p.description}`
).join('\n')}

Only recommend products from the list above. Include exact names and prices.`;
  }

  const prompt = `You are a professional salon consultant. A client says: "${message}"

Provide helpful, professional advice about hair care, skin care, or beauty treatments. Keep your response to 2-3 sentences, warm and professional.${productContext}`;

  // Try AI APIs
  const apis = [
    { name: 'anthropic', key: ANTHROPIC_API_KEY, func: callAnthropicAPI },
    { name: 'openai', key: OPENAI_API_KEY, func: callOpenAIAPI },
    { name: 'gemini', key: GEMINI_API_KEY, func: callGeminiAPI }
  ];

  for (const api of apis) {
    if (api.key) {
      try {
        const response = await api.func(prompt, api.key);
        return response;
      } catch (error) {
        console.warn(`[CHAT] ${api.name} failed:`, error.message);
      }
    }
  }

  return 'I can help you find the perfect products for your needs. What specific concerns do you have with your hair or skin?';
}

// API FUNCTIONS
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
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);
  const data = await response.json();
  return data.content[0]?.text || 'I can help you with your salon needs.';
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
      max_tokens: 300,
      temperature: 0.7
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0]?.message?.content || 'I can help you with your salon needs.';
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
        maxOutputTokens: 300,
        temperature: 0.7
      }
    })
  });

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text || 'I can help you with your salon needs.';
}

// API ROUTES
app.get('/api/products', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    let products = [];
    
    if (query.trim() && SALON_PRODUCTS.length > 0) {
      // Use your real products
      products = getRelevantProducts(query, 100);
    } else {
      // Show all products if no query
      products = SALON_PRODUCTS.slice();
    }

    const total = products.length;
    const paginatedProducts = products.slice(offset, offset + limit);

    const response = {
      success: true,
      total: total,
      offset: offset,
      limit: limit,
      query: query,
      aiGenerated: false, // These are real products
      items: paginatedProducts.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        image: selectProductImage(p.name, p.category),
        description: p.description,
        benefits: p.benefits || [],
        usage: p.usage || '',
        ingredients: p.ingredients || '',
        suitableFor: p.suitableFor || 'Professional recommendation'
      }))
    };
    
    console.log(`[API] Returning ${paginatedProducts.length} of ${total} real products`);
    res.json(response);
    
  } catch (error) {
    console.error('[API] Products error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load products',
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
        response: 'Hi! I\'m your salon AI consultant. I can help with product recommendations, hair care advice, and questions about salon services. What would you like to know?' 
      });
    }
    
    const response = await generateChatResponse(message);
    res.json({ success: true, response });
    
  } catch (error) {
    console.error('[API] Chat error:', error);
    res.json({ 
      success: true, 
      response: 'I\'m here to help with your hair and beauty questions. Please try asking again.' 
    });
  }
});

// FAQ endpoint
app.get('/api/faqs', (req, res) => {
  res.json({ 
    success: true, 
    faqs: SALON_FAQS 
  });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    productCount: SALON_PRODUCTS.length,
    faqCategories: Object.keys(SALON_FAQS).length,
    apis: {
      openai: !!OPENAI_API_KEY,
      gemini: !!GEMINI_API_KEY,
      anthropic: !!ANTHROPIC_API_KEY
    },
    sampleProduct: SALON_PRODUCTS[0] || null
  });
});

app.get('/healthz', (req, res) => {
  res.json({ 
    status: 'ok', 
    products: SALON_PRODUCTS.length,
    faqs: Object.keys(SALON_FAQS).length,
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
  console.log(`[SERVER] Salon AI listening on port ${PORT}`);
  console.log(`[PRODUCTS] ${SALON_PRODUCTS.length} real products loaded`);
  console.log(`[FAQS] ${Object.keys(SALON_FAQS).length} FAQ categories loaded`);
  console.log(`[SERVER] Ready for consultations`);
});
