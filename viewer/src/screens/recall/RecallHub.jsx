// ⚠ 예전 '복습' 탭과 이름만 같다. 전 과목 입구 역할은 '전체 학습'이 가져갔다.
import { useState, useMemo } from 'react';
import { getWrongNotes } from '../../data/stores/learningStore';
import { snapshot } from '../../data/stores/drillStore';
import { unitIdsWithDrill } from '../../data/recommend';
import WrongNoteList from '../variant/WrongNoteList';
import HubHeader from '../../components/HubHeader';
import { brand, ink, line, surface, semantic, shadow } from '../../styles/tokens';

export default function RecallHub({ leavesBySubject, onPickUnit }) {
  const [showWrong, setShowWrong] = useState(false);
  const [ver, setVer] = useState(0);

  const data = useMemo(() => {
    const units = new Map();
    Object.values(leavesBySubject || {}).forEach((list) => (list || []).forEach((u) => units.set(u.id, u)));

    const wrong = getWrongNotes();
    const due = [];
    const learning = [];
    unitIdsWithDrill().forEach((id) => {
      const s = snapshot(id);
      const u = units.get(id);
      if (!s || !u) return;
      if (s.dueNow > 0) due.push({ unit: u, count: s.dueNow });
      const notYet = s.total - s.mastered;
      if (notYet > 0) learning.push({ unit: u, count: notYet });
    });
    due.sort((a, b) => b.count - a.count);
    learning.sort((a, b) => b.count - a.count);
    return { wrong, due, learning };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leavesBySubject, ver]);

  if (showWrong) return <WrongNoteList onBack={() => { setShowWrong(false); setVer((v) => v + 1); }} />;

  const empty = !data.wrong.length && !data.due.length && !data.learning.length;

  return (
    <div className="app-container">
      <HubHeader title="복습" sub="틀린 것과 다시 볼 것만 모았어요" />
      <main className="main-content">
        {empty ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: ink.faint, fontSize: '0.86rem', lineHeight: 1.8 }}>
            아직 복습할 게 없어요.<br />
            전체 학습에서 단원을 공부하면 틀린 것과<br />다시 볼 카드가 여기로 모여요.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <Group
              icon="wrong" title="오답노트" tone="danger"
              count={data.wrong.length} unitLabel="문제"
              desc="변형문제·기출에서 틀린 문제"
            >
              {data.wrong.length > 0 && (
                <button onClick={() => setShowWrong(true)} style={rowCard}>
                  <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: '0.92rem', color: ink.strongest }}>
                    틀린 문제 {data.wrong.length}개 보기
                  </span>
                  <span style={{ color: ink.faint, fontSize: '1.1rem' }}>›</span>
                </button>
              )}
            </Group>

            <Group
              icon="due" title="곧 다시 나올 카드" tone="brand"
              count={data.due.reduce((n, x) => n + x.count, 0)} unitLabel="장"
              desc="간격이 지나 재등장할 때가 된 스제트"
            >
              {data.due.map((x) => (
                <UnitRow key={x.unit.id} unit={x.unit} badge={`${x.count}장`} onClick={() => onPickUnit?.(x.unit)} />
              ))}
            </Group>

            <Group
              icon="seed" title="아직 안 외워진 것" tone="neutral"
              count={data.learning.reduce((n, x) => n + x.count, 0)} unitLabel="장"
              desc="정착 박스에 아직 못 올라간 카드"
            >
              {data.learning.map((x) => (
                <UnitRow key={x.unit.id} unit={x.unit} badge={`${x.count}장`} onClick={() => onPickUnit?.(x.unit)} />
              ))}
            </Group>
          </div>
        )}
      </main>
    </div>
  );
}

const GROUP_ICON = {
  wrong: 'M6.5 3.5h10A1.5 1.5 0 0 1 18 5v15l-5.5-3-5.5 3V5a1.5 1.5 0 0 1 1.5-1.5z',
  due:   'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 1.8',
  seed:  'M12 20v-7M12 13c0-3 2.2-5.5 5.5-5.5C17.5 11 15.2 13 12 13zM12 13C12 10 9.8 7.5 6.5 7.5 6.5 11 8.8 13 12 13z',
};

function Group({ icon, title, tone, count, unitLabel, desc, children }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 4px' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={TONE[tone].color}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d={GROUP_ICON[icon]} />
        </svg>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: ink.strongest }}>{title}</span>
        <span style={{ ...pill, ...TONE[tone] }}>{count}{unitLabel}</span>
      </div>
      <div style={{ fontSize: '0.76rem', color: ink.faint, margin: '0 2px 10px' }}>{desc}</div>
      {count === 0
        ? <div style={{ fontSize: '0.8rem', color: ink.faint, padding: '4px 2px' }}>없어요</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>}
    </section>
  );
}

function UnitRow({ unit, badge, onClick }) {
  const rest = unit.path.slice(1, 2).join(' · ');
  return (
    <button onClick={onClick} style={rowCard}>
      <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.92rem', color: ink.strongest }}>{unit.title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
          <span style={subjectChip}>{unit.path[0]}</span>
          {rest && <span style={{ fontSize: '0.74rem', color: ink.faint, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rest}</span>}
        </span>
      </span>
      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: brand.primaryDeep, flexShrink: 0 }}>{badge}</span>
      <span style={{ color: ink.faint, fontSize: '1.1rem', flexShrink: 0 }}>›</span>
    </button>
  );
}

const rowCard = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 14,
  padding: '13px 16px', boxShadow: shadow.sm, cursor: 'pointer',
};
const subjectChip = {
  fontSize: '0.72rem', fontWeight: 800, color: brand.primaryInk, flexShrink: 0,
  border: `1px solid ${brand.primary}`, background: brand.tintSoft,
  borderRadius: 7, padding: '2px 8px', lineHeight: 1.5,
};
const pill = { fontSize: '0.72rem', fontWeight: 800, padding: '2px 9px', borderRadius: 999 };
const TONE = {
  danger:  { background: semantic.dangerTint, color: semantic.danger },
  brand:   { background: brand.tint, color: brand.primaryDeep },
  neutral: { background: surface.sunken, color: ink.muted },
};
