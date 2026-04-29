import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
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
import { db } from '../config/firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

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

const MOCK_UPLOAD_FILES = [
  { name: '프로젝트_회고록.hwp', size: '245 KB', color: 'bg-blue-500' },
  { name: '포트폴리오_v3.pdf', size: '1.2 MB', color: 'bg-red-500' },
  { name: '개발일지_2025.docx', size: '380 KB', color: 'bg-indigo-500' },
  { name: '자기소개서_최종.hwp', size: '178 KB', color: 'bg-blue-500' },
];

export default function Landing() {
  const { user } = useAuthStore();
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

  const [uploadAnimStep, setUploadAnimStep] = useState(0);
  const [uploadZoneActive, setUploadZoneActive] = useState(false);
  const [uploadLoopKey, setUploadLoopKey] = useState(0);
  const uploadTimersRef = useRef([]);

  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState({ type: 'idle', message: '' });

  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [count1, setCount1] = useState(0);
  const [count3, setCount3] = useState(0);

  const [aiMockView, setAiMockView] = useState('experience');
  useEffect(() => {
    const interval = setInterval(() => {
      setAiMockView(prev => prev === 'experience' ? 'portfolio' : 'experience');
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleWaitlistSubmit = async () => {
    if (!waitlistEmail) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(waitlistEmail)) {
      setWaitlistStatus({ type: 'error', message: '올바른 이메일 주소를 입력해주세요.' });
      return;
    }
    setWaitlistStatus({ type: 'loading', message: '' });

    try {
      // 중복 이메일 확인
      const q = query(collection(db, 'waitlist'), where('email', '==', waitlistEmail.toLowerCase().trim()));
      const existing = await getDocs(q);
      if (!existing.empty) {
        setWaitlistStatus({ type: 'error', message: '이미 등록된 이메일입니다. 출시 알림을 보내드릴게요! 🎁' });
        return;
      }
      // Firestore에 저장
      await addDoc(collection(db, 'waitlist'), {
        email: waitlistEmail.toLowerCase().trim(),
        registeredAt: serverTimestamp(),
        couponGranted: false,
      });
      setWaitlistStatus({ type: 'success', message: '출시 예약 완료! 정식 출시 시 무료 쿠폰 3장을 보내드릴게요 🎁' });
      setWaitlistEmail('');
    } catch (error) {
      console.error(error);
      setWaitlistStatus({ type: 'error', message: '등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
    }
  };

  const go = () => navigate(user ? '/app' : '/login');

  useEffect(() => { setHeroVisible(true); }, []);

  useEffect(() => {
    const FILE_INTERVAL = 1300;
    const ZONE_DURATION = 550;
    const FILE_COUNT = MOCK_UPLOAD_FILES.length;

    const runLoop = (loopNum) => {
      setUploadAnimStep(0);
      setUploadLoopKey(loopNum);
      setUploadZoneActive(false);

      for (let i = 0; i < FILE_COUNT; i++) {
        const base = 700 + i * FILE_INTERVAL;
        uploadTimersRef.current.push(
          setTimeout(() => setUploadZoneActive(true), base),
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.2 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!statsVisible) return;
    let step1 = 0, step3 = 0;
    const STEPS = 50;
    const t1 = setInterval(() => {
      step1++;
      setCount1(parseFloat(((83.4 / STEPS) * step1).toFixed(1)));
      if (step1 >= STEPS) clearInterval(t1);
    }, 1500 / STEPS);
    const t3 = setInterval(() => {
      step3++;
      setCount3(Math.round((72 / STEPS) * step3));
      if (step3 >= STEPS) clearInterval(t3);
    }, 1800 / STEPS);
    return () => { clearInterval(t1); clearInterval(t3); };
  }, [statsVisible]);

  return (
    <div className="min-h-screen bg-[#f0f2f7] w-full overflow-x-hidden">

      {/* ── FLOATING HEADER ── */}
      <div className="fixed top-4 sm:top-6 inset-x-0 z-50 px-3 sm:px-4 flex justify-center">
        <div className="bg-[#f3f4f6]/95 backdrop-blur-md rounded-full px-2 py-1.5 flex items-center justify-between gap-2 sm:gap-4 md:gap-6 shadow-sm border border-gray-200/50 w-full max-w-[min(100%,400px)] md:max-w-none md:w-auto">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 px-2 sm:px-3 shrink-0">
            <img src="/logo.png" alt="FitPoly" className="h-5 w-auto" />
            <span className="font-extrabold text-[14px] sm:text-[15px] text-gray-900 tracking-tight">FitPoly</span>
          </button>
          <nav className="hidden md:flex items-center gap-5 text-[13px] font-medium text-gray-600 px-2">
            <a href="#feature-experience" className="hover:text-black transition-colors">경험정리</a>
            <a href="#feature-portfolio" className="hover:text-black transition-colors">포트폴리오</a>
            <button onClick={go} className="hover:text-black transition-colors">로그인</button>
          </nav>
          <button onClick={go} className="bg-gray-900 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-[12px] sm:text-[13px] font-bold hover:bg-black transition-colors shrink-0 whitespace-nowrap">
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
            <img src="https://cdn.simpleicons.org/notion/000000" alt="Notion" className="w-8 h-8" />
          </div>
          {/* GitHub */}
          <div className="hidden md:flex absolute top-[18%] right-[22%] w-14 h-14 bg-[#181717] rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] items-center justify-center animate-float-medium" style={{ animationDelay: '1.5s' }}>
            <img src="https://cdn.simpleicons.org/github/ffffff" alt="GitHub" className="w-8 h-8" />
          </div>
          {/* KakaoTalk */}
          <div className="hidden lg:flex absolute bottom-[35%] left-[15%] w-20 h-20 bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-fast" style={{ animationDelay: '0.5s' }}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg" alt="KakaoTalk" className="w-12 h-12" />
          </div>
          {/* Slack */}
          <div className="hidden lg:flex absolute top-[40%] left-[8%] w-12 h-12 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] items-center justify-center animate-float-slow" style={{ animationDelay: '2s' }}>
            <img src="https://api.iconify.design/logos:slack-icon.svg" alt="Slack" className="w-7 h-7" />
          </div>
          {/* Figma */}
          <div className="hidden md:flex absolute bottom-[28%] right-[15%] w-16 h-16 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-medium" style={{ animationDelay: '3s' }}>
            <img src="https://api.iconify.design/logos:figma.svg" alt="Figma" className="w-8 h-8" />
          </div>
          {/* Google Drive */}
          <div className="hidden lg:flex absolute top-[10%] right-[38%] w-12 h-12 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-fast" style={{ animationDelay: '1s' }}>
            <img src="https://api.iconify.design/logos:google-drive.svg" alt="Google Drive" className="w-6 h-6" />
          </div>
          {/* PDF */}
          <div className="hidden lg:flex absolute bottom-[20%] right-[35%] w-14 h-14 bg-white rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-slow" style={{ animationDelay: '2.5s' }}>
            <img src="https://api.iconify.design/vscode-icons:file-type-pdf2.svg" alt="PDF" className="w-8 h-8" />
          </div>
          {/* Google Docs */}
          <div className="hidden md:flex absolute top-[55%] right-[10%] w-[72px] h-[72px] bg-white rounded-[22px] shadow-[0_12px_40px_rgb(0,0,0,0.08)] items-center justify-center animate-float-medium" style={{ animationDelay: '0.8s' }}>
            <img src="https://cdn.simpleicons.org/googledocs/4285F4" alt="Google Docs" className="w-9 h-9" />
          </div>
          {/* Gmail */}
          <div className="hidden lg:flex absolute bottom-[15%] left-[35%] w-14 h-14 bg-white rounded-[18px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] items-center justify-center animate-float-fast" style={{ animationDelay: '1.8s' }}>
            <img src="https://api.iconify.design/logos:google-gmail.svg" alt="Gmail" className="w-8 h-8" />
          </div>
          {/* Discord */}
          <div className="hidden lg:flex absolute top-[12%] left-[35%] w-12 h-12 bg-[#5865F2] rounded-2xl shadow-[0_8px_30px_rgb(88,101,242,0.25)] items-center justify-center animate-float-slow" style={{ animationDelay: '0.3s' }}>
            <img src="https://cdn.simpleicons.org/discord/ffffff" alt="Discord" className="w-7 h-7" />
          </div>
        </div>

        {/* Center Text */}
        <div className={`relative z-10 text-center flex flex-col items-center justify-center transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} px-4 sm:px-6 -mt-6 sm:-mt-8 md:-mt-16`}>
          <p className="text-[13px] sm:text-[16px] md:text-[20px] font-bold text-indigo-500 mb-3 sm:mb-4 md:mb-6">끝없이 쌓여가는 취업 준비 자료들</p>
          <h1 className="text-[26px] sm:text-[38px] md:text-[60px] lg:text-[68px] font-extrabold leading-[1.25] text-gray-900 tracking-[-0.03em] flex flex-col items-center gap-1">
            <span>여기저기 흩어진 경험들,</span>
            <span>어떻게 관리하고 계시나요?</span>
          </h1>
        </div>
      </section>

      {/* ── PROBLEM DEFINITION ── */}
      <section className="bg-white py-16 sm:py-20 md:py-24 pb-8 sm:pb-12">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 md:px-8">
          <div className="mb-10 sm:mb-14 text-center">
            <h2 className="text-[26px] sm:text-[32px] md:text-[40px] font-extrabold text-gray-900 mb-4 tracking-tight leading-[1.3]">
              합격하는 취준생은 다릅니다.<br className="sm:hidden" />
              <span className="text-indigo-600"> 당신의 포트폴리오는 안전한가요?</span>
            </h2>
            <p className="text-[14px] sm:text-[16px] text-gray-500 font-medium">데이터가 증명하는 서류 광탈의 3가지 이유</p>
          </div>

          <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 md:gap-8 mb-12 sm:mb-16">
            {/* Top Left Card: 평소 기록 안하는 비율 */}
            <div className="bg-[#f8f9fc] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
              <div className="mb-8">
                <h3 className="text-[20px] sm:text-[24px] font-extrabold text-gray-900 mb-3 leading-snug">
                  열심히 했는데,<br/>막상 쓰려면 기억이 안 나요
                </h3>
                 <p className="text-[13px] sm:text-[15px] text-gray-500 leading-relaxed font-medium">
                  분명 성과가 있었는데 자소서에 쓸 수치가 없어서 '성실히 임했습니다'로 끝나는 취준생 비율
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 mb-3">취준생 10명 중 수치 없이 제출</p>
                <div className="flex gap-1.5 mb-5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className="w-full rounded-full transition-all duration-500"
                        style={{
                          aspectRatio: '1',
                          background: statsVisible && i < 8 ? '#1B264F' : '#E5E7EB',
                          transitionDelay: `${i * 90}ms`,
                          transform: statsVisible && i < 8 ? 'scale(1)' : 'scale(0.7)',
                        }}
                      />
                      <div
                        className="w-[65%] rounded-t-full transition-all duration-500"
                        style={{
                          height: '7px',
                          background: statsVisible && i < 8 ? '#1B264F' : '#E5E7EB',
                          transitionDelay: `${i * 90 + 45}ms`,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-[32px] sm:text-[36px] font-extrabold text-gray-900 leading-none tabular-nums">
                    {count1.toFixed(1)}<span className="text-[18px] text-gray-500">%</span>
                  </span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1B264F] rounded-full"
                    style={{ width: statsVisible ? '83.4%' : '0%', transition: 'width 1.5s ease-out' }}
                  />
                </div>
              </div>
            </div>

            {/* Top Right Card: 무작위 지원 탈락 비율 */}
            <div className="bg-[#f8f9fc] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
              <div className="mb-8">
                <h3 className="text-[20px] sm:text-[24px] font-extrabold text-gray-900 mb-3 leading-snug">
                  다 보내긴 했는데,<br/>왜 계속 서류에서 떨어질까요
                </h3>
                 <p className="text-[13px] sm:text-[15px] text-gray-500 leading-relaxed font-medium">
                  기업별 맞춤화 없이 같은 포트폴리오를 복붙해 지원했다가 서류 단계에서 바로 탈락하는 비율
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 h-[190px] flex items-end gap-3 sm:gap-6 px-4 sm:px-8 justify-center">
                <div className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                  <span
                    className="text-[12px] font-extrabold text-gray-400 transition-opacity duration-500"
                    style={{ opacity: statsVisible ? 1 : 0, transitionDelay: '0.3s' }}
                  >맞춤 지원</span>
                  <div
                    className="w-8 sm:w-12 bg-gray-200 rounded-t-md"
                    style={{ height: statsVisible ? '35%' : '0%', transition: 'height 0.8s ease-out 0.2s' }}
                  />
                  <span className="text-[11px] font-bold text-gray-400">통과율</span>
                </div>
                <div className="flex-[1.2] flex flex-col items-center justify-end h-full gap-2">
                  <span
                    className="text-[15px] font-extrabold text-[#1B264F] mb-1 transition-all duration-500"
                    style={{ opacity: statsVisible ? 1 : 0, transform: statsVisible ? 'translateY(0)' : 'translateY(8px)', transitionDelay: '0.9s' }}
                  >92%</span>
                  <div
                    className="w-8 sm:w-12 bg-[#1B264F] rounded-t-md"
                    style={{ height: statsVisible ? '92%' : '0%', transition: 'height 0.9s cubic-bezier(0.34,1.56,0.64,1) 0.5s' }}
                  />
                  <span className="text-[11px] font-bold text-[#1B264F]">무작위 탈락</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                  <span
                    className="text-[12px] font-extrabold text-gray-400 transition-opacity duration-500"
                    style={{ opacity: statsVisible ? 1 : 0, transitionDelay: '0.5s' }}
                  >시간 지연</span>
                  <div
                    className="w-8 sm:w-12 bg-gray-300 rounded-t-md"
                    style={{ height: statsVisible ? '50%' : '0%', transition: 'height 0.8s ease-out 0.35s' }}
                  />
                  <span className="text-[11px] font-bold text-gray-400">포기율</span>
                </div>
              </div>
            </div>

            {/* Bottom Card: 시간 소모 - Full Width */}
            <div className="md:col-span-2 bg-[#f8f9fc] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
              <div className="flex-1">
                <h3 className="text-[20px] sm:text-[26px] font-extrabold text-gray-900 mb-4 leading-snug">
                  포트폴리오 하나에<br/>하루가 통째로 사라져요
                </h3>
                 <p className="text-[13px] sm:text-[15px] text-gray-500 leading-relaxed font-medium mb-6 lg:max-w-[460px]">
                  템플릿 찾다 한 시간, 과거 기록 뒤지다 두 시간, 여백 맞추다 또 한 시간. 이 시간이면 <strong className="text-[#1B264F]">기업 20곳을 더 분석하고 지원</strong>할 수 있어요.
                </p>
              </div>
              <div className="w-full md:w-[320px] bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col justify-center relative overflow-hidden">
                <p className="text-[13px] font-bold text-gray-400">포트폴리오 1개 제작 평균 소요 시간</p>
                <div className="flex items-baseline gap-1.5 mt-1 mb-5">
                  <span className="text-[46px] sm:text-[52px] font-extrabold text-gray-900 tracking-tighter leading-none tabular-nums">
                    {count3 >= 72 ? '72' : count3}
                  </span>
                  <span className="text-[18px] font-bold text-gray-500">시간</span>
                </div>
                <p className="text-[11px] font-bold text-gray-400 mb-2">일주일 중 사라지는 날</p>
                <div className="flex gap-1.5">
                  {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-md transition-all duration-500"
                        style={{
                          height: '28px',
                          background: statsVisible && i < 3 ? '#1B264F' : '#E5E7EB',
                          transitionDelay: `${i * 120 + 400}ms`,
                          transform: statsVisible && i < 3 ? 'scaleY(1)' : 'scaleY(0.4)',
                          transformOrigin: 'bottom',
                        }}
                      />
                      <span
                        className="text-[10px] font-bold transition-colors duration-500"
                        style={{ color: statsVisible && i < 3 ? '#1B264F' : '#9CA3AF', transitionDelay: `${i * 120 + 400}ms` }}
                      >{day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Gray Box */}
          <div className="bg-[#f8f9fa] rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 md:p-16 text-center">
            <h3 className="text-[18px] sm:text-[22px] md:text-[28px] font-extrabold text-gray-900 leading-[1.4] mb-3 sm:mb-4">
              여기저기 흩어진 채널들,<br />
              정리하지 않은 자료들이 쌓여가고 있진 않나요?
            </h3>
            <p className="text-[13px] sm:text-[15px] text-gray-500 leading-[1.6] mb-8 sm:mb-12 font-medium">
              중요한 경험은 흩어진 채널 어딘가에서 잠들어 있어요.<br />
              혹시 나도 잠든 자료의 무게를 안고 다니는 건 아닐까요?
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4">
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
                <div key={i} className={`w-10 h-10 sm:w-12 sm:h-12 md:w-[60px] md:h-[60px] ${icon.bg} rounded-xl sm:rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex items-center justify-center`}>
                  <img src={icon.url} alt={icon.name} className={`${icon.name === 'KakaoTalk' ? 'w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10' : 'w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE 1 — 경험 정리 ── */}
      <section id="feature-experience" className="py-16 sm:py-20 md:py-24 bg-white">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 xl:px-16">
          <div className="mb-10 sm:mb-14 md:mb-16">
            <span className="inline-block px-3 py-1 bg-primary-500 text-white text-[11px] font-bold rounded-md mb-3 sm:mb-4 tracking-wide">핵심 기능 1. 경험 정리</span>
            <h2 className="text-[24px] sm:text-[32px] md:text-[38px] font-extrabold text-bluewood-900 leading-[1.3] mb-3" style={{ wordBreak: 'keep-all' }}>
              파편화된 다양한 파일을,<br />
              <span className="text-primary-500">체계적인 경험 아카이브</span>로 정리해요
            </h2>
          </div>

          {/* 파일 업로드 */}
          <div className="bg-[#f8f9fc] rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 mb-6 sm:mb-8">
            <ResponsiveScaleWrapper minWidth={900}>
              <div className="flex flex-row flex-nowrap gap-10 items-start w-full">
                <div className="w-[380px] shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-primary-100 text-primary-700 text-[11px] font-bold rounded mb-4 sm:mb-6">파일 업로드</span>
                <h3 className="text-[24px] sm:text-[30px] font-extrabold text-bluewood-900 leading-[1.3] mb-6 sm:mb-8" style={{ wordBreak: 'keep-all' }}>
                  어떤 파일이든,<br />
                  <span className="text-primary-500">숨겨진 경험을<br />꺼냅니다</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['HWP · PDF · DOCX', 'Notion · GitHub · Blog'].map((t, i) => (
                    <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-600 text-[12px] font-bold rounded-full border border-primary-100">{t}</span>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full min-w-0">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-100 flex items-center gap-3">
                    <div>
                      <p className="text-[12px] sm:text-[13px] font-bold text-bluewood-900">경험 데이터 수집</p>
                      <p className="text-[10px] sm:text-[11px] text-bluewood-400">파일, 텍스트, URL을 추가해주세요</p>
                    </div>
                  </div>
                  <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                    <div className={`border-2 border-dashed rounded-xl p-4 sm:p-6 text-center transition-all duration-300 ${uploadZoneActive
                        ? 'border-primary-400 bg-primary-100/60 scale-[1.015]'
                        : 'border-primary-200 bg-primary-50/30'
                      }`}>
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 mx-auto rounded-full flex items-center justify-center mb-2 sm:mb-3 transition-all duration-300 ${uploadZoneActive ? 'bg-primary-200 scale-110' : 'bg-primary-100'
                        }`}>
                        <FileUp size={16} className={`text-primary-500 transition-transform duration-300 ${uploadZoneActive ? 'animate-bounce' : ''}`} />
                      </div>
                      <p className="text-[12px] sm:text-[13px] font-semibold text-bluewood-700 mb-1">
                        {uploadZoneActive ? '파일 인식 중…' : '파일을 드래그하거나 클릭하여 업로드'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-bluewood-400">HWP, PDF, DOCX, TXT (최대 10개)</p>
                    </div>
                    <div className="space-y-2 h-[200px] sm:h-[220px] overflow-hidden">
                      {MOCK_UPLOAD_FILES.slice(0, uploadAnimStep).map((f, i) => (
                        <div
                          key={`${uploadLoopKey}-${i}`}
                          className="flex items-center px-4 sm:px-5 py-2.5 sm:py-3 bg-surface-50 rounded-lg animate-slide-in-file"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] sm:text-[12px] font-semibold text-bluewood-800 truncate">{f.name}</p>
                            <p className="text-[9px] sm:text-[10px] text-bluewood-400">{f.size}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-surface-50 rounded-lg border border-surface-200 overflow-hidden">
                        <span className="text-[11px] sm:text-[12px] text-bluewood-400 truncate block">https://notion.so/my-project...</span>
                      </div>
                      <div className="px-2.5 sm:px-3 py-2 bg-primary-50 text-primary-600 rounded-lg text-[11px] font-bold shrink-0">+ 추가</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </ResponsiveScaleWrapper>
          </div>

          {/* AI 포트폴리오 에디터 */}
          <div className="bg-[#f8f9fc] rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 mb-6 sm:mb-8">
            <ResponsiveScaleWrapper minWidth={1000}>
              <div className="flex flex-row-reverse flex-nowrap gap-10 items-start w-full">
                <div className="w-[380px] shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-caribbean-100 text-caribbean-700 text-[11px] font-bold rounded mb-4 sm:mb-6">AI 포트폴리오 에디터</span>
                <h3 className="text-[24px] sm:text-[30px] font-extrabold text-bluewood-900 leading-[1.3] mb-6 sm:mb-8" style={{ wordBreak: 'keep-all' }}>
                  흩어진 경험들이,<br />
                  <span className="text-primary-500">하나의 서사로<br />재탄생합니다</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['핵심 역량 자동 추출', '블록형 포트폴리오'].map((t, i) => (
                    <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-600 text-[12px] font-bold rounded-full border border-primary-100">{t}</span>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full min-w-0 grid">
                {/* View 1: Experience Review */}
                <div className={`col-start-1 row-start-1 w-full transition-opacity duration-1000 ${aiMockView === 'experience' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                  <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-surface-200 h-full flex flex-col text-left">
                    <div className="border-b border-surface-100 px-4 sm:px-5 py-3 flex items-center justify-between bg-surface-50/50">
                      <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] text-bluewood-400 font-medium overflow-hidden">
                        <span className="shrink-0">✓ 기본 정보</span>
                        <span className="shrink-0 hidden sm:inline">✓ 자료 수집</span>
                        <span className="text-bluewood-900 font-bold shrink-0">경험 검토</span>
                      </div>
                      <span className="text-[10px] text-bluewood-300 font-bold tracking-widest shrink-0">1/4</span>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                      <div className="hidden sm:block w-[160px] md:w-[180px] border-r border-surface-100 bg-surface-50/30 p-3 sm:p-4 shrink-0">
                        <p className="text-[10px] font-bold text-bluewood-300 mb-3">경험 목록</p>
                        <div className="space-y-3">
                          <div className="bg-bluewood-900 text-white rounded-lg p-2.5 shadow-sm">
                            <p className="text-[9px] text-white/70 mb-0.5 font-bold">1.</p>
                            <p className="text-[10px] sm:text-[11px] font-bold leading-tight">AI 챗봇 서비스 도입을 통한 CS 효율화</p>
                          </div>
                          <div className="p-2.5 opacity-40">
                            <p className="text-[9px] mb-0.5 font-bold text-bluewood-900">2.</p>
                            <p className="text-[10px] sm:text-[11px] font-bold leading-tight text-bluewood-900">고객 여정 지도 설계를 통한 전환율 향상</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 p-4 sm:p-6 bg-white overflow-hidden">
                        <div className="bg-primary-50 text-primary-600 text-[11px] px-3 py-2 rounded-lg mb-3 sm:mb-4 font-medium flex items-center gap-2">
                          <Check size={12} /> "문제 정의", "데이터 분석" 역량이 확인됩니다.
                        </div>

                        <div className="border border-surface-200 rounded-xl p-4 sm:p-5 bg-white shadow-sm relative">
                          <button className="absolute top-3 right-3 sm:top-4 sm:right-4 px-2 sm:px-3 py-1 bg-white border border-surface-200 rounded-md text-[10px] font-bold text-bluewood-400 shadow-sm">
                            수정
                          </button>
                          <div className="inline-block px-2 py-0.5 bg-surface-100 text-bluewood-500 text-[10px] font-bold rounded mb-2">문제 상황 (Background)</div>
                          <h4 className="text-[13px] sm:text-[15px] font-extrabold text-bluewood-900 mb-2 sm:mb-3 pr-12">기존 CS 프로세스 병목 현상 분석</h4>
                          <p className="text-[11px] sm:text-[12px] text-bluewood-500 leading-relaxed mb-3 sm:mb-4">
                            서비스 성장과 함께 일평균 고객 문의량이 급증하였으며, 기존 인력만으로는 대응 지연 현상이 발생하고 있었습니다. 특히 단순 반복 문의가 전체의 65%를 차지하여 심각한 병목 현상을 파악했습니다.
                          </p>
                          <ul className="text-[10px] sm:text-[11px] text-bluewood-400 space-y-1.5 list-disc pl-4 mb-4 sm:mb-5 leading-relaxed">
                            <li>VOC 데이터를 주간 단위로 수집하여 문의 유형을 분석했습니다.</li>
                            <li>챗봇으로 자동화 가능한 '단순 정보성 문의' 비율(65%)을 정량적으로 도출했습니다.</li>
                          </ul>
                          <div className="border-t border-surface-100 pt-3 sm:pt-4">
                            <p className="text-[10px] font-bold text-bluewood-300 mb-2">역량 키워드</p>
                            <div className="flex gap-2 flex-wrap">
                              <span className="px-2.5 py-1 bg-surface-100 text-bluewood-500 text-[10px] font-bold rounded-md">데이터 분석</span>
                              <span className="px-2.5 py-1 bg-surface-100 text-bluewood-500 text-[10px] font-bold rounded-md">문제 정의</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-surface-100 bg-white px-4 sm:px-5 py-3 flex items-center justify-between shrink-0">
                      <span className="text-[11px] font-bold text-red-400 cursor-pointer">이 경험 제외</span>
                      <div className="flex gap-2">
                        <button className="px-3 sm:px-4 py-1.5 text-[11px] font-bold text-bluewood-400 rounded-md">이전</button>
                        <button className="px-3 sm:px-4 py-1.5 bg-bluewood-900 text-white text-[11px] font-bold rounded-md shadow-sm">다음 &gt;</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* View 2: Portfolio Preview */}
                <div className={`col-start-1 row-start-1 w-full transition-opacity duration-1000 ${aiMockView === 'portfolio' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                  <div className="bg-surface-50 rounded-2xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-surface-200 h-full flex flex-col text-left">
                    <div className="bg-white border-b border-surface-100 px-4 sm:px-5 py-3 flex items-center justify-between shrink-0 rounded-t-2xl">
                      <div className="flex items-center gap-2 text-[11px] sm:text-[12px] font-bold text-bluewood-500">
                        <ArrowRight size={14} className="rotate-180" /> 경험 목록으로
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="hidden sm:flex items-center gap-1 bg-surface-100 rounded-md px-2 py-1 mr-1 sm:mr-2">
                          <div className="w-4 h-1 rounded-full bg-red-400" />
                          <div className="w-1.5 h-1.5 rounded-full bg-surface-300" />
                          <div className="w-1.5 h-1.5 rounded-full bg-surface-300" />
                          <span className="text-[9px] font-bold text-bluewood-400 ml-1">1/4</span>
                        </div>
                        <button className="px-2 sm:px-3 py-1.5 border border-surface-200 bg-white text-[10px] font-bold text-bluewood-500 rounded-md shadow-sm flex items-center gap-1">
                          <PenTool size={10} /> 수정
                        </button>
                        <button className="px-2 sm:px-3 py-1.5 bg-bluewood-900 text-white text-[10px] font-bold rounded-md shadow-sm flex items-center gap-1">
                          <LayoutTemplate size={10} /> <span className="hidden sm:inline">템플릿 변경</span><span className="sm:hidden">템플릿</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-1 rounded-b-2xl overflow-hidden">
                      <div className="hidden md:block w-[160px] lg:w-[180px] bg-white border-r border-surface-100 p-4 sm:p-5 shrink-0">
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

                      <div className="flex-1 p-4 sm:p-5 bg-surface-50 overflow-auto">
                        <div className="bg-white rounded-xl shadow-sm border border-surface-100 p-4 sm:p-6 mb-4">
                          <p className="text-[10px] font-extrabold text-primary-500 tracking-wider mb-2">BACKGROUND & PROBLEM</p>
                          <h3 className="text-[15px] sm:text-[18px] font-extrabold text-bluewood-900 mb-4 sm:mb-5">기존 CS 프로세스 병목 현상 분석</h3>

                          <div className="flex flex-col gap-4">
                            <div className="flex-1 bg-surface-50 rounded-xl p-4 sm:p-5 border border-surface-100">
                              <p className="text-[11px] font-bold text-bluewood-500 mb-1">단순 반복 문의가 차지하는 비중</p>
                              <p className="text-[28px] sm:text-[32px] font-extrabold text-primary-600 mb-3 leading-none">65.0%</p>
                              <p className="text-[10px] text-bluewood-400 leading-relaxed mb-4">
                                전체 문의의 65%가 배송 조회 등 단순 정보성 문의로 파악되었습니다.
                              </p>
                              <div className="space-y-3">
                                <div>
                                  <div className="flex justify-between text-[9px] font-bold text-bluewood-400 mb-1">
                                    <span>수동 처리 비중 (개선 전)</span><span>100%</span>
                                  </div>
                                  <div className="h-4 w-full bg-surface-200 rounded-md overflow-hidden">
                                    <div className="h-full bg-surface-400 w-full rounded-md" />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-[9px] font-bold text-bluewood-400 mb-1">
                                    <span>수동 처리 비중 (개선 후)</span><span className="text-primary-600">35.0%</span>
                                  </div>
                                  <div className="h-4 w-full bg-surface-200 rounded-md overflow-hidden relative">
                                    <div className="absolute top-0 left-0 h-full bg-bluewood-900 transition-all duration-1000 ease-in-out" style={{ width: aiMockView === 'portfolio' ? '35%' : '0%' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-2">
                          <div className="bg-white border-2 border-primary-200 rounded-lg p-3 min-w-[130px] shadow-sm">
                            <p className="text-[8px] font-bold text-primary-500 uppercase mb-1">Background & Problem</p>
                            <p className="text-[10px] font-bold text-primary-900 truncate">CS 병목 현상 분석</p>
                          </div>
                          <div className="bg-white border border-surface-100 rounded-lg p-3 min-w-[130px] opacity-60">
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
            </ResponsiveScaleWrapper>
          </div>

          {/* 타임라인 관리 */}
          <div className="bg-[#f8f9fc] rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12">
            <ResponsiveScaleWrapper minWidth={900}>
              <div className="flex flex-row flex-nowrap gap-10 items-start w-full">
                <div className="w-[380px] shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded mb-3 sm:mb-4">타임라인 관리</span>
                <h3 className="text-[18px] sm:text-[22px] font-extrabold text-bluewood-900 leading-[1.4] mb-2 sm:mb-3" style={{ wordBreak: 'keep-all' }}>
                  모든 경험을 한눈에,<br />
                  <span className="text-primary-500">타임라인으로 관리</span>해요
                </h3>
                <p className="text-[12px] sm:text-[13px] text-bluewood-400 leading-relaxed mb-4 sm:mb-6">
                  정리된 경험들을 12개월 타임라인에서 한눈에 확인하고,<br />
                  드래그로 순서를 바꾸거나 기간을 수정할 수 있어요.
                </p>
                <div className="space-y-2">
                  {['12개월 Gantt 차트 뷰', '3가지 컬러 테마 선택', '드래그 앤 드롭 정렬'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px] sm:text-[12.5px] text-bluewood-500">
                      <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-indigo-600" />
                      </div>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full mt-0 lg:mt-4 min-w-0">
                <div className="bg-[#f8f9fa] rounded-2xl border border-gray-200 shadow-[0_2px_20px_rgb(0,0,0,0.04)] overflow-hidden p-4 sm:p-5 md:p-7 relative">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 sm:mb-8 gap-3 sm:gap-4">
                    <div>
                      <h4 className="text-[18px] sm:text-[20px] font-extrabold text-[#1B264F] mb-1 tracking-tight">경험 정리</h4>
                      <p className="text-[11px] sm:text-[12px] text-gray-400 font-semibold">6개의 경험이 타임라인에 정리되어 있습니다</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <button className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-lg text-[10px] sm:text-[11px] font-bold text-gray-600 flex items-center gap-1 sm:gap-1.5 shadow-sm">
                        <ArrowDownUp size={11} /> 정렬 <ChevronDown size={11} />
                      </button>
                      <button className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-lg text-[10px] sm:text-[11px] font-bold text-gray-600 flex items-center gap-1 sm:gap-1.5 shadow-sm">
                        <Calendar size={11} /> 타임라인
                      </button>
                      <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1B264F] text-white rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 sm:gap-1.5 shadow-sm">
                        <Plus size={13} /> 새 경험
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-4 sm:mb-6">
                    <div className="flex items-center gap-3">
                      <button className="px-2.5 sm:px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] sm:text-[11px] font-bold text-gray-600 flex items-center gap-1 shadow-sm">
                        2026년 <ChevronDown size={11} />
                      </button>
                      <span className="text-[12px] sm:text-[13px] font-extrabold text-[#1B264F]">경험 타임라인</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                      <div className="bg-white border border-gray-100 rounded-lg px-2 py-1.5 flex gap-1 shadow-sm">
                        <div className="w-4 h-4 bg-[#1B264F] rounded-[3px]"></div>
                        <div className="w-4 h-4 bg-blue-500 rounded-[3px]"></div>
                        <div className="w-4 h-4 bg-blue-300 rounded-[3px]"></div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Area — horizontal scroll on mobile */}
                  <div className="relative border-t border-gray-200 pt-4 pb-6 overflow-x-auto">
                    <div className="min-w-[480px]">
                      <div className="flex mb-5 pl-[2%]">
                        {['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'].map(m => (
                          <div key={m} className="flex-1 text-[10px] sm:text-[11px] text-gray-400 font-bold">{m}</div>
                        ))}
                      </div>
                      <div className="absolute top-[48px] bottom-0 left-0 right-0 flex pointer-events-none">
                        {[...Array(12)].map((_, i) => (
                          <div key={i} className="flex-1 border-l border-gray-200/60" />
                        ))}
                        <div className="border-l border-gray-200/60" />
                      </div>
                      <div className="relative z-10 space-y-3 sm:space-y-4 pr-4 sm:pr-8">
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
                            <div key={i} className="relative h-[34px] sm:h-[38px] w-full">
                              <div
                                className={`absolute top-0 h-full rounded-[7px] sm:rounded-[8px] flex items-center px-3 sm:px-4 shadow-sm ${themeClasses} cursor-default`}
                                style={{ left: `${(bar.start / 12) * 100}%`, width: `${(bar.span / 12) * 100}%` }}
                              >
                                <span className="text-[11px] sm:text-[13px] font-bold tracking-tight truncate">{bar.title}</span>
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
            </ResponsiveScaleWrapper>
          </div>
        </div>
      </section>

      {/* ── FEATURE 2 — 기업 맞춤 포트폴리오 ── */}
      <section id="feature-portfolio" className="py-16 sm:py-20 md:py-24 bg-[#f8f9fc]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 xl:px-16">
          <div className="mb-10 sm:mb-14 md:mb-16">
            <span className="inline-block px-3 py-1 bg-[#1B264F] text-white text-[11px] font-bold rounded-md mb-3 sm:mb-4 tracking-wide">핵심 기능 2. 기업 맞춤 포트폴리오</span>
            <h2 className="text-[24px] sm:text-[32px] md:text-[38px] font-extrabold text-bluewood-900 leading-[1.3] mb-3" style={{ wordBreak: 'keep-all' }}>
              기업을 분석하고,<br />
              <span className="text-[#1B264F]">알맞는 포트폴리오를 자동 생성</span>해요
            </h2>
            <p className="text-[12px] sm:text-[14px] text-bluewood-400 leading-relaxed">
              We analyze job postings and generate tailored portfolios that match company requirements.
            </p>
          </div>

          {/* 채용공고 분석 */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 mb-6 sm:mb-8">
            <ResponsiveScaleWrapper minWidth={900}>
              <div className="flex flex-row flex-nowrap gap-10 items-start w-full">
                <div className="w-[380px] shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-primary-100 text-primary-700 text-[11px] font-bold rounded mb-4 sm:mb-6">채용공고 분석</span>
                <h3 className="text-[24px] sm:text-[30px] font-extrabold text-bluewood-900 leading-[1.3] mb-6 sm:mb-8" style={{ wordBreak: 'keep-all' }}>
                  링크 하나면,<br />
                  <span className="text-primary-600">기업이 원하는 것을<br />알아냅니다</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['기업·직무 자동 분석', '지원 전략 생성'].map((t, i) => (
                    <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-600 text-[12px] font-bold rounded-full border border-primary-100">{t}</span>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full min-w-0">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Search size={14} className="text-bluewood-300" />
                      <p className="text-[12px] sm:text-[13px] font-bold text-bluewood-900">채용공고 분석</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 bg-surface-50 rounded-lg border border-surface-200 overflow-hidden">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-bold rounded shrink-0">자소설</span>
                        <span className="text-[11px] sm:text-[12px] text-bluewood-500 truncate">https://jasoseol.com/posting/291234</span>
                      </div>
                      <div className="px-3 sm:px-4 py-2 bg-[#1B264F] text-white rounded-lg text-[11px] sm:text-[12px] font-bold shrink-0">분석하기</div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-surface-100">
                      <div>
                        <p className="text-[13px] sm:text-[14px] font-bold text-bluewood-900">카카오 · UX 디자이너</p>
                        <p className="text-[10px] sm:text-[11px] text-bluewood-400 mt-0.5">IT/플랫폼 · 경력 1~3년</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {['Figma', 'Prototyping', 'User Research', 'Design System', 'Data Analysis', 'Communication'].map((tag, i) => (
                        <span key={i} className={`px-2 py-1 rounded-md text-[10px] font-semibold ${i < 3 ? 'bg-primary-50 text-primary-600' : 'bg-surface-100 text-bluewood-500'}`}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-surface-50 rounded-lg mb-4 overflow-x-auto">
                      {['기업 분석', '직무 분석', '지원 전략', '산업 트렌드'].map((tab, i) => (
                        <button key={i} className={`flex-1 min-w-fit py-1.5 px-2 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all whitespace-nowrap ${i === 0 ? 'bg-white text-bluewood-900 shadow-sm' : 'text-bluewood-400'}`}>
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
            </ResponsiveScaleWrapper>
          </div>

          {/* 포트폴리오 자동 생성 */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12">
            <ResponsiveScaleWrapper minWidth={1000}>
              <div className="flex flex-row-reverse flex-nowrap gap-10 items-start w-full">
                <div className="w-[380px] shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-primary-100 text-primary-700 text-[11px] font-bold rounded mb-4 sm:mb-6">포트폴리오 에디터</span>
                <h3 className="text-[24px] sm:text-[30px] font-extrabold text-bluewood-900 leading-[1.3] mb-6 sm:mb-8" style={{ wordBreak: 'keep-all' }}>
                  당신의 경험이,<br />
                  <span className="text-primary-600">기업 맞춤으로<br />자동 완성됩니다</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['4가지 템플릿', 'PDF · 공유 링크 출력'].map((t, i) => (
                    <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-600 text-[12px] font-bold rounded-full border border-primary-100">{t}</span>
                  ))}
                </div>
              </div>

              {/* Mock Portfolio Editor */}
              <div className="flex-1 w-full min-w-0">
                <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden p-4 sm:p-6 md:p-8">
                  <div className="mb-4 sm:mb-6">
                    <h4 className="text-[22px] sm:text-[28px] font-extrabold text-bluewood-900 mb-1 tracking-tight">XX기업 포트폴리오</h4>
                    <p className="text-[11px] sm:text-[12px] text-bluewood-400">본 포트폴리오는 PC 환경에 최적화되어 있습니다.</p>
                  </div>

                  <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 border-b border-surface-100">
                    {['교과 활동', '비교과 활동', '기술', '목표와 계획', '가치관'].map((tab, i) => (
                      <span key={i} className="px-3 sm:px-4 py-1.5 bg-surface-50 text-bluewood-600 text-[11px] sm:text-[12px] font-bold rounded-lg shrink-0 cursor-pointer">
                        {tab}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 sm:gap-8">

                    {/* Profile */}
                    <div className="sm:col-span-1 lg:col-span-3 lg:border-r border-surface-100 lg:pr-4">
                      <p className="text-[10px] font-bold text-bluewood-300 tracking-widest mb-3 border-l-2 border-surface-300 pl-2">PROFILE</p>
                      <div className="bg-surface-100 rounded-xl aspect-square max-w-[120px] sm:max-w-none mb-4 flex items-center justify-center">
                        <Users size={36} className="text-bluewood-300" />
                      </div>
                      <h5 className="text-[16px] sm:text-[18px] font-extrabold text-bluewood-900 mb-0.5">김XX</h5>
                      <p className="text-[11px] text-bluewood-400 mb-4">(KIM XX XXX)</p>

                      <div className="space-y-2 mb-4 sm:mb-6">
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

                    {/* Middle */}
                    <div className="sm:col-span-1 lg:col-span-4 space-y-6 sm:space-y-8">
                      <div>
                        <p className="text-[13px] sm:text-[14px] font-extrabold text-bluewood-900 flex items-center gap-2 mb-3 sm:mb-4">
                          Education
                        </p>
                        <p className="text-[12px] sm:text-[13px] font-bold text-bluewood-800 mb-1">XX대학교</p>
                        <p className="text-[11px] text-bluewood-400 mb-1">2021.03 - 2027.03</p>
                        <p className="text-[11px] text-bluewood-500">재학 경영학과</p>
                      </div>

                      <div>
                        <p className="text-[13px] sm:text-[14px] font-extrabold text-bluewood-900 flex items-center gap-2 mb-3 sm:mb-4">
                          Interest
                        </p>
                        <ul className="text-[12px] text-bluewood-600 space-y-2 pl-2">
                          <li className="flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-bluewood-400 before:rounded-full">독서</li>
                          <li className="flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-bluewood-400 before:rounded-full">코딩</li>
                          <li className="flex items-center gap-2 before:content-[''] before:w-1 before:h-1 before:bg-bluewood-400 before:rounded-full">여행</li>
                        </ul>
                      </div>

                      <div>
                        <p className="text-[13px] sm:text-[14px] font-extrabold text-bluewood-900 flex items-center gap-2 mb-3 sm:mb-4">
                          Contact
                        </p>
                        <div className="space-y-2.5 text-[11px] text-bluewood-600">
                          <div className="flex items-center gap-2"><Phone size={12} className="text-bluewood-400 shrink-0" /> 010-XXXX-XXXX</div>
                          <div className="flex items-center gap-2"><Mail size={12} className="text-bluewood-400 shrink-0" /> XXXX@naver.com</div>
                          <div className="flex items-center gap-2 min-w-0"><LinkIcon size={12} className="text-bluewood-400 shrink-0" /><span className="truncate">https://linkedin.com/in</span></div>
                          <div className="flex items-center gap-2 min-w-0"><LinkIcon size={12} className="text-bluewood-400 shrink-0" /><span className="truncate">https://github.com</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="sm:col-span-2 lg:col-span-5 space-y-6 sm:space-y-8 bg-surface-50/50 p-4 sm:p-5 rounded-xl border border-surface-100">
                      <div>
                        <p className="text-[12px] sm:text-[13px] font-extrabold text-bluewood-900 flex items-center gap-2 mb-3 sm:mb-4">
                          Scholarship and Awards
                        </p>
                        <div className="space-y-3">
                          {[
                            { date: '2023.06.02', title: 'XX기업 해커톤 대상' },
                            { date: '2025.05.11', title: 'ESG 캠페인 기획 장려상' },
                            { date: '2026.02.03', title: 'XX 영상 제작 최우수상' },
                          ].map((item, i) => (
                            <div key={i} className="flex gap-2 items-start text-[11px]">
                              <span className="text-primary-500 font-bold shrink-0">{item.date}</span>
                              <span className="text-bluewood-600 font-medium leading-tight">{item.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[12px] sm:text-[13px] font-extrabold text-bluewood-900 flex items-center gap-2 mb-3 sm:mb-4">
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
                            <div key={i} className="flex gap-2 items-start text-[11px]">
                              <span className="text-bluewood-500 font-bold shrink-0 underline decoration-surface-300 underline-offset-2">2026-04</span>
                              <span className="text-bluewood-600 font-medium line-clamp-1">{title}</span>
                            </div>
                          ))}
                          <p className="text-[10px] text-bluewood-400 mt-2 pt-2 border-t border-surface-200">외 2건 — 아래 갤러리에서 확인</p>
                        </div>
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

      {/* ── FAQ ── */}
      <section className="py-20 sm:py-24 md:py-32 bg-[#f8f9fa]">
        <div className="max-w-[900px] mx-auto px-4 sm:px-8 flex flex-col md:flex-row gap-8 sm:gap-12 md:gap-20 lg:gap-32">
          <div className="md:w-[200px] lg:w-[240px] shrink-0 pt-2">
            <p className="text-[11px] tracking-[0.15em] text-gray-400 font-bold mb-3 sm:mb-4">FAQ</p>
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
                    <span className="text-[14px] sm:text-[15px] font-bold text-gray-900 group-hover:text-[#4F46E5] transition-colors pr-4">{faq.q}</span>
                    <span
                      className="text-gray-400 text-[22px] sm:text-[24px] font-light leading-none shrink-0 transition-transform duration-300 inline-block"
                      style={{ transform: openFaqs.includes(i) ? 'rotate(45deg)' : 'none' }}
                    >
                      +
                    </span>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaqs.includes(i) ? 'max-h-40 pb-5 sm:pb-6 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                  >
                    <p className="text-[13px] sm:text-[14px] text-gray-500 leading-relaxed pr-4 sm:pr-8">
                      {faq.a}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="py-20 sm:py-28 md:py-32 bg-white flex flex-col items-center text-center px-4 sm:px-6">


        <h2 className="text-[28px] sm:text-[40px] md:text-[52px] font-extrabold text-gray-900 leading-[1.25] mb-4 sm:mb-6 tracking-[-0.03em]" style={{ wordBreak: 'keep-all' }}>
          지금 예약하면,<br />
          <span className="text-[#4F46E5]">3건 생성</span> 무료 쿠폰을 드려요.
        </h2>
        <p className="text-[13px] sm:text-[15px] text-gray-500 mb-2 sm:mb-3 leading-relaxed font-medium">
          이메일을 등록하시면 정식 출시 알림과 함께<br />
          포트폴리오 <strong className="text-gray-700">3건을 무료로 생성</strong>할 수 있는 쿠폰을 보내드립니다.
        </p>
        <p className="text-[11px] sm:text-[12px] text-gray-400 mb-8 sm:mb-10 font-medium">
          선착순 한정 · 평균 제작 시간 12분
        </p>

        <div className="w-full max-w-[480px] flex flex-col items-center px-0">
          <div className="w-full flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={waitlistEmail}
              onChange={(e) => { setWaitlistEmail(e.target.value); if (waitlistStatus.type !== 'idle') setWaitlistStatus({ type: 'idle', message: '' }); }}
              onKeyDown={(e) => e.key === 'Enter' && handleWaitlistSubmit()}
              placeholder="이메일 주소를 입력해주세요"
              className="flex-1 px-4 sm:px-5 py-3.5 sm:py-4 bg-[#f8f9fa] border border-gray-200 rounded-xl text-[13px] sm:text-[14px] font-medium focus:outline-none focus:border-indigo-300 transition-all placeholder:text-gray-400 disabled:opacity-50"
              disabled={waitlistStatus.type === 'loading' || waitlistStatus.type === 'success'}
            />
            <button
              onClick={handleWaitlistSubmit}
              disabled={waitlistStatus.type === 'loading' || !waitlistEmail || waitlistStatus.type === 'success'}
              className="bg-indigo-600 text-white px-5 sm:px-6 py-3.5 sm:py-4 rounded-xl text-[13px] sm:text-[14px] font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              {waitlistStatus.type === 'loading' ? '등록 중...' : waitlistStatus.type === 'success' ? (
                <><Check size={14} /> 예약 완료</>
              ) : '출시 예약하기'}
            </button>
          </div>
          {waitlistStatus.message && (
            <p className={`mt-3 text-[13px] font-bold ${waitlistStatus.type === 'success' ? 'text-indigo-600' : 'text-red-500'}`}>
              {waitlistStatus.message}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] sm:text-[12px] text-gray-400 font-medium">또는</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button
            onClick={() => navigate('/login')}
            className="mt-4 w-full border-2 border-indigo-600 text-indigo-600 px-6 py-3.5 sm:py-4 rounded-xl text-[13px] sm:text-[14px] font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
          >
            바로 체험해보기
          </button>
          <p className="mt-2 text-[11px] sm:text-[12px] text-gray-400 font-medium">베타 테스터로 지금 바로 이용할 수 있어요</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white pt-10 sm:pt-14 pb-8">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-10 sm:mb-12">
            <div>
              <h4 className="text-[11px] font-bold text-bluewood-300 uppercase tracking-wider mb-3 sm:mb-4">서비스</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-[12px] sm:text-[13px] text-bluewood-500">
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">경험 정리</a></li>
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">포트폴리오</a></li>
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">AI 분석</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-bluewood-300 uppercase tracking-wider mb-3 sm:mb-4">지원</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-[12px] sm:text-[13px] text-bluewood-500">
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">이용 가이드</a></li>
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">자주 묻는 질문</a></li>
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">문의하기</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-bluewood-300 uppercase tracking-wider mb-3 sm:mb-4">법적 고지</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-[12px] sm:text-[13px] text-bluewood-500">
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">이용약관</a></li>
                <li><a href="#" className="hover:text-bluewood-900 transition-colors">개인정보처리방침</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-bluewood-300 uppercase tracking-wider mb-3 sm:mb-4">연락처</h4>
              <ul className="space-y-2 sm:space-y-2.5 text-[12px] sm:text-[13px] text-bluewood-500">
                <li>이메일: gudrbs14@naver.com</li>
                <li>운영시간: 평일 09:00 – 18:00</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-surface-200 pt-5 sm:pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="FitPoly" className="h-5 w-auto opacity-40" />
              <span className="text-[13px] font-bold text-bluewood-300">FitPoly</span>
            </div>
            <p className="text-[11px] text-bluewood-300 text-center sm:text-right">COPYRIGHT © 2025 FitPoly. ALL RIGHTS RESERVED.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
