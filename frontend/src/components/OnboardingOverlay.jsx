import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

const STORAGE_KEY = (key) => `fitpoly_onboarding_${key}`;
const SESSION_KEY = (key) => `fitpoly_ob_session_${key}`;

/* Hook: 페이지별 온보딩 표시 여부 관리 */
export function useOnboarding(pageKey) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const permanent = localStorage.getItem(STORAGE_KEY(pageKey));
    const session   = sessionStorage.getItem(SESSION_KEY(pageKey));
    if (!permanent && !session) {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, [pageKey]);

  const dismiss = (permanent = false) => {
    if (permanent) localStorage.setItem(STORAGE_KEY(pageKey), '1');
    sessionStorage.setItem(SESSION_KEY(pageKey), '1');
    setVisible(false);
  };

  return { visible, dismiss };
}

/* SVG 화살표 */
function Arrow({ dir }) {
  const base = 'stroke-white fill-none';
  const sw   = '2.5';
  const lc   = 'round';
  const lj   = 'round';

  if (dir === 'up') return (
    <div className="flex justify-center">
      <svg width="22" height="36" viewBox="0 0 22 36">
        <line x1="11" y1="36" x2="11" y2="8"  className={base} strokeWidth={sw} strokeLinecap={lc}/>
        <polyline points="4,16 11,4 18,16"     className={base} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}/>
      </svg>
    </div>
  );

  if (dir === 'down') return (
    <div className="flex justify-center">
      <svg width="22" height="36" viewBox="0 0 22 36">
        <line x1="11" y1="0"  x2="11" y2="28" className={base} strokeWidth={sw} strokeLinecap={lc}/>
        <polyline points="4,20 11,32 18,20"     className={base} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}/>
      </svg>
    </div>
  );

  if (dir === 'right') return (
    <div className="flex items-center justify-start mt-2 ml-4">
      <svg width="36" height="22" viewBox="0 0 36 22">
        <line x1="0"  y1="11" x2="28" y2="11" className={base} strokeWidth={sw} strokeLinecap={lc}/>
        <polyline points="20,4 32,11 20,18"    className={base} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}/>
      </svg>
    </div>
  );

  if (dir === 'left') return (
    <div className="flex items-center justify-end mt-2 mr-4">
      <svg width="36" height="22" viewBox="0 0 36 22">
        <line x1="36" y1="11" x2="8"  y2="11" className={base} strokeWidth={sw} strokeLinecap={lc}/>
        <polyline points="16,4 4,11 16,18"     className={base} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}/>
      </svg>
    </div>
  );

  return null;
}

/* 개별 말풍선 카드 */
function Callout({ data }) {
  const { message, sub, icon, style, arrow } = data;
  return (
    <div className="absolute pointer-events-none select-none" style={style}>
      {/* 위 화살표 */}
      {arrow === 'up' && <Arrow dir="up" />}

      {/* 카드 */}
      <div
        className="bg-white rounded-2xl shadow-2xl px-4 py-3.5"
        style={{ width: '188px', boxShadow: '0 8px 32px rgba(0,0,0,0.28)' }}
      >
        {icon && <div className="text-[22px] mb-2 leading-none">{icon}</div>}
        <p className="text-[12.5px] font-extrabold text-gray-900 leading-[1.45]">{message}</p>
        {sub && (
          <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed font-medium">{sub}</p>
        )}
      </div>

      {/* 아래 화살표 */}
      {arrow === 'down'  && <Arrow dir="down"  />}
      {arrow === 'right' && <Arrow dir="right" />}
      {arrow === 'left'  && <Arrow dir="left"  />}
    </div>
  );
}

/* 메인 오버레이 */
export default function OnboardingOverlay({ visible, onDismiss, callouts }) {
  const [neverShow, setNeverShow] = useState(false);

  if (!visible) return null;

  const handleClose = () => onDismiss(neverShow);

  return (
    <div
      className="fixed inset-0 z-[9998]"
      style={{ background: 'rgba(12,18,38,0.78)' }}
      onClick={handleClose}
    >
      {callouts.map((c, i) => <Callout key={i} data={c} />)}

      {/* 하단 바 */}
      <div
        className="absolute bottom-0 inset-x-0 flex items-center justify-between px-6 py-5"
        style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 다시보지않기 */}
        <button
          className="flex items-center gap-2.5 group"
          onClick={() => setNeverShow(v => !v)}
        >
          <div
            className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all ${
              neverShow
                ? 'bg-white border-white'
                : 'border-white/50 group-hover:border-white/80'
            }`}
          >
            {neverShow && <Check size={11} className="text-gray-800" strokeWidth={3.5} />}
          </div>
          <span className="text-white/90 text-[13px] sm:text-sm font-medium">다시보지않기</span>
        </button>

        {/* 닫기 */}
        <button
          onClick={handleClose}
          className="px-6 sm:px-8 py-2.5 rounded-xl text-[13px] sm:text-sm font-bold border-2 border-white/80 text-white hover:bg-white hover:text-gray-900 transition-all"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
