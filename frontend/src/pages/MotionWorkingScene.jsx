import TypingCharacter from './MotionTypingCharacter';
import { PaperStack } from './MotionMaterials';
import { MONITOR_CORNERS, MONITOR_GLASS, projectiveMatrix } from './motionGeometry';

// The opening used to run fifteen seconds and dragged. Everything in it is derived from
// OPENING, so the shot keeps its rhythm at any length.
const OPENING = 7, STEP = OPENING / 3;
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { const p = clamp(n); return p * p * p * (10 + p * (-15 + 6 * p)); };
const CW = 496, CH = 316;
const SCREEN_FIT = `matrix3d(${projectiveMatrix(CW, CH, MONITOR_CORNERS).join(',')})`;
function Label({ x, y, size = 20, fill = '#5c506c', children, anchor = 'start', weight = 600 }) {
  return <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} fontWeight={weight} letterSpacing="-.2">{children}</text>;
}
export function PhysicalDocument({ x, y, scale = 1, rotation = 0, opacity = 1, kind = 0, label = true }) {
  return <g opacity={opacity} transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
    <path d="M-101-66 113-49 97 81-114 58Z" fill="#a69aaf" opacity=".19" transform="translate(4 9)" />
    <path d="M-101-66 113-49 97 77-114 58Z" fill="#dad4df" stroke="#bfb5ca" />
    {[0, 1, 2, 3].map(i => <path key={i} d={`M-114 ${52 + i * 2} 97 ${71 + i * 2} 113 ${-55 + i * 2}`} stroke="#f5f2f8" strokeWidth="1.1" fill="none" />)}
    <path d="M-101-73 113-55 97 71-114 52Z" fill="url(#clay-white)" stroke="white" />
    <path d="M-80-47 82-33M-82-32 25-22" stroke={['#b4a1cf', '#9998b9', '#ceaec9'][kind]} strokeWidth="5" />
    {kind === 0 ? <><path d="M-85-7 21 3M-87 7 42 19M-89 21 3 30" stroke="#cfc7d9" strokeWidth="3" /><path d="M49 34 52 13 66 14 64 35M70 36 73-3 87-2 83 37" fill="#c5b5da" /></> : kind === 1 ? <><path d="m-77-10-10 5 8 8m24-10 9 8-11 5m-48 2 65 6m-57 5 78 7" stroke="#a89bbd" strokeWidth="3" fill="none" /></> : <><rect x="-76" y="-10" width="38" height="51" rx="5" fill="#d4c3e8" transform="rotate(5)" /><rect x="-20" y="-4" width="37" height="50" rx="5" fill="#dacddf" transform="rotate(5)" /><path d="M34 8 77 12M32 23 62 26" stroke="#b7a6ce" strokeWidth="5" /></>}
    {label && <Label x={-86} y={46} size={8} fill="#a398af">{['팀프로젝트_최종.pdf', 'project-readme.pdf', '공모전_디자인.pdf'][kind]}</Label>}
  </g>;
}

// The point of the opening: the work is fine, it is the trail it leaves that never stops.
// One list, arriving faster and faster, sliding up out of frame as the next one lands.
const TRAIL = [
  '팀프로젝트_기획안.docx', '회의록_1주차.docx', '사용자조사_정리.xlsx', '기획안_수정본.docx', '기획안_최종.docx',
  'campus-project / README.md', 'fix: 로그인 오류 수정', 'feat: 게시판 필터 추가', 'refactor: API 훅 정리',
  'hotfix: 배포 스크립트',
  '공모전_디자인.fig', '공모전_디자인_수정.fig', '공모전_최종.fig', '최종_진짜최종.fig', '최최종_v2.fig',
  '찐최종.fig', '찐찐최종.fig', '최종_최종_최종.fig', '이게_진짜_마지막.fig', '진짜_마지막_수정본.fig',
];
const TRAIL_TOP = 70, TRAIL_BOTTOM = 320, TRAIL_ROW = 34;
function FileTrail({ time }) {
  // Arrivals accelerate — about one a second at first, five a second by the end of the shot.
  const n = Math.min(1, Math.max(0, (time - .25) / (OPENING - .25))) ** 1.7 * TRAIL.length;
  const newest = Math.min(TRAIL.length - 1, Math.floor(n));
  const rows = [];
  for (let i = Math.max(0, newest - 21); i <= newest; i++) {
    // Odd arrivals land on the right, so a row is pushed up only every second file.
    const right = i % 2 === 1;
    const y = TRAIL_BOTTOM - (n - i - 1) / 2 * TRAIL_ROW;
    if (y < TRAIL_TOP - TRAIL_ROW) continue;
    const enter = clamp(n - i);
    // The last stretch is the joke landing, so those rows carry the accent.
    const loud = i >= 13;
    rows.push(<g key={i} opacity={enter * clamp((y - TRAIL_TOP + 4) / 30)} transform={`translate(${(right ? 1126 : 14) + (1 - enter) * (right ? -28 : 28)} ${y})`}>
      <rect width="300" height="31" rx="9" fill={loud ? '#f4eaff' : 'white'} stroke={loud ? '#b48fe0' : '#e0d9ea'} strokeWidth={loud ? 1.6 : 1} filter="url(#clay-small)" />
      <path d="M13 7h9l4 4h5v13H13Z" fill={loud ? '#8b5fc4' : ['#93a2c2', '#7c7389', '#a894c6'][i < 6 ? 0 : i < 18 ? 1 : 2]} />
      <Label x={40} y={21} size={13} fill={loud ? '#5b3894' : '#584e69'} weight={loud ? 750 : 550}>{TRAIL[i]}</Label>
    </g>);
  }
  return <g>{rows}</g>;
}

