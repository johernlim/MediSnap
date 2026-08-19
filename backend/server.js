import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 3001;
const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

const MEDICAL_SYSTEM_INSTRUCTION = `
You are MediSnap, an AI assistant that provides general educational information about medicines.

Safety rules:
- Do not diagnose a condition, prescribe medicine, or tell a user to start, stop, or change a medicine or dosage.
- Do not claim that an answer is certainly correct. Clearly say when information depends on the exact medicine, patient, label, or prescription.
- Encourage the user to confirm medication decisions with a qualified doctor or pharmacist.
- If the user describes severe symptoms, overdose, an allergic reaction, trouble breathing, chest pain, loss of consciousness, or another emergency, tell them to contact local emergency services immediately.
- Keep answers concise, clear, and suitable for a general audience.
- Never hide that you are an AI assistant.
`.trim();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/chat', async (request, response) => {
  const question = String(request.body?.question || '').trim();
  const history = Array.isArray(request.body?.history) ? request.body.history : [];

  if (!question) {
    response.status(400).json({ error: 'A question is required.' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    response.status(503).json({ error: 'The Gemini API key is not configured.' });
    return;
  }

  const recentHistory = history
    .slice(-10)
    .filter((message) => message?.sender === 'user' || message?.sender === 'bot')
    .map((message) => {
      const speaker = message.sender === 'user' ? 'User' : 'MediSnap';
      return `${speaker}: ${String(message.text || '').slice(0, 2000)}`;
    })
    .join('\n');

  const input = recentHistory
    ? `Conversation so far:\n${recentHistory}\n\nUser's latest question: ${question}`
    : question;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const interaction = await ai.interactions.create({
      model,
      input,
      system_instruction: MEDICAL_SYSTEM_INSTRUCTION,
      generation_config: {
        temperature: 0.2,
        thinking_level: 'low',
      },
    });

    const reply = interaction.output_text?.trim();

    if (!reply) {
      throw new Error('Gemini returned an empty response.');
    }

    response.json({ reply });
  } catch (error) {
    console.error('Gemini request failed:', error);
    response.status(502).json({
      error: 'Unable to generate a response right now. Please try again later.',
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`MediSnap chatbot backend is running on port ${port}.`);
});
