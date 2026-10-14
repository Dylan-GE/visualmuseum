import { useEffect, useState } from 'react';
import ModelPreview from './ModelPreview';
import ItemQRCode from './ItemQRCode';
import { ArIcon, CollectIcon, DragIcon, FactIcons, WheelIcon } from './MuseumIcons';
import { getItemTypeLabel, RARITY_LABEL } from '../utils/itemTheme';

const hasText = (v) => typeof v === 'string' && v.trim() !== '' && !/待確認|待補/.test(v);
const RARITY_STARS = { Legendary: 5, Epic: 4, Rare: 3, Common: 1 };

function Overlay({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="specimen-overlay" role="dialog" aria-modal="true">
      <div className="specimen-overlay__backdrop" onClick={onClose} />
      {children}
    </div>
  );
}

function DetailView({ item, unlocked, onClose, onEnterGame }) {
  const story = item.history?.mining_story || item.history?.use_value;
  const stars = RARITY_STARS[item.rarity] ?? 1;
  const facts = [
    ['材質', 'material', item.spec?.material],
    ['用途', 'function', item.spec?.function],
    ['外觀', 'appearance', item.spec?.appearance],
    ['歷史故事', 'history', story],
  ].filter(([, , text]) => hasText(text));

  return (
    <div className="specimen-modal glass-panel">
      <button className="specimen-modal__close" type="button" aria-label="關閉" onClick={onClose}>
        ✕
      </button>

      <div className="specimen-photo">
        <div className="specimen-photo__frame" aria-label={`${item.name}三維模型`}>
          <div className="specimen-preview">
            <ModelPreview item={item} variant="dark" />
          </div>
        </div>
        <div className="specimen-photo__hints">
          <span>
            <DragIcon />
            拖曳旋轉
          </span>
          <span>
            <WheelIcon />
            滾輪縮放
          </span>
        </div>
      </div>

      <div className="specimen-info">
        <div className="specimen-info__top">
          <div className="specimen-name-block">
            <h2 className="specimen-name">{item.name}</h2>
            <span className="specimen-latin">{getItemTypeLabel(item.type)}</span>
          </div>
          <div className="specimen-rarity">
            <span className="specimen-rarity__label">稀有度・{RARITY_LABEL[item.rarity] ?? item.rarity}</span>
            <div className="specimen-stars" aria-label={`稀有度 ${stars} 顆星`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`star${n <= stars ? ' filled' : ''}`} aria-hidden="true">
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>

        {facts.length > 0 && (
          <>
            <div className="specimen-section-label">
              <span className="specimen-section-label__gem" aria-hidden="true">
                ⚙
              </span>
              展品資訊
            </div>
            <dl className="specimen-facts">
              {facts.map(([label, icon, text]) => {
                const Icon = FactIcons[icon];
                return (
                  <div className="specimen-fact" key={label}>
                    <div className="specimen-fact__icon" aria-hidden="true">
                      <Icon />
                    </div>
                    <div className="specimen-fact__body">
                      <dt>{label}</dt>
                      <dd>{text}</dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </>
        )}

        <div className="specimen-bottom">
          {item.ar?.glb ? (
            <div className="specimen-ar glass-panel">
              <div className="specimen-ar__icon" aria-hidden="true">
                <ArIcon />
              </div>
              <div className="specimen-ar__qr">
                <ItemQRCode itemId={item.id} size={60} />
              </div>
              <div className="specimen-ar__text">
                <strong>AR / QR Code</strong>
                <p>
                  用手機掃描 QR Code
                  <br />
                  在自己的空間中
                  <br />
                  以 1:1 實物大小觀察！
                </p>
              </div>
            </div>
          ) : (
            <div />
          )}
          <button className="specimen-collect" type="button" onClick={onEnterGame}>
            <span className="specimen-collect__icon" aria-hidden="true">
              <CollectIcon />
            </span>
            <span>
              <b>遊戲收藏</b>
              <small>{unlocked ? '已收藏・再看看' : '答題加入圖鑑'}</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function GameView({ item, unlocked, onBack, onClose, onOpenCollection, onCorrectAnswer }) {
  const [answerIndex, setAnswerIndex] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => {
      setCooldown((c) => {
        const next = c - 1;
        if (next <= 0) setAnswerIndex(null);
        return next;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const hasQuiz = !!item.quiz;
  const isCorrect = hasQuiz && answerIndex === item.quiz.correct_index;
  const showSuccess = unlocked || isCorrect;

  const handleAnswer = (i) => {
    if (cooldown > 0 || showSuccess) return;
    setAnswerIndex(i);
    if (i === item.quiz.correct_index) {
      onCorrectAnswer(item);
    } else {
      setCooldown(10);
    }
  };

  return (
    <div className="quiz-modal glass-panel">
      <button className="specimen-modal__close" type="button" aria-label="關閉" onClick={onClose}>
        ✕
      </button>

      <button className="quiz-back" type="button" onClick={onBack}>
        ‹ 返回
      </button>

      <h2 className="specimen-name quiz-title">{item.name}</h2>
      <span className="specimen-latin">遊戲收藏</span>

      {!hasQuiz && <p className="quiz-empty">測驗尚未提供，敬請期待。</p>}

      {hasQuiz && showSuccess && (
        <div className="quiz-success">
          <p className="quiz-feedback quiz-feedback--ok">✓ 答對了！已收藏「{item.name}」</p>
          <button className="specimen-collect" type="button" onClick={onOpenCollection}>
            <span className="specimen-collect__icon" aria-hidden="true">
              <CollectIcon />
            </span>
            <span>
              <b>查看圖鑑</b>
              <small>看看收藏進度</small>
            </span>
          </button>
        </div>
      )}

      {hasQuiz && !showSuccess && (
        <>
          <p className="quiz-question">{item.quiz.question}</p>
          <div className="quiz-options">
            {item.quiz.options.map((opt, i) => (
              <button
                key={opt}
                type="button"
                className={`quiz-option${answerIndex === i ? (i === item.quiz.correct_index ? ' correct' : ' wrong') : ''}`}
                disabled={cooldown > 0}
                onClick={() => handleAnswer(i)}
              >
                {opt}
              </button>
            ))}
          </div>
          {answerIndex !== null && !isCorrect && (
            <p className="quiz-feedback quiz-feedback--wrong">✗ 答錯了，請於 {cooldown} 秒後再試一次</p>
          )}
        </>
      )}
    </div>
  );
}

export default function ItemDetailModal({ item, unlocked, onClose, onOpenCollection, onCorrectAnswer }) {
  const [view, setView] = useState('detail');

  useEffect(() => {
    setView('detail');
  }, [item?.id]);

  if (!item) return null;

  return (
    <Overlay onClose={onClose}>
      {view === 'detail' ? (
        <DetailView item={item} unlocked={unlocked} onClose={onClose} onEnterGame={() => setView('game')} />
      ) : (
        <GameView
          item={item}
          unlocked={unlocked}
          onBack={() => setView('detail')}
          onClose={onClose}
          onOpenCollection={onOpenCollection}
          onCorrectAnswer={onCorrectAnswer}
        />
      )}
    </Overlay>
  );
}
