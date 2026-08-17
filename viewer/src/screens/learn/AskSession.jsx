import { useState, useEffect, useRef, useMemo } from 'react';
import { loadUnitStudy } from '../../data/dataModel';
import { getApiKey, getPrefs, getBaseUrls, markActiveToday } from '../../data/stores/learningStore';
import { sendMessagesUnified, getProviderForModel, coerceModel } from '../../services/aiProviders';
import { ASK_SYSTEM_NOTE, ASK_SYSTEM_GENERAL, buildAskUser } from '../../prompts/ask';
import { useStudyActivity } from '../../app/useStudyTimer';
import HubHeader from '../../components/HubHeader';
import { brand, ink, line, surface, semantic, shadow } from '../../styles/tokens';

const GROUND_LIMIT = 14000;

// ⚠ 교재 표기와 단원 제목이 어긋나는 경우가 있다(부르너/브루너). 초성이 같으면 같은 말로 본다.
const initials = (s) => [...String(s)].map((ch) => {
  const c = ch.charCodeAt(0) - 0xac00;
  return c >= 0 && c <= 11171 ? String.fromCharCode(0x1100 + Math.floor(c / 588)) : ch;
}).join('');

function unitSection(md, unitTitle) {
  const lines = String(md || '').split('\n');
  const heads = lines.map((l, i) => [i, l]).filter(([, l]) => /^##\s/.test(l));
  if (!heads.length) return { text: String(md || '').trim(), matched: !!md };

  let hit = heads.find(([, l]) => l.includes(unitTitle));
  if (!hit && unitTitle.length >= 3) {
    const key = initials(unitTitle);
    const loose = heads.filter(([, l]) => initials(l).includes(key));
    if (loose.length === 1) [hit] = loose;
  }
  if (!hit) return { text: String(md || '').trim(), matched: false };

  const start = hit[0];
  const next = heads.find(([i]) => i > start);
  return { text: lines.slice(start, next ? next[0] : lines.length).join('\n').trim(), matched: true };
}

function noteTerms(section) {
  return [...section.matchAll(/\*\*(.+?)\*\*/g)]
    .map((m) => m[1].replace(/[`*_]/g, '').replace(/\s*\([^)]*\)\s*/g, '').replace(/[:：].*$/, '').trim())
    .filter((x) => x.length >= 2 && x.length <= 14)
    .filter((x, i, a) => a.indexOf(x) === i);
}

const hasFinal = (w) => {
  const c = String(w).charCodeAt(String(w).length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
};

function suggestions(terms) {
  if (!terms.length) return ['핵심 개념이 뭔가요?', '자주 나오는 오개념은?', '초등 수업 예시 알려줘'];
  const first = `${terms[0]}${hasFinal(terms[0]) ? '이' : '가'} 뭔가요?`;
  const second = terms.length >= 3
    ? `${terms[1]}${hasFinal(terms[1]) ? '과' : '와'} ${terms[2]}의 차이는?`
    : '핵심만 3줄로 요약해줘';
  return [first, second, '초등 수업 예시 알려줘'];
}

export default function AskSession({ unit, onBack }) {
  useStudyActivity('ai');
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [md, setMd] = useState(null);
  const scrollRef = useRef(null);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    loadUnitStudy(unit.subject, unit).then((t) => { if (active) setMd(t || ''); });
    return () => { active = false; };
  }, [unit]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  const { grounding, source, chips } = useMemo(() => {
    if (md === null) return { grounding: '', source: '', chips: [] };
    const { text, matched } = unitSection(md, unit.title);
    return {
      grounding: text.slice(0, GROUND_LIMIT),
      source: text ? `단권화 노트 · ${matched ? `${unit.title} 단원` : '단원 전체'}` : '',
      chips: suggestions(matched ? noteTerms(text) : []),
    };
  }, [md, unit.title]);

  const hasNote = !!grounding;

  const send = async (text) => {
    const q = String(text || '').trim();
    if (!q || lock.current || md === null) return;
    lock.current = true;
    setMsgs((prev) => [...prev, { who: 'me', text: q }]);
    setInput(''); setBusy(true); setError('');
    try {
      const model = coerceModel(getPrefs().model);
      const provider = getProviderForModel(model);
      const res = await sendMessagesUnified({
        model, apiKey: getApiKey(provider), baseUrl: getBaseUrls()[provider],
        system: hasNote ? ASK_SYSTEM_NOTE : ASK_SYSTEM_GENERAL,
        messages: [{ role: 'user', content: buildAskUser({
          unitPath: unit.path.join(' › '), grounding, question: q }) }],
        maxTokens: 900,
      });
      markActiveToday();
      setMsgs((prev) => [...prev, { who: 'ai', text: (res.text || '').trim() }]);
    } catch (e) {
      setError('답변을 못 받았어요: ' + (e.message || e));
    }
    setBusy(false);
    lock.current = false;
  };

  return (
    <div className="app-container" style={fullHeight}>
      <HubHeader title="궁금한 것 묻기" sub={`${unit.title} · ${unit.path[1] || unit.path[0]}`} onBack={onBack} />

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <img src="/imyong.png" alt="" style={avatar} />
          <span style={aiBubble}>
            {hasNote
              ? '이 단원에서 궁금한 걸 물어보세요. 교재 내용에 근거해서 답해드릴게요.'
              : '이 단원은 아직 교재 노트가 없어요. 널리 쓰이는 표준 이론으로 답해드릴게요.'}
          </span>
        </div>

        {!msgs.length && !!chips.length && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
            {chips.map((c) => (
              <button key={c} onClick={() => send(c)} disabled={busy} style={askChip}>{c}</button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (m.who === 'me' ? (
          <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <span style={meBubble}>{m.text}</span>
          </div>
        ) : (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <img src="/imyong.png" alt="" style={avatar} />
            <div style={aiCard}>
              <div style={{ fontSize: '0.9rem', color: ink.body, lineHeight: 1.68 }}>{bold(m.text)}</div>
              <div style={groundLine}>근거: {source || '노트 없음 · 표준 이론'}</div>
            </div>
          </div>
        )))}

        {busy && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <img src="/imyong.png" alt="" style={avatar} />
            <span style={{ ...aiBubble, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Dots />
              <span style={{ color: ink.muted }}>노트를 찾아보고 있어요…</span>
            </span>
          </div>
        )}
        {error && <div style={{ color: semantic.danger, fontSize: '0.82rem', padding: '6px 44px' }}>{error}</div>}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '0 16px 16px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
          placeholder="궁금한 걸 입력하세요"
          disabled={busy || md === null}
          style={inputBox}
        />
        <button onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="전송"
          style={{ ...sendBtn, opacity: (busy || !input.trim()) ? 0.45 : 1 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={ink.onBrand}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 12L20 4.5 15 20l-3.6-5.4L4.5 12z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function bold(s) {
  return String(s || '').split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

function Dots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: brand.primary,
          animation: `imyongBlink 1.1s ${i * 0.18}s infinite ease-in-out`,
        }} />
      ))}
    </span>
  );
}

const fullHeight = {
  display: 'flex', flexDirection: 'column',
  minHeight: 'calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))',
};

const avatar = { width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 };
const bubbleBase = { padding: '11px 14px', borderRadius: 14, fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '78%' };
const aiBubble = { ...bubbleBase, background: surface.card, border: `1px solid ${line.base}`, color: ink.body, boxShadow: shadow.sm };
const meBubble = { ...bubbleBase, background: brand.primary, color: ink.onBrand, fontWeight: 600 };
const aiCard = {
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 14,
  padding: '12px 14px', boxShadow: shadow.sm, maxWidth: '84%',
};
const groundLine = {
  fontSize: '0.7rem', color: ink.faint, marginTop: 10, paddingTop: 8,
  borderTop: `1px solid ${line.soft}`,
};

const askChip = {
  fontSize: '0.78rem', fontWeight: 600, padding: '7px 12px', borderRadius: 999,
  border: `1px solid ${line.base}`, background: surface.card, color: brand.primaryInk, cursor: 'pointer',
};

const inputBox = {
  flex: 1, minWidth: 0, padding: '13px 16px', borderRadius: 14,
  border: `1px solid ${line.base}`, background: surface.card,
  fontSize: '0.9rem', color: ink.body, outline: 'none',
};
const sendBtn = {
  width: 46, height: 46, borderRadius: 14, flexShrink: 0, border: 'none',
  background: brand.primary, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
