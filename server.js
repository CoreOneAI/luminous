// server.js - Unified AI Salon API

// 1. Import necessary libraries
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 2. Initialize Express app and middleware
const app = express();
app.use(express.json());
app.use(cors());

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

// 5. Load product data from a static file (products.json or similar)
// We'll assume a local file for this example.
const productsData = require('./products.json');

// Helper function to handle product data and filtering
function getProducts(query, profile) {
    // Implement the filtering logic we discussed previously, using the query and profile data
    // This function will return an array of filtered products.
    // Example:
    // return productsData.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
}

// 6. The Unified API Endpoint
app.post('/api/unified-service', async (req, res) => {
  const { message, profile } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    // Logic to determine if the query is a product search or a general question
    const productKeywords = ['shampoo', 'conditioner', 'serum', 'mask', 'cleanser', 'products'];
    const isProductSearch = productKeywords.some(keyword => message.toLowerCase().includes(keyword));

    let chatResponseText;
    let products = [];

    if (isProductSearch) {
      // It's a product search: find products and provide a brief chat summary
      products = getProducts(message, profile);
      chatResponseText = `Based on your request, here are some professional salon products for you.`;
    } else {
      // It's a general question: call the AI model for a response
      // This is where you will add your AI API call logic.
      // Example for OpenAI:
      // const completion = await aiClient.chat.completions.create({
      //   messages: [{ role: "user", content: `You are an expert salon consultant. ${message}` }],
      //   model: "gpt-3.5-turbo",
      // });
      // chatResponseText = completion.choices[0].message.content;
      
      // For now, we'll use a placeholder response
      chatResponseText = "I'm sorry, I can only provide recommendations for products at this time. Please ask about a product or a type of product.";
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

// 7. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
