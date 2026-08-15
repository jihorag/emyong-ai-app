import { useState, useEffect, useMemo } from 'react';
import { loadApplications, totalPoints, isReviewed, saveAttempt, saveToWrongNote } from '../../data/applications';
import { getApiKey, getPrefs, getBaseUrls } from '../../data/stores/learningStore';
import { sendMessagesUnified, getProviderForModel, coerceModel } from '../../services/aiProviders';
import { APPLY_GRADE_SYSTEM, buildApplyGradeUser, parseApplyGrade } from '../../prompts/apply';
import { useStudyActivity } from '../../app/useStudyTimer';
import GradingCard from '../../components/GradingCard';
import HubHeader from '../../components/HubHeader';
import { brand, ink, line, surface, semantic, shadow } from '../../styles/tokens';

export default function ApplySession({ unit, onBack }) {
  useStudyActivity('quiz');
  const [items, setItems] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [peeked, setPeeked] = useState(false);

  useEffect(() => {
    let active = true;
    loadApplications(unit.id).then((list) => { if (active) setItems(list); });
    return () => { active = false; };
  }, [unit]);

  const item = items?.[idx] || null;
  const total = useMemo(() => (item ? totalPoints(item) : 0), [item]);

  const aiArgs = () => {
    const model = coerceModel(getPrefs().model);
    const provider = getProviderForModel(model);
    return { model, apiKey: getApiKey(provider), baseUrl: getBaseUrls()[provider] };
  };

  const grade = async () => {
    if (!item || busy) return;
    setBusy(true); setError('');
    let parsed = null;
    try {
      const res = await sendMessagesUnified({
        ...aiArgs(),
        system: APPLY_GRADE_SYSTEM,
        messages: [{ role: 'user', content: buildApplyGradeUser({
          situation: item.situation, question: item.question, rubric: item.rubric,
          modelAnswer: item.modelAnswer, answerText: answer,
        }) }],
        maxTokens: 900,
      });
      parsed = parseApplyGrade(res.text, item.rubric);
    } catch (e) {
      setError('채점 요청이 실패했어요: ' + (e.message || e));
    }

    const out = parsed || {
      marks: item.rubric.map((r) => ({ rubricId: r.id, mark: null, missedKeywords: [] })),
      scored: 0, needsReview: true,
    };
    setResult({ ...out, total });
    saveAttempt({ item, answerText: answer, marks: out.marks, scored: out.scored, total, needsReview: out.needsReview });
    setBusy(false);
  };

  const goNext = () => {
    setIdx((i) => i + 1);
    setAnswer(''); setResult(null); setSaved(false); setError(''); setPeeked(false);
  };
  const retry = () => { setResult(null); setAnswer(''); setSaved(false); setPeeked(false); };

  if (items === null) {
    return <Shell unit={unit} onBack={onBack}><Msg>상황을 불러오는 중…</Msg></Shell>;
  }
  if (!items.length) {
    return (
      <Shell unit={unit} onBack={onBack}>
        <Msg>
          이 단원은 검수된 활용 상황이 아직 없어요.<br />
          상황은 사람이 쓰고 검토한 것만 사용해요.
        </Msg>
      </Shell>
    );
  }
  if (!item) {
    return (
      <Shell unit={unit} onBack={onBack}>
        <Msg>이 단원의 상황을 모두 풀었어요.<br />간격을 두고 다시 오면 더 잘 남아요.</Msg>
        <button onClick={onBack} style={primBtn}>단원으로 돌아가기</button>
      </Shell>
    );
  }

  if (result) {
    const wrong = result.needsReview || result.scored < total;
    return (
      <div className="app-container">
        <HubHeader title="채점 결과" sub={`${unit.title} · 개념 활용`} onBack={onBack} />
        <main className="main-content">
          <GradingCard
            rubric={item.rubric} marks={result.marks}
            scored={result.scored} total={result.total}
            needsReview={result.needsReview}
            modelAnswer={item.modelAnswer} source={item.source}
          />
        </main>
        <div style={footer}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.78rem', color: ink.muted, fontWeight: 600 }}>
              {idx + 1} / {items.length} 문항
            </span>
            <span style={{ display: 'flex', gap: 5 }}>
              {items.map((_, i) => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: i <= idx ? brand.primary : line.base,
                }} />
              ))}
            </span>
          </div>
          {wrong && <button onClick={retry} style={secBtn}>⟳ 이 개념으로 한 번 더</button>}
          <button onClick={goNext} style={{ ...primBtn, marginTop: wrong ? 8 : 0 }}>
            {idx + 1 < items.length ? '다음 상황' : '마치기'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 }}>
            <button
              onClick={() => { saveToWrongNote({ item, unit, answerText: answer, marks: result.marks }); setSaved(true); }}
              disabled={saved} style={{ ...linkBtn, color: saved ? semantic.success : ink.muted }}>
              {saved ? '오답노트에 저장됨' : '오답노트에 저장'}
            </button>
            <button onClick={onBack} style={linkBtn}>그만 풀기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <HubHeader title="개념 활용" sub={unit.title} onBack={onBack} />
      <main className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={tagStrong}>보통</span>
          <span style={tag}>{total}점</span>
          <span style={{ ...(isReviewed(item) ? tag : tagDraft), flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isReviewed(item) ? '검수 완료' : '검수 전 초안'} · {unit.title}
          </span>
        </div>

        <section style={qCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: ink.muted }}>
              문제 {String(idx + 1).padStart(2, '0')}
            </span>
            <span style={tagSoft}>서술형</span>
          </div>
          <div style={{ fontSize: '0.95rem', lineHeight: 1.7, color: ink.strongest, fontWeight: 600 }}>
            {item.question}
          </div>
          <div style={situationBox}>{item.situation}</div>
        </section>

        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: ink.sub, margin: '18px 2px 8px' }}>답안</div>
        <textarea
          value={answer} onChange={(e) => setAnswer(e.target.value)}
          placeholder="답을 입력하세요" rows={5} disabled={busy} style={answerArea}
        />

        {error && <div style={{ color: semantic.danger, fontSize: '0.82rem', marginTop: 8 }}>{error}</div>}

        <button onClick={grade} disabled={busy || !answer.trim()} style={{ ...primBtn, marginTop: 14, opacity: busy || !answer.trim() ? 0.5 : 1 }}>
          {busy ? '채점 중…' : '채점하기'}
        </button>

        {!peeked ? (
          <button onClick={() => setPeeked(true)} style={{ ...linkBtn, width: '100%', marginTop: 12 }}>정답 먼저 보기</button>
        ) : (
          <div style={{ marginTop: 12 }}>
            <GradingCard rubric={item.rubric} marks={[]} needsReview
              modelAnswer={item.modelAnswer} source={item.source} />
          </div>
        )}
      </main>
    </div>
  );
}

