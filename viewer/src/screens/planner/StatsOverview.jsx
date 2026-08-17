import { useMemo, useState } from 'react';
import { SUBJECTS } from '../../data/subjects';
import { snapshot } from '../../data/stores/drillStore';
import { unitIdsWithDrill } from '../../data/recommend';
import { getMastery, getAllAnswerHistories, detectWeaknesses } from '../../data/stores/learningStore';
import { loadStudyTime, getDayTotal, dayKey } from '../../data/stores/studyTime';
import { fmtDuration } from '../../lib/format';
import SkillRadar from '../../components/viz/SkillRadar.jsx';
import { brand, ink, line, surface, semantic, shadow } from '../../styles/tokens';

// ⚠ 합격권은 데이터가 아니라 우리가 정한 기준선이다. 근거가 생기면 과목별로 나눈다.
const PASS_LINE = 75;

const RANGES = [
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
  { key: 'all', label: '전체' },
];

const PLANNER_KEY = 'quiz-planner-v1';
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');

const daysUntil = (ymd) => {
  if (!ymd) return null;
  const d = new Date(ymd + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.ceil((d - t) / 86400000);
};

export function RangeTabs({ range, onRange }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: surface.sunken, borderRadius: 10, padding: 3 }}>
      {RANGES.map((r) => (
        <button key={r.key} onClick={() => onRange(r.key)}
          style={{ ...rangeBtn, ...(range === r.key ? rangeBtnOn : null) }}>{r.label}</button>
      ))}
    </div>
  );
}

export function ProgressCard({ leavesBySubject = {} }) {
  const subjects = useMemo(() => {
    const drilled = new Set(unitIdsWithDrill());
    return SUBJECTS.map((s) => {
      const units = leavesBySubject[s.id] || [];
      let cov = 0; let n = 0;
      units.forEach((u) => {
        if (!drilled.has(u.id)) return;
        const snap = snapshot(u.id);
        if (snap) { cov += snap.coverage; n += 1; }
      });
      return { label: s.short, mine: n ? Math.round((cov / n) * 100) : null, bench: PASS_LINE };
    }).filter((x) => x.mine != null);
  }, [leavesBySubject]);

  const avg = subjects.length
    ? Math.round(subjects.reduce((n, s) => n + s.mine, 0) / subjects.length) : 0;
  const reached = subjects.filter((s) => s.mine >= PASS_LINE).length;

  return (
    <section style={card}>
      <div style={cardTitle}>학습 진척 현황</div>
      <div style={cardDesc}>과목별 정착도를 합격권 기준선과 겹쳐 봤어요</div>
      {subjects.length < 3 ? (
        <div style={emptyLine}>
          {subjects.length ? '과목 3개 이상 학습하면 다각형으로 보여드려요' : '아직 정착도가 쌓인 과목이 없어요'}
        </div>
      ) : (
        <>
          <SkillRadar axes={subjects} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 4 }}>
            <span style={legend}><span style={legendArea} />내 정착도</span>
            <span style={{ ...legend, color: ink.faint }}><span style={legendDash} />합격권 {PASS_LINE}%</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Stat value={`${avg}%`} label="평균 정착도" />
            <Stat value={`${reached} / ${subjects.length}`} label="합격권 도달" />
          </div>
        </>
      )}
    </section>
  );
}

