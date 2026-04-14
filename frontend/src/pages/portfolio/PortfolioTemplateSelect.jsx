import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, ArrowRight, Building2, BookOpen, Sparkles, User, GraduationCap, MapPin, Calendar, Mail, Phone, Globe, Briefcase, Star, Code, Target, MessageSquare, Award, Eye, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import JobLinkInput, { JobAnalysisBadge } from '../../components/JobLinkInput';
import toast from 'react-hot-toast';

const PORTFOLIO_TEMPLATES = [
  {
    id: 'notion',
    name: 'Notion 이력서/포트폴리오',
    description: '프로필, 학력, 경험, 수상, 기술을 한 눈에 정리하는 3단 레이아웃 포트폴리오. Notion 내보내기 지원.',
    tags: ['이력서', '포트폴리오', 'Notion 내보내기', 'All-in-One'],
    sections: [],
    isNotion: true,
    previewBg: 'bg-white',
  },
  {
    id: 'ashley',
    name: '크리에이티브 포트폴리오',
    description: '마케터/작가/크리에이터를 위한 스크롤형 포트폴리오. 소개, 경력, 프로젝트, 인터뷰, 스킬 등을 한 페이지에 구성.',
    tags: ['크리에이티브', '마케터', '프리랜서', '스크롤형'],
    sections: [],
    isNotion: true,
    previewBg: 'bg-[#f7f6f3]',
  },
  {
    id: 'academic',
    name: '학생 이력서 포트폴리오',
    description: '대학생/취준생을 위한 학술 중심 포트폴리오. 학력, 연구, 활동 이력을 타임라인으로 깔끔하게 정리.',
    tags: ['학생', '취준생', '이력서', '타임라인'],
    sections: [],
    isNotion: true,
    previewBg: 'bg-slate-800',
  },
  {
    id: 'timeline',
    name: '타임라인 대시보드',
    description: '학기별 수업·프로젝트·스터디를 시간순으로 정리하는 Notion 스타일 대시보드. 캘린더와 활동 기록을 한눈에.',
    tags: ['타임라인', '학기별', '대시보드', '캘린더'],
    sections: [],
    isNotion: true,
    previewBg: 'bg-gradient-to-br from-[#1a1a2e] to-[#16213e]',
  },
];

// ── 미리보기 컴포넌트들 ──

