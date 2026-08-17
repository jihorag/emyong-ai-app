# 구조

폴더가 곧 담당입니다. 남의 폴더는 리뷰만 하고 직접 고치지 않습니다.

```
viewer/
├── api/                    🟢 백엔드   Vercel 서버리스 함수
│   ├── ai.js                          Anthropic 프록시 (Origin 검사·레이트리밋·모델 화이트리스트)
│   └── ping.js                        헬스체크
│
├── src/
│   ├── main.jsx            ⚪ 공용     진입점
│   │
│   ├── app/                ⚪ 공용     앱 셸 — 두 담당 승인 필요
│   │   ├── App.jsx                    5탭 해시 라우터 + 전 과목 프리로드
│   │   ├── Onboarding.jsx             온보딩 4단계
│   │   └── useStudyTimer.js           공부시간 자동 집계 훅
│   │
│   ├── screens/            🔵 프론트   탭 화면. 화면당 폴더 하나
│   │   ├── home/           HomeDashboard          예측점수·레이더·취약단원
│   │   ├── learn/          LearnHub(라우터) · UnitStages · Recall/Drill/ApplySession · AskSession
│   │   ├── review/         NoteView
│   │   ├── variant/        VariantPractice · WrongNoteList · levels
│   │   ├── essay/          EssayGrader            사진 OCR 채점
│   │   ├── planner/        StudyPlanner · ShareStudyCard
│   │   └── settings/       Settings
│   │
│   ├── components/         🔵 프론트   재사용 UI
│   │   ├── HubHeader · SubjectGrid · UnitPicker
│   │   ├── ParsedText                 ★ 모든 AI 출력이 여기를 통과 (계약 2)
│   │   ├── ExamCard · GradingCard · StreakBadge
│   │   └── viz/                       도표 렌더 6파일
│   │
│   ├── styles/             🔵 프론트   색의 단일 출처
│   │   ├── tokens.js                  인라인 스타일용 토큰
│   │   └── global.css · index.css
│   │
│   ├── data/               🟢 백엔드   데이터 모델·저장소 = 향후 DB 스키마
│   │   ├── dataModel.js               ★ 계약 1 — Unit 타입 조립
│   │   ├── subjects.js                13과목 정적 정의
│   │   └── stores/                    learningStore · drillStore · studyTime
│   │
│   ├── prompts/            🟢 백엔드   모델에 보내는 문자열 전부
│   │   └── review.js · variant.js · essay.js
│   │
│   ├── services/           🟢 백엔드   외부 호출
│   │   └── aiProviders.js · anthropicClient.js
│   │
│   └── lib/                ⚪ 공용     부수효과 없는 순수 함수만
│       └── uiHooks.js · format.js
│
├── public/data/            🟢 백엔드 + 🟡 콘텐츠
│   ├── taxonomy/{과목}.json           단원 골격
│   ├── cards/{과목}.json              빈칸 카드 · 기출/변형
│   └── study/**/*.md                  🟡 단권화 노트 — 마크다운, 코드 지식 불필요
│
└── test/                   ⚪ 공용     회귀 검증 하네스
```

## 데이터가 흐르는 길

```
public/data/taxonomy/math.json  ─┐
public/data/cards/수학.json      ─┼─→  data/dataModel.js  ─→  Unit[]  ─→  screens/
public/data/cards/all_practice   ─┘         (계약 1)

screens/  ─→  prompts/  ─→  services/  ─→  api/ai  ─→  Anthropic
                                                          │
components/ParsedText  ←────── AI 응답 (계약 2) ←─────────┘

screens/  ─→  data/stores/  ─→  localStorage
```

## 계층 규칙

- **화면은 데이터 파일을 직접 fetch하지 않습니다.** `dataModel`을 거칩니다.
- **화면은 `localStorage`를 직접 만지지 않습니다.** `data/stores/`를 거칩니다.
- **화면에 프롬프트 문자열을 쓰지 않습니다.** `prompts/`에 둡니다.
- **`lib/`은 부수효과가 없습니다.** 저장소·네트워크를 건드리면 거기가 아닙니다.
- **단원 ID를 새로 파생하지 않습니다.** `dataModel` 하나만 만듭니다 (계약 1 경고 참고).

## 기술 스택

React 19 · Vite 8 · vite-plugin-pwa · KaTeX(수식) · Mermaid(도표, 지연 로딩) · Vercel

상태 관리 라이브러리는 없습니다. `useState` + `localStorage` 저장소 모듈로 충분한 규모입니다.
계정·서버 저장이 붙으면 그때 다시 판단합니다.

## 알려진 부채

| | 어디 | 내용 |
|---|---|---|
| 팔레트 2벌 | `styles/` | CSS는 slate 계열, 인라인은 Tailwind gray 계열. `docs/DESIGN_TOKENS.md` |
| 다크모드 | `styles/global.css` | 토큰은 있는데 인라인 스타일 0건 대응 → 사실상 미작동 |
| `setState-in-effect` | 5곳 | 로딩 스피너 패턴. ESLint warn으로 낮춰 둠. 고치면 렌더 타이밍이 바뀔 수 있어 보류 |
| 레이트리밋 | `api/ai.js` | 인메모리라 서버리스에서 실효 없음. 유료화 전 KV/Redis 필요 |
| 인증 없음 | `api/ai.js` | Origin 검사만. 누구나 우리 크레딧으로 Claude 사용 가능 |
| 콘텐츠 커버리지 | `public/data/study/` | 단권화 노트가 수학 97단원뿐. 나머지 12과목 0 |
