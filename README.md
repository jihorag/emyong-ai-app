# 이묭AI

> 초등 임용고시 1차 대비 학습 PWA. **"AI가 나에게 질문하는 복습 스터디 파트너"**

인강은 외부에서 듣고, 이 앱은 **인출(retrieval) 복습**을 담당합니다. 단권화 노트를 근거로
AI가 먼저 질문하고, 답하면 빠진 키워드를 짚고, 틀린 건 간격을 두고 다시 묻습니다.

---

## 빠르게 실행하기

```bash
cd viewer
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY 채우기 (없어도 BYOK로 동작)
npm run dev                  # http://localhost:5173
```

> `npm run dev`에는 서버리스 함수(`/api/ai`)가 뜨지 않습니다. 내장 AI를 로컬에서
> 쓰려면 설정 화면에서 개인 API 키를 넣거나, `npx vercel dev`를 사용하세요.

## 명령어

| | |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint |
| `npm run verify` | **lint + build + 회귀 검증.** PR 전에 반드시 통과시킬 것 |
| `npm run smoke` | 회귀 검증만 (빌드는 돼 있다고 가정) |
| `./deploy.sh` | 빌드 + `api/` 포함 Vercel 배포 **(배포는 반드시 이 스크립트로)** |

### `npm run verify` 가 보는 것

구조를 옮겨도 **기능이 안 바뀌었다**를 사람 눈이 아니라 스크립트가 판정합니다.
화면 렌더 14곳 · localStorage 키 · **AI 프롬프트 20,405자 바이트 대조** · 콘솔 에러 · 대시보드 반응.
실제 빌드 산출물(`vite preview`)을 Chrome으로 구동하며, AI는 목킹이라 비용이 들지 않습니다.
자세한 건 [viewer/test/README.md](viewer/test/README.md).

---

## 폴더 구조

```
임고닷컴 2/
├── viewer/                 ◀ 실제 제품 (React 19 + Vite + PWA)
│   ├── api/                🟢 백엔드   Vercel 서버리스 함수
│   ├── src/
│   │   ├── app/            ⚪ 공용     라우터 · 온보딩 · 공부시간 훅
│   │   ├── screens/        🔵 프론트   탭 화면 6개
│   │   ├── components/     🔵 프론트   재사용 UI (+ viz/ 도표)
│   │   ├── styles/         🔵 프론트   tokens.js · global.css
│   │   ├── data/           🟢 백엔드   dataModel · subjects · stores/
│   │   ├── prompts/        🟢 백엔드   AI 프롬프트 전부
│   │   ├── services/       🟢 백엔드   AI 클라이언트
│   │   └── lib/            ⚪ 공용     순수 유틸
│   ├── public/data/        🟢🟡        학습 콘텐츠 (study/*.md 는 콘텐츠 담당)
│   └── test/               ⚪ 공용     회귀 검증 하네스
│
│   └── scripts/            🟢 백엔드   개념 활용 문항 빌더·생성기
│
├── docs/              구조 · 계약 · 색 토큰 문서
└── app_map.md         앱 전체 지도
```

### 원본 자료는 저장소 밖에 있습니다

교재·기출 PDF 원본은 저장소와 나란한 `Documents/임고닷컴-원본자료/` 에 둡니다.
앱이 읽는 형태(`viewer/public/data/`)로 이미 변환돼 있어, 원본 없이도 실행·개발할 수 있습니다.

원본을 다시 변환해야 한다면 파이썬 파이프라인을 git 히스토리에서 꺼내 쓰세요 —
산출물이 이미 저장소에 있어 상시로 둘 이유가 없어 정리했습니다.

```
git show 62c0334^:scripts/paths.py     # 예: 경로 설정
git checkout 62c0334^ -- scripts/      # 통째로 복구
```

---

## 담당 영역

폴더가 곧 소유권입니다. 남의 폴더는 리뷰만 하고 직접 수정하지 않습니다.

| 영역 | 담당 | 경로 |
|---|---|---|
| 화면·UI | 프론트엔드 | `viewer/src/screens` · `components` · `styles` |
| 서버·AI | 백엔드 | `viewer/api` · `src/services` · `src/prompts` |
| 데이터 | 백엔드 | `viewer/src/data` · `viewer/public/data` |
| 학습 노트 | 콘텐츠 | `viewer/public/data/study/**/*.md` (마크다운) |
| 앱 셸·유틸 | 공용 | `viewer/src/app` · `src/lib` — **두 명 승인 필요** |

`.github/CODEOWNERS`가 이 규칙을 강제합니다 — 남의 영역을 건드린 PR엔 해당 담당이 자동으로 리뷰어로 붙습니다.
(저장소 Settings → Branches에서 "Require review from Code Owners"를 켜야 동작합니다.
CODEOWNERS의 `@frontend`·`@backend`·`@content` 자리표시자도 실제 GitHub 아이디로 바꿔야 합니다.)

### 두 담당이 만나는 지점은 딱 둘

**[docs/CONTRACTS.md](docs/CONTRACTS.md)** — ① `dataModel`이 내보내는 **Unit 타입**
② **AI 응답 포맷**(` ```exam ` 펜스 · `〔근거: …〕` · `Q :: A`).
이 둘만 고정하면 나머지는 서로의 폴더를 안 봐도 됩니다. 바꾸려면 양쪽 승인이 필요합니다.

## 문서

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 폴더 구조 · 계층 규칙 · 데이터 흐름 · 알려진 부채 |
| [docs/CONTRACTS.md](docs/CONTRACTS.md) | **두 담당의 계약** — Unit 타입 · AI 응답 포맷 |
| [docs/COMMENTS.md](docs/COMMENTS.md) | **주석을 쓰지 않는다** — 예외는 ⚠ 경고와 eslint 지시어 |
| [docs/DESIGN_TOKENS.md](docs/DESIGN_TOKENS.md) | 색 토큰 · 팔레트가 두 벌인 문제 |
| [viewer/test/README.md](viewer/test/README.md) | 회귀 검증 하네스 |

---

## 지금 상태

- **동작**: 온보딩 · 홈 실력분석 · AI 복습 채팅 · 스제트(간격반복 암기) · 변형문제 · 오답노트 · 논술채점 · 플래너 · PWA
- **콘텐츠**: 단권화 노트는 **수학 97단원만**. 나머지 12과목은 taxonomy 골격과 cloze 카드만 있음
- **미구현**: 계정 · 서버 저장 · 결제 · 푸시 (현재 모든 데이터가 브라우저 localStorage)

### 유료화 전에 반드시 해결해야 할 것

1. **`/api/ai` 인증** — 지금은 Origin 검사만이라 누구나 우리 크레딧으로 Claude를 씁니다
2. **레이트리밋** — 인메모리라 서버리스에서 실효가 없습니다 (KV/Redis 필요)
3. **계정·서버 저장** — 기기를 바꾸면 학습 기록이 전부 사라집니다
4. **콘텐츠 저작권** — 단권화 노트가 상업 교재 OCR입니다. [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md) 참고
