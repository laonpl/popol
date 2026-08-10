/**
 * ServiceDeck — 사이트 안에서 보는 서비스 소개서 (슬라이드형).
 *
 * 설계 메모
 * - 슬라이드는 1280×720(16:9) 고정 캔버스에 그리고, 화면 크기에 맞춰 transform: scale 로만 줄인다.
 *   이렇게 해야 화면에 보이는 것과 내려받은 PDF가 정확히 같아진다. (반응형 재배치를 쓰면 어긋난다)
 * - PDF는 브라우저 인쇄 엔진(window.print)으로 내보낸다. 이미지로 굽지 않으므로
 *   한글이 깨지지 않고 텍스트를 복사·검색할 수 있다. 라이브러리 의존도 없다.
 * - 톤은 사이트 디자인 토큰(primary 네이비 #002F6C / bluewood / surface)을 따른다.
 *   표지와 마무리는 의도적으로 절제 — 장식보다 문장이 먼저 읽히게 한다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
// 아이콘은 조작 가능한 컨트롤(이동·저장·홈)에만 쓴다.
// 슬라이드 본문의 장식용 픽토그램은 쓰지 않고, 필요한 곳엔 실제 브랜드 자산(public/brand-icons)을 넣는다.
import { ArrowLeft, ArrowRight, Download, Loader2, Home } from 'lucide-react';
import toast from 'react-hot-toast';
// 아래 셋은 실제 서비스가 쓰는 것과 같은 컴포넌트·데이터다.
// 스크린샷을 붙이면 화면이 바뀔 때마다 소개서가 낡으므로, 실물을 그대로 렌더한다.
import JobCoreShowcase from '../components/portfolio/JobCoreShowcase';
import WebPortfolioRenderer from './portfolio/WebPortfolioTemplates';
import { PORTFOLIO_EXAMPLES } from './portfolio/portfolioExampleData';
import { SAMPLE_EXPERIENCES } from './sampleOutputData';

const W = 1280;
const H = 720;

/* 인쇄 규칙.
   [주의] index.css 에 전역 `@media print { @page { size: A4; margin: 12mm 14mm } }` 이 있다.
   같은 출처에서는 나중에 선언된 @page 가 이기므로, 이 스타일은 반드시 런타임에
   <head> 끝으로 주입해야 A4 세로가 아니라 16:9 가로로 나온다. */
