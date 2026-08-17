// /api/ai 목킹 — 검증용.
//
// 왜 목킹하나:
//  1. `vite preview`에는 서버리스 함수가 없다. 실제 /api/ai는 배포 환경에만 있다.
//  2. 검증을 돌릴 때마다 실제 API 비용이 나가면 안 된다.
//  3. 무엇보다 — AI 응답이 매번 달라지면 회귀 검증이 성립하지 않는다.
//
// 부수 효과가 본체다: 이 목이 요청 본문의 `system`을 전부 기록한다.
// 그 기록이 "프롬프트가 안 바뀌었다"를 증명하는 스냅샷이 된다.

export const DRILL_CARDS = [
  ['베르트하이머가 강조한, 문제 상황을 새로운 전체로 재구성하는 능력은?', '통찰'],
  ['게슈탈트 심리학에서 "부분의 합보다 큰 것"은?', '전체'],
  ['브루너의 표상 3단계를 순서대로', '행동적 → 영상적 → 상징적'],
  ['스켐프가 구분한 두 가지 이해는?', '관계적 이해 / 도구적 이해'],
  ['디에네스의 수학적 변이성 원리란?', '개념의 본질은 두고 비본질적 속성을 변화시키는 것'],
  ['프로이덴탈의 수학화 두 종류는?', '수평적 수학화 / 수직적 수학화'],
];

// 요청의 system 프롬프트를 보고 어떤 종류인지 분류한다.
// 프롬프트를 src/prompts/로 옮겨도 이 분류는 그대로여야 한다(내용이 안 바뀌므로).
export function classify(system, userText) {
  if (/통암기 채점관/.test(system)) return 'drill.grade';
  if (/한 줄 암기 카드/.test(system)) {
    return /단권화 노트/.test(system) ? 'drill.generate.note' : 'drill.generate.general';
  }
  if (/교직논술.*채점관|채점 기준.*OCR/s.test(system)) return 'essay.grade';
  if (/서답형 출제자/.test(system)) return 'variant.generate';
  if (/논술형 채점위원/.test(system)) return 'apply.grade';
  if (/공부를 돕는 조교/.test(system)) {
    // ⚠ ASK_SYSTEM_GENERAL 본문에도 "단권화 노트가 없다"가 들어 있다. 대괄호로 구분한다.
    return /\[단권화 노트\]/.test(system) ? 'ask.note' : 'ask.general';
  }
  return 'unknown';
}

/**
 * page에 /api/ai 목을 설치하고, 기록 저장소를 반환한다.
 * @returns {{ calls: Array<{kind:string, system:string, model:string, maxTokens:number}> }}
 */
export async function installAiMock(page) {
  const calls = [];

  await page.route('**/api/ai', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const system = typeof body.system === 'string'
      ? body.system
      : (body.system || []).map((b) => (typeof b === 'string' ? b : b.text || '')).join('');
    const userText = (body.messages || [])
      .map((m) => (typeof m.content === 'string'
        ? m.content
        : (m.content || []).map((c) => c.text || '').join('')))
      .join('\n');

    const kind = classify(system, userText);
    calls.push({ kind, system, user: userText, model: body.model, maxTokens: body.max_tokens });

    let text;
    switch (kind) {
      case 'drill.generate.note':
      case 'drill.generate.general':
        text = DRILL_CARDS.map(([q, a]) => `${q} :: ${a}`).join('\n');
        break;
      case 'drill.grade': {
        // 요청에 담긴 [정답]을 되돌려 준다 — 질문과 어긋나지 않게
        const ans = (userText.match(/\[정답\]\s*(.+)/) || [])[1]?.trim() || '';
        text = `O 정답! ${ans}`;
        break;
      }
      case 'variant.generate':
        text = [
          '```exam', '[5점]',
          '다음은 신규 교사가 작성한 수업 계획에 대한 대화이다. 밑줄 친 __㉠__에 대해 서술하시오.',
          '', '〈자료〉', '신규 교사: "…"', '지도 교사: "…"', '```',
          '---루브릭---', '## 📊 채점 루브릭',
          '| 채점 항목 | 배점 | 정답 요소 | 부분점수 |', '|---|---|---|---|',
          '| 1) 문제점 서술 | 3점 | 키워드A · 키워드B | 둘 다 3점 / 하나 1점 |',
          '| 2) 지도 방법 | 2점 | 키워드C | 포함 시 2점 |',
          '', '**총점: 5점**', '## ✅ 모범답안', '검증용 모범답안입니다.',
        ].join('\n');
        break;
      case 'apply.grade': {
        // 요청에 담긴 채점요소 id 를 그대로 판정해 돌려준다 — 문항이 바뀌어도 맞물린다.
        const ids = [...userText.matchAll(/^- id:\s*(\S+)/gm)].map((m) => m[1]);
        const marks = ids.map((id, i) => ({
          rubricId: id,
          mark: i === 0 ? 'O' : i === 1 ? 'partial' : 'X',
          missedKeywords: i === 0 ? [] : ['검증용 키워드'],
        }));
        text = JSON.stringify({ marks, needsReview: false });
        break;
      }
      case 'ask.note':
      case 'ask.general':
        text = '영상적 표현은 그림·이미지로 개념을 나타내는 방식이에요. 예를 들어 분수 3/4을 피자 그림으로 나타내는 것이 영상적 표현입니다.';
        break;
      case 'essay.grade':
        text = '## 📋 채점 기준 (읽어낸 것)\n검증용 응답입니다.\n\n## ✅ 채점 결과\n**총점: 18 / 20점**';
        break;
      default:
        text = '검증용 응답입니다.\n\n첫 질문입니다. 설명해 보세요.\n\n〔근거: 단원 개관〕';
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
  });

  return { calls };
}
