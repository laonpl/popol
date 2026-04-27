import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Briefcase, FileText,
  ChevronLeft, ChevronRight,
  Upload, FileUp, Link as LinkIcon,
  Check, Star, Users, Target,
  Building2, Search, ChevronDown, BarChart3, Award,
  Code, GraduationCap, ArrowDownUp, Calendar, List, Plus, PenTool, LayoutTemplate,
  MapPin, Phone, Mail
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

  // FAQ State
  const [openFaqs, setOpenFaqs] = useState([]);

  const toggleFaq = (index) => {
    if (openFaqs.includes(index)) {
      setOpenFaqs(openFaqs.filter(i => i !== index));
    } else {
      setOpenFaqs([...openFaqs, index]);
    }
  };

  // ── 파일 업로드 애니메이션 ──
  const [uploadAnimStep, setUploadAnimStep]     = useState(0);
  const [uploadZoneActive, setUploadZoneActive] = useState(false);
  const [uploadLoopKey, setUploadLoopKey]       = useState(0);
  const uploadTimersRef = useRef([]);

  // Waitlist State
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState({ type: 'idle', message: '' });

  // ── AI 구조화 상태 애니메이션 ──
  const [aiMockView, setAiMockView] = useState('experience'); // 'experience' or 'portfolio'
  useEffect(() => {
    const interval = setInterval(() => {
      setAiMockView(prev => prev === 'experience' ? 'portfolio' : 'experience');
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleWaitlistSubmit = async () => {
    if (!waitlistEmail) return;
    setWaitlistStatus({ type: 'loading', message: '' });
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: waitlistEmail })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setWaitlistStatus({ type: 'success', message: data.message || '등록되었습니다.' });
        setWaitlistEmail('');
      } else {
        setWaitlistStatus({ type: 'error', message: data.error || '오류가 발생했습니다.' });
      }
    } catch (error) {
      console.error(error);
      setWaitlistStatus({ type: 'error', message: '서버와 연결할 수 없습니다.' });
    }
  };

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
         ║        FLOATING HEADER           ║
         ╚══════════════════════════════════╝ */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-transform duration-300 w-full max-w-fit px-4">
        <div className="bg-[#f3f4f6]/95 backdrop-blur-md rounded-full px-2 py-1.5 flex items-center justify-between md:justify-start md:gap-6 shadow-sm border border-gray-200/50 w-full max-w-[400px] md:max-w-none">
           <button onClick={() => navigate('/')} className="flex items-center gap-2 px-3">
              <img src="/logo.png" alt="FitPoly" className="h-5 w-auto" />
              <span className="font-extrabold text-[15px] text-gray-900 tracking-tight">FitPoly</span>
           </button>
           <nav className="hidden md:flex items-center gap-5 text-[13px] font-medium text-gray-600 px-2">
              <a href="#feature-experience" className="hover:text-black transition-colors">경험정리</a>
              <a href="#feature-portfolio" className="hover:text-black transition-colors">포트폴리오</a>
              <button onClick={go} className="hover:text-black transition-colors">로그인</button>
           </nav>
           <button onClick={go} className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-[13px] font-bold hover:bg-black transition-colors shrink-0">
              무료로 시작하기
           </button>
        </div>
      </div>

      {/* ╔══════════════════════════════════╗
         ║          HERO (MOBBIN STYLE)     ║
         ╚══════════════════════════════════╝ */}
      <section ref={heroRef} className="relative min-h-[90vh] md:min-h-[1000px] bg-[#fdfdfd] flex flex-col items-center justify-center overflow-hidden">
        
        {/* Background Icons Container */}
        <div className="absolute inset-0 w-full h-full max-w-[1200px] mx-auto pointer-events-none">
          {/* Notion */}
          <div className="absolute top-[20%] left-[12%] md:left-[18%] w-16 h-16 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-center animate-float-slow" style={{ animationDelay: '0s' }}>
             <img src="https://cdn.simpleicons.org/notion/000000" alt="Notion" className="w-8 h-8" />
          </div>
          {/* GitHub */}
          <div className="absolute top-[18%] right-[15%] md:right-[22%] w-14 h-14 bg-[#181717] rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center animate-float-medium" style={{ animationDelay: '1.5s' }}>
             <img src="https://cdn.simpleicons.org/github/ffffff" alt="GitHub" className="w-8 h-8" />
          </div>
          {/* KakaoTalk */}
          <div className="absolute bottom-[35%] left-[5%] md:left-[15%] w-20 h-20 bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-center animate-float-fast" style={{ animationDelay: '0.5s' }}>
             <img src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" alt="KakaoTalk" className="w-12 h-12" />
          </div>
          {/* Slack */}
          <div className="absolute top-[40%] left-[2%] md:left-[8%] w-12 h-12 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex items-center justify-center animate-float-slow" style={{ animationDelay: '2s' }}>
             <img src="https://api.iconify.design/logos:slack-icon.svg" alt="Slack" className="w-7 h-7" />
          </div>
          {/* Figma */}
          <div className="absolute bottom-[28%] right-[8%] md:right-[15%] w-16 h-16 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-center animate-float-medium" style={{ animationDelay: '3s' }}>
             <img src="https://api.iconify.design/logos:figma.svg" alt="Figma" className="w-8 h-8" />
          </div>
          {/* Google Drive */}
          <div className="absolute top-[10%] right-[38%] w-12 h-12 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-center animate-float-fast" style={{ animationDelay: '1s' }}>
             <img src="https://api.iconify.design/logos:google-drive.svg" alt="Google Drive" className="w-6 h-6" />
          </div>
          {/* PDF */}
          <div className="absolute bottom-[20%] right-[35%] w-14 h-14 bg-white rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-center animate-float-slow" style={{ animationDelay: '2.5s' }}>
             <img src="https://api.iconify.design/vscode-icons:file-type-pdf2.svg" alt="PDF" className="w-8 h-8" />
          </div>
          {/* Google Docs */}
          <div className="absolute top-[55%] right-[2%] md:right-[10%] w-[72px] h-[72px] bg-white rounded-[22px] shadow-[0_12px_40px_rgb(0,0,0,0.08)] flex items-center justify-center animate-float-medium" style={{ animationDelay: '0.8s' }}>
             <img src="https://cdn.simpleicons.org/googledocs/4285F4" alt="Google Docs" className="w-9 h-9" />
          </div>
          {/* Gmail */}
          <div className="absolute bottom-[15%] left-[25%] md:left-[35%] w-14 h-14 bg-white rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-center animate-float-fast" style={{ animationDelay: '1.8s' }}>
             <img src="https://api.iconify.design/logos:google-gmail.svg" alt="Gmail" className="w-8 h-8" />
          </div>
          {/* Discord */}
          <div className="absolute top-[12%] left-[35%] w-12 h-12 bg-[#5865F2] rounded-2xl shadow-[0_8px_30px_rgb(88,101,242,0.25)] flex items-center justify-center animate-float-slow" style={{ animationDelay: '0.3s' }}>
             <img src="https://cdn.simpleicons.org/discord/ffffff" alt="Discord" className="w-7 h-7" />
          </div>
        </div>

        {/* Center Text Content */}
        <div className={`relative z-10 text-center flex flex-col items-center justify-center transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} px-4 -mt-8 md:-mt-16`}>
          <p className="text-[16px] md:text-[20px] font-bold text-indigo-500 mb-4 md:mb-6">끝없이 쌓여가는 취업 준비 자료들</p>
          <h1 className="text-[38px] md:text-[68px] font-extrabold leading-[1.25] text-gray-900 tracking-[-0.03em] flex flex-col items-center">
            <span>여기저기 흩어진 경험들,</span>
            <span>어떻게 관리하고 계시나요?</span>
          </h1>
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║        PROBLEM DEFINITION        ║
         ╚══════════════════════════════════╝ */}
      <section className="bg-white py-24 pb-12">
        <div className="max-w-[1140px] mx-auto px-8">
          <div className="mb-12">
            <h2 className="text-[28px] md:text-[32px] font-extrabold text-gray-900 mb-2">취준생은 어떤 점이 가장 답답할까요?</h2>
            <p className="text-[15px] font-medium text-indigo-500">취준생 312명에게 직접 물어봤어요</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {/* Card 1 */}
            <div className="border border-gray-100 rounded-2xl p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <p className="text-[12px] font-bold text-indigo-400 mb-2">Q.1</p>
              <p className="text-[14px] font-bold text-gray-900 mb-8 h-10">포트폴리오 작성에서 가장 힘든 부분은 뭐였나요?</p>
              
              <div className="space-y-5 text-[13px] font-medium text-gray-700">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>경험 자료가 흩어져서</span>
                    <span className="font-bold">64%</span>
                  </div>
                  <div className="h-[5px] w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: '64%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>수치화/성과 정리</span>
                    <span className="font-bold">23%</span>
                  </div>
                  <div className="h-[5px] w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-400 rounded-full" style={{ width: '23%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>디자인 / 형식</span>
                    <span className="font-bold">13%</span>
                  </div>
                  <div className="h-[5px] w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-400 rounded-full" style={{ width: '13%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="border border-gray-100 rounded-2xl p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <p className="text-[12px] font-bold text-indigo-400 mb-2">Q.2</p>
              <p className="text-[14px] font-bold text-gray-900 mb-8 h-10">기업별로 따로 만들어 본 적이 있나요?</p>
              
              <div className="space-y-5 text-[13px] font-medium text-gray-700">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>있음, 매번 새로 작성</span>
                    <span className="font-bold">38%</span>
                  </div>
                  <div className="h-[5px] w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: '38%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>귀찮아서 동일본 제출</span>
                    <span className="font-bold text-black">46%</span>
                  </div>
                  <div className="h-[5px] w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-black rounded-full" style={{ width: '46%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>없음</span>
                    <span className="font-bold">16%</span>
                  </div>
                  <div className="h-[5px] w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-400 rounded-full" style={{ width: '16%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="border border-gray-100 rounded-2xl p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <p className="text-[12px] font-bold text-indigo-400 mb-2">Q.3</p>
              <p className="text-[14px] font-bold text-gray-900 mb-8 h-10">평균적으로 한 편 만드는 데 며칠 걸리나요?</p>
              
              <div className="space-y-5 text-[13px] font-medium text-gray-700">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>3일 이상</span>
                    <span className="font-bold">36%</span>
                  </div>
                  <div className="h-[5px] w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: '36%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>1~2일</span>
                    <span className="font-bold text-black">38%</span>
                  </div>
                  <div className="h-[5px] w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-black rounded-full" style={{ width: '38%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>하루 이내</span>
                    <span className="font-bold">26%</span>
                  </div>
                  <div className="h-[5px] w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-400 rounded-full" style={{ width: '26%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gray Box */}
          <div className="bg-[#f8f9fa] rounded-[32px] p-12 md:p-16 text-center">
            <h3 className="text-[24px] md:text-[28px] font-extrabold text-gray-900 leading-[1.4] mb-4">
              여기저기 흩어진 채널들,<br />
              정리하지 않은 자료들이 쌓여가고 있진 않나요?
            </h3>
            <p className="text-[15px] text-gray-500 leading-[1.6] mb-12 font-medium">
              중요한 경험은 흩어진 채널 어딘가에서 잠들어 있어요.<br />
              혹시 나도 잠든 자료의 무게를 안고 다니는 건 아닐까요?
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
              {[
                { name: 'KakaoTalk', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg', bg: 'bg-white' },
                { name: 'Notion', url: 'https://cdn.simpleicons.org/notion/000000', bg: 'bg-white' },
                { name: 'Google Drive', url: 'https://api.iconify.design/logos:google-drive.svg', bg: 'bg-white' },
                { name: 'Gmail', url: 'https://api.iconify.design/logos:google-gmail.svg', bg: 'bg-white' },
                { name: 'Slack', url: 'https://api.iconify.design/logos:slack-icon.svg', bg: 'bg-white' },
                { name: 'Discord', url: 'https://cdn.simpleicons.org/discord/ffffff', bg: 'bg-[#5865F2]' },
                { name: 'Figma', url: 'https://api.iconify.design/logos:figma.svg', bg: 'bg-white' },
                { name: 'Google Docs', url: 'https://cdn.simpleicons.org/googledocs/4285F4', bg: 'bg-white' },
                { name: 'PDF', url: 'https://api.iconify.design/vscode-icons:file-type-pdf2.svg', bg: 'bg-white' },
                { name: 'GitHub', url: 'https://cdn.simpleicons.org/github/ffffff', bg: 'bg-[#181717]' },
              ].map((icon, i) => (
                <div key={i} className={`w-12 h-12 md:w-[60px] md:h-[60px] ${icon.bg} rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex items-center justify-center`}>
                  <img src={icon.url} alt={icon.name} className={`${icon.name === 'KakaoTalk' ? 'w-8 h-8 md:w-10 md:h-10' : 'w-6 h-6 md:w-8 md:h-8'}`} />
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
        <div className="max-w-[1600px] mx-auto px-8 xl:px-16">
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
                    {/* Mock uploaded files – FIXED HEIGHT to prevent layout shifting */}
                    <div className="space-y-2 h-[220px] overflow-hidden">
                      {MOCK_UPLOAD_FILES.slice(0, uploadAnimStep).map((f, i) => (
                        <div
                          key={`${uploadLoopKey}-${i}`}
                          className="flex items-center px-5 py-3 bg-surface-50 rounded-lg animate-slide-in-file"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-bluewood-800 truncate">{f.name}</p>
                            <p className="text-[10px] text-bluewood-400">{f.size}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* URL inputs */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-4 py-2.5 bg-surface-50 rounded-lg border border-surface-200">
                        <span className="text-[12px] text-bluewood-400">https://notion.so/my-project...</span>
                      </div>
                      <div className="px-3 py-2 bg-primary-50 text-primary-600 rounded-lg text-[11px] font-bold">+ 추가</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Improvement 2: AI 포트폴리오 에디터 (번갈아 나오는 UI) ── */}
          <div className="bg-[#f8f9fc] rounded-3xl p-8 md:p-12 mb-8">
            <div className="flex flex-col lg:flex-row-reverse gap-10 items-start">
              {/* Right: description */}
              <div className="lg:w-[380px] shrink-0">
                <span className="inline-block px-2.5 py-1 bg-caribbean-100 text-caribbean-700 text-[11px] font-bold rounded mb-4">AI 포트폴리오 에디터</span>
                <h3 className="text-[22px] font-extrabold text-bluewood-900 leading-[1.4] mb-3" style={{ wordBreak: 'keep-all' }}>
                  작성된 경험을 바탕으로,<br />
                  <span className="text-primary-500">완성형 포트폴리오로 즉시 변환</span>돼요
                </h3>
                <p className="text-[13px] text-bluewood-400 leading-relaxed mb-6">
                  수집된 파편화된 경험들이 AI의 분석을 통해<br />
                  가독성 높은 블록 기반의 포트폴리오로 재탄생합니다.
                </p>
                <div className="space-y-2">
                  {['경험 데이터를 핵심 역량 중심으로 재구조화', '면접관이 보기 편한 Overview 뷰 제공'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px] text-bluewood-500">
                      <div className="w-4 h-4 rounded-full bg-caribbean-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-caribbean-600" />
                      </div>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Left: Alternating Mock UI */}
              <div className="flex-1 w-full grid">
                
                {/* View 1: Experience Review (Image 2 equivalent) */}
                <div className={`col-start-1 row-start-1 w-full transition-opacity duration-1000 ${aiMockView === 'experience' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                  <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-surface-200 h-full flex flex-col text-left">
                    <div className="border-b border-surface-100 px-5 py-3 flex items-center justify-between bg-surface-50/50">
                      <div className="flex items-center gap-4 text-[11px] text-bluewood-400 font-medium">
                        <span>✓ 기본 정보</span>
                        <span>✓ 자료 수집</span>
                        <span className="text-bluewood-900 font-bold">경험 검토</span>
                      </div>
                      <span className="text-[10px] text-bluewood-300 font-bold tracking-widest">1/4</span>
                    </div>
                    
                    <div className="flex flex-1">
                      <div className="hidden sm:block w-[180px] border-r border-surface-100 bg-surface-50/30 p-4 shrink-0">
                        <p className="text-[10px] font-bold text-bluewood-300 mb-3">경험 목록</p>
                        <div className="space-y-3">
                          <div className="bg-bluewood-900 text-white rounded-lg p-2.5 shadow-sm">
                            <p className="text-[9px] text-white/70 mb-0.5 font-bold">1.</p>
                            <p className="text-[11px] font-bold leading-tight">AI 챗봇 서비스 도입을 통한 CS 효율화</p>
                          </div>
                          <div className="p-2.5 opacity-40">
                            <p className="text-[9px] mb-0.5 font-bold text-bluewood-900">2.</p>
                            <p className="text-[11px] font-bold leading-tight text-bluewood-900">고객 여정 지도 설계를 통한 전환율 향상</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 p-6 bg-white">
                        <div className="bg-primary-50 text-primary-600 text-[11px] px-3 py-2 rounded-lg mb-4 font-medium flex items-center gap-2">
                          <Check size={12} /> "문제 정의", "데이터 분석" 역량이 확인됩니다.
                        </div>
                        
                        <div className="border border-surface-200 rounded-xl p-5 bg-white shadow-sm relative">
                          <button className="absolute top-4 right-4 px-3 py-1 bg-white border border-surface-200 rounded-md text-[10px] font-bold text-bluewood-400 hover:bg-surface-50 shadow-sm">
                            수정
                          </button>
                          <div className="inline-block px-2 py-0.5 bg-surface-100 text-bluewood-500 text-[10px] font-bold rounded mb-2">문제 상황 (Background)</div>
                          <h4 className="text-[15px] font-extrabold text-bluewood-900 mb-3">기존 CS 프로세스 병목 현상 분석</h4>
                          <p className="text-[12px] text-bluewood-500 leading-relaxed mb-4">
                            서비스 성장과 함께 일평균 고객 문의량이 급증하였으며, 기존 인력만으로는 대응 지연 현상이 발생하고 있었습니다. 특히 단순 반복 문의가 전체의 65%를 차지하여 심각한 병목 현상을 파악했습니다.
                          </p>
                          <ul className="text-[11px] text-bluewood-400 space-y-1.5 list-disc pl-4 mb-5 leading-relaxed">
                            <li>VOC 데이터를 주간 단위로 수집하여 문의 유형을 분석했습니다.</li>
                            <li>챗봇으로 자동화 가능한 '단순 정보성 문의' 비율(65%)을 정량적으로 도출했습니다.</li>
                          </ul>
                          
                          <div className="border-t border-surface-100 pt-4">
                            <p className="text-[10px] font-bold text-bluewood-300 mb-2">역량 키워드</p>
                            <div className="flex gap-2">
                              <span className="px-2.5 py-1 bg-surface-100 text-bluewood-500 text-[10px] font-bold rounded-md">데이터 분석</span>
                              <span className="px-2.5 py-1 bg-surface-100 text-bluewood-500 text-[10px] font-bold rounded-md">문제 정의</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-surface-100 bg-white px-5 py-3 flex items-center justify-between shrink-0">
                      <span className="text-[11px] font-bold text-red-400 hover:text-red-500 cursor-pointer">이 경험 제외</span>
                      <div className="flex gap-2">
                        <button className="px-4 py-1.5 text-[11px] font-bold text-bluewood-400 hover:bg-surface-50 rounded-md transition-colors">이전</button>
                        <button className="px-4 py-1.5 bg-bluewood-900 text-white text-[11px] font-bold rounded-md shadow-sm hover:bg-bluewood-800 transition-colors">다음 &gt;</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* View 2: Portfolio Preview (Image 3 equivalent) */}
                <div className={`col-start-1 row-start-1 w-full transition-opacity duration-1000 ${aiMockView === 'portfolio' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                  <div className="bg-surface-50 rounded-2xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-surface-200 h-full flex flex-col text-left">
                    <div className="bg-white border-b border-surface-100 px-5 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
                      <div className="flex items-center gap-2 text-[12px] font-bold text-bluewood-500">
                        <ArrowRight size={14} className="rotate-180" /> 경험 목록으로
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-1 bg-surface-100 rounded-md px-2 py-1 mr-2">
                          <div className="w-4 h-1 rounded-full bg-red-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-surface-300" />
                          <div className="w-1.5 h-1.5 rounded-full bg-surface-300" />
                          <div className="w-1.5 h-1.5 rounded-full bg-surface-300" />
                          <span className="text-[9px] font-bold text-bluewood-400 ml-1">1/4</span>
                        </div>
                        <button className="px-3 py-1.5 border border-surface-200 bg-white text-[10px] font-bold text-bluewood-500 rounded-md shadow-sm flex items-center gap-1">
                          <PenTool size={10} /> 수정
                        </button>
                        <button className="px-3 py-1.5 bg-bluewood-900 text-white text-[10px] font-bold rounded-md shadow-sm flex items-center gap-1">
                          <LayoutTemplate size={10} /> 템플릿 변경
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-1 rounded-b-2xl overflow-hidden">
                      <div className="hidden md:block w-[180px] bg-white border-r border-surface-100 p-5 shrink-0">
                        <h4 className="text-[13px] font-extrabold text-bluewood-900 mb-4">Overview</h4>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] text-bluewood-300 font-bold mb-1">1. 목표</p>
                            <p className="text-[10px] text-bluewood-500 leading-relaxed font-medium">단순 반복 문의 처리율 향상을 통한 업무 부하 감소</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-bluewood-300 font-bold mb-1">2. 역할</p>
                            <p className="text-[10px] text-bluewood-500 leading-relaxed font-medium">서비스 기획 (100%) - 문제 정의, 시나리오 설계</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-bluewood-300 font-bold mb-1">3. 기간</p>
                            <p className="text-[10px] text-bluewood-500 leading-relaxed font-medium">2025.03 - 2025.05 (2개월)</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 p-5 bg-surface-50">
                        <div className="bg-white rounded-xl shadow-sm border border-surface-100 p-6 mb-4">
                          <p className="text-[10px] font-extrabold text-primary-500 tracking-wider mb-2">BACKGROUND & PROBLEM</p>
                          <h3 className="text-[18px] font-extrabold text-bluewood-900 mb-5">기존 CS 프로세스 병목 현상 분석</h3>
                          
                          <div className="flex flex-col xl:flex-row gap-4">
                            <div className="flex-1 bg-surface-50 rounded-xl p-5 border border-surface-100">
                              <p className="text-[11px] font-bold text-bluewood-500 mb-1">단순 반복 문의가 차지하는 비중</p>
                              <p className="text-[32px] font-extrabold text-primary-600 mb-3 leading-none">65.0%</p>
                              <p className="text-[10px] text-bluewood-400 leading-relaxed mb-4">
                                전체 문의의 65%가 배송 조회 등 단순 정보성 문의로 파악되었습니다. 이는 핵심 문제 해결을 지연시키는 주요 원인이었습니다.
                              </p>
                              <div className="space-y-3">
                                <div>
                                  <div className="flex justify-between text-[9px] font-bold text-bluewood-400 mb-1">
                                    <span>수동 처리 비중 (개선 전)</span>
                                    <span>100%</span>
                                  </div>
                                  <div className="h-4 w-full bg-surface-200 rounded-md overflow-hidden">
                                    <div className="h-full bg-surface-400 w-full rounded-md" />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-[9px] font-bold text-bluewood-400 mb-1">
                                    <span>수동 처리 비중 (개선 후)</span>
                                    <span className="text-primary-600">35.0%</span>
                                  </div>
                                  <div className="h-4 w-full bg-surface-200 rounded-md overflow-hidden relative">
                                    <div className="absolute top-0 left-0 h-full bg-bluewood-900 transition-all duration-1000 ease-in-out" style={{ width: aiMockView === 'portfolio' ? '35%' : '0%' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="w-[180px] shrink-0 space-y-3 hidden sm:block">
                              <div className="bg-white rounded-xl p-4 border border-surface-100 shadow-sm">
                                <p className="text-[11px] font-bold text-bluewood-900 mb-2">문제 상황</p>
                                <p className="text-[10px] text-bluewood-400 leading-relaxed">고객 문의량이 늘어나 핵심 CS 품질이 저하되고 있었습니다.</p>
                              </div>
                              <div className="bg-white rounded-xl p-4 border border-surface-100 shadow-sm">
                                <p className="text-[11px] font-bold text-bluewood-900 mb-2">핵심 행동</p>
                                <p className="text-[10px] text-bluewood-400 leading-relaxed">자주 묻는 질문 패턴을 분석하여 응답 시나리오를 설계했습니다.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          <div className="bg-white border-2 border-primary-200 rounded-lg p-3 min-w-[140px] shadow-sm">
                            <p className="text-[8px] font-bold text-primary-500 uppercase mb-1">Background & Problem</p>
                            <p className="text-[10px] font-bold text-primary-900 truncate">CS 병목 현상 분석</p>
                          </div>
                          <div className="bg-white border border-surface-100 rounded-lg p-3 min-w-[140px] opacity-60">
                            <p className="text-[8px] font-bold text-bluewood-300 uppercase mb-1">Analysis & Action</p>
                            <p className="text-[10px] font-bold text-bluewood-500 truncate">AI 시나리오 설계</p>
                          </div>
                        </div>
                      </div>
                    </div>
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

              {/* Mock Gantt (Image Design) */}
              <div className="flex-1 w-full mt-4 lg:mt-0">
                <div className="bg-[#f8f9fa] rounded-2xl border border-gray-200 shadow-[0_2px_20px_rgb(0,0,0,0.04)] overflow-hidden p-5 md:p-7 relative">
                  {/* Header */}
                  <div className="flex flex-col xl:flex-row xl:items-start justify-between mb-8 gap-4">
                    <div>
                      <h4 className="text-[20px] font-extrabold text-[#1B264F] mb-1.5 tracking-tight">경험 정리</h4>
                      <p className="text-[12px] text-gray-400 font-semibold tracking-tight">6개의 경험이 타임라인에 정리되어 있습니다</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 flex items-center gap-1.5 shadow-sm hover:bg-gray-50 transition-colors">
                        <ArrowDownUp size={12} /> 직접 정렬 <ChevronDown size={12} />
                      </button>
                      <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 flex items-center gap-1.5 shadow-sm hover:bg-gray-50 transition-colors">
                        <Calendar size={12} /> 타임라인
                      </button>
                      <button className="px-3 py-2 text-gray-500 rounded-lg text-[11px] font-bold flex items-center gap-1.5 hover:bg-gray-100 transition-colors">
                        <List size={12} /> 표
                      </button>
                      <button className="px-4 py-2 bg-[#1B264F] text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm hover:bg-[#121a38] transition-colors">
                        <Plus size={14} /> 새 경험 추가
                      </button>
                    </div>
                  </div>

                  {/* Subheader */}
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                      <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 flex items-center gap-1.5 shadow-sm hover:bg-gray-50 transition-colors">
                        2026년 <ChevronDown size={12} />
                      </button>
                      <span className="text-[13px] font-extrabold text-[#1B264F]">경험 타임라인</span>
                    </div>
                    {/* Legend */}
                    <div className="hidden sm:flex items-center gap-3">
                      <div className="bg-white border border-gray-100 rounded-lg px-2 py-1.5 flex gap-1 shadow-sm">
                        <div className="w-4 h-4 bg-[#1B264F] rounded-[3px]"></div>
                        <div className="w-4 h-4 bg-blue-500 rounded-[3px]"></div>
                        <div className="w-4 h-4 bg-blue-300 rounded-[3px]"></div>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-4 h-4 bg-green-300 rounded-[3px] opacity-60"></div>
                        <div className="w-4 h-4 bg-green-300 rounded-[3px] opacity-80"></div>
                        <div className="w-4 h-4 bg-green-400 rounded-[3px]"></div>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-4 h-4 bg-gray-400 rounded-[3px]"></div>
                        <div className="w-4 h-4 bg-gray-500 rounded-[3px]"></div>
                        <div className="w-4 h-4 bg-gray-600 rounded-[3px]"></div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Area */}
                  <div className="relative border-t border-gray-200 pt-4 pb-8 overflow-x-auto overflow-y-hidden min-w-[500px]">
                    {/* Month headers */}
                    <div className="flex mb-6 pl-[2%]">
                      {['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'].map(m => (
                        <div key={m} className="flex-1 text-[11px] text-gray-400 font-bold">{m}</div>
                      ))}
                    </div>
                    {/* Grid lines */}
                    <div className="absolute top-[48px] bottom-0 left-0 right-0 flex pointer-events-none">
                      {[...Array(12)].map((_, i) => (
                        <div key={i} className="flex-1 border-l border-gray-200/60" />
                      ))}
                      <div className="border-l border-gray-200/60" /> {/* rightmost */}
                    </div>
                    
                    {/* Bars Container */}
                    <div className="relative z-10 space-y-4 pr-8">
                      {[
                        { title: '졸업프로젝트', start: 3.2, span: 3.5, theme: 'dark' },
                        { title: '교내 해커톤 대상', start: 3.6, span: 4.5, theme: 'light' },
                        { title: 'IT 동아리 3기', start: 2.2, span: 3.3, theme: 'gray' },
                        { title: '스타트업 인턴쉽', start: 3.4, span: 3.8, theme: 'dark' },
                        { title: '개인 프로젝트: 포트폴리오 웹', start: 3.6, span: 3.8, theme: 'light' },
                        { title: '알고리즘 스터디', start: 3.6, span: 3.5, theme: 'gray' },
                      ].map((bar, i) => {
                        const themeClasses = {
                          dark: 'bg-[#1B264F] text-white',
                          light: 'bg-white text-gray-800 border border-blue-200',
                          gray: 'bg-[#e2e8f0] text-gray-700'
                        }[bar.theme];
                        return (
                          <div key={i} className="relative h-[38px] w-full">
                            <div
                              className={`absolute top-0 h-full rounded-[8px] flex items-center px-4 shadow-sm ${themeClasses} transition-transform hover:scale-[1.01] cursor-default`}
                              style={{ left: `${(bar.start / 12) * 100}%`, width: `${(bar.span / 12) * 100}%` }}
                            >
                              <span className="text-[13px] font-bold tracking-tight truncate pt-[1px]">{bar.title}</span>
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
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║  FEATURE 2 — 기업 맞춤 포트폴리오  ║
         ╚══════════════════════════════════╝ */}
      <section id="feature-portfolio" className="py-24 bg-[#f8f9fc]">
        <div className="max-w-[1600px] mx-auto px-8 xl:px-16">
          <div className="mb-16">
            <span className="inline-block px-3 py-1 bg-[#1B264F] text-white text-[11px] font-bold rounded-md mb-4 tracking-wide">핵심 기능 2. 기업 맞춤 포트폴리오</span>
            <h2 className="text-[32px] md:text-[38px] font-extrabold text-bluewood-900 leading-[1.3] mb-3" style={{ wordBreak: 'keep-all' }}>
              기업을 분석하고,<br />
              <span className="text-[#1B264F]">알맞는 포트폴리오를 자동 생성</span>해요
            </h2>
            <p className="text-[14px] text-bluewood-400 leading-relaxed">
              We analyze job postings and generate tailored portfolios that match company requirements.
            </p>
          </div>

          {/* ── Sub 1: 채용공고 분석 ── */}
          <div className="bg-white rounded-3xl p-8 md:p-12 mb-8">
            <div className="flex flex-col lg:flex-row gap-10 items-start">
              <div className="lg:w-[380px] shrink-0">
                <span className="inline-block px-2.5 py-1 bg-primary-100 text-primary-700 text-[11px] font-bold rounded mb-4">채용공고 분석</span>
                <h3 className="text-[22px] font-extrabold text-bluewood-900 leading-[1.4] mb-3" style={{ wordBreak: 'keep-all' }}>
                  채용 링크 한 줄이면,<br />
                  <span className="text-primary-600">기업·직무를 AI가 분석</span>해요
                </h3>
                <p className="text-[13px] text-bluewood-400 leading-relaxed mb-6">
                  자소설닷컴, 잡코리아, 사람인 등 채용 사이트 URL을 입력하면<br />
                  기업 분석, 직무 분석, 지원 전략까지 자동으로 생성돼요.
                </p>
                <div className="space-y-2">
                  {['기업 SWOT·경쟁사·문화 분석', '직무 자격요건·핵심역량 정리', '포트폴리오 필수 요소 체크리스트'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px] text-bluewood-500">
                      <div className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-primary-600" />
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
                      <div className="px-4 py-2 bg-[#1B264F] text-white rounded-lg text-[12px] font-bold shrink-0">분석하기</div>
                    </div>
                  </div>

                  {/* Analysis result */}
                  <div className="p-5">
                    {/* Company header */}
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-surface-100">
                      <div>
                        <p className="text-[14px] font-bold text-bluewood-900">카카오 · UX 디자이너</p>
                        <p className="text-[11px] text-bluewood-400 mt-0.5">IT/플랫폼 · 경력 1~3년</p>
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
                <span className="inline-block px-2.5 py-1 bg-primary-100 text-primary-700 text-[11px] font-bold rounded mb-4">포트폴리오 에디터</span>
                <h3 className="text-[22px] font-extrabold text-bluewood-900 leading-[1.4] mb-3" style={{ wordBreak: 'keep-all' }}>
                  분석 결과 기반으로,<br />
                  <span className="text-primary-600">포트폴리오가 자동 완성</span>돼요
                </h3>
                <p className="text-[13px] text-bluewood-400 leading-relaxed mb-6">
                  정리된 경험과 기업 분석을 결합하여 맞춤형 포트폴리오를<br />
                  자동 생성하고, 노션 스타일 에디터로 자유롭게 편집해요.
                </p>
                <div className="space-y-2">
                  {['4가지 템플릿 (Notion·Ashley·Academic·Timeline)', '경험 자동 매칭 및 섹션 배치', 'PDF Export 및 공유 링크 생성'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px] text-bluewood-500">
                      <div className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-primary-600" />
                      </div>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mock Portfolio Editor */}
              {/* Mock Portfolio Editor (Notion Style) */}
              <div className="flex-1 w-full">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden p-6 md:p-8">
                  {/* Header */}
                  <div className="mb-6">
                    <h4 className="text-[28px] font-extrabold text-bluewood-900 mb-1 tracking-tight">XX기업 포트폴리오</h4>
                    <p className="text-[12px] text-bluewood-400">본 포트폴리오는 PC 환경에 최적화되어 있습니다.</p>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 mb-8 overflow-x-auto pb-2 border-b border-surface-100">
                    {['교과 활동', '비교과 활동', '기술', '목표와 계획', '가치관'].map((tab, i) => (
                      <span key={i} className="px-4 py-1.5 bg-surface-50 text-bluewood-600 text-[12px] font-bold rounded-lg shrink-0 hover:bg-surface-100 cursor-pointer transition-colors">
                        {tab}
                      </span>
                    ))}
                  </div>

                  {/* Content Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left Column (Profile) */}
                    <div className="lg:col-span-3 lg:border-r border-surface-100 lg:pr-4">
                      <p className="text-[10px] font-bold text-bluewood-300 tracking-widest mb-3 border-l-2 border-surface-300 pl-2">PROFILE</p>
                      <div className="bg-surface-100 rounded-xl aspect-square mb-4 flex items-center justify-center">
                        <Users size={40} className="text-bluewood-300" />
                      </div>
                      <h5 className="text-[18px] font-extrabold text-bluewood-900 mb-0.5">김XX</h5>
                      <p className="text-[11px] text-bluewood-400 mb-4">(KIM XX XXX)</p>
                      
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-[11px] text-bluewood-500">
                          <MapPin size={12} /> 경기도 XX시
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-bluewood-500">
                          <Calendar size={12} /> XXXX.XX.XX
                        </div>
                      </div>
                      
                      <p className="text-[12px] font-bold italic text-bluewood-900 mb-3">My Own Values</p>
                      <div className="space-y-2">
                        <div className="px-3 py-2 border border-surface-100 rounded-lg text-[11px] font-bold text-bluewood-700 flex items-center gap-2 shadow-sm">
                          <span className="text-primary-500 font-extrabold text-[14px] leading-none">+</span> 경험
                        </div>
                        <div className="px-3 py-2 border border-surface-100 rounded-lg text-[11px] font-bold text-bluewood-700 flex items-center gap-2 shadow-sm">
                          <span className="text-purple-500 font-extrabold text-[14px] leading-none">-</span> 추억
                        </div>
                        <div className="px-3 py-2 border border-surface-100 rounded-lg text-[11px] font-bold text-bluewood-700 flex items-center gap-2 shadow-sm">
                          <span className="text-blue-500 font-extrabold text-[14px] leading-none">×</span> 리더십
                        </div>
                      </div>
                    </div>

                    {/* Middle Column (Education, Interest, Contact) */}
                    <div className="lg:col-span-4 space-y-8">
                      <div>
                        <p className="text-[14px] font-extrabold text-bluewood-900 flex items-center gap-2 mb-4">
                          🎓 Education
                        </p>
                        <p className="text-[13px] font-bold text-bluewood-800 mb-1">XX대학교</p>
                        <p className="text-[11px] text-bluewood-400 mb-1">2021.03 - 2027.03</p>
                        <p className="text-[11px] text-bluewood-500">재학 경영학과</p>
                      </div>
                      
                      <div>
                        <p className="text-[14px] font-extrabold text-bluewood-900 flex items-center gap-2 mb-4">
                          💡 Interest
                        </p>
                        <ul className="text-[12px] text-bluewood-600 space-y-2 pl-2">
                          <li className="flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-bluewood-400 before:rounded-full">독서</li>
                          <li className="flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-bluewood-400 before:rounded-full">코딩</li>
                          <li className="flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-bluewood-400 before:rounded-full">여행</li>
                        </ul>
                      </div>
                      
                      <div>
                        <p className="text-[14px] font-extrabold text-bluewood-900 flex items-center gap-2 mb-4">
                          📞 Contact Information
                        </p>
                        <div className="space-y-3 text-[11px] text-bluewood-600">
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-bluewood-400" /> 010-XXXX-XXXX
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail size={12} className="text-bluewood-400" /> XXXX@naver.com
                          </div>
                          <div className="flex items-center gap-2">
                            <LinkIcon size={12} className="text-bluewood-400" /> https://www.linkedin.com/in
                          </div>
                          <div className="flex items-center gap-2">
                            <LinkIcon size={12} className="text-bluewood-400" /> https://github.com
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column (Awards, Experience) */}
                    <div className="lg:col-span-5 space-y-8 bg-surface-50/50 p-5 rounded-xl border border-surface-100">
                      <div>
                        <p className="text-[13px] font-extrabold text-bluewood-900 flex items-center gap-2 mb-4">
                          🏆 Scholarship and Awards
                        </p>
                        <div className="space-y-3">
                          <div className="flex gap-2 items-start text-[11px]">
                            <span className="text-primary-500 font-bold shrink-0">2023.06.02</span>
                            <span className="text-bluewood-600 font-medium leading-tight">XX기업 해커톤 대상</span>
                          </div>
                          <div className="flex gap-2 items-start text-[11px]">
                            <span className="text-primary-500 font-bold shrink-0">2025.05.11</span>
                            <span className="text-bluewood-600 font-medium leading-tight">ESG 캠페인 기획 장려상</span>
                          </div>
                          <div className="flex gap-2 items-start text-[11px]">
                            <span className="text-primary-500 font-bold shrink-0">2026.02.03</span>
                            <span className="text-bluewood-600 font-medium leading-tight">XX 영상 제작 최우수상</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-[13px] font-extrabold text-bluewood-900 flex items-center gap-2 mb-4">
                          🔥 Experience
                        </p>
                        <div className="space-y-3">
                          <div className="flex gap-2 items-start text-[11px]">
                            <span className="text-bluewood-500 font-bold shrink-0 underline decoration-surface-300 underline-offset-2">2026-04</span>
                            <span className="text-bluewood-600 font-medium line-clamp-1">세가지 막막함</span>
                          </div>
                          <div className="flex gap-2 items-start text-[11px]">
                            <span className="text-bluewood-500 font-bold shrink-0 underline decoration-surface-300 underline-offset-2">2026-04</span>
                            <span className="text-bluewood-600 font-medium line-clamp-1">취준생들의 막막함 해결 포트폴리오</span>
                          </div>
                          <div className="flex gap-2 items-start text-[11px]">
                            <span className="text-bluewood-500 font-bold shrink-0 underline decoration-surface-300 underline-offset-2">2026-04</span>
                            <span className="text-bluewood-600 font-medium line-clamp-1">iot 기반 학교 문제 3가지 해결</span>
                          </div>
                          <div className="flex gap-2 items-start text-[11px]">
                            <span className="text-bluewood-500 font-bold shrink-0 underline decoration-surface-300 underline-offset-2">2026-04</span>
                            <span className="text-bluewood-600 font-medium line-clamp-1">eretret</span>
                          </div>
                          <div className="flex gap-2 items-start text-[11px]">
                            <span className="text-bluewood-500 font-bold shrink-0 underline decoration-surface-300 underline-offset-2">2026-04</span>
                            <span className="text-bluewood-600 font-medium line-clamp-1">딥페이크</span>
                          </div>
                          <p className="text-[10px] text-bluewood-400 mt-2 pt-2 border-t border-surface-200">외 2건 — 아래 갤러리에서 확인</p>
                        </div>
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
         ║               FAQ                ║
         ╚══════════════════════════════════╝ */}
      <section className="py-32 bg-[#f8f9fa]">
        <div className="max-w-[900px] mx-auto px-8 flex flex-col md:flex-row gap-12 md:gap-32">
          <div className="md:w-[240px] shrink-0 pt-2">
            <p className="text-[11px] tracking-[0.15em] text-gray-400 font-bold mb-4">FAQ</p>
            <h2 className="text-[32px] md:text-[36px] font-extrabold text-gray-900 leading-[1.3] tracking-tight">
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
                    className="w-full flex items-center justify-between py-6 text-left focus:outline-none group"
                  >
                    <span className="text-[15px] font-bold text-gray-900 group-hover:text-[#4F46E5] transition-colors">{faq.q}</span>
                    <span 
                      className="text-gray-400 text-[24px] font-light leading-none ml-4 transition-transform duration-300 inline-block" 
                      style={{ transform: openFaqs.includes(i) ? 'rotate(45deg)' : 'none' }}
                    >
                      +
                    </span>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      openFaqs.includes(i) ? 'max-h-40 pb-6 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <p className="text-[14px] text-gray-500 leading-relaxed pr-8">
                      {faq.a}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║           CTA BANNER             ║
         ╚══════════════════════════════════╝ */}
      <section className="py-32 bg-white flex flex-col items-center text-center px-4">
        <h2 className="text-[36px] md:text-[52px] font-extrabold text-gray-900 leading-[1.25] mb-6 tracking-[-0.03em]">
          다음 공고 마감 전에,<br />
          <span className="text-[#4F46E5]">먼저</span> 등록하세요.
        </h2>
        <p className="text-[15px] text-gray-500 mb-10 leading-relaxed font-medium">
          평균 제작 시간 12분.<br />
          12분이면 다음 공고는 다른 결과를 받을 수도 있어요.
        </p>
        <div className="w-full max-w-[420px] flex flex-col items-center">
          <div className="w-full flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder="이메일 주소"
              className="flex-1 px-5 py-4 bg-[#f8f9fa] border border-gray-200 rounded-xl text-[14px] font-medium focus:outline-none focus:border-gray-300 transition-all placeholder:text-gray-400 disabled:opacity-50"
              disabled={waitlistStatus.type === 'loading'}
            />
            <button 
              onClick={handleWaitlistSubmit}
              disabled={waitlistStatus.type === 'loading' || !waitlistEmail}
              className="bg-gray-900 text-white px-6 py-4 rounded-xl text-[14px] font-bold hover:bg-black transition-colors flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              {waitlistStatus.type === 'loading' ? '등록 중...' : (
                <>대기자 명단 등록 <span className="text-[16px] leading-none mb-[2px]">→</span></>
              )}
            </button>
          </div>
          {waitlistStatus.message && (
            <p className={`mt-3 text-[13px] font-bold ${waitlistStatus.type === 'success' ? 'text-caribbean-600' : 'text-red-500'}`}>
              {waitlistStatus.message}
            </p>
          )}
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
