import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const CARL_LABELS = {
  context:  '배경 (Context)',
  action:   '행동 (Action)',
  result:   '결과 (Result)',
  learning: '배운 점 (Learning)',
};

// [key]\nvalue 형식의 텍스트를 파싱 (영문/한글 레이블 모두 지원)
function parseStarText(content) {
  if (!content) return null;
  const parts = content.split('\n\n');
  const result = {};
  for (const part of parts) {
    const match = part.match(/^\[([^\]]+)\]\n?([\s\S]*)/);
    if (match) result[match[1]] = match[2].trim();
  }
  return Object.keys(result).length > 0 ? result : null;
}

export default function DetailModal({ type, data, onClose }) {
  const [experienceMap, setExperienceMap] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    if (type === 'portfolio' && data) {
      const sections = data.sections || [];
      const ids = [...new Set(sections.filter(s => s.experienceId).map(s => s.experienceId))];
      if (ids.length > 0) {
        Promise.all(ids.map(id => getDoc(doc(db, 'experiences', id))))
          .then(docs => {
            const map = {};
            docs.forEach(d => { if (d.exists()) map[d.id] = { id: d.id, ...d.data() }; });
            setExperienceMap(map);
          })
          .catch(() => {});
      }
    }
  }, [type, data]);

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-surface-200">
          <h2 className="text-lg font-bold">{data.title || '상세 내용'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {type === 'experience' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-semibold">
                  {data.framework || 'CARL'}
                </span>
                {data.keywords?.length > 0 && (
                  <div className="flex gap-1">
                    {data.keywords.map(k => (
                      <span key={k} className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded text-xs">{k}</span>
                    ))}
                  </div>
                )}
              </div>

              {data.content && Object.entries(data.content).map(([key, val]) => (
                <div key={key} className="rounded-xl border border-surface-200 p-4">
                  <p className="text-sm font-bold text-gray-700 mb-2">
                  {CARL_LABELS[key] || key}                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{val || '(내용 없음)'}</p>
                </div>
              ))}

              {data.aiAnalysis && (
                <div className="bg-violet-50 rounded-xl p-4 mt-4">
                  <p className="text-xs font-bold text-violet-700 mb-2">AI 분석 결과</p>
                  <p className="text-sm text-gray-600">{data.aiAnalysis.feedback || data.aiAnalysis.summary || ''}</p>
                </div>
              )}
            </div>
          )}

          {type === 'portfolio' && (
            <div className="space-y-4">
              {data.targetCompany && (
                <p className="text-sm text-gray-500">{data.targetCompany} · {data.targetPosition}</p>
              )}
              {(data.sections || []).map((section, idx) => {
                const linkedExp = section.experienceId ? experienceMap[section.experienceId] : null;
                const isProject = section.type === 'project';
                const isExpanded = expandedSections[idx];
                const parsedStar = parseStarText(section.content);

                return (
                  <div key={idx} className="rounded-xl border border-surface-200 p-4">
                    <div
                      className={`flex items-center gap-2 mb-2 ${(linkedExp || isProject) ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (linkedExp || isProject) {
                          setExpandedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
                        }
                      }}
                    >
                      <span className="px-2 py-0.5 bg-surface-100 text-gray-500 rounded text-xs">{section.type}</span>
                      <p className="text-sm font-bold text-gray-700 flex-1">{section.title}</p>
                      {section.role && <span className="text-xs text-gray-400">({section.role})</span>}
                      {section.contribution && <span className="text-xs text-primary-600">기여도 {section.contribution}%</span>}
                      {section.period && <span className="text-xs text-gray-400">{section.period}</span>}
                      {linkedExp && (
                        isExpanded
                          ? <ChevronUp size={14} className="text-gray-400" />
                          : <ChevronDown size={14} className="text-gray-400" />
                      )}
                    </div>

                    {/* 기술 스택 (project 타입) */}
                    {isProject && (section.projectTechStack || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {section.projectTechStack.map((t, ti) => (
                          <span key={ti} className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded text-xs">{t}</span>
                        ))}
                      </div>
                    )}

                    {/* 섹션 내용 - CARL 형식이면 구조화해서 표시 */}
                    {!isExpanded && (
                      parsedStar ? (
                        <div className="space-y-2">
                          {Object.entries(parsedStar).map(([key, val]) => (
                            <div key={key} className="bg-surface-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-violet-700 mb-1">{CARL_LABELS[key] || key}</p>
                              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{val}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                          {section.content || (linkedExp ? '아래 화살표를 눌러 연결된 경험을 확인하세요.' : '(내용 없음)')}
                        </p>
                      )
                    )}

                    {/* 연결된 경험 펼치기 - 실제 Firestore 데이터 */}
                    {isExpanded && linkedExp && (
                      <div className="mt-2 space-y-2 border-t border-surface-100 pt-3">
                        <p className="text-xs font-bold text-primary-600 mb-2">📎 연결된 경험: {linkedExp.title}</p>
                        {linkedExp.content && Object.entries(linkedExp.content).map(([key, val]) => (
                          <div key={key} className="bg-surface-50 rounded-lg p-3">
                            <p className="text-xs font-bold text-violet-700 mb-1">{CARL_LABELS[key] || key}</p>
                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{val || '(내용 없음)'}</p>
                          </div>
                        ))}
                        {linkedExp.aiAnalysis?.projectOverview && (
                          <div className="bg-primary-50 rounded-lg p-3 mt-2">
                            <p className="text-xs font-bold text-primary-700 mb-1">📌 프로젝트 개요</p>
                            <p className="text-sm text-gray-600">{linkedExp.aiAnalysis.projectOverview.summary}</p>
                            {linkedExp.aiAnalysis.projectOverview.techStack?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {linkedExp.aiAnalysis.projectOverview.techStack.map((t, ti) => (
                                  <span key={ti} className="px-2 py-0.5 bg-white text-primary-600 rounded text-xs border border-primary-200">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {linkedExp.aiAnalysis?.keyExperiences?.length > 0 && (
                          <div className="space-y-1 mt-1">
                            <p className="text-xs font-bold text-gray-500">핵심 경험</p>
                            {linkedExp.aiAnalysis.keyExperiences.slice(0, 3).map((ke, ki) => (
                              <div key={ki} className="bg-white border border-surface-200 rounded-lg p-2">
                                <p className="text-xs font-semibold text-gray-700">{ke.title}</p>
                                {ke.metric && <span className="text-xs text-green-600 font-bold">{ke.metric}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {type === 'coverletter' && (
            <div className="space-y-4">
              {data.targetCompany && (
                <p className="text-sm text-gray-500">{data.targetCompany} · {data.targetPosition}</p>
              )}
              {(data.questions || []).map((q, idx) => (
                <div key={idx} className="rounded-xl border border-surface-200 p-4">
                  <p className="text-sm font-bold text-primary-600 mb-2">문항 {idx + 1}</p>
                  <p className="text-sm text-gray-700 mb-3 bg-surface-50 p-3 rounded-lg">
                    {q.question || '(문항 없음)'}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {q.answer || '(답변 없음)'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2 text-right">
                    {q.wordCount || 0} / {q.maxWordCount || 500}자
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-surface-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-gray-500 hover:bg-surface-100 rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
