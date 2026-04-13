import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Download, Plus, Trash2, GripVertical,
  Loader2, FolderOpen, ChevronDown, Upload, X, Tag, CheckCircle2, XCircle,
  Sparkles, RotateCcw
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import ImportModal from '../../components/ImportModal';
import ChecklistModal from '../../components/ChecklistModal';
import api from '../../services/api';
import toast from 'react-hot-toast';

const SECTION_TYPES = [
  { type: 'intro', label: '자기소개' },
  { type: 'project', label: '프로젝트 블록' },
  { type: 'experience', label: '프로젝트/경험' },
  { type: 'skills', label: '기술/역량' },
  { type: 'education', label: '학력' },
  { type: 'awards', label: '수상/자격증' },
  { type: 'custom', label: '커스텀 섹션' },
];

export default function PortfolioEditor() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const { updatePortfolio, setCurrentPortfolio, exportPortfolio } = usePortfolioStore();

  const [portfolio, setPortfolio] = useState(null);
  const [experiences, setExperiences] = useState([]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting2, setExporting2] = useState(false);
  const [exportResult2, setExportResult2] = useState(null);
  const [showExpPicker, setShowExpPicker] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [skillInputs, setSkillInputs] = useState({});   // { [sectionIdx]: string }
  const [techInputs, setTechInputs] = useState({});     // { [sectionIdx]: string }
  const [sectionMatches, setSectionMatches] = useState({}); // { [sectionIdx]: { matched, reason } }
  const [matching, setMatching] = useState(false);
  // 기업 맞춤형 자동 수정
  const [tailoring, setTailoring] = useState(false);
  const [tailoredSections, setTailoredSections] = useState(null); // AI 재작성 결과
  const [tailorNote, setTailorNote] = useState('');
  const [confirmingTailor, setConfirmingTailor] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [portfolioSnap, expSnapshot] = await Promise.all([
        getDoc(doc(db, 'portfolios', id)),
        getDocs(query(collection(db, 'experiences'), where('userId', '==', user.uid)))
      ]);

      if (portfolioSnap.exists()) {
        const pData = { id: portfolioSnap.id, ...portfolioSnap.data() };
        setPortfolio(pData);
        setCurrentPortfolio(pData);
      }
      setExperiences(expSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      toast.error('데이터를 불러오지 못했습니다');
    }
    setLoading(false);
  };

  const handleFieldChange = (field, value) => {
    setPortfolio(prev => ({ ...prev, [field]: value }));
  };

  const handleSectionChange = (index, field, value) => {
    const sections = [...(portfolio.sections || [])];
    sections[index] = { ...sections[index], [field]: value };
    setPortfolio(prev => ({ ...prev, sections }));
  };

  const addSection = (type) => {
    const sections = [...(portfolio.sections || [])];
    sections.push({
      type,
      title: SECTION_TYPES.find(s => s.type === type)?.label || '새 섹션',
      content: '',
      experienceId: null,
      order: sections.length,
    });
    setPortfolio(prev => ({ ...prev, sections }));
  };

  const removeSection = (index) => {
    const sections = (portfolio.sections || []).filter((_, i) => i !== index);
    setPortfolio(prev => ({ ...prev, sections }));
  };

  const linkExperienceToSection = (sectionIndex, experienceId) => {
    const exp = experiences.find(e => e.id === experienceId);
    if (!exp) return;
    const sections = [...(portfolio.sections || [])];
    sections[sectionIndex] = {
      ...sections[sectionIndex],
      experienceId,
      content: formatExperienceContent(exp),
      title: exp.title || sections[sectionIndex].title,
    };
    setPortfolio(prev => ({ ...prev, sections }));
    setShowExpPicker(null);
  };

  const formatExperienceContent = (exp) => {
    if (!exp.content) return '';
    const labels = { situation: '상황', task: '과제', action: '행동', result: '결과' };
    return Object.entries(exp.content)
      .filter(([, val]) => val)
      .map(([key, val]) => `[${labels[key] || key}]\n${val}`)
      .join('\n\n');
  };

  // ── 스킬 태그 헬퍼 ──
  const parseSkills = (content) => {
    if (!content) return [];
    return content.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  };
  const addSkillToSection = (idx, val) => {
    const trimmed = val.trim().replace(/,$/, '');
    if (!trimmed) return;
    const existing = parseSkills(portfolio.sections[idx]?.content);
    if (existing.includes(trimmed)) return;
    handleSectionChange(idx, 'content', [...existing, trimmed].join(', '));
    setSkillInputs(prev => ({ ...prev, [idx]: '' }));
  };
  const removeSkillFromSection = (idx, skillIdx) => {
    const existing = parseSkills(portfolio.sections[idx]?.content);
    existing.splice(skillIdx, 1);
    handleSectionChange(idx, 'content', existing.join(', '));
  };

  // ── 프로젝트 기술 스택 헬퍼 ──
  const addProjectTech = (idx, val) => {
    const trimmed = val.trim().replace(/,$/, '');
    if (!trimmed) return;
    const existing = portfolio.sections[idx]?.projectTechStack || [];
    if (existing.includes(trimmed)) return;
    handleSectionChange(idx, 'projectTechStack', [...existing, trimmed]);
    setTechInputs(prev => ({ ...prev, [idx]: '' }));
  };
  const removeProjectTech = (idx, techIdx) => {
    const existing = [...(portfolio.sections[idx]?.projectTechStack || [])];
    existing.splice(techIdx, 1);
    handleSectionChange(idx, 'projectTechStack', existing);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id: _id, ...data } = portfolio;
      await updatePortfolio(id, data);
      setCurrentPortfolio(portfolio);
      toast.success('저장되었습니다');

      // 기업/직무가 설정된 경우 섹션 요건 매칭
      const sections = portfolio.sections || [];
      if (portfolio.targetCompany && portfolio.targetPosition && sections.length > 0) {
        setMatching(true);
        try {
          const res = await api.post('/portfolio/match-sections', {
            sections,
            targetCompany: portfolio.targetCompany,
            targetPosition: portfolio.targetPosition,
          }, { timeout: 30000 });
          if (res.data.results) {
            const map = {};
            res.data.results.forEach(r => { map[r.index] = r; });
            setSectionMatches(map);
            const matched = res.data.results.filter(r => r.matched).length;
            toast.success(`${matched}/${sections.length}개 섹션이 ${portfolio.targetCompany} 요건에 부합합니다`);
          }
        } catch {
          // 매칭 실패는 저장 성공에 영향 없음
        }
        setMatching(false);
      }
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
    setSaving(false);
  };

  // 기업 맞춤형으로 포트폴리오 전체 재작성
  const handleTailorWithJob = async () => {
    if (!portfolio.targetCompany && !portfolio.targetPosition) {
      toast.error('지원 기업/직무를 먼저 설정해주세요');
      return;
    }
    const sections = (portfolio.sections || []).filter(s => s.content?.trim());
    if (sections.length === 0) {
      toast.error('내용이 있는 섹션이 없습니다');
      return;
    }
    setTailoring(true);
    setTailoredSections(null);
    try {
      const jobAnalysis = {
        company: portfolio.targetCompany || '',
        position: portfolio.targetPosition || '',
        skills: [],
        coreValues: [],
        tasks: [],
        requirements: { essential: [] },
      };
      const res = await api.post('/job/tailor-portfolio', {
        jobAnalysis,
        sections: portfolio.sections || [],
      }, { timeout: 120000 });
      if (res.data.sections) {
        setTailoredSections(res.data.sections);
        setTailorNote(res.data.overallNote || '');
        toast.success('기업 맞춤형 재작성이 완료되었습니다. 변경 내용을 확인하세요.');
      }
    } catch {
      toast.error('기업 맞춤형 수정에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    setTailoring(false);
  };

  // 기업 맞춤형 수정본 확정 저장
  const handleConfirmTailor = async () => {
    if (!tailoredSections) return;
    setConfirmingTailor(true);
    const newSections = (portfolio.sections || []).map((section, idx) => {
      const tailored = tailoredSections.find(t => t.index === idx);
      if (tailored?.changed && tailored.tailoredContent) {
        return { ...section, content: tailored.tailoredContent };
      }
      return section;
    });
    const updatedPortfolio = { ...portfolio, sections: newSections };
    setPortfolio(updatedPortfolio);
    try {
      const { id: _id, ...data } = updatedPortfolio;
      await updatePortfolio(id, data);
      setCurrentPortfolio(updatedPortfolio);
      setTailoredSections(null);
      setTailorNote('');
      toast.success('기업 맞춤형 포트폴리오가 저장되었습니다!');
    } catch {
      toast.error('저장에 실패했습니다');
    }
    setConfirmingTailor(false);
  };

  const handleExport = async () => {
    const format = portfolio.exportFormat || 'PDF';
    setExporting2(true);
    try {
      setCurrentPortfolio(portfolio);
      const result = await exportPortfolio(id, format);
      if (result.content) {
        setExportResult2({ content: result.content, format: result.format });
        toast.success(`${format} 형식으로 변환 완료!`);
      } else {
        toast.error('내보내기 결과가 비어있습니다');
      }
    } catch (error) {
      toast.error('내보내기에 실패했습니다');
    }
    setExporting2(false);
  };

  const handleCopyExport = async () => {
    if (exportResult2?.content) {
      await navigator.clipboard.writeText(exportResult2.content);
      toast.success('클립보드에 복사되었습니다!');
    }
  };

  const handleDownloadExport = () => {
    if (!exportResult2?.content) return;
    const format = portfolio.exportFormat || 'PDF';
    const ext = format === 'GitHub' ? 'md' : format === 'Notion' ? 'md' : 'txt';
    const blob = new Blob([exportResult2.content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${portfolio.userName || 'portfolio'}_포트폴리오.${ext}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleImportApply = ({ imported, structured }) => {
    const data = structured || {};
    if (data.sections && data.sections.length > 0) {
      const newSections = [...(portfolio.sections || []), ...data.sections.map((s, i) => ({ ...s, order: (portfolio.sections?.length || 0) + i }))];
      setPortfolio(prev => ({
        ...prev,
        sections: newSections,
        title: prev.title || data.title || imported?.title || '',
      }));
      toast.success(`${data.sections.length}개 섹션이 추가되었습니다`);
    } else if (imported?.content) {
      const newSections = [...(portfolio.sections || []), {
        type: 'custom',
        title: imported.title || '임포트된 내용',
        content: imported.content,
        order: (portfolio.sections?.length || 0),
      }];
      setPortfolio(prev => ({ ...prev, sections: newSections }));
      toast.success('내용이 새 섹션으로 추가되었습니다');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  if (!portfolio) {
    return <p className="text-gray-500 text-center py-20">포트폴리오를 찾을 수 없습니다.</p>;
  }

  return (
    <div className="animate-fadeIn">
      <Link to="/app/portfolio" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={16} /> 목록으로
      </Link>

      {/* Meta Info */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">포트폴리오 제목</label>
            <input
              value={portfolio.title || ''}
              onChange={e => handleFieldChange('title', e.target.value)}
              className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">작성자 이름</label>
            <input
              value={portfolio.userName || ''}
              onChange={e => handleFieldChange('userName', e.target.value)}
              placeholder="홍길동"
              className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">지원 기업</label>
            <input
              value={portfolio.targetCompany || ''}
              onChange={e => handleFieldChange('targetCompany', e.target.value)}
              placeholder="카카오"
              className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">지원 직무</label>
            <input
              value={portfolio.targetPosition || ''}
              onChange={e => handleFieldChange('targetPosition', e.target.value)}
              placeholder="프론트엔드 개발자"
              className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Export 포맷</label>
            <select
              value={portfolio.exportFormat || 'PDF'}
              onChange={e => handleFieldChange('exportFormat', e.target.value)}
              className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="PDF">PDF</option>
              <option value="Notion">Notion</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4 mb-6">
        {(portfolio.sections || []).map((section, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-surface-200 p-6 animate-slideIn">
            <div className="flex items-center gap-3 mb-4">
              <GripVertical size={16} className="text-gray-300 cursor-grab" />
              <input
                value={section.title || ''}
                onChange={e => handleSectionChange(idx, 'title', e.target.value)}
                className="flex-1 text-lg font-bold outline-none"
                placeholder="섹션 제목"
              />
              {/* 기업 요건 매칭 배지 */}
              {sectionMatches[idx] && (
                sectionMatches[idx].matched
                  ? <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                      <CheckCircle2 size={11}/> 요건 부합
                    </span>
                  : <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium" title={sectionMatches[idx].reason || ''}>
                      <XCircle size={11}/> 요건 미달
                    </span>
              )}
              {matching && !sectionMatches[idx] && (
                <Loader2 size={14} className="animate-spin text-gray-300" />
              )}
              {/* Link experience button */}
              {(section.type === 'experience' || section.type === 'project') && (
                <div className="relative">
                  <button
                    onClick={() => setShowExpPicker(showExpPicker === idx ? null : idx)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    <FolderOpen size={12} /> 경험 연결
                    <ChevronDown size={12} />
                  </button>
                  {showExpPicker === idx && (
                    <div className="absolute top-full right-0 mt-1 w-72 bg-white border border-surface-200 rounded-xl shadow-lg z-10 max-h-60 overflow-auto">
                      {experiences.length === 0 ? (
                        <p className="p-4 text-sm text-gray-400">정리된 경험이 없습니다</p>
                      ) : (
                        experiences.map(exp => (
                          <button
                            key={exp.id}
                            onClick={() => linkExperienceToSection(idx, exp.id)}
                            className="w-full text-left px-4 py-3 hover:bg-surface-50 border-b border-surface-100 last:border-0"
                          >
                            <p className="text-sm font-medium">{exp.title}</p>
                            <p className="text-xs text-gray-400">{exp.framework}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => removeSection(idx)} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>

            {/* === 프로젝트 블록 섹션 === */}
            {section.type === 'project' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">기간</label>
                    <input
                      value={section.period || ''}
                      onChange={e => handleSectionChange(idx, 'period', e.target.value)}
                      placeholder="예: 2024.01 - 2024.03"
                      className="w-full mt-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">역할</label>
                    <input
                      value={section.role || ''}
                      onChange={e => handleSectionChange(idx, 'role', e.target.value)}
                      placeholder="예: 팀장, 백엔드 개발"
                      className="w-full mt-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none"
                    />
                  </div>
                </div>
                {/* 기술 스택 태그 */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">기술 스택</label>
                  <div className="flex flex-wrap gap-1.5 p-3 border border-surface-200 rounded-xl min-h-[40px] mb-2">
                    {(section.projectTechStack || []).map((tech, ti) => (
                      <span key={ti} className="flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs border border-violet-200">
                        {tech}
                        <button onClick={() => removeProjectTech(idx, ti)} className="text-violet-400 hover:text-red-500 ml-0.5">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    {(section.projectTechStack || []).length === 0 && (
                      <span className="text-xs text-gray-300">기술 스택 없음</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={techInputs[idx] || ''}
                      onChange={e => setTechInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); addProjectTech(idx, techInputs[idx] || ''); }
                      }}
                      placeholder="기술 입력 후 Enter (예: React)"
                      className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
                    />
                    <button
                      onClick={() => addProjectTech(idx, techInputs[idx] || '')}
                      className="px-3 py-2 bg-violet-50 text-violet-600 rounded-lg text-sm hover:bg-violet-100"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {/* 프로젝트 설명 */}
                <textarea
                  value={section.content || ''}
                  onChange={e => handleSectionChange(idx, 'content', e.target.value)}
                  placeholder="프로젝트 설명을 입력하세요..."
                  rows={4}
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-y"
                />
                {section.experienceId && (
                  <div className="flex items-center gap-2 p-2 bg-primary-50 rounded-lg">
                    <FolderOpen size={14} className="text-primary-500" />
                    <span className="text-xs text-primary-700">
                      연결된 경험: {experiences.find(e => e.id === section.experienceId)?.title || section.experienceId}
                    </span>
                    <button
                      onClick={() => { handleSectionChange(idx, 'experienceId', null); handleSectionChange(idx, 'content', section.content); }}
                      className="ml-auto text-gray-400 hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* === Contribution field for experience sections === */}
            {section.type === 'experience' && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-400">담당 역할</label>
                  <input
                    value={section.role || ''}
                    onChange={e => handleSectionChange(idx, 'role', e.target.value)}
                    placeholder="예: PM, 프론트엔드 개발"
                    className="w-full mt-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">기여도 (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={section.contribution || ''}
                    onChange={e => handleSectionChange(idx, 'contribution', e.target.value)}
                    placeholder="40"
                    className="w-full mt-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none"
                  />
                </div>
              </div>
            )}

            {/* === 기술/역량 섹션 - 태그 형태 === */}
            {section.type === 'skills' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 p-3 border border-surface-200 rounded-xl min-h-[48px]">
                  {parseSkills(section.content).map((skill, si) => (
                    <span key={si} className="flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-sm border border-primary-200">
                      {skill}
                      <button onClick={() => removeSkillFromSection(idx, si)} className="text-primary-400 hover:text-red-500 ml-0.5">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {parseSkills(section.content).length === 0 && (
                    <span className="text-xs text-gray-300">기술을 추가하세요</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={skillInputs[idx] || ''}
                    onChange={e => setSkillInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkillToSection(idx, skillInputs[idx] || ''); }
                    }}
                    placeholder="기술 입력 후 Enter 또는 쉼표 (예: Figma, Photoshop)"
                    className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
                  />
                  <button
                    onClick={() => addSkillToSection(idx, skillInputs[idx] || '')}
                    className="px-3 py-2 bg-primary-50 text-primary-600 rounded-lg text-sm hover:bg-primary-100"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* === 일반 텍스트 섹션 (experience, intro, education, awards, custom) === */}
            {section.type !== 'skills' && section.type !== 'project' && (
              <textarea
                value={section.content || ''}
                onChange={e => handleSectionChange(idx, 'content', e.target.value)}
                placeholder="내용을 입력하세요..."
                rows={6}
                className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-y"
              />
            )}
          </div>
        ))}

        {/* Add Section */}
        <div className="flex flex-wrap gap-2">
          {SECTION_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => addSection(type)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
            >
              <Plus size={14} /> {label}
            </button>
          ))}
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-dashed border-violet-300 rounded-xl text-sm text-violet-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
          >
            <Upload size={14} /> 외부 데이터 불러오기
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 sticky bottom-6">
        <button
          onClick={handleSave}
          disabled={saving || matching}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : matching ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? '저장 중...' : matching ? '요건 분석 중...' : '저장하기'}
        </button>
        {/* 기업 맞춤형 자동 수정 버튼 */}
        <button
          onClick={handleTailorWithJob}
          disabled={tailoring || !portfolio.targetCompany}
          title={!portfolio.targetCompany ? '지원 기업을 먼저 입력하세요' : `${portfolio.targetCompany} 맞춤형으로 전체 수정`}
          className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 transition-all"
        >
          {tailoring ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {tailoring ? 'AI 수정 중...' : '기업 맞춤 수정'}
        </button>
        <button
          onClick={handleExport}
          disabled={exporting2}
          className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all"
        >
          {exporting2 ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          {exporting2 ? '변환 중...' : '내보내기'}
        </button>
        <button
          onClick={() => {
            setCurrentPortfolio(portfolio);
            setShowChecklist(true);
          }}
          className="flex items-center gap-2 px-4 py-3.5 border border-surface-200 text-gray-600 rounded-xl font-medium hover:bg-surface-50 transition-all text-sm"
        >
          체크리스트
        </button>
      </div>

      {/* 기업 맞춤형 AI 수정 결과 패널 */}
      {tailoredSections && (
        <div className="mt-6 bg-white rounded-2xl border-2 border-violet-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-violet-600" />
              <h3 className="text-sm font-bold text-violet-800">
                {portfolio.targetCompany} 맞춤형 수정 결과
              </h3>
              <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full">
                {tailoredSections.filter(t => t.changed).length}개 섹션 수정됨
              </span>
            </div>
            <button
              onClick={() => { setTailoredSections(null); setTailorNote(''); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-surface-50"
            >
              <X size={16} />
            </button>
          </div>

          {tailorNote && (
            <div className="bg-violet-50 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-violet-700 mb-1">📌 AI 맞춤화 방향</p>
              <p className="text-sm text-violet-800">{tailorNote}</p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            {tailoredSections.map((t) => {
              const origSection = (portfolio.sections || [])[t.index];
              if (!origSection) return null;
              return (
                <div key={t.index} className="border border-surface-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-50 border-b border-surface-200">
                    <span className="text-xs font-bold text-gray-700">{origSection.title || `섹션 ${t.index + 1}`}</span>
                    {t.changed ? (
                      <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full">수정됨</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">변경 없음</span>
                    )}
                    {t.changeReason && <span className="text-xs text-gray-400 ml-auto">{t.changeReason}</span>}
                  </div>
                  {t.changed && (
                    <div className="grid grid-cols-2 divide-x divide-surface-200">
                      <div className="p-4">
                        <p className="text-xs font-bold text-gray-400 mb-2">원본</p>
                        <p className="text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">{origSection.content || '(내용 없음)'}</p>
                      </div>
                      <div className="p-4 bg-violet-50/50">
                        <p className="text-xs font-bold text-violet-600 mb-2">AI 수정본</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{t.tailoredContent}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleConfirmTailor}
              disabled={confirmingTailor}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {confirmingTailor ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {confirmingTailor ? '저장 중...' : '확정 저장하기'}
            </button>
            <button
              onClick={() => { setTailoredSections(null); setTailorNote(''); }}
              className="flex items-center gap-2 px-5 py-3 border border-surface-200 text-gray-600 rounded-xl font-medium hover:bg-surface-50 transition-colors"
            >
              <RotateCcw size={16} /> 취소
            </button>
          </div>
        </div>
      )}

      {/* Export Result */}
      {exportResult2 && (
        <div className="mt-6 bg-white rounded-2xl border border-surface-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700">
              내보내기 결과 ({portfolio.exportFormat || 'PDF'})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleCopyExport}
                className="px-3 py-1.5 text-xs bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
              >
                클립보드 복사
              </button>
              <button
                onClick={handleDownloadExport}
                className="px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
              >
                파일 다운로드
              </button>
              <button
                onClick={() => setExportResult2(null)}
                className="px-3 py-1.5 text-xs bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-600 bg-surface-50 rounded-xl p-4 max-h-96 overflow-auto border border-surface-100">
            {exportResult2.content}
          </pre>
        </div>
      )}

      {/* Checklist Modal */}
      {showChecklist && (
        <ChecklistModal
          portfolioId={id}
          onClose={() => setShowChecklist(false)}
          onExport={handleExport}
        />
      )}

      {showImport && (
        <ImportModal
          targetType="portfolio"
          onClose={() => setShowImport(false)}
          onImport={handleImportApply}
        />
      )}
    </div>
  );
}
