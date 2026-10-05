import { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

const PERSONAS = [
  { key: 'miner', label: '老礦工', welcome: '少年仔，想問啥米坑道的代誌，儘管問老歐吉桑！' },
  { key: 'goldRush', label: '淘金客', welcome: '嘿！想聽聽當年九份淘金的瘋狂故事嗎？' },
  { key: 'geologist', label: '地質學家', welcome: '您好，我是這裡的地質顧問，有任何礦物相關問題都可以問我。' },
];

export default function AIGuideHUD() {
  const [open, setOpen] = useState(false);
  const [persona, setPersona] = useState(PERSONAS[0].key);
  const [messages, setMessages] = useState({
    miner: [{ from: 'bot', text: PERSONAS[0].welcome }],
    goldRush: [{ from: 'bot', text: PERSONAS[1].welcome }],
    geologist: [{ from: 'bot', text: PERSONAS[2].welcome }],
  });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const currentMessages = messages[persona] ?? [];

  const appendMessage = (personaKey, message) => {
    setMessages((prev) => ({ ...prev, [personaKey]: [...prev[personaKey], message] }));
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const history = currentMessages;
    appendMessage(persona, { from: 'user', text });
    setDraft('');
    setSending(true);
    try {
      const res = await fetch('/api/ai-guide/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona, message: text, history }),
      });
      const data = await res.json();
      appendMessage(persona, {
        from: 'bot',
        text: res.ok ? data.reply : (data.error ?? '（AI 導覽暫時無法回應，請稍後再試）'),
      });
    } catch {
      appendMessage(persona, { from: 'bot', text: '（連線失敗，請確認網路後再試一次）' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ai-guide-hud">
      <button className="ai-guide-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? <X size={16} /> : <MessageCircle size={16} />}
        <span>AI 地質嚮導</span>
      </button>

      {open && (
        <div className="ai-guide-panel">
          <div className="ai-persona-select">
            {PERSONAS.map((p) => (
              <button
                key={p.key}
                className={`ai-persona-btn${persona === p.key ? ' active' : ''}`}
                onClick={() => setPersona(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="ai-messages">
            {currentMessages.map((m, i) => (
              <div key={i} className={`ai-message ${m.from}`}>
                {m.text}
              </div>
            ))}
            {sending && <div className="ai-message bot">思考中…</div>}
          </div>

          <div className="ai-input-row">
            <input
              className="ai-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="輸入問題..."
              disabled={sending}
            />
            <button className="ai-send-btn" onClick={handleSend} disabled={sending}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
