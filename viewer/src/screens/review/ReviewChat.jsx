import { useState, useEffect, useMemo, useRef } from 'react';
import { loadUnitStudy } from '../../data/dataModel';
import {
  getApiKey, getPrefs, setPrefs, getBaseUrls,
  markActiveToday, updateChapterMastery, getChapterMastery, recordGrade,
} from '../../data/stores/learningStore';
import { sendMessagesUnified, getProviderForModel, availableModels, coerceModel, providerNeedsKey } from '../../services/aiProviders';
import { hasDrill, initDrill, pickNext, grade as gradeCard, snapshot as drillSnapshot } from '../../data/stores/drillStore';
import {
  buildReviewSystem, DRILL_GEN_SYSTEM, DRILL_GEN_SYSTEM_GENERAL,
  buildDrillGenUser, DRILL_GRADE_SYSTEM, buildDrillGradeUser,
} from '../../prompts/review';
import ParsedText from '../../components/ParsedText';
import DrillDashboard from '../../components/DrillDashboard';
import HubHeader from '../../components/HubHeader';
import { useStudyActivity } from '../../app/useStudyTimer';
import { palette, brand, ink, line, surface, semantic } from '../../styles/tokens';

const PROVIDER_LABEL = { anthropic: 'Claude', google: 'Gemini', moonshot: 'Kimi', openai: 'GPT' };
const PROVIDER_META = {
  anthropic: { name: 'Anthropic (Claude)', ph: 'sk-ant-...', pre: 'sk-', direct: true },
  google: { name: 'Google (Gemini)', ph: 'AIza...', pre: '', direct: false },
  moonshot: { name: 'Kimi (Moonshot)', ph: 'sk-...', pre: 'sk-', direct: false },
  openai: { name: 'OpenAI (GPT)', ph: 'sk-...', pre: 'sk-', direct: false },
};

const REVIEW_MAX_TOKENS = 2600;
const isTruncated = (r) => ['max_tokens', 'length', 'MAX_TOKENS'].includes(r);

function MascotAvatar({ size = 30 }) {
  const [err, setErr] = useState(false);
  const st = { width: size, height: size, borderRadius: '50%', flexShrink: 0, objectFit: 'cover', background: surface.accent, border: `1px solid ${line.base}` };
  if (err) return <div style={{ ...st, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.55 }}>🐶</div>;
  return <img src="/imyong.png" alt="이묭이" onError={() => setErr(true)} style={st} />;
}

const ACTIONS = [
  { key: 'exam', icon: '📝', label: '기출형 문제', desc: '학생 사고·지도법 서답형', prompt: '이 단원으로 초등 임용 1차 서답형 문제를 하나 출제해줘. 문항은 반드시 ```exam 코드블록으로 감싸서 실제 시험지처럼 보이게 해줘(첫 줄 [배점], 발문에서 강조할 부분은 __밑줄__, 대화·제시문은 〈자료〉 줄 아래에 "화자: 발화" 형식). 내가 답하면 블록 밖 일반 텍스트로 "꼭 들어가야 할 키워드"(칼채) 기준 채점해줘.' },
  { key: 'model', icon: '🧩', label: '수업 모형', desc: '단계·활동·유의점', prompt: '이 단원(해당 교과)에 적합한 대표 수업 모형의 단계명·활동·유의점을 하나씩 빈칸/구두로 인출시켜줘. 모형 스터디처럼. 시험 문제(exam)로 출제하지 말고 대화로 하나씩 물어봐.' },
  { key: 'curriculum', icon: '📚', label: '교육과정 인출', desc: '성취기준·내용체계', prompt: '이 단원의 2022 개정 초등 교육과정(해당 교과) 성취기준·내용체계·지도서 핵심을 하나씩 물어보며 인출시켜줘. 시험 문제(exam)로 출제하지 말고 대화로 하나씩 물어봐.' },
  { key: 'misc', icon: '🔍', label: '오개념·지도법', desc: '학생 오개념 + 발문', prompt: '이 단원에서 학생들이 자주 하는 오개념을 제시하고, 그 원인과 지도 방법·발문을 물어봐. 시험 문제(exam)로 출제하지 말고 대화로 하나씩.' },
  { key: 'speak', icon: '🎤', label: '말로 설명', desc: '구두 인출 + 칼채', prompt: '이 단원 핵심 개념 하나를 골라 "말로 설명해보세요"라고 시켜줘. 내 설명에서 빠진 키워드를 칼채 기준으로 짚어줘. 시험 문제(exam)로 출제하지 말고 대화로.' },
  { key: 'summary', icon: '📋', label: '단권화 노트', desc: '미리 정리한 요약 노트', special: 'note' },
];

