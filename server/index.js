import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { PERSONAS, getPersonaSystemPrompt } from './personas.js';

const PORT = process.env.PORT || 8787;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 500;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[ai-guide-server] 缺少 ANTHROPIC_API_KEY 環境變數，AI 導覽將無法運作。請參考 .env.example 設定。');
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.get('/api/ai-guide/health', (_req, res) => {
  res.json({ ok: true, hasApiKey: !!process.env.ANTHROPIC_API_KEY });
});

app.post('/api/ai-guide/chat', async (req, res) => {
  const { persona, message, history } = req.body ?? {};

  if (!PERSONAS[persona]) {
    return res.status(400).json({ error: `未知的角色：${persona}` });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: '訊息不可為空' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `訊息過長（上限 ${MAX_MESSAGE_LENGTH} 字）` });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI 導覽尚未設定 API 金鑰，請聯絡網站管理員。' });
  }

  const trimmedHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
  const anthropicMessages = trimmedHistory
    .filter((m) => m && typeof m.text === 'string' && (m.from === 'user' || m.from === 'bot'))
    .map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));
  anthropicMessages.push({ role: 'user', content: message.trim() });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: getPersonaSystemPrompt(persona),
      messages: anthropicMessages,
    });
    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    res.json({ reply: reply || '（沒有取得回覆，請再試一次）' });
  } catch (err) {
    console.error('[ai-guide-server] Anthropic API 呼叫失敗：', err?.message ?? err);
    res.status(502).json({ error: 'AI 導覽暫時無法回應，請稍後再試。' });
  }
});

app.listen(PORT, () => {
  console.log(`[ai-guide-server] listening on http://localhost:${PORT}`);
});
