import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VisualPortfolioRenderer from './VisualPortfolioTemplates';
import { ArrowLeft, Loader2, Check, ArrowRight, Building2, BookOpen, Sparkles, User, GraduationCap, MapPin, Calendar, Mail, Phone, Globe, Briefcase, Star, Code, Target, MessageSquare, Award, Eye, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import JobLinkInput, { JobAnalysisBadge } from '../../components/JobLinkInput';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TEMPLATE_CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'common', label: '전 직군 공통' },
  { id: 'developer', label: '개발자' },
  { id: 'pm', label: '기획/PM' },
  { id: 'designer', label: '디자이너' },
  { id: 'marketer', label: '마케터' },
  { id: 'startup', label: '스타트업' },
  { id: 'researcher', label: '리서처' },
  { id: 'backend', label: '백엔드' },
];

const PORTFOLIO_TEMPLATES = [
  {
    id: 'notion',
    name: '템플릿 1',
    description: '프로필, 학력, 경험, 수상, 기술을 한 눈에 정리하는 3단 레이아웃 포트폴리오. Notion 내보내기 지원.',
    tags: ['이력서', '포트폴리오', 'Notion 내보내기', 'All-in-One'],
    category: 'common',
    sections: [],
    isNotion: true,
    previewBg: 'bg-white',
  },
  {
    id: 'academic',
    name: '템플릿 2',
    description: '대학생/취준생을 위한 학술 중심 포트폴리오. 학력, 연구, 활동 이력을 타임라인으로 깔끔하게 정리.',
    tags: ['학생', '취준생', '이력서', '타임라인'],
    category: 'common',
    sections: [],
    isNotion: true,
    previewBg: 'bg-slate-800',
  },
  {
    id: 'visual-1',
    name: '템플릿 3 (기본 노션형)',
    description: '커버 이미지와 아바타가 인상적인 기본 노션 스타일. 경험·프로젝트를 카드로 깔끔하게 표현.',
    tags: ['심플', '화이트', '카드형'],
    category: 'common',
    isNotion: true,
    previewBg: 'bg-white',
  },
  {
    id: 'visual-2',
    name: '템플릿 4 (베이지 톤)',
    description: '따뜻한 베이지 색감의 고급스러운 포트폴리오. 세리프 폰트와 흑백 레이아웃으로 차분한 인상.',
    tags: ['베이지', '고급', '세리프'],
    category: 'designer',
    isNotion: true,
    previewBg: 'bg-[#f3f2eb]',
  },
  {
    id: 'visual-3',
    name: '템플릿 5 (DB 구조화)',
    description: '노션 데이터베이스처럼 구조화된 레이아웃. 핑크·퍼플 그라디언트 포인트로 생동감 있는 디자인.',
    tags: ['구조화', '컬러풀', '정보형'],
    category: 'pm',
    isNotion: true,
    previewBg: 'bg-white',
  },
  {
    id: 'visual-4',
    name: '템플릿 6 (문제해결형)',
    description: '실무 역량과 문제 해결 과정을 강조하는 취업형 포트폴리오. 타임라인 기반 경험 서술.',
    tags: ['취업', '실무형', '3단 레이아웃'],
    category: 'pm',
    isNotion: true,
    previewBg: 'bg-[#fcfcfc]',
  },
  {
    id: 'visual-5',
    name: '템플릿 7 (프로필 링크형)',
    description: 'Link-in-bio 스타일의 모바일 친화적 포트폴리오. 프로필과 프로젝트 카드를 세로로 배치.',
    tags: ['모바일', '링크형', '프로필'],
    category: 'common',
    isNotion: true,
    previewBg: 'bg-[#F7F6F3]',
  },
  {
    id: 'visual-6',
    name: '템플릿 8 (비주얼 갤러리)',
    description: '프로젝트 이미지를 갤러리 형태로 크게 보여주는 비주얼 중심 포트폴리오.',
    tags: ['갤러리', '비주얼', '디자이너'],
    category: 'designer',
    isNotion: true,
    previewBg: 'bg-white',
  },
  {
    id: 'visual-7',
    name: '템플릿 9 (다크 모드)',
    description: '우주/성운 느낌의 다크 배경에 파란 포인트 컬러. 세련된 분위기의 다크 포트폴리오.',
    tags: ['다크', '세련됨', '개발자'],
    category: 'developer',
    isNotion: true,
    previewBg: 'bg-[#1F1F1F]',
  },
  {
    id: 'visual-8',
    name: '템플릿 10 (개발자 다크)',
    description: '체크박스 스킬 레벨과 갤러리 뷰 프로젝트 목록. 개발자에게 최적화된 다크 테마.',
    tags: ['개발자', '다크', '스킬형'],
    category: 'developer',
    isNotion: true,
    previewBg: 'bg-[#191919]',
  },
  // ── popoldesign.md 기반 전략형 테마 ──
  {
    id: 'theme-lean-dev',
    name: 'Lean Hypothesis Dev',
    description: '가설 검증과 린 스타트업 방법론에 최적화된 엔지니어 테마. 성과 지표와 피벗 과정을 투명하게 공개.',
    tags: ['개발자', '스타트업', '다크', '린 방법론'],
    category: 'developer',
    templateType: 'notion',
    isNotion: true,
    previewBg: 'bg-black',
  },
  {
    id: 'theme-notion-pm',
    name: 'Structured Notion PM',
    description: '문서화와 구조화에 강점을 가진 기획자/PM용 테마. 토글 UI로 리서치와 트레이드오프 결정 로그를 논리적으로 전개.',
    tags: ['PM', '기획자', '문서화', 'STAR+Trade-off'],
    category: 'pm',
    templateType: 'notion',
    isNotion: true,
    previewBg: 'bg-white',
  },
  {
    id: 'theme-double-diamond',
    name: 'Double Diamond Creative',
    description: '더블 다이아몬드 4단계를 레이아웃에 매핑한 디자이너 테마. 문제 정의부터 최종 UI까지 과정을 설득력 있게 전달.',
    tags: ['디자이너', '더블 다이아몬드', '케이스 스터디', 'Figma'],
    category: 'designer',
    templateType: 'notion',
    isNotion: true,
    previewBg: 'bg-[#FDFDFD]',
  },
  {
    id: 'theme-bento-metric',
    name: 'Bento Metric Strategist',
    description: 'AARRR 퍼널별 핵심 지표를 벤토 그리드 카드로 분리한 그로스 해커/퍼포먼스 마케터 테마.',
    tags: ['마케터', 'AARRR', '그로스 해킹', 'KPI 대시보드'],
    category: 'marketer',
    templateType: 'notion',
    isNotion: true,
    previewBg: 'bg-[#F8FAFC]',
  },
  {
    id: 'theme-startup-hustler',
    name: 'Startup Hustler',
    description: '0→1을 만드는 창업가용 테마. MVP 개발 속도와 초기 시장 반응을 강렬하게 증명하는 레이아웃.',
    tags: ['스타트업', 'MVP', '창업가', '풀스택'],
    category: 'startup',
    templateType: 'notion',
    isNotion: true,
    previewBg: 'bg-[#E2E8F0]',
  },
  {
    id: 'theme-research-archival',
    name: 'Research Archival',
    description: 'UX 리서처·아카데믹 인재를 위한 연구 논문형 테마. 정성 데이터가 프로덕트 임팩트로 이어지는 과정을 신뢰감 있게 전달.',
    tags: ['UX 리서치', '연구', '세리프', '정성 데이터'],
    category: 'researcher',
    templateType: 'academic',
    isNotion: true,
    previewBg: 'bg-[#F7F5F0]',
  },
  {
    id: 'theme-cyberpunk',
    name: 'Data Flow Cyberpunk',
    description: '백엔드·인프라 아키텍트용 시스템 테마. 아키텍처 다이어그램과 기술 스택 매트릭스로 시스템 확장성을 증명.',
    tags: ['백엔드', '인프라', '다크', '아키텍처 다이어그램'],
    category: 'backend',
    templateType: 'notion',
    isNotion: true,
    previewBg: 'bg-[#030712]',
  },
  {
    id: 'theme-ats-classic',
    name: 'ATS-Optimized Classic',
    description: '대기업 ATS 파싱과 F-Pattern 스캐닝에 최적화된 클래식 테마. 직무 키워드와 성과 지표만 깔끔하게 배치.',
    tags: ['대기업', 'ATS 최적화', '클래식', '이력서형'],
    category: 'common',
    templateType: 'notion',
    isNotion: true,
    previewBg: 'bg-white',
  },
  {
    id: 'theme-component-creator',
    name: 'Component-Driven Creator',
    description: '프론트엔드·인터랙션 디자이너용 쇼케이스 테마. 컴포넌트를 Storybook처럼 전시하며 코드 품질과 인터랙션을 증명.',
    tags: ['프론트엔드', '컴포넌트', '인터랙션', 'Lighthouse'],
    category: 'developer',
    templateType: 'notion',
    isNotion: true,
    previewBg: 'bg-[#F4F4F5]',
  },
  {
    id: 'theme-sustainable',
    name: 'Sustainable Impact',
    description: 'ESG·소셜 임팩트 기획자 테마. 이해관계자 지도와 사회적 가치 지표를 중심으로 임팩트를 설득력 있게 전달.',
    tags: ['ESG', '소셜 임팩트', '서비스 기획', 'SDGs'],
    category: 'researcher',
    templateType: 'notion',
    isNotion: true,
    previewBg: 'bg-[#F4F1EB]',
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

function Visual1Preview() {
  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden text-[6px] leading-tight">
      <div className="h-10 bg-gray-400 flex items-center justify-center">
        <div className="h-2 w-16 bg-white/60 rounded-sm tracking-widest"></div>
      </div>
      <div className="p-2">
        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 -mt-4 mb-1 shadow-sm flex items-center justify-center text-sm">👤</div>
        <div className="h-2 w-16 bg-gray-800 rounded-sm mb-0.5"></div>
        <div className="h-1 w-24 bg-gray-300 rounded-sm mb-2"></div>
        <div className="grid grid-cols-2 gap-0.5 mb-2">
          {[1,2,3,4].map(i => <div key={i} className="flex items-center gap-0.5 p-0.5 bg-gray-50 rounded"><div className="w-1 h-1 bg-gray-300 rounded-sm"></div><div className="h-1 flex-1 bg-gray-200 rounded-sm"></div></div>)}
        </div>
        <div className="h-px bg-gray-200 mb-1"></div>
        <div className="text-[5px] font-bold mb-1">Projects</div>
        <div className="grid grid-cols-2 gap-0.5">
          {[1,2].map(i => <div key={i} className="border border-gray-100 rounded overflow-hidden"><div className="h-4 bg-blue-50"></div><div className="p-0.5"><div className="h-1 bg-gray-200 rounded-sm"></div></div></div>)}
        </div>
      </div>
    </div>
  );
}

function Visual2Preview() {
  return (
    <div className="w-full h-full bg-[#f3f2eb] rounded-lg overflow-hidden text-[6px] leading-tight p-2">
      <div className="pb-1 mb-1 border-b-2 border-gray-200">
        <div className="h-3 w-20 bg-[#dedbd2] rounded-sm mb-0.5"></div>
        <div className="h-1.5 w-12 bg-gray-800 rounded-sm"></div>
      </div>
      <div className="flex justify-between items-start mb-1">
        <div className="flex-1">
          <div className="h-1 w-10 bg-gray-600 rounded-sm mb-0.5"></div>
          <div className="border-l-2 border-black pl-1">
            <div className="h-1 w-full bg-gray-300 rounded-sm mb-0.5"></div>
            <div className="h-1 w-3/4 bg-gray-300 rounded-sm"></div>
          </div>
        </div>
        <div className="w-5 h-5 bg-[#e8e4db] rounded-full ml-1 flex-shrink-0"></div>
      </div>
      <div className="flex gap-0.5 mb-1">
        {['R','P','S','C'].map(l => <div key={l} className="flex-1 bg-[#e8e4db] text-center py-0.5 rounded text-[4px] font-bold text-gray-600">{l}</div>)}
      </div>
      <div className="grid grid-cols-2 gap-0.5">
        {[1,2].map(i => <div key={i} className="border border-gray-200 rounded overflow-hidden bg-white"><div className="h-5 bg-blue-50 flex items-center justify-center text-[4px] text-gray-500">proj</div></div>)}
      </div>
    </div>
  );
}

function Visual3Preview() {
  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden text-[6px] leading-tight">
      <div className="h-2 bg-gradient-to-r from-pink-200 via-purple-200 to-blue-200 w-full"></div>
      <div className="p-2">
        <div className="text-center mb-1">
          <div className="text-[5px] font-bold mb-0.5">포트폴리오</div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 bg-pink-100 rounded-full"></div>
            <div className="border border-gray-200 p-1 rounded w-full text-[4px] text-gray-500">
              <div className="font-bold mb-0.5">안녕하세요!</div>
              <div className="h-0.5 bg-gray-100 rounded mb-0.5"></div>
              <div className="h-0.5 bg-gray-100 rounded"></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-0.5 mb-1">
          {[1,2,3,4].map(i => <div key={i} className="border border-gray-100 rounded overflow-hidden"><div className="h-4 bg-pink-50 flex items-center justify-center text-[4px] text-gray-400">proj</div></div>)}
        </div>
        <div className="h-0.5 bg-gradient-to-r from-pink-200 via-purple-200 to-blue-200"></div>
      </div>
    </div>
  );
}

