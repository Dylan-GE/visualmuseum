import { useEffect, useRef, useState } from 'react';
import minerAvatar from '../assets/ai/miner.webp';
import geologistAvatar from '../assets/ai/geologist.webp';
import goldRushAvatar from '../assets/ai/goldRush.webp';
import { SendIcon } from './MuseumIcons';
import { SUGGESTED_QUESTIONS, scriptedReply } from '../utils/scriptedGuide';

// 目前還沒有串接真正的 AI，預設用預先寫好的問答（scripted）。
// 之後有 API 金鑰、後端上線時，把 VITE_AI_MODE 設成 api 就會改呼叫 /api/ai-guide/chat。
const USE_API = import.meta.env.VITE_AI_MODE === 'api';

// key 要對應 server/personas.js；welcome 是第一句開場白。
const PERSONAS = [
  {
    key: 'miner',
    label: '老礦工',
    role: '資深坑道領路人',
    avatar: minerAvatar,
    welcome: '少年仔，想問啥米坑道的代誌，儘管問老歐吉桑！',
  },
  {
    key: 'geologist',
    label: '地質學家',
    role: '礦物與地層解說員',
    avatar: geologistAvatar,
    welcome: '您好，我是這裡的地質顧問，有任何礦物相關問題都可以問我。',
  },
  {
    key: 'goldRush',
    label: '淘金客',
    role: '黃金傳說追尋者',
    avatar: goldRushAvatar,
    welcome: '嘿！想聽聽當年九份淘金的瘋狂故事嗎？',
  },
];

const initialMessages = () =>
  Object.fromEntries(PERSONAS.map((p) => [p.key, [{ from: 'bot', text: p.welcome }]]));

// 右側滑出的 AI 助手面板（美編設計）：先選導覽夥伴，再對話。
export default function AIGuideHUD({ open, onClose, zone, items = [], zones = [] }) {
  const zoneName = zone?.name;
  const [personaKey, setPersonaKey] = useState(null); // null = 角色選擇畫面
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const persona = PERSONAS.find((p) => p.key === personaKey);
  const current = personaKey ? messages[personaKey] : [];

  // 每次打開都從角色選擇開始
  useEffect(() => {
    if (open) setPersonaKey(null);
  }, [open]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [current.length, sending]);

  const append = (key, message) => setMessages((prev) => ({ ...prev, [key]: [...prev[key], message] }));

  const ask = async (rawText) => {
    const text = rawText.trim();
    if (!text || sending || !persona) return;
    const key = persona.key;
    const history = messages[key];
    append(key, { from: 'user', text });
    setDraft('');
    setSending(true);
    try {
      if (!USE_API) {
        // 假裝想一下，比較像在對話
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
        append(key, { from: 'bot', text: scriptedReply(key, text, { items, zones, currentZone: zone }) });
        return;
      }
      const res = await fetch('/api/ai-guide/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: key, message: text, history, context: { zone: zoneName } }),
      });
      const data = await res.json();
      append(key, { from: 'bot', text: res.ok ? data.reply : (data.error ?? '（AI 導覽暫時無法回應，請稍後再試）') });
    } catch {
      append(key, { from: 'bot', text: '（連線失敗，請確認網路後再試一次）' });
    } finally {
      setSending(false);
    }
  };

  const send = (e) => {
    e.preventDefault();
    ask(draft);
  };

  return (
    <aside
      className={`ai-side-panel glass-panel${open ? ' is-open' : ''}`}
      aria-label="AI 助手"
      aria-hidden={!open}
    >
      {!persona ? (
        <div className="ai-panel-pickerview">
          <div className="ai-panel__header">
            <h2>選擇導覽夥伴</h2>
            <button className="ai-panel__close" type="button" aria-label="關閉 AI 助手" onClick={onClose}>
              ✕
            </button>
          </div>
          <p className="ai-picker__sub">每位角色將以不同視角帶領您探索礦坑</p>
          <ul className="ai-character-list">
            {PERSONAS.map((p) => (
              <li key={p.key}>
                <button className="ai-character-card" type="button" onClick={() => setPersonaKey(p.key)}>
                  <img className="ai-avatar" src={p.avatar} alt={p.label} />
                  <span className="ai-character-info">
                    <b>{p.label}</b>
                    <small>{p.role}</small>
                  </span>
                  <span className="ai-character-arrow" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="ai-panel-chatview">
          <div className="ai-chat__header">
            <button className="ai-chat__back" type="button" aria-label="返回角色選擇" onClick={() => setPersonaKey(null)}>
              ‹
            </button>
            <div className="ai-chat__identity">
              <img className="ai-avatar ai-avatar--sm" src={persona.avatar} alt="" aria-hidden="true" />
              <div>
                <h2 className="ai-chat__name">{persona.label}</h2>
                <small className="ai-chat__role">{persona.role}</small>
              </div>
            </div>
            <div className="ai-chat__header-actions">
              <button className="ai-panel__close" type="button" aria-label="關閉" onClick={onClose}>
                ✕
              </button>
            </div>
          </div>
          {!USE_API && <p className="ai-test-note">測試版：目前只能回答預先準備好的問題</p>}
          <div className="ai-chat__messages" ref={listRef} aria-live="polite">
            {current.map((m, i) => (
              <div key={i} className={`ai-msg ai-msg--${m.from}`}>
                {m.from === 'bot' && <img className="ai-msg__avatar" src={persona.avatar} alt={persona.label} />}
                <p className="ai-msg__bubble">{m.text}</p>
              </div>
            ))}
            {sending && (
              <div className="ai-msg ai-msg--bot ai-typing">
                <img className="ai-msg__avatar" src={persona.avatar} alt={persona.label} />
                <p className="ai-msg__bubble">正在思考中…</p>
              </div>
            )}
          </div>
          {!USE_API && (
            <div className="ai-suggest" aria-label="建議問題">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button key={q} type="button" className="ai-suggest__chip" disabled={sending} onClick={() => ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <form className="ai-chat__input-row" onSubmit={send} autoComplete="off">
            <input
              className="ai-chat__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="輸入您的問題…"
              aria-label="輸入問題"
              maxLength={200}
              disabled={sending}
            />
            <button className="ai-chat__send" type="submit" aria-label="送出" disabled={sending}>
              <SendIcon />
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
