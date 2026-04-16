import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import YooptaPortfolioEditor from '../../components/YooptaPortfolioEditor';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

// 기존 포트폴리오 데이터 → Yoopta 초기 블록으로 변환
function portfolioToYooptaValue(portfolio) {
  if (portfolio.yooptaContent && Object.keys(portfolio.yooptaContent).length > 0) {
    return portfolio.yooptaContent;
  }

  // 기존 폼 기반 데이터가 있으면 기본 블록으로 매핑
  const blocks = {};
  let order = 0;

  const addBlock = (type, textOrProps) => {
    const id = `block-${Date.now()}-${order}`;
    if (type === 'HeadingOne' || type === 'HeadingTwo' || type === 'HeadingThree') {
      blocks[id] = {
        id,
        type,
        value: [{ id: `el-${id}`, type: type.toLowerCase().replace('heading', 'heading-'), children: [{ text: textOrProps || '' }] }],
        meta: { order: order++, depth: 0 },
      };
    } else if (type === 'Divider') {
      blocks[id] = {
        id,
        type: 'Divider',
        value: [{ id: `el-${id}`, type: 'divider', children: [{ text: '' }] }],
        meta: { order: order++, depth: 0 },
      };
    } else {
      blocks[id] = {
        id,
        type: 'Paragraph',
        value: [{ id: `el-${id}`, type: 'paragraph', children: [{ text: textOrProps || '' }] }],
        meta: { order: order++, depth: 0 },
      };
    }
    return id;
  };

  // 제목
  addBlock('HeadingOne', portfolio.title || portfolio.userName || '내 포트폴리오');

  if (portfolio.headline) {
    addBlock('Paragraph', portfolio.headline);
  }

  // 프로필 정보
  if (portfolio.userName || portfolio.nameEn) {
    addBlock('Divider');
    addBlock('HeadingTwo', '👤 프로필');
    if (portfolio.userName) addBlock('Paragraph', `이름: ${portfolio.userName}${portfolio.nameEn ? ` (${portfolio.nameEn})` : ''}`);
    if (portfolio.location) addBlock('Paragraph', `📍 ${portfolio.location}`);
    if (portfolio.birthDate) addBlock('Paragraph', `🎂 ${portfolio.birthDate}`);
  }

  // 학력
  if (portfolio.education?.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '🎓 학력');
    portfolio.education.forEach(edu => {
      const line = [edu.name || edu.school, edu.degree || edu.major, edu.period].filter(Boolean).join(' · ');
      addBlock('Paragraph', line);
      if (edu.detail) addBlock('Paragraph', edu.detail);
      if (edu.description && edu.description !== edu.detail) addBlock('Paragraph', edu.description);
    });
  }

  // 경험
  if (portfolio.experiences?.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '💼 경험');
    portfolio.experiences.forEach(exp => {
      addBlock('HeadingThree', exp.title || exp.company || '경험');
      if (exp.date || exp.period) addBlock('Paragraph', `📅 ${exp.date || exp.period}`);
      if (exp.role) addBlock('Paragraph', `역할: ${exp.role}`);
      if (exp.description) addBlock('Paragraph', exp.description);
      if (exp.result) addBlock('Paragraph', `성과: ${exp.result}`);
    });
  }

  // 스킬
  const allSkills = [
    ...(portfolio.skills?.tools || []),
    ...(portfolio.skills?.languages || []),
    ...(portfolio.skills?.frameworks || []),
    ...(portfolio.skills?.others || []),
  ];
  if (allSkills.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '🛠 기술 스택');
    const skillNames = allSkills.map(s => typeof s === 'string' ? s : s.name || s).filter(Boolean);
    addBlock('Paragraph', skillNames.join(' · '));
  }

  // 수상
  if (portfolio.awards?.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '🏆 수상 & 장학');
    portfolio.awards.forEach(a => {
      addBlock('Paragraph', [a.title, a.org, a.date].filter(Boolean).join(' · '));
    });
  }

  // 관심 분야
  if (portfolio.interests?.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '💡 관심 분야');
    addBlock('Paragraph', portfolio.interests.join(', '));
  }

  // 가치관
  if (portfolio.values?.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '💎 나의 가치관');
    portfolio.values.forEach(v => {
      const title = typeof v === 'string' ? v : v.title || '';
      const desc = typeof v === 'string' ? '' : v.description || '';
      addBlock('Paragraph', desc ? `${title} — ${desc}` : title);
    });
  }

  // 교과 활동
  if (portfolio.curricular?.courses?.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '📚 교과 활동');
    if (portfolio.curricular.summary?.gpa) addBlock('Paragraph', `GPA: ${portfolio.curricular.summary.gpa}`);
    portfolio.curricular.courses.forEach(c => {
      addBlock('Paragraph', [c.name, c.grade, c.semester].filter(Boolean).join(' · '));
    });
  }

  // 비교과 활동
  if (portfolio.extracurricular?.details?.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '🎯 비교과 활동');
    if (portfolio.extracurricular.summary) addBlock('Paragraph', portfolio.extracurricular.summary);
    portfolio.extracurricular.details.forEach(d => {
      addBlock('Paragraph', [d.title, d.period, d.description].filter(Boolean).join(' · '));
    });
  }

  // 어학
  if (portfolio.extracurricular?.languages?.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '🌐 어학');
    portfolio.extracurricular.languages.forEach(l => {
      addBlock('Paragraph', [l.name, l.score, l.date].filter(Boolean).join(' · '));
    });
  }

  // 목표
  if (portfolio.goals?.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '🎯 목표');
    portfolio.goals.forEach(g => {
      addBlock('Paragraph', `[${g.type || ''}] ${g.title || ''} — ${g.description || ''}`);
    });
  }

  // 가치관
  if (portfolio.valuesEssay) {
    addBlock('Divider');
    addBlock('HeadingTwo', '📝 자기소개 & 가치관');
    portfolio.valuesEssay.split('\n').filter(Boolean).forEach(line => {
      addBlock('Paragraph', line);
    });
  }

  // 연락처
  const contactEntries = Object.entries(portfolio.contact || {}).filter(([, v]) => v);
  if (contactEntries.length > 0) {
    addBlock('Divider');
    addBlock('HeadingTwo', '📬 연락처');
    contactEntries.forEach(([k, v]) => {
      addBlock('Paragraph', `${k}: ${v}`);
    });
  }

  return Object.keys(blocks).length > 0 ? blocks : {};
}