function Visual4Preview() {
  return (
    <div className="w-full h-full bg-[#fcfcfc] rounded-lg overflow-hidden text-[6px] leading-tight p-2">
      <div className="mb-1">
        <div className="h-2 w-10 bg-gray-800 rounded-sm mb-0.5"></div>
        <div className="h-1 w-14 bg-gray-400 rounded-sm mb-1"></div>
        <div className="bg-[#f7f6f3] border border-gray-200 rounded p-1 flex items-start gap-0.5">
          <div className="text-[5px]">💡</div>
          <div className="space-y-0.5 flex-1"><div className="h-0.5 bg-gray-300 rounded-sm w-full"></div><div className="h-0.5 bg-gray-200 rounded-sm w-3/4"></div></div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="w-1/3 space-y-1">
          <div className="text-[4px] font-bold text-gray-400 border-b border-gray-200 pb-0.5">Contact</div>
          <div className="space-y-0.5">{[1,2,3].map(i => <div key={i} className="h-0.5 bg-gray-200 rounded-sm"></div>)}</div>
          <div className="text-[4px] font-bold text-gray-400 border-b border-gray-200 pb-0.5 mt-1">Skills</div>
          <div className="space-y-0.5">{[1,2,3].map(i => <div key={i} className="bg-white border border-gray-100 rounded p-0.5"><div className="h-0.5 bg-blue-200 rounded-sm w-1/2 mb-0.5"></div><div className="h-0.5 bg-gray-100 rounded-sm w-full"></div></div>)}</div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-[4px] font-bold border-b border-gray-200 pb-0.5">Core Experience</div>
          <div className="space-y-0.5">{[1,2].map(i => <div key={i} className="pl-1 border-l-2 border-gray-200"><div className="h-0.5 bg-gray-300 rounded-sm w-10 mb-0.5"></div><div className="h-0.5 bg-gray-100 rounded-sm w-8"></div></div>)}</div>
          <div className="text-[4px] font-bold border-b border-gray-200 pb-0.5 mt-1">Projects</div>
          <div className="grid grid-cols-2 gap-0.5">{[1,2].map(i => <div key={i} className="border border-gray-200 rounded overflow-hidden"><div className="h-4 bg-blue-50"></div><div className="p-0.5"><div className="h-0.5 bg-gray-200 rounded-sm"></div></div></div>)}</div>
        </div>
      </div>
    </div>
  );
}