const PRINT_CSS = `
/* 화면에서는 인쇄본을 감춘다. 인쇄 시에는 브라우저가 레이아웃을 다시 계산하므로
   display:none 이어도 지면에는 정상적으로 그려진다(html2canvas 와 달리 문제없음). */
.fp-deck-print { display: none; }

/* 단, display:none 인 동안에는 브라우저가 레이아웃을 계산하지 않아
   scrollHeight · ResizeObserver 가 0 을 돌려준다. 그러면 SplitPage(09번 슬라이드)가
   페이지 높이를 재지 못해 두 칸 모두 윗부분만 그려 "똑같은 화면 2개"가 찍힌다.
   그래서 인쇄 직전에만 흐름 밖으로 빼 둔 채 레이아웃을 살린다 — 화면에는 보이지 않는다. */
body.fp-deck-measuring .fp-deck-print {
  display: block;
  position: fixed;
  top: 0;
  left: -20000px;
  visibility: hidden;
  pointer-events: none;
}

@media print {
  /* 1280×720 CSS px 를 실제 용지 크기로 환산 (96dpi 기준: 1px = 0.2646mm).
     px 단위 @page 는 브라우저마다 해석이 달라 A4 로 떨어지는 경우가 있어 mm 로 못박는다. */
  @page { size: 338.67mm 190.5mm; margin: 0; }

  html, body {
    background: #fff !important;
    margin: 0 !important;
    padding: 0 !important;
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
  }

  /* 화면 UI 전체(#root: 앱 셸 + 토스트)를 지면에서 통째로 제외한다.
     인쇄본은 포털로 body 직속에 있으므로 함께 사라지지 않는다. */
  body.fp-deck-printing #root { display: none !important; }

  /* 색·배경이 그대로 찍히게 (네이비 슬라이드가 흰색으로 날아가는 것 방지) */
  body.fp-deck-printing * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* 인쇄용 슬라이드만 노출 — 한 장에 한 슬라이드 */
  body.fp-deck-printing .fp-deck-print {
    display: block !important;
    position: static !important;
    visibility: visible !important;
    top: auto !important;
    left: auto !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  body.fp-deck-printing .fp-deck-print > * {
    break-after: page;
    page-break-after: always;
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden;
    /* 반올림 오차로 1px 이 다음 장으로 넘어가 빈 페이지가 생기는 것을 막는다 */
    height: ${H}px !important;
    max-height: ${H}px !important;
  }
  body.fp-deck-printing .fp-deck-print > *:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  /* 인쇄 중에는 애니메이션·트랜지션을 끈다 (중간 상태가 찍히는 것 방지) */
  body.fp-deck-printing *,
  body.fp-deck-printing *::before,
  body.fp-deck-printing *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;

/* ── 슬라이드 공통 뼈대 ───────────────────────────────── */

function Slide({ children, dark = false, className = '' }) {
  return (
    <div
      className={`relative overflow-hidden ${dark ? 'bg-primary-500 text-white' : 'bg-white text-bluewood-900'} ${className}`}
      style={{ width: W, height: H }}
    >
      {children}
    </div>
  );
}

/* 좌상단 섹션 라벨 + 제목 — 모든 내용 슬라이드가 공유하는 헤더.
   subMax: 부제의 최대 폭(px). 기본값은 읽기 좋은 길이(860)이고,
   한 줄로 떨어뜨려야 하는 슬라이드만 본문 폭 전체로 넓힌다. */
function Head({ eyebrow, title, sub, subMax = 860, dark = false }) {
  return (
    <div className="mb-9">
      <p className={`font-mono text-[14px] font-black uppercase tracking-[0.22em] ${dark ? 'text-primary-200' : 'text-primary-400'}`}>
        {eyebrow}
      </p>
      <h2 className={`mt-3 text-[46px] font-extrabold leading-[1.16] tracking-[-0.03em] ${dark ? 'text-white' : 'text-bluewood-900'}`}
        style={{ wordBreak: 'keep-all' }}>
        {title}
      </h2>
      {sub && (
        <p className={`mt-3.5 text-[17px] leading-relaxed ${dark ? 'text-primary-100' : 'text-bluewood-500'}`}
          style={{ wordBreak: 'keep-all', maxWidth: subMax }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* 슬라이드 하단 공통 푸터 (번호 · 각주) */
function Foot({ n, note, dark = false }) {
  return (
    <div className={`absolute inset-x-[72px] bottom-[38px] flex items-end justify-between gap-6 border-t pt-4
      ${dark ? 'border-white/15' : 'border-surface-200'}`}>
      <p className={`max-w-[900px] text-[12.5px] leading-relaxed ${dark ? 'text-primary-200' : 'text-bluewood-400'}`}>
        {note}
      </p>
      <span className={`text-[12px] font-bold tabular-nums ${dark ? 'text-primary-200' : 'text-bluewood-300'}`}>
        {String(n).padStart(2, '0')}
      </span>
    </div>
  );
}

const Body = ({ children }) => (
  <div className="absolute inset-x-[72px] top-[76px]">{children}</div>
);

/* ── 개별 슬라이드 ────────────────────────────────────── */

/* 01 표지 — 과하지 않게. 로고·한 문장·발행 정보만. */
function Cover() {
  return (
    <Slide>
      {/* 아주 옅은 네이비 글로우 하나만 둔다 */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(circle at 82% 22%, rgba(0,47,108,0.07) 0%, transparent 46%)' }} />
      <div aria-hidden className="absolute left-0 top-0 h-[5px] w-full bg-primary-500" />

      <div className="absolute inset-x-[72px] top-[236px]">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-9 w-auto" />
          <span className="text-[19px] font-extrabold tracking-tight text-primary-500">FitPoly</span>
        </div>

        <h1 className="mt-8 text-[54px] font-extrabold leading-[1.18] tracking-[-0.03em] text-bluewood-900"
          style={{ wordBreak: 'keep-all' }}>
          흩어진 경험을,<br />합격하는 포트폴리오로.
        </h1>

        <p className="mt-6 max-w-[640px] text-[17px] leading-relaxed text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
          카톡·노션·깃허브에 흩어진 기록을 모아, 지원하는 직군의 언어로 다시 씁니다.
        </p>
      </div>

      <div className="absolute inset-x-[72px] bottom-[52px] flex items-end justify-between border-t border-surface-200 pt-5">
        <p className="text-[13px] font-semibold text-bluewood-400">서비스 소개서</p>
        <p className="text-[13px] text-bluewood-300">fitpoly.kr</p>
      </div>
    </Slide>
  );
}

/* 02 문제 — IR 자료의 다크 Problem 페이지 구조를 따른다.
   카드마다 숫자만 두지 않고 그 숫자를 설명하는 미니 시각화를 함께 넣는다. */

/* 미니 ① 정리 성공/실패 막대 */
function VizSplit() {
  return (
    <div className="flex h-[104px] items-end gap-6 px-1">
      {[{ v: 19.8, l: '정리 성공', on: false }, { v: 80.2, l: '정리 실패', on: true }].map(b => (
        <div key={b.l} className="flex flex-1 flex-col items-center">
          <span className={`mb-1.5 text-[15px] font-extrabold ${b.on ? 'text-white' : 'text-primary-200/70'}`}>{b.v}%</span>
          <div
            className={`w-full rounded-t ${b.on ? 'bg-white' : 'bg-white/25'}`}
            style={{ height: `${b.v * 0.78}px` }}
          />
          <span className="mt-1.5 text-[11px] text-primary-200">{b.l}</span>
        </div>
      ))}
    </div>
  );
}

/* 미니 ② 흩어진 채널 칩 */
function VizChannels() {
  return (
    <div className="flex h-[104px] flex-col justify-center">
      <div className="flex flex-wrap gap-1.5">
        {['카톡', '노션', 'Drive', 'GitHub', '메모'].map(c => (
          <span key={c} className="rounded-md bg-white/90 px-2.5 py-1.5 text-[12px] font-bold text-primary-700">{c}</span>
        ))}
        <span className="rounded-md bg-white/20 px-2.5 py-1.5 text-[12px] font-bold text-primary-100">+0.4</span>
      </div>
      <p className="mt-3 text-[11.5px] leading-snug text-primary-200">
        1인당 평균 5.4개 채널에 나뉘어 저장
      </p>
    </div>
  );
}

/* 미니 ③ 하루 8시간 중 3.2시간 */
function VizWorkday() {
  return (
    <div className="flex h-[104px] flex-col justify-center">
      <div className="flex gap-1">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`h-6 flex-1 rounded-sm ${i < 3 ? 'bg-white' : i === 3 ? 'bg-white/50' : 'bg-white/15'}`} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-primary-200">
        <span>0h</span><span>8h · 하루 작업시간</span>
      </div>
      <p className="mt-2.5 text-[11.5px] leading-snug text-primary-200">
        지원 10곳이면 <b className="text-white">32시간</b>이 그대로 반복
      </p>
    </div>
  );
}

const PROBLEMS = [
  { chip: '의미 있는 경험 정리', stat: '80.2%', viz: VizSplit, label: '10명 중 8명이 정리에 실패', desc: '기록해 둔 사람 중에서도 문제·행동·결과 구조로 다시 쓸 수 있게 정리한 비율은 19.8%뿐입니다.' },
  { chip: '경험이 흩어진 채널', stat: '5.4개', viz: VizChannels, label: '기록이 평균 5.4개 채널에 분산', desc: '카톡·노션·드라이브·깃허브·메모로 흩어져, 필요한 순간에 다시 찾지 못합니다.' },
  { chip: '경험 1건 정리 시간', stat: '3.2시간', viz: VizWorkday, label: '지원 10곳이면 32시간 소요', desc: '공고마다 백지에서 다시 쓰기 때문에 시간이 그대로 반복됩니다.' },
];

function SlideProblem() {
  return (
    <Slide dark>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{ backgroundImage: 'radial-gradient(circle at 88% 10%, #ffffff 0%, transparent 40%)' }} />
      <Body>
        <Head
          dark
          eyebrow="Problem"
          title="기록은 남는데, 쓸 수 있게 정리되지 않습니다"
          sub="취준생 설문에서 병목은 세 곳에 있었습니다."
        />
        <div className="grid grid-cols-3 gap-5">
          {PROBLEMS.map(({ chip, stat, viz: Viz, label, desc }) => (
            <div key={stat} className="rounded-2xl border border-white/12 bg-white/[0.06] px-6 py-6">
              <span className="inline-block rounded-md bg-white/12 px-2.5 py-1 text-[11.5px] font-bold text-primary-100">
                {chip}
              </span>
              <p className="mt-3 text-[42px] font-extrabold leading-none tracking-[-0.02em] text-white">{stat}</p>
              <div className="mt-4"><Viz /></div>
              <p className="mt-4 border-t border-white/12 pt-3.5 text-[15px] font-extrabold text-white" style={{ wordBreak: 'keep-all' }}>
                {label}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-primary-200" style={{ wordBreak: 'keep-all' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </Body>
      <Foot dark n={2} note="출처: 자사 취준생 인터뷰·설문(2026, n=23) · 진학사 캐치 취준생 1,025명(2026.7)" />
    </Slide>
  );
}

/* 03 문제 정의 — 현장 설문·인터뷰 (IR 3페이지 구조) */
function SurveyBar({ pairs, caption }) {
  return (
    <div>
      <div className="flex h-[150px] items-end justify-center gap-7">
        {pairs.map(([v, l, on]) => (
          <div key={l} className="flex w-[86px] flex-col items-center">
            <span className={`mb-1.5 text-[22px] font-extrabold ${on ? 'text-primary-500' : 'text-bluewood-300'}`}>{v}%</span>
            <div
              className={`w-full rounded-t-lg ${on ? 'bg-primary-500' : 'bg-surface-200'}`}
              style={{ height: `${v * 1.05}px` }}
            />
            <span className="mt-2 text-center text-[11.5px] font-semibold leading-snug text-bluewood-500">{l}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11.5px] font-bold text-bluewood-400">{caption}</p>
    </div>
  );
}

function SlideInterview() {
  return (
    <Slide>
      <Body>
        <Head
          eyebrow="Interview"
          title="기록은 남겼지만, 쓸 수 있게 정리하지 못합니다"
          sub="취준생 37명 현장 설문과 심층 인터뷰로 확인한 1차 자료입니다."
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-9">
          {/* 좌: 인용 + 가설 */}
          <div>
            <div className="space-y-3">
              {[
                ['“뭘 썼는지 기억이 안 나요”', '카톡·노션·드라이브에 흩어져 다시 못 찾아요'],
                ['“공고마다 처음부터 다시 써요”', '한 번 정리한 경험을 다음 지원에 재사용 못해요'],
              ].map(([q, a], i) => (
                <div key={q} className={`relative rounded-2xl bg-surface-100 px-5 py-4 ${i === 1 ? 'ml-10' : ''}`}>
                  <p className="text-[16px] font-extrabold text-bluewood-900">{q}</p>
                  <p className="mt-1 text-[13px] text-bluewood-500">{a}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-start gap-3.5 rounded-2xl border-l-[3px] border-primary-500 bg-primary-50/40 px-5 py-4">
              <span className="mt-0.5 flex-shrink-0 rounded-md bg-primary-500 px-2.5 py-1 text-[11.5px] font-black text-white">
                초기 가설
              </span>
              <p className="text-[14.5px] font-semibold leading-relaxed text-bluewood-800" style={{ wordBreak: 'keep-all' }}>
                취준생은 <b className="text-primary-600">기록은 남기지만</b> 직군의 언어로 정리·수치화하지 못해
                매번 <b className="text-primary-600">백지에서 다시 시작</b>한다.
              </p>
            </div>
          </div>

          {/* 우: 설문 두 개 */}
          <div className="flex gap-8 rounded-2xl border border-surface-200 px-8 py-5">
            <SurveyBar
              pairs={[[62, '경험을\n기록한다', true], [38, '기록\n안 한다', false]]}
              caption="현장 설문 · 취준생 37명"
            />
            <div className="w-px bg-surface-200" />
            <SurveyBar
              pairs={[[80, '단순 기록\n에서 멈춤', true], [20, '의미있게\n정리함', false]]}
              caption="기록한 23명 중 정리 현황"
            />
          </div>
        </div>
      </Body>
      <Foot n={3} note="→ 기록한 사람의 80%는 쓸 수 있는 형태로 정리하지 못합니다. · 출처: 자사 인터뷰·설문(2026, n=23) · 현장 설문 37명" />
    </Slide>
  );
}

/* 03 해결 흐름 —
   "뭐하는 사이트인가"에 먼저 답한 뒤 4단계를 보여준다.
   아이콘은 장식용 픽토그램 대신, 실제로 받는 자료의 브랜드 로고를 쓴다.
   (public/brand-icons — 서비스가 이미 쓰고 있는 자산) */
// onDark: 아이콘 자체가 흰색이라 밝은 배경에서 안 보이는 것 (github.svg는 fill="#ffffff")
const SOURCE_ICONS = [
  { name: '카카오톡', src: '/brand-icons/kakaotalk.svg' },
  { name: 'Notion', src: '/brand-icons/notion.svg' },
  { name: 'GitHub', src: '/brand-icons/github.svg', onDark: true },
  { name: 'Google Drive', src: '/brand-icons/google-drive.svg' },
  { name: 'PDF', src: '/brand-icons/pdf.svg' },
  { name: 'Figma', src: '/brand-icons/figma.svg' },
];

const STEPS = [
  { tag: 'COLLECT', title: '모으기', lead: '형식 그대로 넣습니다', desc: '카톡 대화, 노션 회고, 깃허브 커밋, PDF 발표자료. 정리해서 넣을 필요가 없습니다.' },
  { tag: 'EXTRACT', title: '뽑기', lead: '판단을 복원합니다', desc: '문제를 어떻게 봤고 무엇을 버렸는지까지, 직군 기준으로 추출합니다.' },
  { tag: 'MATCH', title: '맞추기', lead: '지원처에 맞춥니다', desc: '채용공고 링크 하나면 그 회사가 찾는 역량 순서로 다시 배열됩니다.' },
  { tag: 'DELIVER', title: '완성', lead: '바로 제출합니다', desc: 'PDF · 공개 링크 · 이력서로 내보내고, 다음 지원에 그대로 재사용합니다.' },
];

function SlideFlow() {
  return (
    <Slide>
      <Body>
        <p className="text-[14px] font-black uppercase tracking-[0.22em] text-primary-400">What FitPoly does</p>

        {/* 한 줄 정의를 크게 — 이 슬라이드만 봐도 무슨 서비스인지 알게 한다 */}
        <h2 className="mt-3 text-[46px] font-extrabold leading-[1.16] tracking-[-0.03em] text-bluewood-900"
          style={{ wordBreak: 'keep-all' }}>
          정리되지 않은 기록을 넣으면,<br />
          <span className="text-primary-500">지원처에 맞는 산출물</span>이 나옵니다.
        </h2>

        {/* 전/후 대비 */}
        <div className="mt-7 flex items-stretch gap-5">
          <div className="flex-1 rounded-2xl border border-surface-200 bg-surface-50/70 px-6 py-4">
            <p className="text-[13px] font-bold text-bluewood-400">지금까지</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[34px] font-extrabold leading-none tabular-nums text-bluewood-700">3.2시간</span>
              <span className="text-[15px] font-semibold text-bluewood-400">/ 경험 1건 · 공고마다 백지에서</span>
            </p>
          </div>
          <div className="flex items-center px-1">
            <span className="text-[26px] font-black text-primary-300">→</span>
          </div>
          <div className="flex-1 rounded-2xl border-2 border-primary-400 bg-primary-50/50 px-6 py-4">
            <p className="text-[13px] font-bold text-primary-500">FitPoly</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[34px] font-extrabold leading-none tabular-nums text-primary-600">12분</span>
              <span className="text-[15px] font-semibold text-bluewood-500">/ 산출물 1개 · 두 번째부터는 재사용</span>
            </p>
          </div>
        </div>

        {/* 4단계 */}
        <div className="relative mt-8">
          <div aria-hidden className="absolute inset-x-0 top-[13px] h-px bg-surface-200" />
          <div className="relative grid grid-cols-4 gap-6">
            {STEPS.map(({ tag, title, lead, desc }, i) => (
              <div key={tag}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-primary-500 font-mono text-[13px] font-black text-white">
                    {i + 1}
                  </span>
                  <span className="font-mono text-[12px] font-black uppercase tracking-[0.14em] text-primary-400">{tag}</span>
                </div>
                <p className="mt-3.5 text-[26px] font-extrabold leading-none tracking-[-0.02em] text-bluewood-900">{title}</p>
                <p className="mt-2 text-[15px] font-bold text-primary-600">{lead}</p>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{desc}</p>

                {/* 1단계에만 실제 입력 자료 로고를 붙인다 */}
                {i === 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {SOURCE_ICONS.map(({ name, src, onDark }) => (
                      <span
                        key={name}
                        title={name}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                          onDark ? 'border-bluewood-900 bg-bluewood-900' : 'border-surface-200 bg-white'
                        }`}
                      >
                        <img src={src} alt={name} className="h-[18px] w-[18px] object-contain" />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Body>
      <Foot n={4} note="평균 완성 12분은 자사 서비스 내부 지표입니다 · 정리한 경험은 계정에 남아 다음 지원에 다시 쓰입니다." />
    </Slide>
  );
}

