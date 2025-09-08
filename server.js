import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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
    
    // In a real implementation, you would call OpenAI, Gemini, or Anthropic API here
    // For now, we'll simulate a response
    const response = await simulateAIResponse(message);
    
    res.json({ response });
  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simulated AI response function
async function simulateAIResponse(message) {
  // This is a simplified simulation - in production, you would call a real AI API
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('damaged') && lowerMessage.includes('hair')) {
    return "For damaged hair, I recommend:\n\n1. Use a deep conditioning treatment weekly\n2. Avoid heat styling tools\n3. Try a protein treatment like Olaplex No. 3\n4. Use a wide-tooth comb instead of brushing\n5. Trim split ends regularly\n6. Consider a silk pillowcase to reduce friction\n\nWould you like product recommendations for damaged hair?";
  }
  
  if (lowerMessage.includes('wrinkle') || lowerMessage.includes('aging')) {
    return "For aging skin and wrinkles, I suggest:\n\n1. Use a retinoid product (start with low concentration)\n2. Apply vitamin C serum in the morning\n3. Don't forget sunscreen daily (SPF 30+)\n4. Incorporate hyaluronic acid for hydration\n5. Consider peptides for collagen production\n6. Stay hydrated and maintain a healthy diet\n\nWould you like specific product recommendations?";
  }
  
  if (lowerMessage.includes('acne') || lowerMessage.includes('breakout')) {
    return "For acne-prone skin:\n\n1. Use a gentle salicylic acid cleanser\n2. Spot treat with benzoyl peroxide\n3. Avoid heavy, pore-clogging products\n4. Don't pick or pop pimples\n5. Change pillowcases regularly\n6. Consider non-comedogenic moisturizers\n\nWould you like me to recommend specific products for your skin type?";
  }
  
  // Default response for other questions
  return "Thank you for your question! As an AI beauty consultant, I can provide advice on hair care, skincare, makeup, and salon services. For more specific recommendations, please tell me more about your concerns or what you'd like to improve.";
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