export default function FreeformPortfolioEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { updatePortfolio } = usePortfolioStore();

  const [portfolio, setPortfolio] = useState(null);
  const [yooptaValue, setYooptaValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 포트폴리오 로드
  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'portfolios', id));
        if (!snap.exists()) {
          toast.error('포트폴리오를 찾을 수 없습니다');
          navigate('/app/portfolio');
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setPortfolio(data);
        setYooptaValue(portfolioToYooptaValue(data));
      } catch (err) {
        console.error('로딩 실패:', err);
        toast.error('포트폴리오 로딩에 실패했습니다');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user, navigate]);

  // 저장
  const handleSave = useCallback(async (value, isAutoSave) => {
    if (!id) return;
    setSaving(true);
    try {
      await updatePortfolio(id, { yooptaContent: value });
      if (!isAutoSave) toast.success('저장되었습니다');
    } catch (err) {
      console.error('저장 실패:', err);
      toast.error('저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }, [id, updatePortfolio]);

  // 내보내기
  const handleExport = useCallback((format, content) => {
    const mimeMap = { html: 'text/html', markdown: 'text/markdown' };
    const extMap = { html: 'html', markdown: 'md' };
    const blob = new Blob([content], { type: mimeMap[format] || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${portfolio?.title || 'portfolio'}.${extMap[format] || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${format.toUpperCase()} 파일이 다운로드되었습니다`);
  }, [portfolio]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <YooptaPortfolioEditor
      initialValue={yooptaValue}
      onSave={handleSave}
      onBack={() => navigate('/app/portfolio')}
      onPreview={() => navigate(`/app/portfolio/preview/${id}`)}
      onExport={handleExport}
      title={portfolio?.title || '포트폴리오'}
      saving={saving}
      portfolioId={id}
    />
  );
}
