# 색 — 공식 팔레트와 규칙

## 규칙 하나

> **색을 새로 만들지 않는다. 공식 팔레트에서 가져다 쓴다.**
>
> 필요한 색이 없으면 → `viewer/src/styles/tokens.js` 에 **이름을 붙여 추가**한 뒤 쓴다.
> 화면 파일에 `#a1b2c3` 를 직접 적는 것은 금지다.

**ESLint가 강제합니다.** `no-restricted-syntax`가 `.jsx`/`.js` 안의 hex를 에러로 잡습니다 —
문자열 리터럴, 템플릿 문자열, JSX 속성(`fill="#..."`) 전부. 예외는 `tokens.js` 하나뿐입니다.

```
✗  <div style={{ color: '#5473b9' }}>          에러
✗  border: '1px solid #d7e3fc'                 에러
✗  <circle fill="#edf2fb" />                   에러
✓  <div style={{ color: brand.primary }}>
✓  border: `1px solid ${line.base}`
✓  <circle fill={surface.page} />
```

왜 이렇게까지 하냐면 — 한때 고유 색이 **107종**까지 늘었고 브랜드 파랑만 4종이 공존했습니다.
버튼 색 하나 바꾸려면 전수 검색이 필요했습니다.

---

**페이지 배경은 흰색입니다.** 예전엔 `aliceBlue`를 깔았는데 화면 전체가 파래서 눈이 피로하다는
피드백이 있었습니다. `surface.page` = `#ffffff` 이고, aliceBlue는 팔레트에 남아 틴트로 쓰입니다.

## 공식 팔레트

periwinkle 계열 램프 9색. **이 값들이 브랜드 정체성이고 바꾸려면 팀 합의가 필요합니다.**

| 토큰 | hex | 용도 |
|---|---|---|
| `palette.aliceBlue` | `#edf2fb` | 옅은 틴트 · 구분선 (페이지 배경 아님) |
| `palette.lavender1` | `#e2eafc` | 살짝 떠 있는 면 |
| `palette.lavender2` | `#d7e3fc` | 기본 테두리 |
| `palette.lavender3` | `#ccdbfd` | 강조 면 |
| `palette.periwinkle1` | `#c1d3fe` | 강조 테두리 |
| `palette.periwinkle2` | `#b6ccfe` | |
| `palette.babyBlueIce` | `#abc4ff` | 램프 최하단 |
| `palette.sky` | `#a3cef1` | 청록 쪽 강조 |
| `palette.mist` | `#e7ecef` | 무채색 면 |

### ⚠ 이 9색으로는 버튼도 글자도 못 만듭니다

전부 밝은 톤이라 **흰 글자를 올릴 수 있는 색이 하나도 없습니다** (최대 1.74:1, 필요 4.5:1).
본문 텍스트로도 못 씁니다. 그래서 아래를 **같은 색상(221°)에서 파생**했습니다.

| 토큰 | hex | 흰 배경 대비 | 용도 |
|---|---|---|---|
| `brand.primary` | `#5473b9` | 4.64:1 | 주 버튼 배경 (흰 글자 OK) |
| `brand.primaryDeep` | `#435f9d` | 6.25:1 | hover · 눌림 |
| `brand.primaryInk` | `#4a6dba` | 5.01:1 | 링크 · 강조 텍스트 |
| `ink.strongest` | `#2b3346` | 12.61:1 | 제목 |
| `ink.body` | `#3f495f` | 9.01:1 | 본문 |
| `ink.sub` | `#59637a` | 6.02:1 | 보조 설명 |
| `ink.muted` | `#646f85` | 5.05:1 | 라벨 |
| `ink.faint` | `#838ca1` | 3.37:1 | 가장 흐린 라벨 — **큰 글자·비필수 정보에만** |

잉크는 순수 회색이 아니라 팔레트와 **같은 색상을 낮은 채도로** 썼습니다. 화면 전체가 한 계열로 묶입니다.
대비는 흰 배경뿐 아니라 **가장 밝은 면(`#edf2fb`) 위에서도** 4.5:1을 넘도록 잡았습니다(`ink.faint` 제외).

### 의미색

색상은 관습대로 두되 **채도를 팔레트 수준으로 낮췄습니다.** 쨍한 빨강·초록을 그대로 쓰면
이 차분한 팔레트 위에서 혼자 튑니다.

| | solid (4.6:1) | tint (배경) | line (테두리) |
|---|---|---|---|
| `semantic.danger` | `#c74d3d` | `#f8f0ef` | `#ebcfcc` |
| `semantic.success` | `#328449` | `#f0f7f2` | `#cee8d6` |
| `semantic.warn` | `#9a6c27` | `#f8f4ef` | `#ecdfca` |

---

## 쓰는 법

**JS 인라인 스타일** — `tokens.js` 에서 import

```js
import { brand, ink, line, surface, semantic, gradient, shadow } from '../styles/tokens';

const card = { background: surface.card, border: `1px solid ${line.base}`, boxShadow: shadow.sm };
```

**CSS** — `global.css` 의 변수

```css
.card { background: var(--bg-card); border: 1px solid var(--border); color: var(--text-body); }
```

두 곳의 값은 **같아야 합니다.** `tokens.js` 를 고치면 `global.css` 의 `:root` 도 같이 고치세요.

**그라디언트·그림자는 직접 만들지 말고** `gradient.brand` · `shadow.md` 를 쓰세요.
화면마다 제각기 만들면 그게 다시 난잡해지는 경로입니다.

---

## 색을 추가해야 할 때

1. 정말 필요한지 먼저 의심한다 — 기존 9색 + 파생 8색으로 대부분 해결됩니다
2. `tokens.js` 에 **역할 이름**으로 추가한다 (`brand.tertiary` ○ / `blue3` ✗)
3. **대비를 계산한다.** 텍스트면 4.5:1, UI 요소면 3:1 이상
4. 이 문서의 표에 한 줄 추가한다

## 다크모드

현재 **미구현**입니다. `tokens.js` 가 단일 출처가 됐으므로, 값을 CSS 변수 참조로 바꾸고
`global.css` 에 다크 팔레트를 정의하면 한 번에 해결됩니다. 색이 흩어져 있던 예전에는 불가능했습니다.