function clozeToCards(unit) {
  const out = [];
  (unit.cloze || []).forEach((c) => {
    const s = c.sentence || '';
    const blanks = (c.blanks || []).filter((b) => b.term && s.includes(b.term));
    if (blanks.length) {
      blanks.forEach((b) => out.push({ q: s.split(b.term).join(' ____ '), a: b.term }));
    } else if (s.length > 6) {
      out.push({ q: `다음을 완성하세요: “${s.slice(0, 12)}…”`, a: s });
    }
  });
  return out;
}

function parseCardLines(txt) {
  const out = [];
  String(txt || '').split('\n').forEach((ln) => {
    const m = ln.match(/^\s*(?:\d+[.)]\s*)?(.+?)\s*(?:::|｜|\|)\s*(.+?)\s*$/);
    if (m && m[1].length > 1 && m[2].length > 0) out.push({ q: m[1].trim(), a: m[2].trim() });
  });
  return out;
}

function makeIntro(unit) {
  return {
    role: 'assistant', intro: true,
    content: `안녕하세요! 저는 복습 메이트 **이묭이**예요 🐶\n**${unit.title}** 단원을, 여러분이 보는 **단권화 노트**를 바탕으로 함께 복습해요.\n\n**이렇게 도와드려요**\n- 🧠 **스제트** — 노트 핵심을 한 줄 카드로 반복 인출·암기\n- 📝 **기출형 문제** — 실제 임용 서답형 + 칼같은 채점\n- 🔍 **오개념·지도법** · 📚 **교육과정 인출** · 🎤 **말로 설명**\n- 📖 **단권화 노트** — 미리 정리된 요약 노트 보기\n\n제 모든 답변에는 ==어느 노트에서 왔는지 출처==를 함께 붙여 드려요. 아래 버튼을 누르거나 뭐든 편하게 물어보세요!`,
  };
}

function parseCitation(content) {
  const m = String(content || '').match(/〔\s*근거\s*[:：]\s*([^〕]+)〕/);
  if (!m) return { body: content, cite: '' };
  return { body: String(content).replace(m[0], '').trim(), cite: m[1].trim() };
}

function CitationChip({ source, cite, onNote }) {
  return (
    <button onClick={onNote} style={citeChip} title="근거 노트 보기">
      <span style={{ flexShrink: 0 }}>📎</span>
      <span style={citeText}><b>근거</b> · {source || '단권화 노트'}{cite ? ` › ${cite}` : ''}</span>
    </button>
  );
}