function Visual5Preview() {
  return (
    <div className="w-full h-full bg-[#F7F6F3] rounded-lg overflow-hidden text-[6px] leading-tight p-2 flex flex-col items-center">
      <div className="w-10 h-10 bg-white rounded-full border border-gray-200 flex items-center justify-center text-lg mb-1 shadow-sm">👤</div>
      <div className="h-1.5 w-12 bg-gray-800 rounded-sm mb-0.5"></div>
      <div className="h-1 w-16 bg-gray-400 rounded-sm mb-2"></div>
      <div className="grid grid-cols-3 gap-0.5 w-full mb-2">
        {['E','P','I'].map(l => <div key={l} className="flex flex-col items-center p-1 bg-white rounded border border-gray-100"><div className="w-2 h-2 bg-blue-100 rounded-full mb-0.5"></div><div className="text-[4px] text-gray-500">{l}</div></div>)}
      </div>
      <div className="w-full bg-white border border-gray-200 p-1 rounded mb-1">
        <div className="h-0.5 bg-gray-200 rounded-sm mb-0.5 w-full"></div>
        <div className="h-0.5 bg-gray-100 rounded-sm w-3/4"></div>
      </div>
      <div className="w-full space-y-0.5">
        {[1,2,3].map(i => <div key={i} className="bg-white border border-gray-100 rounded flex items-center gap-1 p-0.5"><div className="w-3 h-3 bg-blue-50 rounded flex-shrink-0"></div><div className="flex-1"><div className="h-0.5 bg-gray-300 rounded-sm mb-0.5"></div><div className="h-0.5 bg-gray-100 rounded-sm w-3/4"></div></div></div>)}
      </div>
    </div>
  );
}

