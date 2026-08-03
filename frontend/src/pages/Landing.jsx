import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import {
  ArrowRight, Briefcase, FileText,
  ChevronLeft, ChevronRight,
  Upload, FileUp, Link as LinkIcon,
  Check, Star, Users, Target,
  Building2, Search, ChevronDown, BarChart3, Award,
  Code, GraduationCap, Calendar, List, PenTool,
  MapPin, Phone, Mail, Globe, Presentation
} from 'lucide-react';

const BRAND_ICONS = {
  KakaoTalk: '/brand-icons/kakaotalk.svg',
  Notion: '/brand-icons/notion.svg',
  'Google Drive': '/brand-icons/google-drive.svg',
  Gmail: '/brand-icons/gmail.svg',
  Slack: '/brand-icons/slack.svg',
  Discord: '/brand-icons/discord.svg',
  Figma: '/brand-icons/figma.svg',
  'Google Docs': '/brand-icons/google-docs.svg',
  PDF: '/brand-icons/pdf.svg',
  GitHub: '/brand-icons/github.svg',
};

function BrandIcon({ name, className = '' }) {
  return <img src={BRAND_ICONS[name]} alt={name} className={className} loading="lazy" decoding="async" />;
}

const ResponsiveScaleWrapper = ({ children, minWidth = 1000 }) => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState('auto');

  const handleResize = useCallback(() => {
    if (!containerRef.current || !contentRef.current) return;
    const containerW = containerRef.current.clientWidth;
    if (containerW < minWidth) {
      const newScale = containerW / minWidth;
      setScale(newScale);
      setHeight(contentRef.current.offsetHeight * newScale);
    } else {
      setScale(1);
      setHeight('auto');
    }
  }, [minWidth]);

  useEffect(() => {
    const observer = new ResizeObserver(handleResize);
    if (contentRef.current) observer.observe(contentRef.current);
    if (containerRef.current) observer.observe(containerRef.current);

    handleResize();
    return () => observer.disconnect();
  }, [handleResize]);

  return (
    <div ref={containerRef} className="w-full relative origin-top-left" style={{ height }}>
      <div 
        ref={contentRef} 
        className="origin-top-left w-full" 
        style={{ 
          position: scale < 1 ? 'absolute' : 'relative',
          top: 0, 
          left: 0,
          width: scale < 1 ? `${minWidth}px` : '100%', 
          minWidth: scale < 1 ? `${minWidth}px` : 'auto',
          transform: scale < 1 ? `scale(${scale})` : 'none',
          display: 'block'
        }}
      >
        {children}
      </div>
    </div>
  );
};

/* ── 산출물 쇼케이스 (핵심 기능 02) ─────────────────────────────────
   웹사이트 · 노션형 문서 · PPT 세 가지 산출물을 한 자리에서 보여준다.
   웹/노션은 목업이 아니라 실제 서비스와 동일한 렌더러(LandingOutputPreview)를
   샘플 데이터로 그대로 렌더한다. PPT는 사용자가 올린 PPTX 디자인 위에 내용을
   채우는 방식이라 고정 디자인이 없어, 자동 구성되는 슬라이드 구조만 보여준다.

   렌더러 번들이 무거워 섹션이 화면에 들어올 때 lazy 로드하고, 화면 밖에서는
   인터벌·애니메이션을 정지한다. 스테이지는 1280×800 가상 화면을 컨테이너 폭에
   맞춰 축소하므로, 화면 크기와 무관하게 항상 같은 영역이 보인다. */

const LandingOutputPreview = lazy(() => import('../components/landing/LandingOutputPreview'));

const OUTPUT_INTERVAL = 7000;
const STAGE_W = 1280;
const STAGE_H = 800;

const OUTPUT_FORMATS = [
  { key: 'web',    label: '웹사이트',    icon: Globe,        chrome: 'fitpoly.kr/p/gildong',         note: '링크 하나로 바로 공유' },
  { key: 'notion', label: '노션형 문서', icon: FileText,     chrome: 'fitpoly.kr/portfolio/gildong', note: '섹션까지 채워진 문서형' },
  { key: 'ppt',    label: 'PPT',        icon: Presentation, chrome: '홍길동_포트폴리오.pptx',        note: '내 PPT 템플릿 디자인에 자동 매핑' },
];

// id 는 실제 서비스의 템플릿 ID — 렌더러가 이 ID로 실제 화면을 그린다.
const OUTPUT_ITEMS = {
  web: [
    { id: 'web-1', name: '웹사이트 A', desc: '빅 타이포 랜딩',    bg: '#f4f1ea', accent: '#ff4d00' },
    { id: 'web-3', name: '웹사이트 B', desc: '에디토리얼 파인더', bg: '#f5f5f2', accent: '#b7ff22' },
    { id: 'web-4', name: '웹사이트 C', desc: '블루 티켓',         bg: '#ffffff', accent: '#1e3fa0' },
    { id: 'web-6', name: '웹사이트 D', desc: '임팩트 카드',       bg: '#ffffff', accent: '#00bd66' },
  ],
  notion: [
    { id: 'visual-9', name: '템플릿 11', desc: '합격자형 프리미엄', bg: '#ffffff', accent: '#4f46e5' },
    { id: 'visual-1', name: '템플릿 3',  desc: '기본 노션형',      bg: '#ffffff', accent: '#111827' },
    { id: 'visual-2', name: '템플릿 4',  desc: '베이지 톤',        bg: '#f3f2eb', accent: '#8a7f6a' },
    { id: 'visual-8', name: '템플릿 10', desc: '개발자 다크',      bg: '#191919', accent: '#38bdf8' },
  ],
  ppt: [
    { id: 'cover',   name: '표지',      desc: '이름 · 한 줄 소개',   bg: '#ffffff', accent: '#1B264F' },
    { id: 'project', name: '프로젝트',  desc: '문제 → 실행 → 결과', bg: '#ffffff', accent: '#1B264F' },
    { id: 'impact',  name: '성과 요약', desc: '지표 하이라이트',     bg: '#ffffff', accent: '#1B264F' },
  ],
};

/** 컨테이너 폭 대비 가상 폭(virtualWidth) 축소 배율 */
function useFitScale(virtualWidth) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / virtualWidth);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => observer.disconnect();
  }, [virtualWidth]);
  return [ref, scale];
}

/* PPT 산출물은 업로드한 템플릿 디자인을 따르므로, 여기서는 AI가 자동으로 구성하는
   슬라이드 골격(표지 / 프로젝트 / 성과 요약)만 보여준다. */
