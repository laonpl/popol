import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileText, Globe, Github,
  X, CheckCircle2, Calendar, Tag,
  ChevronRight, ChevronLeft, Link2, Plus, Code2,
  Loader2, Check, FolderOpen, Palette, Monitor, UploadCloud
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ACCEPT_FILES = '.pdf,.jpg,.jpeg,.png,.webp,.hwp,.hwpx';

const FIELD_OPTIONS = [
  { value: '개발', label: '개발', icon: Code2 },
  { value: '디자인', label: '디자인', icon: Palette },
  { value: '기획', label: '기획', icon: Monitor },
];

export default function TemplateSelect() {
  const { user } = useAuthStore();
  const { createExperience } = useExperienceStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1); // 1: 기본정보, 2: 자료수집, 3: 로딩
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [field, setField] = useState('');
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [notionUrl, setNotionUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [linkInputs, setLinkInputs] = useState([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadingSteps, setLoadingSteps] = useState([]);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);

  const handleFileAdd = (e) => {
    const newFiles = Array.from(e.target.files || []);
    addValidFiles(newFiles);
    e.target.value = '';
  };

  const addValidFiles = useCallback((newFiles) => {
    if (files.length + newFiles.length > 10) {
      toast.error('파일은 최대 10개까지 업로드할 수 있습니다');
      return;
    }
    for (const f of newFiles) {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name}의 크기가 25MB를 초과합니다`);
        return;
      }
    }
    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addValidFiles(Array.from(e.dataTransfer.files));
  };

  const getFileTypeInfo = (name) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return { label: 'PDF', color: 'bg-red-500' };
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { label: 'IMG', color: 'bg-blue-500' };
    return { label: 'HWP', color: 'bg-emerald-600' };
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addLinkInput = () => {
    setLinkInputs(prev => [...prev, '']);
  };

  const updateLink = (index, value) => {
    setLinkInputs(prev => prev.map((v, i) => i === index ? value : v));
  };

  const removeLink = (index) => {
    setLinkInputs(prev => prev.filter((_, i) => i !== index));
  };

  const hasInput = files.length > 0 || textInput.trim() || notionUrl.trim() || githubUrl.trim() || blogUrl.trim() || linkInputs.some(l => l.trim());
  const canNext1 = title.trim() && startDate;

  const updateLoadingStep = (stepIdx, status) => {
    setLoadingSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, status } : s));
    setCurrentLoadingStep(stepIdx);
  };

  const handleSubmit = async () => {
    if (!hasInput) {
      toast.error('파일이나 텍스트, 링크를 하나 이상 입력해주세요');
      return;
    }

    setStep(3);

    // 로딩 단계 초기화
    const steps = [];
    if (files.length > 0) steps.push({ label: `${files.length}개 파일 분석`, status: 'pending' });
    if (textInput.trim()) steps.push({ label: '텍스트 데이터 처리', status: 'pending' });
    if (notionUrl.trim()) steps.push({ label: 'Notion 페이지 가져오기', status: 'pending' });
    if (githubUrl.trim()) steps.push({ label: 'GitHub 리포지토리 분석', status: 'pending' });
    if (blogUrl.trim() || linkInputs.some(l => l.trim())) steps.push({ label: '링크 콘텐츠 수집', status: 'pending' });
    steps.push({ label: '경험 데이터 생성', status: 'pending' });
    steps.push({ label: 'AI 구조화 분석', status: 'pending' });
    setLoadingSteps(steps);

    try {
      let allText = '';
      let stepIdx = 0;

      // 1) 파일 업로드
      if (files.length > 0) {
        updateLoadingStep(stepIdx, 'loading');
        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('targetType', 'experience');
            const { data } = await api.post('/import/upload', formData, { timeout: 120000 });
            if (data.imported?.content) {
              allText += `\n\n--- ${file.name} ---\n${data.imported.content}`;
            }
          } catch (err) {
            console.error(`${file.name} 임포트 실패:`, err);
            toast.error(`${file.name} 처리 실패`);
          }
        }
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }

      // 2) 텍스트
      if (textInput.trim()) {
        updateLoadingStep(stepIdx, 'loading');
        allText += `\n\n--- 직접 입력 ---\n${textInput}`;
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }

      // 3) Notion
      if (notionUrl.trim()) {
        updateLoadingStep(stepIdx, 'loading');
        try {
          const { data } = await api.post('/import/notion', { url: notionUrl, targetType: 'experience' }, { timeout: 60000 });
          if (data.imported?.content) {
            allText += `\n\n--- Notion ---\n${data.imported.content}`;
          }
        } catch (err) {
          toast.error('Notion 페이지 불러오기 실패');
        }
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }

      // 4) GitHub
      if (githubUrl.trim()) {
        updateLoadingStep(stepIdx, 'loading');
        try {
          const { data } = await api.post('/import/github', { url: githubUrl, targetType: 'experience' }, { timeout: 60000 });
          if (data.imported?.content) {
            allText += `\n\n--- GitHub ---\n${data.imported.content}`;
          }
        } catch (err) {
          toast.error('GitHub 리포지토리 불러오기 실패');
        }
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }

      // 5) 블로그/추가 링크
      if (blogUrl.trim() || linkInputs.some(l => l.trim())) {
        updateLoadingStep(stepIdx, 'loading');
        const urls = [blogUrl, ...linkInputs].filter(u => u.trim());
        for (const url of urls) {
          allText += `\n\n--- 링크: ${url} ---\n(링크 참조)`;
        }
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }

      if (!allText.trim()) {
        toast.error('분석할 내용이 없습니다');
        setStep(2);
        return;
      }

      // 6) 경험 생성
      updateLoadingStep(stepIdx, 'loading');
      const period = startDate ? `${startDate}${endDate ? ` ~ ${endDate}` : ''}` : '';
      const experienceId = await createExperience(user.uid, {
        title: title.trim(),
        framework: 'STRUCTURED',
        period,
        field: field || undefined,
        content: { rawInput: allText.trim() },
      });
      updateLoadingStep(stepIdx, 'done');
      stepIdx++;

      // 7) AI 분석
      updateLoadingStep(stepIdx, 'loading');
      const { data: analysis } = await api.post('/experience/analyze', { experienceId }, { timeout: 120000 });
      updateLoadingStep(stepIdx, 'done');

      toast.success('경험 정리가 완료되었습니다!');
      navigate(`/app/experience/structured/${experienceId}`, {
        state: { analysis, title: title.trim(), framework: 'STRUCTURED', content: { rawInput: allText.trim() } },
      });
    } catch (error) {
      console.error('경험 생성 실패:', error);
      toast.error('경험 생성에 실패했습니다. 다시 시도해주세요.');
      setStep(2);
    }
  };

  // ===== Step 3: 로딩 화면 =====
  if (step === 3) {
    const doneCount = loadingSteps.filter(s => s.status === 'done').length;
    const progress = loadingSteps.length > 0 ? Math.round((doneCount / loadingSteps.length) * 100) : 0;

    return (
      <div className="animate-fadeIn max-w-lg mx-auto pt-16">
        <div className="bg-white rounded-2xl border border-surface-200 p-8 shadow-sm">
          {/* 진행률 헤더 */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-50 flex items-center justify-center">
              <Loader2 size={28} className="text-primary-500 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-bluewood-900 mb-1">경험을 정리하고 있습니다</h2>
            <p className="text-sm text-bluewood-400">{progress}% 완료</p>
          </div>

          {/* 프로그레스 바 */}
          <div className="w-full h-2 bg-surface-100 rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 단계별 상태 */}
          <div className="space-y-3">
            {loadingSteps.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                s.status === 'loading' ? 'bg-primary-50 border border-primary-100' :
                s.status === 'done' ? 'bg-surface-50' : ''
              }`}>
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  {s.status === 'done' && <Check size={16} className="text-green-500" />}
                  {s.status === 'loading' && <Loader2 size={16} className="text-primary-500 animate-spin" />}
                  {s.status === 'pending' && <div className="w-2 h-2 rounded-full bg-surface-300" />}
                </div>
                <span className={`text-sm ${
                  s.status === 'loading' ? 'text-primary-700 font-medium' :
                  s.status === 'done' ? 'text-bluewood-500' : 'text-bluewood-300'
                }`}>{s.label}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-bluewood-300 text-center mt-8">
            AI가 입력된 자료를 분석하여 7가지 섹션으로 구조화합니다.<br/>최대 1분 정도 소요될 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  // ===== Step 1 & 2 UI =====
  return (
    <div className="animate-fadeIn max-w-2xl mx-auto">
      <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-bluewood-400 hover:text-bluewood-600 mb-6">
        <ArrowLeft size={16} /> 경험 정리로 돌아가기
      </Link>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-3 mb-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
          step === 1 ? 'bg-primary-500 text-white shadow-sm' : 'bg-surface-100 text-bluewood-400'
        }`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
            {step > 1 ? <Check size={12} /> : '1'}
          </span>
          기본 정보
        </div>
        <div className="w-8 h-px bg-surface-300" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
          step === 2 ? 'bg-primary-500 text-white shadow-sm' : 'bg-surface-100 text-bluewood-400'
        }`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</span>
          자료 수집
        </div>
      </div>

      {/* ===== Step 1: 기본 정보 ===== */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm">
            {/* 프로젝트명 */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-bluewood-600 mb-2">
                프로젝트명 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="프로젝트 이름을 입력하세요"
                className="w-full px-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 text-bluewood-900 placeholder-bluewood-300 transition-all"
              />
            </div>

            {/* 날짜 */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-bluewood-600 mb-2">
                <Calendar size={12} className="inline mr-1" />
                기간 <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 text-bluewood-900 transition-all"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 text-bluewood-900 transition-all"
                />
              </div>
            </div>

            {/* 분야 선택 */}
            <div>
              <label className="block text-xs font-semibold text-bluewood-600 mb-2">분야</label>
              <div className="flex flex-wrap gap-2">
                {FIELD_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const selected = field === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setField(selected ? '' : opt.value)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        selected
                          ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                          : 'bg-white text-bluewood-600 border-surface-200 hover:border-primary-300 hover:bg-primary-50/50'
                      }`}
                    >
                      <Icon size={14} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 다음 버튼 */}
          <button
            onClick={() => setStep(2)}
            disabled={!canNext1}
            className="w-full flex items-center justify-center gap-2 py-4 bg-primary-500 text-white rounded-2xl text-base font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-200/50"
          >
            다음 단계
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* ===== Step 2: 자료 수집 ===== */}
      {step === 2 && (
        <div className="space-y-5">

          {/* 파일 업로드 */}
          <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-bluewood-900 mb-4">관련 파일</h2>
            <input ref={fileInputRef} type="file" accept={ACCEPT_FILES} multiple onChange={handleFileAdd} className="hidden" />

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer transition-all select-none ${
                isDragging
                  ? 'border-primary-400 bg-primary-50 text-primary-500'
                  : 'border-surface-300 text-bluewood-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1 transition-colors ${isDragging ? 'bg-primary-100' : 'bg-surface-100'}`}>
                <FolderOpen size={22} className={isDragging ? 'text-primary-400' : 'text-bluewood-300'} />
              </div>
              <p className="font-medium text-sm">클릭하여 파일을 선택하세요</p>
              <p className="text-xs text-bluewood-300">PDF, 이미지 (JPG/PNG/WEBP), HWP · 최대 25MB · 최대 10개</p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => {
                  const typeInfo = getFileTypeInfo(f.name);
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border border-gray-100 rounded-xl bg-white shadow-sm">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                        <span className="text-white text-[9px] font-bold tracking-wide">{typeInfo.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-bluewood-900 truncate">{f.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-bluewood-400">{(f.size / 1024).toFixed(1)} KB</span>
                          <span className="text-gray-300">·</span>
                          <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                            <CheckCircle2 size={11} />
                            준비 완료
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full w-full" />
                        </div>
                      </div>
                      <button onClick={() => removeFile(i)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                        <X size={14} className="text-bluewood-300 hover:text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 직접 입력 */}
          <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-bluewood-900 mb-4">직접 입력</h2>
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={`프로젝트나 경험에 대해 자유롭게 작성해주세요.\n\n예시:\n- 어떤 프로젝트/활동이었나요?\n- 왜 시작하게 되었나요?\n- 어떤 문제를 해결했나요?`}
              rows={5}
              className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300 transition-all"
            />
            {textInput && (
              <p className="text-xs text-bluewood-400 text-right mt-1">{textInput.length}자</p>
            )}
          </div>

          {/* 링크 입력 */}
          <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-bluewood-900 mb-4">링크</h2>
            <div className="space-y-3">
              {/* Notion */}
              <div className="relative">
                <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bluewood-300" />
                <input
                  type="url"
                  value={notionUrl}
                  onChange={e => setNotionUrl(e.target.value)}
                  placeholder="Notion 페이지 URL"
                  className="w-full pl-10 pr-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300 transition-all"
                />
              </div>
              {/* GitHub */}
              <div className="relative">
                <Github size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bluewood-300" />
                <input
                  type="url"
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  placeholder="GitHub 리포지토리 URL"
                  className="w-full pl-10 pr-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300 transition-all"
                />
              </div>
              {/* 블로그 */}
              <div className="relative">
                <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bluewood-300" />
                <input
                  type="url"
                  value={blogUrl}
                  onChange={e => setBlogUrl(e.target.value)}
                  placeholder="블로그 또는 기타 URL"
                  className="w-full pl-10 pr-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300 transition-all"
                />
              </div>
              {/* 추가 링크들 */}
              {linkInputs.map((link, i) => (
                <div key={i} className="relative">
                  <Link2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bluewood-300" />
                  <input
                    type="url"
                    value={link}
                    onChange={e => updateLink(i, e.target.value)}
                    placeholder="추가 링크 URL"
                    className="w-full pl-10 pr-10 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300 transition-all"
                  />
                  <button onClick={() => removeLink(i)} className="absolute right-3 top-1/2 -translate-y-1/2 text-bluewood-300 hover:text-red-500">
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={addLinkInput}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors mt-1"
              >
                <Plus size={14} /> 링크 추가
              </button>
            </div>
            <p className="text-xs text-bluewood-300 mt-3">공개된 페이지/리포지토리만 가져올 수 있습니다.</p>
          </div>

          {/* 추가된 자료 요약 */}
          {hasInput && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
              <p className="text-sm font-medium text-primary-700 mb-2">추가된 자료</p>
              <div className="flex flex-wrap gap-2">
                {files.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> 파일 {files.length}개
                  </span>
                )}
                {textInput.trim() && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> 텍스트 입력
                  </span>
                )}
                {notionUrl.trim() && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> Notion
                  </span>
                )}
                {githubUrl.trim() && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> GitHub
                  </span>
                )}
                {blogUrl.trim() && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> 블로그
                  </span>
                )}
                {linkInputs.filter(l => l.trim()).length > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> 추가 링크 {linkInputs.filter(l => l.trim()).length}개
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-white border border-surface-200 text-bluewood-600 rounded-2xl text-sm font-semibold hover:bg-surface-50 transition-all"
            >
              <ChevronLeft size={16} />
              이전
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasInput}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-primary-500 text-white rounded-2xl text-base font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-200/50"
            >
              AI로 경험 정리 시작
            </button>
          </div>

          <p className="text-center text-xs text-bluewood-300 pb-4">
            AI는 입력된 자료만으로 정리하며, 새로운 내용을 만들어내지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}
