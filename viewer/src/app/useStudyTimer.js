// ⚠ 버킷 이름은 'ai' | 'quiz' 둘뿐이다(data/stores/studyTime.js).
import { useEffect, useState } from 'react';
import { addStudySeconds } from '../data/stores/studyTime';

const IDLE_MS = 120000;
const TICK = 5000;

export function useStudyTimer(category) {
  useEffect(() => {
    if (!category) return;
    let last = Date.now();
    let lastActivity = Date.now();
    const onActivity = () => { lastActivity = Date.now(); };
    const evs = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const flush = () => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      if (document.hidden) return;
      if (now - lastActivity > IDLE_MS) return;
      if (delta > 0 && delta < TICK * 4) addStudySeconds(category, delta / 1000);
    };
    const id = setInterval(flush, TICK);
    return () => {
      clearInterval(id);
      flush();
      evs.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [category]);
}

// ⚠ 탭 이름으로 판정하면 안 된다. AI 대화와 변형문제가 같은 탭 안에 있어
let _current = null;
const _subs = new Set();
function publish(v) {
  if (_current === v) return;
  _current = v;
  _subs.forEach((f) => f(v));
}

export function useStudyActivity(category) {
  useEffect(() => {
    if (!category) return undefined;
    publish(category);
    return () => publish(null);
  }, [category]);
}

export function useCurrentActivity() {
  const [v, setV] = useState(_current);
  useEffect(() => {
    _subs.add(setV);
    setV(_current);
    return () => { _subs.delete(setV); };
  }, []);
  return v;
}
