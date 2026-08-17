// ⚠ API 키를 다루는 곳은 여기 하나다. 화면마다 입력창을 두지 않는다.
import { useState } from 'react';
import { getPrefs, setPrefs, getApiKey, setApiKey, getBaseUrls, setBaseUrl, resetLearningProgress } from '../../data/stores/learningStore';
import { availableModels, coerceModel, getProviderForModel } from '../../services/aiProviders';
import { brand, ink, line, surface, semantic } from '../../styles/tokens';
import { isDemoOn, enterDemo, exitDemo } from '../../demo';

const PROVIDERS = [
  { id: 'anthropic', name: 'Claude (Anthropic)', ph: 'sk-ant-...', direct: true, proxy: false },
  { id: 'google', name: 'Gemini (Google)', ph: 'AIza...', direct: false, proxy: true },
  { id: 'moonshot', name: 'Kimi (Moonshot)', ph: 'sk-...', direct: false, proxy: true },
  { id: 'openai', name: 'GPT (OpenAI)', ph: 'sk-...', direct: false, proxy: true },
];
const PROVIDER_LABEL = { anthropic: 'Claude', google: 'Gemini', moonshot: 'Kimi', openai: 'GPT' };

function mask(k) { return k ? k.slice(0, 6) + '••••' + k.slice(-3) : ''; }

