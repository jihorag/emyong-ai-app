# 이묭AI

> 초등 임용고시 1차 대비 학습 PWA. **"AI가 나에게 질문하는 복습 스터디 파트너"**

인강은 외부에서 듣고, 이 앱은 **인출(retrieval) 복습**을 담당합니다.
검수된 지식을 근거로 AI가 먼저 질문하고, 답하면 빠진 키워드를 짚고, 틀린 건 간격을 두고 다시 묻습니다.

---

## 핵심 원칙

**AI는 문항을 만들지 않고 고릅니다.**
상황·채점요소·모범답안은 사람이 검수해 `viewer/public/data/applications/` 에 미리 들어 있습니다.
AI가 하는 일은 학생 답을 그 채점요소에 대조하는 것뿐입니다. 실시간 생성은 검수를 못 거칩니다.

판정이 애매하면 **점수를 숨기고 "검토 필요"로 둡니다.** 추측한 점수를 보여주지 않습니다.

---

## 빠르게 실행하기

```bash
cd viewer
npm install
npm run dev                  # http://localhost:5173
```

`npm run dev` 에는 서버리스 함수(`/api/ai`)가 없습니다. 로컬에서 AI를 쓰려면 둘 중 하나:

- 앱의 **⚙️ 설정**에서 본인 Anthropic 키를 넣는다 (그 기기에만 저장됨)
- `npx vercel dev` 로 서버리스까지 함께 띄운다

> `viewer/.env.example` 은 **서버 전용**입니다. 사용자 개인 키는 여기 두지 않습니다.

## 명령어

| | |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint |
| `npm run verify` | **lint + build + 회귀 검증.** PR 전에 반드시 통과시킬 것 |
| `npm run smoke` | 회귀 검증만 (빌드는 돼 있다고 가정) |
| `npm run baseline` | 회귀 기준선 갱신 (**의도한 변경일 때만**) |
| `./deploy.sh` | 빌드 + `api/` 포함 Vercel 배포 (`viewer/` 에서 실행) |

### `npm run verify` 가 보는 것

구조를 옮겨도 **기능이 안 바뀌었다**를 사람 눈이 아니라 스크립트가 판정합니다.

```
화면 25개 렌더 · localStorage 키 8개 · AI 프롬프트 6종 바이트 대조
· 콘솔 에러 0 · 대시보드 수치 반응
```

실제 빌드 산출물(`vite preview`)을 Chrome으로 구동하고 AI는 목킹이라 비용이 들지 않습니다.
프롬프트가 한 글자만 달라져도 실패합니다. 자세한 건 [viewer/test/README.md](viewer/test/README.md).

---

## 화면

하단 5탭입니다.

| 탭 | 하는 일 |
|---|---|
| **홈** | D-day · 정착도 · 오늘 공부 시간 · 오늘의 복습 · 바로가기 |
| **전체 학습** | 13과목 → 단원 → 학습 방식 6가지. 논술 채점도 여기 |
| **AI 추천** | 기기에 쌓인 기록으로 오늘 볼 단원 3개를 고름 (AI 호출 없음) |
| **복습** | 오답노트 · 곧 다시 나올 카드 · 아직 안 외워진 것 |
| **학습 통계** | 오늘 공부 시간 · 학습 진척 현황(다각형) · 약점 단원 · 일별 공부량 캘린더 · D-day |

단원에 들어가면 학습 방식을 고릅니다 — **개념 읽기 · 기억 확인 · 개념 활용 · 스제트 연습 · 문제 풀기 · 궁금한 것 묻기**.

---

## 데모 모드

시연용입니다. **⚙️ 설정 › 데모 모드** 를 켜면 26일치 학습 기록이 채워지고,
AI 응답을 서버·API 키 없이 기기 안에서 만듭니다. 주소에 `?demo=1` 을 붙이면 켜진 채로 열립니다(`?demo=0` 이면 꺼짐).

