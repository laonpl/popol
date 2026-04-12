import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ArrowRight, Briefcase, FolderOpen, FileText, PenTool, Brain,
  ChevronLeft, ChevronRight, Phone, MessageSquare,
  Upload, Sparkles, LayoutTemplate
} from 'lucide-react';
import useAuthStore from '../stores/authStore';

export default function Landing() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('experience');
  const [storyIdx, setStoryIdx] = useState(0);

  const go = () => navigate(user ? '/app' : '/login');

  /* ───── Feature cards data ───── */
  const features = [
    { icon: FolderOpen, title: '경험 정리 서비스', desc: 'STAR·5F·PMI 프레임워크로 경험을 체계적으로 아카이빙할 수 있도록 지원합니다.', color: 'bg-red-50 text-red-400' },
    { icon: Brain, title: 'AI 역량 분석', desc: 'AI가 경험을 분석하여 핵심 역량 키워드와 정량적 성과를 자동으로 추출합니다.', color: 'bg-primary-50 text-primary-500' },
    { icon: FileText, title: '포트폴리오 작성', desc: '분석된 경험을 기반으로 기업 맞춤형 포트폴리오를 자동 구성합니다.', color: 'bg-caribbean-50 text-caribbean-600' },
    { icon: PenTool, title: '자기소개서 생성', desc: '경험 DB와 연동하여 문항별 맞춤 자기소개서 초안을 생성합니다.', color: 'bg-amber-50 text-amber-500' },
  ];

  /* ───── Stories data ───── */
  const stories = [
    { major: '컴퓨터공학 전공', name: '김○○ 님', quote: '파편화된 프로젝트 경험을 STAR 프레임워크로 정리하니 면접에서 자신있게 답변할 수 있었습니다. AI 분석이 핵심 역량을 정확히 뽑아줘서 놀랐어요.' },
    { major: '경영학 전공', name: '이○○ 님', quote: '비전공자라 기술 포트폴리오 만들기가 어려웠는데, POPOL 덕분에 업무 경험을 깔끔하게 구조화할 수 있었습니다. 합격까지 도움 받았어요.' },
    { major: '디자인 전공', name: '박○○ 님', quote: '경험 정리부터 포트폴리오 구성까지 한 번에 해결되어 시간을 크게 절약했어요. 체크리스트 기능 덕분에 완성도도 높일 수 있었습니다.' },
  ];

  return (
    <div className="min-h-screen bg-[#e4eaf3]">

      {/* ╔══════════════════════════════════╗
         ║            HEADER                ║
         ╚══════════════════════════════════╝ */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-surface-200/60">
        <div className="max-w-[1140px] mx-auto flex items-center justify-between px-8 h-16">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-10">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary-500 flex items-center justify-center">
                <Briefcase size={14} className="text-white" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-bluewood-900">POPOL</span>
            </button>
            <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-bluewood-500">
              <a href="#features" className="hover:text-bluewood-900 transition-colors">경험정리</a>
              <a href="#process" className="hover:text-bluewood-900 transition-colors">이용방법</a>
              <a href="#services" className="hover:text-bluewood-900 transition-colors">서비스안내</a>
              <a href="#stories" className="hover:text-bluewood-900 transition-colors">고객후기</a>
            </nav>
          </div>
          {/* Right */}
          <div className="flex items-center gap-3">
            <button onClick={go} className="text-[13px] font-medium text-bluewood-500 hover:text-bluewood-900 transition-colors">
              로그인
            </button>
            <button onClick={go} className="px-4 py-2 bg-primary-500 text-white rounded-lg text-[13px] font-semibold hover:bg-primary-600 transition-colors">
              회원가입
            </button>
          </div>
        </div>
      </header>

      {/* ╔══════════════════════════════════╗
         ║             HERO                 ║
         ╚══════════════════════════════════╝ */}
      <section className="bg-white">
        <div className="max-w-[1140px] mx-auto px-8 pt-16 pb-10">
          <p className="text-xs tracking-widest text-bluewood-300 uppercase mb-5 font-semibold">We offer AI-Powered Portfolio</p>

          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-[40px] md:text-[46px] font-extrabold leading-[1.25] text-bluewood-900 mb-8" style={{ wordBreak: 'keep-all' }}>
                AI 기반 경험 정리로 새로운 시작<br />
                취업준비가 더욱 쉽고 간편해집니다.
              </h2>
              <div className="flex items-center gap-5">
                <button onClick={go} className="inline-flex items-center gap-2 text-[14px] font-bold text-bluewood-900 border-b-[2px] border-bluewood-800 pb-1 hover:opacity-60 transition-opacity">
                  무료로 시작하기 <ArrowRight size={15} />
                </button>
                <button onClick={go} className="inline-flex items-center gap-2 text-[14px] font-bold text-bluewood-400 border-b-[2px] border-bluewood-200 pb-1 hover:opacity-60 transition-opacity">
                  서비스 안내 받기 <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {/* Right CTA pills */}
            <div className="hidden lg:flex flex-col gap-2">
              <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-surface-200 rounded-full shadow-sm text-[13px] font-medium text-bluewood-700 hover:border-primary-300 transition-colors">
                <Phone size={15} className="text-primary-500" /> 문의하기
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-full shadow-sm text-[13px] font-medium hover:bg-primary-600 transition-colors">
                <MessageSquare size={15} /> 1:1 상담
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║         FEATURE CARDS            ║
         ╚══════════════════════════════════╝ */}
      <section id="features" className="bg-white pb-20">
        <div className="max-w-[1140px] mx-auto px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <div key={i} className="bg-[#f4f6fb] rounded-2xl p-6 hover:shadow-card-hover transition-all hover:-translate-y-1 cursor-pointer group">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${f.color}`}>
                  <f.icon size={20} />
                </div>
                <h3 className="text-[15px] font-bold text-bluewood-900 mb-2 leading-snug">{f.title}</h3>
                <p className="text-[12.5px] text-bluewood-400 leading-relaxed mb-6">{f.desc}</p>
                <ArrowRight size={15} className="text-bluewood-200 group-hover:text-primary-500 transition-colors" />
              </div>
            ))}
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
            단 몇 분 만에 POPOL을<br />시작해보세요.
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
              { step: 'STEP 01', title: '시작하기', desc: '파일을 업로드하면\nAI가 내용을 자동 분석합니다.', icon: Upload },
              { step: 'STEP 02', title: '분석 및 정리', desc: 'STAR 프레임워크 기반\n경험 구조화 및 역량 추출', icon: Sparkles },
              { step: 'STEP 03', title: '서비스 완성', desc: '분석된 경험으로\n포트폴리오를 자동 구성합니다.', icon: LayoutTemplate },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center relative z-10">
                <div className="w-[62px] h-[62px] rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mb-5 shadow-lg shadow-primary-500/30 ring-4 ring-[#162033]">
                  <s.icon size={24} className="text-white" />
                </div>
                <p className="text-[10px] tracking-[0.18em] text-primary-300 uppercase font-bold mb-1.5">{s.step}</p>
                <h4 className="text-white font-bold text-[15px] mb-1.5">{s.title}</h4>
                <p className="text-[#6b7f99] text-[12px] leading-relaxed whitespace-pre-line max-w-[170px]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║       SERVICE OVERVIEW           ║
         ╚══════════════════════════════════╝ */}
      <section id="services" className="bg-white py-24">
        <div className="max-w-[1140px] mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between gap-14">
            {/* Left content */}
            <div className="md:max-w-[460px]">
              <p className="text-[11px] tracking-[0.15em] text-primary-500 uppercase font-bold mb-4">PARTNER DIVISION</p>
              <h2 className="text-[30px] md:text-[36px] font-extrabold text-bluewood-900 leading-[1.3] mb-7" style={{ wordBreak: 'keep-all' }}>
                POPOL 서비스 유형은<br />
                경험정리와 포트폴리오로<br />구분됩니다.
              </h2>

              {/* Toggle tabs */}
              <div className="inline-flex bg-surface-100 rounded-full p-1 mb-8">
                <button
                  onClick={() => setActiveTab('experience')}
                  className={`px-6 py-2 rounded-full text-[13px] font-semibold transition-all ${activeTab === 'experience' ? 'bg-primary-500 text-white shadow-sm' : 'text-bluewood-400 hover:text-bluewood-700'}`}
                >
                  경험정리
                </button>
                <button
                  onClick={() => setActiveTab('portfolio')}
                  className={`px-6 py-2 rounded-full text-[13px] font-semibold transition-all ${activeTab === 'portfolio' ? 'bg-primary-500 text-white shadow-sm' : 'text-bluewood-400 hover:text-bluewood-700'}`}
                >
                  포트폴리오
                </button>
              </div>

              {activeTab === 'experience' ? (
                <ul className="space-y-3 text-[13.5px] text-bluewood-600 mb-8 leading-relaxed">
                  <li className="flex items-start gap-2.5"><span className="text-primary-500 font-bold mt-px">①</span> HWP·PDF·DOCX 파일 업로드로 간편하게 시작</li>
                  <li className="flex items-start gap-2.5"><span className="text-primary-500 font-bold mt-px">②</span> STAR·5F·PMI 프레임워크 기반 자동 구조화</li>
                  <li className="flex items-start gap-2.5"><span className="text-primary-500 font-bold mt-px">③</span> AI 역량 분석 및 핵심 키워드 자동 추출</li>
                </ul>
              ) : (
                <ul className="space-y-3 text-[13.5px] text-bluewood-600 mb-8 leading-relaxed">
                  <li className="flex items-start gap-2.5"><span className="text-primary-500 font-bold mt-px">①</span> 정리된 경험 기반 포트폴리오 자동 구성</li>
                  <li className="flex items-start gap-2.5"><span className="text-primary-500 font-bold mt-px">②</span> Notion 스타일 에디터로 자유로운 편집</li>
                  <li className="flex items-start gap-2.5"><span className="text-primary-500 font-bold mt-px">③</span> 6단계 체크리스트 통과 후 Export</li>
                </ul>
              )}

              <button onClick={go} className="inline-flex items-center gap-2 text-[13px] font-bold text-bluewood-700 border-b border-bluewood-300 pb-1 hover:text-primary-500 transition-colors">
                자세히보기 <ArrowRight size={14} />
              </button>
            </div>

            {/* Right visual */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-[360px] aspect-[4/3] bg-[#f4f6fb] rounded-2xl flex items-center justify-center">
                <p className="text-bluewood-300 text-sm text-center leading-relaxed px-8">
                  {activeTab === 'experience'
                    ? '파일 업로드 한 번으로 경험이 자동 분석되고\n구조화된 결과를 바로 확인할 수 있습니다.'
                    : '클릭 몇 번으로 포트폴리오가 완성되고\nPDF Export까지 한 번에 가능합니다.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════╗
         ║         SUCCESS STORIES          ║
         ╚══════════════════════════════════╝ */}
      <section id="stories" className="bg-[#f4f6fb] py-24">
        <div className="max-w-[1140px] mx-auto px-8">
          <p className="text-[11px] tracking-[0.15em] text-primary-500 uppercase font-bold mb-4">SUCCESS STORY</p>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-[30px] md:text-[36px] font-extrabold text-bluewood-900 leading-[1.3]" style={{ wordBreak: 'keep-all' }}>
              POPOL 서비스를 도입한<br />
              취준생의 새로운 변화를 만나보세요.
            </h2>
            <div className="hidden md:flex gap-2">
              <button onClick={() => setStoryIdx(Math.max(0, storyIdx - 1))} className="w-10 h-10 rounded-full border border-surface-200 bg-white flex items-center justify-center hover:border-primary-300 transition-colors">
                <ChevronLeft size={17} className="text-bluewood-400" />
              </button>
              <button onClick={() => setStoryIdx(Math.min(stories.length - 1, storyIdx + 1))} className="w-10 h-10 rounded-full border border-surface-200 bg-white flex items-center justify-center hover:border-primary-300 transition-colors">
                <ChevronRight size={17} className="text-bluewood-400" />
              </button>
            </div>
          </div>
          <p className="text-[13px] text-bluewood-400 mb-10 max-w-lg leading-relaxed">
            다양한 전공의 취업 준비생이 POPOL을 활용하여 경험을 체계적으로<br />정리하고 성공적인 취업 준비를 완성했습니다.
          </p>

          {/* Story cards */}
          <div className="grid md:grid-cols-3 gap-5">
            {stories.map((s, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-surface-200/80 hover:shadow-card-hover transition-all">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                    <span className="text-primary-500 font-bold text-[13px]">{s.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-bluewood-300 mb-0.5">{s.major}</p>
                    <p className="text-[13px] font-bold text-bluewood-900">{s.name}</p>
                  </div>
                </div>
                <p className="text-[13px] text-bluewood-500 leading-[1.75]">"{s.quote}"</p>
              </div>
            ))}
          </div>

          {/* Partner logos */}
          <div className="flex items-center justify-center gap-10 md:gap-16 mt-16 flex-wrap">
            <ChevronLeft size={16} className="text-bluewood-200" />
            {['서울대학교', '연세대학교', 'KAIST', '고려대학교', '성균관대학교'].map(n => (
              <span key={n} className="text-[13px] font-bold text-bluewood-200 tracking-wide select-none">{n}</span>
            ))}
            <ChevronRight size={16} className="text-bluewood-200" />
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
                <li>이메일: contact@popol.kr</li>
                <li>운영시간: 평일 09:00 – 18:00</li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-surface-200 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-primary-500 flex items-center justify-center">
                <Briefcase size={10} className="text-white" />
              </div>
              <span className="text-[13px] font-bold text-bluewood-300">POPOL</span>
            </div>
            <p className="text-[11px] text-bluewood-300">COPYRIGHT © 2024 POPOL. ALL RIGHTS RESERVED.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