export default function Settings({ profile, onResetProfile, onBack }) {
  const [model, setModelState] = useState(() => coerceModel(getPrefs().model, (prov) => !!getApiKey(prov)));
  const [keys, setKeys] = useState(() => Object.fromEntries(PROVIDERS.map((p) => [p.id, getApiKey(p.id)])));
  const hasKey = (prov) => !!keys[prov];
  const [editing, setEditing] = useState({});
  const [urls, setUrls] = useState(() => getBaseUrls());
  const [flash, setFlash] = useState('');

  const toast = (m) => { setFlash(m); setTimeout(() => setFlash(''), 1600); };
  const changeModel = (id) => { setModelState(id); setPrefs({ model: id }); toast('기본 모델 변경됨'); };
  const saveKey = (prov) => {
    const v = (editing[prov] ?? '').trim();
    setApiKey(prov, v || null); setKeys((k) => ({ ...k, [prov]: v }));
    setEditing((e) => { const n = { ...e }; delete n[prov]; return n; });
    toast(v ? '키 저장됨' : '키 삭제됨');
  };
  const saveUrl = (prov, v) => { setBaseUrl(prov, v.trim() || undefined); setUrls((u) => ({ ...u, [prov]: v.trim() })); };

  const [demo, setDemo] = useState(() => isDemoOn());
  const [demoBusy, setDemoBusy] = useState(false);

  const toggleDemo = async () => {
    if (demoBusy) return;
    if (demo) {
      setDemoBusy(true);
      exitDemo();
      window.location.reload();
      return;
    }
    if (!confirm('데모 모드를 켜면 지금 학습 기록을 잠시 치워 두고 시연용 기록으로 바꿉니다.\n끄면 원래 기록이 그대로 돌아옵니다. 켤까요?')) return;
    setDemoBusy(true);
    setDemo(true);
    await enterDemo();
    window.location.reload();
  };

  const doReset = () => {
    if (!confirm('학습 진척(마스터·정답률·대화)을 모두 초기화할까요? API 키·설정은 유지됩니다.')) return;
    resetLearningProgress(); toast('학습 진척 초기화됨');
  };

  const curProvider = getProviderForModel(model);

  return (
    <div className="app-container">
      <header className="top-nav" style={{ justifyContent: 'flex-start', gap: 10, alignItems: 'center' }}>
        {onBack && <button onClick={onBack} aria-label="뒤로" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: ink.muted, padding: 0 }}>←</button>}
        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: ink.strongest }}>⚙️ 설정</div>
      </header>
      <main className="main-content">
        {flash && <div style={toastStyle}>{flash}</div>}

        <Card title="🤖 기본 AI 모델" desc="복습·변형문제 생성에 쓰이는 기본 모델입니다. 복습 화면에서도 바꿀 수 있어요.">
          <select value={model} onChange={(e) => changeModel(e.target.value)} style={selectStyle}>
            {['anthropic', 'google', 'moonshot', 'openai'].map((prov) => {
              const ms = availableModels(hasKey).filter((m) => m.provider === prov);
              return ms.length ? (
                <optgroup key={prov} label={PROVIDER_LABEL[prov]}>
                  {ms.map((m) => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
                </optgroup>
              ) : null;
            })}
          </select>
          <div style={{ fontSize: '0.76rem', color: curProvider === 'anthropic' ? semantic.success : semantic.warn, marginTop: 8, fontWeight: 600 }}>
            {curProvider === 'anthropic'
              ? '✓ Claude는 앱에 내장돼 있어요 — 키 없이 바로 작동합니다.'
              : '⚠ 이 모델은 CORS로 직접 호출이 막힐 수 있어요 — 아래 프록시와 키가 필요할 수 있습니다.'}
          </div>
        </Card>

        <div style={noticeBox}>
          <b>내장 AI로 이미 작동합니다.</b> 아래 키는 넣지 않아도 돼요.<br />
          내 키를 넣으면 그 키로 직접 호출하고 <b>요금이 내 계정으로 청구</b>됩니다.
          Gemini·Kimi·GPT를 쓰려면 해당 키가 필요해요.
        </div>

        <Card title="🔑 API 키 (선택)" desc="키는 이 기기에만 저장되고 서버로 보내지 않아요. Claude는 내장돼 있어 없어도 됩니다.">
          {PROVIDERS.map((p) => {
            const has = !!keys[p.id];
            const isEditing = editing[p.id] !== undefined;
            return (
              <div key={p.id} style={{ padding: '10px 0', borderBottom: `1px solid ${surface.sunken}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: ink.strongest }}>{p.name}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: has ? semantic.success : ink.faint }}>{has ? '● 설정됨' : '○ 미설정'}</span>
                </div>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input autoFocus value={editing[p.id]} onChange={(e) => setEditing((x) => ({ ...x, [p.id]: e.target.value }))}
                      placeholder={p.ph} style={inputStyle} />
                    <button onClick={() => saveKey(p.id)} style={miniBtnPrimary}>저장</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ flex: 1, fontSize: '0.82rem', color: ink.muted, fontFamily: 'monospace' }}>{has ? mask(keys[p.id]) : '—'}</span>
                    <button onClick={() => setEditing((x) => ({ ...x, [p.id]: keys[p.id] || '' }))} style={miniBtn}>{has ? '변경' : '입력'}</button>
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        <Card title="🌐 프록시 URL (선택)" desc="Gemini·Kimi·GPT는 브라우저 직접 호출이 CORS로 막힐 수 있어요. OpenAI 호환 프록시 주소를 넣으면 그 주소로 호출합니다. (Claude는 불필요)">
          {PROVIDERS.filter((p) => p.proxy).map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
              <span style={{ width: 60, fontSize: '0.82rem', fontWeight: 700, color: ink.sub, flexShrink: 0 }}>{PROVIDER_LABEL[p.id]}</span>
              <input defaultValue={urls[p.id] || ''} onBlur={(e) => saveUrl(p.id, e.target.value)}
                placeholder="https://my-proxy.example.com" style={{ ...inputStyle, fontSize: '0.8rem' }} />
            </div>
          ))}
        </Card>

        <Card title="👤 프로필">
          <div style={{ fontSize: '0.88rem', color: ink.body, lineHeight: 1.9 }}>
            <div><b>페르소나</b> {profile?.persona} · <b>지역</b> {profile?.region} · <b>시험일</b> {profile?.examDate}</div>
          </div>
          <button onClick={onResetProfile} style={secBtn}>프로필 다시 설정</button>
        </Card>

        <Card title="🎬 데모 모드" desc="시연용입니다. 학습 기록을 미리 채워 두고, AI 응답을 서버 없이 이 기기 안에서 만듭니다.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: ink.body }}>
                {demo ? '켜짐 — 시연용 데이터' : '꺼짐'}
              </div>
              <div style={{ fontSize: '0.74rem', color: ink.faint, marginTop: 3, lineHeight: 1.5 }}>
                {demo
                  ? '끄면 원래 학습 기록이 그대로 돌아옵니다.'
                  : '켜는 동안 실제 기록은 따로 보관됩니다.'}
              </div>
            </div>
            <button onClick={toggleDemo} disabled={demoBusy} role="switch" aria-checked={demo}
              aria-label="데모 모드" style={{ ...track, ...(demo ? trackOn : null) }}>
              <span style={{ ...knob, ...(demo ? knobOn : null) }} />
            </button>
          </div>
          <div style={{ fontSize: '0.74rem', color: ink.faint, marginTop: 10, lineHeight: 1.5 }}>
            주소 뒤에 <b>?demo=1</b> 을 붙이면 바로 켜진 채로 열립니다. 시연 링크로 쓰세요.
          </div>
        </Card>

        <Card title="🗑 데이터">
          <button onClick={doReset} style={{ ...secBtn, color: semantic.danger, borderColor: semantic.dangerLine }}>학습 진척 초기화</button>
          <div style={{ fontSize: '0.74rem', color: ink.faint, marginTop: 8 }}>API 키·프로필은 유지되고, 마스터·정답률·대화만 지워집니다.</div>
        </Card>
      </main>
    </div>
  );
}

function Card({ title, desc, children }) {
  return (
    <section style={{ background: surface.white, borderRadius: 16, padding: 18, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: ink.strongest, margin: 0 }}>{title}</h3>
      {desc && <p style={{ fontSize: '0.8rem', color: ink.muted, margin: '6px 0 14px', lineHeight: 1.5 }}>{desc}</p>}
      {!desc && <div style={{ height: 12 }} />}
      {children}
    </section>
  );
}

const selectStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${line.base}`, background: surface.white, fontSize: '0.9rem', fontWeight: 700, color: ink.body, cursor: 'pointer' };
const inputStyle = { flex: 1, minWidth: 0, padding: '9px 11px', border: `1px solid ${line.base}`, borderRadius: 9, fontSize: '0.85rem', boxSizing: 'border-box' };
const miniBtn = { padding: '7px 13px', borderRadius: 8, border: `1px solid ${line.base}`, background: surface.white, color: ink.body, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 };
const miniBtnPrimary = { padding: '7px 14px', borderRadius: 8, border: 'none', background: brand.primary, color: surface.white, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 };
const secBtn = { marginTop: 12, width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${line.base}`, background: surface.white, color: ink.muted, fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer' };
const track = {
  width: 50, height: 30, borderRadius: 999, flexShrink: 0, cursor: 'pointer', padding: 3,
  border: `1px solid ${line.base}`, background: surface.sunken,
  display: 'flex', justifyContent: 'flex-start', alignItems: 'center',
};
const trackOn = { background: brand.primary, borderColor: brand.primary, justifyContent: 'flex-end' };
const knob = {
  width: 22, height: 22, borderRadius: '50%', background: surface.white,
  boxShadow: '0 1px 3px rgba(43, 51, 70, 0.25)', display: 'block',
};
const knobOn = { background: surface.white };

const noticeBox = {
  background: brand.tintSoft, border: `1px solid ${line.base}`, borderRadius: 12,
  padding: '12px 14px', marginBottom: 14, fontSize: '0.82rem',
  color: ink.body, lineHeight: 1.65,
};
const toastStyle = { position: 'sticky', top: 8, zIndex: 5, background: ink.strongest, color: surface.white, fontSize: '0.82rem', fontWeight: 700, padding: '8px 14px', borderRadius: 999, textAlign: 'center', marginBottom: 12, width: 'fit-content', marginLeft: 'auto', marginRight: 'auto' };
