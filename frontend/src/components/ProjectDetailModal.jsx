/**
 * ProjectDetailModal — 프로젝트(경험) 상세 모달 (편집/미리보기/링크공유 공용).
 *
 * 본문은 하나의 자유 노션 캔버스(NotionDocEditor)로 편집한다.
 *  - 좌측: 팔레트(섹션 + 핵심 경험) — 드래그하여 캔버스에 삽입 (편집 모드)
 *  - 중앙: 속성 헤더(기간/역할/기술/키워드/목표/링크 + 핵심경험) + 자유 캔버스
 *  - 우측: AI 첨삭 패널 (jobAnalysis 연결 시, 편집 모드)
 *
 * Props:
 *  - exp: 프로젝트(경험) 객체. 캔버스는 exp.notionDoc(Yoopta JSON)에 저장.
 *  - readOnly: 읽기전용(미리보기·링크공유)
 *  - onUpdate(changes): 편집 모드에서 변경 저장
 *  - onClose, jobAnalysis, resizeToBase64, genericMode
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from '../services/firestoreProxy';
import { db } from '../config/firebase';
import { X, ExternalLink, ImagePlus, Check, Loader2, FileText, GripVertical, Sparkles, Wand2, List, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import KeyExperienceSlider from './KeyExperienceSlider';
import GuidedTutorial from './GuidedTutorial';
import { useOnboarding } from './OnboardingOverlay';
import { NotionDocEditor, CUSTOM_PALETTE_DRAG_TYPE } from './YooptaMiniEditor';
import {
  buildNotionDocFromExperience,
  allKeyExperiencePaletteBlocks,
  blocksToYooptaValue,
  buildRenderableSections,
  sectionPaletteBlocks,
  keyExperiencePaletteBlocks,
  tailoredToBlocks,
  getSectionTemplates,
  extractSectionsFromDoc,
  experienceDraftBlocks,
  composeDraftBlocks,
  extractHeadingsFromDoc,
  emptyNotionDoc,
} from '../utils/projectSections';
import { contentBearingCoreSections } from '../utils/coreExperienceSections';
import JobCoreShowcase, { hasJobCoreContent } from './portfolio/JobCoreShowcase';
import RecipeArtifactCover from './portfolio/RecipeArtifactCover';
import { normalizePortfolioVisuals } from '../utils/devPortfolio';
import { JOB_SPECIFIC_FIELDS } from '../stores/experienceStore';
import { stripMd } from '../utils/textUtils';
import useModalBehavior from '../hooks/useModalBehavior';
import ConfirmDialog from './ConfirmDialog';

function slatePlainText(node) {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  return (node.children || []).map(slatePlainText).join('');
}

function docHasMeaningfulContent(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(block => {
    if (!block) return false;
    if (block.type === 'Image' || block.type === 'Table' || block.type === 'Divider') return true;
    return (block.value || []).some(node => slatePlainText(node).trim());
  });
}

function JobArtifactCover({ exp }) {
  const structured = exp?.structuredResult || {};
  const jobCategory = exp?.jobCategory || structured.jobCategory || 'common';
  const variant = structured.exportConfig?.artifactCoverVariant;

  // 전용 변형이 없는 직군(dev/pm/marketer 외)은 구성 계획이 만든 레시피로 히어로를 조립한다.
  // 손으로 만든 15종 변형은 아래 분기에서 그대로 유지된다.
  const recipe = structured.exportConfig?.artifactRecipe;
  if (recipe && !['dev', 'pm', 'marketer'].includes(jobCategory)) {
    const visuals = normalizePortfolioVisuals(structured, {
      jobSections: JOB_SPECIFIC_FIELDS[jobCategory] || [],
      keyExperiences: Array.isArray(structured.keyExperiences) ? structured.keyExperiences : [],
      jobSpecific: structured.jobSpecific || {},
      texts: Object.values(structured.jobSpecific || {}),
    });
    return <RecipeArtifactCover recipe={recipe} visuals={visuals} />;
  }

  if (jobCategory === 'dev') {
    const stats = structured.githubStats || {};
    const experience = structured.gitAnalysis?.experiences?.[0] || {};
    const snippet = experience.code_snippets?.[0] || {};
    const codeLines = String(snippet.code || '').split('\n').filter(Boolean).slice(0, 6);
    const outcomes = (structured.product?.outcomes || []).slice(0, 3);
    const commitTypes = (stats.commitTypes || []).slice(0, 3);

    if (variant === 'quality-matrix') {
      const checks = [['권한별 화면', 'PASS'], ['키보드 탐색', 'PASS'], ['조건부 검증', '86%'], ['1,000행 렌더', '0.6s']];
      return (
        <div className="grid min-h-[270px] w-full bg-[#edf2f7] md:grid-cols-[1fr_310px]">
          <div className="p-6"><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-[#47627c]">Release quality matrix</p><p className="mt-1 text-[21px] font-black text-[#14263a]">배포 전 품질 게이트</p><div className="mt-5 grid grid-cols-2 gap-2">{checks.map(([label, value], index) => <div key={label} className="rounded-lg border border-[#cdd9e5] bg-white p-3"><div className="flex items-center justify-between"><span className="text-[11.5px] font-bold text-[#5d7186]">0{index + 1}</span><span className={`rounded px-1.5 py-0.5 text-[8px] font-black ${value === 'PASS' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{value}</span></div><p className="mt-3 text-[12px] font-extrabold text-[#14263a]">{label}</p></div>)}</div></div>
          <div className="flex flex-col justify-between bg-[#172554] p-6 text-white"><div><p className="text-[11.5px] font-bold text-blue-200">TEST COVERAGE</p><p className="mt-2 text-[48px] font-black leading-none">86<span className="text-[20px]">%</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[86%] rounded-full bg-[#60a5fa]" /></div></div><div className="space-y-2">{outcomes.map((item, index) => <div key={index} className="flex justify-between gap-3 border-t border-white/10 pt-2 text-[11.5px]"><span className="text-blue-200">{item.label}</span><span className="font-black">{item.value}</span></div>)}</div></div>
        </div>
      );
    }

    if (variant === 'performance-report') {
      return (
        <div className="min-h-[270px] w-full bg-[#111827] p-6 text-white"><div className="flex items-start justify-between"><div><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-[#55e6a5]">Core web vitals</p><p className="mt-1 text-[21px] font-black">성능 개선 전후 리포트</p></div><span className="rounded-full border border-[#55e6a5]/40 px-3 py-1 text-[10.5px] font-bold text-[#55e6a5]">BUDGET PASSED</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{outcomes.map((item, index) => <div key={index} className="rounded-xl border border-white/10 bg-white/[.04] p-4"><p className="text-[10.5px] font-bold text-slate-400">{item.label}</p><p className="mt-2 text-[24px] font-black text-[#55e6a5]">{item.value}</p><div className="mt-4 flex items-end gap-1">{[32, 48, 43, 68, 82, 100].map((height, barIndex) => <span key={barIndex} className="flex-1 rounded-sm bg-[#55e6a5]" style={{ height: `${Math.max(6, height - index * 5)}px`, opacity: .25 + barIndex * .13 }} />)}</div></div>)}</div></div>
      );
    }

    if (variant === 'accessibility-audit') {
      const audits = [['Dialog focus trap', '수정'], ['Tab keyboard pattern', '수정'], ['ARIA live message', '검증'], ['axe CI regression', '자동화']];
      return (
        <div className="grid min-h-[270px] w-full bg-white md:grid-cols-[235px_1fr]"><div className="flex flex-col justify-between bg-[#111827] p-6 text-white"><div><p className="font-mono text-[11.5px] font-black tracking-[0.18em] text-violet-300">A11Y AUDIT</p><p className="mt-3 text-[20px] font-black leading-tight">키보드·스크린리더 접근성 개선</p></div><div><p className="text-[42px] font-black leading-none text-violet-300">14 → 2</p><p className="mt-1 text-[11.5px] text-slate-400">핵심 시나리오 오류</p></div></div><div className="p-5"><div className="grid grid-cols-[1fr_70px] border-b border-slate-200 pb-2 text-[10.5px] font-black uppercase tracking-wider text-slate-400"><span>Audit item</span><span className="text-right">Status</span></div>{audits.map(([label, status], index) => <div key={label} className="grid grid-cols-[24px_1fr_70px] items-center border-b border-slate-100 py-3"><span className="font-mono text-[10.5px] font-black text-violet-500">0{index + 1}</span><span className="text-[12px] font-bold text-slate-700">{label}</span><span className="text-right text-[10.5px] font-black text-emerald-600">{status}</span></div>)}<p className="mt-3 text-[11.5px] text-slate-400">7개 PR · Storybook interaction 18개 · axe 자동 검사</p></div></div>
      );
    }

    if (variant === 'automation-flow') {
      const stages = [['EVENT', '행사 일정'], ['QUEUE', '예약 작업'], ['FUNCTION', '멱등 발송'], ['MONITOR', '실패 추적']];
      return (
        <div className="min-h-[270px] w-full bg-[#eef6ff] p-6"><div className="flex items-end justify-between"><div><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-blue-600">Serverless operation</p><p className="mt-1 text-[21px] font-black text-slate-900">알림 자동화 실행 흐름</p></div><p className="text-right text-[11.5px] text-slate-500">운영 3시간 → <b className="text-blue-700">50분</b></p></div><div className="mt-8 grid grid-cols-4 gap-3">{stages.map(([en, ko], index) => <div key={en} className="relative rounded-xl border border-blue-100 bg-white px-3 py-4 text-center shadow-sm">{index < stages.length - 1 && <span className="absolute -right-3 top-1/2 z-[1] -translate-y-1/2 text-[16px] font-black text-blue-300">→</span>}<span className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 font-mono text-[11.5px] font-black text-blue-700">0{index + 1}</span><p className="mt-2 font-mono text-[8px] font-black text-blue-400">{en}</p><p className="mt-1 text-[12px] font-extrabold text-slate-800">{ko}</p></div>)}</div><div className="mt-5 flex gap-2">{commitTypes.map((item, index) => <div key={index} className="flex-1 rounded-lg bg-blue-900 px-3 py-2 text-white"><span className="text-[10.5px] text-blue-200">{item.type}</span><b className="float-right text-[12px]">{item.count}</b></div>)}</div></div>
      );
    }

    return (
      <div className="grid min-h-[270px] w-full bg-[#0d1117] text-white md:grid-cols-[260px_1fr]">
        <div className="flex flex-col justify-between border-b border-[#30363d] p-6 md:border-b-0 md:border-r">
          <div>
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.2em] text-[#7d8590]">Git contribution</p>
            <p className="mt-3 break-words text-[17px] font-black leading-tight">{stats.repoName || 'PROJECT REPOSITORY'}</p>
          </div>
          <div className="mt-6 flex items-end gap-5">
            <div><p className="text-[38px] font-black leading-none text-[#58a6ff]">{stats.contributionPct || 0}%</p><p className="mt-1 text-[11.5px] text-[#8b949e]">기여 비중</p></div>
            <div><p className="text-[22px] font-extrabold leading-none">{stats.myCommits || 0}<span className="text-[12px] text-[#8b949e]"> / {stats.totalCommits || 0}</span></p><p className="mt-1 text-[11.5px] text-[#8b949e]">내 커밋 / 전체</p></div>
          </div>
        </div>
        <div className="min-w-0 p-5 font-mono">
          <div className="mb-3 flex items-center gap-2 text-[11.5px] text-[#8b949e]"><span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" /><span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" /><span className="ml-2 truncate">{snippet.file || 'src/main.ts'}</span><span className="ml-auto rounded bg-[#1f6f3f]/40 px-2 py-0.5 font-bold text-[#56d364]">DIFF</span></div>
          <div className="overflow-hidden rounded-md border border-[#30363d] bg-[#161b22] py-2 text-[12px] leading-[1.7]">
            {codeLines.map((line, index) => {
              const added = line.startsWith('+');
              const removed = line.startsWith('-');
              return <div key={index} className={`flex gap-2 px-3 ${added ? 'bg-[#238636]/20 text-[#aff5b4]' : removed ? 'bg-[#da3633]/20 text-[#ffdcd7]' : 'text-[#c9d1d9]'}`}><span className="w-4 select-none text-right text-[#484f58]">{index + 1}</span><span className="whitespace-pre">{line}</span></div>;
            })}
          </div>
          <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-[#8b949e]">{experience.core_impact}</p>
        </div>
      </div>
    );
  }

  if (jobCategory === 'pm') {
    const timeline = (structured.pmTimeline?.items || []).slice(0, 4);
    const metrics = (structured.portfolioVisuals?.kpis || []).slice(0, 3);
    const hypothesis = structured.pmHypotheses?.[0] || {};
    const product = structured.product || {};

    if (variant === 'experiment-board') {
      return (
        <div className="grid min-h-[270px] w-full bg-[#f4f1ff] p-6 md:grid-cols-[1fr_280px]"><div><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-violet-600">Experiment design</p><p className="mt-1 text-[21px] font-black text-slate-900">가설 검증 보드</p><div className="mt-5 rounded-xl border border-violet-200 bg-white p-4"><span className="rounded bg-violet-100 px-2 py-1 text-[10.5px] font-black text-violet-700">H1</span><p className="mt-3 text-[13px] font-bold leading-relaxed text-slate-800">{hypothesis.hypothesis}</p><div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-lg bg-slate-50 p-3 text-center"><div><p className="text-[8px] text-slate-400">KPI</p><p className="mt-1 text-[11.5px] font-black">{hypothesis.kpi}</p></div><div><p className="text-[8px] text-slate-400">TARGET</p><p className="mt-1 text-[12px] font-black">{hypothesis.target}</p></div><div><p className="text-[8px] text-slate-400">ACTUAL</p><p className="mt-1 text-[12px] font-black text-emerald-600">{hypothesis.achievement}</p></div></div></div></div><div className="mt-5 flex flex-col justify-center gap-3 md:mt-0">{['가설 정의', '2주 MVP', 'A/B 테스트', '전체 적용'].map((step, index) => <div key={step} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${index === 3 ? 'bg-emerald-600 text-white' : 'border border-violet-200 bg-white text-slate-700'}`}><span className="font-mono text-[10.5px] font-black">0{index + 1}</span><span className="text-[12px] font-bold">{step}</span></div>)}</div></div>
      );
    }

    if (variant === 'discovery-map') {
      return (
        <div className="min-h-[270px] w-full bg-[#0d172a] p-6 text-white"><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-[#d6ff45]">Discovery evidence map</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_170px]"><div className="rotate-[-1deg] rounded-sm bg-[#ffe978] p-4 text-slate-900 shadow-lg"><p className="text-[8px] font-black text-amber-700">OBSERVED PROBLEM</p><p className="mt-3 line-clamp-4 text-[12px] font-bold leading-relaxed">{product.problem}</p></div><div className="rotate-[1deg] rounded-sm bg-[#a7f3d0] p-4 text-slate-900 shadow-lg"><p className="text-[8px] font-black text-emerald-700">DESIGN RESPONSE</p><p className="mt-3 line-clamp-4 text-[12px] font-bold leading-relaxed">{product.solution}</p></div><div className="flex flex-col justify-between rounded-xl border border-white/15 bg-white/5 p-4"><p className="text-[10.5px] font-bold text-slate-400">USABILITY TEST</p><p className="text-[35px] font-black leading-none text-[#d6ff45]">{metrics[0]?.value}</p><p className="text-[10.5px] leading-relaxed text-slate-400">목표 {metrics[0]?.target}<br />사용자 근거로 콘셉트 수정</p></div></div></div>
      );
    }

    if (variant === 'service-blueprint') {
      const lanes = [['사용자 행동', 'bg-blue-50 text-blue-800'], ['화면·정책', 'bg-violet-50 text-violet-800'], ['운영 대응', 'bg-amber-50 text-amber-800']];
      return (
        <div className="min-h-[270px] w-full bg-white p-5"><div className="flex items-end justify-between"><div><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-blue-600">Service blueprint</p><p className="mt-1 text-[20px] font-black text-slate-900">예약 경험과 운영 정책 연결</p></div><span className="text-[10.5px] font-bold text-slate-400">FRONTSTAGE / BACKSTAGE</span></div><div className="mt-4 overflow-hidden rounded-xl border border-slate-200"><div className="grid grid-cols-[92px_repeat(4,1fr)] bg-slate-900 text-white">{['구분', ...timeline.map(item => item.label)].map(label => <div key={label} className="truncate border-r border-white/10 px-2 py-2 text-center text-[8px] font-bold">{label}</div>)}</div>{lanes.map(([label, color], laneIndex) => <div key={label} className="grid grid-cols-[92px_repeat(4,1fr)] border-t border-slate-200"><div className="flex items-center px-2 text-[10.5px] font-black text-slate-500">{label}</div>{timeline.map((item, index) => <div key={index} className="border-l border-slate-100 p-1.5"><div className={`min-h-[42px] rounded p-2 text-[8.5px] font-semibold leading-snug ${color}`}>{laneIndex === 0 ? item.value : laneIndex === 1 ? `${item.phase} 기준 정의` : `${index + 1}단계 예외 대응`}</div></div>)}</div>)}</div></div>
      );
    }

    if (variant === 'policy-system') {
      const nodes = ['문의 접수', '셀프 진단', '정책 판정', '관리자 보정', '월간 개선'];
      return (
        <div className="grid min-h-[270px] w-full bg-[#f6f8f4] p-6 md:grid-cols-[1fr_240px]"><div><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-emerald-700">Operation policy system</p><p className="mt-1 text-[21px] font-black text-slate-900">VOC가 제품 개선으로 이어지는 구조</p><div className="mt-6 flex items-center">{nodes.map((node, index) => <div key={node} className="flex min-w-0 flex-1 items-center"><div className={`min-w-0 flex-1 rounded-lg px-2 py-3 text-center text-[10.5px] font-black ${index === 2 ? 'bg-emerald-700 text-white' : 'border border-emerald-200 bg-white text-slate-700'}`}>{node}</div>{index < nodes.length - 1 && <span className="px-1 text-emerald-400">›</span>}</div>)}</div><p className="mt-5 max-w-2xl text-[11.5px] leading-relaxed text-slate-500">{hypothesis.note}</p></div><div className="mt-5 grid gap-2 md:ml-5 md:mt-0">{metrics.map((metric, index) => <div key={index} className="rounded-lg border border-emerald-100 bg-white px-3 py-2.5"><p className="text-[8px] font-bold text-slate-400">{metric.label}</p><p className="mt-1 text-[17px] font-black text-emerald-700">{metric.value}</p><p className="text-[8px] text-slate-400">목표 {metric.target}</p></div>)}</div></div>
      );
    }

    return (
      <div className="min-h-[270px] w-full bg-[#f7f9fc] p-6">
        <div className="flex items-end justify-between gap-4">
          <div><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-primary-500">Product roadmap</p><p className="mt-1 text-[21px] font-black text-bluewood-900">근거에서 검증까지 이어지는 실행 로드맵</p></div>
          <p className="hidden text-[11.5px] text-bluewood-300 sm:block">DISCOVER → DEFINE → BUILD → VALIDATE</p>
        </div>
        <div className="relative mt-8 grid grid-cols-4 gap-2 before:absolute before:left-[8%] before:right-[8%] before:top-3 before:h-0.5 before:bg-primary-200">
          {timeline.map((item, index) => <div key={`${item.phase}-${index}`} className="relative min-w-0 pt-8"><span className="absolute left-1/2 top-0 z-[1] flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white text-[8px] font-black text-white" style={{ backgroundColor: item.color || '#002F6C' }}>{index + 1}</span><p className="truncate text-center font-mono text-[8px] font-bold tracking-wide text-primary-500">{item.phase}</p><p className="mt-1 text-center text-[12px] font-extrabold text-bluewood-900">{item.label}</p><p className="mt-1 line-clamp-2 text-center text-[10.5px] leading-relaxed text-bluewood-400">{item.value}</p></div>)}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">{metrics.map((metric, index) => <div key={index} className="rounded-lg border border-surface-200 bg-white px-3 py-2"><p className="truncate text-[10.5px] font-bold text-bluewood-300">{metric.label}</p><p className="mt-0.5 text-[15px] font-black text-bluewood-900">{metric.value}</p></div>)}</div>
      </div>
    );
  }

  if (jobCategory === 'marketer') {
    const metrics = (structured.marketerKit?.kpis || []).slice(0, 4);
    const funnel = (structured.portfolioVisuals?.funnel || []).slice(0, 4);
    const max = Math.max(1, ...funnel.map(item => Number(item.value) || 0));
    const campaign = structured.marketerKit?.funnel || {};

    if (variant === 'crm-journey') {
      const journey = [['01', '관심 콘텐츠', '행동 데이터로 세그먼트 분기'], ['02', '리마인드', '장바구니·교체 주기 개인화'], ['03', '혜택 전환', '중복 접촉 제외 후 발송']];
      return (
        <div className="min-h-[270px] w-full bg-[#eaf4e8] p-6"><div className="flex items-end justify-between"><div><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-[#17452e]">Automated crm journey</p><p className="mt-1 text-[21px] font-black text-[#173c2a]">행동 기반 3단계 리텐션</p></div><span className="rounded-full bg-[#17452e] px-3 py-1 text-[10.5px] font-black text-[#dff06a]">5 SEGMENTS</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{journey.map(([num, title, desc], index) => <div key={num} className="relative rounded-xl bg-[#17452e] p-4 text-white">{index < 2 && <span className="absolute -right-3 top-1/2 z-[1] -translate-y-1/2 text-[18px] font-black text-[#6f927d]">→</span>}<span className="font-mono text-[11.5px] font-black text-[#dff06a]">{num}</span><p className="mt-4 text-[13px] font-black">{title}</p><p className="mt-1 text-[10.5px] leading-relaxed text-[#b7cbbd]">{desc}</p></div>)}</div><div className="mt-4 flex gap-2">{metrics.slice(0, 2).map((metric, index) => <div key={index} className="flex-1 rounded-lg bg-white/70 px-3 py-2"><span className="text-[10.5px] font-bold text-[#52705e]">{metric.name}</span><b className="float-right text-[15px] text-[#17452e]">{metric.value}</b></div>)}</div></div>
      );
    }

    if (variant === 'content-scoreboard') {
      return (
        <div className="grid min-h-[270px] w-full bg-[#ed503c] p-6 text-white md:grid-cols-[230px_1fr]"><div className="flex flex-col justify-between"><div><p className="font-mono text-[11.5px] font-black tracking-[0.2em] text-[#ffd36d]">CONTENT SCOREBOARD</p><p className="mt-3 text-[25px] font-black leading-tight">48편의 실험을<br />채널 성장으로</p></div><p className="text-[11.5px] leading-relaxed text-white/70">조회보다 저장·프로필 방문을<br />핵심 편성 지표로 관리</p></div><div className="grid grid-cols-2 gap-2">{metrics.map((metric, index) => <div key={index} className={`${index === 0 ? 'col-span-2' : ''} rounded-xl bg-[#fff5d8] px-4 py-3 text-[#2a201b]`}><div className="flex items-start justify-between"><p className="text-[10.5px] font-black text-[#a04736]">0{index + 1} · {metric.name}</p><span className="text-[8px] font-bold text-[#d5583f]">TOP KPI</span></div><p className={`${index === 0 ? 'text-[32px]' : 'text-[21px]'} mt-1 font-black`}>{metric.value}</p></div>)}</div></div>
      );
    }

    if (variant === 'paid-funnel') {
      return (
        <div className="grid min-h-[270px] w-full bg-[#101827] p-6 text-white md:grid-cols-[1fr_250px]"><div><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-cyan-300">Acquisition funnel</p><p className="mt-1 text-[21px] font-black">광고 클릭부터 첫 예산 등록까지</p><div className="mt-5 space-y-2">{funnel.map((item, index) => { const width = 100 - index * 15; return <div key={index} className="mx-auto flex h-9 items-center justify-between rounded px-3 text-[11.5px] font-bold" style={{ width: `${width}%`, backgroundColor: `rgba(34,211,238,${.22 + index * .18})` }}><span>{item.label}</span><span className="font-black tabular-nums">{Number(item.value).toLocaleString()}</span></div>; })}</div></div><div className="mt-5 flex flex-col justify-center gap-3 md:ml-5 md:mt-0">{metrics.slice(0, 3).map((metric, index) => <div key={index} className="border-l-2 border-cyan-300 pl-3"><p className="text-[10.5px] text-slate-400">{metric.name}</p><p className="mt-0.5 text-[20px] font-black text-cyan-200">{metric.value}</p><p className="text-[8px] text-slate-500">{metric.status}</p></div>)}</div></div>
      );
    }

    if (variant === 'growth-report') {
      const points = '20,120 90,104 160,110 230,72 300,80 370,42 440,28';
      return (
        <div className="grid min-h-[270px] w-full bg-[#fffdf8] p-6 md:grid-cols-[1fr_230px]"><div><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-[#7c3aed]">Audience growth report</p><p className="mt-1 text-[21px] font-black text-slate-900">구독과 추천이 만든 성장 곡선</p><div className="mt-5 rounded-xl border border-violet-100 bg-white p-3"><svg viewBox="0 0 460 140" className="h-[120px] w-full" aria-label="구독자 성장 추이"><defs><linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8b5cf6" stopOpacity=".28" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient></defs><path d={`M ${points} L 440 135 L 20 135 Z`} fill="url(#growthFill)" /><polyline points={points} fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />{points.split(' ').map((point, index) => { const [cx, cy] = point.split(','); return <circle key={index} cx={cx} cy={cy} r="5" fill="white" stroke="#7c3aed" strokeWidth="3" />; })}</svg><div className="flex justify-between text-[8px] font-bold text-slate-400"><span>APR</span><span>JUN</span><span>AUG</span><span>OCT</span><span>DEC</span></div></div></div><div className="mt-5 grid content-center gap-2 md:ml-4 md:mt-0">{metrics.map((metric, index) => <div key={index} className="rounded-lg border border-violet-100 bg-white px-3 py-2"><span className="text-[8px] font-bold text-slate-400">{metric.name}</span><b className="float-right text-[14px] text-violet-700">{metric.value}</b></div>)}</div></div>
      );
    }

    return (
      <div className="grid min-h-[270px] w-full gap-5 bg-[#fffaf5] p-6 md:grid-cols-[1.15fr_.85fr]">
        <div><p className="font-mono text-[11.5px] font-black uppercase tracking-[0.2em] text-[#e94e35]">Campaign performance</p><p className="mt-1 text-[21px] font-black text-[#202020]">핵심 KPI 대시보드</p><div className="mt-5 grid grid-cols-2 gap-2">{metrics.map((metric, index) => <div key={index} className="rounded-xl border border-[#efd8ce] bg-white px-3.5 py-3"><p className="truncate text-[10.5px] font-bold uppercase tracking-wide text-[#a56f62]">{metric.name}</p><p className="mt-1 text-[19px] font-black text-[#202020]">{metric.value}</p><p className="mt-0.5 truncate text-[10.5px] font-semibold text-[#e94e35]">{metric.status}</p></div>)}</div></div>
        <div className="rounded-xl border border-[#efd8ce] bg-white p-4"><p className="text-[12px] font-black text-[#202020]">전환 퍼널</p><div className="mt-4 space-y-3">{funnel.map((item, index) => <div key={index}><div className="mb-1 flex justify-between text-[10.5px]"><span className="font-bold text-[#6f5a54]">{item.label}</span><span className="font-black tabular-nums text-[#202020]">{Number(item.value).toLocaleString()}{item.unit || ''}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f7e9e3]"><div className="h-full rounded-full bg-[#e94e35]" style={{ width: `${Math.max(8, Math.round((Number(item.value) / max) * 100))}%` }} /></div></div>)}</div></div>
      </div>
    );
  }

  return null;
}

function PaletteGroup({ title, icon, open, onToggle, children }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[12px] font-bold text-gray-600 hover:bg-white"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {icon}
          <span className="truncate">{title}</span>
        </span>
        {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
      </button>
      {open && <div className="mt-1.5 space-y-1">{children}</div>}
    </div>
  );
}

function setPaletteDragPayload(event, payload) {
  const json = JSON.stringify(payload);
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(CUSTOM_PALETTE_DRAG_TYPE, json);
  event.dataTransfer.setData('application/json', json);
  event.dataTransfer.setData('text/plain', `fitpoly-palette:${json}`);
}

const QUICK_MENU_PANEL_WIDTH = 224;

function QuickMenu({ headings, activeId, onSelect, anchorRef, scrollRootRef }) {
  const [position, setPosition] = useState({ left: -9999, top: -9999 });

  useEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef?.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const gap = 16;
      // 본문 컬럼 오른쪽 여백(거터)에 두되, 패널이 오른쪽으로 펼쳐질 공간을 확보해
      // 본문을 가리지 않도록 left를 (뷰포트 우측 - 패널 너비) 안쪽으로 제한한다.
      const left = Math.min(rect.right + gap, window.innerWidth - QUICK_MENU_PANEL_WIDTH - 16);
      setPosition({
        left: Math.max(16, left),
        top: Math.max(96, Math.min(rect.top + 120, window.innerHeight - 360)),
      });
    };

    updatePosition();
    const root = scrollRootRef?.current;
    root?.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);
    return () => {
      root?.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef, scrollRootRef]);

  return (
    <aside
      data-tour="project-detail-quick-menu"
      className="group/quick fixed z-[360] hidden lg:block"
      style={position}
    >
      {/* 접힘: 선 핸들 — 펼칠 때는 사라지고 그 자리에서 목차가 펼쳐진다 */}
      <button
        type="button"
        className="flex h-[78px] w-[34px] flex-col items-center justify-center gap-2.5 rounded-xl border border-transparent opacity-55 transition-opacity duration-200 hover:opacity-100 group-hover/quick:opacity-0 group-focus-within/quick:opacity-0"
        aria-label="Quick Menu 열기"
      >
        <span className="h-[3px] w-[20px] rounded-full bg-primary-500 shadow-[0_0_8px_rgba(0,47,108,0.18)]" />
        <span className="h-[3px] w-[20px] rounded-full bg-bluewood-300/75" />
        <span className="h-[3px] w-[20px] rounded-full bg-bluewood-300/75" />
      </button>

      {/* 펼침: 핸들 자리(좌상단)에서 오른쪽·아래로 펼쳐진다 */}
      <div
        className="pointer-events-none absolute left-0 top-0 -translate-y-1 opacity-0 transition-all duration-200 group-hover/quick:pointer-events-auto group-hover/quick:translate-y-0 group-hover/quick:opacity-100 group-focus-within/quick:pointer-events-auto group-focus-within/quick:translate-y-0 group-focus-within/quick:opacity-100"
        style={{ width: QUICK_MENU_PANEL_WIDTH }}
      >
        <div className="rounded-2xl border border-surface-200 bg-white/98 p-3 shadow-card-hover backdrop-blur">
          <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11.5px] font-black uppercase tracking-[0.18em] text-bluewood-300">
            <List size={12} /> Quick
          </div>
          {headings.length === 0 ? (
            <p className="px-1 py-1 text-[12px] leading-relaxed text-bluewood-300">제목 블록을 추가하면 목차가 생깁니다.</p>
          ) : (
            <div className="max-h-[300px] space-y-0.5 overflow-y-auto pr-1">
              {headings.map(item => {
                const active = activeId === item.id;
                const indent = item.level === 1 ? '' : item.level === 2 ? 'pl-3' : 'pl-6';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-[12px] font-semibold transition-colors ${indent} ${
                      active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-bluewood-500 hover:bg-surface-50 hover:text-bluewood-800'
                    }`}
                    title={item.text}
                  >
                    {item.text}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function ProjectDetailModal({
  exp,
  readOnly = false,
  onUpdate,
  onClose,
  jobAnalysis,
  resizeToBase64,
  genericMode = false,
}) {
  const structured = exp?.structuredResult || {};
  const overview = structured.projectOverview || {};
  const { ref: panelRef, backdropProps } = useModalBehavior(true, () => onClose?.());

  // ── Firestore 섹션 이미지 로드 (마이그레이션 보존용) ──
  const [allImages, setAllImages] = useState([]);
  const [sectionImages, setSectionImages] = useState({});
  const [imageConfig, setImageConfig] = useState({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  useEffect(() => {
    const expId = exp?.experienceId;
    if (!expId) { setImagesLoaded(true); return; }
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'experiences', expId));
        if (snap.exists() && alive) {
          const data = snap.data();
          setAllImages(data.images || []);
          setSectionImages(data.sectionImages || {});
          setImageConfig(data.imageConfig || {});
        }
      } catch { /* 이미지 로드 실패는 무시 */ }
      if (alive) setImagesLoaded(true);
    })();
    return () => { alive = false; };
  }, [exp?.experienceId]);

  // ── 캔버스 초기 문서: 편집 모드는 저장 문서가 없으면 빈 페이지, 읽기 전용은 기존 섹션을 자동 변환 ──
  const hasSavedDoc = exp?.notionDoc && Object.keys(exp.notionDoc).length > 0;
  const initialDoc = useMemo(() => {
    if (hasSavedDoc) return exp.notionDoc;
    if (!imagesLoaded) return null;
    if (!readOnly) return emptyNotionDoc();
    return buildNotionDocFromExperience(exp, { allImages, sectionImages, imageConfig });
  }, [hasSavedDoc, readOnly, exp, imagesLoaded, allImages, sectionImages, imageConfig]);

  const docValueRef = useRef(initialDoc);
  const [headings, setHeadings] = useState([]);
  const [activeHeadingId, setActiveHeadingId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState({ core: true, sections: true, keyexp: true });
  const [docIsEmpty, setDocIsEmpty] = useState(true);
  useEffect(() => {
    if (!initialDoc) return;
    docValueRef.current = initialDoc;
    setHeadings(extractHeadingsFromDoc(initialDoc));
    setDocIsEmpty(!docHasMeaningfulContent(initialDoc));
  }, [initialDoc]);
  const canvasRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const documentColumnRef = useRef(null);
  const coverInputRef = useRef(null);
  const tutorialRef = useRef(null);
  const tutorial = useOnboarding(!readOnly ? 'project_detail_canvas' : null);

  // ── 직군 핵심 경험 시각화 — 새로 만드는 구성(저장 문서 없음)은 기본 표시, 기존 저장본은 기존 모습 유지 ──
  const [showJobCore, setShowJobCore] = useState(() => {
    const flag = structured.exportConfig?.jobCoreShowcase;
    return flag != null ? flag !== false : !hasSavedDoc;
  });
  const setJobCoreVisible = (visible) => {
    setShowJobCore(visible);
    onUpdate?.({
      structuredResult: {
        ...structured,
        exportConfig: { ...(structured.exportConfig || {}), jobCoreShowcase: visible },
      },
    });
  };

  const handleDocChange = (nextDoc) => {
    docValueRef.current = nextDoc;
    setHeadings(extractHeadingsFromDoc(nextDoc));
    setDocIsEmpty(!docHasMeaningfulContent(nextDoc));
    const changes = { notionDoc: nextDoc };
    // 표시 여부가 아직 저장된 적 없으면 첫 편집 때 현재 상태를 함께 저장 — 다음에 열어도 유지
    if (structured.exportConfig?.jobCoreShowcase == null) {
      changes.structuredResult = {
        ...structured,
        exportConfig: { ...(structured.exportConfig || {}), jobCoreShowcase: showJobCore },
      };
    }
    onUpdate?.(changes);
  };

  // 폴백 전용 — AI 구성이 실패했을 때만 쓰는 결정론적 조립
  const replaceCanvasWithDraft = (skipConfirm = false) => {
    if (!skipConfirm && !docIsEmpty) { setPendingReplace('draft'); return; }
    applyDraftToCanvas();
  };

  const applyDraftToCanvas = () => {
    const blocks = experienceDraftBlocks(exp, { allImages, sectionImages, imageConfig });
    const nextDoc = blocksToYooptaValue(blocks);
    canvasRef.current?.replaceBlocks(blocks);
    docValueRef.current = nextDoc;
    setHeadings(extractHeadingsFromDoc(nextDoc));
    setDocIsEmpty(!docHasMeaningfulContent(nextDoc));
    onUpdate?.({ notionDoc: nextDoc });
    setDocIsEmpty(!docHasMeaningfulContent(nextDoc));
  };

  // ── 맞춤 구성 ──
  // 고정 순서로 조립하던 초안과 달리, 경험·직군·경력단계·기업분석을 종합해
  // AI가 만든 구성 계획(섹션 선택·순서·제목)에 따라 조립한다.
  const [composing, setComposing] = useState(false);
  const [composePlan, setComposePlan] = useState(null);
  // 캔버스 교체 확인 — 브라우저 confirm 대신 브랜드 다이얼로그 사용
  const [pendingReplace, setPendingReplace] = useState(null);   // 'draft' | 'compose' | null

  const composeCanvas = async () => {
    if (!docIsEmpty) { setPendingReplace('compose'); return; }
    await runComposeCanvas();
  };

  const runComposeCanvas = async () => {
    setComposing(true);
    try {
      const sr = exp?.structuredResult || {};
      const { data: plan } = await api.post('/job/compose-experience', {
        experience: {
          title: exp?.title || '',
          projectOverview: sr.projectOverview || {},
          product: sr.product || null,
          jobSpecific: sr.jobSpecific || {},
          keyExperiences: (sr.keyExperiences || []).map(ke => ({
            title: ke?.title, metric: ke?.metric, context: ke?.context, action: ke?.action,
            result: ke?.result, learning: ke?.learning, keywords: ke?.keywords,
            jobData: ke?.jobData || null,
            hasDecisionTrace: !!ke?.decisionTrace, hasEvidence: !!(ke?.evidenceBundle?.length),
            hasHonestReview: !!ke?.honestReview, hasVoice: !!ke?.voiceRecord?.originalQuote,
          })),
          hasGithub: !!sr.githubStats?.myCommits,
          hasLeanCanvas: !!sr.leanCanvas,
          hasMarketerKit: !!sr.marketerKit,
          hasVisuals: !!sr.portfolioVisuals,
        },
        jobCategory: exp?.jobCategory || sr.jobCategory || 'common',
        careerStage: exp?.careerStage || 'first',
        jobAnalysis: jobAnalysis || null,
      });
      const blocks = composeDraftBlocks(exp, { allImages, sectionImages, imageConfig }, plan);
      const nextDoc = blocksToYooptaValue(blocks);
      canvasRef.current?.replaceBlocks(blocks);
      docValueRef.current = nextDoc;
      setHeadings(extractHeadingsFromDoc(nextDoc));
      setDocIsEmpty(!docHasMeaningfulContent(nextDoc));
      setComposePlan(plan);
      // 히어로 아티팩트 변형을 structuredResult에 반영 — JobArtifactCover/JobCoreShowcase가 이 값으로 렌더한다.
      // (지금까지 이 값을 채우는 곳이 없어 실사용자는 전부 기본 변형만 보고 있었다)
      const changes = { notionDoc: nextDoc, compositionPlan: plan };
      if (plan?.artifactVariant || plan?.artifactRecipe) {
        changes.structuredResult = {
          ...sr,
          exportConfig: {
            ...(sr.exportConfig || {}),
            ...(plan.artifactVariant ? { artifactCoverVariant: plan.artifactVariant } : {}),
            ...(plan.artifactRecipe ? { artifactRecipe: plan.artifactRecipe } : {}),
          },
        };
      }
      onUpdate?.(changes);
      toast.success(plan?._fallback
        ? '기본 구성으로 배치했습니다 (AI 구성 실패)'
        : `${jobAnalysis?.company ? `${jobAnalysis.company} 맞춤 ` : ''}구성으로 배치했습니다`);
    } catch (err) {
      // AI 구성 실패 시에도 사용자를 막지 않는다 — 결정론적 초안으로 폴백
      console.warn('[Compose] 실패, 기본 초안으로 폴백:', err?.message);
      replaceCanvasWithDraft(true);
      toast.error(err.response?.data?.error || 'AI 구성에 실패해 기본 초안으로 만들었습니다');
    }
    setComposing(false);
  };

  const uploadCoverImage = async (file) => {
    if (!file) return;
    if (!resizeToBase64) {
      toast.error('이미지 업로드를 사용할 수 없습니다');
      return;
    }
    try {
      const url = await resizeToBase64(file, 1400, 0.84);
      onUpdate?.({
        thumbnailUrl: url,
        structuredResult: {
          ...structured,
          exportConfig: { ...(structured.exportConfig || {}), coverImg: url },
        },
      });
      toast.success('커버 사진을 설정했습니다');
    } catch {
      toast.error('이미지 처리에 실패했습니다');
    }
  };

  const removeCoverImage = () => {
    onUpdate?.({
      thumbnailUrl: '',
      structuredResult: {
        ...structured,
        exportConfig: { ...(structured.exportConfig || {}), coverImg: null },
      },
    });
  };

  const scrollToHeading = (id) => {
    if (!id) return;
    setActiveHeadingId(id);
    const target = document.querySelector(`[data-yoopta-block-id="${id}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  };

  const togglePalette = (key) => {
    setPaletteOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── 메타(속성) 인라인 편집 ──
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState(null);
  const openMetaEdit = () => {
    setMetaDraft({
      title: exp?.title || '',
      date: exp?.date || overview.duration || '',
      role: exp?.role || overview.role || '',
      skills: (exp?.skills || []).join(', '),
      keywords: (exp?.keywords || []).map(k => (typeof k === 'string' ? k : k?.name || k?.keyword || '')).join(', '),
      goal: overview.goal || '',
      description: exp?.description || overview.background || overview.summary || '',
      link: exp?.link || '',
      thumbnailUrl: exp?.thumbnailUrl || '',
    });
    setEditingMeta(true);
  };
  const saveMetaEdit = () => {
    if (!metaDraft) return;
    const skills = metaDraft.skills.split(',').map(s => s.trim()).filter(Boolean);
    const keywords = metaDraft.keywords.split(',').map(s => s.trim()).filter(Boolean);
    onUpdate?.({
      title: metaDraft.title,
      date: metaDraft.date,
      role: metaDraft.role,
      skills,
      keywords,
      description: metaDraft.description,
      link: metaDraft.link,
      thumbnailUrl: metaDraft.thumbnailUrl,
      structuredResult: {
        ...structured,
        projectOverview: { ...overview, duration: metaDraft.date, role: metaDraft.role, goal: metaDraft.goal },
      },
    });
    setEditingMeta(false);
  };

  // ── AI 첨삭 ──
  const [tailorOpen, setTailorOpen] = useState(false);
  const [tailorResult, setTailorResult] = useState(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState(null);
  const [appliedSections, setAppliedSections] = useState({});

  const runTailor = async () => {
    if (!jobAnalysis) return;
    setTailoring(true);
    setTailorError(null);
    setAppliedSections({});
    try {
      const sections = extractSectionsFromDoc(docValueRef.current)
        .map((s, i) => ({ key: s.key || `section-${i}`, title: s.label, content: s.content }))
        .filter(s => s.content.trim());
      if (sections.length === 0) {
        setTailorResult({ sections: [], overallNote: '첨삭할 본문 내용이 없습니다.' });
        setTailoring(false);
        return;
      }
      const { data } = await api.post('/job/tailor-portfolio', { jobAnalysis, sections });
      setTailorResult({
        ...data,
        portfolioSections: (data.sections || []).map(item => ({
          ...item,
          label: sections[item.index]?.title,
        })),
      });
    } catch (err) {
      setTailorError(err.response?.data?.error || 'AI 첨삭에 실패했습니다');
    }
    setTailoring(false);
  };

  const openTailor = () => {
    if (tailorOpen) { setTailorOpen(false); return; }
    setTailorOpen(true);
    setTailorResult(null);
    setTailorError(null);
    runTailor();
  };

  const applyTailoredSection = (idx, label, content) => {
    if (!content?.trim()) return;
    canvasRef.current?.insertBlocks(tailoredToBlocks(label, content));
    setAppliedSections(prev => ({ ...prev, [idx]: true }));
  };
  const applyAllTailored = () => {
    const list = (tailorResult?.portfolioSections || []).filter(s => s.tailoredContent?.trim());
    list.forEach((s, i) => canvasRef.current?.insertBlocks(tailoredToBlocks(s.label, s.tailoredContent)));
    setAppliedSections(Object.fromEntries(list.map((_, i) => [i, true])));
  };

  // ── 팔레트 드래그 → 블록 변환 (작성된 섹션/핵심 경험을 캔버스에 재활용) ──
  const resolvePaletteBlocks = (payload) => {
    if (payload?.kind === 'section') return sectionPaletteBlocks(exp, payload.key, payload.label);
    if (payload?.kind === 'all-keyexperiences') return allKeyExperiencePaletteBlocks(exp);
    if (payload?.kind === 'keyexperience') return keyExperiencePaletteBlocks(exp, payload.index);
    return [];
  };

  const insertPalettePayload = (payload) => {
    const blocks = resolvePaletteBlocks(payload);
    if (!Array.isArray(blocks) || blocks.length === 0) {
      toast.error('추가할 내용이 없습니다');
      return;
    }
    if (docIsEmpty) {
      canvasRef.current?.replaceBlocks(blocks);
    } else {
      canvasRef.current?.insertBlocks(blocks);
    }
    toast.success('캔버스에 추가했습니다');
  };

  if (!exp) return null;

  const duration = overview.duration || exp.date || '';
  const role = overview.role || exp.role || '';
  const techStack = (overview.techStack?.length > 0 ? overview.techStack : null) || (exp.skills?.length > 0 ? exp.skills : null) || [];
  const keywords = exp.keywords || [];
  const goal = overview.goal || '';
  const coverImg = structured.exportConfig?.coverImg || exp.thumbnailUrl || null;
  const showArtifactCover = readOnly && structured.exportConfig?.artifactCover === true;
  const keyExps = (structured.keyExperiences || []).filter(Boolean);
  const description = exp.description || overview.background || overview.summary || '';
  const sectionTemplates = getSectionTemplates(exp?.jobCategory || structured.exportConfig?.jobCategory);
  const renderedSections = buildRenderableSections(exp);
  const sectionContentMap = new Map(renderedSections.map(section => [section.key, section]));
  // 직군별 핵심 경험 페이지 파트 — 핵심 경험은 아래 전용 그룹이 있어 제외
  const coreSections = contentBearingCoreSections(exp).filter(section => section.key !== 'key-experiences');
  const tutorialSteps = [
    {
      selector: '[data-tour="project-detail-palette"]',
      title: '섹션을 끌어와 구성하세요',
      body: '왼쪽 섹션은 제목만이 아니라 경험 정리에서 이미 작성된 본문까지 함께 가져옵니다. 필요한 위치에 드래그해서 넣으면 됩니다.',
    },
    {
      selector: '[data-tour="project-detail-draft"]',
      title: '빈 화면이 부담되면 초안을 만드세요',
      body: '초안 만들기는 경험·직군·지원 기업을 함께 보고 넣을 섹션과 순서를 매번 새로 정합니다.',
      actionLabel: '초안 만들기',
      onAction: composeCanvas,
    },
    {
      selector: '[data-tour="project-detail-keyexp"]',
      title: '핵심 경험도 블록처럼 추가합니다',
      body: '전체 핵심 경험을 한 번에 넣거나, 특정 경험만 골라서 캔버스 중간에 배치할 수 있습니다.',
    },
    {
      selector: '[data-tour="project-detail-cover"]',
      title: '커버 사진을 설정하세요',
      body: '프로젝트의 첫인상을 보여주는 화면, 결과물, 구조도 이미지를 커버로 지정할 수 있습니다.',
    },
    {
      selector: '[data-tour="project-detail-image"]',
      title: '이미지는 자유롭게 붙여 넣습니다',
      body: '버튼으로 추가해도 되고, 캔버스 중간에 이미지를 붙여넣거나 드롭해도 됩니다.',
    },
    {
      selector: '[data-tour="project-detail-quick-menu"]',
      title: 'Quick Menu가 자동으로 따라옵니다',
      body: '캔버스에 제목 블록을 추가하면 오른쪽 목차가 자동 갱신되어 긴 문서에서도 바로 이동할 수 있습니다.',
    },
  ];

  const showPalette = !readOnly;
  const showTailorPanel = !readOnly && tailorOpen;
  const useWideDocument = !genericMode && showJobCore && hasJobCoreContent(exp);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-3"
      {...backdropProps}
    >
      <ConfirmDialog
        open={!!pendingReplace}
        title="현재 캔버스 내용을 교체할까요?"
        message={pendingReplace === 'compose'
          ? '지금 작성된 내용이 AI가 새로 구성한 초안으로 완전히 대체되고, 되돌릴 수 없어요.'
          : '지금 작성된 내용이 기본 초안으로 완전히 대체되고, 되돌릴 수 없어요.'}
        confirmLabel="교체"
        cancelLabel="그대로 두기"
        onCancel={() => setPendingReplace(null)}
        onConfirm={() => {
          const mode = pendingReplace;
          setPendingReplace(null);
          if (mode === 'compose') runComposeCanvas();
          else applyDraftToCanvas();
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="프로젝트 상세"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl flex flex-col h-[92vh] transition-all duration-300 outline-none"
        style={{ width: showTailorPanel ? 'min(1700px, calc(100vw - 24px))' : 'min(1400px, calc(100vw - 24px))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate max-w-[520px]">{exp.title || (genericMode ? '카드 상세' : '경험 상세')}</h3>
              {!readOnly && !genericMode && (
                <p className="mt-0.5 truncate text-[12.5px] text-bluewood-400">노션 포트폴리오에 들어갈 프로젝트 화면을 구성하는 곳이에요. 여기서 배치한 그대로 내보내집니다.</p>
              )}
            </div>
            {!readOnly && (
              <button
                onClick={() => (editingMeta ? setEditingMeta(false) : openMetaEdit())}
                className={`flex-shrink-0 px-3 py-1 rounded-md text-xs font-medium transition-all border ${editingMeta ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-primary-700 border-primary-200 hover:bg-primary-50'}`}
              >
                {editingMeta ? '닫기' : '정보 수정'}
              </button>
            )}
          </div>
          {/* 캔버스 액션을 헤더 한 줄로 모았다 (본문에 흩어져 있어 찾기 어려웠음).
              초안 만들기 = 새로 구성 / 다듬기 = 이미 쓴 본문을 공고에 맞게 첨삭 */}
          <div className="flex items-center gap-1.5">
            {!readOnly && !genericMode && (
              <>
                <button
                  data-tour="project-detail-draft"
                  onClick={composeCanvas}
                  disabled={composing}
                  title={jobAnalysis?.company
                    ? `${jobAnalysis.company} 공고에 맞춰 넣을 섹션과 순서를 새로 정합니다`
                    : '경험의 강점에 맞춰 넣을 섹션과 순서를 정합니다 (기업 분석을 연결하면 공고 맞춤)'}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-primary-700 disabled:opacity-50"
                >
                  {composing ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                  {composing ? '구성 중' : jobAnalysis?.company ? `${jobAnalysis.company} 맞춤 초안` : '초안 만들기'}
                </button>
                {jobAnalysis && (
                  <button
                    onClick={openTailor}
                    disabled={docIsEmpty}
                    title={docIsEmpty ? '먼저 초안을 만든 뒤 사용할 수 있어요' : '작성된 본문을 공고에 맞게 다듬습니다'}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 ${
                      tailorOpen ? 'bg-primary-700 text-white' : 'border border-primary-200 bg-white text-primary-700 hover:bg-primary-50'
                    }`}
                  >
                    <Sparkles size={13} /> 다듬기
                  </button>
                )}
                <button
                  data-tour="project-detail-image"
                  onClick={() => canvasRef.current?.openImagePicker()}
                  title="캔버스에 이미지 추가"
                  className="flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-bluewood-600 transition-all hover:border-primary-200 hover:bg-primary-50"
                >
                  <ImagePlus size={13} /> 이미지
                </button>
              </>
            )}
            <button onClick={onClose} className="ml-1 p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* ── 좌측 팔레트 ── */}
          {showPalette && (
            <div data-tour="project-detail-palette" className="w-[248px] flex-shrink-0 border-r border-gray-100 bg-[#fafaf8] overflow-y-auto p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[12px] font-black uppercase tracking-[0.16em] text-bluewood-300">Blocks</p>
                <button
                  type="button"
                  onClick={tutorial.show}
                  className="rounded-md px-2 py-1 text-[12px] font-bold text-primary-600 hover:bg-primary-50"
                >
                  도움말
                </button>
              </div>

              {coreSections.length > 0 && (
                <div className="mb-4">
                  <PaletteGroup
                    title="직군 핵심 경험"
                    icon={<Wand2 size={13} />}
                    open={paletteOpen.core}
                    onToggle={() => togglePalette('core')}
                  >
                    {coreSections.map(section => (
                      <div
                        key={section.key}
                        draggable
                        onDragStart={e => {
                          setPaletteDragPayload(e, { kind: 'section', key: section.key, label: section.label });
                        }}
                        onDoubleClick={() => insertPalettePayload({ kind: 'section', key: section.key, label: section.label })}
                        title="드래그하거나 더블클릭해 추가"
                        className="group flex items-center gap-1.5 rounded-md border border-primary-200 bg-white px-2 py-1.5 text-[13px] text-gray-700 cursor-grab active:cursor-grabbing hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                      >
                        <GripVertical size={12} className="text-primary-200 group-hover:text-primary-400" />
                        <span className="min-w-0 flex-1 truncate">{section.label}</span>
                        <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[11.5px] font-black text-primary-600">핵심</span>
                      </div>
                    ))}
                  </PaletteGroup>
                </div>
              )}

              <PaletteGroup
                title="섹션"
                icon={<FileText size={13} />}
                open={paletteOpen.sections}
                onToggle={() => togglePalette('sections')}
              >
                {sectionTemplates.map(tpl => {
                  const filled = !!sectionContentMap.get(tpl.key)?.content?.trim();
                  return (
                    <div
                      key={tpl.key}
                      draggable
                      onDragStart={e => {
                        setPaletteDragPayload(e, { kind: 'section', key: tpl.key, label: tpl.label });
                      }}
                      onDoubleClick={() => insertPalettePayload({ kind: 'section', key: tpl.key, label: tpl.label })}
                      title="드래그하거나 더블클릭해 추가"
                      className="group flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[13px] text-gray-700 cursor-grab active:cursor-grabbing hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                    >
                      <GripVertical size={12} className="text-gray-300 group-hover:text-primary-400" />
                      <span className="min-w-0 flex-1 truncate">{tpl.label}</span>
                      {filled && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11.5px] font-black text-emerald-600">작성됨</span>}
                    </div>
                  );
                })}
              </PaletteGroup>

              {keyExps.length > 0 && (
                <div data-tour="project-detail-keyexp" className="mt-4">
                  <PaletteGroup
                    title="핵심 경험"
                    icon={<Sparkles size={13} />}
                    open={paletteOpen.keyexp}
                    onToggle={() => togglePalette('keyexp')}
                  >
                    <div
                      draggable
                      onDragStart={e => {
                        setPaletteDragPayload(e, { kind: 'all-keyexperiences' });
                      }}
                      onDoubleClick={() => insertPalettePayload({ kind: 'all-keyexperiences' })}
                      title="드래그하거나 더블클릭해 추가"
                      className="group flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-2 py-1.5 text-[13px] font-bold text-primary-700 cursor-grab active:cursor-grabbing hover:bg-primary-100 transition-colors"
                    >
                      <GripVertical size={12} className="text-primary-300" />
                      <span className="min-w-0 flex-1 truncate">전체 핵심 경험</span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[11.5px] font-black text-primary-500">{keyExps.length}</span>
                    </div>
                    {keyExps.map((item, index) => (
                      <div
                        key={`${item.title || 'keyexp'}-${index}`}
                        draggable
                        onDragStart={e => {
                          setPaletteDragPayload(e, { kind: 'keyexperience', index });
                        }}
                        onDoubleClick={() => insertPalettePayload({ kind: 'keyexperience', index })}
                        title="드래그하거나 더블클릭해 추가"
                        className="group flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[13px] text-gray-700 cursor-grab active:cursor-grabbing hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                      >
                        <GripVertical size={12} className="text-gray-300 group-hover:text-primary-400" />
                        <span className="min-w-0 flex-1 truncate">{stripMd(item.title) || `핵심 경험 ${index + 1}`}</span>
                      </div>
                    ))}
                  </PaletteGroup>
                </div>
              )}

            </div>
          )}

          {/* ── 중앙: 속성 헤더 + 캔버스 + Quick Menu ── */}
          <div ref={scrollAreaRef} className="flex-1 min-w-0 overflow-y-auto bg-white">
            <div className="px-5 pb-12 pt-6">
              <div ref={documentColumnRef} className={`relative mx-auto w-full ${useWideDocument ? 'max-w-[1180px]' : 'max-w-3xl'}`}>
                <main data-tour="project-detail-canvas" className="min-w-0 w-full">
                  {(!readOnly || coverImg || showArtifactCover) && (
                    <div data-tour="project-detail-cover" className={`group relative mb-6 overflow-hidden rounded-lg border border-surface-200 bg-surface-50 ${showArtifactCover ? 'min-h-[270px]' : coverImg ? 'h-40' : 'h-24'}`}>
                      {showArtifactCover ? (
                        <JobArtifactCover exp={exp} />
                      ) : coverImg ? (
                        <img src={coverImg} alt="cover" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[13px] font-semibold text-bluewood-300">커버 사진</div>
                      )}
                      {!readOnly && (
                        <div className="absolute right-3 top-3 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => coverInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-md border border-white/70 bg-white/92 px-2.5 py-1.5 text-[12px] font-bold text-bluewood-700 shadow-sm backdrop-blur hover:bg-white"
                          >
                            <ImagePlus size={13} /> 커버 설정
                          </button>
                          {coverImg && (
                            <button
                              type="button"
                              onClick={removeCoverImage}
                              className="rounded-md border border-white/70 bg-white/92 px-2.5 py-1.5 text-[12px] font-bold text-red-500 shadow-sm backdrop-blur hover:bg-white"
                            >
                              제거
                            </button>
                          )}
                        </div>
                      )}
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={event => {
                          uploadCoverImage(event.target.files?.[0]);
                          event.target.value = '';
                        }}
                      />
                    </div>
                  )}
              {/* 메타 편집 폼 */}
              {editingMeta && metaDraft && (
                <div className="mb-6 bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">제목</label>
                    <input value={metaDraft.title} onChange={e => setMetaDraft(d => ({ ...d, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">기간</label>
                      <input value={metaDraft.date} onChange={e => setMetaDraft(d => ({ ...d, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '보조 정보' : '역할'}</label>
                      <input value={metaDraft.role} onChange={e => setMetaDraft(d => ({ ...d, role: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '태그 (쉼표로 구분)' : '기술 (쉼표로 구분)'}</label>
                    <input value={metaDraft.skills} onChange={e => setMetaDraft(d => ({ ...d, skills: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">키워드 (쉼표로 구분)</label>
                    <input value={metaDraft.keywords} onChange={e => setMetaDraft(d => ({ ...d, keywords: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '메모 / 한줄평' : '목표'}</label>
                    <textarea value={metaDraft.goal} onChange={e => setMetaDraft(d => ({ ...d, goal: e.target.value }))}
                      rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '상세 내용' : '간단한 소개'}</label>
                    <textarea value={metaDraft.description} onChange={e => setMetaDraft(d => ({ ...d, description: e.target.value }))}
                      rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">링크 (선택)</label>
                    <input value={metaDraft.link} onChange={e => setMetaDraft(d => ({ ...d, link: e.target.value }))} placeholder="https://"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">대표 이미지 (선택)</label>
                    <div className="flex items-center gap-3">
                      {metaDraft.thumbnailUrl && <img src={metaDraft.thumbnailUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />}
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                        <ImagePlus size={14} /> 이미지 선택
                        <input type="file" accept="image/*" className="hidden" onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file || !resizeToBase64) return;
                          try { const url = await resizeToBase64(file, 800, 0.8); setMetaDraft(d => ({ ...d, thumbnailUrl: url })); }
                          catch { toast.error('이미지 처리에 실패했습니다'); }
                        }} />
                      </label>
                      {metaDraft.thumbnailUrl && (
                        <button type="button" onClick={() => setMetaDraft(d => ({ ...d, thumbnailUrl: '' }))} className="text-xs text-gray-400 hover:text-red-500">이미지 제거</button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingMeta(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">취소</button>
                    <button onClick={saveMetaEdit} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">저장</button>
                  </div>
                </div>
              )}

              {/* 제목 (읽기전용에서만 표시 — 헤더에 이미 있지만 문서 느낌) */}
              {readOnly && (
                <h1 className="text-[28px] font-extrabold text-primary-600 leading-tight mb-5">{exp.title || '(제목 없음)'}</h1>
              )}

              {/* 속성 헤더 */}
              {(duration || role || techStack.length > 0 || keywords.length > 0 || goal || exp.link) && (
                <div className="space-y-2 border-b border-surface-100 pb-5 mb-6">
                  {duration && (
                    <div className="flex items-center gap-4"><span className="w-14 text-[14px] text-gray-400 flex-shrink-0">기간</span><span className="text-[15px] text-gray-700">{duration}</span></div>
                  )}
                  {role && (
                    <div className="flex items-start gap-4"><span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">역할</span><span className="text-[15px] text-gray-700 leading-relaxed">{role}</span></div>
                  )}
                  {techStack.length > 0 && (
                    <div className="flex items-start gap-4">
                      <span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">기술</span>
                      <div className="flex flex-wrap gap-1.5">{techStack.map((t, i) => <span key={i} className="px-2 py-0.5 bg-surface-100 text-gray-600 rounded text-[14px]">{typeof t === 'string' ? t : t?.name || ''}</span>)}</div>
                    </div>
                  )}
                  {keywords.length > 0 && (
                    <div className="flex items-start gap-4">
                      <span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">키워드</span>
                      <div className="flex flex-wrap gap-1.5">{keywords.slice(0, 6).map((kw, i) => <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-500 rounded text-[14px] font-medium">{typeof kw === 'string' ? kw : kw?.name || kw?.keyword || ''}</span>)}</div>
                    </div>
                  )}
                  {goal && (
                    <div className="flex items-start gap-4"><span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">목표</span><span className="text-[15px] text-gray-700 leading-relaxed">{goal}</span></div>
                  )}
                  {exp.link && (
                    <div className="flex items-center gap-4">
                      <span className="w-14 text-[14px] text-gray-400 flex-shrink-0">링크</span>
                      <a href={exp.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[15px] text-primary-600 hover:underline break-all"><ExternalLink size={12} /> {exp.link}</a>
                    </div>
                  )}
                </div>
              )}

              {/* 설명 */}
              {description && (
                <p className="text-sm text-gray-600 leading-relaxed bg-surface-50 rounded-xl p-4 mb-6">{description}</p>
              )}

              {/* 직군 핵심 경험 — 핵심 경험 페이지의 디자인 그대로 (새 구성은 기본 표시) */}
              {!genericMode && hasJobCoreContent(exp) && (showJobCore ? (
                <div className="mb-8">
                  <div className="flex items-center justify-between gap-3 border-b border-surface-100 pb-2 mb-4">
                    <h4 className="text-[14px] font-bold uppercase tracking-widest text-gray-400">직군별 핵심 산출물</h4>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setJobCoreVisible(false)}
                        className="rounded-md px-2 py-1 text-[12px] font-bold text-bluewood-300 hover:bg-surface-100 hover:text-bluewood-600 transition-colors"
                      >
                        숨기기
                      </button>
                    )}
                  </div>
                  <JobCoreShowcase
                    exp={exp}
                    readOnly={readOnly}
                    onChange={readOnly ? undefined : (nextStructuredResult) => onUpdate?.({
                      structuredResult: nextStructuredResult,
                    })}
                    onExperienceChange={readOnly ? undefined : (changes => onUpdate?.(changes))}
                  />
                </div>
              ) : (!readOnly && (
                <button
                  type="button"
                  onClick={() => setJobCoreVisible(true)}
                  className="mb-8 w-full rounded-xl border border-dashed border-primary-200 bg-primary-50/40 py-3 text-[12.5px] font-bold text-primary-600 hover:bg-primary-50 transition-colors"
                >
                  ＋ 직군 핵심 경험 화면 표시 (기여도·문제 해결 등 디자인 그대로)
                </button>
              )))}

              {/* 핵심 경험 */}
              {keyExps.length > 0 && (
                <div className="mb-8">
                  <h4 className="text-[14px] font-bold uppercase tracking-widest text-gray-400 border-b border-surface-100 pb-2 mb-4">핵심 경험 &amp; 성과</h4>
                  <KeyExperienceSlider
                    keyExperiences={keyExps}
                    onUpdate={readOnly ? undefined : (updated => onUpdate?.({ structuredResult: { ...structured, keyExperiences: updated } }))}
                  />
                </div>
              )}

              {/* ── 자유 캔버스 ── */}
              <div>
                {composePlan && !composePlan._fallback && (
                  <div className="mb-3 rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-3">
                    <p className="text-[12px] font-black text-primary-700">
                      구성 근거 · {composePlan.narrative}
                      {composePlan.artifactVariant && (
                        <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 font-mono text-[11.5px] text-primary-600">
                          {composePlan.artifactVariant}
                        </span>
                      )}
                    </p>
                    {composePlan.artifactReason && (
                      <p className="mt-1 text-[12px] leading-snug text-bluewood-500">비주얼 · {composePlan.artifactReason}</p>
                    )}
                    {composePlan.narrativeReason && (
                      <p className="mt-1 text-[11.5px] leading-relaxed text-bluewood-600">{composePlan.narrativeReason}</p>
                    )}
                    {composePlan.omitted?.length > 0 && (
                      <p className="mt-1.5 text-[12px] text-bluewood-400">
                        뺀 항목 · {composePlan.omitted.map(o => `${o.source}(${o.reason})`).join(' / ')}
                      </p>
                    )}
                    {composePlan.jdAlignment?.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-primary-100 pt-2">
                        <p className="text-[11.5px] font-bold text-bluewood-500">공고 요건 대응</p>
                        {composePlan.jdAlignment.map((a, i) => (
                          <p key={i} className="text-[12px] leading-snug text-bluewood-600">
                            <span className={`mr-1.5 font-bold ${
                              a.strength === 'strong' ? 'text-caribbean-700' : a.strength === 'missing' ? 'text-rose-500' : 'text-amber-600'
                            }`}>
                              {a.strength === 'strong' ? '충족' : a.strength === 'missing' ? '없음' : '약함'}
                            </span>
                            {a.requirement}
                            {a.note && <span className="text-bluewood-400"> — {a.note}</span>}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-surface-100 pb-2">
                  <h4 className="text-[14px] font-bold uppercase tracking-widest text-gray-400">상세 내용</h4>
                  {/* 캔버스 액션은 헤더로 이동 */}
                </div>
                {!readOnly && docIsEmpty && (
                  <div className="mb-3 rounded-lg border border-dashed border-primary-200 bg-primary-50/45 px-4 py-3 text-[13px] leading-relaxed text-bluewood-500">
                    빈 캔버스입니다. 왼쪽 블록을 드래그하거나 초안 만들기로 시작하세요.
                  </div>
                )}
                {initialDoc ? (
                  <NotionDocEditor
                    key={exp.experienceId || exp.id || exp.title || 'project'}
                    ref={canvasRef}
                    value={initialDoc}
                    onChange={readOnly ? undefined : handleDocChange}
                    readOnly={readOnly}
                    resolvePaletteBlocks={resolvePaletteBlocks}
                  />
                ) : (
                  <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 size={20} className="animate-spin" /></div>
                )}
              </div>
                </main>
                <QuickMenu
                  headings={headings}
                  activeId={activeHeadingId}
                  onSelect={scrollToHeading}
                  anchorRef={documentColumnRef}
                  scrollRootRef={scrollAreaRef}
                />
              </div>
            </div>
          </div>

          {/* ── 우측 AI 첨삭 패널 ── */}
          {showTailorPanel && (
            <div className="flex-shrink-0 border-l border-gray-100 overflow-y-auto bg-gradient-to-b from-indigo-50/30 to-white" style={{ width: 'clamp(320px, 34vw, 400px)' }}>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-indigo-800">AI 첨삭</h4>
                  {tailorResult && !tailoring && (
                    <button onClick={runTailor} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">다시 첨삭</button>
                  )}
                </div>
                {jobAnalysis?.company && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-xs font-medium text-blue-800">{jobAnalysis.company}</span>
                    {jobAnalysis.position && <span className="text-xs text-blue-500">· {jobAnalysis.position}</span>}
                  </div>
                )}
                {tailoring && (
                  <div className="flex flex-col items-center py-10">
                    <Loader2 size={24} className="animate-spin text-indigo-400 mb-3" />
                    <p className="text-sm text-gray-500">첨삭 중입니다...</p>
                    <p className="text-xs text-gray-400 mt-1">본문을 기업에 맞게 재구성합니다</p>
                  </div>
                )}
                {tailorError && !tailoring && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-xs text-red-600">{tailorError}</p>
                    <button onClick={runTailor} className="text-xs text-red-500 hover:text-red-700 mt-1 underline">다시 시도</button>
                  </div>
                )}
                {tailorResult && !tailoring && (
                  <div className="space-y-3">
                    {tailorResult.overallNote && (tailorResult.portfolioSections || []).length === 0 && (
                      <p className="text-[12px] text-gray-500 italic bg-gray-50 rounded-xl px-3 py-2">{tailorResult.overallNote}</p>
                    )}
                    {(tailorResult.portfolioSections || []).filter(s => s.tailoredContent?.trim()).length > 0 && (
                      <button onClick={applyAllTailored} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                        전체 적용 (캔버스에 삽입)
                      </button>
                    )}
                    {(tailorResult.portfolioSections || []).map((section, i) => {
                      const content = section.tailoredContent;
                      if (!content?.trim()) return null;
                      const isApplied = appliedSections[i];
                      return (
                        <div key={i} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                          <div className="flex items-center gap-2 px-3 py-2 bg-surface-50 border-b border-gray-100">
                            <span className="text-xs font-bold text-gray-700 flex-1 truncate">{section.label || '섹션'}</span>
                            <button
                              onClick={() => applyTailoredSection(i, section.label, content)}
                              disabled={isApplied}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-medium transition-colors ${isApplied ? 'bg-green-100 text-green-700 cursor-default' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'}`}
                            >
                              {isApplied ? <><Check size={10} />적용됨</> : <>적용</>}
                            </button>
                          </div>
                          <div className="p-3">
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{stripMd(content)}</p>
                            {(section.reason || section.changeReason) && (
                              <p className="text-[12px] text-indigo-500 mt-2 pt-2 border-t border-gray-50 italic">{stripMd(section.reason || section.changeReason)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {tailorResult.highlightedSkills?.length > 0 && (
                      <div className="pt-2">
                        <p className="text-[12px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">기업 어필 스킬</p>
                        <div className="flex flex-wrap gap-1.5">{tailorResult.highlightedSkills.map((s, si) => <span key={si} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[12px] font-medium">{s}</span>)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {!readOnly && (
        <GuidedTutorial
          ref={tutorialRef}
          visible={tutorial.visible}
          steps={tutorialSteps}
          onSkip={() => tutorial.dismiss(false)}
          onNeverShow={() => tutorial.dismiss(true)}
        />
      )}
    </div>
  );
}
