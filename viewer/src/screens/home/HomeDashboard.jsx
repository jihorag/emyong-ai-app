import { useMemo, useState } from 'react';
import { getMastery, getStreak, detectWeaknesses, getAllAnswerHistories } from '../../data/stores/learningStore';
import { SUBJECTS } from '../../data/subjects';
import { getDayTotal, dayKey } from '../../data/stores/studyTime';
import { snapshot } from '../../data/stores/drillStore';
import { unitIdsWithDrill } from '../../data/recommend';
import ShareStudyCard from '../planner/ShareStudyCard';
import HubHeader from '../../components/HubHeader';
import { palette, brand, ink, line, surface, gradient, shadow } from '../../styles/tokens';

const BLUE = brand.primary;
const GRAY = ink.faint;
const BENCH = 80;
const GOAL_SCORE = 75;
const RADAR_SUBJECTS = ['korean', 'math', 'society', 'science', 'english'];

export default function HomeDashboard({ profile, navigate, leavesBySubject, onResetProfile, onEssay }) {
  const [view, setView] = useState('home');
  const [share, setShare] = useState(false);
  const mastery = getMastery();
  const streak = getStreak();

  const bySubject = useMemo(() => {
    const map = {};
    SUBJECTS.forEach((s) => {
      const leaves = leavesBySubject[s.id] || [];
      const total = leaves.length;
      let mastered = 0; const accs = [];
      leaves.forEach((l) => {
        const m = mastery[l.id];
        if (m?.status === 'mastered') mastered++;
        if (m && (m.attempted || 0) > 0) accs.push(m.accuracy || 0);
      });
      const masterPct = total ? mastered / total : 0;
      const acc = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : 0;
      map[s.id] = Math.round((masterPct * 0.6 + acc * 0.4) * 100);
    });
    return map;
  }, [leavesBySubject, mastery]);

  const pred = useMemo(() => {
    const vals = SUBJECTS.map((s) => bySubject[s.id]).filter((v) => v > 0);
    const score = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / SUBJECTS.length) : 0;
    const attempted = Object.values(mastery).filter((x) => (x.attempted || 0) > 0);
    const acc = attempted.length ? Math.round(attempted.reduce((a, x) => a + (x.accuracy || 0), 0) / attempted.length * 100) : 0;
    const masteredUnits = Object.values(mastery).filter((x) => x.status === 'mastered').length;
    return { score, acc, mastered: masteredUnits, hasData: attempted.length >= 1 || masteredUnits >= 1 };
  }, [bySubject, mastery]);

  const weak = useMemo(() => {
    const list = detectWeaknesses(mastery, getAllAnswerHistories(), 4);
    const allLeaves = Object.values(leavesBySubject).flat();
    return list.map((w) => {
      const leaf = allLeaves.find((l) => l.id === w.leafId);
      return leaf ? { name: leaf.path.slice(1).join(' › '), mine: Math.round((mastery[w.leafId]?.accuracy || 0) * 100) } : null;
    }).filter(Boolean);
  }, [mastery, leavesBySubject]);

  const dday = dDay(profile?.examDate);

  const live = useMemo(() => {
    let mastered = 0; let due = 0; let cov = 0; let units = 0;
    unitIdsWithDrill().forEach((id) => {
      const s = snapshot(id);
      if (!s) return;
      mastered += s.mastered; due += s.dueNow; cov += s.coverage; units += 1;
    });
    return {
      settle: units ? Math.round((cov / units) * 100) : 0,
      mastered,
      due,
      minutes: Math.round(getDayTotal(dayKey()) / 60),
    };
  }, []);

  if (view === 'skill') {
    return (
      <div className="app-container">
        <HubHeader title="내 실력" sub="합격권 대비 지금 어디쯤인지" onBack={() => setView('home')} />
        <main className="main-content">
          <ScoreBlock pred={pred} streak={streak} dday={dday} profile={profile} />
          <Card title="과목별 실력" desc="주요 5과목의 내 실력과 합격권 정답률 차이입니다.">
            <SkillRadar axes={RADAR_SUBJECTS.map((id) => {
              const s = SUBJECTS.find((x) => x.id === id);
              return { label: s.short, mine: bySubject[id] || 0, bench: BENCH };
            })} />
          </Card>
          <Card title="과목별 정답률" desc="내 실력과 합격권 사용자의 과목별 차이입니다.">
            <SubjectBars data={SUBJECTS.map((s) => ({ label: s.short, mine: bySubject[s.id] || 0, bench: BENCH }))} />
          </Card>
          <Card title="취약한 단원" desc="합격권 대비 아직 비어 있는 단원입니다. 먼저 채우세요.">
            {weak.length ? weak.map((w, i) => <WeakRow key={i} name={w.name} mine={w.mine} bench={70} onGo={() => navigate('learn')} />)
              : <Empty>복습·변형문제를 풀면 취약 단원이 자동으로 잡힙니다.</Empty>}
          </Card>
          <Card title="설정">
            <div style={{ fontSize: '0.86rem', color: ink.body, lineHeight: 1.8 }}>
              <div><b>페르소나</b> {profile?.persona} · <b>지역</b> {profile?.region} · <b>시험일</b> {profile?.examDate}</div>
            </div>
            <button onClick={onResetProfile} style={resetBtn}>프로필 다시 설정</button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <main className="main-content" style={{ paddingTop: 16 }}>
        <section style={hero}>
          <button onClick={() => navigate('settings')} aria-label="설정" style={heroGear}>⚙</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', color: palette.lavender2, fontWeight: 600 }}>
              안녕하세요, {profile?.name || profile?.persona || '나'}님
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: surface.white, lineHeight: 1.05 }}>
                {dday == null ? '—' : dday > 0 ? `D-${dday}` : dday === 0 ? 'D-DAY' : `D+${-dday}`}
              </span>
              <span style={{ fontSize: '0.82rem', color: palette.lavender2 }}>임용 1차까지</span>
            </div>
            <span style={heroPill}>🔥 {streak.current || 0}일 연속 학습 중</span>
          </div>
          <img src="/imyong.png" alt="" style={heroMascot} />
        </section>

        <section style={statCard}>
          <SettleRing pct={live.settle} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <NumRow label="오늘 공부" value={`${live.minutes}분`} />
            <NumRow label="외운 카드" value={String(live.mastered)} />
          </div>
        </section>

        <button onClick={() => navigate(live.due > 0 ? 'recall' : 'today')} style={todayCard}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: surface.white, textAlign: 'left' }}>
            {live.due > 0 ? `오늘의 복습 · 카드 ${live.due}장` : '오늘의 복습 시작하기'}
          </div>
          <div style={{ fontSize: '0.8rem', color: palette.lavender2, marginTop: 5, textAlign: 'left' }}>
            {live.due > 0 ? '짧게 떠올리고, 확실하게 정착해요.' : '이묭이가 오늘 볼 단원을 골라뒀어요.'}
          </div>
          <span style={todayBtn}>지금 복습 시작하기 →</span>
        </button>

        <div style={{ fontSize: '0.8rem', color: ink.muted, fontWeight: 700, margin: '22px 2px 10px' }}>바로가기</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Shortcut icon="essay" title="논술 채점" desc="사진 올려 채점" onClick={onEssay} />
          <Shortcut icon="exam" title="모의고사" desc="실전 연습" soon />
          <Shortcut icon="share" title="공부 공유" desc="기록·챌린지" onClick={() => setShare(true)} />
          <Shortcut icon="chart" title="내 실력" desc="합격권 대비" onClick={() => setView('skill')} />
        </div>
      </main>
      <ShareStudyCard open={share} onClose={() => setShare(false)} dateKey={dayKey()} profile={profile} />
    </div>
  );
}