/* 04 차별점 */
const RIVALS = [
  { name: '포트폴리오 전시 서비스', gives: '시각 작업물 전시', lacks: '결과물이 이미 있어야 함' },
  { name: '노코드 웹 빌더', gives: '노션 → 웹사이트', lacks: '포장만, 내용은 직접' },
  { name: '이력서 기반 생성', gives: '이력서 → 맞춤 문서', lacks: '정리된 이력서가 출발점' },
  { name: '범용 생성형 AI', gives: '프롬프트로 문장 초안', lacks: '매번 붙여넣기부터, 축적 없음' },
];

function SlideDifference() {
  return (
    <Slide>
      <Body>
        <Head
          eyebrow="What's different"
          title="우리는 ‘정리 이전 단계’를 맡습니다"
          sub="다른 도구는 이미 정리된 것을 예쁘게 바꿉니다. 문제는 그 앞에 있습니다."
        />
        {/* 한 문장으로 차이를 못박고, 그 아래에서 근거를 보인다 */}
        <p className="mb-5 text-[28px] font-extrabold leading-[1.32] tracking-[-0.02em] text-bluewood-900"
          style={{ wordBreak: 'keep-all' }}>
          다른 도구는 <span className="bg-surface-200 px-1.5 py-0.5 text-bluewood-500">이미 정리된 것</span>을 바꿉니다.
          {' '}우리는 <span className="bg-primary-500 px-1.5 py-0.5 text-white">정리 자체</span>를 합니다.
        </p>

        {/* items-start — items-stretch 를 쓰면 가운데 h-full 구분선이 푸터 영역까지 늘어나 선이 겹쳤다 */}
        <div className="grid grid-cols-[1fr_auto_1.05fr] items-start gap-7">
          <div className="space-y-2">
            {RIVALS.map(r => (
              <div key={r.name} className="rounded-xl border border-surface-200 bg-surface-50/60 px-4 py-2.5">
                <p className="text-[14.5px] font-bold text-bluewood-600">{r.name}</p>
                <p className="mt-0.5 text-[13px] leading-snug">
                  <span className="text-bluewood-400">{r.gives}</span>
                  <span className="mx-1.5 text-surface-300">|</span>
                  <span className="font-bold text-rose-500">{r.lacks}</span>
                </p>
              </div>
            ))}
            <p className="pt-1 text-[13px] font-bold text-bluewood-400">
              공통점 — <span className="text-rose-500">경험 정리는 끝까지 사용자 몫</span>
            </p>
          </div>

          <div className="flex justify-center pt-2"><div className="w-px bg-surface-200" style={{ height: 250 }} /></div>

          <div className="rounded-2xl border-2 border-primary-500 bg-primary-50/40 px-7 py-5">
            <p className="font-mono text-[12px] font-black uppercase tracking-[0.18em] text-primary-500">FitPoly</p>
            <p className="mt-2.5 text-[25px] font-extrabold leading-[1.25] tracking-[-0.02em] text-bluewood-900"
              style={{ wordBreak: 'keep-all' }}>
              원본 수집 <span className="text-primary-400">→</span> 직군별 구조화 <span className="text-primary-400">→</span> 산출물
            </p>
            <div className="mt-4 space-y-2.5">
              {[
                ['흩어진 원천 기록', '을 그대로 입력받습니다'],
                ['직군마다 다른 기준', '으로 경험을 다시 씁니다'],
                ['한 번 정리한 경험', '을 다음 지원에 재사용합니다'],
              ].map(([strong, rest]) => (
                <p key={strong} className="text-[15.5px] leading-relaxed text-bluewood-600" style={{ wordBreak: 'keep-all' }}>
                  <span className="font-extrabold text-primary-600">{strong}</span>{rest}
                </p>
              ))}
            </div>
          </div>
        </div>
      </Body>
      <Foot n={5} note="각 서비스 공개 정보 기준(2026.07)" />
    </Slide>
  );
}

