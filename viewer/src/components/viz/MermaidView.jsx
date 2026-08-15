
import { useEffect, useRef, useState } from 'react';
import { brand, line, surface, semantic } from '../../styles/tokens';

let _mermaidPromise = null;
let _idCounter = 0;

function loadMermaid() {
  if (!_mermaidPromise) {
    _mermaidPromise = import('mermaid').then((mod) => {
      const m = mod.default || mod;
      m.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'strict',
        fontFamily: 'Pretendard Variable, -apple-system, sans-serif',
        flowchart: { useMaxWidth: true, htmlLabels: false, curve: 'basis' },
        sequence: { useMaxWidth: true, mirrorActors: false },
      });
      return m;
    }).catch((e) => {
      console.error(e);
      throw new Error('mermaid 패키지 미설치 — viewer 디렉터리에서 `npm install` 실행 후 새로고침해주세요.');
    });
  }
  return _mermaidPromise;
}

export default function MermaidView({ raw }) {
  const ref = useRef(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadMermaid().then(async (mermaid) => {
      try {
        const id = `mermaid-${++_idCounter}`;
        const { svg } = await mermaid.render(id, String(raw || '').trim());
        if (!cancelled) {
          setSvg(svg);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || String(e));
          setLoading(false);
        }
      }
    }).catch((e) => {
      if (!cancelled) {
        setError('Mermaid 로딩 실패: ' + (e.message || e));
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [raw]);

  if (loading) {
    return (
      <div style={{
        margin: '8px 0', padding: '14px 16px',
        background: surface.page, border: `1px dashed ${surface.accent}`, borderRadius: 8,
        fontSize: '0.85rem', color: brand.primaryInk, textAlign: 'center', fontWeight: 600,
      }}>
        🔄 Mermaid 다이어그램 로드 중...
      </div>
    );
  }
  if (error) {
    return (
      <div style={{
        margin: '8px 0', padding: '10px 12px',
        background: semantic.dangerTint, border: `1px solid ${semantic.dangerLine}`, borderRadius: 8,
        fontSize: '0.78rem', color: semantic.danger,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Mermaid 렌더 실패</div>
        <div style={{ marginBottom: 6 }}>{error}</div>
        <details>
          <summary style={{ cursor: 'pointer', color: semantic.danger }}>원본 보기</summary>
          <pre style={{ margin: '6px 0 0', fontSize: '0.72rem', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{raw}</pre>
        </details>
      </div>
    );
  }
  return (
    <div style={{
      margin: '12px 0', padding: 8, background: surface.white,
      border: `1px solid ${line.base}`, borderRadius: 10, overflow: 'auto',
      display: 'flex', justifyContent: 'center',
    }}>
      <div
        ref={ref}
        style={{ width: '100%', maxWidth: 720 }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
