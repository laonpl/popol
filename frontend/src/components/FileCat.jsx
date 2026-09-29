const FILE_LABELS = {
  pdf: 'PDF',
  document: 'DOC',
  image: 'IMG',
  portfolio: 'PPT',
};

export default function FileCat({ variant = 'curious', file = 'pdf', className = '', title = '', withDocuments = false }) {
  const fileLabel = FILE_LABELS[file] || String(file).slice(0, 4).toUpperCase();
  const isHappy = variant === 'happy';
  const isSleepy = variant === 'sleepy';
  const isThinking = variant === 'thinking';

  return (
    <svg
      viewBox="55 20 265 250"
      fill="none"
      className={`filecat filecat--${variant} ${className}`.trim()}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="184" cy="259" rx="92" ry="8" fill="#e5e5df" />

      {/* One straight, rounded silhouette: little feet, soft ears, no arched back. */}
      <path d="M119 211h35v34c0 12-7 18-18 18s-17-7-17-18v-34ZM204 211h35v34c0 12-7 18-18 18s-17-7-17-18v-34Z" fill="#111" />
      <path className="filecat-body" d="M101 86c0-8 1-28 3-43 1-11 10-14 18-7l29 24c19-5 40-5 59 0l30-24c8-7 17-4 18 7l4 42c9 13 13 28 13 46v82c0 17-11 27-28 27H115c-17 0-28-10-28-27v-82c0-18 5-33 14-45Z" fill="#111" />

      {/* Large eyes stay the same visual size across the expression variants. */}
      {isSleepy ? (
        <g className="filecat-face">
          <path d="M126 104c8 8 20 8 28 0M188 104c8 8 20 8 28 0" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
        </g>
      ) : (
        <g className="filecat-face">
          <ellipse cx="141" cy="104" rx="19" ry="24" fill="#fff" />
          <ellipse cx="203" cy="104" rx="19" ry="24" fill="#fff" />
          <ellipse cx={isThinking ? '146' : '142'} cy="107" rx="6.5" ry="10" fill="#111" />
          <ellipse cx={isThinking ? '208' : '204'} cy="107" rx="6.5" ry="10" fill="#111" />
          {isHappy && <circle cx="137" cy="97" r="3" fill="#fff" />}
        </g>
      )}
      <path d="m166 136 8 4 8-4" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* A small lens mirrors the reference pose without competing with the page. */}
      {withDocuments && (
        <g className="filecat-lens">
          <path d="m279 120 26 30" stroke="#111" strokeWidth="10" strokeLinecap="round" />
          <circle cx="267" cy="100" r="25" fill="#fff" stroke="#111" strokeWidth="7" />
          <path d="M254 92c3-5 7-8 13-9" stroke="#d3d3cd" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {/* Multiple file edges show behind one clear page, held in front of the cat. */}
      {withDocuments && (
        <g className="filecat-back-documents">
          <rect x="143" y="155" width="127" height="80" rx="4" fill="#fff" stroke="#111" strokeWidth="4" />
          <rect x="150" y="153" width="127" height="80" rx="4" fill="#fff" stroke="#111" strokeWidth="4" />
          <path d="M218 154v-18h27v18M249 153v-18h29v18" fill="#fff" stroke="#111" strokeWidth="3.5" strokeLinejoin="round" />
          <text x="223" y="149" fill="#111" fontFamily="Pretendard, sans-serif" fontWeight="900" fontSize="9">CV</text>
          <text x="252" y="148" fill="#111" fontFamily="Pretendard, sans-serif" fontWeight="900" fontSize="8">PDF</text>
        </g>
      )}
      <g className="filecat-mouth-file" transform="rotate(-3 183 194)">
        <rect x="119" y="149" width="135" height="89" rx="4" fill="#fff" stroke="#111" strokeWidth="6" />
        <path d="M140 177h89M140 192h78M140 207h59" stroke="#111" strokeWidth="5" strokeLinecap="round" />
        <text x="213" y="224" fill="#111" fontFamily="Pretendard, sans-serif" fontWeight="900" fontSize="11">{fileLabel}</text>
      </g>

      {/* The top of the page disappears under the mouth; paws hug both edges. */}
      <path d="M171 147c5 6 11 6 17 0" stroke="#111" strokeWidth="8" strokeLinecap="round" />
      <path d="M171 137c4 3 9 3 13 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M115 166c-14-3-23 5-22 17 1 12 12 17 27 14l8-4-2-21-11-6ZM256 164c14-3 25 5 25 18 0 12-12 18-27 15l-8-4 2-21 8-8Z" fill="#111" />
      {withDocuments && <path d="M292 145c-6-7-17-8-24-2" stroke="#111" strokeWidth="12" strokeLinecap="round" />}

      {isHappy && <path className="filecat-spark" d="M303 54v17m-9-9h18" stroke="#111" strokeWidth="4" strokeLinecap="round" />}
      {variant === 'loading' && <path className="filecat-spark" d="M301 57v16m-8-8h16" stroke="#111" strokeWidth="4" strokeLinecap="round" />}
    </svg>
  );
}
