import { useState, useMemo } from 'react'

const PERSONAS = [
  { key: '초수',     label: '초수 (교대 4학년)', desc: '학교 + 인강 + 실습 + 스터디' },
  { key: 'N수',      label: 'N수생',             desc: '재수·삼수 이상' },
  { key: '재임용',   label: '현직 재임용',         desc: '교사 근무 병행' },
  { key: '직장병행', label: '직장·기간제 병행',    desc: '풀타임 학습 어려움' },
  { key: '휴학',     label: '휴학·전업',          desc: '시간 여유 있음' },
]

const REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]

function ObMascot() {
  const [err, setErr] = useState(false)
  if (err) return <div className="ob-mascot">🐶</div>
  return <img className="ob-mascot" src="/imyong.png" alt="이묭이" onError={() => setErr(true)} />
}

function ObSay({ children }) {
  return (
    <div className="ob-hi">
      <ObMascot />
      <div className="ob-bubble">
        <span className="who">이묭이</span>
        {children}
      </div>
    </div>
  )
}

const OB_FEATURES = [
  { ic: '🧠', tt: 'AI 복습', ds: '단권화 노트를 바탕으로 저랑 대화하며 인출 연습 — 교육과정·오개념·수업 모형·말로 설명까지.' },
  { ic: '⚡', tt: '스제트', ds: '단원의 모든 내용을 한 줄 문장으로 통암기. 틀린 건 간격을 두고 다시 물어봐요.' },
  { ic: '📝', tt: '변형문제', ds: '실제 기출형 변형 문제로 실전 감각 + 틀린 문제는 오답노트에 쏙.' },
  { ic: '✍️', tt: '논술 채점', ds: '채점 기준을 사진 찍으면 제가 루브릭 그대로 채점해 드려요.' },
  { ic: '📅', tt: '플래너', ds: 'D-DAY와 시기별 가이드로 오늘 뭐부터 할지 딱 정리.' },
]

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [persona, setPersona] = useState(null)
  const [examDate, setExamDate] = useState('')
  const [region, setRegion] = useState(null)

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => Math.max(0, s - 1))

  const defaultExamDate = useMemo(() => {
    const now = new Date()
    let year = now.getFullYear()
    if (now.getMonth() >= 10 && now.getDate() > 14) year += 1
    const nov = new Date(year, 10, 1)
    const firstSat = new Date(year, 10, 1 + ((6 - nov.getDay() + 7) % 7))
    return firstSat.toISOString().slice(0, 10)
  }, [])

  const finish = () => {
    onComplete({
      name: name.trim() || '선생님',
      persona: persona || '초수',
      examDate: examDate || defaultExamDate,
      region: region || '서울',
      createdAt: new Date().toISOString(),
    })
  }

  const nick = name.trim() || '선생님'

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={'dot' + (i <= step ? ' active' : '')} />
          ))}
        </div>

        {step === 0 && (
          <>
            <ObSay>
              안녕하세요! 저는 <b>이묭AI</b>의 학습 파트너 <b>이묭이</b>예요. 🐾<br />
              인강은 그대로 듣되, <b>배운 걸 완벽하게 복습</b>하도록 제가 옆에서 계속 도와드릴게요.
              제가 뭘 할 수 있는지 먼저 소개할게요!
            </ObSay>
            <div className="feat-list">
              {OB_FEATURES.map(f => (
                <div key={f.tt} className="feat-item">
                  <div className="feat-ic">{f.ic}</div>
                  <div>
                    <div className="feat-tt">{f.tt}</div>
                    <div className="feat-ds">{f.ds}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-primary" onClick={next}>
              좋아요, 시작할게요 →
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <ObSay>
              앞으로 함께할 사이인데, 제가 어떻게 불러드리면 좋을까요?
              그리고 지금 어떤 상황에서 준비하고 계신지도 살짝 알려주세요! 🙌
            </ObSay>
            <label className="field">
              <span>이름 / 닉네임</span>
              <input
                type="text"
                value={name}
                maxLength={16}
                placeholder="예) 유진, 김선생"
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
            <div className="persona-list">
              {PERSONAS.map(p => (
                <button
                  key={p.key}
                  className={'persona-card' + (persona === p.key ? ' selected' : '')}
                  onClick={() => setPersona(p.key)}
                >
                  <div className="persona-label">{p.label}</div>
                  <div className="persona-desc muted small">{p.desc}</div>
                </button>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn-secondary" onClick={back}>이전</button>
              <button className="btn-primary" disabled={!name.trim() || !persona} onClick={next}>다음</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <ObSay>
              <b>{nick}</b>님, 반가워요! 시험일을 알려주시면 제가 <b>D-DAY</b>랑
              시기별 공부 가이드를 딱 맞춰서 챙겨드릴게요. 📅
            </ObSay>
            <label className="field">
              <span>1차 시험일</span>
              <input
                type="date"
                value={examDate || defaultExamDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </label>
            <p className="muted small">기본값은 다음 11월 첫 토요일 (보통 이때 시험)</p>
            <div className="btn-row">
              <button className="btn-secondary" onClick={back}>이전</button>
              <button className="btn-primary" onClick={next}>다음</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <ObSay>
              마지막이에요! 응시 지역을 골라주세요.
              지역마다 티오·합격선이 달라서, 진척 모드에 반영할게요. 🗺️
            </ObSay>
            <div className="region-grid">
              {REGIONS.map(r => (
                <button
                  key={r}
                  className={'region-btn' + (region === r ? ' selected' : '')}
                  onClick={() => setRegion(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn-secondary" onClick={back}>이전</button>
              <button className="btn-primary" disabled={!region} onClick={finish}>
                {nick}님, 시작하기 🚀
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