function ScoreBlock({ pred, streak, dday, profile }) {
  return (
    <section style={{ ...statCard, flexDirection: 'column', gap: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
        <Chip>🔥 {streak.current || 0}일 연속</Chip>
        {dday != null && <Chip>📅 1차 D-{dday > 0 ? dday : 0}</Chip>}
        <Chip>📍 {profile?.region || '서울'}</Chip>
      </div>
      <ScoreGauge score={pred.score} goal={GOAL_SCORE} acc={pred.acc} mastered={pred.mastered} />
      <div style={{ display: 'flex', gap: 14, fontSize: '0.78rem', color: ink.muted }}>
        <Legend color={BLUE} label="내 실력" />
        <Legend color={GRAY} label="합격권" />
      </div>
    </section>
  );
}

function SettleRing({ pct }) {
  const size = 96, r = 39, cx = size / 2, cy = size / 2, sw = 10;
  const C = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={line.base} strokeWidth={sw} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={brand.primary} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${C * (pct / 100)} ${C}`}
          transform={`rotate(-90 ${cx} ${cy})`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: brand.primaryInk }}>{pct}%</span>
        <span style={{ fontSize: '0.66rem', color: ink.faint, fontWeight: 600 }}>정착도</span>
      </div>
    </div>
  );
}

function NumRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.76rem', color: ink.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: brand.primaryInk, marginTop: 1 }}>{value}</div>
    </div>
  );
}

const SHORTCUT_ICON = {
  essay: 'M5 20h14M7.5 16.5l8.6-8.6a2 2 0 0 0-2.8-2.8L4.7 13.7 4 19l5.3-.7z',
  exam:  'M8 3.5h8a1.5 1.5 0 0 1 1.5 1.5v14A1.5 1.5 0 0 1 16 20.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5zM9.5 8h5M9.5 12h5M9.5 16h3',
  share: 'M12 15.5V4M8.5 7.5 12 4l3.5 3.5M5 14v5.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V14',
  chart: 'M4 20h16M7.5 20v-5M12 20V8.5M16.5 20v-8',
};

function Shortcut({ icon, title, desc, onClick, soon }) {
  return (
    <button onClick={soon ? undefined : onClick} disabled={soon}
      style={{ ...shortcutCard, ...(soon ? shortcutSoon : null) }}>
      <span style={{ ...shortcutIcon, ...(soon ? { background: surface.sunken } : null) }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke={soon ? ink.faint : brand.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={SHORTCUT_ICON[icon]} />
        </svg>
      </span>
      <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', color: soon ? ink.faint : ink.strongest }}>{title}</span>
        <span style={{ display: 'block', fontSize: '0.71rem', color: ink.faint, marginTop: 2 }}>{soon ? '준비 중' : desc}</span>
      </span>
    </button>
  );
}

function ScoreGauge({ score, goal, acc, mastered }) {
  const size = 172, r = 74, cx = size / 2, cy = size / 2, sw = 13;
  const C = 2 * Math.PI * r;
  const max = 100;
  const frac = Math.max(0, Math.min(1, score / max));
  const goalAngle = (goal / max) * 360 - 90;
  const gx = cx + r * Math.cos(goalAngle * Math.PI / 180);
  const gy = cy + r * Math.sin(goalAngle * Math.PI / 180);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={line.base} strokeWidth={sw} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={BLUE} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${C * frac} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} />
        <circle cx={gx} cy={gy} r={4.5} fill={ink.strongest} />
      </svg>
      <div style={{ position: 'absolute', left: gx - 30, top: gy - 26, background: ink.strongest, color: surface.white, fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap' }}>Goal {goal}</div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '0.66rem', color: ink.faint, fontWeight: 600 }}>예측 점수</div>
        <div style={{ fontSize: '2.4rem', fontWeight: 800, color: BLUE, lineHeight: 1 }}>{score}</div>
        <div style={{ display: 'flex', gap: 14, marginTop: 6, borderTop: `1px solid ${line.base}`, paddingTop: 6, width: 118, justifyContent: 'center' }}>
          <GaugeSub v={acc + '%'} l="정답률" />
          <div style={{ width: 1, background: line.soft }} />
          <GaugeSub v={mastered} l="마스터" />
        </div>
      </div>
    </div>
  );
}
function GaugeSub({ v, l }) {
  return <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.86rem', fontWeight: 800, color: ink.body }}>{v}</div><div style={{ fontSize: '0.58rem', color: ink.faint }}>{l}</div></div>;
}

function SkillRadar({ axes }) {
  const n = axes.length, size = 260, cx = size / 2, cy = size / 2 + 6, R = 88;
  const pt = (i, frac) => {
    const a = -90 + i * (360 / n);
    return [cx + R * frac * Math.cos(a * Math.PI / 180), cy + R * frac * Math.sin(a * Math.PI / 180)];
  };
  const poly = (key) => axes.map((ax, i) => pt(i, (ax[key] || 0) / 100).join(',')).join(' ');
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={size} height={size + 10}>
        {[0.2, 0.4, 0.6, 0.8, 1].map((g, i) => (
          <polygon key={i} points={axes.map((_, j) => pt(j, g).join(',')).join(' ')} fill="none" stroke={line.base} strokeWidth={1} />
        ))}
        {axes.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={line.base} strokeWidth={1} />; })}
        <polygon points={poly('bench')} fill="none" stroke={GRAY} strokeWidth={2} strokeDasharray="4 3" />
        <polygon points={poly('mine')} fill={BLUE + '33'} stroke={BLUE} strokeWidth={2} />
        {axes.map((ax, i) => {
          const [x, y] = pt(i, 1.16);
          return (
            <g key={i}>
              <text x={x} y={y - 3} textAnchor="middle" fontSize="11" fontWeight="700" fill={ink.body}>{ax.label}</text>
              <text x={x} y={y + 11} textAnchor="middle" fontSize="10.5" fontWeight="800" fill={BLUE}>{ax.mine}<tspan fill={ink.faint}>/{ax.bench}</tspan></text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SubjectBars({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 30, fontSize: '0.76rem', fontWeight: 700, color: ink.sub, flexShrink: 0 }}>{d.label}</span>
          <div style={{ flex: 1, position: 'relative', height: 16, background: surface.sunken, borderRadius: 5 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${d.bench}%`, borderRight: `2px solid ${GRAY}`, opacity: 0.5 }} />
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(2, d.mine)}%`, background: BLUE, borderRadius: 5 }} />
          </div>
          <span style={{ width: 30, textAlign: 'right', fontSize: '0.74rem', fontWeight: 800, color: BLUE, flexShrink: 0 }}>{d.mine}</span>
        </div>
      ))}
    </div>
  );
}

function WeakRow({ name, mine, bench, onGo }) {
  return (
    <button onClick={onGo} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', borderBottom: `1px solid ${surface.sunken}` }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: ink.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
      <div style={{ fontSize: '0.8rem', margin: '3px 0 6px' }}><b style={{ color: BLUE }}>{mine}%</b> <span style={{ color: ink.faint }}>/ {bench}%</span></div>
      <div style={{ position: 'relative', height: 7, background: surface.sunken, borderRadius: 999 }}>
        <div style={{ position: 'absolute', left: `${bench}%`, top: -2, width: 0, height: 11, borderLeft: `2px solid ${GRAY}` }} />
        <div style={{ height: '100%', width: `${Math.max(2, mine)}%`, background: BLUE, borderRadius: 999 }} />
      </div>
    </button>
  );
}

function Card({ title, desc, children }) {
  return (
    <section style={{ background: surface.white, borderRadius: 16, padding: 18, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: ink.strongest, margin: 0 }}>{title}</h3>
      {desc && <p style={{ fontSize: '0.8rem', color: ink.muted, margin: '6px 0 14px', lineHeight: 1.5 }}>{desc}</p>}
      {!desc && <div style={{ height: 12 }} />}
      {children}
    </section>
  );
}
function Legend({ color, label }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: color }} />{label}</span>;
}
function Chip({ children }) {
  return <span style={{ fontSize: '0.74rem', fontWeight: 700, color: ink.sub, background: surface.sunken, borderRadius: 999, padding: '4px 10px' }}>{children}</span>;
}
function Empty({ children }) { return <div style={{ fontSize: '0.84rem', color: ink.faint, padding: '8px 0' }}>{children}</div>; }

const hero = {
  position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
  background: `linear-gradient(135deg, ${ink.strongest}, ${brand.primaryDeep})`,
  borderRadius: 20, padding: '20px 20px 22px', marginBottom: 14, overflow: 'hidden',
};
const heroGear = {
  position: 'absolute', top: 10, right: 12, width: 30, height: 30, borderRadius: '50%',
  border: 'none', background: 'transparent', color: palette.lavender2,
  fontSize: '1rem', cursor: 'pointer', lineHeight: 1,
};
const heroPill = {
  display: 'inline-block', marginTop: 14, fontSize: '0.74rem', fontWeight: 700,
  color: surface.white, background: 'rgba(255,255,255,0.16)', padding: '5px 11px', borderRadius: 999,
};
const heroMascot = {
  width: 74, height: 74, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
  border: `3px solid rgba(255,255,255,0.22)`,
};

const statCard = {
  display: 'flex', alignItems: 'center', gap: 18,
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 18,
  padding: '18px 20px', marginBottom: 14, boxShadow: shadow.sm,
};

const todayCard = {
  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none',
  background: gradient.brand, borderRadius: 18, padding: '18px 20px 20px', boxShadow: shadow.md,
};
const todayBtn = {
  display: 'block', marginTop: 14, background: surface.white, color: brand.primaryDeep,
  fontWeight: 800, fontSize: '0.88rem', textAlign: 'center', padding: '12px', borderRadius: 12,
};

const shortcutCard = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 14,
  padding: '13px 14px', boxShadow: shadow.sm, cursor: 'pointer',
};
const shortcutSoon = { background: surface.sunken, borderColor: line.neutral, boxShadow: 'none', cursor: 'default' };
const shortcutIcon = {
  width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: brand.tint,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const resetBtn = { marginTop: 14, width: '100%', padding: 11, borderRadius: 10, border: `1px solid ${line.base}`, background: surface.white, color: ink.muted, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' };

function dDay(examDate) {
  if (!examDate) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const e = new Date(examDate); e.setHours(0, 0, 0, 0);
  return Math.round((e - t) / 86400000);
}
