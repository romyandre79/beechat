import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Gemini SDK with telemetry headers
const apiKey = process.env.GEMINI_API_KEY;
export let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
  }
} else {
}

// Reusable content generator with model fallback list
export async function generateAiContentWithFallback(prompt: string, responseMimeType?: string) {
  const GEMINI_MODELS = [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash-lite'
  ];

  if (!ai) return null;

  let lastError: any = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const options: any = {
        model: modelName,
        contents: prompt,
      };
      if (responseMimeType) {
        options.config = { responseMimeType };
      }
      const response = await ai.models.generateContent(options);
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
    }
  }
  throw lastError || new Error('All models failed to generate content.');
}
