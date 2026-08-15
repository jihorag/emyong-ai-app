// ⚠️ 감정평가사 fork의 경제·회계·법·감정평가 템플릿(18종)은 제거됨 — 임용과 무관.

const _registry = new Map();

// eslint-disable-next-line no-unused-vars -- 임용 템플릿 추가용 확장점(아래 등록 위치 참고)
function register(t) {
  if (_registry.has(t.name)) {
    console.warn(`[viz] duplicate template: ${t.name}`);
  }
  _registry.set(t.name, t);
}

export function getTemplate(name) {
  return _registry.get(name);
}

export function listTemplates() {
  return Array.from(_registry.values());
}

export function buildCatalog(subjects) {
  const subjectList = !subjects ? null
    : (Array.isArray(subjects) ? subjects : [subjects]);
  const list = listTemplates().filter((t) =>
    !subjectList || (t.subjects || []).some((s) => subjectList.includes(s))
  );
  if (!list.length) return '';
  const header = `## [VIZ_CATALOG] 시각자료 사용 규칙 (자동 생성, registry 기반)

그래프·도식·관계도가 필요하면 **반드시 아래 템플릿 중 하나 선택**.
카탈로그에 없으면 \`\`\`mermaid 또는 텍스트/표로.

`;
  const body = list.map((t) => {
    const example = JSON.stringify(t.exampleParams, null, 2);
    return `### ${t.name} — ${t.helpText}
\`\`\`viz ${t.name}
${example}
\`\`\``;
  }).join('\n\n');
  return header + body;
}

export function templateCount() {
  return _registry.size;
}
