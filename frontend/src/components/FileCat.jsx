const FILE_LABELS = { pdf: 'PDF', document: 'DOC', image: 'IMG', portfolio: 'PPT' };
const POSES = new Set(['curious', 'welcome', 'collecting', 'loading', 'thinking', 'reading', 'offering', 'happy', 'sleepy']);

function Document({ label, transform, className = '', stacked = false }) {
  return (
    <g transform={transform}>
      <g className={className}>
        {stacked && <path d="M8 6h98v87H8Z" fill="white" stroke="#111" strokeWidth="3.5" strokeLinejoin="round" />}
        <path d="M0 0h80l24 22v66H0Z" fill="white" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
        <path d="M80 1v22h23M17 38h65M17 51h54M17 64h33" stroke="#111" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="69" y="78" fill="#111" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10">{label}</text>
      </g>
    </g>
  );
}

// Each pose changes the eyes, paws and silhouette as well as its movement.
// A carrying mouth is a single lip on the paper edge, with no extra smile above it.
export default function FileCat({ variant = 'curious', file = 'pdf', className = '', title = '', withDocuments = false }) {
  const pose = POSES.has(variant) ? variant : 'curious';
  const label = FILE_LABELS[file] || String(file).slice(0, 4).toUpperCase();
  const happy = pose === 'happy';
  const sleepy = pose === 'sleepy';
  const thinking = pose === 'thinking';
  const reading = pose === 'reading';
  const offering = pose === 'offering';
  const collecting = pose === 'collecting' || pose === 'loading';
  const waving = pose === 'welcome';
  const biting = !thinking && !reading && !offering && !sleepy;
  const paperTransform = offering ? 'translate(111 154) rotate(-12 52 44)'
    : reading ? 'translate(81 150) rotate(7 52 44)'
    : thinking ? 'translate(83 158) rotate(-7 52 44)'
    : sleepy ? 'translate(86 163) rotate(5 52 44)' : 'translate(83 137)';

  return (
    <svg viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={`filecat filecat--${pose} ${className}`.trim()}
      role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true}>
      <ellipse className="filecat-shadow" cx="143" cy="260" rx="76" ry="6" fill="#e6e6e0" />
      {(collecting || (withDocuments && !thinking && !reading && !sleepy)) && <g className="filecat-loose-files" stroke="#111" strokeWidth="2.5" strokeLinejoin="round">
        <g transform="rotate(-17 34 152)"><g className="filecat-loose-file filecat-loose-file--left">
          <path d="M17 129h25l10 10v35H17Z" fill="white" /><path d="M42 129v10h10M24 149h19M24 158h13" />
        </g></g>
        <g transform="rotate(13 244 69)"><g className="filecat-loose-file filecat-loose-file--right">
          <path d="M227 46h25l10 10v36h-35Z" fill="white" /><path d="M252 46v10h10" />
          <path d="m233 83 7-10 7 6 4-4 6 8Z" fill="#e6e6e0" /><circle cx="238" cy="63" r="2" fill="#111" stroke="none" />
        </g></g>
      </g>}
      <g className="filecat-companion">
        <path className="filecat-tail" d={sleepy ? 'M191 201c33-2 49 19 28 33-10 7-25 4-36-2l-3-17Z' : happy ? 'M192 189c31 4 37-17 32-33-3-12 8-17 14-6 15 33-6 65-42 58Z' : 'M190 180c25 22 45 9 47-6 2-13-8-18-16-7-6 8-16 5-22-3Z'} fill="#111" />
        <path className="filecat-foot filecat-foot--left" d="M94 218h31l-4 28c-3 18-28 17-28-1Z" fill="#111" />
        <path className="filecat-foot filecat-foot--right" d="M154 218h32l-1 27c-1 18-26 19-29 1Z" fill="#111" />
        <path d="M79 118c-15 23-15 66 0 90 12 22 29 28 61 28 32 0 51-7 63-28 15-26 13-66-2-90Z" fill="#111" />
        <g transform={thinking ? 'rotate(-9 135 130)' : reading ? 'rotate(5 135 130)' : undefined}>
          <g className="filecat-head">
            <path d="M79 96c-5-21-10-53 3-57 11-4 24 12 34 22 15-5 31-5 46 0 11-12 24-27 34-21 10 7 7 38 3 56 12 15 16 32 10 46-9 21-33 25-73 25-39 0-64-5-69-27-4-16 2-31 12-44Z" fill="#111" />
            {happy ? <g stroke="white" strokeWidth="5.5" strokeLinecap="round"><path d="M97 103q13-21 26 0M145 103q13-21 26 0" /></g>
              : sleepy ? <g stroke="white" strokeWidth="4.5" strokeLinecap="round"><path d="M96 101q12 12 25 0M146 101q12 12 25 0" /></g>
              : <g className="filecat-eyes">
                <ellipse cx="111" cy="97" rx="18" ry={thinking ? 20 : 23} fill="white" /><ellipse cx="157" cy="97" rx="18" ry="23" fill="white" />
                <g className="filecat-pupils">
                  <ellipse cx={thinking ? 107 : collecting ? 105 : 114} cy={reading ? 106 : thinking ? 91 : 99} rx="6.5" ry="10" fill="#111" />
                  <ellipse cx={thinking ? 153 : collecting ? 151 : 160} cy={reading ? 106 : thinking ? 91 : 99} rx="6.5" ry="10" fill="#111" />
                </g>
                {(waving || offering) && <g fill="white"><circle cx="112" cy="95" r="2.5" /><circle cx="158" cy="95" r="2.5" /></g>}
              </g>}
            <ellipse cx="134" cy="124" rx="3.2" ry="2.2" fill="white" />
            {!biting && <path d={thinking ? 'M132 135q5-4 10 0' : sleepy ? 'M129 133q5 5 10 0' : 'M125 131q4 7 9 1 5 6 9-1'} stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />}
          </g>
        </g>
        {/* Raised arms stay behind the carried paper. */}
        {(happy || waving) && <g className="filecat-wave" fill="#111">
          <path d="M192 157c14-5 17-16 15-29-2-11 4-17 11-14 6-8 14-3 13 4 9-2 14 5 9 12-3 19-15 38-34 43Z" />
          <path d="m219 128 3-4m4 10 3-3" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </g>}
        {happy && <g className="filecat-cheer" fill="#111"><path d="M81 158c-17-7-22-21-24-32-2-12-13-14-17-5-8-2-13 4-9 12 3 20 20 38 44 42Z" /><path d="m43 136 4 2m4-8 3 3" stroke="white" strokeWidth="2" strokeLinecap="round" /></g>}
        {collecting && <path className="filecat-reach" d="M84 155c-13 4-23 15-34 18-12-2-19 4-16 13 4 11 15 12 25 8 16-7 27-14 34-24Z" fill="#111" />}
        <Document label={label} transform={paperTransform} stacked={withDocuments || collecting || sleepy} />
        {biting && <path className="filecat-bite" d="M128 136q6 9 12 0" stroke="#111" strokeWidth="5" strokeLinecap="round" />}
        {thinking ? <>
          <path d="M81 175c-16-4-21 13-8 22l14 5c11 2 18-11 9-17Z" fill="#111" />
          <path className="filecat-ponder-paw" d="M190 186c18-12 24-31 19-48-3-12-13-13-19-5-8-4-16 4-11 12l7 12-9 18Z" fill="#111" stroke="white" strokeWidth="1.5" />
        </> : reading || sleepy ? <g className="filecat-hug" fill="#111"><path d="M79 174c-19 0-21 16-6 24l27 12c11 5 20-9 9-17ZM194 179c17-4 26 11 12 21l-25 11c-13 6-21-9-10-17Z" /></g>
          : offering ? <g className="filecat-offer" fill="#111"><path d="M83 177c-10 8-4 23 13 26l37 6c15 2 17-14 3-19l-33-12ZM201 166c17-2 26 9 20 20-5 8-20 11-28 6-10-8-3-20 8-26Z" /></g>
          : <g fill="#111">{!happy && !collecting && <path d="M81 161c-17-5-24 12-9 22l13 6c11 3 19-10 10-18Z" />}{!happy && !waving && <path d="M190 165c-10-11-25-6-21 6 4 10 22 16 30 9 7-6-2-12-9-15Z" />}</g>}
      </g>
      {happy && <g className="filecat-spark" stroke="#111" strokeWidth="3" strokeLinecap="round"><path d="M42 73v14m-7-7h14M230 218v12m-6-6h12" /></g>}
      {thinking && <g className="filecat-thought" fill="#fff" stroke="#111" strokeWidth="2.5"><circle cx="223" cy="44" r="11" /><circle cx="207" cy="65" r="5" /></g>}
      {reading && <path className="filecat-read-lines" d="m218 127 8-5m-7 16h10" stroke="#111" strokeWidth="3" strokeLinecap="round" />}
      {sleepy && <path className="filecat-doze" d="M225 73h12l-12 13h12m5-37h9l-9 10h9" stroke="#111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
