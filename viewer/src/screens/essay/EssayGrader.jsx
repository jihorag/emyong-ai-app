import { useState } from 'react';
import { sendMessages } from '../../services/anthropicClient';
import { getApiKey, getPrefs, getBaseUrls } from '../../data/stores/learningStore';
import ParsedText from '../../components/ParsedText';
import { ESSAY_GRADE_SYSTEM, ESSAY_RUBRIC_INTRO, ESSAY_ANSWER_IMAGE_INTRO, essayAnswerText, ESSAY_INSTRUCTION } from '../../prompts/essay';
import { brand, ink, line, surface, semantic } from '../../styles/tokens';

function fileToJpeg(file, maxDim = 1568) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = surface.white; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg', preview: dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 불러올 수 없어요 (HEIC 등 일부 형식은 지원이 안 될 수 있어요)')); };
    img.src = url;
  });
}

export default function EssayGrader({ onBack }) {
  const [rubric, setRubric] = useState(null);
  const [answerImg, setAnswerImg] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = (setter) => async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    try { setter(await fileToJpeg(f)); }
    catch (err) { setError(err.message || String(err)); }
  };

  const grade = async () => {
    const key = getApiKey('anthropic');
    if (!rubric) { setError('채점 기준 사진을 먼저 올려주세요.'); return; }
    if (!answerImg && !answerText.trim()) { setError('내 답안(사진 또는 텍스트)을 입력해주세요.'); return; }
    setBusy(true); setError(''); setResult('');
    try {
      const content = [
        { type: 'text', text: ESSAY_RUBRIC_INTRO },
        { type: 'image', source: { type: 'base64', media_type: rubric.mediaType, data: rubric.data } },
      ];
      if (answerImg) {
        content.push({ type: 'text', text: ESSAY_ANSWER_IMAGE_INTRO });
        content.push({ type: 'image', source: { type: 'base64', media_type: answerImg.mediaType, data: answerImg.data } });
      }
      if (answerText.trim()) content.push({ type: 'text', text: essayAnswerText(answerText.trim()) });
      content.push({ type: 'text', text: ESSAY_INSTRUCTION });

      const prefsModel = getPrefs().model || '';
      const model = prefsModel.startsWith('claude') ? prefsModel : 'claude-haiku-4-5-20251001';
      const res = await sendMessages({ apiKey: key, model, system: ESSAY_GRADE_SYSTEM, messages: [{ role: 'user', content }], maxTokens: 1800, baseUrl: getBaseUrls().anthropic });
      setResult(res.text || '(응답 없음)');
    } catch (e) {
      setError('채점 실패: ' + (e.message || e));
    } finally { setBusy(false); }
  };

  const reset = () => { setRubric(null); setAnswerImg(null); setAnswerText(''); setResult(''); setError(''); };

  return (
    <div className="app-container">
      <header className="top-nav" style={{ justifyContent: 'flex-start', gap: 10 }}>
        {onBack && (
          <button onClick={onBack} aria-label="뒤로"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: ink.muted, padding: 0 }}>←</button>
        )}
        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: ink.strongest }}>논술 채점</div>
      </header>
      <main className="main-content">
        <div style={noticeBox}>
          <b>채점 기준을 사진으로</b> 올리면 AI가 읽어서(OCR) 그 기준에 맞게 <b>내 논술 답안</b>을 채점해요.
          <span style={{ color: ink.faint }}> (MVP · Claude 비전 사용)</span>
        </div>

        <Card n="1" title="채점 기준 사진" desc="배점·항목이 보이게 찍어주세요.">
          <UploadBox img={rubric} onPick={pick(setRubric)} onClear={() => setRubric(null)} label="채점 기준 촬영·업로드" />
        </Card>

        <Card n="2" title="내 답안" desc="사진 또는 텍스트 (둘 중 하나면 돼요).">
          <UploadBox img={answerImg} onPick={pick(setAnswerImg)} onClear={() => setAnswerImg(null)} label="답안 촬영·업로드 (선택)" />
          <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)}
            placeholder="또는 여기에 답안을 직접 입력…" style={answerArea} />
        </Card>

        {error && <div style={{ color: semantic.danger, fontSize: '0.84rem', margin: '2px 0 10px' }}>{error}</div>}

        {!result && (
          <button onClick={grade} disabled={busy} style={{ ...primBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? '채점 중… (기준 읽고 답안 평가)' : '🤖 이 기준으로 채점하기'}
          </button>
        )}

        {result && (
          <>
            <div style={resultBox}>
              <div className="parsed-text" style={{ fontSize: '0.92rem', lineHeight: 1.75, color: ink.body }}>
                <ParsedText text={result} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setResult('')} style={secBtn}>다시 채점</button>
              <button onClick={reset} style={{ ...secBtn, flex: 1 }}>새 답안</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Card({ n, title, desc, children }) {
  return (
    <section style={cardBox}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={stepNo}>{n}</span>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: ink.strongest }}>{title}</span>
      </div>
      {desc && <div style={{ fontSize: '0.78rem', color: ink.faint, margin: '0 0 12px 30px' }}>{desc}</div>}
      {children}
    </section>
  );
}

function UploadBox({ img, onPick, onClear, label }) {
  if (img) {
    return (
      <div style={{ position: 'relative' }}>
        <img src={img.preview} alt="업로드" style={{ width: '100%', borderRadius: 12, border: `1px solid ${line.base}`, display: 'block' }} />
        <button onClick={onClear} style={clearBtn}>✕ 지우기</button>
      </div>
    );
  }
  return (
    <label style={dropZone}>
      <input type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} />
      <span style={{ fontSize: '1.6rem' }}>📷</span>
      <span style={{ fontWeight: 700, color: brand.primary, fontSize: '0.9rem' }}>{label}</span>
      <span style={{ fontSize: '0.74rem', color: ink.faint }}>탭하면 카메라/앨범</span>
    </label>
  );
}

const noticeBox = { background: surface.page, border: `1px solid ${line.strong}`, borderRadius: 12, padding: '12px 14px', fontSize: '0.86rem', color: brand.primaryDeep, lineHeight: 1.6, marginBottom: 16 };
const cardBox = { background: surface.white, border: `1px solid ${surface.page}`, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: 'var(--shadow-sm)' };
const stepNo = { flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: brand.primary, color: surface.white, fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const dropZone = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '22px', border: `2px dashed ${line.strong}`, borderRadius: 12, background: surface.page, cursor: 'pointer', textAlign: 'center' };
const clearBtn = { position: 'absolute', top: 8, right: 8, padding: '4px 10px', borderRadius: 999, border: 'none', background: 'rgba(17,24,39,0.72)', color: surface.white, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' };
const answerArea = { width: '100%', minHeight: 90, marginTop: 10, padding: '10px 12px', border: `1px solid ${line.base}`, borderRadius: 10, fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' };
const primBtn = { width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${brand.primary},${brand.primaryDeep})`, color: surface.white, fontWeight: 800, fontSize: '0.96rem', cursor: 'pointer' };
const secBtn = { padding: '12px 16px', borderRadius: 12, border: `1px solid ${line.base}`, background: surface.white, color: ink.body, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' };
const resultBox = { background: surface.white, border: `1px solid ${surface.page}`, borderRadius: 14, borderTop: `4px solid ${brand.primary}`, padding: '16px 18px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
