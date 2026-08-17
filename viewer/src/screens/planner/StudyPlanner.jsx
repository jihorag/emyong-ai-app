
import { useMemo, useState } from 'react';
import { loadStudyTime, getDayStudyTime, getDaySubjects, getDaySlots } from '../../data/stores/studyTime';
import { fmtDuration, fmtClock, fmtHMS } from '../../lib/format';
import { SUBJECTS } from '../../data/subjects';
import ShareStudyCard from './ShareStudyCard.jsx';
import { RangeTabs, ProgressCard, WeakCard, StudyTimeCard, DdayCard } from './StatsOverview.jsx';
import HubHeader from '../../components/HubHeader';
import { brand, ink, line, surface, semantic } from '../../styles/tokens';

const PLANNER_KEY = 'quiz-planner-v1';
const WD = ['일', '월', '화', '수', '목', '금', '토'];

const loadPlans = () => {
  try { return JSON.parse(localStorage.getItem(PLANNER_KEY) || '{}') || {}; }
  catch { return {}; }
};
const savePlans = (p) => {
  try { localStorage.setItem(PLANNER_KEY, JSON.stringify(p)); } catch { }
};

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysUntil = (yyyymmdd) => {
  if (!yyyymmdd) return null;
  const d = new Date(yyyymmdd + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.ceil((d - t) / 86400000);
};

export default function StudyPlanner({ examDates = {}, primaryExam = '초등임용', profile = null,
  leavesBySubject = {}, navigate }) {
  const [plans, setPlans] = useState(loadPlans);
  const [study] = useState(loadStudyTime);
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate());
  const [selected, setSelected] = useState(todayKey);
  const [draft, setDraft] = useState('');
  const [shareDate, setShareDate] = useState(null);
  const [range, setRange] = useState('week');

  const update = (next) => { setPlans(next); savePlans(next); };
  const addItem = () => {
    const text = draft.trim();
    if (!text || !selected) return;
    const list = plans[selected] || [];
    const item = { id: `${selected}_${list.length}_${text.length}`, text, done: false };
    update({ ...plans, [selected]: [...list, item] });
    setDraft('');
  };
  const toggleItem = (id) =>
    update({ ...plans, [selected]: (plans[selected] || []).map((it) => it.id === id ? { ...it, done: !it.done } : it) });
  const removeItem = (id) => {
    const next = { ...plans, [selected]: (plans[selected] || []).filter((it) => it.id !== id) };
    if (next[selected].length === 0) delete next[selected];
    update(next);
  };

  const moveMonth = (delta) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => { setView({ y: now.getFullYear(), m: now.getMonth() }); setSelected(todayKey); };

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay();
    const total = new Date(view.y, view.m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [view]);

  const dday = useMemo(() => {
    const cands = [
      { label: '1차', d: daysUntil(examDates[`${primaryExam}_1차`] || examDates[primaryExam]) },
      { label: '2차', d: daysUntil(examDates[`${primaryExam}_2차`]) },
    ].filter((x) => x.d != null && x.d >= 0).sort((a, b) => a.d - b.d)[0];
    return cands || null;
  }, [examDates, primaryExam]);


  const selList = (selected && plans[selected]) || [];
  const selLabel = selected ? (() => {
    const [y, m, d] = selected.split('-').map(Number);
    return `${y}년 ${m}월 ${d}일 (${WD[new Date(y, m - 1, d).getDay()]})`;
  })() : '';

  return (
    <div className="app-container">
      <HubHeader title="학습 통계" action={<RangeTabs range={range} onRange={setRange} />} />
      <main className="main-content">
        {(() => {
          const t = getDayStudyTime(todayKey);
          const total = t.ai + t.quiz;
          return (
            <section style={{ borderRadius: 16, padding: '18px 16px', marginBottom: 14,
              background: `linear-gradient(135deg,${brand.primary} 0%,${brand.primaryDeep} 100%)`, color: surface.white,
              boxShadow: 'var(--shadow-md)' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, fontWeight: 600 }}>🕒 오늘 공부 시간</div>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                margin: '2px 0 10px' }}>
                {total > 0 ? fmtClock(total) : '0:00'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.16)', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>🤖 AI 학습</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: 1 }}>{fmtDuration(t.ai)}</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.16)', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>📚 문제풀이</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: 1 }}>{fmtDuration(t.quiz)}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.66rem', opacity: 0.75, marginTop: 8, textAlign: 'center' }}>
                AI 학습·문제풀이 화면에 머무는 시간이 자동 기록돼요
              </div>
              <button onClick={() => setShareDate(todayKey)}
                style={{ marginTop: 12, width: '100%', padding: '11px 0', borderRadius: 12, border: 'none',
                  cursor: 'pointer', fontSize: '0.9rem', fontWeight: 800, color: ink.sub,
                  background: 'rgba(255,255,255,0.95)' }}>
                📷 오늘 공부 인증 공유하기
              </button>
            </section>
          );
        })()}

        <ProgressCard leavesBySubject={leavesBySubject} />
        <WeakCard leavesBySubject={leavesBySubject} onReview={() => navigate?.('recall')} />
        <StudyTimeCard range={range} />
        <section style={{ background: surface.white, borderRadius: 16, padding: 16,
          boxShadow: 'var(--shadow-md)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={() => moveMonth(-1)} aria-label="이전 달"
              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${line.base}`,
                background: surface.white, cursor: 'pointer', fontSize: '1rem', color: ink.body }}>‹</button>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: ink.strongest }}>
                {view.y}년 {view.m + 1}월
              </span>
              <button onClick={goToday}
                style={{ fontSize: '0.72rem', color: brand.primary, fontWeight: 700,
                  background: surface.accent, border: 'none', borderRadius: 999, padding: '3px 9px', cursor: 'pointer' }}>
                오늘
              </button>
            </div>
            <button onClick={() => moveMonth(1)} aria-label="다음 달"
              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${line.base}`,
                background: surface.white, cursor: 'pointer', fontSize: '1rem', color: ink.body }}>›</button>
          </div>
          {dday && (
            <div style={{ textAlign: 'center', fontSize: '0.76rem', color: ink.muted, marginBottom: 12 }}>
              {primaryExam} {dday.label}까지 <b style={{ color: dday.d <= 30 ? semantic.danger : dday.d <= 90 ? semantic.warn : brand.primaryDeep }}>D-{dday.d}</b>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
            {WD.map((w, i) => (
              <div key={w} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700,
                color: i === 0 ? semantic.danger : i === 6 ? brand.primaryDeep : ink.faint }}>{w}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {cells.map((d, i) => {
              if (d == null) return <div key={`e${i}`} />;
              const k = keyOf(view.y, view.m, d);
              const isToday = k === todayKey;
              const isSel = k === selected;
              const list = plans[k] || [];
              const dow = i % 7;
              const st = study[k];
              const sMin = st ? Math.round(((st.ai || 0) + (st.quiz || 0)) / 60) : 0;
              return (
                <button key={k} onClick={() => setSelected(k)}
                  style={{ aspectRatio: '1 / 1', borderRadius: 10, cursor: 'pointer', position: 'relative',
                    border: isSel ? `2px solid ${brand.primary}` : `1px solid ${surface.page}`,
                    background: isToday ? surface.accent : surface.white, padding: 2,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
                  {list.length > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%',
                      background: list.every((it) => it.done) ? semantic.success : semantic.warn }} />
                  )}
                  <span style={{ fontSize: '0.8rem', fontWeight: isToday ? 800 : 600, marginTop: 2,
                    color: isToday ? brand.primary : dow === 0 ? semantic.danger : dow === 6 ? brand.primaryDeep : ink.body }}>{d}</span>
                  {sMin > 0 && (
                    <span style={{ marginTop: 'auto', marginBottom: 3, fontSize: '0.54rem', fontWeight: 800,
                      color: brand.primary }}>
                      {sMin >= 60 ? `${(sMin / 60).toFixed(1)}h` : `${sMin}분`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ background: surface.white, borderRadius: 16, padding: 16,
          boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: ink.strongest }}>
              🗓 {selLabel || '날짜를 선택하세요'}
            </div>
            {selected && (
              <button onClick={() => setShareDate(selected)}
                style={{ flexShrink: 0, fontSize: '0.76rem', fontWeight: 800, color: ink.sub,
                  background: surface.raised, border: `1px solid ${line.base}`, borderRadius: 999,
                  padding: '5px 12px', cursor: 'pointer' }}>
                📷 인증 공유
              </button>
            )}
          </div>
          {selected && (() => {
            const t = getDayStudyTime(selected);
            const total = t.ai + t.quiz;
            const subs = getDaySubjects(selected);
            const slots = getDaySlots(selected);
            const cellBg = (idx) => {
              const sl = slots[idx];
              const ai = sl?.ai || 0, quiz = sl?.quiz || 0;
              const secs = ai + quiz;
              if (secs === 0) return surface.page;
              const op = 0.3 + 0.7 * Math.min(1, secs / 600);
              return ai >= quiz ? `rgba(79,70,229,${op})` : `rgba(22,163,74,${op})`;
            };
            const renderSubject = (s) => {
              const d = subs[s.id];
              const secs = d?.secs || 0;
              const units = d?.units ? Object.entries(d.units).sort((a, b) => b[1] - a[1]) : [];
              return (
                <div key={s.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: '0.78rem', flexShrink: 0 }}>{s.icon}</span>
                    <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 700, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: secs > 0 ? ink.strongest : ink.faint }}>{s.short}</span>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0, color: secs > 0 ? brand.primary : line.strong }}>{fmtHMS(secs)}</span>
                  </div>
                  {units.map(([label, sec], i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 21, marginTop: 5 }}>
                      <span style={{ flex: 1, fontSize: '0.7rem', color: ink.muted, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {label}</span>
                      <span style={{ fontSize: '0.66rem', color: ink.faint, fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0 }}>{fmtDuration(sec)}</span>
                    </div>
                  ))}
                </div>
              );
            };
            const stage1 = SUBJECTS.filter((s) => s.stage === 1);
            const stage2 = SUBJECTS.filter((s) => s.stage === 2);
            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ background: surface.accent, color: brand.primaryDeep, fontWeight: 800, borderRadius: 8,
                    padding: '4px 9px', fontSize: '0.76rem' }}>🕒 총 {fmtClock(total)}</span>
                  <span style={{ fontSize: '0.72rem', color: ink.muted }}>🤖 {fmtDuration(t.ai)} · 📚 {fmtDuration(t.quiz)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div style={{ fontSize: '0.66rem', color: ink.faint, fontWeight: 800, marginBottom: 5 }}>1차</div>
                    {stage1.map(renderSubject)}
                    <div style={{ fontSize: '0.66rem', color: ink.faint, fontWeight: 800, margin: '9px 0 5px' }}>2차</div>
                    {stage2.map(renderSubject)}
                  </div>
                  <div style={{ flex: '0 0 128px' }}>
                    <div style={{ fontSize: '0.66rem', color: ink.faint, fontWeight: 800, marginBottom: 5 }}>시간대</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 13, fontSize: '0.5rem', color: line.strong, textAlign: 'right',
                            flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{h}</span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 1, flex: 1 }}>
                            {Array.from({ length: 6 }, (_, sg) => {
                              const idx = h * 6 + sg;
                              return <div key={sg} title={`${h}:${String(sg * 10).padStart(2, '0')}`}
                                style={{ height: 7, borderRadius: 1, background: cellBg(idx) }} />;
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 7, fontSize: '0.58rem', color: ink.faint, flexWrap: 'wrap' }}>
                      <span><span style={{ color: brand.primary, fontWeight: 800 }}>■</span> AI</span>
                      <span><span style={{ color: semantic.success, fontWeight: 800 }}>■</span> 문제풀이</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          {selList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {selList.map((it) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  background: it.done ? semantic.successTint : surface.page, border: `1px solid ${it.done ? semantic.successLine : line.base}`,
                  borderRadius: 10, padding: '9px 12px' }}>
                  <button onClick={() => toggleItem(it.id)} aria-label="완료 토글"
                    style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                      border: `2px solid ${it.done ? semantic.success : line.strong}`, background: it.done ? semantic.success : surface.white,
                      color: surface.white, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {it.done ? '✓' : ''}
                  </button>
                  <span style={{ flex: 1, fontSize: '0.86rem', color: it.done ? ink.faint : ink.body,
                    textDecoration: it.done ? 'line-through' : 'none' }}>{it.text}</span>
                  <button onClick={() => removeItem(it.id)}
                    style={{ fontSize: '0.74rem', color: semantic.danger, background: 'none', border: 'none', cursor: 'pointer' }}>
                    삭제
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: ink.faint, textAlign: 'center', padding: '8px 0 14px' }}>
              아직 계획이 없어요. 아래에서 추가해보세요.
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={draft} placeholder="예: 수학 각론 3단원, 기출 20문제"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
              disabled={!selected}
              style={{ flex: 1, fontSize: '0.84rem', padding: '9px 12px', border: `1px solid ${line.base}`, borderRadius: 10 }} />
            <button onClick={addItem} disabled={!selected || !draft.trim()}
              style={{ fontSize: '0.84rem', fontWeight: 700, color: surface.white, borderRadius: 10, padding: '9px 16px',
                border: 'none', cursor: selected && draft.trim() ? 'pointer' : 'default',
                background: selected && draft.trim() ? brand.primary : line.strong }}>
              추가
            </button>
          </div>
        </section>

        <div style={{ marginTop: 14 }}>
          <DdayCard profile={profile} />
        </div>
      </main>
      <ShareStudyCard
        open={!!shareDate}
        onClose={() => setShareDate(null)}
        dateKey={shareDate || todayKey}
        profile={profile}
      />
    </div>
  );
}
