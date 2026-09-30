const FILE_LABELS = { pdf: 'PDF', document: 'DOC', image: 'IMG', portfolio: 'PPT' };

// Round silhouette and expressive eyes inspired by choi0806/gong's mascot.
// FitPoly's companion gathers loose files and carries a document in its mouth.
export default function FileCat({ variant = 'curious', file = 'pdf', className = '', title = '', withDocuments = false }) {
  const label = FILE_LABELS[file] || String(file).slice(0, 4).toUpperCase();
  const sleepy = variant === 'sleepy';
  const happy = variant === 'happy';
  return (
    <svg viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={`filecat filecat--${variant} ${className}`.trim()}
      role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true}>
      <ellipse cx="143" cy="259" rx="79" ry="7" fill="#e6e6e0" />
      {withDocuments && <g className="filecat-loose-files" stroke="#111" strokeWidth="2.5" strokeLinejoin="round">
        <g className="filecat-loose-file" transform="rotate(-16 37 141)">
          <path d="M20 119h26l10 10v34H20Z" fill="white" /><path d="M46 119v10h10M27 141h20M27 149h14" />
        </g>
        <g className="filecat-loose-file" transform="rotate(14 243 76)">
          <path d="M226 53h26l10 10v35h-36Z" fill="white" /><path d="M252 53v10h10" />
          <path d="m232 89 8-10 6 6 5-5 5 9Z" fill="#e6e6e0" /><circle cx="237" cy="71" r="2" fill="#111" stroke="none" />
        </g>
      </g>}
      <g className="filecat-companion">
        <path className="filecat-tail" d="M190 177c27 25 48 9 48-8 0-11-9-15-16-5-7 9-16 6-23-3Z" fill="#111" />
        <path className="filecat-body" d="M78 99c-5-22-9-56 5-60 10-3 23 12 33 22 15-5 33-5 49 0 11-12 23-28 33-22 11 7 7 40 3 61 14 21 18 52 11 80-4 19-13 34-24 45l-3 19c-3 20-28 21-32 2l-4-20h-23l-5 20c-5 19-30 16-28-3l3-23c-16-14-26-38-27-63-1-23 2-42 9-58Z" fill="#111" />
        <g className="filecat-face">
          {sleepy ? <path d="M96 101q12 13 25 0m19 0q12 13 25 0" stroke="white" strokeWidth="5" strokeLinecap="round" /> : <g className="filecat-eyes">
            <ellipse cx="111" cy="100" rx="18" ry="23" fill="white" /><ellipse cx="156" cy="99" rx="18" ry="23" fill="white" />
            <ellipse className="filecat-pupil" cx="115" cy="102" rx="6.5" ry="10" fill="#111" /><ellipse className="filecat-pupil" cx="160" cy="101" rx="6.5" ry="10" fill="#111" />
            {happy && <><circle cx="113" cy="98" r="2.5" fill="white" /><circle cx="158" cy="97" r="2.5" fill="white" /></>}
          </g>}
          <path d="m129 123 5 3 5-3" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g className="filecat-mouth-file">
          {withDocuments && <path d="m98 144 96-5 10 84-103 10Z" fill="white" stroke="#111" strokeWidth="4" strokeLinejoin="round" />}
          <path d="m81 140 83-8 23 20 7 68-103 12Z" fill="white" stroke="#111" strokeWidth="4.5" strokeLinejoin="round" />
          <path d="m164 133 2 22 21-3M107 172l44-5m-42 19 58-7m-56 21 36-4" stroke="#111" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="156" y="211" transform="rotate(-6 156 211)" fill="#111" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10">{label}</text>
        </g>
        {/* Mouth overlaps the paper edge so the bite reads at small sizes. */}
        <path d="M125 133q9 12 19-2" stroke="#111" strokeWidth="7" strokeLinecap="round" />
        <path d="M130 132q4 4 8-1" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M80 156c-17-5-24 13-8 22l15 7c11 4 19-9 10-17ZM190 163c-8-11-23-8-22 4 1 11 21 20 31 12 8-6 0-13-9-16Z" fill="#111" />
      </g>
      {(happy || variant === 'loading') && <g className="filecat-spark" stroke="#111" strokeWidth="3" strokeLinecap="round"><path d="M42 77v14m-7-7h14M234 224v12m-6-6h12" /></g>}
    </svg>
  );
}
