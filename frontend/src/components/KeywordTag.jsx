const colorMap = {
  '문제해결': 'bg-red-50 text-red-600 border-red-200',
  '협업 능력': 'bg-green-50 text-green-600 border-green-200',
  '도전/열정': 'bg-orange-50 text-orange-600 border-orange-200',
  '리더십': 'bg-purple-50 text-purple-600 border-purple-200',
  '커뮤니케이션': 'bg-blue-50 text-blue-600 border-blue-200',
  '분석력': 'bg-indigo-50 text-indigo-600 border-indigo-200',
  '창의성': 'bg-pink-50 text-pink-600 border-pink-200',
  '책임감': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  '적응력': 'bg-teal-50 text-teal-600 border-teal-200',
  '기획력': 'bg-cyan-50 text-cyan-600 border-cyan-200',
  default: 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function KeywordTag({ keyword, type, onClick, removable, onRemove }) {
  const typePrefix = type === 'core' ? '●' : type === 'derived' ? '●' : '●';
  const typeColor = type === 'core' ? 'text-red-400' : type === 'derived' ? 'text-amber-400' : 'text-green-400';
  const colors = colorMap[keyword] || colorMap.default;

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${colors} ${onClick ? 'cursor-pointer hover:shadow-sm' : ''} transition-all`}
    >
      {type && <span className={`text-[8px] ${typeColor}`}>{typePrefix}</span>}
      #{keyword}
      {removable && (
        <button onClick={(e) => { e.stopPropagation(); onRemove?.(); }} className="ml-1 hover:text-red-500">×</button>
      )}
    </span>
  );
}
