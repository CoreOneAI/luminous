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
]