function NotionPreview() {
  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden text-[6px] leading-tight p-2">
      <div className="border-b border-gray-100 pb-1 mb-1">
        <div className="h-2 w-24 bg-gray-800 rounded-sm mb-0.5"></div>
        <div className="h-1 w-16 bg-gray-300 rounded-sm"></div>
      </div>
      <div className="flex gap-1">
        <div className="w-[30%] space-y-1">
          <div className="text-[5px] font-bold text-gray-400 border-l border-blue-500 pl-0.5">PROFILE</div>
          <div className="w-full aspect-square bg-emerald-50 rounded"></div>
          <div className="h-1.5 w-8 bg-gray-700 rounded-sm"></div>
          <div className="h-1 w-12 bg-gray-300 rounded-sm"></div>
          <div className="mt-1 text-[4px] text-gray-400 font-bold italic">My Own Values</div>
          <div className="space-y-0.5">
            <div className="h-2 bg-gray-50 rounded border border-gray-100"></div>
            <div className="h-2 bg-gray-50 rounded border border-gray-100"></div>
          </div>
        </div>
        <div className="flex-1 space-y-1 px-0.5">
          <div className="text-[5px] font-bold">🎓 Education</div>
          <div className="h-2 bg-gray-50 rounded"></div>
          <div className="h-2 bg-gray-50 rounded"></div>
          <div className="text-[5px] font-bold mt-1">💡 Interest</div>
          <div className="h-1 w-20 bg-gray-100 rounded-sm"></div>
          <div className="h-1 w-16 bg-gray-100 rounded-sm"></div>
        </div>
        <div className="w-[28%] space-y-1 bg-[#fafaf8] rounded p-0.5">
          <div className="text-[5px] font-bold">🏆 Awards</div>
          <div className="h-1 w-full bg-gray-100 rounded-sm"></div>
          <div className="h-1 w-full bg-gray-100 rounded-sm"></div>
          <div className="text-[5px] font-bold mt-1">🔥 Experience</div>
          <div className="h-1 w-full bg-gray-100 rounded-sm"></div>
          <div className="h-1 w-full bg-gray-100 rounded-sm"></div>
        </div>
      </div>
      <div className="mt-1 pt-1 border-t border-gray-100">
        <div className="grid grid-cols-4 gap-0.5">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-gray-50 rounded aspect-[4/3]">
              <div className="w-full h-2/3 bg-gray-100 rounded-t"></div>
              <div className="p-0.5"><div className="h-1 w-full bg-gray-200 rounded-sm"></div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AshleyPreview() {
  return (
    <div className="w-full h-full bg-[#f7f6f3] rounded-lg overflow-hidden text-[6px] leading-tight p-2">
      {/* 이름 + 프로필 사진 */}
      <div className="flex gap-2 mb-1.5">
        <div className="flex-1">
          <div className="h-3 w-20 bg-gray-800 rounded-sm mb-0.5"></div>
          <div className="h-1 w-32 bg-gray-400 rounded-sm mb-0.5"></div>
          <div className="text-[4px] text-gray-500">hyeyoon.ashley@gmail.com</div>
          <div className="text-[4px] text-gray-400 mt-0.5">brunch / Facebook / Instagram / YouTube</div>
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0"></div>
      </div>
      {/* 한눈에 보기 2-Column */}
      <div className="flex gap-1.5 mb-1.5">
        <div className="flex-1 bg-white rounded p-1 border border-gray-100">
          <div className="text-[5px] font-bold mb-0.5">한눈에 보기</div>
          <div className="space-y-0.5">
            <div className="h-1 bg-gray-100 rounded-sm w-full"></div>
            <div className="h-1 bg-gray-100 rounded-sm w-3/4"></div>
            <div className="h-1 bg-gray-100 rounded-sm w-full"></div>
          </div>
        </div>
        <div className="flex-1 bg-white rounded p-1 border border-gray-100">
          <div className="text-[5px] font-bold mb-0.5">저는 이런 사람이에요</div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-0.5"><div className="w-0.5 h-0.5 bg-blue-400 rounded-full"></div><div className="h-1 bg-gray-100 rounded-sm flex-1"></div></div>
            <div className="flex items-center gap-0.5"><div className="w-0.5 h-0.5 bg-blue-400 rounded-full"></div><div className="h-1 bg-gray-100 rounded-sm flex-1"></div></div>
            <div className="flex items-center gap-0.5"><div className="w-0.5 h-0.5 bg-blue-400 rounded-full"></div><div className="h-1 bg-gray-100 rounded-sm flex-1"></div></div>
          </div>
        </div>
      </div>
      {/* 인터뷰 섹션 */}
      <div className="bg-white rounded p-1 border border-gray-100 mb-1">
        <div className="text-[5px] font-bold mb-0.5">인터뷰</div>
        <div className="flex gap-1">
          <div className="flex-1 h-3 bg-gray-50 rounded"></div>
          <div className="w-6 h-3 bg-gray-200 rounded"></div>
        </div>
      </div>
      {/* 프로젝트 */}
      <div className="text-[5px] font-bold mb-0.5">프로젝트</div>
      <div className="grid grid-cols-3 gap-0.5">
        {[1,2,3].map(i => (<div key={i} className="h-4 bg-white rounded border border-gray-100"></div>))}
      </div>
    </div>
  );
}

function AcademicPreview() {
  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden text-[6px] leading-tight">
      {/* Dark hero banner */}
      <div className="h-12 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-2 flex items-end gap-1.5">
        <div className="w-6 h-6 rounded-md bg-white/20 border border-white/20 flex-shrink-0"></div>
        <div>
          <div className="h-1.5 w-12 bg-white rounded-sm mb-0.5"></div>
          <div className="h-1 w-8 bg-blue-200/50 rounded-sm"></div>
        </div>
      </div>
      <div className="p-2">
        {/* Nav pills */}
        <div className="flex gap-0.5 mb-1.5">
          {['소개','학력','경험','기술'].map(m => (
            <div key={m} className="px-1 py-0.5 bg-gray-50 rounded text-[4px] text-gray-400">{m}</div>
          ))}
        </div>
        {/* Education timeline */}
        <div className="flex items-center gap-1 mb-1">
          <div className="w-0.5 h-6 bg-emerald-200 rounded-full"></div>
          <div className="space-y-1">
            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><div className="h-1 w-16 bg-gray-100 rounded-sm"></div></div>
            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><div className="h-1 w-12 bg-gray-100 rounded-sm"></div></div>
          </div>
        </div>
        {/* Skills bars */}
        <div className="space-y-0.5">
          {[80,60,90].map((w, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="h-1 w-8 bg-gray-200 rounded-sm"></div>
              <div className="h-1 flex-1 bg-gray-100 rounded-sm"><div className={`h-full bg-teal-400 rounded-sm`} style={{width:`${w}%`}}></div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelinePreview() {
  return (
    <div className="w-full h-full bg-[#1a1a2e] rounded-lg overflow-hidden text-[6px] leading-tight p-2">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex-shrink-0"></div>
        <div>
          <div className="h-1.5 w-14 bg-white/80 rounded-sm mb-0.5"></div>
          <div className="h-1 w-10 bg-white/30 rounded-sm"></div>
        </div>
        <div className="ml-auto flex gap-0.5">
          <div className="w-2 h-2 rounded bg-white/10"></div>
          <div className="w-2 h-2 rounded bg-white/10"></div>
        </div>
      </div>
      {/* Calendar mini */}
      <div className="bg-white/5 rounded p-1 mb-1.5 border border-white/10">
        <div className="text-[4px] text-white/50 mb-0.5 text-center">2025년 4월</div>
        <div className="grid grid-cols-7 gap-px">
          {Array.from({length: 14}, (_, i) => (
            <div key={i} className={`h-1.5 rounded-sm ${i === 8 ? 'bg-purple-400/60' : i === 3 || i === 11 ? 'bg-blue-400/40' : 'bg-white/5'}`}></div>
          ))}
        </div>
      </div>
      {/* Semester tabs */}
      <div className="flex gap-0.5 mb-1">
        {['1-1','1-2','2-1'].map((s, i) => (
          <div key={s} className={`px-1 py-0.5 rounded text-[4px] ${i === 2 ? 'bg-purple-500/30 text-purple-200' : 'bg-white/5 text-white/30'}`}>{s}</div>
        ))}
      </div>
      {/* Timeline entries */}
      <div className="space-y-0.5 relative">
        <div className="absolute left-[2px] top-0 bottom-0 w-px bg-purple-400/30"></div>
        {[1,2,3].map(i => (
          <div key={i} className="flex items-start gap-1 pl-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 mt-0.5 relative z-10"></div>
            <div className="flex-1">
              <div className="h-1 w-12 bg-white/20 rounded-sm mb-0.5"></div>
              <div className="h-0.5 w-8 bg-white/10 rounded-sm"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 모달용 확대 미리보기 컴포넌트들 ──

function NotionFullPreview() {
  return (
    <div className="bg-white p-8 text-sm leading-relaxed">
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">홍길동 포트폴리오</h1>
        <p className="text-gray-500 text-sm">세상과 소통하는 개발자</p>
      </div>
      <div className="flex gap-6">
        <div className="w-[30%] space-y-4">
          <div>
            <div className="text-xs font-bold text-gray-400 border-l-2 border-blue-500 pl-2 mb-2">PROFILE</div>
            <div className="w-full aspect-square bg-emerald-50 rounded-lg flex items-center justify-center text-4xl">👤</div>
            <p className="font-bold mt-2">홍길동</p>
            <p className="text-xs text-gray-500">Gil-dong Hong</p>
            <p className="text-xs text-gray-400 mt-1">서울특별시 · 2000.01.01</p>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 italic mb-2">My Own Values</div>
            <div className="space-y-2">
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs font-bold text-gray-700">성장 마인드셋</p>
                <p className="text-xs text-gray-500">끊임없이 배우고 성장합니다</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs font-bold text-gray-700">팀워크</p>
                <p className="text-xs text-gray-500">협업으로 더 큰 가치를 만듭니다</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-5">
          <div>
            <h3 className="font-bold text-base mb-2">🎓 Education</h3>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium">가천대학교 · 컴퓨터공학과</p>
              <p className="text-xs text-gray-500">학사 재학 · 2020.03 - 현재</p>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-base mb-2">💡 Interest</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs">웹 개발</span>
              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs">UI/UX 디자인</span>
              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs">인공지능</span>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-base mb-2">🏆 Awards</h3>
            <div className="space-y-1">
              <div className="flex items-center gap-3 text-xs"><span className="text-gray-400">2025.06</span><span>해커톤 최우수상</span></div>
              <div className="flex items-center gap-3 text-xs"><span className="text-gray-400">2024.12</span><span>프로그래밍 경진대회 장려상</span></div>
            </div>
          </div>
        </div>
        <div className="w-[28%] bg-[#fafaf8] rounded-lg p-3 space-y-4">
          <div>
            <h3 className="font-bold text-xs mb-2">🔥 Experience</h3>
            <div className="space-y-1.5">
              <div className="p-2 bg-white rounded border border-gray-100 text-xs">
                <p className="font-medium">스마트 포트폴리오 플랫폼</p>
                <p className="text-gray-400 text-[10px]">2025.03 ~ 진행중</p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-xs mb-2">🛠 Skills</h3>
            <div className="flex flex-wrap gap-1">
              <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px]">React</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px]">Node.js</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px]">Python</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px]">Figma</span>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-xs mb-2">📞 Contact</h3>
            <div className="space-y-1 text-[10px] text-gray-600">
              <p>010-0000-0000</p>
              <p>example@email.com</p>
              <p>github.com/username</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-gray-100">
        <h3 className="font-bold text-base mb-3">📋 프로젝트 갤러리</h3>
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
              <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center text-2xl">{['💻','📱','🎨','📊'][i-1]}</div>
              <div className="p-2">
                <p className="text-xs font-medium text-gray-700">프로젝트 {i}</p>
                <p className="text-[10px] text-gray-400">2025.0{i}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AshleyFullPreview() {
  return (
    <div className="bg-[#f7f5f0] rounded-xl border border-[#e8e4dc] text-sm leading-relaxed overflow-hidden">
      {/* Hero */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-[#2d2a26] mb-1 tracking-tight">홍길동</h1>
            <p className="text-[#8a8578] text-xs mb-2">Gil-dong Hong</p>
            <p className="text-[#5a564e] text-sm">크리에이티브 마케터 · 콘텐츠 크리에이터</p>
            <div className="flex items-center gap-3 mt-3 text-xs text-[#8a8578]">
              <span>example@gmail.com</span><span>Instagram</span><span>GitHub</span>
            </div>
          </div>
          <div className="w-20 h-20 rounded-2xl bg-[#e8e4dc] flex items-center justify-center text-3xl shadow-md">👤</div>
        </div>
      </div>
      {/* 한눈에 보기 + 저는 이런 사람이에요 */}
      <div className="px-8 pb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border border-[#e8e4dc]">
            <h3 className="font-bold text-sm text-[#2d2a26] mb-3 flex items-center gap-2">📋 한눈에 보기</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[#8a8578]">위치</span><span className="font-medium text-[#2d2a26]">서울특별시</span></div>
              <div className="flex justify-between"><span className="text-[#8a8578]">생년월일</span><span className="font-medium text-[#2d2a26]">2000.01.01</span></div>
              <div className="flex justify-between"><span className="text-[#8a8578]">학교</span><span className="font-medium text-[#2d2a26]">가천대학교</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-[#e8e4dc]">
            <h3 className="font-bold text-sm text-[#2d2a26] mb-3 flex items-center gap-2">✨ 저는 이런 사람이에요</h3>
            <ul className="space-y-2 text-xs text-[#5a564e]">
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 bg-[#c4a882] rounded-full mt-1 flex-shrink-0" />데이터 기반 스토리텔링을 좋아합니다</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 bg-[#c4a882] rounded-full mt-1 flex-shrink-0" />새로운 트렌드를 빠르게 캐치합니다</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 bg-[#c4a882] rounded-full mt-1 flex-shrink-0" />팀 협업에서 시너지를 만듭니다</li>
            </ul>
          </div>
        </div>
      </div>
      {/* 인터뷰 */}
      <div className="px-8 pb-6">
        <div className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
          <h3 className="font-bold text-base text-[#2d2a26] mb-4">💬 인터뷰</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="font-medium text-[#2d2a26] text-xs mb-1">Q. 가장 보람찼던 프로젝트는?</p>
                <p className="text-xs text-[#8a8578] leading-relaxed">SNS 마케팅 캠페인으로 팔로워 300% 성장을 달성했던 경험입니다.</p>
              </div>
              <div className="w-16 h-16 bg-[#f0ece4] rounded-lg flex items-center justify-center text-xl">📷</div>
            </div>
            <div>
              <p className="font-medium text-[#2d2a26] text-xs mb-1">Q. 앞으로의 목표는?</p>
              <p className="text-xs text-[#8a8578] leading-relaxed">브랜드 전략 전문가로 성장하는 것입니다.</p>
            </div>
          </div>
        </div>
      </div>
      {/* 프로젝트 갤러리 */}
      <div className="px-8 pb-6">
        <h3 className="font-bold text-base text-[#2d2a26] mb-3">🎨 프로젝트</h3>
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-[#e8e4dc] overflow-hidden">
              <div className="aspect-[4/3] bg-[#f0ece4] flex items-center justify-center text-2xl">{['🎯','📈','🎬'][i-1]}</div>
              <div className="p-3">
                <p className="text-xs font-bold text-[#2d2a26] mb-0.5">캠페인 {i}</p>
                <p className="text-[10px] text-[#8a8578]">마케팅 프로젝트 설명</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Skills */}
      <div className="px-8 pb-6">
        <h3 className="font-bold text-base text-[#2d2a26] mb-3">💼 이런 일을 할 수 있어요</h3>
        <div className="flex flex-wrap gap-2">
          {['React', 'Node.js', 'Figma', 'Python', 'Photoshop'].map(s => (
            <span key={s} className="px-3 py-1.5 bg-white rounded-full text-xs text-[#5a564e] font-medium border border-[#e8e4dc]">{s}</span>
          ))}
        </div>
      </div>
      <div className="px-8 py-4 border-t border-[#e8e4dc] flex items-center justify-between text-[10px] text-[#8a8578]">
        <span>POPOL Portfolio · 홍길동</span><span>맨 위로 ↑</span>
      </div>
    </div>
  );
}

function AcademicFullPreview() {
  return (
    <div className="text-sm leading-relaxed">
      {/* Dark gradient hero */}
      <div className="relative rounded-t-xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 20% 50%, #60a5fa 0%, transparent 50%), radial-gradient(circle at 80% 50%, #818cf8 0%, transparent 50%)'}} />
        <div className="relative px-8 pt-10 pb-8 flex items-end gap-5">
          <div className="w-20 h-20 rounded-xl bg-white/10 border-4 border-white/20 flex items-center justify-center text-4xl">👤</div>
          <div className="flex-1 pb-1">
            <h1 className="text-2xl font-bold text-white mb-1">홍길동</h1>
            <p className="text-blue-200 text-xs">Hong Gil-dong</p>
            <p className="text-blue-300/70 text-xs mt-1">성장하는 개발자</p>
          </div>
          <div className="pb-1 text-right">
            <p className="text-blue-200/60 text-xs">서울특별시</p>
            <p className="text-blue-200/60 text-xs mt-0.5">2000.01.01</p>
          </div>
        </div>
        <div className="flex gap-2 px-8 pb-4">
          {['소개','학력','경험','기술','수상','교과','비교과','목표'].map(m => (
            <span key={m} className="px-2.5 py-1 bg-white/10 rounded-lg text-xs text-white/80 font-medium">{m}</span>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-b-xl border border-t-0 border-gray-200">
        {/* About */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full inline-block" /> 자기소개
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <p className="text-xs font-bold text-blue-900 mb-1">성장 마인드셋</p>
              <p className="text-[10px] text-blue-700/70">끊임없이 배우고 성장합니다</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <p className="text-xs font-bold text-blue-900 mb-1">팀워크</p>
              <p className="text-[10px] text-blue-700/70">협업으로 더 큰 가치를 만듭니다</p>
            </div>
          </div>
        </div>
        {/* Education + Awards */}
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-emerald-500 rounded-full inline-block" /> 학력
              </h2>
              <div className="space-y-3 relative">
                <div className="absolute left-[5px] top-1 bottom-1 w-0.5 bg-emerald-100" />
                <div className="flex items-start gap-2.5 relative">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white z-10 mt-0.5 flex-shrink-0" />
                  <div><p className="text-xs font-medium">가천대학교 · 컴퓨터공학과</p><p className="text-[10px] text-gray-400">학사 재학 · 2020.03 - 현재</p></div>
                </div>
                <div className="flex items-start gap-2.5 relative">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white z-10 mt-0.5 flex-shrink-0" />
                  <div><p className="text-xs font-medium">OO고등학교</p><p className="text-[10px] text-gray-400">졸업 · 2017.03 - 2020.02</p></div>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-amber-500 rounded-full inline-block" /> 수상
              </h2>
              <div className="space-y-2">
                <div className="flex items-start gap-2"><span className="text-sm">🏆</span><div><p className="text-xs font-medium">해커톤 최우수상</p><p className="text-[10px] text-gray-400">2025.06</p></div></div>
                <div className="flex items-start gap-2"><span className="text-sm">🏆</span><div><p className="text-xs font-medium">프로그래밍 경진대회 장려상</p><p className="text-[10px] text-gray-400">2024.12</p></div></div>
              </div>
            </div>
          </div>
        </div>
        {/* Skills */}
        <div className="px-8 py-6">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-teal-500 rounded-full inline-block" /> 기술
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl">
              <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase">도구</h4>
              <div className="space-y-1.5">
                {[['React', 4], ['Node.js', 3], ['Figma', 5]].map(([name, lvl]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-xs text-gray-700">{name}</span>
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(l => <div key={l} className={`w-3 h-1 rounded-full ${l <= lvl ? 'bg-teal-500' : 'bg-gray-200'}`} />)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase">언어</h4>
              <div className="space-y-1.5">
                {[['Python', 5], ['JavaScript', 4]].map(([name, lvl]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-xs text-gray-700">{name}</span>
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(l => <div key={l} className={`w-3 h-1 rounded-full ${l <= lvl ? 'bg-teal-500' : 'bg-gray-200'}`} />)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="px-8 py-3 bg-gray-50 flex items-center justify-between text-[10px] text-gray-400 rounded-b-xl">
          <span>POPOL Portfolio · 홍길동</span><span>맨 위로 ↑</span>
        </div>
      </div>
    </div>
  );
}

function TimelineFullPreview() {
  const semesters = [
    { id: '1-1', label: '1학년 1학기', period: '2023.03 – 2023.06', courses: ['컴퓨터개론', '미적분학', '프로그래밍기초'] },
    { id: '1-2', label: '1학년 2학기', period: '2023.09 – 2023.12', courses: ['자료구조', '선형대수', '웹프로그래밍'] },
    { id: '2-1', label: '2학년 1학기', period: '2024.03 – 2024.06', courses: ['알고리즘', '컴퓨터네트워크', '데이터베이스'] },
  ];
  const activities = [
    { date: '2024.06', title: '해커톤 최우수상', category: 'award', color: 'bg-amber-400' },
    { date: '2024.03', title: 'Whois 보안 교육', category: 'study', color: 'bg-purple-400' },
    { date: '2023.09', title: '웹 포트폴리오 프로젝트', category: 'project', color: 'bg-blue-400' },
  ];
  const days = ['일','월','화','수','목','금','토'];
  return (
    <div className="text-sm leading-relaxed">
      {/* Dark header */}
      <div className="rounded-t-xl bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-8 pt-8 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-3xl shadow-lg">👤</div>
          <div>
            <h1 className="text-2xl font-bold text-white">홍길동's 대시보드</h1>
            <p className="text-blue-200/70 text-xs mt-0.5">가천대학교 · 컴퓨터공학과</p>
          </div>
          <div className="ml-auto flex gap-2">
            <span className="px-3 py-1 bg-white/10 rounded-lg text-xs text-white/70">GitHub</span>
            <span className="px-3 py-1 bg-white/10 rounded-lg text-xs text-white/70">Instagram</span>
          </div>
        </div>
        {/* Mini calendar */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-xs text-white/50 mb-2 text-center font-medium">2025년 4월</p>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map(d => <div key={d} className="text-[10px] text-white/30 font-medium">{d}</div>)}
            {Array.from({length: 30}, (_, i) => (
              <div key={i} className={`text-[10px] py-1 rounded ${i === 14 ? 'bg-purple-500 text-white font-bold' : i === 7 || i === 22 ? 'bg-blue-500/30 text-blue-200' : 'text-white/40'}`}>{i+1}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Content body */}
      <div className="bg-white rounded-b-xl border border-t-0 border-gray-200">
        {/* Semester tabs */}
        <div className="px-8 py-4 border-b border-gray-100 flex gap-2 overflow-x-auto">
          {semesters.map((s, i) => (
            <span key={s.id} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${i === 2 ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>{s.label}</span>
          ))}
        </div>

        {/* Semester courses */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-purple-500 rounded-full inline-block" /> 학기별 수업
          </h2>
          <div className="space-y-4">
            {semesters.map(s => (
              <div key={s.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-700">{s.label}</span>
                  <span className="text-[10px] text-gray-400">{s.period}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.courses.map(c => (
                    <span key={c} className="px-2.5 py-1 bg-white rounded-lg text-xs text-gray-600 border border-gray-200">{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity timeline */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full inline-block" /> 활동 기록
          </h2>
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
            <div className="space-y-4">
              {activities.map((a, i) => (
                <div key={i} className="flex items-start gap-3 relative">
                  <div className={`w-4 h-4 rounded-full ${a.color} border-2 border-white z-10 mt-0.5 flex-shrink-0`} />
                  <div>
                    <p className="text-xs font-medium text-gray-800">{a.title}</p>
                    <p className="text-[10px] text-gray-400">{a.date}</p>
                  </div>
                  <span className="ml-auto px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">{a.category}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Study plans */}
        <div className="px-8 py-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-emerald-500 rounded-full inline-block" /> 스터디 계획
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-xs font-bold text-emerald-800 mb-1">2025년 3~6월</p>
              <p className="text-[10px] text-emerald-600">알고리즘 문제풀이, 네트워크 보안 스터디</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-xs font-bold text-emerald-800 mb-1">2025년 7~8월</p>
              <p className="text-[10px] text-emerald-600">인턴십 준비, 포트폴리오 완성</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-3 bg-gray-50 flex items-center justify-between text-[10px] text-gray-400 rounded-b-xl">
          <span>POPOL Dashboard · 홍길동</span><span>맨 위로 ↑</span>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioTemplateSelect() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { createPortfolio } = usePortfolioStore();
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState('template');
  const [jobAnalysis, setJobAnalysis] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const previewComponents = {
    notion: NotionPreview,
    ashley: AshleyPreview,
    academic: AcademicPreview,
    timeline: TimelinePreview,
  };

  const handleNext = () => {
    if (!selected) { toast.error('템플릿을 선택해주세요'); return; }
    setStep('joblink');
  };

  const handleCreate = async (analysis) => {
    const finalAnalysis = analysis || jobAnalysis;
    const template = PORTFOLIO_TEMPLATES.find(t => t.id === selected);
    if (!template) return;

    setCreating(true);
    try {
      const data = {
        title: template.name,
        userName: profile?.nameKo || user.displayName || '',
        sections: [],
        templateId: template.id,
        templateType: template.id,
        headline: '',
        education: [],
        awards: [],
        experiences: [],
        contact: {
          phone: profile?.phone || '',
          email: profile?.email || user.email || '',
          linkedin: '',
          instagram: '',
          github: '',
          website: '',
        },
        skills: {
          tools: profile?.tools || [],
          languages: profile?.programmingLanguages || [],
          frameworks: profile?.frameworks || [],
          others: [],
        },
        goals: [],
        values: [],
        interests: [],
        curricular: { summary: { credits: '', gpa: '' }, courses: [], creditStatus: [] },
        extracurricular: {
          summary: '',
          badges: [],
          languages: (profile?.languageScores || []).map(l => ({
            name: l.name,
            score: l.score,
            date: l.date,
          })),
          details: [],
        },
        valuesEssay: '',
        // 프로필에서 자동 매칭
        nameEn: profile?.nameEn || '',
        location: profile?.location || '',
        birthDate: profile?.birthDate || '',
      };

      // 학력 자동 매칭
      if (profile?.education?.length > 0) {
        data.education = profile.education.map(e => ({
          name: e.school,
          nameEn: '',
          period: e.period,
          degree: `${e.degree || ''} ${e.major || ''}`.trim(),
          detail: '',
        }));
      }

      if (finalAnalysis) {
        data.targetCompany = finalAnalysis.company || '';
        data.targetPosition = finalAnalysis.position || '';
        data.jobAnalysis = finalAnalysis;
      }

      const id = await createPortfolio(user.uid, data);
      navigate(`/app/portfolio/edit-notion/${id}?mode=form`);
      toast.success('포트폴리오가 생성되었습니다!');
    } catch (error) {
      toast.error('포트폴리오 생성에 실패했습니다');
    }
    setCreating(false);
  };

  return (
    <div className="animate-fadeIn max-w-[1240px] mx-auto">
      <Link to="/app/portfolio" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={16} /> 포트폴리오 목록으로
      </Link>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-3 mb-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${step === 'template' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center">1</span>
          템플릿 선택
        </div>
        <ArrowRight size={14} className="text-gray-300" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${step === 'joblink' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'}`}>
          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${step === 'joblink' ? 'bg-primary-500 text-white' : 'bg-gray-300 text-white'}`}>2</span>
          기업 공고 연결 (선택)
        </div>
      </div>

      {step === 'template' && (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">포트폴리오 템플릿 선택</h1>
            <p className="text-gray-500 text-sm">
              원하는 디자인을 미리보기로 확인 후 선택하세요. 프로필 정보가 자동으로 채워집니다.
            </p>
          </div>

          {/* Template Cards with Preview */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {PORTFOLIO_TEMPLATES.map(template => {
              const isSelected = selected === template.id;
              const Preview = previewComponents[template.id];
              return (
                <div
                  key={template.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(template.id)}
                  onKeyDown={e => e.key === 'Enter' && setSelected(template.id)}
                  className={`text-left rounded-2xl border-2 overflow-hidden transition-all hover:shadow-xl cursor-pointer ${
                    isSelected
                      ? 'border-primary-500 shadow-lg ring-2 ring-primary-200'
                      : 'border-surface-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {/* Preview Area */}
                  <div className={`h-48 ${template.previewBg} p-2 relative`}>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center z-10">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                    <Preview />
                  </div>
                  {/* Info */}
                  <div className="p-5 bg-white">
                    <h3 className="font-bold text-base mb-1">{template.name}</h3>
                    <p className="text-xs text-gray-400 mb-3 leading-relaxed">{template.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1.5">
                        {template.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary-50 text-primary-600 border border-primary-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPreviewTemplate(template.id); }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 border border-surface-200 rounded-lg hover:bg-surface-50 hover:text-primary-600 transition-colors"
                      >
                        <Eye size={12} /> 미리보기
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Next Button */}
          <div className="sticky bottom-6">
            <button
              onClick={handleNext}
              disabled={!selected}
              className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowRight size={18} /> {selected ? '다음: 기업 공고 연결' : '템플릿을 선택해주세요'}
            </button>
          </div>
        </>
      )}

      {step === 'joblink' && (
        <>
          <div className="mb-6">
            <button onClick={() => setStep('template')} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
              <ArrowLeft size={14} /> 템플릿 다시 선택
            </button>
            <h1 className="text-2xl font-bold mb-2">기업 공고 연결</h1>
            <p className="text-gray-500 text-sm">
              지원할 기업의 채용공고 링크를 넣으면 기업 맞춤형 포트폴리오가 생성됩니다 (선택사항)
            </p>
          </div>

          {jobAnalysis ? (
            <div className="space-y-4">
              <JobAnalysisBadge analysis={jobAnalysis} onRemove={() => setJobAnalysis(null)} />
              <button
                onClick={() => handleCreate(jobAnalysis)}
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {creating ? (
                  <><Loader2 size={18} className="animate-spin" /> 생성 중...</>
                ) : (
                  <><Building2 size={18} /> {jobAnalysis.company} 맞춤 포트폴리오 만들기</>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <JobLinkInput
                onAnalysisComplete={(analysis) => setJobAnalysis(analysis)}
                onSkip={() => handleCreate(null)}
              />
            </div>
          )}
        </>
      )}

      {/* Template Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPreviewTemplate(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
              <div>
                <h3 className="font-bold text-lg">{PORTFOLIO_TEMPLATES.find(t => t.id === previewTemplate)?.name} 미리보기</h3>
                <p className="text-xs text-gray-400 mt-0.5">실제 포트폴리오 레이아웃 예시입니다</p>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="p-2 hover:bg-surface-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
              <div className="border border-surface-200 rounded-xl overflow-hidden" style={{ minHeight: '500px' }}>
                {previewTemplate === 'notion' && <NotionFullPreview />}
                {previewTemplate === 'ashley' && <AshleyFullPreview />}
                {previewTemplate === 'academic' && <AcademicFullPreview />}
                {previewTemplate === 'timeline' && <TimelineFullPreview />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { PORTFOLIO_TEMPLATES };