export default function ReviewChat({ unit, onBack, onNote }) {
  const runAction = (a) => { if (a.special === 'note') onNote?.(); else send(a.prompt); };
  useStudyActivity('ai');
  const [modelId, setModelId] = useState(() => coerceModel(getPrefs().model));
  const provider = getProviderForModel(modelId);
  const apiKey = useMemo(() => getApiKey(provider), [provider]);
  const changeModel = (id) => { setModelId(id); setPrefs({ model: id }); };
  const [studyMd, setStudyMd] = useState('');
  const [messages, setMessages] = useState(() => [makeIntro(unit)]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const [drilling, setDrilling] = useState(false);
  const [curCard, setCurCard] = useState(null);
  const [drillVer, setDrillVer] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const drillReady = useMemo(() => hasDrill(unit.id), [unit.id, drillVer]);
  const pushMsg = (msg) => setMessages((m) => [...m, msg]);
  const lockRef = useRef(false);

  useEffect(() => { loadUnitStudy(unit.subject, unit).then(setStudyMd); }, [unit]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy]);

  const clozeRef = (unit.cloze || []).slice(0, 40).map((c) => c.sentence).join('\n');
  const grounding = (studyMd || '').slice(0, 24000) + (clozeRef ? `\n\n[보조 핵심 문장]\n${clozeRef.slice(0, 4000)}` : '');

  const noteSource = useMemo(() => {
    const m = (studyMd || '').match(/^>\s*출처:\s*(.+)$/m);
    return m ? m[1].replace(/\s*\([^)]*\)\s*$/, '').trim() : '';
  }, [studyMd]);

  const hasNote = (studyMd || '').trim().length > 40;
  const subj = unit.path?.[0] || '이 과목';

  const system = buildReviewSystem({ hasNote, subj, unitPath: unit.path.join(' › '), grounding });

  const send = async (text) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setError('');
    if (text) pushMsg({ role: 'user', content: text });
    setInput('');
    setBusy(true);
    // ⚠ 모델 컨텍스트에 드릴 메시지를 넣지 않는다 — 일반 복습 대화만.
    const base = messages.filter((m) => !m.drill && !m.intro && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'));
    const history = text ? [...base, { role: 'user', content: text }] : base;
    const seed = history.length ? history : [{ role: 'user', content: '오늘 이 단원 배웠어요. 복습 시작할게요 — 첫 질문 주세요.' }];
    try {

      const maxTokens = Math.max(getPrefs().max_tokens || 0, REVIEW_MAX_TOKENS);
      let full = '';
      let msgs = seed;
      let guard = 0;
      for (;;) {
        const res = await sendMessagesUnified({
          apiKey, model: modelId, system, baseUrl: getBaseUrls()[provider], messages: msgs, maxTokens,
        });
        full += (res.text || '');
        const truncated = isTruncated(res.stop_reason) && (res.text || '').length > 0;
        if (!truncated || guard >= 3) break;
        guard += 1;
        msgs = [...seed, { role: 'assistant', content: full }, { role: 'user', content: '방금 답변이 중간에 잘렸어. 끊긴 바로 그 지점부터 이어서 계속 써줘. 앞 내용 반복하지 말고 이어지는 부분만.' }];
      }
      pushMsg({ role: 'assistant', content: full || '(응답 없음)' });
      markActiveToday();

      try {
        const prev = getChapterMastery(unit.id);
        updateChapterMastery(unit.id, { coverage: Math.min(1, (prev.coverage || 0) + 0.05) });
      } catch { }
    } catch (e) {
      setError('AI 호출 실패: ' + (e.message || e));
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  const _norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

  const genCards = async () => {
    const local = clozeToCards(unit);
    let ai = [];
    const richNote = _norm(grounding).length > 40;

    try {
      const res = await sendMessagesUnified({
        apiKey, model: modelId,
        system: richNote ? DRILL_GEN_SYSTEM : DRILL_GEN_SYSTEM_GENERAL,
        baseUrl: getBaseUrls()[provider],
        messages: [{ role: 'user', content: buildDrillGenUser({
          richNote, subject: unit.path[0], unitPath: unit.path.join(' › '), grounding: grounding.slice(0, 16000) }) }],
        maxTokens: 2200,
      });
      ai = parseCardLines(res.text);
    } catch { }
    const seen = new Set(); const merged = [];
    [...ai, ...local].forEach((c) => { const k = _norm(c.q) + '|' + _norm(c.a); if (!seen.has(k)) { seen.add(k); merged.push(c); } });
    return merged.slice(0, 40);
  };

  const askNextFrom = (exceptId) => {
    const card = pickNext(unit.id, exceptId);
    if (!card) {
      setCurCard(null);
      setDrilling(false);
      pushMsg({ role: 'assistant', drill: true, content: '🎉 이 단원 카드를 전부 한 번씩 정착시켰어요! 대시보드로 확인하거나, 잠시 뒤 다시 드릴하면 장기기억으로 굳어져요.' });
      const snap = drillSnapshot(unit.id);
      pushMsg({ role: 'assistant', drill: true, type: 'dashboard', snapshot: snap });
      return;
    }
    setCurCard(card);
    const snap = drillSnapshot(unit.id);
    const stars = '●'.repeat(card.box) + '○'.repeat(5 - card.box);
    pushMsg({ role: 'assistant', drill: true, type: 'drill_q', meta: `암기 ${snap ? snap.mastered : 0}/${snap ? snap.total : 0} · 정착도 ${stars}`, content: card.q });
  };

  const startDrill = async () => {
    if (busy) return;
    if (lockRef.current) return;
    lockRef.current = true;
    setError(''); setBusy(true);
    try {
      const cards = await genCards();
      if (!cards.length) { setError('드릴 카드를 만들 자료가 부족해요. 자료(📖)가 있는 단원에서 시작해 주세요.'); return; }
      initDrill(unit.id, cards); setDrillVer((v) => v + 1); setDrilling(true);
      pushMsg({ role: 'assistant', drill: true, content: `🧠 **스제트 시작!** 이 단원을 **${cards.length}장**의 한 줄 카드로 만들었어요.\n짧게 답하면 바로 채점하고, 틀린 건 조금 뒤 다시 물어볼게요. 아래 **📊 대시보드**로 언제든 현황을 볼 수 있어요.` });
      askNextFrom(null);
    } catch (e) { setError('카드 생성 실패: ' + (e.message || e)); }
    finally { setBusy(false); lockRef.current = false; }
  };

  const answerDrill = async (text) => {
    if (!curCard || lockRef.current) return;
    lockRef.current = true;
    const card = curCard;
    pushMsg({ role: 'user', drill: true, content: text });
    setInput(''); setBusy(true); setError('');
    try {
      const res = await sendMessagesUnified({
        apiKey, model: modelId, baseUrl: getBaseUrls()[provider],
        system: DRILL_GRADE_SYSTEM,
        messages: [{ role: 'user', content: buildDrillGradeUser({ question: card.q, answer: card.a, studentAnswer: text }) }],
        maxTokens: 140,
      });
      const out = (res.text || '').trim();
      let correct;
      if (/^[oO⭕✅]/.test(out)) correct = true;
      else if (/^[xX✕❌]/.test(out)) correct = false;
      else correct = _norm(text).includes(_norm(card.a)) || _norm(card.a).includes(_norm(text));
      gradeCard(unit.id, card.id, correct); setDrillVer((v) => v + 1); markActiveToday();

      try {
        recordGrade(unit.id, correct);
        const snap = drillSnapshot(unit.id);
        if (snap?.total) updateChapterMastery(unit.id, { coverage: snap.coverage });
      } catch { }
      pushMsg({ role: 'assistant', drill: true, content: out || (correct ? 'O 정답!' : `X 정답: ${card.a}`) });
      setBusy(false);
      lockRef.current = false;
      askNextFrom(card.id);
    } catch (e) { setError('채점 실패: ' + (e.message || e)); setBusy(false); lockRef.current = false; }
  };

  const pushDashboard = () => pushMsg({ role: 'assistant', drill: true, type: 'dashboard', snapshot: drillSnapshot(unit.id) });
  const skipCard = () => askNextFrom(curCard?.id);
  const endDrill = () => { setDrilling(false); setCurCard(null); pushMsg({ role: 'assistant', drill: true, content: '⏸ 드릴을 멈췄어요. 진척은 저장돼서 언제든 이어서 할 수 있어요.' }); };
  const submit = (text) => { if (!text || lockRef.current) return; if (drilling && curCard) answerDrill(text); else send(text); };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 64px)' }}>
      <HubHeader title={unit.title} sub={unit.path.slice(1, -1).join(' › ')} onBack={onBack} />
      <ModelBar modelId={modelId} onChange={changeModel} />
      {providerNeedsKey(provider) && !apiKey ? (
        <main className="main-content"><NeedKey provider={provider} /></main>
      ) : (
        <>
          <div style={sourceBar}>
            <span style={{ flexShrink: 0 }}>📖</span>
            <span style={sourceBarText}>
              {hasNote
                ? <><b>단권화 노트</b> 기반 답변{noteSource ? ` · 출처: ${noteSource}` : ''}</>
                : <><b>{subj} 교육과정</b> 기반 복습</>}
            </span>
            <button onClick={onNote} style={sourceBarBtn}>노트 보기</button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, background: surface.page }}>
            {(
              <>
                {messages.map((m, i) => {
                  const isUser = m.role === 'user';
                  if (m.type === 'dashboard') {
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
                        <div style={{ ...aiAvatar, background: `linear-gradient(135deg,${palette.sky},${brand.primary})` }}>📊</div>
                        <div style={{ flex: 1, minWidth: 0 }}><DrillDashboard snapshot={m.snapshot} title={unit.title} /></div>
                      </div>
                    );
                  }
                  const prevSame = i > 0 && messages[i - 1].role === m.role && !messages[i - 1].type && !m.type;
                  const showCite = !isUser && !m.drill && !m.intro;
                  const { body, cite } = showCite ? parseCitation(m.content) : { body: m.content, cite: '' };
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: isUser ? 'row-reverse' : 'row', marginTop: prevSame ? -6 : 0 }}>
                      {!isUser && (prevSame ? <div style={{ width: 30, flexShrink: 0 }} /> : <MascotAvatar />)}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: '82%', minWidth: 0 }}>
                        <div style={{ ...bubbleBase, maxWidth: '100%', ...(isUser ? userBubble : aiBubble), ...(m.type === 'drill_q' ? drillQBubble : {}) }}>
                          {m.meta && <div style={cardMetaStyle}>{m.meta}</div>}
                          {isUser ? m.content : <ParsedText text={body} />}
                        </div>
                        {showCite && <CitationChip source={noteSource} cite={cite} onNote={onNote} />}
                      </div>
                    </div>
                  );
                })}
                {messages.length === 1 && messages[0]?.intro && !busy && (
                  <div style={{ marginTop: 2 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: ink.faint, margin: '4px 2px 8px' }}>이렇게 시작해 보세요 👇</div>
                    <button onClick={startDrill} disabled={busy} style={drillHero}>
                      <span style={{ fontSize: '1.55rem', flexShrink: 0 }}>🧠</span>
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.98rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                          스제트 {drillReady && <span style={drillResume}>이어서</span>}
                        </span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.92, textAlign: 'left' }}>교재 전체를 한 줄씩 · 틀린 건 반복 · 대시보드로 현황</span>
                      </span>
                      <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>→</span>
                    </button>
                    {drillReady && (
                      <button onClick={pushDashboard} style={dashMini}>📊 암기 대시보드 보기</button>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                      {ACTIONS.map((a) => (
                        <button key={a.key} onClick={() => runAction(a)} disabled={busy} style={actionCard}>
                          <span style={{ fontSize: '1.35rem' }}>{a.icon}</span>
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: ink.strongest }}>{a.label}</span>
                          <span style={{ fontSize: '0.73rem', color: ink.faint }}>{a.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {busy && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <MascotAvatar />
                    <div style={{ ...bubbleBase, ...aiBubble, color: ink.faint, letterSpacing: 2 }}>···</div>
                  </div>
                )}
              </>
            )}
          </div>
          {error && <div style={{ color: semantic.danger, fontSize: '0.82rem', padding: '0 16px 4px' }}>{error}</div>}
          <div style={chipScroll}>
            {drilling ? (
              <>
                <button onClick={pushDashboard} disabled={busy} style={{ ...chip, ...chipAccent }}>📊 대시보드</button>
                <button onClick={skipCard} disabled={busy} style={chip}>⏭ 건너뛰기</button>
                <button onClick={endDrill} disabled={busy} style={chip}>⏸ 드릴 종료</button>
              </>
            ) : (
              <>
                <button onClick={startDrill} disabled={busy} style={{ ...chip, ...chipAccent }}>🧠 스제트{drillReady ? ' 이어서' : ''}</button>
                {drillReady && <button onClick={pushDashboard} disabled={busy} style={chip}>📊 대시보드</button>}
                {ACTIONS.map((a) => (
                  <button key={a.key} onClick={() => runAction(a)} disabled={busy} style={chip}>{a.icon} {a.label}</button>
                ))}
              </>
            )}
          </div>
          <div style={{ padding: '4px 12px 14px' }}>
            <div style={{ ...inputWrap, ...(drilling && curCard ? { border: `1.5px solid ${brand.primary}` } : {}) }}>
              <textarea value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim() && !busy) submit(input.trim()); } }}
                placeholder={drilling && curCard ? '정답을 한 줄로 입력하세요 (Enter)' : '무엇이든 물어보세요 (Enter 전송)'} rows={1}
                style={inputArea} />
              <button onClick={() => input.trim() && submit(input.trim())} disabled={busy || !input.trim()} style={{ ...sendBtn, opacity: (busy || !input.trim()) ? 0.4 : 1 }}>↑</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ModelBar({ modelId, onChange }) {
  const provider = getProviderForModel(modelId);
  return (
    <div style={modelBar}>
      <span style={{ fontSize: '0.78rem', color: ink.muted, fontWeight: 700, flexShrink: 0 }}>🤖 모델</span>
      <select value={modelId} onChange={(e) => onChange(e.target.value)} style={modelSelect}>
        {['anthropic', 'google', 'moonshot', 'openai'].map((prov) => {
          const ms = availableModels().filter((m) => m.provider === prov);
          if (!ms.length) return null;
          return (
            <optgroup key={prov} label={PROVIDER_LABEL[prov]}>
              {ms.map((m) => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
            </optgroup>
          );
        })}
      </select>
      {!PROVIDER_META[provider]?.direct && <span style={{ fontSize: '0.66rem', color: semantic.warn, fontWeight: 700, flexShrink: 0 }}>프록시 필요할 수 있음</span>}
    </div>
  );
}

function NeedKey({ provider }) {
  const meta = PROVIDER_META[provider] || { name: provider };
  return (
    <div style={cardBox}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{meta.name} 키가 필요해요</div>
      <div style={{ fontSize: '0.85rem', color: ink.muted, lineHeight: 1.65 }}>
        내장 AI(Claude)는 키 없이 바로 쓸 수 있어요. 위 <b>🤖 모델</b>에서 Claude로 바꾸거나,
        홈 <b>⚙️ 설정</b>에서 이 모델의 키를 넣어 주세요.
      </div>
    </div>
  );
}

const cardBox = { background: surface.white, border: `1px solid ${surface.page}`, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: 'var(--shadow-sm)' };
const actionCard = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, padding: '14px', background: surface.white, border: `1px solid ${surface.page}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const chipScroll = { display: 'flex', gap: 8, padding: '8px 12px', overflowX: 'auto', borderTop: `1px solid ${surface.page}`, WebkitOverflowScrolling: 'touch' };
const chip = { flexShrink: 0, padding: '7px 12px', borderRadius: 999, border: `1px solid ${line.base}`, background: surface.white, color: ink.body, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' };
const inputWrap = { display: 'flex', alignItems: 'flex-end', gap: 8, border: `1px solid ${line.base}`, borderRadius: 24, padding: '6px 6px 6px 16px', background: surface.white, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
const inputArea = { flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: '0.95rem', fontFamily: 'inherit', lineHeight: 1.5, background: 'transparent', maxHeight: 120, padding: '7px 0' };
const sendBtn = { flexShrink: 0, width: 38, height: 38, borderRadius: '50%', border: 'none', background: brand.primary, color: surface.white, fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer' };
const modelBar = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${surface.page}`, background: surface.page };
const modelSelect = { flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: 8, border: `1px solid ${line.base}`, background: surface.white, fontSize: '0.82rem', fontWeight: 700, color: ink.body, cursor: 'pointer' };
const aiAvatar = { flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,${brand.primary},${brand.primaryDeep})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' };
const bubbleBase = { maxWidth: '78%', padding: '9px 13px', fontSize: '0.92rem', lineHeight: 1.6, wordBreak: 'break-word' };
const aiBubble = { background: surface.white, color: ink.strongest, border: `1px solid ${surface.page}`, borderRadius: '4px 16px 16px 16px', boxShadow: '0 1px 1.5px rgba(0,0,0,0.05)' };
const userBubble = { background: brand.primary, color: surface.white, borderRadius: '16px 4px 16px 16px' };
const drillHero = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', borderRadius: 16, border: 'none', cursor: 'pointer', color: surface.white, background: `linear-gradient(135deg,${brand.primary},${brand.primaryDeep})`, boxShadow: '0 4px 14px rgba(79,70,229,0.28)', textAlign: 'left' };
const drillResume = { fontSize: '0.66rem', fontWeight: 800, background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '2px 8px' };
const dashMini = { width: '100%', marginTop: 8, padding: '10px', borderRadius: 12, border: `1px solid ${line.strong}`, background: surface.white, color: brand.primary, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' };
const drillQBubble = { background: surface.raised, border: `1px solid ${line.base}` };
const cardMetaStyle = { fontSize: '0.68rem', fontWeight: 700, color: ink.muted, marginBottom: 4, letterSpacing: 0.3 };
const chipAccent = { background: `linear-gradient(135deg,${surface.raised},${surface.raised})`, borderColor: line.strong, color: brand.primaryDeep };
const sourceBar = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: surface.raised, borderBottom: `1px solid ${line.base}`, fontSize: '0.74rem', color: brand.primaryInk };
const sourceBarText = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const sourceBarBtn = { flexShrink: 0, padding: '3px 10px', borderRadius: 999, border: `1px solid ${line.strong}`, background: surface.white, color: brand.primary, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer' };
const citeChip = { display: 'flex', alignItems: 'center', gap: 5, maxWidth: '100%', marginTop: 4, marginLeft: 2, padding: '4px 9px', borderRadius: 8, border: `1px solid ${line.base}`, borderLeft: `3px solid ${palette.babyBlueIce}`, background: surface.page, color: ink.sub, fontSize: '0.7rem', cursor: 'pointer', textAlign: 'left' };
const citeText = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