export function WeakCard({ leavesBySubject = {}, onReview }) {
  const weak = useMemo(() => {
    const mastery = getMastery();
    const all = Object.values(leavesBySubject).flat();
    return detectWeaknesses(mastery, getAllAnswerHistories(), 4).map((w) => {
      const unit = all.find((u) => u.id === w.leafId);
      if (!unit) return null;
      const acc = mastery[w.leafId]?.accuracy;
      const pct = acc > 0 ? Math.round(acc * 100) : Number((w.reason.match(/(\d+)%/) || [])[1]) || 0;
      return { id: w.leafId, title: unit.title, subject: unit.path[0], pct, reason: w.reason };
    }).filter(Boolean);
  }, [leavesBySubject]);

  return (
    <section style={{ ...card, background: semantic.dangerTint, border: `1px solid ${semantic.dangerLine}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={semantic.danger}
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M12 4.2 2.8 20h18.4L12 4.2zM12 10v4.2M12 17.2v.01" />
        </svg>
        <span style={{ ...cardTitle, marginBottom: 0, flex: 1 }}>약점 단원 자동 탐지</span>
        {!!weak.length && <button onClick={onReview} style={reviewBtn}>복습하기 ›</button>}
      </div>

      {!weak.length ? (
        <div style={{ ...emptyLine, color: ink.muted }}>아직 약점으로 잡힌 단원이 없어요</div>
      ) : (
        <>
          <div style={{ fontSize: '0.76rem', color: semantic.danger, fontWeight: 700, margin: '12px 0 10px' }}>
            합격권 {PASS_LINE}% 기준 · 아래 {weak.length}개가 가장 뒤처져 있어요
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {weak.map((w) => (
              <div key={w.id} style={weakRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={weakChip}>{w.subject}</span>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: '0.86rem', color: ink.strongest,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</span>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: semantic.danger, flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums' }}>{w.pct}%</span>
                </div>
                <div style={weakTrack}>
                  <div style={{ ...weakFill, width: `${Math.max(3, Math.min(100, w.pct))}%` }} />
                  <div style={{ ...weakGoal, left: `${PASS_LINE}%` }} />
                </div>
                <div style={{ fontSize: '0.7rem', color: ink.faint, marginTop: 5 }}>{w.reason}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function StudyTimeCard({ range }) {
  const [openMonth, setOpenMonth] = useState(false);
  const bars = useMemo(
    () => (range === 'week' ? weekBars() : range === 'month' ? monthBars() : allBars()),
    [range],
  );
  const total = bars.reduce((n, b) => n + b.secs, 0);
  const peak = Math.max(1, ...bars.map((b) => b.secs));
  const totalLabel = range === 'week' ? '이번 주' : range === 'month' ? '이번 달' : '전체';

  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ ...cardTitle, marginBottom: 0 }}>공부 시간</div>
        <span style={{ fontSize: '0.78rem', color: ink.muted, fontWeight: 600 }}>
          {totalLabel} {total > 0 ? fmtDuration(total) : '0분'}
        </span>
      </div>
      {!bars.length ? (
        <div style={emptyLine}>기록이 아직 없어요</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: range === 'month' ? 2 : 8, height: 108 }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, minWidth: 0 }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div title={fmtDuration(b.secs)} style={{
                  width: '100%',
                  height: b.secs ? `${Math.max(8, (b.secs / peak) * 100)}%` : 7,
                  borderRadius: range === 'month' ? 2 : 6,
                  background: b.secs ? (b.today ? brand.primaryDeep : brand.primary) : line.base,
                }} />
              </div>
              <span style={{ fontSize: '0.68rem', color: b.today ? brand.primaryInk : ink.faint,
                fontWeight: b.today ? 800 : 500, whiteSpace: 'nowrap' }}>{b.label}</span>
            </div>
          ))}
        </div>
      )}
      {range === 'month' && (
        <button onClick={() => setOpenMonth((v) => !v)}
          style={{ ...reviewBtn, color: brand.primaryInk, marginTop: 12 }}>
          {openMonth ? '날짜별 접기' : '날짜별 보기'}
        </button>
      )}
      {range === 'month' && openMonth && (
        <div style={{ marginTop: 8, fontSize: '0.76rem', color: ink.muted, lineHeight: 1.9 }}>
          {bars.map((b, i) => (b.secs ? <div key={i}>{i + 1}일 · {fmtDuration(b.secs)}</div> : null))}
        </div>
      )}
    </section>
  );
}

export function DdayCard({ profile }) {
  const plan = useMemo(() => nextPlan(), []);
  const examDday = daysUntil(profile?.examDate);
  return (
    <section style={{ ...card, marginBottom: 0 }}>
      <div style={cardTitle}>계획 · D-day</div>
      {examDday != null && <DdayRow title="초등임용 1차" sub={profile?.examDate} dday={examDday} first />}
      {plan && <DdayRow title={plan.text} sub={plan.date} dday={plan.dday} first={examDday == null} />}
      {examDday == null && !plan && <div style={emptyLine}>등록된 일정이 없어요</div>}
    </section>
  );
}

function weekBars() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label: WD[d.getDay()], secs: getDayTotal(dayKey(d)), today: dayKey(d) === dayKey(now) };
  });
}

function monthBars() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
    return {
      label: (i + 1) % 7 === 1 ? String(i + 1) : '',
      secs: getDayTotal(dayKey(d)),
      today: dayKey(d) === dayKey(now),
    };
  });
}

function allBars() {
  const all = loadStudyTime();
  const byMonth = new Map();
  Object.entries(all).forEach(([k, v]) => {
    const m = k.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) || 0) + (v?.ai || 0) + (v?.quiz || 0));
  });
  const now = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
  return [...byMonth.entries()].sort()
    .map(([m, secs]) => ({ label: `${Number(m.slice(5))}월`, secs, today: m === now }));
}

function nextPlan() {
  let plans = {};
  try { plans = JSON.parse(localStorage.getItem(PLANNER_KEY) || '{}') || {}; } catch { }
  const today = dayKey(new Date());
  const hit = Object.entries(plans)
    .filter(([k, list]) => k >= today && Array.isArray(list) && list.some((it) => !it.done))
    .sort(([a], [b]) => a.localeCompare(b))[0];
  if (!hit) return null;
  const [date, list] = hit;
  return { date, text: (list.find((it) => !it.done) || {}).text || '', dday: daysUntil(date) };
}

function Stat({ value, label }) {
  return (
    <div style={statBox}>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: brand.primaryInk }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: ink.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function DdayRow({ title, sub, dday, first }) {
  return (
    <div style={{ ...ddayRow, borderTop: first ? 'none' : `1px solid ${line.soft}` }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', color: ink.strongest,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ display: 'block', fontSize: '0.74rem', color: ink.faint, marginTop: 3 }}>{sub}</span>
      </span>
      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: brand.primaryInk, flexShrink: 0 }}>
        D{dday > 0 ? `-${dday}` : dday === 0 ? '-DAY' : `+${-dday}`}
      </span>
    </div>
  );
}

const card = {
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 16,
  padding: '18px 18px 16px', marginBottom: 14, boxShadow: shadow.sm,
};
const cardTitle = { fontWeight: 800, fontSize: '1rem', color: ink.strongest, marginBottom: 4 };
const cardDesc = { fontSize: '0.76rem', color: ink.faint, marginBottom: 12 };
const emptyLine = { fontSize: '0.82rem', color: ink.faint, padding: '10px 0' };

const legend = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: ink.muted };
const legendArea = {
  width: 12, height: 9, borderRadius: 2, background: brand.tint, border: `1.5px solid ${brand.primary}`,
};
const legendDash = { width: 13, height: 0, borderTop: `2px dashed ${ink.faint}` };

const statBox = {
  flex: 1, textAlign: 'center', background: brand.tintSoft,
  border: `1px solid ${line.soft}`, borderRadius: 12, padding: '10px 6px',
};

const reviewBtn = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
  fontSize: '0.78rem', fontWeight: 800, color: semantic.danger,
};

const weakRow = {
  background: surface.card, border: `1px solid ${semantic.dangerLine}`,
  borderRadius: 12, padding: '11px 13px 12px',
};
const weakChip = {
  fontSize: '0.68rem', fontWeight: 800, color: semantic.danger, flexShrink: 0,
  border: `1px solid ${semantic.dangerLine}`, background: semantic.dangerTint,
  borderRadius: 6, padding: '1px 7px',
};
const weakTrack = {
  position: 'relative', height: 7, borderRadius: 999,
  background: semantic.dangerTint, marginTop: 9, overflow: 'hidden',
};
const weakFill = {
  position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, background: semantic.danger,
};
const weakGoal = { position: 'absolute', top: 0, bottom: 0, width: 2, background: ink.faint };

const rangeBtn = {
  padding: '5px 13px', borderRadius: 8, border: 'none', background: 'none',
  fontSize: '0.78rem', fontWeight: 700, color: ink.muted, cursor: 'pointer',
};
const rangeBtnOn = { background: brand.primary, color: ink.onBrand };

const ddayRow = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' };
