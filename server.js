// server.js - Unified AI Salon API

// 1. Import necessary libraries using ES module syntax
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Initialize Express app and middleware
const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
    },
  },
}));
app.use(express.json());
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// 3. Load API keys from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 4. Initialize AI clients with error handling
let aiClient;
let aiModel;
try {
  if (OPENAI_API_KEY) {
    aiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
    aiModel = 'openai';
    console.log('OpenAI client initialized.');
  } else if (ANTHROPIC_API_KEY) {
    aiClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    aiModel = 'anthropic';
    console.log('Anthropic client initialized.');
  } else if (GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    aiClient = genAI.getGenerativeModel({ model: "gemini-pro" });
    aiModel = 'gemini';
    console.log('Gemini client initialized.');
  } else {
    console.error("No AI API key found. AI chat functionality will not work.");
  }
} catch (e) {
  console.error("Failed to initialize an AI client:", e.message);
}

// 5. Product Data is now EMBEDDED within the server file to prevent loading issues
const productsData = [
  {
    "name": "Hair Dye Bright Shade #1",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 2199
  },
  {
    "name": "Hair Dye Bright Shade #2",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 2299
  },
  {
    "name": "Hair Dye Bright Shade #3",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 3499
  },
  {
    "name": "Hair Dye Bright Shade #4",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1899
  },
  {
    "name": "Hair Dye Bright Shade #5",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1599
  },
  {
    "name": "Hair Dye Bright Shade #6",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 2399
  },
  {
    "name": "Hair Dye Bright Shade #7",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 2799
  },
  {
    "name": "Hair Dye Bright Shade #8",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 2599
  },
  {
    "name": "Hair Dye Bright Shade #9",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1399
  },
  {
    "name": "Hair Dye Bright Shade #10",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 3799
  },
  {
    "name": "Hair Dye Bright Shade #11",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 3299
  },
  {
    "name": "Hair Dye Bright Shade #12",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1499
  },
  {
    "name": "Hair Dye Bright Shade #13",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 2299
  },
  {
    "name": "Hair Dye Bright Shade #14",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1999
  },
  {
    "name": "Hair Dye Bright Shade #15",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 3499
  },
  {
    "name": "Hair Dye Bright Shade #16",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1899
  },
  {
    "name": "Hair Dye Bright Shade #17",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1499
  },
  {
    "name": "Hair Dye Bright Shade #18",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 2399
  },
  {
    "name": "Hair Dye Bright Shade #19",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 2799
  },
  {
    "name": "Hair Dye Bright Shade #20",
    "brand": "Specialty Beauty Product Categories",
    "category": "Bright Color",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 2599
  },
  {
    "name": "Hair Dye - Gray Coverage #1",
    "brand": "Specialty Beauty Product Categories",
    "category": "Gray Coverage",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1299
  },
  {
    "name": "Hair Dye - Gray Coverage #2",
    "brand": "Specialty Beauty Product Categories",
    "category": "Gray Coverage",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1599
  },
  {
    "name": "Hair Dye - Gray Coverage #3",
    "brand": "Specialty Beauty Product Categories",
    "category": "Gray Coverage",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1399
  },
  {
    "name": "Hair Dye - Gray Coverage #4",
    "brand": "Specialty Beauty Product Categories",
    "category": "Gray Coverage",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 899
  },
  {
    "name": "Hair Dye - Gray Coverage #5",
    "brand": "Specialty Beauty Product Categories",
    "category": "Gray Coverage",
    "instructions": "Use as directed by product instructions or under professional supervision.",
    "priceCents": 1699
  },
  {
    "name": "Olaplex No. 3 Hair Perfector",
    "brand": "Olaplex",
    "category": "Hair Repair",
    "instructions": "Apply to damp hair, comb through. Leave on for a minimum of 10 minutes. Rinse, shampoo, and condition. Repairs and strengthens hair.",
    "priceCents": 3000
  },
  {
    "name": "K18 Leave-In Molecular Repair Hair Mask",
    "brand": "K18",
    "category": "Hair Repair",
    "instructions": "Shampoo, do not condition. Towel dry hair. Apply mask. Wait 4 minutes. Do not rinse out. Style as usual. Repairs damage in 4 minutes.",
    "priceCents": 7500
  },
  {
    "name": "Living Proof Triple Bond Complex",
    "brand": "Living Proof",
    "category": "Hair Repair",
    "instructions": "Apply to clean, damp hair from roots to ends. Wait 10 minutes. Rinse. Repairs all types of hair damage.",
    "priceCents": 4500
  },
  {
    "name": "Redken Acidic Bonding Concentrate",
    "brand": "Redken",
    "category": "Hair Repair",
    "instructions": "Apply after shampooing. Leave on for 5-10 minutes. Rinse thoroughly. Provides ultimate strength and conditioning on damaged hair.",
    "priceCents": 3000
  },
  {
    "name": "Pureology Hydrate Shampoo",
    "brand": "Pureology",
    "category": "Hair Repair",
    "instructions": "Apply a dime-sized amount to wet hair. Lather. Rinse thoroughly. Hydrates and repairs hair.",
    "priceCents": 2900
  },
  {
    "name": "Kerastase Resistance Ciment Thermique",
    "brand": "Kerastase",
    "category": "Hair Repair",
    "instructions": "Apply to towel-dried hair. Style with a blow dryer or heat tool. Protects from heat and strengthens hair fiber.",
    "priceCents": 3800
  },
  {
    "name": "Moroccanoil Treatment Oil",
    "brand": "Moroccanoil",
    "category": "Hair Repair",
    "instructions": "Apply a small amount to clean, towel-dried hair, from mid-length to ends. Blow-dry or let dry naturally. Conditions and adds shine.",
    "priceCents": 4400
  },
  {
    "name": "Andis GTX-EXO II Cordless Li Trimmer #561752",
    "brand": "Andis",
    "category": "Styling Tools",
    "instructions": "Professional trimmer for barbers.",
    "priceCents": 22999
  },
  {
    "name": "Sukin Foaming Facial Cleanser",
    "brand": "Sukin",
    "category": "Skincare",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 1200
  },
  {
    "name": "Endota Spa Hydration Mask",
    "brand": "Endota Spa",
    "category": "Skincare",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 4500
  },
  {
    "name": "Aesop Parsley Seed Serum",
    "brand": "Aesop",
    "category": "Skincare",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 6000
  },
  {
    "name": "Korres Greek Yoghurt Foaming Cleanser",
    "brand": "Korres",
    "category": "Skincare",
    "instructions": "Massage onto damp skin, rinse off.",
    "priceCents": 2800
  },
  {
    "name": "Bioderma Sensibio H2O Micellar Water",
    "brand": "Bioderma",
    "category": "Skincare",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 2000
  },
  {
    "name": "CeraVe Moisturizing Cream",
    "brand": "CeraVe",
    "category": "Skincare",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 1500
  },
  {
    "name": "The Face Shop Rice Water Bright Cleanser",
    "brand": "The Face Shop",
    "category": "Skincare",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 1000
  },
  {
    "name": "Tatcha The Water Cream",
    "brand": "Tatcha",
    "category": "Skincare",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 6800
  },
  {
    "name": "Drunk Elephant Vitamin C Serum",
    "brand": "Drunk Elephant",
    "category": "Skincare",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 7800
  },
  {
    "name": "Olay Regenerist Micro-Sculpting Cream",
    "brand": "Olay",
    "category": "Skincare",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 3000
  },
  {
    "name": "Nivea Soft Cream",
    "brand": "Nivea",
    "category": "Skincare",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 800
  },
  {
    "name": "Mavala Nail Hardener",
    "brand": "Mavala",
    "category": "Nail Care",
    "instructions": "Apply once or twice a week on clean nails.",
    "priceCents": 1500
  },
  {
    "name": "Risqué Nail Polish",
    "brand": "Risqué",
    "category": "Nail Care",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 800
  },
  {
    "name": "Essie Nail Polish",
    "brand": "Essie",
    "category": "Nail Care",
    "instructions": "Use as directed for beauty/wellness care",
    "priceCents": 900
  }
];

