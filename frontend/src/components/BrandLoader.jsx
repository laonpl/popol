import FileCat from './FileCat';
import { useEffect, useState } from 'react';

export default function BrandLoader({ label = '이야기를 꺼내는 중', detail, fullScreen = false, file = 'pdf', delay = 180 }) {
  const [visible, setVisible] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) { setVisible(true); return; }
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);
  if (!visible) return null;
  return (
    <div className={fullScreen ? 'fp-loader' : 'fp-loader fp-loader-inline'} role="status" aria-live="polite">
      <div className="fp-loader-card">
        <FileCat variant="loading" file={file} withDocuments className="fp-loader-mascot" />
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
        <span className="fp-loader-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
    </div>
  );
}
