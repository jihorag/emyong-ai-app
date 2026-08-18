# 지식그래프 관리자 (내부용)

학습자 앱(`../viewer`)과 별개다. 개념·태그·문항을 입력하고, 무결성을 검증하고,
진단을 시뮬레이션하는 내부 도구다.

## 마이그레이션 적용

```bash
supabase link --project-ref <ref>
supabase db push
```

또는 Supabase 대시보드 SQL Editor 에 `supabase/migrations/` 의 파일을
번호 순서대로 붙여넣는다.

| 파일 | 내용 |
|---|---|
| `0001_schema.sql` | 8개 테이블 · 제약 · 인덱스 · RLS |
| `0002_seed_tags.sql` | 태그 허용값 35개 (재실행 안전) |

## 접근 규칙

모든 테이블에 RLS 가 켜져 있고 **정책이 하나도 없다.** anon·authenticated 키로는
아무것도 읽거나 쓸 수 없다. 관리자 쿼리는 `service_role` 키를 쓰는 서버 라우트에서만
실행한다. 이 키는 저장소에 두지 않고 Vercel 환경변수로만 넣는다.

## 진행 상황

- [x] 1단계 스키마
- [ ] 2단계 CSV 임포트
- [ ] 3단계 검증 쿼리·대시보드
- [ ] 4단계 진단 시뮬레이터
- [ ] 5단계 검수 큐