// Helper function for a more sophisticated product search
function getProducts(query, profile) {
  const queryLower = query.toLowerCase();
  
  // Fuzzy search: find products that match the query in their name, brand, category, or instructions
  const filteredProducts = productsData.filter(p => {
    const nameMatches = p.name?.toLowerCase().includes(queryLower) ?? false;
    const brandMatches = p.brand?.toLowerCase().includes(queryLower) ?? false;
    const categoryMatches = p.category?.toLowerCase().includes(queryLower) ?? false;
    const instructionsMatches = p.instructions?.toLowerCase().includes(queryLower) ?? false;
    return nameMatches || brandMatches || categoryMatches || instructionsMatches;
  });

  return filteredProducts;
}

// Helper function to call the AI based on the active model
async function getAIResponse(prompt) {
  if (!aiClient) {
    return "I'm sorry, the AI service is not available.";
  }

  try {
    let response;
    switch (aiModel) {
      case 'openai':
        response = await aiClient.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        });
        return response.choices[0].message.content;
      case 'anthropic':
        response = await aiClient.messages.create({
          model: "claude-3-opus-20240229",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });
        return response.content[0].text;
      case 'gemini':
        const result = await aiClient.generateContent(prompt);
        return result.response.text();
      default:
        return "I'm sorry, the AI model is not configured.";
    }
  } catch (error) {
    console.error(`AI API call failed with model ${aiModel}:`, error);
    return "I'm sorry, I could not process your request with the AI. Please try again later.";
  }
}

// 6. The Unified API Endpoint
app.post('/api/unified-service', async (req, res) => {
  const { message, profile } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const productKeywords = ['shampoo', 'conditioner', 'serum', 'mask', 'cleanser', 'products', 'skincare', 'haircare', 'lipsticks', 'nail', 'tanning', 'eyelashes', 'brush', 'tool', 'cream', 'lotion', 'repair', 'dye'];
    const isProductSearch = productKeywords.some(keyword => message.toLowerCase().includes(keyword));

    let chatResponseText;
    let products = [];

    if (isProductSearch) {
      products = getProducts(message, profile);
      
      const productNames = products.map(p => p.name).join(', ');
      const prompt = `You are an expert salon consultant. The user asked for products related to "${message}". Based on the available products: ${productNames}, provide a brief and friendly introductory message.`;
      chatResponseText = await getAIResponse(prompt);
      
    } else {
      const prompt = `You are an expert salon consultant. The user asked: "${message}". Please provide a detailed and helpful answer.`;
      chatResponseText = await getAIResponse(prompt);
      
      products = productsData.slice(0, 25);
    }

    res.json({
      chatResponse: chatResponseText,
      products: products,
    });

  } catch (error) {
    console.error('Error processing unified request:', error);
    res.status(500).json({
      chatResponse: "I'm sorry, an error occurred while processing your request. Please try again later.",
      products: [],
    });
  }
});

// 7. Serve the index.html file for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 8. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
