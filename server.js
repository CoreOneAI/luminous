// server.js - Unified AI Salon API (Final Version)

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

// 4. Initialize AI clients and determine the active model
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
    "name": "Manic Panic Amplified - Vampire Red",
    "brand": "Manic Panic",
    "category": "Bright Color",
    "instructions": "Apply to pre-lightened, dry hair. Wear gloves. Leave on for 30-45 minutes. Rinse with cool water until it runs clear. Avoid shampooing for 24-48 hours.",
    "priceCents": 2199
  },
  {
    "name": "Arctic Fox Semi-Permanent Hair Color - Poseidon",
    "brand": "Arctic Fox",
    "category": "Bright Color",
    "instructions": "Apply to bleached hair. Conditioner can be added to dilute. Process for at least 30 minutes. Rinse with cold water. Vegan and cruelty-free.",
    "priceCents": 2299
  },
  {
    "name": "Pravana ChromaSilk Vivids - Neon Tangerine",
    "brand": "Pravana",
    "category": "Bright Color",
    "instructions": "For professional use only. Apply to pre-lightened hair. Process for 20-45 minutes under heat or as desired. Rinse with cool water.",
    "priceCents": 3499
  },
  {
    "name": "Splat Rebellious Colors - Atomic Pink",
    "brand": "Splat",
    "category": "Bright Color",
    "instructions": "Kit includes bleaching system. Follow included instructions carefully. Perform a patch test 48 hours prior to application.",
    "priceCents": 1899
  },
  {
    "name": "L'Oreal Colorista Semi-Permanent - Purple",
    "brand": "L'Oreal",
    "category": "Bright Color",
    "instructions": "Shake well. Apply to pre-lightened hair. Leave for 15-30 minutes. Rinse with cold water. Lasts 4-10 shampoos.",
    "priceCents": 1599
  },
  {
    "name": "Good Dye Young Semi-Permanent - Ex-Girl",
    "brand": "Good Dye Young",
    "category": "Bright Color",
    "instructions": "Apply to light blonde hair for best results. Leave on for 15-30 minutes. Rinse with cold water. Conditions while it colors.",
    "priceCents": 2399
  },
  {
    "name": "Joico Color Intensity - Sapphire Blue",
    "brand": "Joico",
    "category": "Bright Color",
    "instructions": "Professional formula. Provides intense shine. Apply to pre-lightened hair. Process for 20-35 minutes. Rinse and style.",
    "priceCents": 2799
  },
  {
    "name": "Lime Crime Unicorn Hair - Sext",
    "brand": "Lime Crime",
    "category": "Bright Color",
    "instructions": "Apply to blonde hair for true color. Wear gloves. Process for 20-40 minutes. Rinse with cool water. Vegan.",
    "priceCents": 2599
  },
  {
    "name": "Adore Creative Image - Paprika",
    "brand": "Adore",
    "category": "Bright Color",
    "instructions": "Alcohol-free, conditioning formula. Apply to clean, damp hair. Do not rinse out. Style as usual. For subtle tint on dark hair or vibrant color on light hair.",
    "priceCents": 1399
  },
  {
    "name": "Pulp Riot Semi-Permanent - Fireball",
    "brand": "Pulp Riot",
    "category": "Bright Color",
    "instructions": "Professional use. Apply to pre-lightened hair. Process for 20-30 minutes. Can be mixed with other Pulp Riot colors to create custom shades.",
    "priceCents": 3799
  },
  {
    "name": "Schwarzkopf Igora Vibrance - 0-88 Royal Blue",
    "brand": "Schwarzkopf",
    "category": "Bright Color",
    "instructions": "Professional salon product. Can be mixed with conditioner for a pastel or used direct for high impact. Process for 20 minutes.",
    "priceCents": 3299
  },
  {
    "name": "Directions Semi-Permanent - Alpine Green",
    "brand": "Directions",
    "category": "Bright Color",
    "instructions": "Apply to bleached hair. Leave for 15-30 minutes. Rinse with cool water. Famous for its bold, long-lasting pigment.",
    "priceCents": 1499
  },
  {
    "name": "Arctic Fox - Purple Rain",
    "brand": "Arctic Fox",
    "category": "Bright Color",
    "instructions": "Apply to pre-lightened hair. Can be mixed with conditioner for a lighter shade. Leave on for 30+ minutes. 100% vegan.",
    "priceCents": 2299
  },
  {
    "name": "Manic Panic Classic - Electric Lizard",
    "brand": "Manic Panic",
    "category": "Bright Color",
    "instructions": "Apply to platinum blonde hair for a vibrant neon green. Wear gloves. Process for 30 minutes. Rinse with cool water.",
    "priceCents": 1999
  },
  {
    "name": "Pravana ChromaSilk Vivids - Green",
    "brand": "Pravana",
    "category": "Bright Color",
    "instructions": "Professional use only. Apply to pre-lightened hair. For best results, process under a dryer for 25-30 minutes.",
    "priceCents": 3499
  },
  {
    "name": "Splat - Blue Envy",
    "brand": "Splat",
    "category": "Bright Color",
    "instructions": "Complete kit with bleach. Ensure hair is untreated 24 hours before application. Follow all safety instructions on the box.",
    "priceCents": 1899
  },
  {
    "name": "L'Oreal Colorista Washout - Burgundy",
    "brand": "L'Oreal",
    "category": "Bright Color",
    "instructions": "Temporary color. Apply to dry hair. Leave for 10-20 minutes. Washes out in 1-2 shampoos. Perfect for trying a new look.",
    "priceCents": 1499
  },
  {
    "name": "Good Dye Young - Blue Ruin",
    "brand": "Good Dye Young",
    "category": "Bright Color",
    "instructions": "Apply to light blonde hair. For a deeper blue, leave on for up to 45 minutes. Rinse with cold water. Conditions hair.",
    "priceCents": 2399
  },
  {
    "name": "Joico Color Intensity - Rose",
    "brand": "Joico",
    "category": "Bright Color",
    "instructions": "Professional formula. Provides rich, long-lasting pink color with a high-shine finish. Apply to pre-lightened hair.",
    "priceCents": 2799
  },
  {
    "name": "Lime Crime Unicorn Hair - Chocolate Cherry",
    "brand": "Lime Crime",
    "category": "Bright Color",
    "instructions": "Deep burgundy shade. Apply to light brown or lighter hair for best results. Process for 20-40 minutes. Vegan and cruelty-free.",
    "priceCents": 2599
  },
  {
    "name": "Clairol Professional Pure White Wella Color Charm",
    "brand": "Wella",
    "category": "Gray Coverage",
    "instructions": "For professional use. Mix with developer. Apply to regrowth first, then pull through to ends. Process for up to 45 minutes. Covers 100% gray.",
    "priceCents": 1299
  },
  {
    "name": "L'Oreal Excellence Creme - Natural Black",
    "brand": "L'Oreal",
    "category": "Gray Coverage",
    "instructions": "Apply to dry, unwashed hair. Use applicator bottle for precise application to roots. Process for 30 minutes. Rinse thoroughly.",
    "priceCents": 1599
  },
  {
    "name": "Garnier Nutrisse Nourishing Color Creme - Soft Black",
    "brand": "Garnier",
    "category": "Gray Coverage",
    "instructions": "Includes a nourishing cream conditioner with avocado oil. Apply to regrowth. Process for 25 minutes. Rinse until water runs clear.",
    "priceCents": 1399
  },
  {
    "name": "Revlon Colorsilk - Medium Brown",
    "brand": "Revlon",
    "category": "Gray Coverage",
    "instructions": "Ammonia-free formula. Mix color and developer. Apply to hair. Process for 25 minutes. Rinse and shampoo.",
    "priceCents": 899
  },
  {
    "name": "Schwarzkopf Keratin Color - Dark Blonde",
    "brand": "Schwarzkopf",
    "category": "Gray Coverage",
    "instructions": "With keratin. Gently covers gray while caring for hair. Apply to roots. Process for 30 minutes. Rinse with water, then shampoo.",
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
  },
  {
    "name": "Glycolic Acid Exfoliator",
    "brand": "The Ordinary",
    "category": "Anti-Aging",
    "instructions": "Use once daily in the evening. Apply to a cotton pad and sweep across face. Do not rinse.",
    "priceCents": 1200
  },
  {
    "name": "Retinol Serum 1%",
    "brand": "Paula's Choice",
    "category": "Anti-Aging",
    "instructions": "Apply a pea-sized amount in the evening after cleansing. Follow with a moisturizer. Use sunscreen during the day.",
    "priceCents": 5500
  },
  {
    "name": "Vitamin C Suspension 23% + HA Spheres 2%",
    "brand": "The Ordinary",
    "category": "Anti-Aging",
    "instructions": "Apply a small amount to your face in the AM or PM. Tingling may be felt. Do not use with niacinamide.",
    "priceCents": 700
  },
  {
    "name": "Collagen Peptide Serum",
    "brand": "The Inkey List",
    "category": "Anti-Aging",
    "instructions": "Use morning and night. Apply a few drops to cleansed face and neck before moisturizer.",
    "priceCents": 1500
  },
  {
    "name": "Neutrogena Rapid Wrinkle Repair",
    "brand": "Neutrogena",
    "category": "Anti-Aging",
    "instructions": "Apply nightly to face and neck. Can be used in the morning with a sunscreen. Start with every other day to build tolerance.",
    "priceCents": 2500
  },
  {
    "name": "Bondi Boost Miracle Mask",
    "brand": "Bondi Boost",
    "category": "Hair Repair",
    "instructions": "Apply to clean, damp hair. Leave on for 5-10 minutes. Rinse thoroughly. Formulated to repair damaged hair.",
    "priceCents": 2900
  },
  {
    "name": "Amika The Kure Intense Repair Mask",
    "brand": "Amika",
    "category": "Hair Repair",
    "instructions": "Use after shampooing. Leave on for 10-15 minutes. Rinse. Strengthens and repairs damaged hair.",
    "priceCents": 4000
  }
];