function TaskLayer({ time, task }) {
  const t = Math.max(0, Math.min(STEP - .3, time - task * STEP));
  const writing = ['01  사용자 조사', '학생 인터뷰에서 반복되는 불편을 찾았습니다.', '02  서비스 기획', '핵심 기능과 사용 흐름을 함께 설계했습니다.', '03  프로토타입 검증', '피드백을 반영해 화면과 동선을 개선했습니다.'];
  const line = Math.min(writing.length - 1, Math.floor(Math.max(0, t - .15) / .28));
  const letters = Math.floor(clamp((t - .15 - line * .28) / .24) * writing[line].length);
  return <>
    <rect width="496" height="316" fill={task === 1 ? '#302c43' : '#faf8fd'} />
      <rect width="496" height="25" fill={task === 1 ? '#464059' : '#e3ddea'} />
      {[0, 1, 2].map(i => <circle key={i} cx={12 + i * 12} cy="12" r="3" fill={['#c6a4ae', '#d5c6a6', '#b6c7b6'][i]} />)}
      <Label x={248} y={17} size={9} fill={task === 1 ? '#dbd3e7' : '#8d829d'} anchor="middle">{['팀프로젝트_기획안.docx', 'campus-project / README.md', '공모전 서비스 · Figma'][task]}</Label>
      {task === 0 && <>
        <rect x="13" y="38" width="92" height="265" fill="#efebf4" /><Label x={25} y={59} size={9}>프로젝트 목차</Label>
        {['문제 정의', '사용자 조사', '서비스 기획', '결과 정리'].map((text, i) => <g key={text}><rect x="19" y={74 + i * 33} width="80" height="23" rx="4" fill={i === Math.min(3, Math.floor(t * 2)) ? '#dcd0ee' : 'none'} /><Label x={26} y={89 + i * 33} size={9}>{text}</Label></g>)}
        <Label x={130} y={68} size={17}>캠퍼스 서비스 개선 프로젝트</Label><Label x={131} y={93} size={9} fill="#a093ad">사용자 조사부터 프로토타입 검증까지</Label>
        {writing.map((text, i) => <text key={text} x="132" y={126 + i * 25} fontSize="11" fontWeight={i % 2 ? 400 : 650} fill={i % 2 ? '#62576f' : '#7954a2'}>
          {i < line ? text : i === line ? text.slice(0, letters) : ''}
          {i === line && <tspan fill="#7954a2" opacity={.6 + Math.cos(t * 7) * .3}>│</tspan>}
        </text>)}
      </>}
      {task === 1 && <>
        <rect x="0" y="25" width="104" height="291" fill="#383247" /><Label x={13} y={48} size={9} fill="#c1b5d0">EXPLORER</Label>{['src', 'components', 'CampusApp.tsx', 'styles.css', 'README.md'].map((text, i) => <Label key={text} x={15} y={76 + i * 25} size={9} fill="#b9adc9">{text}</Label>)}
        {['import { useState } from "react";', '', 'export function CampusApp() {', '  const [ideas, setIdeas] = useState([]);', '  return (', '    <ProjectBoard ideas={ideas} />', '  );', '}', '', '// 사용자 피드백을 반영했습니다.'].map((text, i) => <Label key={i} x={123} y={54 + i * 21} size={10} fill={i % 3 === 0 ? '#c0a3e6' : '#bad5d3'}>{text.slice(0, Math.max(0, Math.floor((t * 118 - i * 22))))}</Label>)}
        <g opacity={ease((t - 1.75) * 6)}><rect x="315" y="250" width="163" height="30" rx="6" fill="#66766f" /><Label x={330} y={269} size={10} fill="#e8f4ed">✓ Changes committed</Label></g>
      </>}
      {task === 2 && <>
        <rect y="25" width="83" height="291" fill="#eae5f0" /><Label x={12} y={51} size={10}>Layers</Label>{['Home', 'Components', 'Research', 'Prototype'].map((text, i) => <Label key={text} x={13} y={82 + i * 26} size={8} fill="#95889f">{text}</Label>)}
        {[0, 1, 2].map(i => <g key={i} transform={`translate(${105 + i * 126} ${50})`}><rect width="107" height="219" rx="13" fill="white" stroke="#d9cede" /><rect x="10" y="15" width="87" height="57" rx="7" fill={['#d7c3eb', '#d2d8ed', '#e2c9d7'][i]} /><Label x={17} y={48} size={13}>{['캠퍼스', '나의 일정', '프로필'][i]}</Label><rect x="11" y="88" width="67" height="6" rx="3" fill="#bba8cb" /><rect x="11" y="104" width="84" height="4" rx="2" fill="#e0d8e8" /><rect x="11" y="142" width="84" height="51" rx="6" fill="#eee8f5" /></g>)}
        <g transform={`translate(${150 + ease((t - .35) / 1.15) * 123} ${148 - Math.sin(ease((t - .35) / 1.15) * Math.PI) * 38})`}><rect x="-25" y="-23" width="82" height="44" fill="#bd9add" fillOpacity=".35" stroke="#9762c6" strokeDasharray="4 3" /><path d="M0 0v24l7-7 9 15 6-4-9-14h13Z" fill="#8c57ba" stroke="white" strokeWidth="1.5" /></g>
      </>}

  </>;
}


