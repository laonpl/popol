import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileText, Image, Globe, Github,
  Loader2, X, Plus, ClipboardPaste, Sparkles, CheckCircle2
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ACCEPT_FILES = '.pdf,.jpg,.jpeg,.png,.webp,.hwp,.hwpx';

export default function TemplateSelect() {
  const { user } = useAuthStore();
  const { createExperience } = useExperienceStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('collect'); // collect | loading | done
  const [files, setFiles] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [notionUrl, setNotionUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [inputMode, setInputMode] = useState('file'); // file | text | notion | github
  const [loadingMsg, setLoadingMsg] = useState('');

  const handleFileAdd = (e) => {
    const newFiles = Array.from(e.target.files || []);
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
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const hasInput = files.length > 0 || textInput.trim() || notionUrl.trim() || githubUrl.trim();

  const handleSubmit = async () => {
    if (!hasInput) {
      toast.error('파일이나 텍스트를 입력해주세요');
      return;
    }

    setStep('loading');
    setLoadingMsg('자료를 분석하고 있습니다...');

    try {
      let allText = '';
      let importedTitle = '';

      // 1) 파일 업로드 처리
      if (files.length > 0) {
        setLoadingMsg(`${files.length}개 파일을 업로드하고 분석 중...`);
        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('targetType', 'experience');
            const { data } = await api.post('/import/upload', formData, { timeout: 120000 });
            if (data.imported?.content) {
              allText += `\n\n--- ${file.name} ---\n${data.imported.content}`;
            }
            if (data.imported?.title && !importedTitle) {
              importedTitle = data.imported.title;
            }
          } catch (err) {
            console.error(`${file.name} 임포트 실패:`, err);
            toast.error(`${file.name} 처리 실패`);
          }
        }
      }

      // 2) 텍스트 입력 처리
      if (textInput.trim()) {
        allText += `\n\n--- 직접 입력 ---\n${textInput}`;
      }

      // 3) Notion URL 처리
      if (notionUrl.trim()) {
        setLoadingMsg('Notion 페이지를 분석 중...');
        try {
          const { data } = await api.post('/import/notion', { url: notionUrl, targetType: 'experience' }, { timeout: 60000 });
          if (data.imported?.content) {
            allText += `\n\n--- Notion ---\n${data.imported.content}`;
          }
          if (data.imported?.title && !importedTitle) importedTitle = data.imported.title;
        } catch (err) {
          toast.error('Notion 페이지 불러오기 실패');
        }
      }

      // 4) GitHub URL 처리
      if (githubUrl.trim()) {
        setLoadingMsg('GitHub 리포지토리를 분석 중...');
        try {
          const { data } = await api.post('/import/github', { url: githubUrl, targetType: 'experience' }, { timeout: 60000 });
          if (data.imported?.content) {
            allText += `\n\n--- GitHub ---\n${data.imported.content}`;
          }
          if (data.imported?.title && !importedTitle) importedTitle = data.imported.title;
        } catch (err) {
          toast.error('GitHub 리포지토리 불러오기 실패');
        }
      }

      if (!allText.trim()) {
        toast.error('분석할 내용이 없습니다');
        setStep('collect');
        return;
      }

      // 5) 경험 생성 (raw 내용으로)
      setLoadingMsg('AI가 경험을 정리하고 있습니다...');
      const experienceId = await createExperience(user.uid, {
        title: importedTitle || '새 경험',
        framework: 'STRUCTURED',
        content: { rawInput: allText.trim() },
      });

      // 6) AI 분석으로 구조화
      setLoadingMsg('7가지 섹션으로 구조화하는 중...');
      const { data: analysis } = await api.post('/experience/analyze', { experienceId }, { timeout: 120000 });

      toast.success('경험 정리가 완료되었습니다!');
      navigate(`/app/experience/structured/${experienceId}`, {
        state: { analysis, title: importedTitle || analysis.intro || '새 경험', framework: 'STRUCTURED', content: { rawInput: allText.trim() } },
      });
    } catch (error) {
      console.error('경험 생성 실패:', error);
      toast.error('경험 생성에 실패했습니다. 다시 시도해주세요.');
      setStep('collect');
    }
  };

  // ===== 로딩 화면 =====
  if (step === 'loading') {
    return (
      <div className="animate-fadeIn flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-2xl bg-primary-50 flex items-center justify-center">
            <Sparkles size={36} className="text-primary-500 animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-caribbean-500 rounded-full animate-bounce" />
        </div>
        <h2 className="text-xl font-bold text-bluewood-900 mb-2">경험을 정리하고 있습니다</h2>
        <p className="text-bluewood-400 text-sm mb-6">{loadingMsg}</p>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-xs text-bluewood-300 mt-8">AI가 입력된 자료를 분석하여 7가지 섹션으로 구조화합니다.<br/>이 과정은 최대 1분 정도 소요될 수 있습니다.</p>
      </div>
    );
  }

  // ===== 자료 수집 화면 =====
  return (
    <div className="animate-fadeIn max-w-3xl mx-auto">
      <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-bluewood-400 hover:text-bluewood-600 mb-6">
        <ArrowLeft size={16} /> 경험 정리로 돌아가기
      </Link>

      {/* 헤더 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-full text-sm font-medium mb-4 border border-primary-100">
          <Sparkles size={16} />
          AI 경험 정리
        </div>
        <h1 className="text-2xl font-bold text-bluewood-900 mb-2">경험할 자료를 넣어주세요</h1>
        <p className="text-bluewood-400">관련 파일, 텍스트, 링크를 추가하면 AI가 자동으로 7가지 섹션으로 정리합니다</p>
      </div>

      {/* 입력 모드 탭 */}
      <div className="flex bg-surface-100 rounded-xl p-1 mb-6">
        {[
          { key: 'file', icon: Upload, label: '파일 업로드' },
          { key: 'text', icon: ClipboardPaste, label: '직접 입력' },
          { key: 'notion', icon: Globe, label: 'Notion' },
          { key: 'github', icon: Github, label: 'GitHub' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setInputMode(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all
              ${inputMode === tab.key ? 'bg-white text-bluewood-900 shadow-sm' : 'text-bluewood-400 hover:text-bluewood-600'}`}
          >
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {/* 파일 업로드 */}
      {inputMode === 'file' && (
        <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-4">
          <input ref={fileInputRef} type="file" accept={ACCEPT_FILES} multiple onChange={handleFileAdd} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-surface-300 rounded-xl p-10 flex flex-col items-center gap-3 text-bluewood-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 transition-all"
          >
            <Upload size={32} />
            <p className="font-medium">클릭하여 파일을 선택하세요</p>
            <p className="text-xs text-bluewood-300">PDF, 이미지 (JPG/PNG/WEBP), HWP · 최대 25MB · 최대 10개</p>
          </button>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 bg-surface-50 rounded-xl">
                  <FileText size={16} className="text-primary-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-bluewood-900 truncate">{f.name}</p>
                    <p className="text-xs text-bluewood-400">{(f.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={() => removeFile(i)} className="p-1 text-bluewood-300 hover:text-red-500">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 직접 입력 */}
      {inputMode === 'text' && (
        <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-4">
          <label className="block text-sm font-bold text-bluewood-900 mb-2">경험 내용 입력</label>
          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder={`프로젝트나 경험에 대해 자유롭게 작성해주세요.\n\n예시:\n- 어떤 프로젝트/활동이었나요?\n- 왜 시작하게 되었나요?\n- 어떤 문제를 해결했나요?\n- 어떤 기술/역량을 사용했나요?\n- 결과는 어땠나요?`}
            rows={12}
            className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300"
          />
          {textInput && (
            <p className="text-xs text-bluewood-400 text-right mt-1">{textInput.length}자</p>
          )}
        </div>
      )}

      {/* Notion */}
      {inputMode === 'notion' && (
        <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-4">
          <label className="block text-sm font-bold text-bluewood-900 mb-2">Notion 페이지 URL</label>
          <input
            type="url"
            value={notionUrl}
            onChange={e => setNotionUrl(e.target.value)}
            placeholder="https://www.notion.so/..."
            className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
          />
          <p className="text-xs text-bluewood-300 mt-2">Notion 페이지의 공유 URL을 입력하세요. 페이지가 공개되어 있어야 합니다.</p>
        </div>
      )}

      {/* GitHub */}
      {inputMode === 'github' && (
        <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-4">
          <label className="block text-sm font-bold text-bluewood-900 mb-2">GitHub 리포지토리 URL</label>
          <input
            type="url"
            value={githubUrl}
            onChange={e => setGithubUrl(e.target.value)}
            placeholder="https://github.com/username/repository"
            className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
          />
          <p className="text-xs text-bluewood-300 mt-2">리포지토리의 README를 자동으로 분석합니다.</p>
        </div>
      )}

      {/* 추가된 자료 요약 */}
      {(files.length > 0 || textInput.trim() || notionUrl.trim() || githubUrl.trim()) && (
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 mb-6">
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
                <CheckCircle2 size={12} /> Notion 링크
              </span>
            )}
            {githubUrl.trim() && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                <CheckCircle2 size={12} /> GitHub 링크
              </span>
            )}
          </div>
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!hasInput}
        className="w-full flex items-center justify-center gap-2 py-4 bg-primary-500 text-white rounded-2xl text-lg font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-200 hover:shadow-xl hover:-translate-y-0.5"
      >
        <Sparkles size={20} />
        AI로 경험 정리 시작
      </button>

      <p className="text-center text-xs text-bluewood-300 mt-4">
        AI는 입력된 자료만으로 정리하며, 새로운 내용을 만들어내지 않습니다.
      </p>
    </div>
  );
}
