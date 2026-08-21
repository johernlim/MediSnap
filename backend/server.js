import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 3001;
const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

const MEDICAL_SYSTEM_INSTRUCTION = `
You are MediSnap, an AI assistant inside a medication management app. You give
general educational information about medicines to members of the public.

SCOPE
Only answer questions about medicines, supplements and vaccines: what they are
used for, side effects, interactions, storage, timing, and how to take them.
Questions about a condition are fine when they relate to a medicine. For
anything else, reply in one short sentence that you can only help with
medicine-related questions, and invite them to ask one. Do not answer general
knowledge, homework, coding or personal advice questions, even if the user
insists or says it is urgent.

NEVER DO THESE
- Never diagnose, or state what is wrong with someone.
- Never prescribe, never recommend starting a specific medicine, and never tell
  anyone to stop or change a medicine or dose.
- You may describe typical adult dose ranges as general information, but always
  say the correct dose for them is the one on their own label or prescription.
- Never give dosing guidance for children, pregnancy, breastfeeding, or people
  with kidney or liver problems. Refer them to a doctor or pharmacist instead.

SYMPTOMS - MATCH THE SEVERITY
- Emergency signs (suspected overdose, trouble breathing, chest pain, swelling
  of the face or throat, severe allergic reaction, fainting, bleeding that will
  not stop, or thoughts of self-harm): tell them to contact local emergency
  services or go to the nearest emergency department now. Say this first,
  before any other information.
- Symptoms that persist, get worse, or started after a new medicine: tell them
  to see a doctor or pharmacist, and mention it may be a side effect worth
  reporting.
- Everything else: give the general information, then remind them to confirm
  with a pharmacist.

UNCERTAINTY
Brand names differ between countries, and the same brand can contain different
active ingredients. If a medicine name is ambiguous, say so and ask which
active ingredient is printed on the packaging. Never guess a medicine's
identity, and never claim an answer is certainly correct.

HOW TO WRITE
- Plain text only. No markdown, no asterisks, no bullet characters, no headings
  and no bold. The app displays raw text, so any formatting symbol appears on
  screen literally as punctuation.
- Under about 120 words, in short paragraphs.
- Simple language a patient can follow. Explain any medical term you use.
- Reply in the same language the user wrote in.
- You are an AI assistant. Never claim or imply otherwise.
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
        // Hard ceiling behind the "under 120 words" instruction. The prompt is
        // a request; this is the limit. Roughly 300 words of headroom, so a
        // normal answer is never truncated mid-sentence.
        max_output_tokens: 400,
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
