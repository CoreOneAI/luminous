import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Load products from JSON for product recommendations when explicitly requested
const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/data/products.json'), 'utf8'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint for AI chat
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get AI response with advice and optional product recommendations
    const response = await simulateAIResponse(message);
    
    res.json({ response });
  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simulated AI response function
async function simulateAIResponse(message) {
  const lowerMessage = message.toLowerCase();
  let responseText = '';
  
  // Provide advice for specific concerns
  if (lowerMessage.includes('damaged') && lowerMessage.includes('hair')) {
    responseText = "For damaged hair, I recommend:\n\n1. Use a deep conditioning treatment weekly\n2. Avoid heat styling tools\n3. Try a protein treatment\n4. Use a wide-tooth comb instead of brushing\n5. Trim split ends regularly\n6. Consider a silk pillowcase to reduce friction";
  } else if (lowerMessage.includes('wrinkle') || lowerMessage.includes('aging')) {
    responseText = "For aging skin and wrinkles, I suggest:\n\n1. Use a retinoid product (start with low concentration)\n2. Apply vitamin C serum in the morning\n3. Don't forget sunscreen daily (SPF 30+)\n4. Incorporate hyaluronic acid for hydration\n5. Consider peptides for collagen production\n6. Stay hydrated and maintain a healthy diet";
  } else if (lowerMessage.includes('acne') || lowerMessage.includes('breakout')) {
    responseText = "For acne-prone skin:\n\n1. Use a gentle salicylic acid cleanser\n2. Spot treat with benzoyl peroxide\n3. Avoid heavy, pore-clogging products\n4. Don't pick or pop pimples\n5. Change pillowcases regularly\n6. Consider non-comedogenic moisturizers";
  } else {
    responseText = "Thank you for your question! As an AI beauty consultant, I can provide advice on hair care, skincare, makeup, and salon services. For more specific recommendations, please tell me more about your concerns or what you'd like to improve.";
  }

  // Only include product recommendations if explicitly requested
  let recommendedProducts = [];
  if (lowerMessage.includes('recommend products') || lowerMessage.includes('product recommendations')) {
    recommendedProducts = products.filter(p => {
      return p.name.toLowerCase().includes(lowerMessage) ||
             p.brand.toLowerCase().includes(lowerMessage) ||
             p.category.toLowerCase().includes(lowerMessage);
    });
    if (recommendedProducts.length > 0) {
      responseText += "\n\nBased on your request, here are some product recommendations:\n" + 
        recommendedProducts.map(p => `- ${p.name} by ${p.brand} (${p.category})`).join('\n');
    } else {
      responseText += "\n\nNo specific products found matching your query.";
    }
  }

  return { text: responseText, products: recommendedProducts };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export for testing
export default app;
