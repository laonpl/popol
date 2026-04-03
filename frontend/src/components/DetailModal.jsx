import { X } from 'lucide-react';

const STAR_LABELS = {
  situation: '🎯 상황 (Situation)',
  task: '📋 과제 (Task)',
  action: '⚡ 행동 (Action)',
  result: '📊 결과 (Result)',
};

export default function DetailModal({ type, data, onClose }) {
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
                  {data.framework || 'STAR'}
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
                    {STAR_LABELS[key] || key}
                  </p>
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
              {(data.sections || []).map((section, idx) => (
                <div key={idx} className="rounded-xl border border-surface-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-surface-100 text-gray-500 rounded text-xs">{section.type}</span>
                    <p className="text-sm font-bold text-gray-700">{section.title}</p>
                    {section.role && <span className="text-xs text-gray-400">({section.role})</span>}
                    {section.contribution && <span className="text-xs text-primary-600">기여도 {section.contribution}%</span>}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{section.content || '(내용 없음)'}</p>
                </div>
              ))}
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