function Shell({ unit, onBack, children }) {
  return (
    <div className="app-container">
      <HubHeader title="개념 활용" sub={unit.title} onBack={onBack} />
      <main className="main-content">{children}</main>
    </div>
  );
}
function Msg({ children }) {
  return (
    <div style={{ padding: '36px 20px', textAlign: 'center', color: ink.faint, fontSize: '0.86rem', lineHeight: 1.8 }}>
      {children}
    </div>
  );
}

const qCard = {
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 16,
  padding: '16px 18px 18px', boxShadow: shadow.sm, borderTop: `3px solid ${brand.primary}`,
};
const situationBox = {
  marginTop: 12, padding: '13px 15px', borderRadius: 12,
  background: surface.sunken, color: ink.body,
  fontSize: '0.88rem', lineHeight: 1.75, whiteSpace: 'pre-wrap',
};

const tagBase = { fontSize: '0.74rem', fontWeight: 700, padding: '5px 10px', borderRadius: 999 };
const tag = { ...tagBase, background: surface.card, border: `1px solid ${line.base}`, color: ink.muted };
const tagSoft = { ...tagBase, background: brand.tint, color: brand.primaryDeep };
const tagDraft = { ...tagBase, background: semantic.warnTint, border: `1px solid ${semantic.warnLine}`, color: semantic.warn };
const tagStrong = { ...tagBase, background: brand.primary, color: ink.onBrand };

const answerArea = {
  width: '100%', boxSizing: 'border-box', padding: '13px 15px', borderRadius: 14,
  border: `1px solid ${line.base}`, background: surface.card, color: ink.body,
  fontSize: '0.92rem', lineHeight: 1.7, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
};

const footer = { padding: '14px 16px 20px', borderTop: `1px solid ${line.soft}`, background: surface.card };
const primBtn = {
  width: '100%', padding: '15px', borderRadius: 14, border: 'none',
  background: brand.primary, color: ink.onBrand, fontWeight: 800, fontSize: '0.96rem', cursor: 'pointer',
};
const secBtn = {
  width: '100%', padding: '14px', borderRadius: 14,
  border: `1px solid ${line.base}`, background: surface.card,
  color: ink.body, fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
};
const linkBtn = {
  background: 'none', border: 'none', color: ink.muted,
  fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', padding: '4px 2px',
};
