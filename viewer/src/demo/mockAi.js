const DELAY = [700, 1500];

const clean = (s) => String(s || '')
  .replace(/\*\*(.+?)\*\*/g, '$1').replace(/==(.+?)==/g, '$1').replace(/[`*_]/g, '').trim();

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

function classify(system) {
  if (/통암기 채점관/.test(system)) return 'drill.grade';
  if (/한 줄 암기 카드/.test(system)) return 'drill.generate';
  if (/교직논술.*채점관|채점 기준.*OCR/s.test(system)) return 'essay.grade';
  if (/서답형 출제자/.test(system)) return 'variant.generate';
  if (/논술형 채점위원/.test(system)) return 'apply.grade';
  if (/공부를 돕는 조교/.test(system)) return 'ask';
  return 'unknown';
}

function noteOf(userText) {
  const m = String(userText || '').match(/\[단권화 노트\]\n([\s\S]*?)(?:\n\n\[질문\]|$)/);
  return m ? m[1] : '';
}

function termsOf(note) {
  return [...String(note).matchAll(/\*\*(.+?)\*\*/g)]
    .map((x) => clean(x[1]).replace(/\s*\([^)]*\)\s*/g, '').replace(/[:：].*$/, '').trim())
    .filter((x) => x.length >= 2 && x.length <= 16)
    .filter((x, i, a) => a.indexOf(x) === i);
}

function sentencesOf(note) {
  return String(note).split(/\n+/)
    .map((l) => clean(l).replace(/^[-*#>\s]+/, '').trim())
    .filter((l) => l.length >= 18 && l.length <= 240 && !/^\|/.test(l));
}

function makeCards(note) {
  const out = [];
  String(note).split('\n').forEach((raw) => {
    const l = raw.trim();
    const m = l.match(/^[-*]\s*\*\*(.+?)\*\*\s*[—\-:：]\s*(.+)$/)
           || l.match(/^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/);
    if (!m) return;
    const term = clean(m[1]).replace(/\s*\([^)]*\)\s*/g, '').trim();
    const desc = clean(m[2]).split(/(?<=[.。])\s/)[0].slice(0, 90).trim();
    if (term.length >= 2 && term.length <= 20 && desc.length >= 10) out.push(`${desc} — 이것은? :: ${term}`);
  });
  if (out.length < 8) {
    termsOf(note).slice(0, 12).forEach((t) => {
      const hit = sentencesOf(note).find((s) => s.includes(t) && s.length > 24);
      if (hit) out.push(`${hit.split(t).join(' ____ ').slice(0, 110)} :: ${t}`);
    });
  }
  return out.slice(0, 24).join('\n');
}

function askAnswer(userText) {
  const note = noteOf(userText);
  const q = (String(userText).match(/\[질문\]\s*([\s\S]*)$/) || [])[1] || '';
  const terms = termsOf(note);
  const sents = sentencesOf(note);

  if (/수업|예시|활동|차시|지도/.test(q) && terms.length) {
    const [a, b] = terms;
    return `초등 수업에서는 **${a}**을(를) 먼저 구체물로 다루고, 그다음 그림이나 표로 옮겨 적게 하는 순서가 좋아요. `
      + `예를 들어 3학년 도입 차시라면 모둠별로 교구를 직접 조작하게 한 뒤, 같은 상황을 학습지에 그림으로 나타내게 합니다.`
      + (b ? ` 정리 단계에서 **${b}**과(와) 어떻게 연결되는지 학생 말로 설명하게 하면 인출까지 이어집니다.` : '');
  }

  const words = [...new Set(String(q).replace(/[?!.,]/g, '').split(/\s+/).filter((w) => w.length >= 2))];
  const scored = sents
    .map((s) => ({ s, n: words.filter((w) => s.includes(w)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map((x) => x.s);

  if (!scored.length) {
    return sents.length
      ? `노트에는 그 내용이 직접 나와 있지 않아요. 대신 이 단원은 ${terms.slice(0, 3).join(', ') || '핵심 개념'}을(를) 중심으로 정리돼 있어요. `
        + `${sents[0]}`
      : '노트에는 그 내용이 없어요. 질문을 조금 더 좁혀서 물어봐 주세요.';
  }
  return scored.join(' ');
}

function drillGrade(userText) {
  const answer = (String(userText).match(/\[정답\]\s*(.+)/) || [])[1]?.trim() || '';
  const mine = (String(userText).match(/\[학생답\]\s*([\s\S]*)$/) || [])[1]?.trim() || '';
  const a = norm(answer);
  const m = norm(mine);
  const ok = !!m && (m.includes(a) || a.includes(m)
    || [...a].filter((ch) => m.includes(ch)).length >= Math.ceil(a.length * 0.6));
  return ok
    ? `O 정답! ${answer}`
    : `X 정답: ${answer} — 핵심어를 떠올려 다시 한 번 말해보세요.`;
}

function applyGrade(userText) {
  const mine = (String(userText).match(/\[학생 답안\]\n([\s\S]*?)\n\n위 채점요소/) || [])[1] || '';
  const m = norm(mine);
  const rows = [...String(userText).matchAll(/^- id:\s*(\S+)\s*\|\s*항목:.*?\|\s*배점:.*?\|\s*핵심 키워드:\s*(.*)$/gm)];
  const marks = rows.map(([, id, kw]) => {
    const keys = kw.split(',').map((k) => k.trim()).filter(Boolean);
    const missed = keys.filter((k) => !m.includes(norm(k)));
    const mark = !keys.length || !missed.length ? 'O' : (missed.length < keys.length ? 'partial' : 'X');
    return { rubricId: id, mark, missedKeywords: missed };
  });
  return JSON.stringify({ marks, needsReview: !mine.trim() });
}

function variant(userText) {
  const unit = (String(userText).match(/\[단원\]\s*(.+)/) || [])[1]?.split('›').pop()?.trim() || '이 단원';
  return [
    '```exam', '[5점]',
    `다음은 ${unit} 지도에 대한 두 교사의 대화이다. 밑줄 친 __㉠__의 문제점과 개선 방안을 각각 서술하시오.`,
    '', '〈자료〉',
    '김 교사: "저는 개념을 먼저 정의로 알려주고 문제를 풀게 해요. __㉠ 아이들이 빨리 익히거든요.__"',
    '박 교사: "그런데 그렇게 하면 아이들이 왜 그런지는 설명하지 못하더라고요."',
    '```',
    '---루브릭---', '## 📊 채점 루브릭',
    '| 채점 항목 | 배점 | 정답 요소 | 부분점수 |', '|---|---|---|---|',
    '| 1) ㉠의 문제점 | 3점 | 절차적 이해에 머묾 · 관계적 이해 부재 | 둘 다 3점 / 하나 1점 |',
    '| 2) 개선 방안 | 2점 | 구체물 조작 후 형식화 | 포함 시 2점 |',
    '', '**총점: 5점**',
    '## ✅ 모범답안',
    `㉠은 학생이 규칙을 왜 그렇게 쓰는지 설명하지 못하는 도구적 이해에 머무르게 합니다. ${unit}에서는 구체물 조작으로 의미를 만든 뒤 형식으로 옮기는 순서가 필요합니다.`,
  ].join('\n');
}

