import { useEffect, useRef, useState } from 'react';
import { SUBJECTS } from '../../data/subjects';
import { getDayStudyTime, getDaySubjects } from '../../data/stores/studyTime';
import { fmtDuration, fmtClock } from '../../lib/format';
import { getStreak } from '../../data/stores/learningStore';
import { brand, ink, line, surface, semantic } from '../../styles/tokens';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const W = 1080, H = 1920;

function ddayFrom(examDate) {
  if (!examDate) return null;
  const d = new Date(examDate + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const n = Math.ceil((d - t) / 86400000);
  return n >= 0 ? n : null;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

async function drawCard(canvas, { dateKey, profile }) {
  const ctx = canvas.getContext('2d');
  const t = getDayStudyTime(dateKey);
  const total = (t.ai || 0) + (t.quiz || 0);
  const subsRaw = getDaySubjects(dateKey);
  const subs = SUBJECTS
    .map((s) => ({ s, secs: subsRaw[s.id]?.secs || 0 }))
    .filter((x) => x.secs > 0)
    .sort((a, b) => b.secs - a.secs)
    .slice(0, 4);
  const maxSecs = subs.length ? subs[0].secs : 1;
  const streak = getStreak().current || 0;
  const dday = ddayFrom(profile?.examDate);
  const name = profile?.name || profile?.persona || '나';
  const [yy, mm, dd] = dateKey.split('-').map(Number);
  const wd = WD[new Date(yy, mm - 1, dd).getDay()];
  const dateLabel = `${yy}. ${mm}. ${dd} (${wd})`;

  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, ink.faint);
  bg.addColorStop(0.55, brand.primaryDeep);
  bg.addColorStop(1, ink.muted);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = (cx, cy, r, a) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  };
  glow(880, 240, 420, 0.10);
  glow(160, 1680, 480, 0.08);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const FONT = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

  ctx.font = `800 34px ${FONT}`;
  const brand = '🐾  이묭AI  ·  공부 인증';
  const bw = ctx.measureText(brand).width + 64;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, W / 2 - bw / 2, 96, bw, 68, 34); ctx.fill();
  ctx.fillStyle = surface.white;
  ctx.fillText(brand, W / 2, 142);

  const cy = 360, r = 96;
  ctx.save();
  ctx.beginPath(); ctx.arc(W / 2, cy, r + 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
  ctx.beginPath(); ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = surface.raised; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(W / 2, cy, r, 0, Math.PI * 2); ctx.clip();
  const mascot = await loadImage('/imyong.png');
  if (mascot) {
    ctx.drawImage(mascot, W / 2 - r, cy - r, r * 2, r * 2);
  } else {
    ctx.font = '110px sans-serif'; ctx.fillStyle = brand.primaryDeep;
    ctx.textBaseline = 'middle'; ctx.fillText('🐶', W / 2, cy + 6);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = `600 38px ${FONT}`;
  ctx.fillText(dateLabel, W / 2, 560);

  ctx.fillStyle = surface.white;
  ctx.font = `900 168px ${FONT}`;
  ctx.fillText(total > 0 ? fmtClock(total) : '0:00', W / 2, 730);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('오늘 총 공부시간', W / 2, 792);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `600 36px ${FONT}`;
  ctx.fillText(`🤖 ${fmtDuration(t.ai || 0)}    📚 ${fmtDuration(t.quiz || 0)}`, W / 2, 856);

  const chips = [`🔥 ${streak}일 연속`];
  if (dday != null) chips.push(`📅 1차 D-${dday}`);
  chips.push(`📍 ${profile?.region || '서울'}`);
  ctx.font = `800 34px ${FONT}`;
  const chipH = 66, gap = 20;
  const widths = chips.map((c) => ctx.measureText(c).width + 52);
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
  let cx = W / 2 - totalW / 2;
  const chipY = 918;
  chips.forEach((c, i) => {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, cx, chipY, widths[i], chipH, chipH / 2); ctx.fill();
    ctx.fillStyle = surface.white;
    ctx.fillText(c, cx + widths[i] / 2, chipY + 44);
    cx += widths[i] + gap;
  });

  const panelX = 90, panelW = W - 180;
  const panelY = 1050;
  const rowH = 118;
  const headH = 96;
  const bodyH = subs.length ? subs.length * rowH : 150;
  const panelH = headH + bodyH + 40;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, panelX, panelY, panelW, panelH, 40); ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('과목별 공부시간', panelX + 50, panelY + 66);

  if (subs.length) {
    subs.forEach((it, i) => {
      const ry = panelY + headH + i * rowH;
      ctx.textAlign = 'left';
      ctx.font = `44px ${FONT}`;
      ctx.fillStyle = surface.white;
      ctx.fillText(it.s.icon, panelX + 50, ry + 46);
      ctx.font = `700 40px ${FONT}`;
      ctx.fillText(it.s.title, panelX + 118, ry + 46);
      ctx.textAlign = 'right';
      ctx.font = `800 40px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(fmtDuration(it.secs), panelX + panelW - 50, ry + 46);
      const barX = panelX + 50, barW = panelW - 100, barY = ry + 68, barH = 20;
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      roundRect(ctx, barX, barY, barW, barH, barH / 2); ctx.fill();
      const fillW = Math.max(barH, barW * (it.secs / maxSecs));
      const bar = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      bar.addColorStop(0, surface.white);
      bar.addColorStop(1, line.base);
      ctx.fillStyle = bar;
      roundRect(ctx, barX, barY, fillW, barH, barH / 2); ctx.fill();
    });
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `600 38px ${FONT}`;
    ctx.fillText('오늘의 첫 기록을 시작해보세요 🐾', W / 2, panelY + headH + 90);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = surface.white;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText(`${name}님, 오늘도 한 걸음 더 🌱`, W / 2, 1760);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText('이묭AI · 초등 임용 복습 파트너', W / 2, 1822);

  return { total };
}

export default function ShareStudyCard({ open, onClose, dateKey, profile }) {
  const canvasRef = useRef(null);
  const blobRef = useRef(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBusy(true); setMsg(''); setUrl('');
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvasRef.current = canvas;
    (async () => {
      try {
        await drawCard(canvas, { dateKey, profile });
        if (!alive) return;
        setUrl(canvas.toDataURL('image/png'));
        canvas.toBlob((b) => { blobRef.current = b; }, 'image/png');
      } catch {
        if (alive) setMsg('카드를 만드는 중 문제가 생겼어요.');
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [open, dateKey, profile]);

  if (!open) return null;

  const fileName = `이묭AI_공부인증_${dateKey}.png`;

  const doShare = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    const text = '오늘의 공부 인증 📚 #이묭AI #임용 #공스타그램';
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '오늘의 공부 인증', text });
        return;
      }
    } catch { }
    doSave();
    setMsg('이 기기에선 바로 공유가 안 돼요. 이미지를 저장한 뒤 인스타그램 스토리에 올려보세요!');
  };

  const doSave = () => {
    const blob = blobRef.current;
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={sheet}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: '1.02rem', color: ink.strongest }}>📷 공부 인증 공유</div>
          <button onClick={onClose} aria-label="닫기"
            style={{ background: 'none', border: 'none', fontSize: '1.3rem', color: ink.faint, cursor: 'pointer' }}>×</button>
        </div>

        <div style={preview}>
          {busy && <div style={{ color: ink.faint, fontSize: '0.86rem' }}>카드 만드는 중…</div>}
          {!busy && url && <img src={url} alt="공부 인증 카드" style={{ width: '100%', display: 'block', borderRadius: 14 }} />}
        </div>

        {msg && <div style={hint}>{msg}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={doSave} disabled={busy} style={{ ...btn, ...btnGhost, opacity: busy ? 0.5 : 1 }}>
            💾 이미지 저장
          </button>
          <button onClick={doShare} disabled={busy} style={{ ...btn, ...btnPrimary, opacity: busy ? 0.5 : 1 }}>
            📤 공유하기
          </button>
        </div>
        <div style={{ fontSize: '0.72rem', color: ink.faint, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          공유하기 → <b>Instagram · 스토리</b>를 선택하면 바로 올릴 수 있어요.
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)', zIndex: 1000,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const sheet = {
  background: surface.white, width: '100%', maxWidth: 440, borderRadius: '20px 20px 0 0',
  padding: '18px 18px 26px', boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
  animation: 'sheetUp 0.22s ease',
};
const preview = {
  background: surface.raised, borderRadius: 16, padding: 14, display: 'flex',
  alignItems: 'center', justifyContent: 'center', maxHeight: '58vh', overflow: 'hidden',
};
const hint = {
  marginTop: 12, background: semantic.warnTint, border: `1px solid ${semantic.warnLine}`, color: semantic.warn,
  borderRadius: 10, padding: '9px 12px', fontSize: '0.78rem', lineHeight: 1.5,
};
const btn = {
  flex: 1, padding: '13px 0', borderRadius: 12, fontSize: '0.92rem', fontWeight: 800,
  cursor: 'pointer', border: 'none',
};
const btnGhost = { background: surface.sunken, color: ink.body };
const btnPrimary = { background: `linear-gradient(135deg,${brand.primary},${brand.primaryDeep})`, color: surface.white };
