
import { useRef, useState } from 'react';
import { ink, line, surface } from '../../styles/tokens';

function svgBlobUrl(svgString) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(blob);
}

function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function VizFrame({ children, templateName }) {
  const wrapperRef = useRef(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const findSvg = () => wrapperRef.current?.querySelector('svg');

  const handleDownloadSvg = () => {
    const svg = findSvg();
    if (!svg) {
      showToast('이 도식은 표 형태입니다. Cmd+P로 인쇄/PDF 저장하세요.');
      return;
    }
    const clone = svg.cloneNode(true);
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serialized = new XMLSerializer().serializeToString(clone);
    const url = svgBlobUrl(serialized);
    downloadFile(url, `${templateName || 'viz'}.svg`);
    showToast('SVG 다운로드 완료');
  };

  const handleCopySvg = async () => {
    const svg = findSvg();
    if (!svg) {
      showToast('이 도식은 SVG가 아닙니다.');
      return;
    }
    const serialized = new XMLSerializer().serializeToString(svg);
    const ok = await copyToClipboard(serialized);
    showToast(ok ? 'SVG 클립보드에 복사' : '복사 실패');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div ref={wrapperRef} className="viz-frame" style={{ position: 'relative' }}>
      {children}
      <div className="viz-toolbar" style={{
        position: 'absolute', top: 16, right: 16,
        display: 'flex', gap: 4,
        opacity: 0.4, transition: 'opacity 0.15s ease-out',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.4; }}
      >
        <button onClick={handleDownloadSvg} title="SVG 다운로드"
          style={btnStyle()}>⬇</button>
        <button onClick={handleCopySvg} title="SVG 클립보드 복사"
          style={btnStyle()}>📋</button>
        <button onClick={handlePrint} title="인쇄/PDF"
          style={btnStyle()}>🖨</button>
      </div>
      {toast && (
        <div style={{
          position: 'absolute', top: 50, right: 16,
          padding: '6px 10px', background: ink.strongest, color: surface.white,
          borderRadius: 6, fontSize: '0.74rem', fontWeight: 700,
          animation: 'toastIn 0.18s ease-out',
        }}>{toast}</div>
      )}
    </div>
  );
}

function btnStyle() {
  return {
    width: 28, height: 28, borderRadius: 6,
    background: 'rgba(255,255,255,0.9)', border: `1px solid ${line.strong}`,
    cursor: 'pointer', fontSize: '0.78rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: ink.body,
  };
}