const ESSAY = [
  '## 📋 채점 기준 (읽어낸 것)',
  '1) 문제 상황 진단 (5점) · 2) 이론 적용의 적절성 (8점) · 3) 실천 방안의 구체성 (5점) · 4) 논리 구성 (2점)',
  '',
  '## ✅ 채점 결과',
  '- 문제 상황 진단: 4 / 5 — 원인을 두 가지로 나눠 짚은 점이 좋습니다.',
  '- 이론 적용: 6 / 8 — 이론 이름은 맞지만 사례와의 연결이 한 문장에 그칩니다.',
  '- 실천 방안: 4 / 5 — 학년·차시가 드러나 구체적입니다.',
  '- 논리 구성: 2 / 2',
  '',
  '**총점: 16 / 20점**',
  '',
  '## ✍️ 한 줄 조언',
  '이론을 소개한 뒤 "그래서 이 학생에게는 …" 으로 잇는 문장을 한 번 더 넣으면 배점이 올라갑니다.',
].join('\n');

function reply(system, userText) {
  switch (classify(system)) {
    case 'drill.generate': return makeCards(noteOf(userText) || userText);
    case 'drill.grade': return drillGrade(userText);
    case 'apply.grade': return applyGrade(userText);
    case 'variant.generate': return variant(userText);
    case 'essay.grade': return ESSAY;
    case 'ask': return askAnswer(userText);
    default: return '데모 모드입니다. 이 응답은 기기 안에서 만들어졌어요.';
  }
}

export function installMockAi() {
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (!/\/api\/ai$|api\.anthropic\.com|api\.openai\.com|generativelanguage/.test(url)) {
      return real(input, init);
    }
    let body = {};
    try { body = JSON.parse((init?.body) || (typeof input === 'object' ? '' : '') || '{}'); } catch { }

    const system = typeof body.system === 'string'
      ? body.system
      : (body.system || []).map((b) => (typeof b === 'string' ? b : b.text || '')).join('');
    const userText = (body.messages || [])
      .map((m) => (typeof m.content === 'string'
        ? m.content
        : (m.content || []).map((c) => c.text || '').join('')))
      .join('\n');

    const wait = DELAY[0] + Math.floor(Math.random() * (DELAY[1] - DELAY[0]));
    await new Promise((r) => setTimeout(r, wait));

    const text = reply(system, userText);
    return new Response(JSON.stringify({
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 800, output_tokens: 240 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
