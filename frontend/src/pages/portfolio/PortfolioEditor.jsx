import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Download, Plus, Trash2, GripVertical,
  Loader2, FolderOpen, ChevronDown, Upload
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import ImportModal from '../../components/ImportModal';
import ChecklistModal from '../../components/ChecklistModal';
import toast from 'react-hot-toast';

const SECTION_TYPES = [
  { type: 'intro', label: '자기소개' },
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
    return Object.entries(exp.content)
      .map(([key, val]) => `[${key}]\n${val}`)
      .join('\n\n');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id: _id, ...data } = portfolio;
      await updatePortfolio(id, data);
      setCurrentPortfolio(portfolio);
      toast.success('저장되었습니다');
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
    setSaving(false);
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
              <option value="GitHub">GitHub (Markdown)</option>
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
              {/* Link experience button */}
              {section.type === 'experience' && (
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

            {/* Contribution field for experience sections */}
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

            <textarea
              value={section.content || ''}
              onChange={e => handleSectionChange(idx, 'content', e.target.value)}
              placeholder="내용을 입력하세요..."
              rows={6}
              className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-y"
            />
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
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? '저장 중...' : '저장하기'}
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
