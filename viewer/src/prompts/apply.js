
export const APPLY_GRADE_SYSTEM = [
  '당신은 초등 임용 논술형 채점위원입니다.',
  '주어진 채점요소만 사용해 판정하고, 새로운 기준을 만들지 마십시오.',
  '각 채점요소마다 O(충족) / partial(일부) / X(누락)를 판정하고,',
  '누락된 핵심 키워드를 명시하십시오.',
  '표현이 달라도 의미가 같으면 충족으로 봅니다.',
  '판정이 어려우면 needsReview를 true로 두고 임의로 결정하지 마십시오.',
  'JSON 외의 텍스트는 출력하지 마십시오.',
].join('\n');

// ⚠ 형식 지시가 이 프롬프트에서 가장 중요하다. 파싱이 깨지면 점수를 못 보여준다.
export const buildApplyGradeUser = ({ situation, question, rubric, modelAnswer, answerText }) => {
  const elements = rubric
    .map((r) => `- id: ${r.id} | 항목: ${r.label} | 배점: ${r.points} | 핵심 키워드: ${(r.keywords || []).join(', ')}`)
    .join('\n');

  return [
    '[수업 상황]', situation,
    '', '[문제]', question,
    '', '[채점요소]', elements,
    '', '[모범답안]', modelAnswer || '(없음)',
    '', '[학생 답안]', answerText || '(작성하지 않음)',
    '',
    '위 채점요소 각각을 판정해 아래 형식의 JSON만 출력하십시오.',
    '{"marks":[{"rubricId":"r1","mark":"O","missedKeywords":[]}],"needsReview":false}',
    'mark 는 "O" | "partial" | "X" 중 하나입니다.',
    'missedKeywords 에는 학생 답안에서 확인되지 않은 핵심 키워드만 넣습니다.',
  ].join('\n');
};

export function parseApplyGrade(text, rubric) {
  let obj = null;
  const raw = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { obj = JSON.parse(raw); } catch { }
  if (!obj) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { obj = JSON.parse(m[0]); } catch { } }
  }
  if (!obj || !Array.isArray(obj.marks)) return null;

  const byId = new Map(obj.marks.map((m) => [m.rubricId, m]));
  const marks = rubric.map((r) => {
    const m = byId.get(r.id);
    const mark = ['O', 'partial', 'X'].includes(m?.mark) ? m.mark : null;
    return {
      rubricId: r.id,
      mark,
      missedKeywords: Array.isArray(m?.missedKeywords) ? m.missedKeywords.filter((x) => typeof x === 'string') : [],
    };
  });

  const incomplete = marks.some((m) => m.mark === null);
  const needsReview = incomplete || obj.needsReview === true;

  const scored = rubric.reduce((n, r, i) => {
    const mk = marks[i].mark;
    if (mk === 'O') return n + r.points;
    if (mk === 'partial') return n + Math.floor(r.points / 2);
    return n;
  }, 0);

  return { marks, needsReview, scored };
}
