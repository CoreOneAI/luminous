// server.js - Unified AI Salon API (Final Version)

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Use the AI clients from the previous successful run.
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

const productsData = [
  { "name": "Manic Panic Amplified - Vampire Red", "brand": "Manic Panic", "category": "Bright Color", "instructions": "Apply to pre-lightened, dry hair. Wear gloves. Leave on for 30-45 minutes. Rinse with cool water until it runs clear. Avoid shampooing for 24-48 hours.", "priceCents": 2199, "image": "q89266q8926.jpg" },
  { "name": "Arctic Fox Semi-Permanent Hair Color - Poseidon", "brand": "Arctic Fox", "category": "Bright Color", "instructions": "Apply to bleached hair. Conditioner can be added to dilute. Process for at least 30 minutes. Rinse with cold water. Vegan and cruelty-free.", "priceCents": 2299, "image": "xmmaulx.jpg" },
  { "name": "Pravana ChromaSilk Vivids - Neon Tangerine", "brand": "Pravana", "category": "Bright Color", "instructions": "For professional use only. Apply to pre-lightened hair. Process for 20-45 minutes under heat or as desired. Rinse with cool water.", "priceCents": 3499, "image": "6ol6t96ol6t96ol6.jpg" },
  { "name": "Splat Rebellious Colors - Atomic Pink", "brand": "Splat", "category": "Bright Color", "instructions": "Kit includes bleaching system. Follow included instructions carefully. Perform a patch test 48 hours prior to application.", "priceCents": 1899, "image": "w7tu8vw.jpg" },
  { "name": "L'Oreal Colorista Semi-Permanent - Purple", "brand": "L'Oreal", "category": "Bright Color", "instructions": "Shake well. Apply to pre-lightened hair. Leave for 15-30 minutes. Rinse with cold water. Lasts 4-10 shampoos.", "priceCents": 1599, "image": "3gtwh3gtwh3g.jpg" },
  { "name": "Good Dye Young Semi-Permanent - Ex-Girl", "brand": "Good Dye Young", "category": "Bright Color", "instructions": "Apply to light blonde hair for best results. Leave on for 15-30 minutes. Rinse with cold water. Conditions while it colors.", "priceCents": 2399, "image": "foleozfol.jpg" },
  { "name": "Joico Color Intensity - Sapphire Blue", "brand": "Joico", "category": "Bright Color", "instructions": "Professional formula. Provides intense shine. Apply to pre-lightened hair. Process for 20-35 minutes. Rinse and style.", "priceCents": 2799, "image": "plvpakplvpakplvp.jpg" },
  { "name": "Lime Crime Unicorn Hair - Sext", "brand": "Lime Crime", "category": "Bright Color", "instructions": "Apply to blonde hair for true color. Wear gloves. Process for 20-40 minutes. Rinse with cool water. Vegan.", "priceCents": 2599, "image": "q89266q8926.jpg" },
  { "name": "Adore Creative Image - Paprika", "brand": "Adore", "category": "Bright Color", "instructions": "Alcohol-free, conditioning formula. Apply to clean, damp hair. Do not rinse out. Style as usual. For subtle tint on dark hair or vibrant color on light hair.", "priceCents": 1399, "image": "xmmaulx.jpg" },
  { "name": "Pulp Riot Semi-Permanent - Fireball", "brand": "Pulp Riot", "category": "Bright Color", "instructions": "Professional use. Apply to pre-lightened hair. Process for 20-30 minutes. Can be mixed with other Pulp Riot colors to create custom shades.", "priceCents": 3799, "image": "6ol6t96ol6t96ol6.jpg" },
  { "name": "Olaplex No. 3 Hair Perfecter", "brand": "Olaplex", "category": "Hair Repair", "instructions": "Apply to damp hair, comb through. Leave on for a minimum of 10 minutes. Rinse, shampoo, and condition. Repairs and strengthens hair.", "priceCents": 3000, "image": "w7tu8vw.jpg" },
  { "name": "K18 Leave-In Molecular Repair Hair Mask", "brand": "K18", "category": "Hair Repair", "instructions": "Shampoo, do not condition. Towel dry hair. Apply mask. Wait 4 minutes. Do not rinse out. Style as usual. Repairs damage in 4 minutes.", "priceCents": 7500, "image": "3gtwh3gtwh3g.jpg" },
  { "name": "Living Proof Triple Bond Complex", "brand": "Living Proof", "category": "Hair Repair", "instructions": "Apply to clean, damp hair from roots to ends. Wait 10 minutes. Rinse. Repairs all types of hair damage.", "priceCents": 4500, "image": "foleozfol.jpg" },
  { "name": "Redken Acidic Bonding Concentrate", "brand": "Redken", "category": "Hair Repair", "instructions": "Apply after shampooing. Leave on for 5-10 minutes. Rinse thoroughly. Provides ultimate strength and conditioning on damaged hair.", "priceCents": 3000, "image": "plvpakplvpakplvp.jpg" },
  { "name": "Pureology Hydrate Shampoo", "brand": "Pureology", "category": "Hair Repair", "instructions": "Apply a dime-sized amount to wet hair. Lather. Rinse thoroughly. Hydrates and repairs hair.", "priceCents": 2900, "image": "q89266q8926.jpg" },
  { "name": "Kerastase Resistance Ciment Thermique", "brand": "Kerastase", "category": "Hair Repair", "instructions": "Apply to towel-dried hair. Style with a blow dryer or heat tool. Protects from heat and strengthens hair fiber.", "priceCents": 3800, "image": "xmmaulx.jpg" },
  { "name": "Moroccanoil Treatment Oil", "brand": "Moroccanoil", "category": "Hair Repair", "instructions": "Apply a small amount to clean, towel-dried hair, from mid-length to ends. Blow-dry or let dry naturally. Conditions and adds shine.", "priceCents": 4400, "image": "6ol6t96ol6t96ol6.jpg" },
  { "name": "Sukin Foaming Facial Cleanser", "brand": "Sukin", "category": "Skincare", "instructions": "Use as directed for beauty/wellness care", "priceCents": 1200, "image": "w7tu8vw.jpg" },
  { "name": "Endota Spa Hydration Mask", "brand": "Endota Spa", "category": "Skincare", "instructions": "Use as directed for beauty/wellness care", "priceCents": 4500, "image": "3gtwh3gtwh3g.jpg" },
  { "name": "Aesop Parsley Seed Serum", "brand": "Aesop", "category": "Skincare", "instructions": "Use as directed for beauty/wellness care", "priceCents": 6000, "image": "foleozfol.jpg" },
  { "name": "Korres Greek Yoghurt Foaming Cleanser", "brand": "Korres", "category": "Skincare", "instructions": "Massage onto damp skin, rinse off.", "priceCents": 2800, "image": "plvpakplvpakplvp.jpg" },
  { "name": "Bioderma Sensibio H2O Micellar Water", "brand": "Bioderma", "category": "Skincare", "instructions": "Use as directed for beauty/wellness care", "priceCents": 2000, "image": "q89266q8926.jpg" },
  { "name": "CeraVe Moisturizing Cream", "brand": "CeraVe", "category": "Skincare", "instructions": "Use as directed for beauty/wellness care", "priceCents": 1500, "image": "xmmaulx.jpg" },
  { "name": "The Face Shop Rice Water Bright Cleanser", "brand": "The Face Shop", "category": "Skincare", "instructions": "Use as directed for beauty/wellness care", "priceCents": 1000, "image": "6ol6t96ol6t96ol6.jpg" },
  { "name": "Tatcha The Water Cream", "brand": "Tatcha", "category": "Skincare", "instructions": "Use as directed for beauty/wellness care", "priceCents": 6800, "image": "w7tu8vw.jpg" },
  { "name": "Drunk Elephant Vitamin C Serum", "brand": "Drunk Elephant", "category": "Skincare", "instructions": "Use as directed for beauty/wellness care", "priceCents": 7800, "image": "3gtwh3gtwh3g.jpg" },
  { "name": "Olay Regenerist Micro-Sculpting Cream", "brand": "Olay", "category": "Skincare", "instructions": "Use as directed for beauty/wellness care", "priceCents": 3000, "image": "foleozfol.jpg" },
  { "name": "Nivea Soft Cream", "brand": "Nivea", "category": "Skincare", "instructions": "Use as directed for beauty/wellness care", "priceCents": 800, "image": "plvpakplvpakplvp.jpg" },
  { "name": "Mavala Nail Hardener", "brand": "Mavala", "category": "Nail Care", "instructions": "Apply once or twice a week on clean nails.", "priceCents": 1500, "image": "q89266q8926.jpg" },
  { "name": "Risqué Nail Polish", "brand": "Risqué", "category": "Nail Care", "instructions": "Use as directed for beauty/wellness care", "priceCents": 800, "image": "xmmaulx.jpg" },
  { "name": "Essie Nail Polish", "brand": "Essie", "category": "Nail Care", "instructions": "Use as directed for beauty/wellness care", "priceCents": 900, "image": "6ol6t96ol6t96ol6.jpg" },
  { "name": "Glycolic Acid Exfoliator", "brand": "The Ordinary", "category": "Anti-Aging", "instructions": "Use once daily in the evening. Apply to a cotton pad and sweep across face. Do not rinse.", "priceCents": 1200, "image": "w7tu8vw.jpg" },
  { "name": "Retinol Serum 1%", "brand": "Paula's Choice", "category": "Anti-Aging", "instructions": "Apply a pea-sized amount in the evening after cleansing. Follow with a moisturizer. Use sunscreen during the day.", "priceCents": 5500, "image": "3gtwh3gtwh3g.jpg" },
  { "name": "Vitamin C Suspension 23% + HA Spheres 2%", "brand": "The Ordinary", "category": "Anti-Aging", "instructions": "Apply a small amount to your face in the AM or PM. Tingling may be felt. Do not use with niacinamide.", "priceCents": 700, "image": "foleozfol.jpg" },
  { "name": "Collagen Peptide Serum", "brand": "The Inkey List", "category": "Anti-Aging", "instructions": "Use morning and night. Apply a few drops to cleansed face and neck before moisturizer.", "priceCents": 1500, "image": "plvpakplvpakplvp.jpg" },
  { "name": "Neutrogena Rapid Wrinkle Repair", "brand": "Neutrogena", "category": "Anti-Aging", "instructions": "Apply nightly to face and neck. Can be used in the morning with a sunscreen. Start with every other day to build tolerance.", "priceCents": 2500, "image": "q89266q8926.jpg" },
  { "name": "Bondi Boost Miracle Mask", "brand": "Bondi Boost", "category": "Hair Repair", "instructions": "Apply to clean, damp hair. Leave on for 5-10 minutes. Rinse thoroughly. Formulated to repair damaged hair.", "priceCents": 2900, "image": "xmmaulx.jpg" },
  { "name": "Amika The Kure Intense Repair Mask", "brand": "Amika", "category": "Hair Repair", "instructions": "Use after shampooing. Leave on for 10-15 minutes. Rinse. Strengthens and repairs damaged hair.", "priceCents": 4000, "image": "6ol6t96ol6t96ol6.jpg" },
  { "name": "Disposable Tanning Mitt", "brand": "St. Tropez", "category": "Accessories", "instructions": "Use with self-tanning products to ensure a streak-free application.", "priceCents": 1000, "image": "w7tu8vw.jpg" },
  { "name": "Makeup Remover Wipes", "brand": "Neutrogena", "category": "Accessories", "instructions": "Use to quickly and gently remove makeup.", "priceCents": 800, "image": "3gtwh3gtwh3g.jpg" },
  { "name": "Foundation Brush", "brand": "Real Techniques", "category": "Accessories", "instructions": "Use to apply liquid or cream foundation for a smooth, airbrushed finish.", "priceCents": 1200, "image": "foleozfol.jpg" },
  { "name": "Blending Sponge", "brand": "Beautyblender", "category": "Accessories", "instructions": "Use damp to apply and blend foundation, concealer, and other face products.", "priceCents": 2000, "image": "plvpakplvpakplvp.jpg" },
  { "name": "Heated Eyelash Curler", "brand": "Panasonic", "category": "Accessories", "instructions": "Gently curl eyelashes for a long-lasting lift.", "priceCents": 2500, "image": "q89266q8926.jpg" }
  ];

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
    // This function will handle the AI response based on the message.
    // For now, we will return a hardcoded response to fix the UI first.
    return "Thank you for your question. Here are some product recommendations.";
  }

  class UnifiedSalonAI {
    constructor() {
      this.currentQuery = '';
      this.isLoading = false;
      this.chatInput = qs('#chatInput');
      this.chatBtn = qs('#chatBtn');
      this.chatResponse = qs('#chatResponse');
      this.aiStatus = qs('#aiStatus');
      this.status = qs('#status');
      this.grid = qs('#productsGrid');
      this.productsSection = qs('#productsSection');
      this.welcomeSection = qs('.welcome-section');
      this.homeNavBtn = qs('#homeNavBtn');
      this.profileNavBtn = qs('#profileNavBtn');
      this.appointmentsNavBtn = qs('#appointmentsNavBtn');
      this.basketNavBtn = qs('#basketNavBtn');
      this.exampleBtns = qsa('.example-btn');
      this.bind();
      this.welcome();
    }

    bind() {
      this.chatBtn?.addEventListener('click', () => this.handleAsk());
      this.chatInput?.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !this.isLoading) this.handleAsk();
      });
      this.homeNavBtn?.addEventListener('click', () => this.startNewSearch());
      this.profileNavBtn?.addEventListener('click', () => this.showComingSoon("My Profile"));
      this.appointmentsNavBtn?.addEventListener('click', () => this.showComingSoon("Appointments"));
      this.basketNavBtn?.addEventListener('click', () => this.showComingSoon("Basket"));

      this.exampleBtns.forEach(btn => {
          btn.addEventListener('click', () => this.handleAsk(btn.dataset.query));
      });
      
      this.grid.addEventListener('click', e => {
          const detailsBtn = e.target.closest('.details-btn');
          if (detailsBtn) {
              const card = e.target.closest('.product-card');
              const productName = card.querySelector('.product-name').textContent;
              const product = productsData.find(p => p.name === productName);
              this.details(product);
          }
      });
    }

    welcome() {
      this.productsSection.style.display = 'none';
      this.welcomeSection.style.display = 'block';
      this.chatResponse.innerHTML = `
        <div style="text-align:center;color:#666;">
          <h3 style="color:#333;margin-bottom:12px;">Welcome to Your AI Salon</h3>
          <p style="margin-bottom:16px;">I'm here to give you personalized product recommendations.</p>
          <p style="font-size:13px;"><strong>Try:</strong></p>
          <ul style="text-align:left;font-size:12px;margin-top:8px;padding-left:20px;">
            <li>"shampoo"</li>
            <li>"serum"</li>
            <li>"bond repair"</li>
            <li>"accessories"</li>
          </ul>
        </div>`;
    }

    async handleAsk(message = this.chatInput?.value) {
      if (!message || this.isLoading) return;
      this.currentQuery = message;

      this.isLoading = true;
      if (this.chatBtn) { this.chatBtn.disabled = true; this.chatBtn.textContent = '...'; }
      this.aiStatus?.classList.add('active');
      this.welcomeSection.style.display = 'none';

      try {
        const productKeywords = ['shampoo', 'conditioner', 'serum', 'mask', 'cleanser', 'skincare', 'haircare', 'lipsticks', 'nail', 'tanning', 'eyelashes', 'brush', 'tool', 'cream', 'lotion', 'repair', 'dye', 'anti-aging', 'antiaging', 'accessories'];
        const isProductSearch = productKeywords.some(keyword => message.toLowerCase().includes(keyword));

        let chatResponse = '';
        let products = [];
        
        if (isProductSearch) {
          const matchingProducts = productsData.filter(p => productKeywords.some(keyword => (p.name + p.category).toLowerCase().includes(keyword)));
          
          if (matchingProducts.length > 0) {
            products = matchingProducts.slice(0, 25);
            chatResponse = `Here are some products that match your search.`;
          } else {
            chatResponse = `I'm sorry, I couldn't find any products that match your search.`;
          }
        } else {
          chatResponse = `Thank you for your question! I'm designed to provide product recommendations. Please try asking about a specific product or a type of product.`;
          products = [];
        }
        
        this.renderChat(chatResponse);
        this.renderProducts(products);

      } catch (err) {
        console.error('Front-end logic failed:', err);
        this.renderChat("An error occurred while processing your request. Please try again.");
        this.empty();
      }

      if (this.chatInput) this.chatInput.value = '';
      this.isLoading = false;
      if (this.chatBtn) { this.chatBtn.disabled = false; this.chatBtn.textContent = 'Ask AI'; }
      this.aiStatus?.classList.remove('active');
    }
    
    renderChat(text) {
      if (!this.chatResponse) return;
      
      const chatContainer = qs('#chatResponse');
      chatContainer.innerHTML = '';
      
      const p = document.createElement('p');
      p.className = 'chat-paragraph';
      p.textContent = text;
      chatContainer.appendChild(p);
    }

    renderProducts(products) {
      this.productsSection.style.display = 'block';
      this.grid.innerHTML = '';
      
      if (products.length > 0) {
          products.forEach(p => this.grid.appendChild(this.card(p)));
      } else {
          this.empty();
      }
    }
    
    card(p) {
      const div = document.createElement('div');
      div.className = `product-card`;
      const price = formatCents(p.priceCents);
      const benefits = p.benefits?.length ? `<div class="product-benefits">${p.benefits.map(b=>`<span class="benefit-tag">${b}</span>`).join('')}</div>` : '';
      div.innerHTML = `
        <div class="product-content">
          <img class="product-image" loading="lazy" referrerpolicy="no-referrer"
               src="${(p.image||'').replace(/"/g,'&quot;')}"
               alt="${(p.name||'Product').replace(/"/g,'&quot;')}"
               onerror="this.outerHTML='<div class=\\'product-image-placeholder\\'>💆‍♀️</div>'">
          <div class="product-info">
            <div class="product-name">${p.name}</div>
            <div class="product-meta">${p.brand} • ${p.category}</div>
            ${p.description ? `<div class="product-description">${p.description}</div>` : ''}
            ${benefits}
            <div class="product-footer">
              <div class="product-price">${price}</div>
              <div class="product-actions">
                <button class="details-btn">Details</button>
              </div>
            </div>
          </div>
        </div>`;
      div.querySelector('.details-btn')?.addEventListener('click', () => this.details(p));
      return div;
    }

    details(p) {
      const lines = [];
      if (p.usage) lines.push(`Usage: ${p.usage}`);
      if (p.instructions) lines.push(`Instructions: ${p.instructions}`);
      if (p.ingredients) lines.push(`Key Ingredients: ${p.ingredients}`);
      if (p.benefits?.length) lines.push(`Benefits: ${p.benefits.join(', ')}`);
      alert(`${p.name}\n\n${lines.join('\n\n') || p.description || 'Professional salon product.'}`);
    }

    empty() {
      if (!this.grid) return;
      this.grid.innerHTML = `
        <div class="empty-state">
          <h3>No products found</h3>
          <p>Try a different search or be more specific about your needs.</p>
        </div>`;
      this.productsSection.style.display = 'block';
    }
    
    startNewSearch() {
        window.scrollTo(0, 0);
        this.currentQuery = '';
        this.grid.innerHTML = '';
        this.productsSection.style.display = 'none';
        this.status.textContent = '';
        this.welcome();
    }
    
    showComingSoon(feature) {
        alert(`${feature} functionality is coming soon!`);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.salonAI = new UnifiedSalonAI();
  });
})();
</script>
</body>
</html>