/* 05 직군별 재구성 — 제품의 핵심 주장 */
const SLOT_ROWS = [
  ['관찰', '문제가 실재했음을 무엇으로 보이나', '재현 가능한 증상', '사용자 근거', '사용자 맥락·발화'],
  ['판단', '그 문제를 어떻게 해석했나', '원인 가설을 버린 근거', '목표와 범위 밖 항목', '문제 해석'],
  ['대안', '무엇을 고르고 무엇을 버렸나', '기술 선택 trade-off', '대안과 trade-off', '시안 비교'],
  ['검증', '결과를 무엇으로 확인했나', '테스트·모니터링 결과', '성공·반증 기준', '과업 기반 테스트'],
  ['잔여', '남은 것과 달라진 것', '남은 기술 부채', '출시 후 판단 변화', '반복 전후·접근성'],
];

function SlideJobs() {
  return (
    <Slide>
      <Body>
        {/* 이 부제는 한 줄로 둔다 — 기본 폭(860px)에서는 마지막 “다릅니다.”만 다음 줄로 넘어가 어색하다 */}
        <Head
          eyebrow="Job-specific"
          title="같은 경험도 직군마다 다르게 읽힙니다"
          subMax={W - 72 * 2}
          sub="24개 직군 각각에 대해 ‘무엇을 경험으로 인정할지’를 따로 정의했습니다. 심사자가 확인하는 5단계는 같고, 채우는 언어만 다릅니다."
        />
        <div className="overflow-hidden rounded-2xl border border-surface-200">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-primary-500 text-white">
                <th className="w-[92px] px-4 py-3 text-[13px] font-extrabold">단계</th>
                <th className="px-4 py-3 text-[13px] font-extrabold">확인하는 것</th>
                <th className="px-4 py-3 text-[13px] font-extrabold">개발</th>
                <th className="px-4 py-3 text-[13px] font-extrabold">기획·PM</th>
                <th className="px-4 py-3 text-[13px] font-extrabold">디자인</th>
              </tr>
            </thead>
            <tbody>
              {SLOT_ROWS.map(([slot, ask, a, b, c], i) => (
                <tr key={slot} className={i % 2 ? 'bg-surface-50/60' : 'bg-white'}>
                  <td className="px-4 py-[11px] text-[13.5px] font-extrabold text-primary-600">{slot}</td>
                  <td className="px-4 py-[11px] text-[13px] text-bluewood-400">{ask}</td>
                  <td className="px-4 py-[11px] text-[13.5px] font-medium text-bluewood-700">{a}</td>
                  <td className="px-4 py-[11px] text-[13.5px] font-medium text-bluewood-700">{b}</td>
                  <td className="px-4 py-[11px] text-[13.5px] font-medium text-bluewood-700">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Body>
      <Foot n={6} note="표에는 3개 직군만 예시로 실었습니다. 실제로는 개발·AI/ML·데이터·인프라·보안·QA·PM·디자인·마케팅·인사·영업·재무·연구·정책 등 24개 직군을 지원합니다." />
    </Slide>
  );
}

/* 06 근거 — 네이비 슬라이드 하나로 리듬을 준다 */
const STANDARDS = [
  ['개발 · 인프라', 'DORA'],
  ['AI · ML', 'Google Production ML'],
  ['QA', 'ISTQB'],
  ['보안', 'OWASP ASVS'],
  ['기획 · PM', 'Atlassian PRD'],
  ['프로젝트', 'PMI'],
  ['디자인', 'Nielsen Norman Group'],
  ['하드웨어', 'INCOSE'],
  ['인사', 'SHRM BASK'],
  ['운영 · 품질', 'ASQ DMAIC · SCOR'],
  ['연구', 'NISO CRediT'],
  ['정책 · 의료', 'OECD · WHO'],
];

function SlideEvidence() {
  return (
    <Slide dark>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{ backgroundImage: 'radial-gradient(circle at 90% 8%, #ffffff 0%, transparent 40%)' }} />
      <Body>
        <p className="font-mono text-[14px] font-black uppercase tracking-[0.22em] text-primary-200">Why these criteria</p>
        <h2 className="mt-3 text-[46px] font-extrabold leading-[1.16] tracking-[-0.03em] text-white"
          style={{ wordBreak: 'keep-all' }}>
          기준을 <span className="text-primary-200 line-through decoration-primary-300/70 decoration-[3px]">지어내지</span> 않았습니다.
        </h2>

        {/* 검증 가능성을 숫자로 못박는다 */}
        <div className="mt-6 flex items-stretch gap-4">
          {[
            ['24개', '직군 전부', '분야 공식 기준에 연결'],
            ['120개', '평가 항목', '항목마다 출처를 표기'],
            ['67%', '표준 직접 근거', '나머지도 성격을 명시'],
          ].map(([big, mid, small]) => (
            <div key={mid} className="flex-1 rounded-2xl border border-white/15 bg-white/[0.07] px-6 py-4">
              <p className="text-[38px] font-extrabold leading-none tabular-nums text-white">{big}</p>
              <p className="mt-2 text-[15px] font-extrabold text-primary-100">{mid}</p>
              <p className="mt-0.5 text-[13px] text-primary-200">{small}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 mb-3 text-[15px] font-bold text-primary-100">
          공통 층 <span className="font-mono text-white">O*NET</span> · <span className="font-mono text-white">NACE</span>
          <span className="mx-2 text-primary-300">위에, 직군마다 해당 분야의 표준을 적용했습니다</span>
        </p>

        <div className="grid grid-cols-6 gap-2.5">
          {STANDARDS.map(([field, std]) => (
            <div key={field} className="rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2.5">
              <p className="text-[12px] font-bold text-primary-200">{field}</p>
              <p className="mt-1 font-mono text-[13px] font-extrabold leading-tight text-white">{std}</p>
            </div>
          ))}
        </div>
      </Body>
      <Foot dark n={7} note="어떤 평가 항목이 어느 표준의 어느 개념에서 왔는지, 그리고 표준 근거가 아닌 항목은 무엇인지까지 문서로 공개합니다." />
    </Slide>
  );
}

/* 07 산출물 — 픽토그램 대신 실제 파일 형식 아이콘(브랜드 자산)을 쓴다 */
const OUTPUTS = [
  { img: '/brand-icons/pdf.svg', mark: null, title: 'PDF 문서', desc: '제출용 A4 포트폴리오. 지원서에 그대로 첨부합니다.' },
  { img: null, mark: 'URL', title: '공개 링크', desc: '링크 하나로 공유. 이력서에 주소만 적으면 됩니다.' },
  { img: '/brand-icons/word.svg', mark: null, title: '이력서', desc: '인적사항·학력·경력·기술만 추린 채용용 문서입니다.' },
  { img: '/brand-icons/powerpoint.svg', mark: null, title: 'PPT', desc: '보유한 템플릿 디자인 위에 내용을 채워 내려받습니다.' },
];

function SlideOutput() {
  return (
    <Slide>
      <Body>
        <Head
          eyebrow="Output"
          title="필요한 형식으로 바로 내보냅니다"
          sub="회사마다 요구하는 형식이 다릅니다. 같은 경험 데이터에서 네 가지 산출물이 나옵니다."
        />
        <div className="grid grid-cols-4 gap-5">
          {OUTPUTS.map(({ img, mark, title, desc }) => (
            <div key={title} className="rounded-2xl border border-surface-200 bg-white px-6 py-7 shadow-[0_2px_12px_rgba(0,47,108,0.05)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-50">
                {img
                  ? <img src={img} alt="" className="h-7 w-7 object-contain" />
                  : <span className="font-mono text-[13px] font-black text-primary-500">{mark}</span>}
              </div>
              <p className="mt-5 text-[21px] font-extrabold text-bluewood-900">{title}</p>
              <p className="mt-2 text-[14.5px] leading-[1.6] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex items-center gap-8 rounded-2xl bg-surface-50 px-8 py-6">
          {[
            ['웹사이트형 템플릿', '포트폴리오·랜딩·회사소개형'],
            ['노션 템플릿 10종', '이력서·업무일지·프로젝트 관리'],
            ['증거 자료 연결', '주장마다 근거 파일을 붙일 수 있음'],
          ].map(([t, d]) => (
            <div key={t} className="flex-1">
              <p className="text-[17px] font-extrabold text-bluewood-800">{t}</p>
              <p className="mt-1 text-[14px] text-bluewood-400">{d}</p>
            </div>
          ))}
        </div>
      </Body>
      <Foot n={11} note="공개 링크는 본인이 켜고 끌 수 있으며, 끄면 즉시 열람이 차단됩니다." />
    </Slide>
  );
}

/* 08 경험정리 — 사용자가 넣은 자료가 어떤 구조로 바뀌는지 */
function SlideExtract() {
  // record() 헬퍼가 펼쳐 넣기 때문에 decisionTrace·voiceRecord·evidenceBundle 은 최상위에 있다
  const exp = SAMPLE_EXPERIENCES.designer;
  const t = exp.decisionTrace || {};
  const voice = exp.voiceRecord || {};
  const evidence = exp.evidenceBundle || [];

  return (
    <Slide>
      <Body>
        <Head
          eyebrow="Extract"
          title="자료를 넣으면, 판단의 과정이 복원됩니다"
          sub="문장을 지어내지 않습니다. 사용자가 넣은 자료에서 무엇을 보고 어떻게 판단했는지를 뽑아 구조로 만듭니다."
        />
        <div className="grid grid-cols-[300px_1fr] gap-7">
          {/* 좌: 입력 */}
          <div className="rounded-2xl border border-surface-200 bg-surface-50/60 p-5">
            <p className="text-[11.5px] font-black uppercase tracking-[0.16em] text-bluewood-300">Input</p>
            <p className="mt-2 text-[14px] font-extrabold text-bluewood-800">사용자가 넣은 것</p>
            <div className="mt-4 space-y-2">
              {['인터뷰 노트 6건', '프로토타입 파일', '사용성 테스트 녹화 5건', '팀 회의록'].map(x => (
                <p key={x} className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-[12.5px] text-bluewood-600">
                  {x}
                </p>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-white px-3 py-2.5">
              <p className="text-[11.5px] font-bold text-bluewood-400">사용자 원문 보존</p>
              <p className="mt-1 text-[12.5px] font-medium italic leading-snug text-bluewood-700">
                “{voice.originalQuote}”
              </p>
            </div>
          </div>

          {/* 우: 복원된 판단 */}
          <div className="rounded-2xl border-2 border-primary-200 bg-primary-50/25 p-5">
            <p className="text-[11.5px] font-black uppercase tracking-[0.16em] text-primary-400">Structured</p>
            <p className="mt-2 text-[14px] font-extrabold text-bluewood-800">복원된 판단 과정</p>

            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3.5">
              {[
                ['문제 판단', t.problemJudgment],
                ['판단 근거', t.problemEvidence],
                ['버린 대안', t.alternatives?.[0]?.option + ' — ' + t.alternatives?.[0]?.reasonNotChosen],
                ['선택 기준', t.decisionCriteria?.[0]?.criterion],
                ['본인 실행 범위', t.execution],
                ['바뀐 판단', t.changedJudgment],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11.5px] font-black text-primary-500">{k}</p>
                  <p className="mt-1 text-[12.5px] leading-[1.6] text-bluewood-700" style={{ wordBreak: 'keep-all' }}>
                    {v}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-caribbean-200 bg-caribbean-50/50 px-3.5 py-2.5">
              <p className="text-[11.5px] font-black text-caribbean-700">증거 연결</p>
              <p className="mt-1 text-[12.5px] leading-snug text-bluewood-700">
                주장마다 근거 자료와 <b>본인 기여 범위</b>를 함께 기록합니다 — “{evidence[0]?.ownership}”
              </p>
            </div>
          </div>
        </div>
      </Body>
      <Foot n={8} note="화면의 내용은 서비스가 실제로 생성하는 구조(판단 지도·증거 번들)입니다." />
    </Slide>
  );
}

/* 09 직군별 경험정리 전체 페이지 —
   개발·기획PM·마케터의 경험정리 결과를 "한 페이지 통째로" 보여준다.
   일부만 잘라 보여주면 직군 차이가 절반만 전달되므로, 페이지 전체가 들어가도록
   가로·세로 모두에 맞춰 축소한다(잘림 없음). 내용은 JobCoreShowcase 가 실제로 그리는 것 그대로 —
   마케터의 캠페인 스토리(7단계)·KPI 타일·이력서 문장도 전부 이 컴포넌트가 만든다. */

/* 페이지 전체가 상자 안에 들어가도록 축소.
   가로/세로 중 더 빡빡한 쪽에 맞추므로 잘리지 않는다. 남는 쪽은 가운데로 몬다 —
   왼쪽에 붙여 두면 칸마다 빈 폭이 달라 보여 정렬이 흐트러진다.
   [요령] srcWidth 를 넓게 잡을수록 내용이 덜 접혀 페이지가 짧아지고, 그만큼 상자를 꽉 채운다. */
/* 페이지 전체를 담는 세로형 프레임.
   [경위] 정사각에 가까운 상자에 긴 페이지를 넣으려다 두 번 실패했다.
   ① 세로에 맞추니 가로가 남아 칸마다 폭이 달라 보였고,
   ② columnCount 로 2단을 만드니 대부분 한 단에 몰려 더 비었다.
   결론: 페이지는 페이지 비율(세로로 긴 문서)대로 두고, 상자를 그 비율에 맞춘다.
   남는 가로 공간은 빈칸으로 두지 않고 옆에 설명을 붙여 채운다. */
/* 긴 페이지를 위/아래 절반으로 잘라 좌우에 나란히 놓는다.
   [경위] 정사각에 가까운 칸에 세로로 긴 페이지를 통째로 넣으려다 두 번 실패했다.
   ① 세로에 맞추니 가로가 남았고 ② columnCount 로 흘리니 한 단에 몰려 더 비었다.
   반으로 자르면 세로가 절반·가로가 두 배가 되어 칸 비율에 맞고, 잘려 나가는 내용도 없다.

   구현: 같은 내용을 두 번 렌더하고, 오른쪽 사본만 위로 절반만큼 밀어 아래쪽을 보여준다. */
function SplitPage({ srcWidth, boxWidth, boxHeight, gap = 10, children }) {
  const measureRef = useRef(null);
  const [natH, setNatH] = useState(0);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return undefined;
    const measure = () => setNatH(el.scrollHeight || 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [srcWidth]);

  const colW = (boxWidth - gap) / 2;
  const halfH = natH > 0 ? natH / 2 : 0;
  // 반쪽이 칸 안에 들어가도록 가로·세로 양쪽 제약을 함께 본다
  const scale = halfH > 0
    ? Math.min(colW / srcWidth, boxHeight / halfH)
    : colW / srcWidth;

  const viewW = srcWidth * scale;
  const viewH = halfH * scale;

  return (
    <div className="flex justify-center" style={{ gap, height: boxHeight }}>
      {[0, 1].map(half => (
        <div
          key={half}
          className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-[0_3px_14px_rgba(0,47,108,0.08)]"
          style={{ width: viewW || colW, height: viewH || boxHeight }}
        >
          {/* 아래쪽 반은 위로 밀어 올려 보여준다 */}
          <div style={{ transform: `translateY(${-half * viewH}px)` }}>
            <div style={{ width: srcWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <div ref={half === 0 ? measureRef : null} className="p-5">{children}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const JOB_SHOWCASE = [
  { id: 'example1', badge: '개발자', tint: 'bg-primary-500', axis: '기여도 · 코드 변경 · 아키텍처' },
  { id: 'example2', badge: '기획 · PM', tint: 'bg-caribbean-700', axis: '린 캔버스 · 가설 검증 · KPI' },
  { id: 'example3', badge: '마케터', tint: 'bg-amber-500', axis: '캠페인 스토리 · KPI · 이력서 문장' },
];

function SlideJobCards() {
  return (
    <Slide>
      <Body>
        <p className="font-mono text-[14px] font-black uppercase tracking-[0.22em] text-primary-400">Job output</p>
        <h2 className="mt-3 text-[46px] font-extrabold leading-[1.16] tracking-[-0.03em] text-bluewood-900"
          style={{ wordBreak: 'keep-all' }}>
          같은 파이프라인이 직군마다 <span className="highlight-core">다른 페이지</span>를 만듭니다
        </h2>
        <p className="mt-3 max-w-[920px] text-[16px] leading-relaxed text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
          아래는 경험정리가 끝난 <b className="text-bluewood-700">전체 페이지</b>입니다. 직군이 바뀌면 페이지에 들어가는
          섹션과 시각화 자체가 달라집니다.
        </p>

        <div className="mt-5 flex justify-between gap-6">
          {JOB_SHOWCASE.map(({ id, badge, tint, axis }) => {
            const exp = PORTFOLIO_EXAMPLES[id]?.experiences?.[0];
            if (!exp) return null;
            return (
              <div key={id} style={{ width: 362 }}>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className={`rounded-md px-2.5 py-1 text-[12.5px] font-black text-white ${tint}`}>{badge}</span>
                  <span className="truncate text-[13px] font-bold text-bluewood-500">{exp.title}</span>
                </div>

                <SplitPage srcWidth={760} boxWidth={362} boxHeight={352}>
                  <JobCoreShowcase exp={exp} readOnly />
                </SplitPage>

                <p className="mt-2.5 text-[13px] font-bold leading-snug text-bluewood-400" style={{ wordBreak: 'keep-all' }}>
                  {axis}
                </p>
              </div>
            );
          })}
        </div>
      </Body>
      <Foot n={9} note="세 페이지 모두 같은 파이프라인을 거쳤습니다 — 화면은 서비스가 실제로 렌더하는 경험정리 결과 그대로입니다." />
    </Slide>
  );
}


/* 10 포트폴리오 완성 예시 —
   /example1~3 에 이미 만들어 둔 완성 포트폴리오 3종을 그대로 가져온다.
   (개발 web-1 / 기획 web-3 / 마케터 web-4 — 직군마다 템플릿까지 다르다)
   브라우저 창 모형 안에 넣어 "실제로 공유되는 웹 포트폴리오"임이 바로 읽히게 한다. */
const PORTFOLIO_PICKS = [
  { id: 'example1', role: '프론트엔드 개발자', slug: 'fitpoly.kr/p/kimdoyun' },
  { id: 'example2', role: '서비스 기획자', slug: 'fitpoly.kr/p/parkseoyeon' },
  { id: 'example3', role: '마케터', slug: 'fitpoly.kr/p/leesumin' },
];

/* 브라우저 창 크롬 — 주소창이 있으면 "링크로 공유되는 결과물"임이 설명 없이 전달된다 */
function BrowserFrame({ url, width, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-300 bg-white shadow-[0_6px_22px_rgba(0,47,108,0.10)]" style={{ width }}>
      <div className="flex items-center gap-2 border-b border-surface-200 bg-surface-50 px-3 py-2">
        <span className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        </span>
        <span className="ml-1 flex-1 truncate rounded bg-white px-2 py-1 font-mono text-[11px] text-bluewood-400">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

function SlidePortfolio() {
  return (
    <Slide>
      <Body>
        <Head
          eyebrow="Portfolio"
          title="완성된 포트폴리오는 이렇게 나옵니다"
          sub="직군마다 구성도 템플릿도 다릅니다. 아래 셋은 서비스가 실제로 만들어 링크로 공유하는 결과물입니다."
        />
        <div className="flex justify-between gap-6">
          {PORTFOLIO_PICKS.map(({ id, role, slug }) => {
            const p = PORTFOLIO_EXAMPLES[id];
            if (!p) return null;
            return (
              <figure key={id} className="m-0" style={{ width: 362 }}>
                <BrowserFrame url={slug} width={362}>
                  {/* 실제 웹 포트폴리오를 원본 폭(1280)으로 렌더한 뒤 축소해 상단을 보여준다 */}
                  <div className="relative overflow-hidden bg-white" style={{ height: 300 }}>
                    <div style={{ width: 1280, transform: 'scale(0.2828)', transformOrigin: 'top left' }}>
                      <WebPortfolioRenderer portfolio={p} embedded enableProjectModal={false} />
                    </div>
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14"
                      style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, #ffffff 92%)' }} />
                  </div>
                </BrowserFrame>
                <figcaption className="mt-3">
                  <p className="text-[16px] font-extrabold text-bluewood-900">{p.userName} · {role}</p>
                  <p className="mt-1 text-[13px] leading-snug text-bluewood-400" style={{ wordBreak: 'keep-all' }}>
                    {p.headline}
                  </p>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </Body>
      <Foot n={10} note="세 예시는 각각 다른 템플릿으로 생성됐습니다 · 사이트에서 /example1 · /example2 · /example3 으로 전체를 볼 수 있습니다." />
    </Slide>
  );
}

/* 12 관심도 — 사용자가 실제로 얼마나 반응했는가.
   숫자는 IR 자료(채널 운영 1개월 누적)와 같은 출처를 쓴다. */
const FUNNEL_STEPS = [
  { label: '노출', value: '13만+', note: '릴스 78,881 + X 51,000' },
  { label: '가입', value: '420명', note: '방문 → 가입 전환 30%' },
  { label: '첫 산출물 완성', value: '42%', note: '가입자 중 결과물까지 도달' },
  { label: '주간 재방문', value: '27.3%', note: '다시 돌아온 비율' },
];

function SlideTraction() {
  return (
    <Slide>
      <Body>
        <Head
          eyebrow="Traction"
          title="한 달 만에 13만 노출, 420명이 직접 만들어봤습니다"
          sub="노출에서 그치지 않고 가입 · 완성 · 재방문까지 이어졌는지를 단계별로 확인했습니다."
        />

        {/* 퍼널 — 단계마다 무엇이 남았는지 그대로 보인다 */}
        <div className="flex items-stretch gap-3">
          {FUNNEL_STEPS.map((s, i) => (
            <div key={s.label} className="flex flex-1 items-stretch">
              <div className={`flex-1 rounded-2xl border px-6 py-5 ${
                i === 0 ? 'border-surface-200 bg-surface-50/70' : 'border-primary-200 bg-primary-50/40'
              }`}>
                <p className="text-[13px] font-bold text-bluewood-400">{s.label}</p>
                <p className="mt-1.5 text-[38px] font-extrabold leading-none tabular-nums text-primary-600">{s.value}</p>
                <p className="mt-2 text-[13px] leading-snug text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{s.note}</p>
              </div>
              {i < FUNNEL_STEPS.length - 1 && (
                <span aria-hidden className="self-center px-1 text-[20px] font-black text-primary-300">→</span>
              )}
            </div>
          ))}
        </div>

        {/* 정성 신호 */}
        <div className="mt-6 flex items-center gap-8 rounded-2xl border border-surface-200 bg-white px-8 py-5">
          {[
            ['3,300+', '저장 · 공유 · 댓글', '저장 1,600 · 공유 1,700 · 댓글 550'],
            ['4.8 / 5', '사용자 만족도', '피드백 14건 · 표본이 작아 참고치'],
            ['8초', '릴스 평균 조회시간', '3초 훅을 넘긴 시청 유지'],
          ].map(([big, mid, small]) => (
            <div key={mid} className="flex-1">
              <p className="text-[26px] font-extrabold leading-none tabular-nums text-bluewood-900">{big}</p>
              <p className="mt-1.5 text-[14px] font-extrabold text-bluewood-700">{mid}</p>
              <p className="mt-0.5 text-[12.5px] text-bluewood-400">{small}</p>
            </div>
          ))}
        </div>
      </Body>
      <Foot n={12} note="출처: 자사 인스타그램 릴스 · X 인사이트 (2026, 채널 운영 1개월 누적) · 만족도는 응답 14건으로 표본이 작습니다." />
    </Slide>
  );
}

/* 13 채널 — 어디에 올려서 무엇이 돌아왔는가 */
const CHANNELS = [
  {
    name: 'Instagram 릴스',
    reach: '78,881',
    unit: '회 재생',
    rows: [['평균 조회시간', '8초'], ['저장', '1,600+'], ['공유', '1,700+'], ['댓글', '550']],
    take: '저장·공유가 3,300건 — 남에게 보여줄 만한 콘텐츠로 작동했습니다.',
  },
  {
    name: 'X (구 트위터)',
    reach: '51,000',
    unit: '노출',
    rows: [['좋아요', '1,040'], ['리트윗', '419']],
    take: '리트윗 419건 — 취준 커뮤니티 안에서 자발적으로 퍼졌습니다.',
  },
];

function SlideChannels() {
  return (
    <Slide dark>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{ backgroundImage: 'radial-gradient(circle at 88% 10%, #ffffff 0%, transparent 40%)' }} />
      <Body>
        <Head
          dark
          eyebrow="Channels"
          title="광고비 0원, 콘텐츠 두 채널로만 만든 결과입니다"
          sub="유료 집행 없이 인스타그램 릴스와 X에 직군별 콘텐츠를 올려 반응을 검증했습니다."
        />

        <div className="grid grid-cols-2 gap-5">
          {CHANNELS.map(ch => (
            <div key={ch.name} className="rounded-2xl border border-white/12 bg-white/[0.06] px-7 py-6">
              <p className="text-[15px] font-extrabold text-primary-100">{ch.name}</p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[44px] font-extrabold leading-none tabular-nums text-white">{ch.reach}</span>
                <span className="text-[15px] font-bold text-primary-200">{ch.unit}</span>
              </p>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-white/12 pt-4">
                {ch.rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between">
                    <span className="text-[13px] text-primary-200">{k}</span>
                    <span className="text-[15px] font-extrabold tabular-nums text-white">{v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-primary-100" style={{ wordBreak: 'keep-all' }}>
                {ch.take}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/12 bg-white/[0.06] px-7 py-4">
          <span className="font-mono text-[12px] font-black uppercase tracking-[0.16em] text-primary-200">Next</span>
          <p className="text-[14.5px] leading-relaxed text-primary-100" style={{ wordBreak: 'keep-all' }}>
            반응이 큰 직군을 데이터로 선별해 그 직군의 콘텐츠와 온보딩에 집중합니다.
            <span className="ml-1.5 text-white">채널을 늘리기 전에 어느 직군이 반응하는지부터 확정합니다.</span>
          </p>
        </div>
      </Body>
      <Foot dark n={13} note="출처: 자사 인스타그램 릴스 · X 인사이트 (2026, 채널 운영 1개월 누적) · 유료 광고 집행 없음" />
    </Slide>
  );
}

/* 14 비용 구조 — 크레딧 원가 기반 단위 경제성 */
const PACKAGES = [
  { price: '3,000원', credits: '1,000C', unit: '3.00원', cost: '560원', margin: '2,440원', rate: '81.3%' },
  { price: '12,000원', credits: '5,000C', unit: '2.40원', cost: '2,800원', margin: '9,200원', rate: '76.7%' },
  { price: '25,000원', credits: '12,000C', unit: '2.08원', cost: '6,720원', margin: '18,280원', rate: '73.1%' },
];

function SlideUnitEconomics() {
  return (
    <Slide>
      <Body>
        <Head
          eyebrow="Unit economics"
          title="크레딧 1건당 원가를 알고 파는 구조입니다"
          sub="AI 호출량을 크레딧으로 환산해 원가를 고정했습니다. 패키지가 커질수록 단가는 내려가고 이익률은 완만해집니다."
        />

        <div className="grid grid-cols-[1.35fr_1fr] gap-6">
          {/* 패키지별 기여이익 */}
          <div className="overflow-hidden rounded-2xl border border-surface-200">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="bg-primary-500 text-white">
                  <th className="px-4 py-3 text-left text-[13px] font-extrabold">패키지</th>
                  <th className="px-3 py-3 text-[13px] font-extrabold">크레딧 단가</th>
                  <th className="px-3 py-3 text-[13px] font-extrabold">원가</th>
                  <th className="px-3 py-3 text-[13px] font-extrabold">기여이익</th>
                  <th className="px-4 py-3 text-[13px] font-extrabold">이익률</th>
                </tr>
              </thead>
              <tbody>
                {PACKAGES.map((p, i) => (
                  <tr key={p.price} className={i % 2 ? 'bg-surface-50/60' : 'bg-white'}>
                    <td className="px-4 py-3 text-left">
                      <span className="text-[14.5px] font-extrabold text-bluewood-900">{p.price}</span>
                      <span className="ml-1.5 text-[12.5px] text-bluewood-400">{p.credits}</span>
                    </td>
                    <td className="px-3 py-3 text-[13.5px] tabular-nums text-bluewood-500">{p.unit}</td>
                    <td className="px-3 py-3 text-[13.5px] tabular-nums text-bluewood-500">{p.cost}</td>
                    <td className="px-3 py-3 text-[14.5px] font-extrabold tabular-nums text-primary-600">{p.margin}</td>
                    <td className="px-4 py-3 text-[14.5px] font-extrabold tabular-nums text-bluewood-800">{p.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-surface-200 bg-surface-50/70 px-4 py-2.5 text-[12.5px] text-bluewood-400">
              크레딧 원가 <b className="text-bluewood-700">0.56원</b> 기준 · 실제 토큰 사용량만큼 차감됩니다
            </p>
          </div>

          {/* 손익분기 */}
          <div className="rounded-2xl border-2 border-primary-500 bg-primary-50/40 px-7 py-6">
            <p className="font-mono text-[12px] font-black uppercase tracking-[0.16em] text-primary-500">Break-even</p>
            <div className="mt-4 space-y-4">
              {[
                ['7,636원', '결제 1건당 평균 기여이익'],
                ['75.6%', '평균 기여이익률 (믹스 5:3:2)'],
                ['월 92건', '손익분기 결제 건수'],
              ].map(([big, small]) => (
                <div key={small}>
                  <p className="text-[30px] font-extrabold leading-none tabular-nums text-primary-600">{big}</p>
                  <p className="mt-1 text-[13.5px] font-semibold text-bluewood-500">{small}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 border-t border-primary-200 pt-4 text-[13px] leading-relaxed text-bluewood-600" style={{ wordBreak: 'keep-all' }}>
              월 고정비 <b className="text-bluewood-900">70만원</b><br />
              인프라 30만 · 무료 사용자 크레딧 28만 · 운영 툴 12만
            </p>
          </div>
        </div>
      </Body>
      <Foot n={14} note="월 고정비 70만원 ÷ 기여이익률 75.6% = 최소 유지 매출 약 93만원 · 평균 결제 10,100원 기준 약 92건" />
    </Slide>
  );
}


/* 15 마무리 — 절제 */
function Closing() {
  return (
    <Slide>
      <div aria-hidden className="absolute left-0 top-0 h-[5px] w-full bg-primary-500" />
      <div className="absolute inset-x-[72px] top-[252px]">
        <h2 className="text-[42px] font-extrabold leading-[1.25] tracking-[-0.025em] text-bluewood-900"
          style={{ wordBreak: 'keep-all' }}>
          경험이 곧 커리어 자산이 되도록.
        </h2>
        <p className="mt-5 max-w-[680px] text-[16.5px] leading-relaxed text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
          흩어진 기록을 스스로 짜맞추던 오늘에서, 모든 경험이 직군의 언어로 번역되어
          평생 쓰는 자산이 되는 내일로.
        </p>
      </div>

      <div className="absolute inset-x-[72px] bottom-[52px] flex items-end justify-between border-t border-surface-200 pt-5">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-7 w-auto" />
          <span className="text-[15px] font-extrabold tracking-tight text-primary-500">FitPoly</span>
        </div>
        <p className="text-[13px] text-bluewood-400">fitpoly.kr · fitpoly.kr@gmail.com</p>
      </div>
    </Slide>
  );
}

const SLIDES = [
  Cover,
  SlideProblem,       // 02 문제 (다크)
  SlideInterview,     // 03 현장 설문·인터뷰
  SlideFlow,          // 04 해결 4단계
  SlideDifference,    // 05 차별점
  SlideJobs,          // 06 직군별 평가 축
  SlideEvidence,      // 07 근거 (다크)
  SlideExtract,       // 08 경험정리 실제
  SlideJobCards,      // 09 직군별 경험정리 전체 페이지
  SlidePortfolio,     // 10 포트폴리오 완성 실물
  SlideOutput,        // 11 내보내기
  SlideTraction,      // 12 관심도 · 퍼널
  SlideChannels,      // 13 채널 성과 (다크)
  SlideUnitEconomics, // 14 비용 구조
  Closing,            // 15
];

/* ── 덱 셸 ────────────────────────────────────────────── */

export default function ServiceDeck() {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [exporting, setExporting] = useState(false);
  const stageRef = useRef(null);
  const exportRef = useRef(null);

  const total = SLIDES.length;
  const go = useCallback((next) => setIndex(i => Math.min(total - 1, Math.max(0, typeof next === 'function' ? next(i) : next))), [total]);

  /* 인쇄 규칙을 <head> 끝에 주입 — index.css 의 전역 @page(A4)를 덮어쓰기 위함 */
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'fp-deck-print-css';
    el.textContent = PRINT_CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  /* 인쇄 창을 닫거나 취소해도 상태가 남지 않게 정리 */
  useEffect(() => {
    const done = () => {
      document.body.classList.remove('fp-deck-printing');
      document.body.classList.remove('fp-deck-measuring');
      setExporting(false);
    };
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  /* 뷰포트에 맞춰 슬라이드를 축소 — 레이아웃은 그대로 두고 크기만 바꾼다 */
  useEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(width / W, height / H, 1));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  /* 키보드 이동 */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(i => i + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i => i - 1); }
      if (e.key === 'Home') { e.preventDefault(); go(0); }
      if (e.key === 'End') { e.preventDefault(); go(total - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, total]);

  /* PDF 저장 — 브라우저 인쇄 엔진을 쓴다.
     예전에는 html2canvas 로 화면을 이미지(JPEG)로 구워 jsPDF 에 얹었는데,
     Pretendard 가 교차 출처 CDN 폰트라 복제된 DOM 에서 로드되지 않으면
     한글이 통째로 깨져 나왔다(대체 폰트·두부 현상). 이미지라 확대하면 뭉개지기도 했다.
     인쇄 경로는 텍스트를 벡터로 내보내므로 글자가 깨지지 않고, 복사·검색도 된다. */
  const handleDownload = async () => {
    if (exporting) return;
    setExporting(true);
    const toastId = toast.loading('인쇄 창을 준비하고 있어요…');

    try {
      // ⓪ 인쇄본을 레이아웃에 올린다(화면에는 안 보인다).
      //    이걸 빼면 SplitPage 가 페이지 높이를 0 으로 재서 09번 슬라이드의 두 칸이 똑같이 찍힌다.
      document.body.classList.add('fp-deck-measuring');

      // ① 폰트 — 로드 전에 인쇄하면 한글이 대체 폰트로 바뀌어 깨진다
      if (document.fonts?.ready) await document.fonts.ready;

      // ② 이미지 — 로고·브랜드 아이콘·프로젝트 썸네일이 덜 실리면 빈칸으로 찍힌다.
      //    decode() 까지 기다려야 실제로 그릴 준비가 끝난 것이다.
      const imgs = Array.from(exportRef.current?.querySelectorAll('img') || []);
      await Promise.all(imgs.map(img => {
        if (img.complete && img.naturalWidth > 0) return img.decode?.().catch(() => {}) ?? Promise.resolve();
        return new Promise(res => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });   // 실패해도 인쇄는 진행
          setTimeout(res, 3000);                                 // 무한 대기 방지
        });
      }));

      // ③ 레이아웃 — SplitPage 의 ResizeObserver 측정이 끝나도록 두 프레임 대기
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      document.body.classList.add('fp-deck-printing');
      toast.success('인쇄 창에서 “PDF로 저장” · “배경 그래픽”을 켜주세요', { id: toastId, duration: 6000 });

      // ④ 토스트가 사라진 뒤 인쇄 (토스트가 지면에 찍히지 않게)
      await new Promise(r => setTimeout(r, 150));
      window.print();
    } catch (err) {
      console.error('[ServiceDeck] 인쇄 준비 실패:', err);
      toast.error('인쇄 준비에 실패했어요. 잠시 후 다시 시도해주세요.', { id: toastId });
    } finally {
      document.body.classList.remove('fp-deck-printing');
      document.body.classList.remove('fp-deck-measuring');
      setExporting(false);
    }
  };

  const Current = SLIDES[index];

  return (
    <>
    <div className="fp-deck-screen flex h-screen flex-col bg-[#eef1f5]">
      {/* 상단 바 */}
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-surface-200 bg-white px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-bluewood-500 transition-colors hover:text-primary-600">
          <Home size={17} />
          <span className="hidden text-[14px] font-semibold sm:inline">FitPoly</span>
        </Link>

        <span className="hidden h-4 w-px bg-surface-200 sm:block" />
        <p className="hidden text-[14px] font-bold text-bluewood-700 sm:block">서비스 소개서</p>

        <div className="ml-auto flex items-center gap-2">
          <span className="mr-1 text-[13px] font-bold tabular-nums text-bluewood-400">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => go(i => i - 1)}
            disabled={index === 0}
            aria-label="이전 슬라이드"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-bluewood-600 transition-colors hover:bg-surface-50 disabled:opacity-35"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => go(i => i + 1)}
            disabled={index === total - 1}
            aria-label="다음 슬라이드"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-bluewood-600 transition-colors hover:bg-surface-50 disabled:opacity-35"
          >
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={exporting}
            className="ml-1 flex items-center gap-2 rounded-lg bg-primary-600 px-3.5 py-2 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span className="hidden sm:inline">{exporting ? '준비 중' : 'PDF 저장'}</span>
          </button>
        </div>
      </header>

      {/* 무대 */}
      <div ref={stageRef} className="flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-7">
        <div
          className="origin-center shadow-[0_18px_60px_rgba(0,47,108,0.16)]"
          style={{ width: W, height: H, transform: `scale(${scale})` }}
        >
          <Current />
        </div>
      </div>

      {/* 하단 점 네비게이션 */}
      <nav aria-label="슬라이드 이동" className="flex flex-shrink-0 items-center justify-center gap-1.5 pb-5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`${i + 1}번 슬라이드`}
            aria-current={i === index ? 'true' : undefined}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-7 bg-primary-500' : 'w-1.5 bg-bluewood-200 hover:bg-bluewood-300'
            }`}
          />
        ))}
      </nav>

    </div>

    {/* 인쇄용 사본 — 반드시 #root 바깥(body 직속)에 둔다.
        [중요] 이걸 화면 셸 안에 두면, 인쇄할 때 셸을 display:none 하는 순간
        자식인 인쇄본까지 함께 사라져 "빈 1페이지"만 나온다. 실제로 그 버그가 있었다.
        포털로 body 에 붙이면 #root 를 통째로 숨겨도 인쇄본은 살아남고,
        토스트·상단바 같은 화면 UI도 한 번에 지면에서 제외된다. */}
    {createPortal(
      <div ref={exportRef} aria-hidden className="fp-deck-print">
        {SLIDES.map((S, i) => (
          <div key={i} style={{ width: W, height: H }}>
            <S />
          </div>
        ))}
      </div>,
      document.body,
    )}
    </>
  );
}
