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

// 5. Load product data synchronously
let productsData = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8');
  productsData = JSON.parse(data);
  console.log('Products data loaded successfully.');
} catch (error) {
  console.error('Failed to load products.json:', error);
}

// Helper function for a more sophisticated product search
function getProducts(query, profile) {
    const queryLower = query.toLowerCase();
    
    // A simple filter to find products that match the query in their name, brand, category, or instructions
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
    const productKeywords = ['shampoo', 'conditioner', 'serum', 'mask', 'cleanser', 'products', 'skincare', 'haircare', 'lipsticks', 'nail', 'tanning', 'eyelashes', 'brush', 'tool', 'cream', 'lotion', 'oil'];
    const isProductSearch = productKeywords.some(keyword => message.toLowerCase().includes(keyword));

    let chatResponseText;
    let products = [];

    if (isProductSearch) {
      // It's a product search: find products and get a chat summary
      products = getProducts(message, profile);
      const productNames = products.map(p => p.name).join(', ');
      const prompt = `You are an expert salon consultant. The user asked for products related to "${message}". Based on the available products: ${productNames}, provide a brief and friendly introductory message.`;
      chatResponseText = await getAIResponse(prompt);
      
    } else {
      // It's a general question: get a full AI response
      const prompt = `You are an expert salon consultant. The user asked: "${message}". The available products are: ${JSON.stringify(productsData)}. Please provide a detailed and helpful answer, potentially mentioning some of the available products if relevant.`;
      chatResponseText = await getAIResponse(prompt);
      
      // If the response is a general question, we still want to show a broad range of products
      products = productsData.slice(0, 50); // Show a general selection if no specific products were requested
    }

    // Return the combined response
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
