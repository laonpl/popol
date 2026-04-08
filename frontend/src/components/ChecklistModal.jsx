import { useState } from 'react';
import { CheckCircle2, Circle, Loader2, X, Download, AlertTriangle } from 'lucide-react';
import usePortfolioStore from '../stores/portfolioStore';

const checklistItems = [
  { key: 'fileSize', label: '파일 용량', desc: '20MB 이하 확인 및 자동 압축', icon: '📦' },
  { key: 'format', label: '포맷 검증', desc: '기업 요구 형태(PDF/웹) 매칭', icon: '📄' },
  { key: 'naming', label: '네이밍 룰', desc: '[이름_포트폴리오.pdf] 규격', icon: '✏️' },
  { key: 'customization', label: '맞춤형 검토', desc: '지원 기업 기준 AI 최종 검토', icon: '🎯' },
  { key: 'contribution', label: '기여도 명시', desc: '팀 프로젝트 역할/기여도 기재', icon: '👥' },
  { key: 'proofread', label: '자동 검수', desc: '오타, 비문, 디자인 정렬 점검', icon: '🔍' },
];

export default function ChecklistModal({ portfolioId, onClose, onExport }) {
  const { checklist, exportReady, runChecklist } = usePortfolioStore();
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    await runChecklist(portfolioId);
    setRunning(false);
  };

  const passedCount = Object.values(checklist).filter(v => v.passed).length;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-200">
          <div>
            <h2 className="text-lg font-bold">Export 체크리스트</h2>
            <p className="text-sm text-gray-400 mt-1">
              모든 항목을 통과해야 파일이 생성됩니다
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">검증 진행률</span>
            <span className="font-bold text-primary-500">{passedCount}/6</span>
          </div>
          <div className="w-full bg-surface-200 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${(passedCount / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* Checklist Items */}
        <div className="p-6 space-y-3">
          {checklistItems.map(({ key, label, desc, icon }) => {
            const item = checklist[key];
            return (
              <div
                key={key}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  item.passed
                    ? 'border-green-200 bg-green-50'
                    : item.checking
                    ? 'border-yellow-200 bg-yellow-50'
                    : item.message && !item.passed
                    ? 'border-red-200 bg-red-50'
                    : 'border-surface-200 bg-white'
                }`}
              >
                <span className="text-xl">{icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                  {item.message && (
                    <p className={`text-xs mt-1 ${item.passed ? 'text-green-600' : 'text-red-500'}`}>
                      {item.message}
                    </p>
                  )}
                </div>
                <div>
                  {item.checking ? (
                    <Loader2 size={20} className="text-yellow-500 animate-spin" />
                  ) : item.passed ? (
                    <CheckCircle2 size={20} className="text-green-500 animate-pulse-check" />
                  ) : item.message ? (
                    <AlertTriangle size={20} className="text-red-400" />
                  ) : (
                    <Circle size={20} className="text-gray-300" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-surface-200">
          {!exportReady ? (
            <button
              onClick={handleRun}
              disabled={running}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {running ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  검증 중...
                </>
              ) : (
                '체크리스트 검증 시작'
              )}
            </button>
          ) : (
            <button
              onClick={onExport}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-caribbean-600 text-white rounded-xl font-medium hover:bg-caribbean-700 transition-colors"
            >
              <Download size={18} />
              Export 시작
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