// Helper function for a more sophisticated product search
function getProducts(query, profile) {
  const queryLower = query.toLowerCase();
  const productSearch = productsData.filter(p => {
    const nameMatches = p.name?.toLowerCase().includes(queryLower) ?? false;
    const brandMatches = p.brand?.toLowerCase().includes(queryLower) ?? false;
    const categoryMatches = p.category?.toLowerCase().includes(queryLower) ?? false;
    const instructionsMatches = p.instructions?.toLowerCase().includes(queryLower) ?? false;
    return nameMatches || brandMatches || categoryMatches || instructionsMatches;
  });
  
  if (productSearch.length === 0) {
    return productsData.slice(0, 25);
  }
  return productSearch.slice(0, 25);
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
    const productKeywords = ['shampoo', 'conditioner', 'serum', 'mask', 'cleanser', 'products', 'skincare', 'haircare', 'lipsticks', 'nail', 'tanning', 'eyelashes', 'brush', 'tool', 'cream', 'lotion', 'repair', 'dye', 'anti-aging', 'antiaging'];
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

    // Process the chat response to add typewriter effect
    let processedResponse = chatResponseText;
    const paragraphs = processedResponse.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    processedResponse = paragraphs.map(p => `<p class="chat-paragraph">${p}</p>`).join('');

    res.json({
      chatResponse: processedResponse,
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