function TaskScreen({ time }) {
  return <g transform="scale(.8612440191 .8607863974)" data-monitor="true">
    <g clipPath="url(#motion-screen)">
    <foreignObject width="6688" height="3764" transform="scale(.25)" style={{ overflow: 'visible' }}>
      <div style={{ zoom: 4 }}>
      <div data-monitor-plane="true" style={{ width: CW, height: CH, transformOrigin: '0 0', transform: SCREEN_FIT, overflow: 'hidden' }}>
        <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`} style={{ display: 'block', overflow: 'hidden' }}>
          {[0, 1, 2].map(task => <g key={task} opacity={task === 0 ? 1 : ease((time - task * STEP + .18) / .36)}><TaskLayer time={time} task={task} /></g>)}
        </svg>
      </div>
      </div>
    </foreignObject>
    </g>
  </g>;
}

export default function MotionWorkingScene({ time }) {
  const camera = 1.035 - ease(time / OPENING) * .035;
  return <>
    <defs><clipPath id="motion-screen"><path d={MONITOR_GLASS} /></clipPath></defs>
    <g transform={`translate(720 405) scale(${camera}) translate(-720 -405)`}>
      <TypingCharacter time={time} cycle={STEP} />
      <TaskScreen time={time} />
      <PaperStack x={132} y={577} width={208} start={.3} gap={.62} time={time} />
      <PaperStack x={1248} y={669} width={227} start={.5} gap={.6} time={time} flip />
    </g>
    <FileTrail time={time} />
    {(() => {
      const p = ease((time - .25) / .6), out = ease((time - OPENING + .65) / .5);
      if (p <= 0 || out >= 1) return null;
      return <g opacity={p * (1 - out)} transform={`translate(0 ${(1 - p) * -12})`}>
        {[['열심히 만들수록,', '문서에 남는 나의 노력'], ['커밋은 쌓이고,', 'GitHub에 남는 수많은 수정'], ['최종 다음에, 또 최종.', 'Figma에도 끝없이 늘어나는 파일']].map(([headline, subline], i) => {
          const appear = i === 0 ? 1 : ease((time - i * STEP) / .28);
          const disappear = i === 2 ? 0 : ease((time - (i + 1) * STEP) / .28);
          return <g key={headline} opacity={appear * (1 - disappear)} transform={`translate(0 ${(1 - appear) * 10 - disappear * 10})`}>
            <Label x={720} y={637} size={20} fill="#81718f" anchor="middle" weight={600}>{subline}</Label>
            <Label x={720} y={691} size={46} fill="#4a3f5a" anchor="middle" weight={800}>{headline}</Label>
          </g>;
        })}
      </g>;
    })()}
  </>;
}