켤 때 실제 학습 기록을 통째로 백업해 두고, 끄면 그대로 되돌립니다.
**끈 뒤 한 바이트라도 달라지면 `npm run verify` 가 막습니다**(`demo.restored`).

카드·채점은 지어내지 않습니다 — 스제트 카드는 단권화 노트와 cloze 카드에서 뽑고,
드릴 채점은 정답과 학생답을 대조하고, 개념 활용 채점은 문항의 채점요소 키워드로 판정합니다.
`궁금한 것 묻기` 는 노트에서 질문과 겹치는 문장을 고릅니다. 화면 좌하단 `● 데모` 배지로
기록을 다시 채우거나, 빈 상태로 보거나, 데모를 끌 수 있습니다.

> 시연 데이터가 실제 기록으로 오해되면 안 됩니다. 배지를 지우지 마세요.

---

## 폴더 구조

```
├── viewer/                 ◀ 실제 제품 (React 19 + Vite + PWA)
│   ├── api/                🟢 백엔드   Vercel 서버리스 함수 (/api/ai 프록시)
│   ├── src/
│   │   ├── app/            ⚪ 공용     라우터 · 온보딩 · 공부시간 훅
│   │   ├── screens/        🔵 프론트   탭 화면
│   │   ├── components/     🔵 프론트   재사용 UI (+ viz/ 도표)
│   │   ├── styles/         🔵 프론트   tokens.js · fonts.js · global.css
│   │   ├── data/           🟢 백엔드   dataModel · applications · recommend · stores/
│   │   ├── prompts/        🟢 백엔드   AI 프롬프트 전부
│   │   ├── services/       🟢 백엔드   AI 클라이언트
│   │   ├── lib/            ⚪ 공용     순수 유틸
│   │   └── demo/           ⚪ 공용     데모 모드 (시드·AI 목·배지)
│   ├── public/data/        🟢🟡        학습 콘텐츠
│   ├── scripts/            🟢 백엔드   개념 활용 문항 빌더·생성기
│   └── test/               ⚪ 공용     회귀 검증 하네스
│
├── docs/                   구조 · 계약 · 주석 · 색 토큰
└── app_map.md              앱 전체 지도
```

### 앱이 읽는 데이터

| 경로 | 내용 |
|---|---|
| `public/data/taxonomy/` | 13과목 단원 골격 |
| `public/data/study/` | 단권화 노트 (**수학 97단원만**) |
| `public/data/cards/` | cloze 빈칸 카드 · 기출/변형 문항 |
| `public/data/applications/` | 개념 활용 문항 (수학교육론 9단원 + 교과 역량, 100문항) |

교재·기출 PDF **원본은 저장소 밖** `Documents/임고닷컴-원본자료/` 에 있습니다.
앱이 읽는 형태로 이미 변환돼 있어 원본 없이도 실행·개발할 수 있습니다.

