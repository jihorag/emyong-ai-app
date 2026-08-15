// ⚠ 공용 영역이다. 프론트·백엔드 두 담당의 승인이 있어야 바꾼다.
import { useEffect, useState } from 'react'
import '../styles/global.css'
import HomeDashboard from '../screens/home/HomeDashboard.jsx'
import LearnHub from '../screens/learn/LearnHub.jsx'
import TodayHub from '../screens/today/TodayHub.jsx'
import RecallHub from '../screens/recall/RecallHub.jsx'
import StudyPlanner from '../screens/planner/StudyPlanner.jsx'
import Settings from '../screens/settings/Settings.jsx'
import StreakBadge from '../components/StreakBadge.jsx'
import Onboarding from './Onboarding.jsx'
import { useStudyTimer, useCurrentActivity } from './useStudyTimer'
import { SUBJECTS } from '../data/subjects'
import { loadSubjectModel } from '../data/dataModel'

const NAV = [
  { key: 'home',   label: '홈',       icon: 'home' },
  { key: 'learn',  label: '전체 학습', icon: 'book' },
  { key: 'today',  label: 'AI 추천',  icon: 'spark', center: true },
  { key: 'recall', label: '복습',     icon: 'cycle' },
  { key: 'stats',  label: '학습 통계', icon: 'chart' },
]
const ROUTE_KEYS = new Set([...NAV.map(n => n.key), 'settings'])
const LEGACY_ROUTES = { review: 'learn', variant: 'learn', essay: 'learn', planner: 'stats' }

const LS = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key)
      return v == null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { }
  },
  remove(key) {
    try { localStorage.removeItem(key) } catch { }
  },
}