function Visual6Preview() {
  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden text-[6px] leading-tight">
      <div className="h-10 bg-gradient-to-r from-gray-900 to-gray-700 relative flex items-center justify-center">
        <div className="text-white/10 text-lg font-black">PORTFOLIO</div>
      </div>
      <div className="p-2">
        <div className="flex items-end gap-1 -mt-4 mb-1">
          <div className="w-8 h-8 bg-white rounded-lg shadow border border-white flex items-center justify-center text-sm">👤</div>
          <div><div className="h-1.5 w-10 bg-gray-800 rounded-sm mb-0.5"></div><div className="h-1 w-8 bg-gray-400 rounded-sm"></div></div>
        </div>
        <div className="h-1 w-24 bg-gray-300 rounded-sm mb-2"></div>
        <div className="text-[5px] font-bold mb-1 border-b-2 border-gray-900 inline-block">Featured Work</div>
        <div className="grid grid-cols-3 gap-0.5">
          {['bg-blue-50','bg-pink-50','bg-green-50'].map((c,i) => (
            <div key={i} className="flex flex-col">
              <div className={`aspect-[4/3] rounded ${c}`}></div>
              <div className="h-1 bg-gray-200 rounded-sm mt-0.5"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Visual7Preview() {
  return (
    <div className="w-full h-full bg-[#1F1F1F] rounded-lg overflow-hidden text-[6px] leading-tight">
      <div className="h-8 bg-gradient-to-r from-orange-900 via-indigo-900 to-purple-900 opacity-90"></div>
      <div className="p-2">
        <div className="text-center mb-1">
          <div className="h-1.5 w-16 bg-white/80 rounded-sm mx-auto mb-0.5"></div>
          <div className="h-1 w-10 bg-white/40 rounded-sm mx-auto"></div>
        </div>
        <div className="text-[4px] text-[#5C7CFA] font-bold border-b border-[#3A3A3A] pb-0.5 mb-0.5 uppercase">Introduce</div>
        <div className="space-y-0.5 mb-1">{[1,2,3].map(i => <div key={i} className="h-0.5 bg-[#3A3A3A] rounded-sm w-full"></div>)}</div>
        <div className="text-[4px] text-[#5C7CFA] font-bold border-b border-[#3A3A3A] pb-0.5 mb-0.5 uppercase">Projects</div>
        <div className="grid grid-cols-3 gap-0.5">
          {[1,2,3].map(i => <div key={i} className="bg-[#2A2A2A] rounded p-0.5 border border-[#3A3A3A]"><div className="h-2 bg-[#333] rounded-sm mb-0.5"></div><div className="h-1 bg-[#3A3A3A] rounded-sm"></div></div>)}
        </div>
      </div>
    </div>
  );
}

function Visual8Preview() {
  return (
    <div className="w-full h-full bg-[#191919] rounded-lg overflow-hidden text-[6px] leading-tight">
      <div className="h-8 bg-gradient-to-r from-yellow-700 via-green-800 to-teal-900 opacity-80"></div>
      <div className="p-2">
        <div className="h-1.5 w-12 bg-white/80 rounded-sm mx-auto mb-2"></div>
        <div className="bg-[#2B323F] p-1 rounded mb-1 flex items-center gap-0.5">
          <div className="text-[5px]">🧑🏻‍💻</div>
          <div className="h-1 w-12 bg-[#EBEBEB]/60 rounded-sm"></div>
        </div>
        <div className="grid grid-cols-3 gap-0.5 mb-1">
          {[1,2,3].map(i => <div key={i} className="bg-[#252525] rounded overflow-hidden border border-[#3A3A3A]"><div className="h-3 bg-blue-900/30"></div><div className="p-0.5"><div className="h-0.5 bg-[#D19ED1]/60 rounded-sm"></div></div></div>)}
        </div>
        <div className="bg-[#2B323F] p-1 rounded flex items-center gap-0.5">
          <div className="text-[5px]">💻</div>
          <div className="h-1 w-8 bg-[#EBEBEB]/60 rounded-sm"></div>
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

// ── 비주얼 템플릿 풀 미리보기 (샘플 데이터 사용) ──
const SAMPLE_PORTFOLIO = {
  userName: '홍길동',
  headline: 'UX/UI Designer & Front-end Developer',
  about: '안녕하세요. 사용자 경험을 설계하는 디자이너 홍길동입니다.\n문제 해결을 위한 디자인을 고민하고, 코드로 구현하는 과정까지 즐깁니다.',
  location: '서울특별시',
  contact: { email: 'example@email.com', phone: '010-1234-5678', instagram: '', website: 'velog.io/@example' },
  education: [
    { name: '한국대학교', degree: '시각디자인학과 학사', period: '2018.03 - 2024.02', detail: '학점 4.2 / 4.5' },
    { name: 'IT 부트캠프', degree: '프론트엔드 개발 과정 수료', period: '2023.01 - 2023.06', detail: 'React 기반 프로젝트 개발' },
  ],
  experiences: [
    { company: '유저익스피리언스', role: 'UI/UX Designer', period: '2022.03 - 현재', bullets: ['자사 서비스 UI/UX 리뉴얼', '디자인 시스템 구축'] },
    { company: '웹에이전시', role: 'Web Publisher', period: '2021.01 - 2022.02', bullets: ['반응형 웹 사이트 구축', '크로스 브라우징 최적화'] },
  ],
  skills: { tools: ['Figma', 'Photoshop'], languages: ['HTML/CSS', 'React'], frameworks: ['Notion'] },
  awards: [{ date: '2023.11', title: 'K-디자인 어워드 위너' }, { date: '2022.05', title: '교내 웹 기획 공모전 대상' }],
};

function VisualFullPreview({ templateId }) {
  const portfolio = { ...SAMPLE_PORTFOLIO, templateId };
  return <VisualPortfolioRenderer portfolio={portfolio} />;
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
                <p className="text-gray-400 text-[12px]">2025.03 ~ 진행중</p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-xs mb-2">🛠 Skills</h3>
            <div className="flex flex-wrap gap-1">
              <span className="px-2 py-0.5 bg-gray-100 rounded text-[12px]">React</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-[12px]">Node.js</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-[12px]">Python</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-[12px]">Figma</span>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-xs mb-2">📞 Contact</h3>
            <div className="space-y-1 text-[12px] text-gray-600">
              <p>010-0000-0000</p>
              <p>example@email.com</p>
              <p>github.com/username</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-gray-100">
        <h3 className="font-bold text-base mb-3">프로젝트 갤러리</h3>
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
              <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center text-2xl">{['💻','📱','🎨','📊'][i-1]}</div>
              <div className="p-2">
                <p className="text-xs font-medium text-gray-700">프로젝트 {i}</p>
                <p className="text-[12px] text-gray-400">2025.0{i}</p>
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
            <h3 className="font-bold text-sm text-[#2d2a26] mb-3 flex items-center gap-2">한눈에 보기</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[#8a8578]">위치</span><span className="font-medium text-[#2d2a26]">서울특별시</span></div>
              <div className="flex justify-between"><span className="text-[#8a8578]">생년월일</span><span className="font-medium text-[#2d2a26]">2000.01.01</span></div>
              <div className="flex justify-between"><span className="text-[#8a8578]">학교</span><span className="font-medium text-[#2d2a26]">가천대학교</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-[#e8e4dc]">
            <h3 className="font-bold text-sm text-[#2d2a26] mb-3 flex items-center gap-2">저는 이런 사람이에요</h3>
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
              <div className="aspect-[4/3] bg-[#f0ece4] flex items-center justify-center text-xs text-[#8a8578]">콜렉션 {i}</div>
              <div className="p-3">
                <p className="text-xs font-bold text-[#2d2a26] mb-0.5">캠페인 {i}</p>
                <p className="text-[12px] text-[#8a8578]">마케팅 프로젝트 설명</p>
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
      <div className="px-8 py-4 border-t border-[#e8e4dc] flex items-center justify-between text-[12px] text-[#8a8578]">
        <span>FitPoly Portfolio · 홍길동</span><span>맨 위로 ↑</span>
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
              <p className="text-[12px] text-blue-700/70">끊임없이 배우고 성장합니다</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <p className="text-xs font-bold text-blue-900 mb-1">팀워크</p>
              <p className="text-[12px] text-blue-700/70">협업으로 더 큰 가치를 만듭니다</p>
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
                  <div><p className="text-xs font-medium">가천대학교 · 컴퓨터공학과</p><p className="text-[12px] text-gray-400">학사 재학 · 2020.03 - 현재</p></div>
                </div>
                <div className="flex items-start gap-2.5 relative">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white z-10 mt-0.5 flex-shrink-0" />
                  <div><p className="text-xs font-medium">OO고등학교</p><p className="text-[12px] text-gray-400">졸업 · 2017.03 - 2020.02</p></div>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-amber-500 rounded-full inline-block" /> 수상
              </h2>
              <div className="space-y-2">
                <div className="flex items-start gap-2"><span className="text-sm">🏆</span><div><p className="text-xs font-medium">해커톤 최우수상</p><p className="text-[12px] text-gray-400">2025.06</p></div></div>
                <div className="flex items-start gap-2"><span className="text-sm">🏆</span><div><p className="text-xs font-medium">프로그래밍 경진대회 장려상</p><p className="text-[12px] text-gray-400">2024.12</p></div></div>
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
              <h4 className="text-[12px] font-bold text-gray-500 mb-2 uppercase">도구</h4>
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
              <h4 className="text-[12px] font-bold text-gray-500 mb-2 uppercase">언어</h4>
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
        <div className="px-8 py-3 bg-gray-50 flex items-center justify-between text-[12px] text-gray-400 rounded-b-xl">
          <span>FitPoly Portfolio · 홍길동</span><span>맨 위로 ↑</span>
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
            {days.map(d => <div key={d} className="text-[12px] text-white/30 font-medium">{d}</div>)}
            {Array.from({length: 30}, (_, i) => (
              <div key={i} className={`text-[12px] py-1 rounded ${i === 14 ? 'bg-purple-500 text-white font-bold' : i === 7 || i === 22 ? 'bg-blue-500/30 text-blue-200' : 'text-white/40'}`}>{i+1}</div>
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
                  <span className="text-[12px] text-gray-400">{s.period}</span>
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
                    <p className="text-[12px] text-gray-400">{a.date}</p>
                  </div>
                  <span className="ml-auto px-2 py-0.5 rounded text-[12px] bg-gray-100 text-gray-500">{a.category}</span>
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
              <p className="text-[12px] text-emerald-600">알고리즘 문제풀이, 네트워크 보안 스터디</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-xs font-bold text-emerald-800 mb-1">2025년 7~8월</p>
              <p className="text-[12px] text-emerald-600">인턴십 준비, 포트폴리오 완성</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-3 bg-gray-50 flex items-center justify-between text-[12px] text-gray-400 rounded-b-xl">
          <span>FitPoly Dashboard · 홍길동</span><span>맨 위로 ↑</span>
        </div>
      </div>
    </div>
  );
}

// ── 디자인 테마 설정 (popoldesign.md 기반) ──
const THEME_CONFIGS = {
  'theme-lean-dev': {
    bg: '#000000', surface: '#111111', accent: '#FFFFFF', textMain: '#F5F5F5', textMuted: '#737373',
    font: 'ui-monospace, "Geist Mono", monospace',
    heroTag: '린 스타트업 · 개발자',
    metrics: [['서비스 사용자', '12,400+'], ['성능 개선', '+43%'], ['출시 기간', '14일']],
    tags: ['React', 'Next.js', 'Node.js', 'AWS'],
    philosophy: 'Simple is best. 가설을 세우고, 빠르게 검증하고, 피벗합니다.',
  },
  'theme-notion-pm': {
    bg: '#FFFFFF', surface: '#F7F7F5', accent: '#2F2F2F', textMain: '#37352F', textMuted: '#9B9A97',
    font: '"Pretendard", "Noto Sans KR", sans-serif',
    heroTag: '기획자 · PM',
    metrics: [['DAU/MAU', '+28%'], ['리텐션율', '73%'], ['전환율 CVR', '4.2%']],
    tags: ['PRD 작성', '데이터 분석', 'A/B 테스트', 'Figma'],
    philosophy: '데이터 기반으로 문제를 정의하고, 트레이드오프를 투명하게 공개합니다.',
  },
  'theme-double-diamond': {
    bg: '#FDFDFD', surface: '#F3F4F6', accent: '#4F46E5', textMain: '#111827', textMuted: '#6B7280',
    font: '"Syne", "Inter", sans-serif',
    heroTag: '프로덕트 디자이너',
    metrics: [['Task 성공률', '↑ 34%'], ['체류 시간', '+2분 42초'], ['UT 통과율', '91%']],
    tags: ['Figma', 'UX Research', 'Design System', 'Prototype'],
    philosophy: 'Discover → Define → Develop → Deliver. 과정이 결과를 증명합니다.',
  },
  'theme-bento-metric': {
    bg: '#F8FAFC', surface: '#FFFFFF', accent: '#2563EB', textMain: '#0F172A', textMuted: '#475569',
    font: '"Inter", sans-serif',
    heroTag: '그로스 해커 · 퍼포먼스 마케터',
    metrics: [['ROAS', '143%'], ['CAC 절감', '↓ 38%'], ['Retention', '+21%']],
    tags: ['GA4', 'Amplitude', 'Meta Ads', 'A/B Testing'],
    philosophy: 'AARRR 퍼널 전반에 걸친 정량적 성과를 대시보드로 증명합니다.',
  },
  'theme-startup-hustler': {
    bg: '#E2E8F0', surface: '#FFFFFF', accent: '#FF3366', textMain: '#000000', textMuted: '#333333',
    font: '"Space Grotesk", "Public Sans", sans-serif',
    heroTag: '창업가 · 풀스택 개발자',
    metrics: [['Time to Ship', '14일'], ['초기 매출', '₩12M'], ['피벗 횟수', '2회']],
    tags: ['React', 'Node.js', 'Stripe', 'Vercel'],
    philosophy: '시장의 진짜 문제를 찾고, 2주 만에 MVP를 만들어 검증합니다.',
  },
  'theme-research-archival': {
    bg: '#F7F5F0', surface: '#EDE8E3', accent: '#D9381E', textMain: '#1C1917', textMuted: '#78716C',
    font: '"Lora", "Georgia", serif',
    heroTag: 'UX 리서처',
    metrics: [['조사 표본', 'N=120'], ['신뢰수준', '95%'], ['개발 절감', '200h']],
    tags: ['In-depth Interview', 'Shadowing', 'FGI', 'Affinity Mapping'],
    philosophy: '정성 데이터가 비즈니스 임팩트로 이어지는 과정을 신뢰감 있게 기록합니다.',
  },
  'theme-cyberpunk': {
    bg: '#030712', surface: '#111827', accent: '#10B981', textMain: '#F3F4F6', textMuted: '#9CA3AF',
    font: '"JetBrains Mono", "Rajdhani", monospace',
    heroTag: '백엔드 엔지니어 · 인프라 아키텍트',
    metrics: [['최대 TPS', '12,000'], ['지연 시간 개선', '↓ 70ms'], ['가용성', '99.97%']],
    tags: ['Go', 'Kubernetes', 'Redis', 'Kafka', 'PostgreSQL'],
    philosophy: '대용량 트래픽을 처리하는 견고한 아키텍처와 시스템 가용성으로 신뢰를 증명합니다.',
  },
  'theme-ats-classic': {
    bg: '#FFFFFF', surface: '#F5F5F5', accent: '#000000', textMain: '#111111', textMuted: '#555555',
    font: '"Arial", sans-serif',
    heroTag: 'ATS 최적화 · 대기업 지원형',
    metrics: [['경력 기간', '3년 6개월'], ['완료 프로젝트', '12건'], ['직무 키워드', '18개']],
    tags: ['React', 'TypeScript', 'Node.js', 'AWS'],
    philosophy: 'ATS 파싱에 최적화된 깔끔한 구조로 서류 합격률을 높입니다.',
  },
  'theme-component-creator': {
    bg: '#F4F4F5', surface: '#FFFFFF', accent: '#3B82F6', textMain: '#18181B', textMuted: '#52525B',
    font: '"Poppins", "Nunito Sans", sans-serif',
    heroTag: '프론트엔드 엔지니어 · UX 엔지니어',
    metrics: [['Lighthouse 점수', '98점'], ['번들 크기 절감', '↓ 42%'], ['컴포넌트 수', '40+']],
    tags: ['React', 'TypeScript', 'Storybook', 'a11y'],
    philosophy: "Show, don't tell. 라이브 컴포넌트로 코드 품질을 증명합니다.",
  },
  'theme-sustainable': {
    bg: '#F4F1EB', surface: '#FCFBF9', accent: '#4A5D23', textMain: '#333333', textMuted: '#7A7A7A',
    font: '"DM Sans", "Fraunces", sans-serif',
    heroTag: 'ESG · 소셜 임팩트 기획자',
    metrics: [['수혜자 수', '300명+'], ['탄소 절감', '10톤'], ['조달 펀딩', '₩50M']],
    tags: ['소셜 임팩트', 'SDGs 매핑', '이해관계자 분석', 'Logic Model'],
    philosophy: '착한 의도를 정량적 임팩트 지표로 증명하여 지속 가능한 가치를 설계합니다.',
  },
};

function ThemeFullPreview({ templateId }) {
  const cfg = THEME_CONFIGS[templateId];
  if (!cfg) return <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF' }}>미리보기 준비 중</div>;

  const S = {
    wrapper: { background: cfg.bg, fontFamily: cfg.font, padding: '32px', minHeight: '500px' },
    card: { background: cfg.surface, borderRadius: '12px', padding: '20px', marginBottom: '14px' },
    heroTitle: { fontSize: '22px', fontWeight: 700, color: cfg.textMain, marginBottom: '2px' },
    heroSub: { fontSize: '13px', color: cfg.textMuted, marginBottom: '8px' },
    badge: { display: 'inline-block', padding: '3px 10px', background: `${cfg.accent}18`, border: `1px solid ${cfg.accent}44`, borderRadius: '20px', fontSize: '12px', color: cfg.accent, fontWeight: 600, marginBottom: '14px' },
    divider: { borderLeft: `3px solid ${cfg.accent}`, paddingLeft: '12px', fontSize: '13px', color: cfg.textMuted, fontStyle: 'italic', marginBottom: '14px' },
    metricsWrap: { display: 'flex', gap: '28px' },
    metricVal: { fontSize: '22px', fontWeight: 700, color: cfg.accent },
    metricKey: { fontSize: '11px', color: cfg.textMuted, marginTop: '2px' },
    sectionLabel: { fontSize: '10px', fontWeight: 700, color: cfg.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' },
    tag: { display: 'inline-block', padding: '4px 10px', border: `1px solid ${cfg.accent}40`, borderRadius: '6px', fontSize: '12px', color: cfg.textMain, marginRight: '6px', marginBottom: '6px', background: `${cfg.accent}08` },
    projectGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' },
    projectCard: { background: cfg.surface, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${cfg.accent}20` },
    projectThumb: { height: '72px', background: `${cfg.accent}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', borderBottom: `1px solid ${cfg.accent}18` },
    projectBody: { padding: '12px' },
    projectTitle: { fontWeight: 600, color: cfg.textMain, fontSize: '14px', marginBottom: '4px' },
    projectMeta: { fontSize: '12px', color: cfg.textMuted },
    footer: { textAlign: 'center', fontSize: '12px', color: cfg.textMuted, borderTop: `1px solid ${cfg.accent}20`, paddingTop: '14px' },
  };

  return (
    <div style={S.wrapper}>
      {/* Hero */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '12px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: `${cfg.accent}22`, border: `2px solid ${cfg.accent}44`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>👤</div>
          <div style={{ flex: 1 }}>
            <div style={S.heroTitle}>홍길동</div>
            <div style={S.heroSub}>Gil-dong Hong</div>
            <div style={S.badge}>{cfg.heroTag}</div>
          </div>
        </div>
        <div style={S.divider}>{cfg.philosophy}</div>
        <div style={S.metricsWrap}>
          {cfg.metrics.map(([key, val]) => (
            <div key={key}>
              <div style={S.metricVal}>{val}</div>
              <div style={S.metricKey}>{key}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 기술 스택 */}
      <div style={S.card}>
        <div style={S.sectionLabel}>기술 스택 / 역량</div>
        <div>{cfg.tags.map(t => <span key={t} style={S.tag}>{t}</span>)}</div>
      </div>

      {/* 프로젝트 */}
      <div style={S.projectGrid}>
        {[{ emoji: '💻', title: '주요 프로젝트', period: '2024.03 – 2024.09', desc: '팀 리드로서 핵심 기능을 설계하고 구현. 성과 지표 30% 개선.' },
          { emoji: '🚀', title: '사이드 프로젝트', period: '2023.11 – 2024.02', desc: 'MVP를 2주 만에 출시하고 초기 사용자 500명 확보.' }
        ].map((p, i) => (
          <div key={i} style={S.projectCard}>
            <div style={S.projectThumb}>{p.emoji}</div>
            <div style={S.projectBody}>
              <div style={S.projectTitle}>{p.title}</div>
              <div style={S.projectMeta}>{p.period}</div>
              <div style={{ ...S.projectMeta, marginTop: '6px', lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={S.footer}>FitPoly Portfolio · 홍길동 · {cfg.heroTag}</div>
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
  const [activeCategory, setActiveCategory] = useState('all');


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
        templateType: template.templateType || template.id,
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

      // theme-* 템플릿: AI PPT 생성 페이지로 바로 이동
      if (template.id.startsWith('theme-')) {
        // theme- 접두사 제거해서 aiPptTemplates.jsx ID로 변환 (e.g. theme-lean-dev → lean-dev)
        const pptTemplateId = template.id.replace(/^theme-/, '');
        navigate(`/app/portfolio/ai-ppt/${id}?template=${pptTemplateId}&autostart=true`);
      } else {
        navigate(`/app/portfolio/edit-notion/${id}`);
        toast.success('포트폴리오가 생성되었습니다!');
      }
    } catch (error) {
      toast.error('포트폴리오 생성에 실패했습니다');
    }
    setCreating(false);
  };

  return (
    <div className="animate-fadeIn max-w-[1240px] mx-auto">
      <Link to="/app/portfolio" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bluewood-400 hover:text-primary-600 mb-6 transition-colors">
        <ArrowLeft size={14} /> 포트폴리오 목록으로
      </Link>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-2 mb-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold border transition-all ${step === 'template' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-bluewood-400 border-surface-200'}`}>
          <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${step === 'template' ? 'bg-white text-primary-600' : 'bg-surface-200 text-bluewood-400'}`}>1</span>
          템플릿 선택
        </div>
        <ArrowRight size={13} className="text-bluewood-200" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold border transition-all ${step === 'joblink' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-bluewood-400 border-surface-200'}`}>
          <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold ${step === 'joblink' ? 'bg-white text-primary-600' : 'bg-surface-200 text-bluewood-400'}`}>2</span>
          기업 공고 연결 (선택)
        </div>
      </div>

      {step === 'template' && (
        <>
          <div className="mb-8">
            <h1 className="text-[28px] font-bold text-primary-600 tracking-[-0.02em] mb-1">포트폴리오 템플릿 선택</h1>
            <p className="text-[15px] text-bluewood-400">
              원하는 디자인을 미리보기로 확인 후 선택하세요. 프로필 정보가 자동으로 채워집니다.
            </p>
          </div>

          {/* 카테고리 탭 */}
          <div className="flex items-center gap-1.5 mb-6 flex-wrap">
            {TEMPLATE_CATEGORIES.map(cat => {
              const count = cat.id === 'all'
                ? PORTFOLIO_TEMPLATES.length
                : PORTFOLIO_TEMPLATES.filter(t => t.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg text-[13px] font-semibold border transition-all ${
                    activeCategory === cat.id
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-bluewood-500 border-surface-200 hover:border-bluewood-300 hover:text-bluewood-700'
                  }`}
                >
                  {cat.label}
                  <span className={`ml-1.5 text-[12px] ${activeCategory === cat.id ? 'opacity-70' : 'opacity-50'}`}>({count})</span>
                </button>
              );
            })}
          </div>

          {/* Template Cards */}
          <div className="grid lg:grid-cols-3 gap-5 mb-8">
            {PORTFOLIO_TEMPLATES.filter(t => activeCategory === 'all' || t.category === activeCategory).map(template => {
              const isSelected = selected === template.id;
              return (
                <div
                  key={template.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(template.id)}
                  onKeyDown={e => e.key === 'Enter' && setSelected(template.id)}
                  className={`text-left rounded-xl border-2 overflow-hidden transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-primary-600 shadow-lg shadow-primary-100'
                      : 'border-surface-200 bg-white hover:border-primary-300 hover:shadow-md'
                  }`}
                >
                  {/* Preview Area */}
                  <div className={`h-48 ${template.previewBg} overflow-hidden relative`}>
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center z-10 shadow-md">
                        <Check size={13} className="text-white" />
                      </div>
                    )}
                    <div
                      style={{
                        transform: 'scale(0.42)',
                        transformOrigin: 'top left',
                        width: '238%',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      {template.id === 'notion' && <NotionFullPreview />}
                      {template.id === 'academic' && <AcademicFullPreview />}
                      {template.id?.startsWith('visual-') && <VisualFullPreview templateId={template.id} />}
                      {template.id?.startsWith('theme-') && <ThemeFullPreview templateId={template.id} />}
                    </div>
                  </div>

                  {/* Info */}
                  <div className={`px-5 py-4 border-t ${isSelected ? 'border-primary-200 bg-primary-50/30' : 'border-surface-100 bg-white'}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className={`font-bold text-[15px] leading-snug ${isSelected ? 'text-primary-700' : 'text-bluewood-800'}`}>{template.name}</h3>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPreviewTemplate(template.id); }}
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium text-bluewood-400 border border-surface-200 rounded-md hover:border-primary-300 hover:text-primary-600 transition-colors"
                      >
                        <Eye size={11} /> 미리보기
                      </button>
                    </div>
                    <p className="text-[13px] text-bluewood-400 mb-3 leading-relaxed line-clamp-2">{template.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {template.tags.map(tag => (
                        <span key={tag} className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          isSelected
                            ? 'bg-primary-100 text-primary-600 border-primary-200'
                            : 'bg-surface-50 text-bluewood-500 border-surface-200'
                        }`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 다음 버튼 */}
          <div className="sticky bottom-6">
            <button
              onClick={handleNext}
              disabled={!selected}
              className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-xl text-[15px] font-bold hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary-200"
            >
              <ArrowRight size={17} />
              {selected
                ? `"${PORTFOLIO_TEMPLATES.find(t => t.id === selected)?.name}" 선택 — 다음 단계`
                : '템플릿을 선택해주세요'}
            </button>
          </div>
        </>
      )}

      {step === 'joblink' && (
        <>
          <div className="mb-8">
            <button onClick={() => setStep('template')} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bluewood-400 hover:text-primary-600 mb-4 transition-colors">
              <ArrowLeft size={14} /> 템플릿 다시 선택
            </button>
            <h1 className="text-[28px] font-bold text-primary-600 tracking-[-0.02em] mb-1">기업 공고 연결</h1>
            <p className="text-[15px] text-bluewood-400">
              지원할 공고 링크 또는 기업명, 모집분야, 지원서 접수 기간을 입력하면 기업 맞춤형 포트폴리오가 생성됩니다 (선택사항)
            </p>
          </div>

          {jobAnalysis ? (
            <div className="space-y-4">
              <JobAnalysisBadge analysis={jobAnalysis} onRemove={() => setJobAnalysis(null)} />
              <button
                onClick={() => handleCreate(jobAnalysis)}
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-xl text-[15px] font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-lg shadow-primary-200"
              >
                {creating ? (
                  <><Loader2 size={17} className="animate-spin" /> 생성 중...</>
                ) : (
                  <><Building2 size={17} /> {jobAnalysis.company} 맞춤 포트폴리오 만들기</>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-surface-200 p-6">
              <JobLinkInput
                onAnalysisComplete={(analysis) => setJobAnalysis(analysis)}
                onSkip={() => handleCreate(null)}
              />
            </div>
          )}
        </>
      )}

      {/* 템플릿 미리보기 모달 */}
      {previewTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[88vh] overflow-hidden border border-surface-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 bg-surface-50/60">
              <div>
                <h3 className="font-bold text-[17px] text-primary-600">
                  {PORTFOLIO_TEMPLATES.find(t => t.id === previewTemplate)?.name}
                </h3>
                <p className="text-[12px] text-bluewood-400 mt-0.5">실제 포트폴리오 레이아웃 예시입니다</p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
              >
                <X size={17} className="text-bluewood-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(88vh-73px)]">
              <div className="border border-surface-200 rounded-xl overflow-hidden" style={{ minHeight: '500px' }}>
                {previewTemplate === 'notion' && <NotionFullPreview />}
                {previewTemplate === 'academic' && <AcademicFullPreview />}
                {previewTemplate === 'timeline' && <TimelineFullPreview />}
                {previewTemplate?.startsWith('visual-') && <VisualFullPreview templateId={previewTemplate} />}
                {previewTemplate?.startsWith('theme-') && <ThemeFullPreview templateId={previewTemplate} />}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-surface-200 bg-surface-50/60 flex items-center justify-between gap-3">
              <p className="text-[13px] text-bluewood-400">이 템플릿을 선택하면 프로필 정보가 자동으로 채워집니다</p>
              <button
                onClick={() => { setSelected(previewTemplate); setPreviewTemplate(null); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-[14px] font-bold hover:bg-primary-700 transition-colors"
              >
                <Check size={15} /> 이 템플릿 선택
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { PORTFOLIO_TEMPLATES };
