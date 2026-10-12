import { useEffect, useRef } from 'react';
import FileCat from '../FileCat';
import './folder-cat-transition.css';

const MOTION_DURATION = 860;

// Mounted with a fresh key for an intentional folder switch; it never delays navigation.
export default function FolderCatTransition({ direction = 1, onComplete }) {
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    let completed = false;
    let timer;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => {
      if (cancelled || completed) return;
      completed = true;
      onCompleteRef.current?.();
    };
    const onPreferenceChange = (event) => {
      if (!event.matches) return;
      window.clearTimeout(timer);
      finish();
    };

    if (preference.matches) finish();
    else timer = window.setTimeout(finish, MOTION_DURATION + 40);
    preference.addEventListener('change', onPreferenceChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      preference.removeEventListener('change', onPreferenceChange);
    };
  }, []);

  return (
    <div
      className={`folder-cat-transition${direction < 0 ? ' folder-cat-transition--backward' : ''}`}
      style={{ '--folder-cat-duration': `${MOTION_DURATION}ms` }}
      aria-hidden="true"
    >
      <div className="folder-cat-transition__scene">
        <span className="folder-cat-transition__ground" />
        <div className="folder-cat-transition__folder-back">
          <svg viewBox="0 0 72 58" fill="none">
            <path d="M5 53V14a4 4 0 0 1 4-4h17l7 7h30a4 4 0 0 1 4 4v32Z" fill="#eeeeeb" stroke="#32322e" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M12 24h46" stroke="#dadad5" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="folder-cat-transition__carrier">
          <div className="folder-cat-transition__pose folder-cat-transition__pose--collect">
            <FileCat variant="collecting" file="document" />
          </div>
          <div className="folder-cat-transition__pose folder-cat-transition__pose--offer">
            <FileCat variant="offering" file="document" />
          </div>
        </div>
        <div className="folder-cat-transition__paper">
          <svg viewBox="0 0 24 30" fill="none">
            <path d="M2 1h14l6 6v22H2Z" fill="white" stroke="#32322e" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M16 1v6h6M7 13h10M7 18h10M7 23h6" stroke="#85857e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="folder-cat-transition__folder-front">
          <svg viewBox="0 0 72 58" fill="none">
            <path d="M4 29h64l-8 24H11Z" fill="#f8f8f6" stroke="#32322e" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M30 39h16" stroke="#b9b9b2" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
