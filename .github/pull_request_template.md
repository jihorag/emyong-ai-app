## 무엇을 바꿨나

<!-- 한두 줄로 -->

## 어느 영역인가

- [ ] 🔵 화면 (`screens/` · `components/` · `styles/`)
- [ ] 🟢 서버·AI (`api/` · `prompts/` · `services/`)
- [ ] 🟢 데이터 (`data/` · `public/data/`)
- [ ] 🟡 콘텐츠 (`public/data/study/**/*.md`)
- [ ] ⚪ 공용 (`app/` · `lib/` · `test/`) — **두 담당 승인 필요**

## 체크

- [ ] `npm run verify` 통과
- [ ] 남의 영역을 건드렸다면 해당 담당의 리뷰를 받았다

## 계약을 바꿨다면

<!-- docs/CONTRACTS.md 의 Unit 타입이나 AI 응답 포맷을 바꿨을 때만 -->

- [ ] `docs/CONTRACTS.md` 갱신
- [ ] `test/baseline/` 갱신 — **무엇이 왜 바뀌었는지 아래에 설명**

<!--
기준선을 갱신했다면 여기에:
  · 어떤 스냅샷이 바뀌었나 (프롬프트? 저장 키? 화면?)
  · 왜 바꿨나
  · AI 응답 품질에 어떤 영향이 예상되나
구조 이동만 하는 PR이라면 기준선은 절대 바뀌면 안 됩니다.
-->
