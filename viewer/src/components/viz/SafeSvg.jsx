import { line, surface, semantic } from '../../styles/tokens';

const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'foreignobject', 'use', 'meta', 'link', 'style'];
const DANGEROUS_ATTR_PREFIXES = ['on'];
const URL_ATTRS = ['href', 'xlink:href', 'src'];

function sanitizeSvg(rawSvg) {
  if (typeof window === 'undefined' || !window.DOMParser) return null;
  let cleaned = String(rawSvg || '').trim();
  if (!/^<svg[\s>]/i.test(cleaned)) {
    return { ok: false, reason: '루트 <svg> 태그가 아닙니다.' };
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleaned, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() === 'parsererror' || root.tagName.toLowerCase() !== 'svg') {
      return { ok: false, reason: 'SVG 파싱 실패' };
    }
    const walker = doc.createTreeWalker(root, 1);
    const toRemove = [];
    let node;
    while ((node = walker.nextNode())) {
      const tn = node.tagName.toLowerCase();
      if (DANGEROUS_TAGS.includes(tn)) {
        toRemove.push(node);
        continue;
      }
      const attrs = Array.from(node.attributes || []);
      for (const a of attrs) {
        const name = a.name.toLowerCase();
        if (DANGEROUS_ATTR_PREFIXES.some((p) => name.startsWith(p))) {
          node.removeAttribute(a.name);
          continue;
        }
        if (URL_ATTRS.includes(name)) {
          const v = (a.value || '').trim().toLowerCase();
          if (v.startsWith('javascript:') || v.startsWith('data:text/html')) {
            node.removeAttribute(a.name);
          }
        }
      }
    }
    toRemove.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
    if (!root.getAttribute('viewBox')) {
      const w = root.getAttribute('width') || '400';
      const h = root.getAttribute('height') || '300';
      const wn = parseFloat(w) || 400, hn = parseFloat(h) || 300;
      root.setAttribute('viewBox', `0 0 ${wn} ${hn}`);
    }
    root.removeAttribute('width');
    root.removeAttribute('height');
    return { ok: true, svg: new XMLSerializer().serializeToString(root) };
  } catch (e) {
    return { ok: false, reason: 'SVG 처리 오류: ' + e.message };
  }
}

export default function SafeSvg({ raw }) {
  const result = sanitizeSvg(raw);
  if (!result || !result.ok) {
    return (
      <div style={{
        margin: '8px 0', padding: '10px 12px',
        background: semantic.dangerTint, border: `1px solid ${semantic.dangerLine}`, borderRadius: 8,
        fontSize: '0.78rem', color: semantic.danger,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ SVG 렌더 실패</div>
        <div>{result?.reason || '알 수 없는 오류'}</div>
      </div>
    );
  }
  return (
    <div style={{
      margin: '12px 0', padding: 8, background: surface.white,
      border: `1px solid ${line.base}`, borderRadius: 10, overflow: 'hidden',
      display: 'flex', justifyContent: 'center',
    }}>
      <div
        style={{ width: '100%', maxWidth: 640 }}
        dangerouslySetInnerHTML={{ __html: result.svg }}
      />
    </div>
  );
}