function PptSlide({ id }) {
  const ink = '#1B264F';
  const accent = '#4F46E5';
  const frame = { width: '1120px', height: '600px', margin: '100px auto 0', background: '#fff', boxShadow: '0 24px 60px rgb(15,23,42,0.14)', borderRadius: '6px' };

  if (id === 'cover') {
    return (
      <div style={frame} className="relative overflow-hidden flex">
        <div style={{ width: '14px', background: ink }} />
        <div className="flex-1 flex flex-col justify-center px-16">
          <p style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.24em', color: accent }}>PORTFOLIO · 2026</p>
          <p style={{ fontSize: '86px', fontWeight: 900, color: ink, lineHeight: 1.1, marginTop: '18px' }}>홍길동</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#64748b', marginTop: '14px' }}>데이터로 문제를 해결하는 프로덕트 매니저</p>
          <div className="flex items-center gap-3 mt-12">
            {['프로덕트 기획', '데이터 분석', 'A/B 테스트'].map((t) => (
              <span key={t} style={{ fontSize: '18px', fontWeight: 800, color: ink, border: `2px solid ${ink}22`, borderRadius: '999px', padding: '8px 18px' }}>{t}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between items-end py-14 pr-16">
          <span style={{ fontSize: '120px', fontWeight: 900, color: '#eef0f6', lineHeight: 1 }}>01</span>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#94a3b8', textAlign: 'right', lineHeight: 1.6 }}>
            hello@fitpoly.kr<br />서울, 대한민국
          </div>
        </div>
      </div>
    );
  }

  if (id === 'project') {
    return (
      <div style={frame} className="relative overflow-hidden px-16 py-14">
        <div className="flex items-end justify-between" style={{ borderBottom: `3px solid ${ink}`, paddingBottom: '18px' }}>
          <div>
            <p style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '0.2em', color: accent }}>PROJECT 01</p>
            <p style={{ fontSize: '40px', fontWeight: 900, color: ink, marginTop: '8px' }}>결제 플로우 재설계로 전환율 18% 개선</p>
          </div>
          <span style={{ fontSize: '18px', fontWeight: 800, color: '#94a3b8' }}>2025.03 – 2025.08</span>
        </div>
        <div className="grid grid-cols-3 gap-8 mt-12">
          {[
            { t: '문제', b: '결제 3단계에서 이탈이 집중됐고, 원인이 체감으로만 공유되고 있었습니다.' },
            { t: '실행', b: 'GA4·세션 리플레이로 이탈 구간을 특정하고 단계를 2단계로 줄여 A/B 테스트했습니다.' },
            { t: '결과', b: '전환율 18% 상승, 결제 문의 건수 24% 감소로 CS 부하까지 줄였습니다.' },
          ].map((c, i) => (
            <div key={c.t}>
              <div className="flex items-center gap-3 mb-4">
                <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: i === 2 ? accent : `${ink}12`, color: i === 2 ? '#fff' : ink, fontSize: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span style={{ fontSize: '24px', fontWeight: 900, color: ink }}>{c.t}</span>
              </div>
              <p style={{ fontSize: '19px', lineHeight: 1.75, color: '#475569', wordBreak: 'keep-all' }}>{c.b}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-12">
          {['전환율 +18%', '결제 문의 -24%', '리서치 84명'].map((m) => (
            <span key={m} style={{ fontSize: '20px', fontWeight: 900, color: ink, background: '#f1f3f9', borderRadius: '10px', padding: '14px 22px' }}>{m}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={frame} className="relative overflow-hidden px-16 py-14">
      <p style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '0.2em', color: accent }}>IMPACT SUMMARY</p>
      <p style={{ fontSize: '40px', fontWeight: 900, color: ink, marginTop: '8px' }}>숫자로 정리한 3년</p>
      <div className="grid grid-cols-3 gap-6 mt-11">
        {[
          { v: '+18%', l: '결제 전환율' },
          { v: '-40%', l: 'CS 응대 시간' },
          { v: '6건', l: '리드한 프로젝트' },
        ].map((k) => (
          <div key={k.l} style={{ background: '#f7f8fc', borderRadius: '14px', padding: '30px 28px', borderLeft: `6px solid ${accent}` }}>
            <p style={{ fontSize: '54px', fontWeight: 900, color: ink, lineHeight: 1 }}>{k.v}</p>
            <p style={{ fontSize: '19px', fontWeight: 700, color: '#64748b', marginTop: '10px' }}>{k.l}</p>
          </div>
        ))}
      </div>
      <div className="mt-11 space-y-5">
        {[
          'AI 챗봇 도입으로 단순 반복 문의 65%를 자동화',
          '교내 공지 통합 서비스로 공지 누락률 32% 감소',
          '주간 VOC 리포트 자동화로 주 4시간 절감',
        ].map((row) => (
          <div key={row} className="flex items-center gap-4">
            <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: accent }} />
            <span style={{ fontSize: '21px', fontWeight: 700, color: '#334155' }}>{row}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutputShowcase() {
  const [format, setFormat] = useState('web');
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef(null);
  const [stageRef, scale] = useFitScale(STAGE_W);

  const items = OUTPUT_ITEMS[format];
  const item = items[index] || items[0];
  const meta = OUTPUT_FORMATS.find((f) => f.key === format);
  const isPpt = format === 'ppt';

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setMounted(true);
      },
      { threshold: 0.2 }
    );
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), OUTPUT_INTERVAL);
    return () => clearInterval(id);
  }, [visible, tick, items.length]);

  const selectFormat = (key) => { setFormat(key); setIndex(0); setTick((v) => v + 1); };
  const selectItem = (i) => { setIndex(i); setTick((v) => v + 1); };

  return (
    <div ref={rootRef} className="w-full">
      <style>{`
        @keyframes lpStageScroll { 0%, 42% { transform: translateY(0); } 100% { transform: translateY(-12%); } }
        .lp-stage-scroll { animation: lpStageScroll ${OUTPUT_INTERVAL}ms cubic-bezier(.4,0,.6,1) both; will-change: transform; }
        @keyframes lpFade { from { opacity: 0; } to { opacity: 1; } }
        .lp-fade { animation: lpFade .5s cubic-bezier(.22,1,.36,1) both; }
        @keyframes lpProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) {
          .lp-stage-scroll, .lp-fade { animation: none; }
        }
      `}</style>

      {/* 산출물 포맷 탭 */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
          {OUTPUT_FORMATS.map((f) => {
            const Icon = f.icon;
            const on = f.key === format;
            return (
              <button
                key={f.key}
                onClick={() => selectFormat(f.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                  on ? 'bg-white text-[#1B264F] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={13} /> {f.label}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] font-semibold text-gray-400 truncate">{meta.note}</p>
      </div>

      {/* 산출물 프레임 */}
      <div className="rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-[0_16px_48px_rgb(0,0,0,0.1)]">
        <div className="flex items-center gap-2 px-3.5" style={{ height: '34px', background: '#f5f6f8', borderBottom: '1px solid #e5e7eb' }}>
          <div className="flex gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1.5 bg-white rounded-full px-3.5 py-1 border border-gray-200" style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600 }}>
              <span style={{ fontSize: '8px' }}>{isPpt ? '📄' : '🔒'}</span> {meta.chrome}
            </div>
          </div>
          <span className="shrink-0" style={{ fontSize: '9px', fontWeight: 700, color: '#9ca3af' }}>
            {item.name} · {item.desc}
          </span>
        </div>

        <div
          ref={stageRef}
          className="relative overflow-hidden"
          style={{ aspectRatio: `${STAGE_W} / ${STAGE_H}`, background: isPpt ? '#e9ebf0' : item.bg }}
        >
          <div className="absolute top-0 left-0" style={{ width: `${STAGE_W}px`, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            {isPpt ? (
              <div key={`${item.id}-${tick}`} className="lp-fade" style={{ height: `${STAGE_H}px` }}>
                <PptSlide id={item.id} />
              </div>
            ) : mounted && (
              <Suspense fallback={null}>
                <div key={`${item.id}-${tick}`} className="lp-fade">
                  <div className="lp-stage-scroll" style={{ animationPlayState: visible ? 'running' : 'paused' }}>
                    <LandingOutputPreview templateId={item.id} />
                  </div>
                </div>
              </Suspense>
            )}
          </div>
          {!isPpt && !mounted && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-gray-300">
              실제 템플릿 불러오는 중…
            </div>
          )}
        </div>
      </div>

      {/* 선택 레일 */}
      <div className={`grid grid-cols-2 gap-2 sm:gap-3 mt-4 ${items.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
        {items.map((t, i) => (
          <button
            key={t.id}
            onClick={() => selectItem(i)}
            className="relative text-left rounded-xl border bg-white p-3 pb-4 overflow-hidden transition-colors duration-300 hover:border-gray-400"
            style={{ borderColor: i === index ? '#1B264F' : '#e5e7eb' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3.5 h-3.5 rounded-[5px] border border-black/10 flex items-center justify-center shrink-0" style={{ background: t.bg }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />
              </span>
              <span className={`text-[12px] font-extrabold truncate ${i === index ? 'text-gray-900' : 'text-gray-500'}`}>{t.name}</span>
            </div>
            <p className="text-[11px] text-gray-400 font-medium truncate">{t.desc}</p>
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-100">
              {i === index && (
                <div
                  key={`${index}-${tick}`}
                  className="h-full origin-left bg-[#1B264F]"
                  style={{ animation: visible ? `lpProgress ${OUTPUT_INTERVAL}ms linear both` : 'none' }}
                />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const MOCK_UPLOAD_FILES = [
  { name: '프로젝트_회고록.hwp', size: '245 KB', color: 'bg-blue-500' },
  { name: '포트폴리오_v3.pdf', size: '1.2 MB', color: 'bg-red-500' },
  { name: '개발일지_2025.docx', size: '380 KB', color: 'bg-indigo-500' },
  { name: '자기소개서_최종.hwp', size: '178 KB', color: 'bg-blue-500' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [heroVisible, setHeroVisible] = useState(false);
  const heroRef = useRef(null);

  const [openFaqs, setOpenFaqs] = useState([]);

  const toggleFaq = (index) => {
    if (openFaqs.includes(index)) {
      setOpenFaqs(openFaqs.filter(i => i !== index));
    } else {
      setOpenFaqs([...openFaqs, index]);
    }
  };

  const [panelAnim, setPanelAnim] = useState(0);
  const [panelAnimKey, setPanelAnimKey] = useState(0);
  const panelTimers = useRef([]);
  const uploadMockRef = useRef(null);
  const [uploadMockVisible, setUploadMockVisible] = useState(false);

  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [count1, setCount1] = useState(0);
  const [count2, setCount2] = useState(0);
  const [count3, setCount3] = useState(0);

  // 비로그인도 앱 화면(허브)을 볼 수 있으므로 시작 CTA는 로그인 여부와 무관하게 제품으로 보낸다.
  // 로그인은 허브에서 실제 기능을 누를 때 요구한다.
  const go = () => navigate('/app');
  const goLogin = () => navigate('/login');

  useEffect(() => { setHeroVisible(true); }, []);

  // 업로드 목업이 화면에 보일 때만 애니메이션 루프 실행 (백그라운드 타이머 낭비 방지)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setUploadMockVisible(entry.isIntersecting),
      { threshold: 0.15 }
    );
    if (uploadMockRef.current) observer.observe(uploadMockRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!uploadMockVisible) {
      panelTimers.current.forEach(clearTimeout);
      return;
    }
    const run = (k) => {
      panelTimers.current.forEach(clearTimeout);
      setPanelAnimKey(k);
      setPanelAnim(0);
      panelTimers.current = [
        setTimeout(() => setPanelAnim(1), 700),   // 드롭다운 메뉴 표시
        setTimeout(() => setPanelAnim(2), 1800),  // 내보내기 클릭 → 말풍선 날아감
        setTimeout(() => setPanelAnim(3), 2600),  // 직접입력 텍스트 팝인
        setTimeout(() => setPanelAnim(4), 4100),  // 파일 아이콘 날아감
        setTimeout(() => setPanelAnim(5), 4900),  // 관련파일 팝인
        setTimeout(() => run(k + 1), 6800),       // 리셋 후 반복
      ];
    };
    run(0);
    return () => panelTimers.current.forEach(clearTimeout);
  }, [uploadMockVisible]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.2 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  // 카운트업: setInterval 3개 → rAF 1개 (프레임 동기화 + ease-out으로 더 부드럽게)
  useEffect(() => {
    if (!statsVisible) return;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    let raf;
    const start = performance.now();
    const frame = (now) => {
      const elapsed = now - start;
      setCount1(parseFloat((13.4 * easeOut(Math.min(elapsed / 1400, 1))).toFixed(1)));
      setCount2(parseFloat((19.4 * easeOut(Math.min(elapsed / 1600, 1))).toFixed(1)));
      setCount3(parseFloat((84.5 * easeOut(Math.min(elapsed / 1800, 1))).toFixed(1)));
      if (elapsed < 1800) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [statsVisible]);

  return (
    <div role="main" className="min-h-screen bg-[#f0f2f7] w-full overflow-x-hidden">

      {/* ── FLOATING HEADER ── */}
      <div className="fixed top-4 sm:top-6 inset-x-0 z-50 px-3 sm:px-4 flex justify-center">
        <div className="bg-[#f3f4f6]/95 backdrop-blur-md rounded-full px-2 py-1.5 flex items-center justify-between gap-2 sm:gap-4 md:gap-6 shadow-sm border border-gray-200/50 w-full max-w-[min(100%,400px)] md:max-w-none md:w-auto">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 px-2 sm:px-3 shrink-0">
            <img src="/logo.png" alt="FitPoly" className="h-5 w-auto" />
            <span className="font-extrabold text-[16px] sm:text-[17px] text-gray-900 tracking-tight">FitPoly</span>
          </button>
          <nav className="hidden md:flex items-center gap-5 text-[15px] font-medium text-gray-600 px-2">
            <a href="#feature-experience" className="hover:text-black transition-colors">경험정리</a>
            <a href="#feature-portfolio" className="hover:text-black transition-colors">포트폴리오</a>
            <button onClick={goLogin} className="hover:text-black transition-colors">로그인</button>
          </nav>
          <button onClick={go} className="bg-gray-900 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-[14px] sm:text-[15px] font-bold hover:bg-black transition-colors shrink-0 whitespace-nowrap">
            무료로 시작
          </button>
        </div>
      </div>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-[85vh] sm:min-h-[90vh] md:min-h-[1000px] bg-[#fdfdfd] flex flex-col items-center justify-center overflow-hidden">

        {/* Background Icons — hidden on mobile, shown on md+ */}
        <div className="absolute inset-0 w-full h-full max-w-[1200px] mx-auto pointer-events-none">
          {/* Notion */}
          <div className="hidden md:flex absolute top-[20%] left-[18%] w-16 h-16 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-slow" style={{ animationDelay: '0s' }}>
            <BrandIcon name="Notion" className="w-8 h-8" />
          </div>
          {/* GitHub */}
          <div className="hidden md:flex absolute top-[18%] right-[22%] w-14 h-14 bg-[#181717] rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] items-center justify-center animate-float-medium" style={{ animationDelay: '1.5s' }}>
            <BrandIcon name="GitHub" className="w-8 h-8" />
          </div>
          {/* KakaoTalk */}
          <div className="hidden lg:flex absolute bottom-[35%] left-[15%] w-20 h-20 bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-fast" style={{ animationDelay: '0.5s' }}>
            <BrandIcon name="KakaoTalk" className="w-12 h-12" />
          </div>
          {/* Slack */}
          <div className="hidden lg:flex absolute top-[40%] left-[8%] w-12 h-12 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] items-center justify-center animate-float-slow" style={{ animationDelay: '2s' }}>
            <BrandIcon name="Slack" className="w-7 h-7" />
          </div>
          {/* Figma */}
          <div className="hidden md:flex absolute bottom-[28%] right-[15%] w-16 h-16 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-medium" style={{ animationDelay: '3s' }}>
            <BrandIcon name="Figma" className="w-8 h-8" />
          </div>
          {/* Google Drive */}
          <div className="hidden lg:flex absolute top-[10%] right-[38%] w-12 h-12 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-fast" style={{ animationDelay: '1s' }}>
            <BrandIcon name="Google Drive" className="w-6 h-6" />
          </div>
          {/* PDF */}
          <div className="hidden lg:flex absolute bottom-[20%] right-[35%] w-14 h-14 bg-white rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-slow" style={{ animationDelay: '2.5s' }}>
            <BrandIcon name="PDF" className="w-8 h-8" />
          </div>
          {/* Google Docs */}
          <div className="hidden md:flex absolute top-[55%] right-[10%] w-[72px] h-[72px] bg-white rounded-[22px] shadow-[0_12px_40px_rgb(0,0,0,0.08)] items-center justify-center animate-float-medium" style={{ animationDelay: '0.8s' }}>
            <BrandIcon name="Google Docs" className="w-9 h-9" />
          </div>
          {/* Gmail */}
          <div className="hidden lg:flex absolute bottom-[15%] left-[35%] w-14 h-14 bg-white rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-fast" style={{ animationDelay: '1.8s' }}>
            <BrandIcon name="Gmail" className="w-8 h-8" />
          </div>
          {/* Discord */}
          <div className="hidden lg:flex absolute top-[12%] left-[35%] w-12 h-12 bg-[#5865F2] rounded-2xl shadow-[0_8px_30px_rgb(88,101,242,0.25)] items-center justify-center animate-float-slow" style={{ animationDelay: '0.3s' }}>
            <BrandIcon name="Discord" className="w-7 h-7" />
          </div>
        </div>

        {/* Center Text */}
        <div className={`relative z-10 text-center flex flex-col items-center justify-center transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} px-4 sm:px-6 -mt-6 sm:-mt-8 md:-mt-16`}>
          <h1 className="text-[26px] sm:text-[38px] md:text-[60px] lg:text-[68px] font-extrabold leading-[1.25] text-gray-900 tracking-[-0.03em] flex flex-col items-center gap-1 mb-7 sm:mb-8">
            <span>여기저기 흩어진 경험들,</span>
            <span>어떻게 관리하고 계시나요?</span>
          </h1>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={go}
              className="w-full sm:w-auto bg-gray-900 text-white px-7 py-3.5 rounded-full text-[16px] font-bold hover:bg-black transition-colors shadow-lg shadow-gray-900/20 flex items-center justify-center gap-2"
            >
              지금 무료로 시작하기
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => document.getElementById('feature-experience')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto text-gray-500 px-5 py-3 text-[15px] font-medium hover:text-gray-800 transition-colors flex items-center justify-center gap-1.5"
            >
              어떻게 작동하나요?
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ── PROBLEM DEFINITION ── */}
      <section className="bg-white py-16 sm:py-20 md:py-24 pb-8 sm:pb-12">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 md:px-8">
          <div className="mb-10 sm:mb-14 text-center">
            <h2 className="text-[26px] sm:text-[32px] md:text-[40px] font-extrabold text-gray-900 mb-4 tracking-tight leading-[1.3]">
              취업 준비, 스펙보다<br className="sm:hidden" />
              <span className="text-indigo-600"> 경험정리</span>가 먼저입니다
            </h2>
            <p className="text-[16px] sm:text-[18px] text-gray-500 font-medium">2025년 데이터가 말해주는, 경험정리를 미루면 벌어지는 일</p>
          </div>

          <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 md:gap-8 mb-12 sm:mb-16">
            {/* Top Left Card: 매번 처음부터 다시 쓰는 자소서 (지원 횟수) */}
            <div className="bg-[#f8f9fc] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
              <div className="mb-8">
                <h3 className="text-[20px] sm:text-[24px] font-extrabold text-gray-900 mb-3 leading-snug">
                  정리를 미뤘더니,<br/>매번 백지에서 다시 써요
                </h3>
                 <p className="text-[15px] sm:text-[17px] text-gray-500 leading-relaxed font-medium">
                  새 공고가 뜰 때마다 기억을 더듬어 자소서를 처음부터. 한 시즌에 다시 쓰는 양은 생각보다 많습니다.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100">
                <p className="text-[13px] font-bold text-gray-500 mb-3">구직 대학생 1인당 연간 지원 횟수</p>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {Array.from({ length: 14 }, (_, i) => (
                    <div
                      key={i}
                      className="rounded-md transition-all duration-500"
                      style={{
                        width: '20px',
                        height: '24px',
                        background: statsVisible && i < 14 ? '#1B264F' : '#E5E7EB',
                        transitionDelay: `${i * 70}ms`,
                        transform: statsVisible && i < 14 ? 'scale(1)' : 'scale(0.6)',
                        opacity: statsVisible && i < 14 ? 1 : 0.5,
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-[32px] sm:text-[36px] font-extrabold text-gray-900 leading-none tabular-nums">
                    {count1.toFixed(1)}<span className="text-[20px] text-gray-500">회</span>
                  </span>
                  <span className="text-[13px] font-bold text-gray-400 mb-1">의 자소서·포트폴리오</span>
                </div>
              </div>
            </div>

            {/* Top Right Card: 서류 합격률 하락 */}
            <div className="bg-[#f8f9fc] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
              <div className="mb-8">
                <h3 className="text-[20px] sm:text-[24px] font-extrabold text-gray-900 mb-3 leading-snug">
                  열심히 보내도,<br/>10곳 중 2곳만 통과해요
                </h3>
                 <p className="text-[15px] sm:text-[17px] text-gray-500 leading-relaxed font-medium">
                  정리되지 않은 경험으로는 기업이 원하는 한 줄을 뽑기 어렵습니다. 서류 합격률은 해마다 더 낮아지고 있어요.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 h-[190px] flex items-end gap-8 sm:gap-12 px-6 sm:px-12 justify-center">
                <div className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                  <span
                    className="text-[15px] font-extrabold text-gray-400 mb-1 transition-all duration-500"
                    style={{ opacity: statsVisible ? 1 : 0, transform: statsVisible ? 'translateY(0)' : 'translateY(8px)', transitionDelay: '0.5s' }}
                  >22.2%</span>
                  <div
                    className="w-10 sm:w-14 bg-gray-200 rounded-t-md"
                    style={{ height: statsVisible ? '74%' : '0%', transition: 'height 0.8s ease-out 0.2s' }}
                  />
                  <span className="text-[13px] font-bold text-gray-500">2024년</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                  <span
                    className="text-[19px] font-extrabold text-[#1B264F] mb-1 transition-all duration-500"
                    style={{ opacity: statsVisible ? 1 : 0, transform: statsVisible ? 'translateY(0)' : 'translateY(8px)', transitionDelay: '0.9s' }}
                  >{count2.toFixed(1)}%</span>
                  <div
                    className="w-10 sm:w-14 bg-[#1B264F] rounded-t-md"
                    style={{ height: statsVisible ? '64.6%' : '0%', transition: 'height 0.9s cubic-bezier(0.34,1.56,0.64,1) 0.5s' }}
                  />
                  <span className="text-[13px] font-bold text-[#1B264F]">2025년</span>
                </div>
              </div>
            </div>

            {/* Bottom Card: 어디서부터 막막함 - Full Width */}
            <div className="md:col-span-2 bg-[#f8f9fc] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
              <div className="flex-1">
                <h3 className="text-[20px] sm:text-[26px] font-extrabold text-gray-900 mb-4 leading-snug">
                  무엇부터 써야 할지<br/>몰라 막막해요
                </h3>
                 <p className="text-[15px] sm:text-[17px] text-gray-500 leading-relaxed font-medium mb-6 lg:max-w-[480px]">
                  취준생 10명 중 8명 이상이 '뭘 준비해야 할지 모르겠다'고 말합니다. 시작은 거창한 스펙이 아니라, <strong className="text-[#1B264F]">흩어진 내 경험을 한곳에 모으는 것</strong>부터예요.
                </p>
              </div>
              <div className="w-full md:w-[340px] bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col justify-center relative overflow-hidden">
                <p className="text-[15px] font-bold text-gray-500">취업 준비가 막막하다고 답한 취준생</p>
                <div className="flex items-baseline gap-1.5 mt-1 mb-5">
                  <span className="text-[46px] sm:text-[52px] font-extrabold text-gray-900 tracking-tighter leading-none tabular-nums">
                    {count3.toFixed(1)}
                  </span>
                  <span className="text-[20px] font-bold text-gray-500">%</span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-md transition-all duration-500"
                        style={{
                          height: '32px',
                          background: statsVisible && i < 8 ? '#1B264F' : '#E5E7EB',
                          transitionDelay: `${i * 110 + 400}ms`,
                          transform: statsVisible && i < 8 ? 'scaleY(1)' : 'scaleY(0.4)',
                          transformOrigin: 'bottom',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 출처 */}
          <p className="text-center text-[12px] sm:text-[13px] text-gray-400 -mt-6 sm:-mt-10 mb-12 sm:mb-16 font-medium">
            출처 · 한국경제인협회 「2025년 대학생 취업인식도 조사」 (전국 4년제 대학생·졸업생 2,492명), 잡코리아 취업준비 설문
          </p>

          {/* Gray Box → 해결책 브릿지 */}
          <div className="bg-gray-900 rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 md:p-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full mb-4 sm:mb-6">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[13px] font-bold text-white/70">FitPoly의 해결책</span>
            </div>
            <h3 className="text-[20px] sm:text-[26px] md:text-[32px] font-extrabold text-white leading-[1.3] mb-4 sm:mb-5">
              흩어진 자료, 한 곳에서<br />AI가 경험으로 정리해드립니다
            </h3>
            <p className="text-[15px] sm:text-[17px] text-white/60 leading-[1.6] mb-8 sm:mb-10 font-medium max-w-[520px] mx-auto">
              어떤 형식이든 괜찮아요. 카카오톡 대화, PDF, Notion 링크, 직접 입력까지—<br />
              <span className="text-white/90 font-bold">12분 안에</span> 구조화된 경험 아카이브가 완성됩니다
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4 mb-8 sm:mb-10">
              {[
                { name: 'KakaoTalk', bg: 'bg-white' },
                { name: 'Notion', bg: 'bg-white' },
                { name: 'Google Drive', bg: 'bg-white' },
                { name: 'Gmail', bg: 'bg-white' },
                { name: 'Slack', bg: 'bg-white' },
                { name: 'Discord', bg: 'bg-[#5865F2]' },
                { name: 'Figma', bg: 'bg-white' },
                { name: 'Google Docs', bg: 'bg-white' },
                { name: 'PDF', bg: 'bg-white' },
                { name: 'GitHub', bg: 'bg-[#181717]' },
              ].map((icon, i) => (
                <div key={i} className={`w-10 h-10 sm:w-12 sm:h-12 md:w-[56px] md:h-[56px] ${icon.bg} rounded-xl sm:rounded-2xl shadow-lg flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity`}>
                  <BrandIcon name={icon.name} className={`${icon.name === 'KakaoTalk' ? 'w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9' : 'w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7'}`} />
                </div>
              ))}
            </div>

            <button onClick={go} className="bg-white text-gray-900 px-7 py-3.5 rounded-full text-[15px] font-bold hover:bg-gray-100 transition-colors shadow-lg inline-flex items-center gap-2">
              지금 바로 경험 정리 시작하기
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FEATURE 1 — 경험 정리 ── */}
      <section id="feature-experience" className="py-16 sm:py-20 md:py-24 bg-white">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 xl:px-16">
          <div className="mb-10 sm:mb-14 md:mb-16">
            <div className="flex items-center gap-2 mb-4 sm:mb-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-[12px] font-bold rounded-lg tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                핵심 기능 01
              </span>
              <span className="text-[13px] font-semibold text-primary-500">경험 정리</span>
            </div>
            <h2 className="text-[24px] sm:text-[32px] md:text-[40px] font-extrabold text-gray-900 leading-[1.25] mb-4" style={{ wordBreak: 'keep-all' }}>
              흩어진 자료들을<br />
              <span className="text-primary-600">하나의 경험 아카이브로</span>
            </h2>
            <p className="text-[16px] sm:text-[17px] text-gray-500 leading-relaxed max-w-[560px] font-medium">
              어떤 파일이든 업로드하면 AI가 내용을 분석해 구조화된 경험으로 정리해줍니다. 카카오톡 대화도, PDF도 모두 OK.
            </p>
          </div>

          {/* 파일 업로드 */}
          <div ref={uploadMockRef} className="bg-[#f8f9fc] rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 mb-6 sm:mb-8">
            <style>{`
              @keyframes exportBubble {
                0%   { transform: translateX(0) scale(1); opacity: 1; }
                45%  { transform: translateX(18px) scale(0.82); opacity: 0.55; }
                100% { transform: translateX(64px) scale(0.28); opacity: 0; }
              }
              @keyframes exportFile {
                0%   { transform: translateX(0) scale(1); opacity: 1; }
                45%  { transform: translateX(-18px) scale(0.82); opacity: 0.55; }
                100% { transform: translateX(-64px) scale(0.28); opacity: 0; }
              }
              @keyframes cardPopIn {
                0%   { transform: scale(0.72) translateY(14px); opacity: 0; }
                62%  { transform: scale(1.05) translateY(-3px); opacity: 1; }
                100% { transform: scale(1) translateY(0); opacity: 1; }
              }
              @keyframes menuSlideIn {
                0%   { transform: translateY(-6px) scale(0.95); opacity: 0; }
                100% { transform: translateY(0) scale(1); opacity: 1; }
              }
              @keyframes dropzonePulse {
                0%   { border-color: #cbd5e1; box-shadow: none; }
                50%  { border-color: #002F6C; box-shadow: 0 0 0 3px rgba(0,47,108,0.12); }
                100% { border-color: #cbd5e1; box-shadow: none; }
              }
            `}</style>
            <div className="mb-6 sm:mb-8">
              <span className="inline-block px-2.5 py-1 bg-primary-100 text-primary-700 text-[13px] font-bold rounded mb-3">파일 업로드</span>
              <h3 className="text-[20px] sm:text-[26px] font-extrabold text-primary-600 leading-[1.3]" style={{ wordBreak: 'keep-all' }}>
                어떤 파일이든, <span className="text-primary-500">숨겨진 경험을 꺼냅니다</span>
              </h3>
            </div>
            <ResponsiveScaleWrapper minWidth={900}>
              <div className="flex flex-row gap-0 items-start w-full">

                {/* ── Panel 1: 카카오톡 모바일 ── */}
                <div className="flex-1 flex flex-col items-center min-w-0">
                  <span className="text-[13px] font-bold text-bluewood-500 mb-2.5">카카오톡 대화 내보내기</span>
                  {/* 외부 wrapper: dropdown이 phone 밖으로 overflow */}
                  <div className="relative" style={{ width: '210px' }}>
                    <div className="bg-[#aec5d8] rounded-[28px] overflow-hidden shadow-xl" style={{ border: '5px solid #8db5cd' }}>
                      {/* 상태바 */}
                      <div className="bg-[#93aec4] px-3.5 pt-2 pb-1 flex items-center justify-between">
                        <span style={{ fontSize: '8px', fontWeight: 700, color: '#2c4a62' }}>9:41</span>
                        <div className="flex gap-1.5 items-center">
                          <div className="flex items-end gap-px" style={{ height: '8px' }}>
                            <div className="w-[2px] bg-[#2c4a62] rounded-sm" style={{ height: '40%' }} />
                            <div className="w-[2px] bg-[#2c4a62] rounded-sm" style={{ height: '60%' }} />
                            <div className="w-[2px] bg-[#2c4a62] rounded-sm" style={{ height: '80%' }} />
                            <div className="w-[2px] rounded-sm" style={{ height: '100%', backgroundColor: 'rgba(44,74,98,0.35)' }} />
                          </div>
                          <div className="relative flex items-center" style={{ width: '22px', height: '11px' }}>
                            <div className="w-full h-full border border-[#2c4a62] rounded-[2px] flex items-center px-[2px]">
                              <div className="bg-[#2c4a62] rounded-[1px]" style={{ width: '70%', height: '7px' }} />
                            </div>
                            <div className="absolute bg-[#2c4a62] rounded-r-[1px]" style={{ right: '-3px', top: '3px', width: '2px', height: '5px' }} />
                          </div>
                        </div>
                      </div>
                      {/* 앱 헤더 */}
                      <div className="bg-[#93aec4] px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(122,153,179,0.3)' }}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#c5dced] flex items-center justify-center" style={{ fontSize: '11px' }}>👤</div>
                          <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#2c4a62' }}>나 (나에게 쓰기)</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <Search size={10} className="text-[#5a7a94]" />
                          <List size={10} style={{ color: panelAnim === 1 ? '#002F6C' : '#5a7a94', transition: 'color 0.2s' }} />
                        </div>
                      </div>
                      {/* 채팅 영역 */}
                      <div className="px-2.5 py-2.5 space-y-2.5" style={{ minHeight: '290px' }}>
                        <div className="text-center">
                          <span style={{ fontSize: '7px', backgroundColor: 'rgba(143,174,196,0.7)', color: '#2c4a62', padding: '1px 8px', borderRadius: '999px' }}>2026년 4월 29일 수요일</span>
                        </div>
                        <div className="flex justify-end">
                          <div className="bg-[#ffee00] shadow-sm" style={{ borderRadius: '14px 4px 14px 14px', maxWidth: '75%', padding: '6px 8px' }}>
                            <p style={{ fontSize: '8.5px', fontWeight: 600, color: '#1f2937', lineHeight: 1.3 }}>로그인 화면 로딩 지연 이슈 내일 물어볼 것!!</p>
                            <p style={{ fontSize: '7px', color: '#6b7280', textAlign: 'right', marginTop: '2px' }}>오후 2:30</p>
                          </div>
                        </div>
                        {/* 애니메이션 말풍선 */}
                        <div key={panelAnimKey} className="flex justify-end">
                          <div
                            className="bg-[#ffee00] shadow-sm"
                            style={{
                              borderRadius: '14px 4px 14px 14px',
                              maxWidth: '80%',
                              padding: '6px 8px',
                              animation: panelAnim === 2 ? 'exportBubble 0.65s ease-in forwards' : 'none',
                              opacity: panelAnim >= 3 ? 0 : 1,
                              transition: panelAnim >= 3 ? 'opacity 0.15s' : 'none',
                            }}
                          >
                            <p style={{ fontSize: '8.5px', fontWeight: 600, color: '#1f2937', lineHeight: 1.3 }}>A/B 테스트 기획안 마무리. 기존 대비 전환율 15% 상승 예상됨.</p>
                            <p style={{ fontSize: '7px', color: '#6b7280', textAlign: 'right', marginTop: '2px' }}>오후 5:42</p>
                          </div>
                        </div>
                      </div>
                      {/* 입력바 */}
                      <div className="px-2.5 pb-2 bg-[#aec5d8]">
                        <div className="rounded-full flex items-center gap-1.5 px-2.5 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
                          <span style={{ fontSize: '12px' }}>😊</span>
                          <span style={{ fontSize: '12px' }}>📎</span>
                        </div>
                      </div>
                      {/* 홈 인디케이터 */}
                      <div className="flex justify-center pb-2.5">
                        <div className="rounded-full" style={{ width: '52px', height: '4px', backgroundColor: 'rgba(90,122,148,0.38)' }} />
                      </div>
                    </div>
                    {/* 드롭다운 — overflow-hidden 바깥에 위치해 창 밖으로 넘어감 */}
                    {panelAnim === 1 && (
                      <div style={{ position: 'absolute', top: '46px', left: '44px', zIndex: 30, animation: 'menuSlideIn 0.18s ease-out both' }}>
                        {/* 메인 메뉴 */}
                        <div style={{ width: '160px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 6px 28px rgba(0,0,0,0.22)', paddingTop: '3px', paddingBottom: '3px' }}>
                          <div style={{ padding: '2px 10px', fontSize: '7.5px', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>+ 대화상대 초대하기</span><span style={{ color: '#9ca3af', fontSize: '7px' }}>Ctrl+I</span>
                          </div>
                          {['채팅방 서랍', '토클캘린더', '통계사판', '브리핑 보드'].map((item, i) => (
                            <div key={i} style={{ padding: '2px 10px', fontSize: '7.5px', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>{item}</span>
                              {item === '채팅방 서랍' && <span style={{ fontSize: '8px', color: '#9ca3af' }}>›</span>}
                            </div>
                          ))}
                          <div style={{ height: '1px', background: '#f3f4f6', margin: '2px 0' }} />
                          {['보이스톡', '페이스톡'].map((item, i) => (
                            <div key={i} style={{ padding: '2px 10px', fontSize: '7.5px', color: '#6b7280' }}>{item}</div>
                          ))}
                          <div style={{ height: '1px', background: '#f3f4f6', margin: '2px 0' }} />
                          <div style={{ padding: '2px 10px', fontSize: '7.5px', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                            <span>보내기</span><span style={{ fontSize: '8px', color: '#9ca3af' }}>›</span>
                          </div>
                          <div style={{ padding: '2px 10px', fontSize: '7.5px', color: '#374151', fontWeight: 700, background: '#f0f4ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>대화 내용</span><span style={{ fontSize: '8px', color: '#002F6C' }}>›</span>
                          </div>
                          <div style={{ height: '1px', background: '#f3f4f6', margin: '2px 0' }} />
                          <div style={{ padding: '2px 10px', fontSize: '7.5px', color: '#6b7280' }}>채팅방 나가기</div>
                        </div>
                        {/* 서브메뉴 — 메인 메뉴 오른쪽으로 넘어감 */}
                        <div style={{ position: 'absolute', top: '82px', left: '160px', width: '134px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 18px rgba(0,0,0,0.18)', paddingTop: '3px', paddingBottom: '3px' }}>
                          <div style={{ padding: '2px 10px', fontSize: '7.5px', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                            <span>대화 검색</span><span style={{ color: '#9ca3af', fontSize: '7px' }}>Ctrl+F</span>
                          </div>
                          <div style={{ padding: '2px 10px', fontSize: '7.5px', color: '#6b7280' }}>대화 캡처</div>
                          <div style={{ padding: '3px 10px', fontSize: '7.5px', color: '#002F6C', fontWeight: 700, background: '#eff6ff', borderLeft: '2px solid #002F6C', display: 'flex', justifyContent: 'space-between' }}>
                            <span>대화 내보내기</span><span style={{ color: '#4a7fd4', fontSize: '7px' }}>Ctrl+S</span>
                          </div>
                          <div style={{ padding: '2px 10px', fontSize: '7.5px', color: '#ef4444' }}>대화 내용 모두 삭제</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Arrow: 카카오톡 → AI Canvas ── */}
                <div style={{ flexShrink: 0, alignSelf: 'center', paddingTop: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" stroke={panelAnim === 2 || panelAnim === 3 ? '#002F6C' : '#c9d4e3'} strokeWidth="3" style={{ transition: 'stroke 0.4s' }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>

                {/* ── 가운데: 자료 수집 UI 목업 ── */}
                <div className="flex-1 flex flex-col min-w-0">
                  <span className="text-[13px] font-bold text-bluewood-500 mb-2.5 block text-center">AI 경험 정리 보드</span>
                  <div
                    className="bg-white rounded-2xl overflow-hidden shadow-md flex flex-col transition-all duration-300"
                    style={{
                      border: panelAnim === 3 || panelAnim === 5
                        ? '1.5px solid rgba(0,47,108,0.28)'
                        : '1px solid #e5e7eb',
                      boxShadow: panelAnim === 3 || panelAnim === 5
                        ? '0 0 0 3px rgba(0,47,108,0.08)'
                        : undefined,
                    }}
                  >
                    {/* 단계 표시 */}
                    <div className="px-3 py-2 flex items-center gap-1 shrink-0" style={{ backgroundColor: '#f8f9fc', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: '8.5px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Check size={9} style={{ color: '#6b7280' }} /> 기본 정보
                      </span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#002F6C', margin: '0 4px' }} />
                      <span style={{ fontSize: '8.5px', backgroundColor: '#002F6C', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>2 자료 수집</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
                      <span style={{ fontSize: '8.5px', color: '#9ca3af' }}>3 경험 검토</span>
                    </div>

                    <div className="p-3 space-y-2.5">
                      {/* 관련 파일 */}
                      <div className="rounded-xl p-2.5" style={{ border: '1px solid #e5e7eb' }}>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>관련 파일</p>
                        <div
                          className="rounded-lg p-2.5 text-center"
                          style={{
                            border: '1.5px dashed #cbd5e1',
                            backgroundColor: panelAnim >= 5 ? 'rgba(0,47,108,0.03)' : '#fafbfc',
                            animation: panelAnim === 4 ? 'dropzonePulse 0.8s ease-in-out' : 'none',
                          }}
                        >
                          {panelAnim >= 5 ? (
                            <div key={`file-${panelAnimKey}`} className="flex items-center justify-center gap-2" style={{ animation: 'cardPopIn 0.35s ease-out both' }}>
                              <div className="rounded flex items-center justify-center text-white" style={{ width: '22px', height: '22px', backgroundColor: '#b30b00', fontSize: '7px', fontWeight: 700 }}>PDF</div>
                              <span style={{ fontSize: '9px', color: '#374151', fontWeight: 600 }}>경쟁사_분석.pdf</span>
                              <Check size={10} style={{ color: '#22c55e' }} />
                            </div>
                          ) : (
                            <>
                              <p style={{ fontSize: '9px', fontWeight: 600, color: '#475569' }}>클릭하여 파일을 선택하세요</p>
                              <p style={{ fontSize: '7.5px', color: '#94a3b8', marginTop: '2px' }}>PDF, 이미지 · 최대 25MB · HWP는 PDF 변환 후 업로드</p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 직접 입력 */}
                      <div className="rounded-xl p-2.5" style={{ border: '1px solid #e5e7eb' }}>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>직접 입력</p>
                        <div
                          className="rounded-lg p-2.5 transition-colors duration-300"
                          style={{ border: '1px solid #e5e7eb', minHeight: '58px', backgroundColor: panelAnim >= 3 ? '#fff' : '#fafbfc' }}
                        >
                          {panelAnim >= 3 ? (
                            <p key={`txt-${panelAnimKey}`} style={{ fontSize: '8.5px', color: '#334155', lineHeight: 1.5, animation: 'cardPopIn 0.35s ease-out both' }}>
                              A/B 테스트 기획안 마무리.<br />
                              기존 대비 전환율 <span style={{ color: '#002F6C', fontWeight: 700 }}>15% 상승</span> 예상됨.
                            </p>
                          ) : (
                            <p style={{ fontSize: '8.5px', color: '#94a3b8', lineHeight: 1.5 }}>
                              프로젝트나 업무에 대해 자유롭게 적어주세요.<br />
                              <span style={{ color: '#b0bec5' }}>- 어떤 프로젝트/활동이었나요?</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 링크 */}
                      <div className="rounded-xl p-2.5" style={{ border: '1px solid #e5e7eb' }}>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>링크</p>
                        <div className="space-y-1.5">
                          {[
                            'Notion 페이지 URL',
                            'GitHub 리포지토리 URL',
                            '블로그 또는 기타 URL',
                          ].map((label, i) => (
                            <div key={i} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ border: '1px solid #e5e7eb', backgroundColor: '#fafbfc' }}>
                              <span style={{ fontSize: '8.5px', color: '#94a3b8' }}>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* AI 시작 버튼 */}
                    <div className="px-3 pb-3">
                      <button
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: '#002F6C',
                          color: '#fff',
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: 700,
                          boxShadow: panelAnim >= 5 ? '0 0 0 3px rgba(0,47,108,0.22)' : 'none',
                          transform: panelAnim >= 5 ? 'scale(1.015)' : 'scale(1)',
                          transition: 'box-shadow 0.3s, transform 0.3s',
                        }}
                      >
                        AI로 경험 정리 시작
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Arrow: 파일탐색기 → AI Canvas (왼쪽 방향) ── */}
                <div style={{ flexShrink: 0, alignSelf: 'center', paddingTop: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" stroke={panelAnim === 4 || panelAnim === 5 ? '#002F6C' : '#c9d4e3'} strokeWidth="3" style={{ transition: 'stroke 0.4s' }}>
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </div>

                {/* ── Panel 3: Windows 파일 탐색기 ── */}
                <div className="flex-1 flex flex-col items-center min-w-0">
                  <span className="text-[13px] font-bold text-bluewood-500 mb-2.5 block text-center">파편화된 문서 파일들</span>
                  <div style={{ width: '340px', background: '#1e1e1e', borderRadius: '8px', overflow: 'hidden', border: '1px solid #3c3c3c', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                    {/* 타이틀바 */}
                    <div style={{ background: '#2b2b2b', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '5px', borderBottom: '1px solid #3c3c3c' }}>
                      <span style={{ fontSize: '11px' }}>📁</span>
                      <div style={{ background: '#3a3a3a', padding: '2px 8px 0', borderRadius: '5px 5px 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '8px', color: '#e2e8f0', fontWeight: 600 }}>문서</span>
                        <span style={{ fontSize: '9px', color: '#6b7280' }}>×</span>
                      </div>
                      <div style={{ flex: 1 }} />
                      {[{ c: '−', bg: '#3c3c3c', fg: '#9ca3af' }, { c: '□', bg: '#3c3c3c', fg: '#9ca3af' }, { c: '×', bg: '#c42b1c', fg: '#fff' }].map((w, i) => (
                        <div key={i} style={{ width: '16px', height: '16px', borderRadius: '2px', background: w.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: w.fg }}>{w.c}</div>
                      ))}
                    </div>
                    {/* 네비게이션 바 제거됨 */}
                    {/* 툴바 */}
                    <div style={{ background: '#2b2b2b', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '3px', borderBottom: '1px solid #3c3c3c' }}>
                      {['+ 새로 만들기', '✂', '📋', '🗑', '↑↓ 정렬', '⊞ 보기', '···'].map((b, i) => (
                        <div key={i} style={{ padding: '1.5px 4px', background: '#3c3c3c', borderRadius: '3px', fontSize: '6px', color: '#d1d5db', whiteSpace: 'nowrap' }}>{b}</div>
                      ))}
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: '6px', color: '#6b7280', whiteSpace: 'nowrap' }}>세부 정보</span>
                    </div>
                    {/* 메인 영역 */}
                    <div style={{ display: 'flex', minHeight: '250px' }}>
                      {/* 사이드바 */}
                      <div style={{ width: '74px', background: '#1a1a1a', borderRight: '1px solid #3c3c3c', padding: '5px 0', flexShrink: 0 }}>
                        {[['🖥', '바탕 화면'], ['🏠', '홈'], ['🖼', '갤러리'], ['📄', '문서', true], ['📷', '사진'], ['☁️', '형균-개인'], ['⬇', '다운로드'], ['🎬', '동영상'], ['🎵', '음악'], ['💻', '내 PC'], ['💾', '로컬 디스크']].map(([icon, label, active], i) => (
                          <div key={i} style={{ padding: '2px 8px', fontSize: '6.5px', color: active ? '#e2e8f0' : '#9ca3af', background: active ? '#3c3c3c' : 'transparent', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                            <span style={{ fontSize: '8px', flexShrink: 0 }}>{icon}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                          </div>
                        ))}
                      </div>
                      {/* 파일 그리드 */}
                      <div style={{ flex: 1, background: '#202020', padding: '7px 6px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 3px' }}>
                          {[
                            { name: '카카오톡\n받은파일',    type: 'folder' },
                            { name: '사용자지정\n서식파일',  type: 'folder' },
                            { name: '내문서백업',            type: 'folder' },
                            { name: '사용자_인터뷰\n.docx',  type: 'word' },
                            { name: 'A_B테스트\n_결과.xlsx', type: 'excel', anim: true },
                            { name: '이력서_최종\n.hwp',     type: 'hwp' },
                            { name: '런칭_전략\n_발표.pptx', type: 'ppt' },
                            { name: '경쟁사_분석\n.pdf',     type: 'pdf',   anim: true },
                            { name: 'UI_시안\n_v2.png',      type: 'image' },
                            { name: '회의록\n_0428.txt',     type: 'txt' },
                            { name: '제품_로드맵\n.xlsx',    type: 'excel' },
                            { name: '채용공고\n_분석.docx',  type: 'word' },
                          ].map((f, i) => {
                            const clr = { word: '#185abd', excel: '#107c41', ppt: '#c43e1c', hwp: '#00978d', pdf: '#b30b00', image: '#7c3aed', txt: '#546e7a' }[f.type] || '#6b7280';
                            const lbl = { word: 'W', excel: 'X', ppt: 'P', hwp: '한', pdf: 'PDF', image: '▣', txt: 'TXT' }[f.type] || '?';
                            return (
                              <div key={`${panelAnimKey}-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                <div style={{ animation: f.anim && panelAnim === 4 ? 'exportFile 0.65s ease-in forwards' : 'none', opacity: f.anim && panelAnim >= 5 ? 0 : 1, transition: f.anim && panelAnim >= 5 ? 'opacity 0.15s' : 'none' }}>
                                  {f.type === 'folder' ? (
                                    <div style={{ position: 'relative', width: '36px', height: '28px' }}>
                                      <div style={{ position: 'absolute', top: 0, left: '2px', width: '13px', height: '5px', background: '#c89820', borderRadius: '2px 3px 0 0' }} />
                                      <div style={{ position: 'absolute', top: '4px', left: 0, right: 0, bottom: 0, background: 'linear-gradient(160deg,#f2c640 0%,#e8a820 100%)', borderRadius: '0 3px 3px 3px', border: '1px solid #c08010' }} />
                                      <div style={{ position: 'absolute', top: '8px', left: '4px', right: '4px', height: '7px', background: 'rgba(255,235,150,0.35)', borderRadius: '1px' }} />
                                    </div>
                                  ) : (
                                    <div style={{ position: 'relative', width: '30px', height: '36px', background: '#f8f9fa', border: '1px solid #d1d5db', borderRadius: '2px', overflow: 'hidden' }}>
                                      <div style={{ position: 'absolute', top: 0, right: 0, width: '9px', height: '9px', background: 'linear-gradient(225deg,#d1d5db 50%,transparent 50%)' }} />
                                      <div style={{ position: 'absolute', top: '11px', left: '3px', right: '3px' }}>
                                        {[0,1,2].map(j => <div key={j} style={{ height: '1.5px', background: '#e5e7eb', marginBottom: '2px', width: j === 2 ? '60%' : '100%' }} />)}
                                      </div>
                                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '13px', background: clr, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: f.type === 'pdf' ? '5px' : '7px', fontWeight: 800, color: '#fff' }}>{lbl}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <span style={{ fontSize: '6.5px', color: '#c0c0c0', textAlign: 'center', lineHeight: 1.2 }}>
                                  {f.name.split('\n').map((p, j) => <span key={j}>{p}</span>)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {/* 상태바 */}
                    <div style={{ background: '#2b2b2b', padding: '2px 10px', borderTop: '1px solid #3c3c3c', fontSize: '7px', color: '#9ca3af' }}>
                      32개 항목
                    </div>
                  </div>
                </div>

              </div>
            </ResponsiveScaleWrapper>
          </div>

          {/* 핵심 추출 */}
          <div className="bg-[#f8f9fc] rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 mb-6 sm:mb-8">
            <ResponsiveScaleWrapper minWidth={1000}>
              <div className="flex flex-row-reverse flex-nowrap gap-10 items-start w-full">
                <div className="w-[380px] shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-caribbean-100 text-caribbean-700 text-[13px] font-bold rounded mb-4 sm:mb-6">AI 핵심 추출</span>
                <h3 className="text-[24px] sm:text-[30px] font-extrabold text-primary-600 leading-[1.3] mb-5 sm:mb-6" style={{ wordBreak: 'keep-all' }}>
                  중요한 건,<br />
                  <span className="text-primary-500">경험에서 핵심을<br />뽑아내는 것</span>
                </h3>
                <p className="text-[14px] sm:text-[15px] text-bluewood-500 leading-relaxed mb-5 sm:mb-6" style={{ wordBreak: 'keep-all' }}>
                  그럴듯한 미사여구가 아니라, 무엇이 진짜 성과였는지가 중요합니다.
                  AI가 흩어진 기록에서 <strong className="text-primary-600">문제·실행·결과·배운 점</strong>을 가려내고, 수치로 고정해줍니다.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['성과 수치화', '문제·실행·결과 구조화'].map((t, i) => (
                    <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-600 text-[14px] font-bold rounded-full border border-primary-100">{t}</span>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full min-w-0">
                <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-surface-200 text-left p-5 sm:p-7">
                  <div className="flex items-center justify-between border-b border-surface-100 pb-3 mb-4">
                    <h4 className="text-[16px] sm:text-[18px] font-extrabold text-[#1B264F]">핵심 경험</h4>
                    <span className="text-[12px] font-bold text-bluewood-400">3건</span>
                  </div>

                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-primary-600 text-white text-[12px] font-bold flex items-center justify-center">1</span>
                      <p className="text-[15px] sm:text-[17px] font-extrabold text-[#1B264F] leading-snug" style={{ wordBreak: 'keep-all' }}>설문 84명·인터뷰 12명으로 진짜 문제를 정의</p>
                    </div>
                    <span className="text-[12px] font-bold text-bluewood-400 shrink-0 mt-1">삭제</span>
                  </div>

                  <div className="space-y-4">
                    {[
                      { label: '성과', value: <span className="text-[15px] font-extrabold text-primary-600">78% 검증</span> },
                      { label: '문제', value: '"공지가 불편하다"는 막연한 체감만 있고, 무엇이 진짜 문제인지 합의가 없었습니다.' },
                      { label: '실행', value: '설문 84명과 심층 인터뷰 12명을 직접 설계·진행하고, 불편을 "찾기 어려움/놓침/반복 확인" 3가지 흐름으로 구조화했습니다.' },
                      { label: '결과', value: <><strong className="text-[#1B264F] font-bold">응답자의 78%가 "채널이 너무 많다"</strong>를 1순위 불편으로 꼽아, 채널 분산이 핵심 문제임을 데이터로 확정했습니다.</> },
                      { label: '배운 점', value: '문제를 수치로 고정하니 이후 모든 의사결정의 기준이 명확해졌습니다.' },
                    ].map((row, i) => (
                      <div key={i} className="grid grid-cols-[60px_1fr] sm:grid-cols-[72px_1fr] gap-3 sm:gap-4">
                        <span className="text-[13px] font-bold text-bluewood-400 pt-0.5">{row.label}</span>
                        <p className="text-[13px] sm:text-[14px] text-bluewood-600 leading-relaxed" style={{ wordBreak: 'keep-all' }}>{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </ResponsiveScaleWrapper>
          </div>

          {/* 완성된 결과물 — 이력서 */}
          <div className="bg-[#f8f9fc] rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12">
            <ResponsiveScaleWrapper minWidth={900}>
              <div className="flex flex-row flex-nowrap gap-10 items-start w-full">
                <div className="w-[380px] shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-700 text-[13px] font-bold rounded mb-3 sm:mb-4">완성된 결과물</span>
                <h3 className="text-[22px] sm:text-[26px] font-extrabold text-primary-600 leading-[1.35] mb-3 sm:mb-4" style={{ wordBreak: 'keep-all' }}>
                  흩어진 경험이,<br />
                  <span className="text-primary-500">한 장의 이력서로</span> 완성됩니다
                </h3>
                <p className="text-[14px] sm:text-[15px] text-bluewood-500 leading-relaxed mb-4 sm:mb-6" style={{ wordBreak: 'keep-all' }}>
                  정리된 경험에서 강점과 프로젝트가 자동으로 채워집니다.
                  기업에 맞춰 다듬어 바로 내보낼 수 있어요.
                </p>
                <div className="space-y-2">
                  {['강점·역량 자동 추출', '프로젝트 자동 정리', '기업 맞춤 내보내기'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[14px] sm:text-[12.5px] text-bluewood-500">
                      <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-indigo-600" />
                      </div>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full mt-0 lg:mt-4 min-w-0">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_20px_rgb(0,0,0,0.04)] overflow-hidden p-5 sm:p-7 md:p-9 text-left">
                  {/* Resume Header */}
                  <div className="flex items-start justify-between gap-4 mb-7 sm:mb-9">
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.2em] text-gray-400 mb-1.5">RESUME</p>
                      <h4 className="text-[26px] sm:text-[32px] font-extrabold text-[#1B264F] leading-none mb-2.5">김서연</h4>
                      <p className="text-[13px] sm:text-[14px] text-gray-500 font-medium" style={{ wordBreak: 'keep-all' }}>데이터 기반 서비스 기획으로 6개의 프로젝트를 이끌어온 주니어 PM</p>
                    </div>
                    <button className="shrink-0 px-3 py-1.5 border border-gray-200 rounded-lg text-[12px] font-bold text-gray-500 flex items-center gap-1.5 shadow-sm">
                      <PenTool size={11} /> 편집
                    </button>
                  </div>

                  {/* 3-column body */}
                  <div className="grid grid-cols-1 sm:grid-cols-[150px_150px_1fr] gap-7 sm:gap-8">
                    {/* Left: CONTACT + STRENGTHS */}
                    <div className="space-y-6">
                      <div>
                        <p className="text-[11px] font-bold tracking-[0.15em] text-gray-400 mb-2">CONTACT</p>
                        <a className="text-[13px] text-primary-600 font-semibold break-all">seoyeon.kim@gmail.com</a>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold tracking-[0.15em] text-gray-400 mb-3">STRENGTHS</p>
                        <div className="space-y-3">
                          {[
                            { t: '데이터 기반 문제 정의', s: '설문·VOC 분석에서 발휘한 역량' },
                            { t: 'AI 서비스 기획', s: '챗봇·자동화 프로젝트에서 발휘한 역량' },
                            { t: '협업 리딩', s: '5인 팀 프로젝트에서 발휘한 역량' },
                          ].map((it, i) => (
                            <div key={i}>
                              <p className="text-[13px] font-extrabold text-[#1B264F] leading-tight">{it.t}</p>
                              <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{it.s}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Middle: TOOLS */}
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.15em] text-gray-400 mb-3">TOOLS</p>
                      <div className="space-y-3">
                        {[
                          { t: 'Figma', c: 3 },
                          { t: 'Notion', c: 3 },
                          { t: 'GA4', c: 2 },
                          { t: 'SQL', c: 2 },
                          { t: 'Python', c: 1 },
                          { t: 'Amplitude', c: 1 },
                        ].map((it, i) => (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[13px] font-bold text-[#1B264F]">{it.t}</span>
                              <span className="text-[10px] font-bold text-gray-400">프로젝트 {it.c}</span>
                            </div>
                            <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#1B264F] rounded-full" style={{ width: `${(it.c / 3) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: PROJECTS */}
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.15em] text-gray-400 mb-3">PROJECTS</p>
                      <div className="space-y-4">
                        {[
                          { t: 'AI 챗봇 도입으로 CS 응대 시간 40% 단축', d: '단순 반복 문의 65%를 자동화해 상담 인력 부하를 크게 줄였습니다.', y: '2025' },
                          { t: '고객 여정 분석으로 결제 전환율 18% 향상', d: '이탈 구간을 데이터로 짚어 결제 플로우를 재설계했습니다.', y: '2025' },
                          { t: '교내 공지 통합 서비스, 공지 누락률 32% 감소', d: '5개 채널에 흩어진 공지를 한 화면으로 모았습니다.', y: '2024' },
                          { t: '온보딩 A/B 테스트로 초기 이탈률 개선', d: '가입 직후 첫 액션까지의 단계를 줄여 잔존율을 높였습니다.', y: '2024' },
                          { t: '주간 VOC 리포트 자동화', d: '수기로 모으던 고객 피드백을 대시보드로 정리했습니다.', y: '2023' },
                          { t: '설문 84명 기반 문제 정의 졸업 프로젝트', d: '체감에 머물던 불편을 수치로 고정해 문제를 확정했습니다.', y: '2023' },
                        ].map((it, i) => (
                          <div key={i} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] sm:text-[14px] font-extrabold text-[#1B264F] leading-snug" style={{ wordBreak: 'keep-all' }}>{it.t}</p>
                              <p className="text-[12px] text-gray-400 leading-snug mt-0.5" style={{ wordBreak: 'keep-all' }}>{it.d}</p>
                            </div>
                            <span className="text-[11px] font-bold text-gray-300 shrink-0 mt-0.5">{it.y}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </ResponsiveScaleWrapper>
          </div>
        </div>
      </section>

      {/* ── FEATURE 2 — 기업 맞춤 포트폴리오 ── */}
      <section id="feature-portfolio" className="py-16 sm:py-20 md:py-24 bg-[#f8f9fc]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 xl:px-16">
          <div className="mb-10 sm:mb-14 md:mb-16">
            <div className="flex items-center gap-2 mb-4 sm:mb-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-[12px] font-bold rounded-lg tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                핵심 기능 02
              </span>
              <span className="text-[13px] font-semibold text-gray-600">기업 맞춤 포트폴리오</span>
            </div>
            <h2 className="text-[24px] sm:text-[32px] md:text-[40px] font-extrabold text-gray-900 leading-[1.25] mb-4" style={{ wordBreak: 'keep-all' }}>
              채용공고 링크 하나로<br />
              <span className="text-gray-900">맞춤 포트폴리오 자동 완성</span>
            </h2>
            <p className="text-[16px] sm:text-[17px] text-gray-500 leading-relaxed max-w-[560px] font-medium">
              기업이 원하는 역량을 파악하고, 내 경험 중 가장 잘 맞는 것들로 포트폴리오를 조합해 드립니다.
            </p>
          </div>

          {/* 채용공고 분석 */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 mb-6 sm:mb-8">
            <ResponsiveScaleWrapper minWidth={900}>
              <div className="flex flex-row flex-nowrap gap-10 items-start w-full">
                <div className="w-[380px] shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-primary-100 text-primary-700 text-[13px] font-bold rounded mb-4 sm:mb-6">채용공고 분석</span>
                <h3 className="text-[24px] sm:text-[30px] font-extrabold text-primary-600 leading-[1.3] mb-6 sm:mb-8" style={{ wordBreak: 'keep-all' }}>
                  링크 하나면,<br />
                  <span className="text-primary-600">기업이 원하는 것을<br />알아냅니다</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['기업·직무 자동 분석', '지원 전략 생성'].map((t, i) => (
                    <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-600 text-[14px] font-bold rounded-full border border-primary-100">{t}</span>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full min-w-0">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Search size={14} className="text-bluewood-500" />
                      <p className="text-[14px] sm:text-[15px] font-bold text-primary-600">채용공고 분석</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 bg-surface-50 rounded-lg border border-surface-200 overflow-hidden">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[11px] font-bold rounded shrink-0">잡코리아</span>
                        <span className="text-[13px] sm:text-[14px] text-bluewood-500 truncate">https://www.jobkorea.co.kr/Recruit/GI_Read/291234</span>
                      </div>
                      <div className="px-3 sm:px-4 py-2 bg-[#1B264F] text-white rounded-lg text-[13px] sm:text-[14px] font-bold shrink-0">분석하기</div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-surface-100">
                      <div>
                        <p className="text-[15px] sm:text-[16px] font-bold text-primary-600">카카오 · UX 디자이너</p>
                        <p className="text-[12px] sm:text-[13px] text-bluewood-500 mt-0.5">IT/플랫폼 · 경력 1~3년</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {['Figma', 'Prototyping', 'User Research', 'Design System', 'Data Analysis', 'Communication'].map((tag, i) => (
                        <span key={i} className={`px-2 py-1 rounded-md text-[12px] font-semibold ${i < 3 ? 'bg-primary-50 text-primary-600' : 'bg-surface-100 text-bluewood-500'}`}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-surface-50 rounded-lg mb-4 overflow-x-auto">
                      {['기업 분석', '직무 분석', '지원 전략', '산업 트렌드'].map((tab, i) => (
                        <button key={i} className={`flex-1 min-w-fit py-1.5 px-2 rounded-md text-[12px] sm:text-[13px] font-semibold transition-all whitespace-nowrap ${i === 0 ? 'bg-white text-primary-600 shadow-sm' : 'text-bluewood-500'}`}>
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                      {[
                        { label: '기업 개요', value: '국내 최대 IT 플랫폼 기업, 카카오톡 기반 다양한 서비스 운영' },
                        { label: '핵심 가치', value: '사용자 중심 사고, 기술 혁신, 오픈 커뮤니케이션' },
                        { label: '조직 문화', value: '수평적 의사결정, 자율과 책임, 크루 중심 협업 문화' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                          <div>
                            <p className="text-[13px] font-bold text-bluewood-700 mb-0.5">{item.label}</p>
                            <p className="text-[13px] text-bluewood-500 leading-relaxed">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </ResponsiveScaleWrapper>
          </div>

          {/* 포트폴리오 자동 생성 */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12">
            <ResponsiveScaleWrapper minWidth={1000}>
              <div className="flex flex-row-reverse flex-nowrap gap-10 items-start w-full">
                <div className="w-[380px] shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-primary-100 text-primary-700 text-[13px] font-bold rounded mb-4 sm:mb-6">포트폴리오 에디터</span>
                <h3 className="text-[24px] sm:text-[30px] font-extrabold text-primary-600 leading-[1.3] mb-6 sm:mb-8" style={{ wordBreak: 'keep-all' }}>
                  당신의 경험이,<br />
                  <span className="text-primary-600">기업 맞춤으로<br />자동 완성됩니다</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['4가지 템플릿', 'PDF · 공유 링크 출력'].map((t, i) => (
                    <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-600 text-[14px] font-bold rounded-full border border-primary-100">{t}</span>
                  ))}
                </div>
              </div>

              {/* Mock Portfolio Editor */}
              <div className="flex-1 w-full min-w-0">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden p-4 sm:p-6 md:p-8">
                  <div className="mb-4 sm:mb-6">
                    <h4 className="text-[22px] sm:text-[28px] font-extrabold text-primary-600 mb-1 tracking-tight">XX기업 포트폴리오</h4>
                    <p className="text-[13px] sm:text-[14px] text-bluewood-500">본 포트폴리오는 PC 환경에 최적화되어 있습니다.</p>
                  </div>

                  <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 border-b border-surface-100">
                    {['교과 활동', '비교과 활동', '기술', '목표와 계획', '가치관'].map((tab, i) => (
                      <span key={i} className="px-3 sm:px-4 py-1.5 bg-surface-50 text-bluewood-600 text-[13px] sm:text-[14px] font-bold rounded-lg shrink-0 cursor-pointer">
                        {tab}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 sm:gap-8">

                    {/* Profile */}
                    <div className="sm:col-span-1 lg:col-span-3 lg:border-r border-surface-100 lg:pr-4">
                      <p className="text-[12px] font-bold text-bluewood-500 tracking-widest mb-3 border-l-2 border-surface-300 pl-2">PROFILE</p>
                      <div className="bg-surface-100 rounded-xl aspect-square max-w-[120px] sm:max-w-none mb-4 flex items-center justify-center">
                        <Users size={36} className="text-bluewood-500" />
                      </div>
                      <h5 className="text-[18px] sm:text-[20px] font-extrabold text-primary-600 mb-0.5">김XX</h5>
                      <p className="text-[13px] text-bluewood-500 mb-4">(KIM XX XXX)</p>

                      <div className="space-y-2 mb-4 sm:mb-6">
                        <div className="flex items-center gap-2 text-[13px] text-bluewood-500">
                          <MapPin size={12} /> 경기도 XX시
                        </div>
                        <div className="flex items-center gap-2 text-[13px] text-bluewood-500">
                          <Calendar size={12} /> XXXX.XX.XX
                        </div>
                      </div>

                      <p className="text-[14px] font-bold italic text-primary-600 mb-3">My Own Values</p>
                      <div className="space-y-2">
                        <div className="px-3 py-2 border border-surface-100 rounded-lg text-[13px] font-bold text-bluewood-700 flex items-center gap-2 shadow-sm">
                          <span className="text-primary-500 font-extrabold text-[16px] leading-none">+</span> 경험
                        </div>
                        <div className="px-3 py-2 border border-surface-100 rounded-lg text-[13px] font-bold text-bluewood-700 flex items-center gap-2 shadow-sm">
                          <span className="text-purple-500 font-extrabold text-[16px] leading-none">-</span> 추억
                        </div>
                        <div className="px-3 py-2 border border-surface-100 rounded-lg text-[13px] font-bold text-bluewood-700 flex items-center gap-2 shadow-sm">
                          <span className="text-blue-500 font-extrabold text-[16px] leading-none">×</span> 리더십
                        </div>
                      </div>
                    </div>

                    {/* Middle */}
                    <div className="sm:col-span-1 lg:col-span-4 space-y-6 sm:space-y-8">
                      <div>
                        <p className="text-[15px] sm:text-[16px] font-extrabold text-primary-600 flex items-center gap-2 mb-3 sm:mb-4">
                          Education
                        </p>
                        <p className="text-[14px] sm:text-[15px] font-bold text-bluewood-800 mb-1">XX대학교</p>
                        <p className="text-[13px] text-bluewood-500 mb-1">2021.03 - 2027.03</p>
                        <p className="text-[13px] text-bluewood-500">재학 경영학과</p>
                      </div>

                      <div>
                        <p className="text-[15px] sm:text-[16px] font-extrabold text-primary-600 flex items-center gap-2 mb-3 sm:mb-4">
                          Interest
                        </p>
                        <ul className="text-[14px] text-bluewood-600 space-y-2 pl-2">
                          <li className="flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-bluewood-400 before:rounded-full">독서</li>
                          <li className="flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-bluewood-400 before:rounded-full">코딩</li>
                          <li className="flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-bluewood-400 before:rounded-full">여행</li>
                        </ul>
                      </div>

                      <div>
                        <p className="text-[15px] sm:text-[16px] font-extrabold text-primary-600 flex items-center gap-2 mb-3 sm:mb-4">
                          Contact
                        </p>
                        <div className="space-y-2.5 text-[13px] text-bluewood-600">
                          <div className="flex items-center gap-2"><Phone size={12} className="text-bluewood-500 shrink-0" /> 010-XXXX-XXXX</div>
                          <div className="flex items-center gap-2"><Mail size={12} className="text-bluewood-500 shrink-0" /> XXXX@naver.com</div>
                          <div className="flex items-center gap-2 min-w-0"><LinkIcon size={12} className="text-bluewood-500 shrink-0" /><span className="truncate">https://linkedin.com/in</span></div>
                          <div className="flex items-center gap-2 min-w-0"><LinkIcon size={12} className="text-bluewood-500 shrink-0" /><span className="truncate">https://github.com</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="sm:col-span-2 lg:col-span-5 space-y-6 sm:space-y-8 bg-surface-50/50 p-4 sm:p-5 rounded-xl border border-surface-100">
                      <div>
                        <p className="text-[14px] sm:text-[15px] font-extrabold text-primary-600 flex items-center gap-2 mb-3 sm:mb-4">
                          Scholarship and Awards
                        </p>
                        <div className="space-y-3">
                          {[
                            { date: '2023.06.02', title: 'XX기업 해커톤 대상' },
                            { date: '2025.05.11', title: 'ESG 캠페인 기획 장려상' },
                            { date: '2026.02.03', title: 'XX 영상 제작 최우수상' },
                          ].map((item, i) => (
                            <div key={i} className="flex gap-2 items-start text-[13px]">
                              <span className="text-primary-500 font-bold shrink-0">{item.date}</span>
                              <span className="text-bluewood-600 font-medium leading-tight">{item.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[14px] sm:text-[15px] font-extrabold text-primary-600 flex items-center gap-2 mb-3 sm:mb-4">
                          Experience
                        </p>
                        <div className="space-y-3">
                          {[
                            'B2B SaaS 플랫폼 고객 이탈률 개선 프로젝트',
                            '사내 디자인 시스템 구축 및 가이드라인 배포',
                            '글로벌 시장 진출을 위한 다국어 지원 아키텍처 설계',
                            '대규모 트래픽 처리를 위한 MSA 전환 프로젝트',
                            'AI 기반 개인화 추천 알고리즘 고도화',
                          ].map((title, i) => (
                            <div key={i} className="flex gap-2 items-start text-[13px]">
                              <span className="text-bluewood-500 font-bold shrink-0 underline decoration-surface-300 underline-offset-2">2026-04</span>
                              <span className="text-bluewood-600 font-medium line-clamp-1">{title}</span>
                            </div>
                          ))}
                          <p className="text-[12px] text-bluewood-500 mt-2 pt-2 border-t border-surface-200">외 2건 — 아래 갤러리에서 확인</p>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
            </ResponsiveScaleWrapper>
          </div>

          {/* 산출물 쇼케이스 — 웹사이트 · 노션형 문서 · PPT */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 mt-6 sm:mt-8">
            <ResponsiveScaleWrapper minWidth={1000}>
              <div className="flex flex-row flex-nowrap gap-10 items-start w-full">
                <div className="w-[380px] shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-primary-100 text-primary-700 text-[13px] font-bold rounded mb-4 sm:mb-6">웹 · 노션 · PPT</span>
                  <h3 className="text-[24px] sm:text-[30px] font-extrabold text-primary-600 leading-[1.3] mb-5 sm:mb-6" style={{ wordBreak: 'keep-all' }}>
                    문서 하나로 끝나지 않고,<br />
                    <span className="text-primary-500">웹사이트 · 노션 · PPT로<br />전부 만들어집니다</span>
                  </h3>
                  <p className="text-[14px] sm:text-[15px] text-bluewood-500 leading-relaxed mb-5 sm:mb-6" style={{ wordBreak: 'keep-all' }}>
                    정리된 경험 하나로 세 가지 산출물이 동시에 완성됩니다.
                    웹사이트형 템플릿은 <strong className="text-primary-600">링크 하나로 바로 공유</strong>하고,
                    노션형 문서는 섹션까지 채워서 받고, PPT는 <strong className="text-primary-600">가지고 있는 템플릿 디자인 위에 자동으로</strong> 채워 드려요.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['웹사이트 링크 공유', '노션형 문서', 'PPT 자동 매핑', '테마 커스텀'].map((t, i) => (
                      <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-600 text-[14px] font-bold rounded-full border border-primary-100">{t}</span>
                    ))}
                  </div>
                  <p className="text-[13px] text-bluewood-400 mt-4 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                    아래 웹 · 노션 미리보기는 목업이 아니라 실제 서비스와 같은 화면입니다.
                  </p>
                </div>

                <div className="flex-1 w-full min-w-0">
                  <OutputShowcase />
                </div>
              </div>
            </ResponsiveScaleWrapper>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 sm:py-24 md:py-32 bg-[#f8f9fa]">
        <div className="max-w-[900px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row gap-8 sm:gap-12 md:gap-20 lg:gap-32">
          <div className="md:w-[200px] lg:w-[240px] shrink-0 pt-2">
            <p className="text-[13px] tracking-[0.15em] text-gray-500 font-bold mb-3 sm:mb-4">FAQ</p>
            <h2 className="text-[26px] sm:text-[32px] md:text-[36px] font-extrabold text-gray-900 leading-[1.3] tracking-tight">
              궁금하신 게<br />있나요?
            </h2>
          </div>
          <div className="flex-1">
            <div className="border-t border-gray-200">
              {[
                {
                  q: '무료로 사용할 수 있나요?',
                  a: '베타 기간 중에는 모든 기능을 무료로 이용할 수 있어요. 정식 출시 후에도 기본 기능은 무료입니다.'
                },
                {
                  q: '내 데이터는 안전한가요?',
                  a: '모든 데이터는 암호화되어 저장되고, 학습 데이터로 사용되지 않아요. 언제든 삭제 요청이 가능합니다.'
                },
                {
                  q: '어떤 기업 공고를 지원하나요?',
                  a: '국내 주요 채용 사이트(잡코리아, 사람인, 원티드, LinkedIn) 공고 URL을 모두 지원해요.'
                }
              ].map((faq, i) => (
                <div key={i} className="border-b border-gray-200">
                  <button
                    onClick={() => toggleFaq(i)}
                    className="w-full flex items-center justify-between py-5 sm:py-6 text-left focus:outline-none group"
                  >
                    <span className="text-[16px] sm:text-[17px] font-bold text-gray-900 group-hover:text-[#4F46E5] transition-colors pr-4">{faq.q}</span>
                    <span
                      className="text-gray-500 text-[22px] sm:text-[24px] font-light leading-none shrink-0 transition-transform duration-300 inline-block"
                      style={{ transform: openFaqs.includes(i) ? 'rotate(45deg)' : 'none' }}
                    >
                      +
                    </span>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaqs.includes(i) ? 'max-h-40 pb-5 sm:pb-6 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                  >
                    <p className="text-[15px] sm:text-[16px] text-gray-500 leading-relaxed pr-4 sm:pr-8">
                      {faq.a}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white pt-10 sm:pt-14 pb-8">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-10 sm:mb-12">
            <div>
              <h4 className="text-[13px] font-bold text-bluewood-500 uppercase tracking-wider mb-3 sm:mb-4">서비스</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-[14px] sm:text-[15px] text-bluewood-500">
                <li><a href="#feature-experience" className="hover:text-primary-600 transition-colors">경험 정리</a></li>
                <li><a href="#feature-portfolio" className="hover:text-primary-600 transition-colors">포트폴리오</a></li>
                <li><a href="#feature-experience" className="hover:text-primary-600 transition-colors">AI 분석</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-bluewood-500 uppercase tracking-wider mb-3 sm:mb-4">지원</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-[14px] sm:text-[15px] text-bluewood-500">
                <li><a href="#feature-experience" className="hover:text-primary-600 transition-colors">이용 가이드</a></li>
                <li><a href="#faq" className="hover:text-primary-600 transition-colors">자주 묻는 질문</a></li>
                <li><a href="mailto:fitpoly.kr@gmail.com" className="hover:text-primary-600 transition-colors">문의하기</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-bluewood-500 uppercase tracking-wider mb-3 sm:mb-4">법적 고지</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-[14px] sm:text-[15px] text-bluewood-500">
                <li><a href="/terms" className="hover:text-primary-600 transition-colors">이용약관</a></li>
                <li><a href="/privacy" className="hover:text-primary-600 transition-colors">개인정보처리방침</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-bluewood-500 uppercase tracking-wider mb-3 sm:mb-4">연락처</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-[14px] sm:text-[15px] text-bluewood-500">
                <li>이메일: fitpoly.kr@gmail.com</li>
                <li>운영시간: 평일 09:00 – 18:00</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-surface-200 pt-5 sm:pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="FitPoly" className="h-5 w-auto opacity-40" />
              <span className="text-[15px] font-bold text-bluewood-500">FitPoly</span>
            </div>
            <p className="text-[13px] text-bluewood-500 text-center sm:text-right">COPYRIGHT © 2025 FitPoly. ALL RIGHTS RESERVED.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
