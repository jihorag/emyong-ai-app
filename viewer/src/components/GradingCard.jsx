import { useState } from 'react';
import { SERIF } from '../styles/fonts';
import { brand, ink, line, surface, semantic, palette, shadow } from '../styles/tokens';

const MARK = {
  O:       { icon: '✓', color: semantic.success, label: '충족' },
  partial: { icon: '△', color: semantic.warn,    label: '일부' },
  X:       { icon: '✕', color: semantic.danger,  label: '누락' },
};

export default function GradingCard({
  rubric = [], marks = [], scored = 0, total = 0,
  needsReview = false, modelAnswer = '', source = '', title = '오늘의 답변을 채점했어요',
}) {
  const [openAnswer, setOpenAnswer] = useState(false);
  const markOf = (id) => marks.find((m) => m.rubricId === id);

  return (
    <div>
      {needsReview ? (
        <div style={reviewBox}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: semantic.warn }}>이 답안은 검토가 필요해요</div>
          <div style={{ fontSize: '0.84rem', color: ink.muted, marginTop: 6, lineHeight: 1.65 }}>
            채점요소 판정이 확실하지 않아 점수를 매기지 않았어요.<br />
            모범답안과 직접 비교해 보세요.
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '6px 0 18px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: brand.primaryInk, letterSpacing: '-0.01em' }}>
            {scored} / {total} 점
          </div>
          <div style={{ fontSize: '0.84rem', color: ink.muted, marginTop: 4 }}>{title}</div>
        </div>
      )}

      <div style={card}>
        {rubric.map((r, i) => {
          const m = markOf(r.id);
          const meta = MARK[m?.mark] || null;
          const missed = m?.missedKeywords || [];
          return (
            <div key={r.id} style={{ ...row, borderTop: i === 0 ? 'none' : `1px solid ${line.soft}` }}>
              <span style={{ width: 18, flexShrink: 0, fontWeight: 800, color: meta ? meta.color : ink.faint, textAlign: 'center' }}>
                {meta ? meta.icon : '·'}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: ink.strongest }}>{r.label}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: ink.faint, marginTop: 3 }}>
                  {missed.length
                    ? <>빠진 키워드: <b style={{ color: semantic.danger }}>{missed.join(', ')}</b></>
                    : meta ? '빠진 키워드 없음' : '판정 보류'}
                </span>
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: ink.muted, flexShrink: 0 }}>
                {needsReview || !meta ? `— / ${r.points}` : `${pointsFor(r, m.mark)} / ${r.points}`}
              </span>
            </div>
          );
        })}
      </div>

      {modelAnswer && (
        <div style={{ ...card, marginTop: 10, padding: 0, overflow: 'hidden' }}>
          <button onClick={() => setOpenAnswer((v) => !v)} style={answerToggle}>
            <span>모범답안 보기</span>
            <span style={{ color: ink.faint, fontSize: '0.8rem' }}>{openAnswer ? '⌃' : '⌄'}</span>
          </button>
          {openAnswer && (
            <div style={answerBox}>{modelAnswer}</div>
          )}
        </div>
      )}

      {source && (
        <div style={{ borderTop: `1px solid ${line.soft}`, marginTop: 14, paddingTop: 10 }}>
          <span style={{ fontSize: '0.72rem', color: ink.faint }}>{source}</span>
        </div>
      )}
    </div>
  );
}

function pointsFor(r, mark) {
  if (mark === 'O') return r.points;
  if (mark === 'partial') return Math.floor(r.points / 2);
  return 0;
}

const card = {
  background: surface.card, border: `1px solid ${line.base}`,
  borderRadius: 16, padding: '4px 16px', boxShadow: shadow.sm,
};
const row = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 0' };

const reviewBox = {
  background: semantic.warnTint, border: `1px solid ${semantic.warnLine}`,
  borderRadius: 16, padding: '16px 18px', marginBottom: 12,
};

const answerToggle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
  padding: '15px 16px', background: 'none', border: 'none', cursor: 'pointer',
  fontWeight: 700, fontSize: '0.9rem', color: ink.strongest,
};
const answerBox = {
  fontFamily: SERIF, fontSize: '0.94rem', lineHeight: 1.85, color: ink.body,
  background: palette.aliceBlue, padding: '16px 18px', whiteSpace: 'pre-wrap',
};
