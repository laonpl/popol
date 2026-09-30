import FileCat from './FileCat';

export default function BrandLoader({ label = '이야기를 꺼내는 중', detail, fullScreen = false, file = 'pdf' }) {
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
