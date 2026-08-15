import { useState, useEffect } from 'react';
import { loadUnitStudy } from '../../data/dataModel';
import { getByok, getPrefs, markActiveToday, recordGrade, getApiKey, getBaseUrls, addWrongNote } from '../../data/stores/learningStore';
import { sendMessagesUnified, getProviderForModel, coerceModel, providerNeedsKey } from '../../services/aiProviders';
import ParsedText from '../../components/ParsedText';
import HubHeader from '../../components/HubHeader';
import { buildVariantSystem, buildVariantUser } from '../../prompts/variant';
import { LEVELS, levelTag, rubricBox } from './levels';
import { useStudyActivity } from '../../app/useStudyTimer';
import { brand, ink, line, surface, semantic } from '../../styles/tokens';

export default function UnitPractice({ unit, preGen, onBack }) {
  useStudyActivity('quiz');
  const byok = getByok();
  const curProvider = getProviderForModel(coerceModel(getPrefs().model));
  const aiReady = !providerNeedsKey(curProvider) || !!(curProvider === 'anthropic' ? byok : getApiKey(curProvider));
  const [level, setLevel] = useState(preGen ? 'hard' : 'normal');
  const [studyMd, setStudyMd] = useState('');
  const [problem, setProblem] = useState(preGen ? { text: preGen } : null);
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showGichul, setShowGichul] = useState(false);

  useEffect(() => { loadUnitStudy(unit.subject, unit).then(setStudyMd); }, [unit]);
  useEffect(() => { if (preGen && !problem) { setProblem({ text: preGen }); setLevel('hard'); } }, [preGen]); // eslint-disable-line react-hooks/exhaustive-deps

  const grounding = ((studyMd || '').slice(0, 16000)
    + '\n' + (unit.cloze || []).slice(0, 30).map((c) => c.sentence).join('\n')).slice(0, 18000);
  const noteSource = (((studyMd || '').match(/^>\s*출처:\s*(.+)$/m) || [])[1] || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

  const genProblem = async () => {
    setError(''); setBusy(true); setProblem(null); setRevealed(false); setAnswer(''); setSaved(false);
    const system = buildVariantSystem({ level, unitPath: unit.path.join(' › '), grounding });
    try {
      const model = coerceModel(getPrefs().model);
      const provider = getProviderForModel(model);
      const apiKey = provider === 'anthropic' ? byok : getApiKey(provider);
      const res = await sendMessagesUnified({
        apiKey, model, system, baseUrl: getBaseUrls()[provider],
        messages: [{ role: 'user', content: buildVariantUser(LEVELS.find((l) => l.key === level).label) }],
        maxTokens: Math.max(getPrefs().max_tokens || 0, 1800),
      });
      setProblem({ text: res.text || '(생성 실패)' });
      markActiveToday();
    } catch (e) {
      setError('AI 호출 실패: ' + (e.message || e));
    } finally { setBusy(false); }
  };

  const split = (t) => {
    const m = String(t || '').split(/---\s*(?:루브릭|정답)\s*---/);
    return { q: (m[0] || '').replace(/^문제:\s*/, '').trim(), a: (m[1] || '').trim() };
  };

  return (
    <div className="app-container">
      <HubHeader title={unit.title} sub={unit.path.slice(1, -1).join(' › ')} onBack={onBack} />
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${line.base}` }}>
        {LEVELS.map((l) => (
          <button key={l.key} onClick={() => setLevel(l.key)}
            style={{
              flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
              border: '1px solid ' + (level === l.key ? brand.primaryDeep : line.base),
              background: level === l.key ? brand.primaryDeep : surface.white, color: level === l.key ? surface.white : ink.body,
            }}>{l.label}</button>
        ))}
      </div>
      <main className="main-content">
        <div style={{ fontSize: '0.8rem', color: ink.muted, marginBottom: 12 }}>{LEVELS.find((l) => l.key === level).hint}</div>
        {noteSource && <div style={vpSource}>📖 <b>단권화 노트</b> 기반 · 출처: {noteSource}</div>}

        {problem ? (() => {
          const { q, a } = split(problem.text);
          const isPre = !!preGen && problem.text === preGen;
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={levelTag}>{isPre ? '어려움' : LEVELS.find((l) => l.key === level).label}</span>
                <span style={{ fontSize: '0.74rem', color: ink.faint, fontWeight: 700 }}>{isPre ? '미리 준비된 문제 · 실제 기출 형식' : 'AI 변형 · 실제 기출 형식'}</span>
              </div>
              <ParsedText text={q} />
              <div style={{ ...cardBox, marginTop: 12 }}>
                <div style={{ fontWeight: 800, fontSize: '0.86rem', color: ink.body, marginBottom: 4 }}>✍️ 내 답안</div>
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
                  placeholder="인출해서 답을 써보세요" style={answerArea} />
              </div>
              {!revealed ? (
                <button onClick={() => setRevealed(true)} style={primBtn}>📊 채점 루브릭·모범답안 보기</button>
              ) : (
                <div>
                  <div style={rubricBox}>
                    <ParsedText text={a || '(루브릭 파싱 실패 — 위 문제와 함께 표시됨)'} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => {
                      try { recordGrade(unit.id, false); markActiveToday(); } catch { }
                      addWrongNote({ unitId: unit.id, unitTitle: unit.title, path: unit.path, level: isPre ? 'hard' : level, text: problem.text });
                      setSaved(true);
                      if (aiReady) genProblem();
                    }} style={secBtn}>📕 오답노트 저장{aiReady ? ' · 다시' : ''}</button>
                    <button onClick={() => { try { recordGrade(unit.id, true); markActiveToday(); } catch { } if (aiReady) genProblem(); }}
                      disabled={!aiReady} style={{ ...primBtn, flex: 1, opacity: aiReady ? 1 : 0.5 }}>맞음 · 다음 문제 →</button>
                  </div>
                  {saved && <div style={{ fontSize: '0.78rem', color: semantic.success, marginTop: 6 }}>✓ 오답노트에 저장했어요.</div>}
                  {!aiReady && <div style={{ fontSize: '0.76rem', color: ink.faint, marginTop: 6 }}>다음 문제를 만들려면 홈 ⚙️ 설정에서 해당 모델의 키를 넣어주세요.</div>}
                </div>
              )}
            </div>
          );
        })() : busy ? (
          <div style={{ padding: 24, textAlign: 'center', color: ink.faint }}>AI가 문제 만드는 중…</div>
        ) : aiReady ? (
          <button onClick={genProblem} style={primBtn}>🤖 이 난이도로 변형 문제 만들기</button>
        ) : (
          <div style={cardBox}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>이 모델은 키가 필요해요</div>
            <div style={{ fontSize: '0.85rem', color: ink.muted, lineHeight: 1.65 }}>
              홈 <b>⚙️ 설정</b>에서 키를 넣거나, 내장 AI(Claude)로 바꿔 주세요.
            </div>
          </div>
        )}
        {error && <div style={{ color: semantic.danger, fontSize: '0.82rem', margin: '8px 0' }}>{error}</div>}

        {unit.practice.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <button onClick={() => setShowGichul((v) => !v)} style={{ ...secBtn, width: '100%' }}>
              📚 이 단원 기출·변형 {unit.practice.length}문항 {showGichul ? '접기' : '보기'}
            </button>
            {showGichul && unit.practice.map((p) => (
              <div key={p.id} style={{ ...cardBox, marginTop: 10 }}>
                {p.source && <span style={levelTag}>{p.source === '기출' ? '기출' : '변형'}</span>}
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', fontWeight: 600, color: ink.strongest }}>{p.stem}</div>
                {(p.sub_questions || []).map((sq) => (
                  <div key={sq.id} style={{ marginTop: 8, fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{sq.id} {sq.prompt}</div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const cardBox = { background: surface.white, border: `1px solid ${line.base}`, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: 'var(--shadow-sm)' };
const primBtn = { width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: brand.primaryDeep, color: surface.white, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' };
const secBtn = { padding: '13px', borderRadius: 12, border: `1px solid ${line.base}`, background: surface.white, color: ink.body, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' };
const answerArea = { width: '100%', minHeight: 70, marginTop: 12, padding: '10px 12px', border: `1px solid ${line.base}`, borderRadius: 10, fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' };
const vpSource = { fontSize: '0.74rem', color: brand.primaryInk, background: surface.raised, border: `1px solid ${line.base}`, borderRadius: 8, padding: '6px 10px', marginBottom: 12 };
