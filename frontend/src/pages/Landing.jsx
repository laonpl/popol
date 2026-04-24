import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Briefcase, FileText,
  ChevronLeft, ChevronRight,
  Upload, FileUp, Link as LinkIcon,
  Check, Star, Users, Target,
  Building2, Search, ChevronDown, BarChart3, Award,
  Code, GraduationCap
} from 'lucide-react';
import useAuthStore from '../stores/authStore';

const MOCK_UPLOAD_FILES = [
  { name: '프로젝트_회고록.hwp',   size: '245 KB', color: 'bg-blue-500' },
  { name: '포트폴리오_v3.pdf',    size: '1.2 MB',  color: 'bg-red-500' },
  { name: '개발일지_2025.docx',   size: '380 KB', color: 'bg-indigo-500' },
  { name: '자기소개서_최종.hwp',  size: '178 KB', color: 'bg-blue-500' },
];

export default function Landing() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [heroVisible, setHeroVisible] = useState(false);
  const heroRef = useRef(null);

  // ── 파일 업로드 애니메이션 ──
  const [uploadAnimStep, setUploadAnimStep]     = useState(0);
  const [uploadZoneActive, setUploadZoneActive] = useState(false);
  const [uploadLoopKey, setUploadLoopKey]       = useState(0);
  const uploadTimersRef = useRef([]);

  const go = () => navigate(user ? '/app' : '/login');

  useEffect(() => {
    setHeroVisible(true);
  }, []);

  useEffect(() => {
    const FILE_INTERVAL  = 1300;
    const ZONE_DURATION  = 550;
    const FILE_COUNT     = MOCK_UPLOAD_FILES.length;

    const runLoop = (loopNum) => {
      setUploadAnimStep(0);
      setUploadLoopKey(loopNum);
      setUploadZoneActive(false);

      for (let i = 0; i < FILE_COUNT; i++) {
        const base = 700 + i * FILE_INTERVAL;
        uploadTimersRef.current.push(
          setTimeout(() => setUploadZoneActive(true),  base),
          setTimeout(() => {
            setUploadZoneActive(false);
            setUploadAnimStep(i + 1);
          }, base + ZONE_DURATION),
        );
      }
      uploadTimersRef.current.push(
        setTimeout(
          () => runLoop(loopNum + 1),
          700 + FILE_COUNT * FILE_INTERVAL + ZONE_DURATION + 2400,
        ),
      );
    };

    runLoop(0);
    return () => uploadTimersRef.current.forEach(clearTimeout);
  }, []);

  return (
    <div className="min-h-screen bg-[#f0f2f7]">

      {/* ╔══════════════════════════════════╗
         ║            HEADER                ║
         ╚══════════════════════════════════╝ */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-surface-200/60">
        <div className="max-w-[1140px] mx-auto flex items-center justify-between px-8 h-16">
          <div className="flex items-center gap-10">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <img src="/logo.png" alt="FitPoly" className="h-7 w-auto" />
              <span className="text-lg font-extrabold tracking-tight text-bluewood-900">FitPoly</span>
            </button>
            <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-bluewood-500">
              <a href="#feature-experience" className="hover:text-bluewood-900 transition-colors">경험정리</a>
              <a href="#feature-portfolio" className="hover:text-bluewood-900 transition-colors">포트폴리오</a>
              <a href="#process" className="hover:text-bluewood-900 transition-colors">이용방법</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={go} className="text-[13px] font-medium text-bluewood-500 hover:text-bluewood-900 transition-colors">
              로그인
            </button>
            <button onClick={go} className="px-4 py-2 bg-primary-500 text-white rounded-lg text-[13px] font-semibold hover:bg-primary-600 transition-colors">
              시작하기
            </button>
          </div>
        </div>
      </header>

      {/* ╔══════════════════════════════════╗
         ║          HERO (NEW)              ║
         ╚══════════════════════════════════╝ */}
      <section ref={heroRef} className="bg-white overflow-hidden">
        <div className="max-w-[1140px] mx-auto px-8 pt-20 pb-24">
          <div className={`transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h1 className="text-[42px] md:text-[54px] font-extrabold leading-[1.15] text-bluewood-900 mb-6" style={{ wordBreak: 'keep-all' }}>
              파편화된 경험을 정리하고,<br />
              <span className="text-primary-500">맞춤 포트폴리오</span>까지 한번에.
            </h1>
            <p className="text-[15px] md:text-[17px] text-bluewood-400 leading-relaxed mb-10 max-w-xl">
              HWP·PDF·노션 등 흩어진 경험 파일을 업로드하면<br />
              AI가 자동으로 분석·구조화하고, 지원 기업에 맞는 포트폴리오를 생성합니다.
            </p>

            <div className="flex items-center gap-4 mb-16">
              <button onClick={go} className="px-7 py-3.5 bg-primary-500 text-white rounded-xl text-[14px] font-bold hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/20 inline-flex items-center gap-2">
                무료로 시작하기 <ArrowRight size={16} />
              </button>
              <button onClick={() => document.getElementById('feature-experience')?.scrollIntoView({ behavior: 'smooth' })} className="px-7 py-3.5 bg-white border border-surface-200 text-bluewood-600 rounded-xl text-[14px] font-bold hover:border-primary-300 transition-colors inline-flex items-center gap-2">
                핵심 기능 보기 <ChevronDown size={16} />
              </button>
            </div>

            {/* Mini stats */}
            <div className="flex items-center gap-8 md:gap-14">
              {[
                { label: '경험 정리 완료', value: '2,400+' },
                { label: '포트폴리오 생성', value: '1,200+' },
                { label: '평균 작성 시간', value: '15분' },
              ].map((s, i) => (
                <div key={i}>
                  <p className="text-[24px] md:text-[28px] font-extrabold text-bluewood-900">{s.value}</p>
                  <p className="text-[12px] text-bluewood-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║  FEATURE 1 — 경험 정리 서비스     ║
         ╚══════════════════════════════════╝ */}
      <section id="feature-experience" className="py-24 bg-white">
        <div className="max-w-[1140px] mx-auto px-8">
          {/* Section header */}
          <div className="mb-16">
            <span className="inline-block px-3 py-1 bg-primary-500 text-white text-[11px] font-bold rounded-md mb-4 tracking-wide">핵심 기능 1. 경험 정리</span>
            <h2 className="text-[32px] md:text-[38px] font-extrabold text-bluewood-900 leading-[1.3] mb-3" style={{ wordBreak: 'keep-all' }}>
              파편화된 다양한 파일을,<br />
              <span className="text-primary-500">체계적인 경험 아카이브</span>로 정리해요
            </h2>

          </div>

          {/* ── Improvement 1: 파일 업로드 → 자동 구조화 ── */}
          <div className="bg-[#f8f9fc] rounded-3xl p-8 md:p-12 mb-8">
            <div className="flex flex-col lg:flex-row gap-10 items-start">
              {/* Left: description */}
              <div className="lg:w-[380px] shrink-0">
                <span className="inline-block px-2.5 py-1 bg-primary-100 text-primary-700 text-[11px] font-bold rounded mb-4">파일 업로드</span>
                <h3 className="text-[22px] font-extrabold text-bluewood-900 leading-[1.4] mb-3" style={{ wordBreak: 'keep-all' }}>
                  다양한 파일을 업로드하면,<br />
                  <span className="text-primary-500">AI가 자동으로 내용을 분석</span>해요
                </h3>
                <p className="text-[13px] text-bluewood-400 leading-relaxed mb-6">
                  HWP, PDF, DOCX 파일은 물론 노션 링크, GitHub URL 등<br />
                  다양한 소스에서 경험 데이터를 가져올 수 있어요.
                </p>
                <div className="space-y-2">
                  {['HWP·PDF·DOCX 파일 자동 파싱', 'Notion·GitHub·Blog URL 지원', '최대 10개 파일 동시 업로드'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px] text-bluewood-500">
                      <div className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-primary-600" />
                      </div>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Mock Upload UI */}
              <div className="flex-1 w-full">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                  {/* Mock header */}
                  <div className="px-6 py-4 border-b border-surface-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center"><Upload size={15} className="text-primary-500" /></div>
                    <div>
                      <p className="text-[13px] font-bold text-bluewood-900">경험 데이터 수집</p>
                      <p className="text-[11px] text-bluewood-400">파일, 텍스트, URL을 추가해주세요</p>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* Upload zone – 드래그 활성 상태 애니메이션 */}
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 ${
                      uploadZoneActive
                        ? 'border-primary-400 bg-primary-100/60 scale-[1.015]'
                        : 'border-primary-200 bg-primary-50/30'
                    }`}>
                      <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
                        uploadZoneActive ? 'bg-primary-200 scale-110' : 'bg-primary-100'
                      }`}>
                        <FileUp size={18} className={`text-primary-500 transition-transform duration-300 ${
                          uploadZoneActive ? 'animate-bounce' : ''
                        }`} />
                      </div>
                      <p className="text-[13px] font-semibold text-bluewood-700 mb-1">
                        {uploadZoneActive ? '파일 인식 중…' : '파일을 드래그하거나 클릭하여 업로드'}
                      </p>
                      <p className="text-[11px] text-bluewood-400">HWP, PDF, DOCX, TXT (최대 10개)</p>
                    </div>
                    {/* Mock uploaded files – 순서대로 슬라이드인 후 반복 */}
                    <div className="space-y-2 min-h-[148px]">
                      {MOCK_UPLOAD_FILES.slice(0, uploadAnimStep).map((f, i) => (
                        <div
                          key={`${uploadLoopKey}-${i}`}
                          className="flex items-center gap-3 px-4 py-2.5 bg-surface-50 rounded-lg animate-slide-in-file"
                        >
                          <div className={`w-7 h-7 rounded-lg ${f.color} flex items-center justify-center`}>
                            <FileText size={13} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-bluewood-800 truncate">{f.name}</p>
                            <p className="text-[10px] text-bluewood-400">{f.size}</p>
                          </div>
                          <div className="w-5 h-5 rounded-full bg-caribbean-100 flex items-center justify-center">
                            <Check size={10} className="text-caribbean-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* URL inputs */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-surface-50 rounded-lg border border-surface-200">
                        <LinkIcon size={13} className="text-bluewood-300" />
                        <span className="text-[12px] text-bluewood-300">https://notion.so/my-project...</span>
                      </div>
                      <div className="px-3 py-2 bg-primary-50 text-primary-600 rounded-lg text-[11px] font-bold">+ 추가</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Improvement 2: 7섹션 자동 구조화 결과 ── */}
          <div className="bg-[#f8f9fc] rounded-3xl p-8 md:p-12 mb-8">
            <div className="flex flex-col lg:flex-row-reverse gap-10 items-start">
              {/* Right: description */}
              <div className="lg:w-[380px] shrink-0">
                <span className="inline-block px-2.5 py-1 bg-caribbean-100 text-caribbean-700 text-[11px] font-bold rounded mb-4">AI 구조화</span>
                <h3 className="text-[22px] font-extrabold text-bluewood-900 leading-[1.4] mb-3" style={{ wordBreak: 'keep-all' }}>
                  STAR 프레임워크 기반으로<br />
                  <span className="text-primary-500">7개 섹션이 자동 생성</span>돼요
                </h3>
                <p className="text-[13px] text-bluewood-400 leading-relaxed mb-6">
                  AI가 업로드된 파일을 분석하여 프로젝트 소개부터<br />
                  역량 키워드까지 7단계로 체계적으로 정리해줘요.
                </p>
                <div className="space-y-2">
                  {['핵심 역량 키워드 자동 추출', '정량적 성과 하이라이팅'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px] text-bluewood-500">
                      <div className="w-4 h-4 rounded-full bg-caribbean-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-caribbean-600" />
                      </div>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Left: Mock Structured Result */}
              <div className="flex-1 w-full">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                  {/* Mock header */}
                  <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-caribbean-400" />
                      <p className="text-[13px] font-bold text-bluewood-900">RunWith – 함께 달리는 러닝 앱</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-[10px] font-bold rounded">STAR</span>
                      <span className="text-[11px] text-bluewood-400">7/7 완료</span>
                    </div>
                  </div>
                  <div className="p-5 space-y-3 max-h-[380px] overflow-hidden relative">
                    {/* Mock sections */}
                    {[
                      { num: '01', label: '프로젝트 소개', text: '친구와 함께 달리는 소셜 러닝 앱 서비스 UI/UX 개선 프로젝트', filled: true },
                      { num: '02', label: '프로젝트 개요', text: '러닝 앱 사용자 리서치 및 UT를 통해 친구 러닝 현황, 깨우기 알림, 인증 피드 경험을 개선하여...', filled: true },
                      { num: '03', label: '진행한 일', text: 'Maze를 활용한 사용성 테스트 설계 및 진행, Figma 프로토타입 기반 개선안 도출', filled: true },
                      { num: '04', label: '과정', text: '리서치 → 문제 정의 → 프로토타입 → UT → 개선으로 이어지는 더블 다이아몬드 프로세스 적용', filled: true },
                      { num: '05', label: '결과물', text: '친구 위치 시각화, 깨우기 알림 재배치, 인증 피드 리디자인 등 3가지 핵심 개선 완료', filled: true },
                      { num: '06', label: '성장한 점', text: '사용자 중심 설계 사고, UT 기반 의사결정, 데이터 기반 개선 프로세스 역량 강화', filled: false },
                      { num: '07', label: '나의 역량', text: '', filled: false },
                    ].map((s, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${s.filled ? 'bg-primary-50/40 border border-primary-100' : 'bg-surface-50 border border-surface-100'}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold ${s.filled ? 'bg-primary-500 text-white' : 'bg-surface-200 text-bluewood-400'}`}>
                          {s.num}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-bluewood-800 mb-0.5">{s.label}</p>
                          {s.text ? (
                            <p className="text-[11px] text-bluewood-400 leading-relaxed truncate">{s.text}</p>
                          ) : (
                            <p className="text-[11px] text-bluewood-300 italic">아직 작성되지 않았어요</p>
                          )}
                        </div>
                        {s.filled && (
                          <div className="w-5 h-5 rounded-full bg-caribbean-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Check size={10} className="text-caribbean-600" />
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Improvement 3: 타임라인 관리 ── */}
          <div className="bg-[#f8f9fc] rounded-3xl p-8 md:p-12">
            <div className="flex flex-col lg:flex-row gap-10 items-start">
              <div className="lg:w-[380px] shrink-0">
                <span className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded mb-4">타임라인 관리</span>
                <h3 className="text-[22px] font-extrabold text-bluewood-900 leading-[1.4] mb-3" style={{ wordBreak: 'keep-all' }}>
                  모든 경험을 한눈에,<br />
                  <span className="text-primary-500">타임라인으로 관리</span>해요
                </h3>
                <p className="text-[13px] text-bluewood-400 leading-relaxed mb-6">
                  정리된 경험들을 12개월 타임라인에서 한눈에 확인하고,<br />
                  드래그로 순서를 바꾸거나 기간을 수정할 수 있어요.
                </p>
                <div className="space-y-2">
                  {['12개월 Gantt 차트 뷰', '3가지 컬러 테마 선택', '드래그 앤 드롭 정렬'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px] text-bluewood-500">
                      <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-indigo-600" />
                      </div>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mock Gantt */}
              <div className="flex-1 w-full">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BarChart3 size={15} className="text-primary-500" />
                      <p className="text-[13px] font-bold text-bluewood-900">경험 타임라인</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {['bg-blue-500', 'bg-white border border-blue-200', 'bg-gray-200'].map((c, i) => (
                        <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                      ))}
                    </div>
                  </div>
                  <div className="p-5">
                    {/* Month headers */}
                    <div className="flex items-center mb-4 pl-[140px]">
                      {['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'].map((m, i) => (
                        <span key={i} className="flex-1 text-[9px] text-bluewood-300 text-center">{m}</span>
                      ))}
                    </div>
                    {/* Bars */}
                    {[
                      { title: 'RunWith 러닝앱', start: 0, span: 3, theme: 0 },
                      { title: 'FitPoly 포트폴리오', start: 2, span: 4, theme: 1 },
                      { title: '디자인 시스템 구축', start: 5, span: 3, theme: 2 },
                      { title: 'UX 리서치 프로젝트', start: 7, span: 3, theme: 0 },
                      { title: '스타트업 인턴십', start: 3, span: 5, theme: 1 },
                    ].map((bar, i) => {
                      const themes = [
                        { bar: 'bg-blue-500', text: 'text-white' },
                        { bar: 'bg-white border border-blue-200', text: 'text-blue-600' },
                        { bar: 'bg-gray-200', text: 'text-gray-700' },
                      ];
                      const t = themes[bar.theme];
                      return (
                        <div key={i} className="flex items-center mb-2.5">
                          <div className="w-[140px] pr-4 shrink-0">
                            <p className="text-[11px] font-semibold text-bluewood-700 truncate text-right">{bar.title}</p>
                          </div>
                          <div className="flex-1 relative h-8">
                            <div
                              className={`absolute top-0 h-full ${t.bar} rounded-lg flex items-center px-3`}
                              style={{ left: `${(bar.start / 12) * 100}%`, width: `${(bar.span / 12) * 100}%` }}
                            >
                              <span className={`text-[10px] font-semibold ${t.text} truncate`}>{bar.span}개월</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║  FEATURE 2 — 기업 맞춤 포트폴리오  ║
         ╚══════════════════════════════════╝ */}
      <section id="feature-portfolio" className="py-24 bg-[#f8f9fc]">
        <div className="max-w-[1140px] mx-auto px-8">
          <div className="mb-16">
            <span className="inline-block px-3 py-1 bg-caribbean-600 text-white text-[11px] font-bold rounded-md mb-4 tracking-wide">핵심 기능 2. 기업 맞춤 포트폴리오</span>
            <h2 className="text-[32px] md:text-[38px] font-extrabold text-bluewood-900 leading-[1.3] mb-3" style={{ wordBreak: 'keep-all' }}>
              기업을 분석하고,<br />
              <span className="text-caribbean-600">알맞는 포트폴리오를 자동 생성</span>해요
            </h2>
            <p className="text-[14px] text-bluewood-400 leading-relaxed">
              We analyze job postings and generate tailored portfolios that match company requirements.
            </p>
          </div>

          {/* ── Sub 1: 채용공고 분석 ── */}
          <div className="bg-white rounded-3xl p-8 md:p-12 mb-8">
            <div className="flex flex-col lg:flex-row gap-10 items-start">
              <div className="lg:w-[380px] shrink-0">
                <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-700 text-[11px] font-bold rounded mb-4">채용공고 분석</span>
                <h3 className="text-[22px] font-extrabold text-bluewood-900 leading-[1.4] mb-3" style={{ wordBreak: 'keep-all' }}>
                  채용 링크 한 줄이면,<br />
                  <span className="text-caribbean-600">기업·직무를 AI가 분석</span>해요
                </h3>
                <p className="text-[13px] text-bluewood-400 leading-relaxed mb-6">
                  자소설닷컴, 잡코리아, 사람인 등 채용 사이트 URL을 입력하면<br />
                  기업 분석, 직무 분석, 지원 전략까지 자동으로 생성돼요.
                </p>
                <div className="space-y-2">
                  {['기업 SWOT·경쟁사·문화 분석', '직무 자격요건·핵심역량 정리', '포트폴리오 필수 요소 체크리스트'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px] text-bluewood-500">
                      <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-amber-600" />
                      </div>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mock Job Analysis UI */}
              <div className="flex-1 w-full">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                  {/* URL input mock */}
                  <div className="px-6 py-4 border-b border-surface-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Search size={14} className="text-bluewood-300" />
                      <p className="text-[13px] font-bold text-bluewood-900">채용공고 분석</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-surface-50 rounded-lg border border-surface-200">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-bold rounded">자소설닷컴</span>
                        <span className="text-[12px] text-bluewood-500">https://jasoseol.com/posting/291234</span>
                      </div>
                      <div className="px-4 py-2.5 bg-primary-500 text-white rounded-lg text-[12px] font-bold shrink-0">분석하기</div>
                    </div>
                  </div>

                  {/* Analysis result */}
                  <div className="p-5">
                    {/* Company header */}
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-surface-100">
                      <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center">
                        <Building2 size={18} className="text-bluewood-400" />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-bluewood-900">카카오 · UX 디자이너</p>
                        <p className="text-[11px] text-bluewood-400">IT/플랫폼 · 경력 1~3년</p>
                      </div>
                    </div>

                    {/* Skill tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {['Figma', 'Prototyping', 'User Research', 'Design System', 'Data Analysis', 'Communication'].map((tag, i) => (
                        <span key={i} className={`px-2 py-1 rounded-md text-[10px] font-semibold ${i < 3 ? 'bg-primary-50 text-primary-600' : 'bg-surface-100 text-bluewood-500'}`}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Tab navigation */}
                    <div className="flex items-center gap-1 p-1 bg-surface-50 rounded-lg mb-4">
                      {['기업 분석', '직무 분석', '지원 전략', '산업 트렌드'].map((tab, i) => (
                        <button key={i} className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all ${i === 0 ? 'bg-white text-bluewood-900 shadow-sm' : 'text-bluewood-400'}`}>
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Mock content */}
                    <div className="space-y-3">
                      {[
                        { label: '기업 개요', value: '국내 최대 IT 플랫폼 기업, 카카오톡 기반 다양한 서비스 운영' },
                        { label: '핵심 가치', value: '사용자 중심 사고, 기술 혁신, 오픈 커뮤니케이션' },
                        { label: '조직 문화', value: '수평적 의사결정, 자율과 책임, 크루 중심 협업 문화' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                          <div>
                            <p className="text-[11px] font-bold text-bluewood-700 mb-0.5">{item.label}</p>
                            <p className="text-[11px] text-bluewood-400 leading-relaxed">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Sub 2: 포트폴리오 자동 생성 ── */}
          <div className="bg-white rounded-3xl p-8 md:p-12">
            <div className="flex flex-col lg:flex-row-reverse gap-10 items-start">
              <div className="lg:w-[380px] shrink-0">
                <span className="inline-block px-2.5 py-1 bg-purple-100 text-purple-700 text-[11px] font-bold rounded mb-4">포트폴리오 에디터</span>
                <h3 className="text-[22px] font-extrabold text-bluewood-900 leading-[1.4] mb-3" style={{ wordBreak: 'keep-all' }}>
                  분석 결과 기반으로,<br />
                  <span className="text-caribbean-600">포트폴리오가 자동 완성</span>돼요
                </h3>
                <p className="text-[13px] text-bluewood-400 leading-relaxed mb-6">
                  정리된 경험과 기업 분석을 결합하여 맞춤형 포트폴리오를<br />
                  자동 생성하고, 노션 스타일 에디터로 자유롭게 편집해요.
                </p>
                <div className="space-y-2">
                  {['4가지 템플릿 (Notion·Ashley·Academic·Timeline)', '경험 자동 매칭 및 섹션 배치', 'PDF Export 및 공유 링크 생성'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px] text-bluewood-500">
                      <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-purple-600" />
                      </div>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mock Portfolio Editor */}
              <div className="flex-1 w-full">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                  <div className="flex">
                    {/* Sidebar */}
                    <div className="w-[180px] bg-surface-50 border-r border-surface-200 p-3 shrink-0 hidden md:block">
                      <p className="text-[10px] font-bold text-bluewood-400 uppercase tracking-wider mb-3 px-2">섹션</p>
                      {[
                        { icon: Users, label: '프로필', active: true },
                        { icon: GraduationCap, label: '학력', active: false },
                        { icon: Code, label: '기술 스택', active: false },
                        { icon: Briefcase, label: '경험', active: false },
                        { icon: Award, label: '수상 & 자격', active: false },
                        { icon: Target, label: '목표', active: false },
                      ].map((item, i) => (
                        <div key={i} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg mb-0.5 text-[11px] ${item.active ? 'bg-primary-50 text-primary-700 font-bold' : 'text-bluewood-400'}`}>
                          <item.icon size={13} />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 p-5">
                      {/* Profile card mock */}
                      <div className="flex items-start gap-4 mb-5 pb-5 border-b border-surface-100">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shrink-0">
                          <Users size={24} className="text-primary-500" />
                        </div>
                        <div>
                          <p className="text-[16px] font-extrabold text-bluewood-900 mb-0.5">김포폴</p>
                          <p className="text-[12px] text-primary-500 font-semibold mb-2">UX Designer & Researcher</p>
                          <div className="flex flex-wrap gap-1">
                            {['사용자 중심 설계', '데이터 기반', '문제 해결'].map((v, i) => (
                              <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-600 text-[9px] font-semibold rounded-md">{v}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Skills section mock */}
                      <div className="mb-5">
                        <p className="text-[12px] font-bold text-bluewood-800 mb-2.5 flex items-center gap-1.5">
                          <Code size={12} className="text-primary-500" /> 기술 스택
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { cat: 'Design', items: ['Figma', 'Sketch', 'Adobe XD'] },
                            { cat: 'Research', items: ['Maze', 'Hotjar', 'GA4'] },
                          ].map((g, i) => (
                            <div key={i} className="p-2.5 bg-surface-50 rounded-xl">
                              <p className="text-[10px] font-bold text-bluewood-500 mb-1.5">{g.cat}</p>
                              <div className="flex flex-wrap gap-1">
                                {g.items.map((s, j) => (
                                  <span key={j} className="px-1.5 py-0.5 bg-white border border-surface-200 text-[9px] font-medium text-bluewood-600 rounded">{s}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Experience section mock */}
                      <div>
                        <p className="text-[12px] font-bold text-bluewood-800 mb-2.5 flex items-center gap-1.5">
                          <Briefcase size={12} className="text-primary-500" /> 주요 경험
                        </p>
                        {[
                          { title: 'RunWith 러닝앱 UX 개선', period: '2025.01 – 2025.03', tag: 'UX/UI', match: true },
                          { title: 'FitPoly 서비스 기획', period: '2025.03 – 2025.06', tag: '서비스 기획', match: true },
                        ].map((exp, i) => (
                          <div key={i} className="flex items-center gap-3 p-2.5 bg-surface-50 rounded-xl mb-2">
                            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                              <Star size={14} className="text-primary-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-bluewood-800 truncate">{exp.title}</p>
                              <p className="text-[10px] text-bluewood-400">{exp.period}</p>
                            </div>
                            <span className="px-1.5 py-0.5 bg-caribbean-50 text-caribbean-600 text-[9px] font-bold rounded shrink-0">매칭</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║       PROCESS (DARK)             ║
         ╚══════════════════════════════════╝ */}
      <section id="process" className="relative bg-[#162033] overflow-hidden">
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="max-w-[1140px] mx-auto px-8 py-24 relative z-10">
          <p className="text-[11px] tracking-[0.15em] text-primary-300 uppercase font-bold mb-4">SERVICE PROCESS</p>
          <h2 className="text-[34px] md:text-[40px] font-extrabold text-white leading-[1.25] mb-3" style={{ wordBreak: 'keep-all' }}>
            단 몇 분 만에 FitPoly을<br />시작해보세요.
          </h2>
          <p className="text-[13px] text-[#7b8faa] mb-6 max-w-md leading-relaxed">
            경험 파일을 업로드하면 AI가 자동으로 분석하고,<br />포트폴리오까지 한 번에 완성해 드립니다.
          </p>

          <div className="flex gap-3 mb-20">
            <span className="px-5 py-2.5 bg-primary-500 text-white rounded-lg text-[13px] font-semibold">전체 프로세스</span>
            <span className="px-5 py-2.5 bg-white/10 text-white/60 rounded-lg text-[13px] font-semibold">상세 기능</span>
          </div>

          {/* Steps */}
          <div className="relative flex flex-col md:flex-row justify-center items-start md:items-center gap-14 md:gap-20">
            {/* Connector line */}
            <div className="hidden md:block absolute top-[32px] left-[20%] right-[20%] h-[2px] bg-gradient-to-r from-primary-500/40 via-primary-500/20 to-primary-500/40" />

            {[
              { step: 'STEP 01', title: '시작하기', desc: '파일을 업로드하면\nAI가 내용을 자동 분석합니다.' },
              { step: 'STEP 02', title: '분석 및 정리', desc: 'STAR 프레임워크 기반\n경험 구조화 및 역량 추출' },
              { step: 'STEP 03', title: '서비스 완성', desc: '분석된 경험으로\n포트폴리오를 자동 구성합니다.' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center relative z-10">
                <p className="text-[10px] tracking-[0.18em] text-primary-300 uppercase font-bold mb-1.5">{s.step}</p>
                <h4 className="text-white font-bold text-[15px] mb-1.5">{s.title}</h4>
                <p className="text-[#6b7f99] text-[12px] leading-relaxed whitespace-pre-line max-w-[170px]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║           CTA BANNER             ║
         ╚══════════════════════════════════╝ */}
      <section className="px-8 py-8">
        <div className="max-w-[1140px] mx-auto">
          <div className="bg-gradient-to-r from-primary-500 via-primary-500 to-primary-600 rounded-[28px] py-14 md:py-16 text-center">
            <h2 className="text-[24px] md:text-[28px] font-extrabold text-white leading-[1.45] mb-6" style={{ wordBreak: 'keep-all' }}>
              지금 무료로 시작하고<br />
              나만의 포트폴리오를 완성해보세요!
            </h2>
            <button onClick={go} className="px-8 py-3.5 bg-white text-primary-600 rounded-2xl text-[14px] font-bold hover:bg-primary-50 transition-colors shadow-lg shadow-primary-700/20">
              무료로 시작하기
            </button>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║            FOOTER                ║
         ╚══════════════════════════════════╝ */}
      <footer className="bg-white pt-14 pb-8">
        <div className="max-w-[1140px] mx-auto px-8">
          {/* Link columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="text-[11px] font-bold text-bluewood-300 uppercase tracking-wider mb-4">서비스</h4>
              <ul className="space-y-2.5 text-[13px] text-bluewood-500">
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">경험 정리</a></li>
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">포트폴리오</a></li>
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">AI 분석</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-bluewood-300 uppercase tracking-wider mb-4">지원</h4>
              <ul className="space-y-2.5 text-[13px] text-bluewood-500">
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">이용 가이드</a></li>
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">자주 묻는 질문</a></li>
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">문의하기</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-bluewood-300 uppercase tracking-wider mb-4">법적 고지</h4>
              <ul className="space-y-2.5 text-[13px] text-bluewood-500">
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">이용약관</a></li>
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">개인정보처리방침</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-bluewood-300 uppercase tracking-wider mb-4">연락처</h4>
              <ul className="space-y-2.5 text-[13px] text-bluewood-500">
                <li>이메일: gudrbs14@naver.com</li>
                <li>운영시간: 평일 09:00 – 18:00</li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-surface-200 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="FitPoly" className="h-5 w-auto opacity-40" />
              <span className="text-[13px] font-bold text-bluewood-300">FitPoly</span>
            </div>
            <p className="text-[11px] text-bluewood-300">COPYRIGHT © 2025 FitPoly. ALL RIGHTS RESERVED.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
