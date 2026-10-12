import { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, X } from 'lucide-react';
import ModelPreview from './ModelPreview';
import ItemQRCode from './ItemQRCode';
import { getItemTypeLabel, getRarityColor, RARITY_LABEL } from '../utils/itemTheme';

const hasText = (v) => typeof v === 'string' && v.trim() !== '' && !/待確認|待補/.test(v);

function DetailView({ item, onClose, onEnterGame }) {
  const color = getRarityColor(item.rarity);
  const story = item.history?.mining_story || item.history?.use_value;

  return (
    <div className="modal-card modal-card-split" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose}>
        <X size={18} />
      </button>

      <div className="modal-preview">
        <ModelPreview item={item} />
      </div>

      <div className="modal-info">
        <div className="modal-header">
          <span className="modal-rarity" style={{ color, borderColor: color }}>
            {RARITY_LABEL[item.rarity] ?? item.rarity}・{getItemTypeLabel(item.type)}
          </span>
          <h2>{item.name}</h2>
        </div>

        {hasText(item.spec?.material) && (
          <section className="modal-section">
            <h3>材質</h3>
            <p>{item.spec.material}</p>
          </section>
        )}

        {hasText(item.spec?.function) && (
          <section className="modal-section">
            <h3>用途</h3>
            <p>{item.spec.function}</p>
          </section>
        )}

        {hasText(item.spec?.appearance) && (
          <section className="modal-section">
            <h3>外觀</h3>
            <p>{item.spec.appearance}</p>
          </section>
        )}

        {hasText(story) && (
          <section className="modal-section">
            <h3>歷史故事</h3>
            <p className="modal-story">{story}</p>
          </section>
        )}

        <div className="modal-footer">
          {item.ar?.glb ? (
            <div className="modal-qr">
              <ItemQRCode itemId={item.id} />
              <div>
                <div className="modal-qr-title">AR 檢視</div>
                <div className="modal-qr-caption">用手機掃描，在桌面上看 3D 模型</div>
              </div>
            </div>
          ) : (
            <div className="modal-qr" />
          )}
          <button className="modal-collection-btn" onClick={onEnterGame}>
            <Trophy size={16} />
            遊戲收藏
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
    <div className="modal-card modal-card-game" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose}>
        <X size={18} />
      </button>

      <button className="modal-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        返回
      </button>

      <h2 className="modal-game-title">{item.name}</h2>

      {!hasQuiz && <p className="modal-game-empty">測驗尚未提供，敬請期待。</p>}

      {hasQuiz && showSuccess && (
        <div className="modal-game-success">
          <p className="modal-feedback-correct">✓ 答對了！已收藏「{item.name}」</p>
          <button className="modal-collection-btn" onClick={onOpenCollection}>
            <Trophy size={16} />
            查看圖鑑
          </button>
        </div>
      )}

      {hasQuiz && !showSuccess && (
        <>
          <p className="modal-quiz-question">{item.quiz.question}</p>
          <div className="modal-quiz-options">
            {item.quiz.options.map((opt, i) => (
              <button
                key={opt}
                className={`modal-quiz-option${answerIndex === i ? (i === item.quiz.correct_index ? ' correct' : ' wrong') : ''}`}
                disabled={cooldown > 0}
                onClick={() => handleAnswer(i)}
              >
                {opt}
              </button>
            ))}
          </div>
          {answerIndex !== null && !isCorrect && (
            <p className="modal-feedback-wrong">✗ 答錯了，請於 {cooldown} 秒後再試一次</p>
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
    <div className="modal-backdrop" onClick={onClose}>
      {view === 'detail' ? (
        <DetailView item={item} onClose={onClose} onEnterGame={() => setView('game')} />
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
    </div>
  );
}
