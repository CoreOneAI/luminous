// server.js - Unified AI Salon API

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

app.use(express.static(path.join(__dirname, 'public')));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

// Correctly load products.json
let productsData = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8');
  productsData = JSON.parse(data);
  console.log('Products data loaded successfully.');
} catch (error) {
  console.error('Failed to load products.json:', error);
}

function getProducts(query) {
  const queryLower = query.toLowerCase();
  
  const relevantProducts = productsData.filter(p => {
    const nameMatches = p.name?.toLowerCase().includes(queryLower) ?? false;
    const brandMatches = p.brand?.toLowerCase().includes(queryLower) ?? false;
    const categoryMatches = p.category?.toLowerCase().includes(queryLower) ?? false;
    const instructionsMatches = p.instructions?.toLowerCase().includes(queryLower) ?? false;
    return nameMatches || brandMatches || categoryMatches || instructionsMatches;
  });

  return relevantProducts.slice(0, 25);
}

async function getAIResponse(prompt) {
  if (!aiClient) {
    return "I'm sorry, the AI service is not available.";
  }

  const userPrompt = `You are an expert salon consultant. The user asked: "${prompt}". Please provide a brief and helpful answer, limited to 100 words.`;

  try {
    let response;
    switch (aiModel) {
      case 'openai':
        response = await aiClient.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: userPrompt }],
        });
        return response.choices[0].message.content;
      case 'anthropic':
        response = await aiClient.messages.create({
          model: "claude-3-opus-20240229",
          max_tokens: 150,
          messages: [{ role: "user", content: userPrompt }],
        });
        return response.content[0].text;
      case 'gemini':
        const result = await aiClient.generateContent(userPrompt);
        return result.response.text();
      default:
        return "I'm sorry, the AI model is not configured.";
    }
  } catch (error) {
    console.error(`AI API call failed with model ${aiModel}:`, error);
    return "I'm sorry, I could not process your request with the AI. Please try again later.";
  }
}

app.post('/api/unified-service', async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const productKeywords = ['shampoo', 'conditioner', 'serum', 'mask', 'cleanser', 'products', 'skincare', 'haircare', 'lipsticks', 'nail', 'tanning', 'eyelashes', 'brush', 'tool', 'cream', 'lotion', 'repair', 'dye', 'anti-aging', 'antiaging'];
    const isProductSearch = productKeywords.some(keyword => message.toLowerCase().includes(keyword));

    let chatResponseText = await getAIResponse(message);
    let products = [];
    
    if (isProductSearch) {
      products = getProducts(message);
      chatResponseText += `\n\nHere are some relevant products to get you started.`;
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
