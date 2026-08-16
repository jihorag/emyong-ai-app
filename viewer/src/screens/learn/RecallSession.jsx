import { useState, useEffect, useRef, useMemo } from 'react';
import { loadUnitStudy } from '../../data/dataModel';
import { buildLocalCards } from '../../data/drillCards';
import {
  getApiKey, getPrefs, getBaseUrls, getStreak,
  markActiveToday, updateChapterMastery, recordGrade,
  getUnitIntro, setUnitIntro,
} from '../../data/stores/learningStore';
import { sendMessagesUnified, getProviderForModel, coerceModel } from '../../services/aiProviders';
import {
  DRILL_GEN_SYSTEM, DRILL_GEN_SYSTEM_GENERAL, buildDrillGenUser,
  DRILL_GRADE_SYSTEM, buildDrillGradeUser,
} from '../../prompts/drill';
import { hasDrill, initDrill, pickNext, grade as gradeCard, snapshot } from '../../data/stores/drillStore';
import { useStudyActivity } from '../../app/useStudyTimer';
import HubHeader from '../../components/HubHeader';
import { brand, ink, line, surface, semantic, shadow } from '../../styles/tokens';

const SESSION_SIZE = 10;

const WAITING = [
  '노트를 훑어보고 있어요…',
  '핵심만 골라내는 중이에요…',
  '질문으로 바꿔볼게요…',
  '조금만 더요, 거의 다 됐어요…',
];

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