> 원본을 다시 변환하던 파이썬 파이프라인은 이 저장소에 없습니다.
> 산출물이 이미 있어 상시로 둘 이유가 없었고, 스크랩 자료와 교재 OCR 스크립트를
> 히스토리에 남기지 않으려고 [jihorag/emyong-ai](https://github.com/jihorag/emyong-ai) 에 두고 왔습니다.

---

## 지켜야 하는 규칙

세 가지는 **ESLint가 강제**합니다. 어기면 `npm run verify` 가 막힙니다.

| 규칙 | 왜 |
|---|---|
| **주석을 쓰지 않는다** | 코드와 함께 낡는다. 예외는 `⚠` 경고와 eslint 지시어 → [docs/COMMENTS.md](docs/COMMENTS.md) |
| **색은 `tokens.js` 에서만** | 한때 고유 색이 107종까지 늘었다 → [docs/DESIGN_TOKENS.md](docs/DESIGN_TOKENS.md) |
| **API 키는 설정 화면 한 곳에서만** | 화면마다 입력창을 두면 어디에 넣었는지 잊는다 |

---

## 담당 영역

폴더가 곧 소유권입니다. 남의 폴더는 리뷰만 하고 직접 수정하지 않습니다.

| 영역 | 담당 | 경로 |
|---|---|---|
| 화면·UI | 프론트엔드 | `viewer/src/screens` · `components` · `styles` |
| 서버·AI | 백엔드 | `viewer/api` · `src/services` · `src/prompts` |
| 데이터 | 백엔드 | `viewer/src/data` · `viewer/public/data` |
| 학습 노트·문항 | 콘텐츠 | `public/data/study/**/*.md` · `viewer/scripts/apply-seed/` |
| 앱 셸·유틸 | 공용 | `viewer/src/app` · `src/lib` — **두 명 승인 필요** |

`.github/CODEOWNERS` 가 이 규칙을 강제합니다 — 남의 영역을 건드린 PR엔 해당 담당이 자동으로 리뷰어로 붙습니다.
(Settings → Branches 에서 "Require review from Code Owners" 를 켜야 동작하고,
CODEOWNERS 의 `@frontend`·`@backend`·`@content` 자리표시자를 실제 GitHub 아이디로 바꿔야 합니다.)

### 두 담당이 만나는 지점은 딱 둘

**[docs/CONTRACTS.md](docs/CONTRACTS.md)** — ① `dataModel` 이 내보내는 **Unit 타입**
② **AI 응답 포맷**(` ```exam ` 펜스 · `〔근거: …〕` · `Q :: A` · 채점 JSON).
이 둘만 고정하면 나머지는 서로의 폴더를 안 봐도 됩니다. 바꾸려면 양쪽 승인이 필요합니다.

## 문서

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 폴더 구조 · 계층 규칙 · 데이터 흐름 · 알려진 부채 |
| [docs/CONTRACTS.md](docs/CONTRACTS.md) | **두 담당의 계약** — Unit 타입 · AI 응답 포맷 |
| [docs/COMMENTS.md](docs/COMMENTS.md) | **주석을 쓰지 않는다** |
| [docs/DESIGN_TOKENS.md](docs/DESIGN_TOKENS.md) | 공식 팔레트 9색 · 파생 규칙 |
| [viewer/test/README.md](viewer/test/README.md) | 회귀 검증 하네스 |

---

## 지금 상태

**동작** — 온보딩 · 홈 대시보드 · 전 과목 단원 탐색 · 기억 확인(간격 반복) ·
개념 활용(검수 문항 + 루브릭 채점) · 변형문제 · 오답노트 · 논술 채점 · AI 추천 · 학습 통계 · PWA

**콘텐츠**

| | |
|---|---|
| 단권화 노트 | 수학 97단원만. 나머지 12과목은 골격과 cloze 카드만 |
| 개념 활용 문항 | 100문항 — **전부 `검수 전 초안`** 입니다. 임용 콘텐츠 검토자가 확인해야 합니다 |

**미구현** — 계정 · 서버 저장 · 결제 · 푸시. 지금 모든 데이터가 브라우저 localStorage 에 있습니다.

### 실증 전에 반드시 해결해야 할 것

1. **레이트리밋이 실효가 없습니다** — 서버리스 인메모리라 콜드스타트마다 리셋됩니다. KV/Redis 필요
2. **`/api/ai` 에 인증이 없습니다** — Origin 검사뿐이라 URL만 알면 우리 크레딧으로 호출됩니다
3. **계정·서버 저장** — 기기를 바꾸면 학습 기록이 사라지고, 대학에 낼 집계 지표도 만들 수 없습니다
4. **콘텐츠 저작권** — 단권화 노트가 상업 교재에서 왔습니다. 화면에서 교재명·출처 표기는 걷어냈지만 **본문은 그대로**입니다. 지식명제로 다시 써야 해결됩니다
5. **문항 검수** — 개념 활용 100문항이 아직 초안입니다
