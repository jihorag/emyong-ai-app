
import { Suspense, useEffect } from 'react';
import { getTemplate } from './vizRegistry';
import { validate } from './validate';
import VizFrame from './VizFrame';
import { incrementVizUsage } from '../../data/stores/learningStore';
import { brand, line, surface, semantic } from '../../styles/tokens';

function ErrorBox({ name, errors, rawText }) {
  return (
    <div style={{
      margin: '8px 0', padding: '10px 12px',
      background: semantic.dangerTint, border: `1px solid ${semantic.dangerLine}`, borderRadius: 8,
      fontSize: '0.78rem', color: semantic.danger,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ 시각자료 렌더 실패: {name}</div>
      <ul style={{ margin: '4px 0 8px 16px', padding: 0 }}>
        {errors.map((e, i) => <li key={i}>{e}</li>)}
      </ul>
      {rawText && (
        <details>
          <summary style={{ cursor: 'pointer', color: semantic.danger }}>원본 JSON 보기</summary>
          <pre style={{ margin: '6px 0 0', fontSize: '0.72rem', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{rawText}</pre>
        </details>
      )}
    </div>
  );
}

function TrackedRender({ name, ok, children }) {
  useEffect(() => {
    try { incrementVizUsage(name, ok); } catch { }
  }, [name, ok]);
  return children;
}

export default function VizRouter({ name, rawJson }) {
  const tpl = getTemplate(name);
  if (!tpl) {
    return <TrackedRender name={name} ok={false}>
      <ErrorBox name={name} errors={[`등록되지 않은 템플릿: "${name}"`]} rawText={rawJson} />
    </TrackedRender>;
  }
  let params;
  try {
    params = JSON.parse(rawJson || '{}');
  } catch (e) {
    return <TrackedRender name={name} ok={false}>
      <ErrorBox name={name} errors={[`JSON 파싱 오류: ${e.message}`]} rawText={rawJson} />
    </TrackedRender>;
  }
  const v = validate(tpl.schema, params);
  if (!v.ok) {
    return <TrackedRender name={name} ok={false}>
      <ErrorBox name={name} errors={v.errors} rawText={rawJson} />
    </TrackedRender>;
  }
  const Comp = tpl.Component;
  return (
    <TrackedRender name={name} ok={true}>
      <VizFrame templateName={name}>
        <Suspense fallback={<div style={{ padding: 14, background: surface.accent, borderRadius: 8, fontSize: '0.82rem', color: brand.primaryDeep, textAlign: 'center' }}>📊 {name} 로드 중...</div>}>
          <Comp params={params} />
        </Suspense>
      </VizFrame>
    </TrackedRender>
  );
}

export function VizPending({ name }) {
  return (
    <div style={{
      margin: '8px 0', padding: '14px 16px',
      background: surface.accent, border: `1px dashed ${line.strong}`, borderRadius: 8,
      fontSize: '0.85rem', color: brand.primaryDeep, textAlign: 'center', fontWeight: 700,
    }}>
      📊 {name} 생성 중...
    </div>
  );
}
