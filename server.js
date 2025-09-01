// server.js - Unified AI Salon API

// 1. Import necessary libraries using ES module syntax
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Initialize Express app and middleware
const app = express();

// Use helmet middleware to set security headers, including a basic CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], // Allow resources from the same origin
      imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
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

// 4. Initialize AI clients based on available keys
let aiClient;
let aiModel;
if (OPENAI_API_KEY) {
  aiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  aiModel = 'openai';
} else if (ANTHROPIC_API_KEY) {
  aiClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  aiModel = 'anthropic';
} else if (GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  aiClient = genAI.getGenerativeModel({ model: "gemini-pro" });
  aiModel = 'gemini';
} else {
  console.error("No AI API key found. AI chat functionality will not work.");
}

// 5. Load product data synchronously on startup
let productsData = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8');
  productsData = JSON.parse(data);
  console.log('Products data loaded successfully.');
} catch (error) {
  console.error('Failed to load products.json:', error);
}

// Helper function to handle product data and filtering
function getProducts(query, profile) {
  const queryLower = query.toLowerCase();
  
  const filteredProducts = productsData.filter(p => {
    const nameMatches = p.name?.toLowerCase().includes(queryLower) ?? false;
    const categoryMatches = p.category?.toLowerCase().includes(queryLower) ?? false;
    return nameMatches || categoryMatches;
  });

  return filteredProducts;
}

// 6. The Unified API Endpoint
app.post('/api/unified-service', async (req, res) => {
  const { message, profile } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const productKeywords = ['shampoo', 'conditioner', 'serum', 'mask', 'cleanser', 'products', 'skincare', 'haircare', 'lipsticks', 'nail', 'tanning', 'eyelashes', 'brush', 'tool', 'cream', 'lotion'];
    const isProductSearch = productKeywords.some(keyword => message.toLowerCase().includes(keyword));

    let chatResponseText;
    let products = [];

    if (isProductSearch) {
      products = getProducts(message, profile);
      chatResponseText = `Based on your request, here are some professional salon products for you.`;
    } else {
      if (aiClient) {
        chatResponseText = `Hello! I am an AI salon consultant. I can provide product recommendations or answer general beauty questions based on your provided information.`;
      } else {
        chatResponseText = "I'm sorry, I could not connect to the AI service.";
      }
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