function useHashTab() {
  const [tab, setTab] = useState(() => {
    const h = window.location.hash.replace(/^#\/?/, '')
    return ROUTE_KEYS.has(h) ? h : (LEGACY_ROUTES[h] || 'home')
  })
  useEffect(() => {
    const onChange = () => {
      const h = window.location.hash.replace(/^#\/?/, '')
      setTab(ROUTE_KEYS.has(h) ? h : (LEGACY_ROUTES[h] || 'home'))
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = (key) => {
    window.location.hash = `/${key}`
  }
  return [tab, navigate]
}

function dDay(examDate) {
  if (!examDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(examDate)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

export default function App() {
  const [tab, navigate] = useHashTab()
  const [profile, setProfile] = useState(() => LS.get('profile', null))
  const [showOnboarding, setShowOnboarding] = useState(() => !LS.get('profile', null))
  const [leavesBySubject, setLeavesBySubject] = useState({})
  const [jumpUnit, setJumpUnit] = useState(null)
  const [learnIntent, setLearnIntent] = useState(null)
  // ⚠ jumpUnit·learnIntent 를 안 비우면 다른 탭 갔다 돌아왔을 때 아까 보던 화면이 되살아난다.
  const [resetTick, setResetTick] = useState(0)
  const go = (key) => {
    setJumpUnit(null)
    setLearnIntent(null)
    setResetTick((n) => n + 1)
    navigate(key)
  }

  // ⚠️ 단원 ID는 반드시 dataModel에서 나와야 한다.
  useEffect(() => {
    let active = true;
    Promise.all(
      SUBJECTS.map((s) =>
        loadSubjectModel(s.id)
          .then((m) => [s.id, m.areas.flatMap((a) => a.units)])
          .catch((e) => {
            console.error(`단원 모델 로드 실패: ${s.id}`, e);
            return [s.id, []];
          }),
      ),
    ).then((entries) => {
      if (active) setLeavesBySubject(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, []);

  useStudyTimer(useCurrentActivity());

  const completeOnboarding = (p) => {
    LS.set('profile', p)
    setProfile(p)
    setShowOnboarding(false)
  }

  const resetProfile = () => {
    if (!confirm('프로필을 초기화하시겠습니까? 진척 데이터는 유지됩니다.')) return
    LS.remove('profile')
    setProfile(null)
    setShowOnboarding(true)
  }

  return (
    <div className="app-shell with-nav">
      {showOnboarding ? (
        <div className="app-container">
          <Onboarding onComplete={completeOnboarding} />
        </div>
      ) : (
        <>
          {tab === 'stats' && <BrandHeader profile={profile} />}
          {tab === 'home'   && <HomeDashboard key={`home:${resetTick}`} profile={profile} navigate={navigate} leavesBySubject={leavesBySubject}
                                 onResetProfile={resetProfile}
                                 onEssay={() => { setLearnIntent('essay'); navigate('learn'); }} />}
          {tab === 'learn'  && <LearnHub key={jumpUnit ? `u:${jumpUnit.id}` : `root:${learnIntent || ''}:${resetTick}`} navigate={navigate}
                                 initialUnit={jumpUnit} onExitUnit={() => setJumpUnit(null)} leavesBySubject={leavesBySubject}
                                 intent={learnIntent} onConsumeIntent={() => setLearnIntent(null)} />}
          {tab === 'today'  && <TodayHub key={`today:${resetTick}`} leavesBySubject={leavesBySubject}
                                 onPickUnit={(u) => { setJumpUnit(u); navigate('learn'); }} />}
          {tab === 'recall' && <RecallHub key={`recall:${resetTick}`} leavesBySubject={leavesBySubject}
                                 onPickUnit={(u) => { setJumpUnit(u); navigate('learn'); }} />}
          {tab === 'stats'  && <StudyPlanner key={`stats:${resetTick}`} examDates={{ '초등임용_1차': profile?.examDate }} primaryExam="초등임용" profile={profile} />}
          {tab === 'settings' && <Settings profile={profile} onResetProfile={resetProfile} onBack={() => navigate('home')} />}
          <BottomNav tab={tab} onNavigate={go} />
        </>
      )}
    </div>
  )
}

function BrandHeader({ profile }) {
  const dday = dDay(profile?.examDate)
  return (
    <header className="top-nav" style={{ justifyContent: 'space-between' }}>
      <div className="header-brand" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>이묭AI</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <StreakBadge compact />
        {dday != null && (
          <div className={'header-dday' + (dday <= 30 ? ' header-dday-urgent' : '')}
               style={{
                 fontWeight: 700,
                 fontSize: '0.85rem',
                 padding: '4px 10px',
                 background: 'var(--primary-light)',
                 color: 'var(--primary)',
                 borderRadius: '999px'
               }}>
            {dday > 0 ? `D-${dday}` : dday === 0 ? 'D-DAY' : `D+${-dday}`}
          </div>
        )}
      </div>
    </header>
  )
}

const NAV_PATHS = {
  home:  'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  book:  'M4 4.5h6a2.5 2.5 0 0 1 2 2.5 2.5 2.5 0 0 1 2-2.5h6v13h-6a2.5 2.5 0 0 0-2 2 2.5 2.5 0 0 0-2-2H4zM12 7v12',
  spark: 'M12 4v16M4 12h16M7.2 7.2l9.6 9.6M16.8 7.2l-9.6 9.6',
  cycle: 'M20 12a8 8 0 0 1-13.7 5.7M4 12a8 8 0 0 1 13.7-5.7M17.5 3v3.5H14M6.5 21v-3.5H10',
  chart: 'M4 20h16M7 20v-6M12 20V7M17 20v-9',
}

function NavIcon({ name, strokeWidth = 1.8 }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={NAV_PATHS[name]} />
    </svg>
  )
}

function BottomNav({ tab, onNavigate }) {
  return (
    <nav className="bottom-nav" style={{ '--nav-count': NAV.length }}>
      {NAV.map(n => (
        <button
          key={n.key}
          className={(tab === n.key ? 'active' : '') + (n.center ? ' nav-center' : '')}
          onClick={() => onNavigate(n.key)}
          aria-current={tab === n.key ? 'page' : undefined}
        >
          {n.center ? (
            <span className="nav-center-disc"><NavIcon name={n.icon} strokeWidth={2.1} /></span>
          ) : (
            <span className="nav-ico"><NavIcon name={n.icon} /></span>
          )}
          <span>{n.label}</span>
        </button>
      ))}
    </nav>
  )
}