function unitOverview(md, unitTitle, unit) {
  const clean = (s) => String(s || '')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/==(.+?)==/g, '$1')
    .replace(/[`*_]/g, '').trim();

  const lines = String(md || '').split('\n');
  const start = lines.findIndex((l) => /^##\s/.test(l) && l.includes(unitTitle));
  if (start >= 0) {
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) if (/^##\s/.test(lines[i])) { end = i; break; }
    const body = lines.slice(start + 1, end);
    const para = body.find((l) => {
      const s = l.trim();
      return s.length > 30 && !s.startsWith('-') && !s.startsWith('>') && !s.startsWith('#');
    });
    const terms = [...body.join('\n').matchAll(/\*\*(.+?)\*\*/g)]
      .map((m) => clean(m[1]).replace(/\s*\([^)]*\)\s*/g, '').replace(/[:：].*$/, '').trim())
      .filter((x) => x.length >= 2 && x.length <= 12)
      .filter((x, i, a) => a.indexOf(x) === i)
      .slice(0, 6);
    const summary = clean(para).slice(0, 160);
    if (summary || terms.length) return { summary, terms };
  }

  const terms = (unit.cloze || []).flatMap((c) => (c.blanks || []).map((b) => b.term))
    .filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 6);
  return terms.length ? { summary: '', terms } : null;
}

function parseCardLines(txt) {
  const out = [];
  String(txt || '').split('\n').forEach((ln) => {
    const m = ln.match(/^\s*(?:\d+[.)]\s*)?(.+?)\s*(?:::|｜|\|)\s*(.+?)\s*$/);
    if (m && m[1].length > 1 && m[2].length > 0) out.push({ q: m[1].trim(), a: m[2].trim() });
  });
  return out;
}

const INTRO_CHOICES = [
  { key: 'first',   label: '아직 안 배웠어요',   hint: '노트부터 같이 볼게요' },
  { key: 'lecture', label: '강의로 한 번 들었어요', hint: '가볍게 확인해볼게요' },
  { key: 'repeat',  label: '여러 번 봤어요',      hint: '바로 물어볼게요' },
];

export default function RecallSession({ unit, onBack, onSwitch, onHome, onNote }) {
  useStudyActivity('ai');
  const [msgs, setMsgs] = useState([]);
  const [card, setCard] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [studyMd, setStudyMd] = useState('');
  const [awaitingIntro, setAwaitingIntro] = useState(false);
  const scrollRef = useRef(null);
  const lock = useRef(false);
  const answered = useRef(0);
  const correctCount = useRef(0);
  const startedAt = useRef(0);
  const coverageAtStart = useRef(0);
  const genRef = useRef(null);

  const aiArgs = () => {
    const model = coerceModel(getPrefs().model);
    const provider = getProviderForModel(model);
    return { model, apiKey: getApiKey(provider), baseUrl: getBaseUrls()[provider] };
  };

  const push = (m) => setMsgs((prev) => [...prev, m]);

  const [waitIdx, setWaitIdx] = useState(0);
  useEffect(() => {
    if (!busy) return undefined;
    setWaitIdx(0);
    const id = setInterval(() => setWaitIdx((i) => (i + 1) % WAITING.length), 2400);
    return () => clearInterval(id);
  }, [busy]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  const noteSource = useMemo(() => {
    const m = (studyMd || '').match(/^>\s*출처:\s*(.+)$/m);
    return m ? m[1].replace(/\s*\([^)]*\)\s*$/, '').trim() : '';
  }, [studyMd]);

  const finish = () => {
    const after = snapshot(unit.id);
    setResult({
      correct: correctCount.current,
      gained: Math.max(0, Math.round(((after?.coverage ?? 0) - coverageAtStart.current) * 100)),
      minutes: Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)),
      streak: getStreak().current,
    });
  };

  const ask = (exceptId) => {
    if (answered.current >= SESSION_SIZE) { finish(); return; }
    const next = pickNext(unit.id, exceptId);
    if (!next) { finish(); return; }
    setCard(next);
    push({ who: 'ai', kind: 'q', text: next.q });
  };

  const enrichWithAi = async (md) => {
    const grounding = ((md || '').slice(0, 16000) + '\n'
      + (unit.cloze || []).slice(0, 30).map((c) => c.sentence).join('\n')).slice(0, 18000);
    const rich = norm(grounding).length > 40;
    try {
      const res = await sendMessagesUnified({
        ...aiArgs(),
        system: rich ? DRILL_GEN_SYSTEM : DRILL_GEN_SYSTEM_GENERAL,
        messages: [{ role: 'user', content: buildDrillGenUser({
          richNote: rich, subject: unit.path[0], unitPath: unit.path.join(' › '), grounding: grounding.slice(0, 16000) }) }],
        maxTokens: 2200,
      });
      const cards = parseCardLines(res.text);
      if (cards.length) { initDrill(unit.id, cards.slice(0, 40)); return true; }
    } catch { }
    return false;
  };

  const startAsking = async () => {
    if (hasDrill(unit.id)) { ask(null); return; }
    setBusy(true);
    const ok = await (genRef.current || Promise.resolve(false));
    setBusy(false);
    if (!ok && !hasDrill(unit.id)) {
      setError('이 단원은 아직 물어볼 거리가 부족해요. 노트가 있는 단원에서 시작해 주세요.');
      return;
    }
    ask(null);
  };

  const chooseIntro = (choice) => {
    setUnitIntro(unit.id, choice.key);
    setAwaitingIntro(false);
    push({ who: 'me', text: choice.label });
    if (choice.key === 'first') {
      push({ who: 'ai', kind: 'offerNote',
        text: '아직 안 배운 내용이면 먼저 노트를 훑는 게 훨씬 잘 남아요. 어떻게 할까요?' });
      return;
    }
    push({ who: 'ai', text: `좋아요, ${choice.hint}.` });
    startAsking();
  };

  // ⚠ 인사·개관을 먼저 깔고 카드 생성은 뒤에서 돌린다. 순서를 되돌리면
  useEffect(() => {
    let active = true;
    startedAt.current = Date.now();
    coverageAtStart.current = snapshot(unit.id)?.coverage ?? 0;

    (async () => {
      const md = await loadUnitStudy(unit.subject, unit);
      if (!active) return;
      setStudyMd(md || '');

      push({ who: 'ai', text: `안녕하세요! 오늘은 **${unit.title}** 함께 볼게요.` });
      const ov = unitOverview(md, unit.title, unit);
      if (ov) push({ who: 'ai', kind: 'overview', summary: ov.summary, terms: ov.terms });

      if (!hasDrill(unit.id)) {
        const instant = buildLocalCards(md, unit);
        if (instant.length) initDrill(unit.id, instant.slice(0, 40));
      }
      genRef.current = enrichWithAi(md);

      if (!getUnitIntro(unit.id)) {
        setBusy(false);
        setAwaitingIntro(true);
        push({ who: 'ai', kind: 'intro', text: `${unit.title}, 전에 공부한 적 있나요?` });
        return;
      }
      await startAsking();
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  const submit = async () => {
    const text = input.trim();
    if (!text || !card || lock.current) return;
    lock.current = true;
    const c = card;
    push({ who: 'me', text });
    setInput(''); setBusy(true); setError('');
    try {
      const res = await sendMessagesUnified({
        ...aiArgs(),
        system: DRILL_GRADE_SYSTEM,
        messages: [{ role: 'user', content: buildDrillGradeUser({ question: c.q, answer: c.a, studentAnswer: text }) }],
        maxTokens: 140,
      });
      const out = (res.text || '').trim();
      let ok;
      if (/^[oO⭕✅]/.test(out)) ok = true;
      else if (/^[xX✕❌]/.test(out)) ok = false;
      else ok = norm(text).includes(norm(c.a)) || norm(c.a).includes(norm(text));

      gradeCard(unit.id, c.id, ok);
      markActiveToday();
      try {
        recordGrade(unit.id, ok);
        const s = snapshot(unit.id);
        if (s?.total) updateChapterMastery(unit.id, { coverage: s.coverage });
      } catch { }

      answered.current += 1;
      if (ok) correctCount.current += 1;

      const after = snapshot(unit.id);
      const box = after?.boxes ? (pickBox(unit.id, c.id) ?? 0) : 0;
      push({
        who: 'ai', kind: 'grade', ok, box,
        text: out.replace(/^[oOxX⭕✅✕❌]\s*/, '') || (ok ? '정답!' : `정답: ${c.a}`),
      });
      setBusy(false); lock.current = false;
      ask(c.id);
    } catch (e) {
      setError('채점 실패: ' + (e.message || e));
      setBusy(false); lock.current = false;
    }
  };

  if (result) return <SessionDone unit={unit} {...result} onHome={onHome} onNext={onBack} />;

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <HubHeader title={unit.title} onBack={onBack} />
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {msgs.map((m, i) => (
          <Bubble key={i} msg={m} source={noteSource}
            onChoose={chooseIntro} onNote={onNote} onStart={startAsking} />
        ))}
        {busy && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <img src="/imyong.png" alt="" style={avatar} />
            <span style={{ ...aiBubble, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Dots />
              <span style={{ color: ink.muted }}>{WAITING[waitIdx]}</span>
            </span>
          </div>
        )}
        {error && <div style={{ color: semantic.danger, fontSize: '0.82rem', padding: '6px 44px' }}>{error}</div>}
      </div>

      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ ...chip, ...chipOn }}>기억 확인</span>
          <button onClick={() => onSwitch?.('note')} style={chip}>단권화 노트</button>
          <button onClick={() => onSwitch?.('apply')} style={chip}>개념 활용</button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="답을 입력하세요"
            disabled={!card || busy || awaitingIntro}
            style={inputBox}
          />
          <button onClick={submit} disabled={!card || busy || !input.trim()} aria-label="전송"
            style={{ ...sendBtn, opacity: (!card || busy || !input.trim()) ? 0.45 : 1 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={ink.onBrand}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 12L20 4.5 15 20l-3.6-5.4L4.5 12z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function pickBox(unitId, cardId) {
  try {
    const raw = localStorage.getItem('ailearn-drill:' + unitId);
    return raw ? JSON.parse(raw).cards?.[cardId]?.box : null;
  } catch { return null; }
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

function Bubble({ msg, source, onChoose, onNote, onStart }) {
  if (msg.who === 'me') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <span style={meBubble}>{msg.text}</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <img src="/imyong.png" alt="" style={avatar} />
      {msg.kind === 'overview' ? (
        <div style={aiCard}>
          <div style={{ fontSize: '0.72rem', color: ink.faint, fontWeight: 700, marginBottom: 7 }}>단원 개관</div>
          {msg.summary && (
            <div style={{ fontSize: '0.86rem', color: ink.body, lineHeight: 1.62 }}>{msg.summary}</div>
          )}
          {!!msg.terms?.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: msg.summary ? 10 : 0 }}>
              {msg.terms.map((k) => <span key={k} style={termChip}>{k}</span>)}
            </div>
          )}
          {source && (
            <div style={{ fontSize: '0.7rem', color: ink.faint, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${line.soft}` }}>
              근거: {source}
            </div>
          )}
        </div>
      ) : msg.kind === 'intro' ? (
        <div style={aiCard}>
          <div style={{ fontSize: '0.9rem', color: ink.body, lineHeight: 1.6, marginBottom: 11 }}>{msg.text}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {INTRO_CHOICES.map((c) => (
              <button key={c.key} onClick={() => onChoose?.(c)} style={choiceBtn}>
                <span style={{ fontWeight: 700, color: ink.strongest }}>{c.label}</span>
                <span style={{ fontSize: '0.74rem', color: ink.faint, marginTop: 2 }}>{c.hint}</span>
              </button>
            ))}
          </div>
        </div>
      ) : msg.kind === 'offerNote' ? (
        <div style={aiCard}>
          <div style={{ fontSize: '0.9rem', color: ink.body, lineHeight: 1.6, marginBottom: 11 }}>{msg.text}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onNote} style={{ ...choiceBtn, ...twoUp, ...choiceBtnOn }}>
              <span style={{ fontWeight: 700 }}>📖 노트 보기</span>
            </button>
            <button onClick={onStart} style={{ ...choiceBtn, ...twoUp, color: ink.muted }}>
              <span style={{ fontWeight: 700 }}>그냥 시작</span>
            </button>
          </div>
        </div>
      ) : msg.kind === 'grade' ? (
        <div style={aiCard}>
          <div style={{ fontSize: '0.72rem', color: ink.faint, marginBottom: 7 }}>
            정착도 {'●'.repeat(msg.box)}{'○'.repeat(Math.max(0, 5 - msg.box))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ color: msg.ok ? semantic.success : semantic.danger, fontWeight: 800, flexShrink: 0 }}>
              {msg.ok ? '✓' : '✕'}
            </span>
            <span style={{ fontSize: '0.88rem', color: ink.body, lineHeight: 1.55 }}>{msg.text}</span>
          </div>
          {source && (
            <div style={{ fontSize: '0.7rem', color: ink.faint, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${line.soft}` }}>
              근거: {source}
            </div>
          )}
        </div>
      ) : (
        <span style={aiBubble}>{bold(msg.text)}</span>
      )}
    </div>
  );
}

function SessionDone({ unit, correct, gained, minutes, streak, onHome, onNext }) {
  return (
    <div className="app-container">
      <main className="main-content" style={{ paddingTop: 36, textAlign: 'center' }}>
        <img src="/imyong.png" alt="이묭이"
          style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover' }} />
        <div style={{ fontWeight: 800, fontSize: '1.35rem', color: ink.strongest, marginTop: 14 }}>
          {unit.title}, 오늘 복습 완료!
        </div>
        <div style={{ fontSize: '0.88rem', color: ink.muted, marginTop: 6 }}>핵심 개념을 다시 꺼내봤어요</div>

        <div style={statRow}>
          <Stat value={String(correct)} label="맞힌 개념" />
          <Stat value={`▲ +${gained}`} label="정착도" />
          <Stat value={`${minutes}분`} label="학습" />
        </div>

        {streak > 0 && (
          <div style={{ fontSize: '0.85rem', color: semantic.success, fontWeight: 700, marginTop: 18 }}>
            🔥 {streak}일 연속 학습 중이에요
          </div>
        )}

        <button onClick={onHome} style={doneBtn}>홈 탭으로 돌아가기</button>
        <button onClick={onNext} style={doneLink}>다음 단원 복습하기</button>
      </main>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: brand.primaryInk }}>{value}</div>
      <div style={{ fontSize: '0.74rem', color: ink.muted, marginTop: 3 }}>{label}</div>
    </div>
  );
}

const avatar = { width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 };
const bubbleBase = { padding: '11px 14px', borderRadius: 14, fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '78%' };
const aiBubble = { ...bubbleBase, background: surface.card, border: `1px solid ${line.base}`, color: ink.body, boxShadow: shadow.sm };
const meBubble = { ...bubbleBase, background: brand.primary, color: ink.onBrand, fontWeight: 600 };
const aiCard = {
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 14,
  padding: '12px 14px', boxShadow: shadow.sm, maxWidth: '84%',
};

const choiceBtn = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%',
  padding: '10px 13px', borderRadius: 11, cursor: 'pointer',
  border: `1px solid ${line.base}`, background: surface.card, textAlign: 'left',
};
const twoUp = { flex: 1, alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', fontSize: '0.88rem' };
const choiceBtnOn = { background: brand.tint, borderColor: brand.tint, color: brand.primaryDeep };

const termChip = {
  fontSize: '0.72rem', fontWeight: 700, color: brand.primaryDeep,
  background: brand.tint, borderRadius: 999, padding: '4px 9px',
};

const chip = {
  fontSize: '0.76rem', fontWeight: 700, padding: '6px 12px', borderRadius: 999,
  border: `1px solid ${line.base}`, background: surface.card, color: ink.muted, cursor: 'pointer',
};
const chipOn = { background: brand.tint, borderColor: brand.tint, color: brand.primaryDeep, cursor: 'default' };

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

const statRow = {
  display: 'flex', gap: 8, marginTop: 22,
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 16,
  padding: '18px 12px', boxShadow: shadow.sm,
};
const doneBtn = {
  width: '100%', marginTop: 24, padding: '15px', borderRadius: 14, border: 'none',
  background: brand.primary, color: ink.onBrand, fontWeight: 800, fontSize: '0.98rem', cursor: 'pointer',
};
const doneLink = {
  width: '100%', marginTop: 12, padding: '8px', border: 'none', background: 'none',
  color: ink.muted, fontWeight: 600, fontSize: '0.86rem', cursor: 'pointer',
};
