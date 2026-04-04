import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Eye, Download, Plus, Trash2, Loader2,
  GraduationCap, Award, Briefcase, Mail, Phone, Globe,
  MapPin, Calendar, Heart, ChevronDown, ChevronUp, X,
  BookOpen, Code, Target, Star, MessageSquare, Upload, Sparkles, ImagePlus
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import { JobAnalysisBadge } from '../../components/JobLinkInput';
import api from '../../services/api';
import toast from 'react-hot-toast';

const EMPTY_PORTFOLIO = {
  templateType: 'notion',
  // Profile
  headline: '',
  userName: '',
  nameEn: '',
  location: '',
  birthDate: '',
  profileImageUrl: '',
  values: [],
  // Education
  education: [],
  // Interest
  interests: [],
  // Scholarship & Awards
  awards: [],
  // Experience
  experiences: [],
  // Contact
  contact: { phone: '', email: '', linkedin: '', instagram: '', github: '', website: '' },
  // 교과 활동
  curricular: {
    summary: { credits: '', gpa: '' },
    courses: [],
    creditStatus: [],
  },
  // 비교과 활동
  extracurricular: {
    summary: '',
    badges: [],
    languages: [],
    details: [],
  },
  // 기술
  skills: {
    tools: [],
    languages: [],
    frameworks: [],
    others: [],
  },
  // 목표와 계획
  goals: [],
  // 가치관
  valuesEssay: '',
};

export default function NotionPortfolioEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { updatePortfolio, setCurrentPortfolio, exportPortfolio } = usePortfolioStore();

  const [portfolio, setPortfolio] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('profile');
  const [userExperiences, setUserExperiences] = useState([]);
  const [showExpPicker, setShowExpPicker] = useState(false);

  const SECTIONS = [
    { id: 'profile', label: '프로필', icon: Heart },
    { id: 'education', label: '학력', icon: GraduationCap },
    { id: 'awards', label: '수상/장학금', icon: Award },
    { id: 'experiences', label: '경험', icon: Briefcase },
    { id: 'curricular', label: '교과 활동', icon: BookOpen },
    { id: 'extracurricular', label: '비교과 활동', icon: Star },
    { id: 'skills', label: '기술', icon: Code },
    { id: 'goals', label: '목표와 계획', icon: Target },
    { id: 'values', label: '가치관', icon: MessageSquare },
    { id: 'contact', label: '연락처', icon: Mail },
  ];

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [portfolioSnap, expSnapshot] = await Promise.all([
        getDoc(doc(db, 'portfolios', id)),
        getDocs(query(collection(db, 'experiences'), where('userId', '==', user.uid)))
      ]);
      if (portfolioSnap.exists()) {
        const pData = { id: portfolioSnap.id, ...portfolioSnap.data() };
        // Merge with EMPTY_PORTFOLIO defaults
        const merged = { ...EMPTY_PORTFOLIO, ...pData };
        if (!merged.education) merged.education = [];
        if (!merged.awards) merged.awards = [];
        if (!merged.experiences) merged.experiences = [];
        if (!merged.contact) merged.contact = { phone: '', email: '', linkedin: '', instagram: '', github: '', website: '' };
        if (!merged.skills) merged.skills = { tools: [], languages: [], frameworks: [], others: [] };
        if (!merged.goals) merged.goals = [];
        if (!merged.values) merged.values = [];
        if (!merged.interests) merged.interests = [];
        if (!merged.curricular) merged.curricular = { summary: { credits: '', gpa: '' }, courses: [], creditStatus: [] };
        if (!merged.extracurricular) merged.extracurricular = { summary: '', badges: [], languages: [], details: [] };
        setPortfolio(merged);
        setCurrentPortfolio(merged);
      }
      setUserExperiences(expSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      toast.error('데이터를 불러오지 못했습니다');
    }
    setLoading(false);
  };

  const update = (field, value) => {
    setPortfolio(prev => ({ ...prev, [field]: value }));
  };

  const updateNested = (parent, field, value) => {
    setPortfolio(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  // Array helpers
  const addToArray = (field, item) => {
    setPortfolio(prev => ({ ...prev, [field]: [...(prev[field] || []), item] }));
  };
  const removeFromArray = (field, index) => {
    setPortfolio(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };
  const updateArrayItem = (field, index, value) => {
    setPortfolio(prev => {
      const arr = [...prev[field]];
      arr[index] = typeof value === 'object' ? { ...arr[index], ...value } : value;
      return { ...prev, [field]: arr };
    });
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

  const importExperience = (exp) => {
    const newExp = {
      date: exp.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 7) || '',
      title: exp.title || '',
      description: exp.content
        ? Object.entries(exp.content).map(([k, v]) => `${v}`).join('\n')
        : '',
      // 상세 데이터 보존
      framework: exp.framework || '',
      frameworkContent: exp.content || {},
      keywords: exp.aiAnalysis?.competencyKeywords || exp.keywords || [],
      aiSummary: exp.aiAnalysis?.overallSummary || '',
      // Notion 스타일 필드
      thumbnailUrl: '',
      status: 'finished',
      classify: [],
      skills: [],
      role: '',
      link: '',
      sections: [],
    };
    addToArray('experiences', newExp);
    setShowExpPicker(false);
    toast.success(`"${exp.title}" 경험이 추가되었습니다`);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-600" /></div>;
  }
  if (!portfolio) {
    return <p className="text-gray-500 text-center py-20">포트폴리오를 찾을 수 없습니다.</p>;
  }

  return (
    <div className="animate-fadeIn max-w-[1200px] mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/app/portfolio" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft size={16} /> 목록으로
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/app/portfolio/preview/${id}`)}
            className="flex items-center gap-2 px-4 py-2.5 border border-surface-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-surface-50 transition-colors"
          >
            <Eye size={16} /> 미리보기
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>

      {/* Headline */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <input
          value={portfolio.headline || ''}
          onChange={e => update('headline', e.target.value)}
          placeholder="나를 표현하는 한 줄 제목 (예: 세상과 소통하는 Mathematician, 한채영)"
          className="w-full text-2xl font-bold outline-none placeholder:text-gray-300"
        />
        <p className="text-xs text-gray-400 mt-2">💡 Notion 포트폴리오 상단에 표시되는 대표 타이틀입니다</p>
        {/* 연결된 기업 공고 */}
        {portfolio.jobAnalysis && (
          <div className="mt-3">
            <JobAnalysisBadge
              analysis={portfolio.jobAnalysis}
              onRemove={() => update('jobAnalysis', null)}
            />
          </div>
        )}
      </div>

      {/* Section Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {SECTIONS.map(sec => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeSection === sec.id
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-white border border-surface-200 text-gray-600 hover:bg-surface-50'
              }`}
            >
              <Icon size={14} /> {sec.label}
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="min-h-[500px]">
        {activeSection === 'profile' && (
          <ProfileSection portfolio={portfolio} update={update} addToArray={addToArray}
            removeFromArray={removeFromArray} updateArrayItem={updateArrayItem}
            userId={user.uid} portfolioId={id} />
        )}
        {activeSection === 'education' && (
          <EducationSection portfolio={portfolio} addToArray={addToArray}
            removeFromArray={removeFromArray} updateArrayItem={updateArrayItem} />
        )}
        {activeSection === 'awards' && (
          <AwardsSection portfolio={portfolio} addToArray={addToArray}
            removeFromArray={removeFromArray} updateArrayItem={updateArrayItem} />
        )}
        {activeSection === 'experiences' && (
          <ExperiencesSection portfolio={portfolio} addToArray={addToArray}
            removeFromArray={removeFromArray} updateArrayItem={updateArrayItem}
            userExperiences={userExperiences} importExperience={importExperience}
            showExpPicker={showExpPicker} setShowExpPicker={setShowExpPicker} />
        )}
        {activeSection === 'curricular' && (
          <CurricularSection portfolio={portfolio} update={update} updateNested={updateNested} />
        )}
        {activeSection === 'extracurricular' && (
          <ExtracurricularSection portfolio={portfolio} update={update} updateNested={updateNested} />
        )}
        {activeSection === 'skills' && (
          <SkillsSection portfolio={portfolio} update={update} updateNested={updateNested} />
        )}
        {activeSection === 'goals' && (
          <GoalsSection portfolio={portfolio} addToArray={addToArray}
            removeFromArray={removeFromArray} updateArrayItem={updateArrayItem} />
        )}
        {activeSection === 'values' && (
          <ValuesSection portfolio={portfolio} update={update} />
        )}
        {activeSection === 'contact' && (
          <ContactSection portfolio={portfolio} updateNested={updateNested} />
        )}
      </div>
    </div>
  );
}

/* ── Section Components ── */

function SectionCard({ title, icon: Icon, children, description }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={18} className="text-primary-600" />}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {description && <p className="text-xs text-gray-400 mb-4">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-500 mb-1 font-medium">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1 font-medium">{label}</label>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-y"
      />
    </div>
  );
}

// ── Profile Section ──
function ProfileSection({ portfolio, update, addToArray, removeFromArray, updateArrayItem, userId, portfolioId }) {
  const profileImageInputRef = useRef(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);

  const handleProfileImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드할 수 있습니다');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다');
      return;
    }
    setUploadingProfile(true);
    try {
      // 기존 이미지 삭제
      if (portfolio.profileImageStoragePath) {
        try {
          await api.delete('/upload/image', { data: { storagePath: portfolio.profileImageStoragePath } });
        } catch {}
      }
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `portfolios/${userId}/${portfolioId}/profile_${timestamp}_${safeName}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('storagePath', storagePath);

      const { data } = await api.post('/upload/image', formData, {
        timeout: 60000,
      });
      update('profileImageUrl', data.url);
      update('profileImageStoragePath', data.storagePath);
      toast.success('프로필 이미지가 업로드되었습니다');
    } catch (err) {
      console.error('프로필 이미지 업로드 실패:', err);
      toast.error('이미지 업로드에 실패했습니다');
    }
    setUploadingProfile(false);
    e.target.value = '';
  };

  const handleProfileImageDelete = async () => {
    if (portfolio.profileImageStoragePath) {
      try {
        await api.delete('/upload/image', { data: { storagePath: portfolio.profileImageStoragePath } });
      } catch {}
    }
    update('profileImageUrl', '');
    update('profileImageStoragePath', '');
  };

  return (
    <>
      <SectionCard title="기본 정보" icon={Heart} description="프로필 좌측에 표시되는 기본 인적 사항입니다">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="이름 (한글)" value={portfolio.userName} onChange={v => update('userName', v)} placeholder="한채영" />
          <InputField label="이름 (영문)" value={portfolio.nameEn} onChange={v => update('nameEn', v)} placeholder="Chae Young Han" />
          <InputField label="거주지" value={portfolio.location} onChange={v => update('location', v)} placeholder="Seoul, South Korea" />
          <InputField label="생년월일" value={portfolio.birthDate} onChange={v => update('birthDate', v)} placeholder="2000.01.01" />
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1 font-medium">프로필 이미지</label>
            {portfolio.profileImageUrl ? (
              <div className="flex items-center gap-3 p-3 border border-surface-200 rounded-lg">
                <img src={portfolio.profileImageUrl} alt="profile" className="w-14 h-14 rounded-xl object-cover border border-surface-200" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 truncate">{portfolio.profileImageStoragePath?.split('/').pop() || '업로드된 이미지'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">클릭하여 교체</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => profileImageInputRef.current?.click()}
                    disabled={uploadingProfile}
                    className="px-3 py-1.5 text-xs text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-40 transition-colors">
                    {uploadingProfile ? <Loader2 size={12} className="animate-spin" /> : '교체'}
                  </button>
                  <button type="button" onClick={handleProfileImageDelete}
                    className="px-3 py-1.5 text-xs text-red-400 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => profileImageInputRef.current?.click()}
                disabled={uploadingProfile}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-dashed border-surface-300 rounded-lg text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 disabled:opacity-40 transition-all">
                {uploadingProfile ? (
                  <><Loader2 size={18} className="animate-spin" /><span className="text-sm">업로드 중...</span></>
                ) : (
                  <><ImagePlus size={18} /><span className="text-sm">사진 선택 · JPG, PNG, WEBP · 최대 5MB</span></>
                )}
              </button>
            )}
            <input ref={profileImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleProfileImageUpload} className="hidden" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="My Own Values" icon={Star} description="나를 나타내는 핵심 가치관 키워드를 추가하세요">
        <div className="space-y-3">
          {(portfolio.values || []).map((val, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="flex-1">
                <InputField label={`가치 ${i + 1} - 키워드`} value={val.keyword}
                  onChange={v => updateArrayItem('values', i, { keyword: v })} placeholder="경험을 더하다" />
                <div className="mt-2">
                  <TextareaField label="설명" value={val.description}
                    onChange={v => updateArrayItem('values', i, { description: v })}
                    placeholder="이 가치관에 대한 간단한 설명..." rows={2} />
                </div>
              </div>
              <button onClick={() => removeFromArray('values', i)} className="mt-5 p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => addToArray('values', { keyword: '', description: '' })}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 가치관 추가
          </button>
        </div>
      </SectionCard>

      <SectionCard title="관심 분야" icon={Target} description="Interest 영역에 표시됩니다">
        <div className="space-y-2">
          {(portfolio.interests || []).map((interest, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-gray-400">•</span>
              <input value={interest} onChange={e => updateArrayItem('interests', i, e.target.value)}
                className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Enumerative Combinatorics (열거 조합론)" />
              <button onClick={() => removeFromArray('interests', i)} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => addToArray('interests', '')}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 관심 분야 추가
          </button>
        </div>
      </SectionCard>
    </>
  );
}

// ── Education Section ──
function EducationSection({ portfolio, addToArray, removeFromArray, updateArrayItem }) {
  return (
    <SectionCard title="학력 (Education)" icon={GraduationCap} description="학교 정보를 등록하세요">
      <div className="space-y-4">
        {(portfolio.education || []).map((edu, i) => (
          <div key={i} className="p-4 bg-surface-50 rounded-xl border border-surface-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700">학력 #{i + 1}</span>
              <button onClick={() => removeFromArray('education', i)} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="학교명 (한글)" value={edu.name} onChange={v => updateArrayItem('education', i, { name: v })} placeholder="성균관대학교" />
              <InputField label="학교명 (영문)" value={edu.nameEn} onChange={v => updateArrayItem('education', i, { nameEn: v })} placeholder="Sungkyunkwan University" />
              <InputField label="기간" value={edu.period} onChange={v => updateArrayItem('education', i, { period: v })} placeholder="2024.02. - ing" />
              <InputField label="학위/전공" value={edu.degree} onChange={v => updateArrayItem('education', i, { degree: v })} placeholder="B.S. in Department of Mathematics" />
              <div className="col-span-2">
                <InputField label="추가 정보" value={edu.detail} onChange={v => updateArrayItem('education', i, { detail: v })} placeholder="2025 Summer Session - Session C (8W)" />
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => addToArray('education', { name: '', nameEn: '', period: '', degree: '', detail: '' })}
          className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Plus size={14} /> 학력 추가
        </button>
      </div>
    </SectionCard>
  );
}

// ── Awards Section ──
function AwardsSection({ portfolio, addToArray, removeFromArray, updateArrayItem }) {
  return (
    <SectionCard title="수상 / 장학금 (Scholarship and Awards)" icon={Award} description="수상 및 장학 내역을 날짜 순으로 입력하세요">
      <div className="space-y-3">
        {(portfolio.awards || []).map((award, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
            <div className="grid grid-cols-[120px_1fr] gap-3 flex-1">
              <InputField label="날짜" value={award.date} onChange={v => updateArrayItem('awards', i, { date: v })} placeholder="2025.12." />
              <InputField label="내용" value={award.title} onChange={v => updateArrayItem('awards', i, { title: v })} placeholder="제 43회 대학생 수학 경시대회 제 1분야 동상" />
            </div>
            <button onClick={() => removeFromArray('awards', i)} className="p-1.5 text-gray-300 hover:text-red-400 mt-5"><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={() => addToArray('awards', { date: '', title: '' })}
          className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Plus size={14} /> 수상/장학 추가
        </button>
      </div>
    </SectionCard>
  );
}

// ── Experiences Section ──
const STATUS_OPTIONS = [
  { value: 'expected', label: 'Expected', color: 'bg-blue-100 text-blue-700' },
  { value: 'doing', label: 'Doing', color: 'bg-green-100 text-green-700' },
  { value: 'finished', label: 'Finished', color: 'bg-red-100 text-red-700' },
];
const CLASSIFY_OPTIONS = ['교내 활동', '교외 활동', '동아리', '공모전', '학교 협력 활동', '기술', '발표', '대회', '해외 경험'];

function ExperiencesSection({ portfolio, addToArray, removeFromArray, updateArrayItem, userExperiences, importExperience, showExpPicker, setShowExpPicker }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [tailoringIdx, setTailoringIdx] = useState(null);
  const [tailorResult, setTailorResult] = useState(null);

  const toggleClassify = (i, tag) => {
    const exp = portfolio.experiences[i];
    const cls = exp.classify || [];
    updateArrayItem('experiences', i, {
      classify: cls.includes(tag) ? cls.filter(c => c !== tag) : [...cls, tag]
    });
  };

  const addSection = (i) => {
    const exp = portfolio.experiences[i];
    const secs = [...(exp.sections || []), { title: '', content: '' }];
    updateArrayItem('experiences', i, { sections: secs });
  };

  const updateSection = (i, si, changes) => {
    const exp = portfolio.experiences[i];
    const secs = [...(exp.sections || [])];
    secs[si] = { ...secs[si], ...changes };
    updateArrayItem('experiences', i, { sections: secs });
  };

  const removeSection = (i, si) => {
    const exp = portfolio.experiences[i];
    updateArrayItem('experiences', i, { sections: exp.sections.filter((_, idx) => idx !== si) });
  };

  const addSkill = (i, skill) => {
    if (!skill.trim()) return;
    const exp = portfolio.experiences[i];
    const sk = [...(exp.skills || []), skill.trim()];
    updateArrayItem('experiences', i, { skills: sk });
  };

  const removeSkill = (i, si) => {
    const exp = portfolio.experiences[i];
    updateArrayItem('experiences', i, { skills: exp.skills.filter((_, idx) => idx !== si) });
  };

  const handleTailorExperience = async (i) => {
    if (!portfolio.jobAnalysis) { toast.error('연결된 기업 공고가 없습니다'); return; }
    setTailoringIdx(i);
    setTailorResult(null);
    try {
      const { data } = await api.post('/job/tailor-experience', {
        jobAnalysis: portfolio.jobAnalysis,
        experience: portfolio.experiences[i],
      });
      setTailorResult({ idx: i, ...data });
    } catch { toast.error('맞춤 변환 실패'); }
    setTailoringIdx(null);
  };

  const applyTailoredResult = (i) => {
    if (!tailorResult || tailorResult.idx !== i) return;
    updateArrayItem('experiences', i, {
      description: tailorResult.tailoredDescription,
      skills: tailorResult.highlightedSkills || portfolio.experiences[i].skills,
    });
    toast.success('기업 맞춤으로 변환 완료!');
    setTailorResult(null);
  };

  return (
    <SectionCard title="프로젝트 / 경험 (Experience)" icon={Briefcase} description="갤러리 카드로 표시되는 프로젝트 경험입니다. 클릭하면 상세 편집할 수 있습니다.">
      <div className="space-y-3">
        {(portfolio.experiences || []).map((exp, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i} className="bg-surface-50 rounded-xl border border-surface-100 overflow-hidden">
              {/* 접힌 상태: 요약 카드 */}
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-surface-100/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {exp.thumbnailUrl ? (
                    <img src={exp.thumbnailUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface-200 flex items-center justify-center shrink-0 text-lg">📋</div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-700 truncate">{exp.title || '(제목 없음)'}</span>
                      {exp.status && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${(STATUS_OPTIONS.find(s => s.value === exp.status) || STATUS_OPTIONS[2]).color}`}>
                          {(STATUS_OPTIONS.find(s => s.value === exp.status) || STATUS_OPTIONS[2]).label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{exp.date} {exp.role && `· ${exp.role}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); removeFromArray('experiences', i); }} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {/* 펼친 상태: 전체 편집 */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-surface-100 pt-4">
                  {/* 기본 정보 */}
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="제목" value={exp.title} onChange={v => updateArrayItem('experiences', i, { title: v })} placeholder="프로젝트명 / 활동명" />
                    <InputField label="기간" value={exp.date} onChange={v => updateArrayItem('experiences', i, { date: v })} placeholder="2025.03. ~ 2025.06." />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <InputField label="역할" value={exp.role} onChange={v => updateArrayItem('experiences', i, { role: v })} placeholder="팀장 / 개발자" />
                    <InputField label="링크 (선택)" value={exp.link} onChange={v => updateArrayItem('experiences', i, { link: v })} placeholder="https://..." />
                    <InputField label="썸네일 URL (선택)" value={exp.thumbnailUrl} onChange={v => updateArrayItem('experiences', i, { thumbnailUrl: v })} placeholder="https://...jpg" />
                  </div>

                  {/* 상태 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">상태 (Status)</label>
                    <div className="flex gap-2">
                      {STATUS_OPTIONS.map(s => (
                        <button key={s.value} onClick={() => updateArrayItem('experiences', i, { status: s.value })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${exp.status === s.value ? `${s.color} border-transparent ring-2 ring-offset-1 ring-gray-300` : 'bg-white border-surface-200 text-gray-400 hover:bg-surface-50'}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 분류 태그 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">분류 (Classify)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CLASSIFY_OPTIONS.map(tag => (
                        <button key={tag} onClick={() => toggleClassify(i, tag)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${(exp.classify || []).includes(tag) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white border-surface-200 text-gray-400 hover:bg-surface-50'}`}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 스킬 태그 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Skills</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(exp.skills || []).map((sk, si) => (
                        <span key={si} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                          {sk}
                          <button onClick={() => removeSkill(i, si)} className="text-gray-400 hover:text-red-400"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                    <input
                      placeholder="스킬 입력 후 Enter"
                      className="px-3 py-1.5 border border-surface-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary-200 w-48"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(i, e.target.value); e.target.value = ''; } }}
                    />
                  </div>

                  {/* 간단 설명 */}
                  <TextareaField label="소개 (간단 설명)" value={exp.description} onChange={v => updateArrayItem('experiences', i, { description: v })}
                    placeholder="프로젝트에 대한 간단한 소개를 작성하세요..." rows={3} />

                  {/* 상세 섹션들 (소개, 참여 동기, 활동 내용, 느낀 점, ...) */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">상세 섹션 (소개, 참여 동기, 활동 내용 등)</label>
                    <div className="space-y-3">
                      {(exp.sections || []).map((sec, si) => (
                        <div key={si} className="p-3 bg-white rounded-xl border border-surface-200">
                          <div className="flex items-center justify-between mb-2">
                            <input
                              value={sec.title}
                              onChange={e => updateSection(i, si, { title: e.target.value })}
                              placeholder="섹션 제목 (예: 참여 동기, 활동 내용, 느낀 점)"
                              className="text-sm font-bold text-gray-700 outline-none flex-1 bg-transparent"
                            />
                            <button onClick={() => removeSection(i, si)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>
                          </div>
                          <textarea
                            value={sec.content}
                            onChange={e => updateSection(i, si, { content: e.target.value })}
                            placeholder="이 섹션의 상세 내용을 작성하세요..."
                            rows={4}
                            className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-y"
                          />
                        </div>
                      ))}
                      <button onClick={() => addSection(i)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-surface-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600">
                        <Plus size={12} /> 섹션 추가
                      </button>
                    </div>
                  </div>

                  {/* 기업 맞춤 변환 */}
                  {portfolio.jobAnalysis && (
                    <div className="border-t border-surface-100 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">🎯 기업 맞춤 변환</span>
                        <button
                          onClick={() => handleTailorExperience(i)}
                          disabled={tailoringIdx === i}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {tailoringIdx === i ? (
                            <><Loader2 size={12} className="animate-spin" /> 분석 중...</>
                          ) : (
                            <><Sparkles size={12} /> {portfolio.jobAnalysis.company}에 맞게 변환</>
                          )}
                        </button>
                      </div>
                      {tailorResult && tailorResult.idx === i && (
                        <div className="bg-indigo-50 rounded-xl p-4 space-y-3 text-xs">
                          <div>
                            <span className="font-bold text-indigo-700">맞춤 소개:</span>
                            <p className="text-gray-700 mt-1 leading-relaxed">{tailorResult.tailoredDescription}</p>
                          </div>
                          {tailorResult.subtitle && (
                            <div>
                              <span className="font-bold text-indigo-700">한줄 소개:</span>
                              <p className="text-gray-700 mt-1">{tailorResult.subtitle}</p>
                            </div>
                          )}
                          {tailorResult.keyAchievements?.length > 0 && (
                            <div>
                              <span className="font-bold text-indigo-700">강조 성과:</span>
                              <ul className="mt-1 space-y-0.5">
                                {tailorResult.keyAchievements.map((a, ai) => (
                                  <li key={ai} className="text-gray-700">✓ {a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {tailorResult.relevanceNote && (
                            <div>
                              <span className="font-bold text-indigo-700">적합도:</span>
                              <p className="text-gray-700 mt-1">{tailorResult.relevanceNote}</p>
                            </div>
                          )}
                          <button
                            onClick={() => applyTailoredResult(i)}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                          >
                            ✨ 이 내용으로 적용하기
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex gap-2">
          <button onClick={() => addToArray('experiences', {
            date: '', title: '', description: '', role: '', link: '',
            framework: '', frameworkContent: {}, keywords: [], aiSummary: '',
            thumbnailUrl: '', status: 'doing', classify: [], skills: [], sections: []
          })}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 직접 추가
          </button>
          <div className="relative">
            <button onClick={() => setShowExpPicker(!showExpPicker)}
              className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-violet-300 rounded-xl text-sm text-violet-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all">
              <Upload size={14} /> 경험 DB에서 불러오기
            </button>
            {showExpPicker && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-surface-200 rounded-xl shadow-lg z-20 max-h-60 overflow-auto">
                {userExperiences.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">정리된 경험이 없습니다</p>
                ) : userExperiences.map(ue => (
                  <button key={ue.id} onClick={() => importExperience(ue)}
                    className="w-full text-left px-4 py-3 hover:bg-surface-50 border-b border-surface-100 last:border-0">
                    <p className="text-sm font-medium">{ue.title}</p>
                    <p className="text-xs text-gray-400">{ue.framework}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Curricular Section ──
function CurricularSection({ portfolio, update, updateNested }) {
  const curr = portfolio.curricular || { summary: { credits: '', gpa: '' }, courses: [], creditStatus: [] };

  const updateCurrField = (field, value) => {
    update('curricular', { ...curr, [field]: value });
  };

  const addCourse = () => {
    updateCurrField('courses', [...(curr.courses || []), { semester: '', name: '', grade: '' }]);
  };
  const removeCourse = (idx) => {
    updateCurrField('courses', curr.courses.filter((_, i) => i !== idx));
  };
  const updateCourse = (idx, changes) => {
    const courses = [...curr.courses];
    courses[idx] = { ...courses[idx], ...changes };
    updateCurrField('courses', courses);
  };

  return (
    <>
      <SectionCard title="교과 활동 | Curricular Activities" icon={BookOpen} description="이수 학점, 평점, 수강 내역 등을 입력하세요">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <InputField label="이수 학점 요약" value={curr.summary?.credits}
            onChange={v => updateCurrField('summary', { ...curr.summary, credits: v })} placeholder="총 00학점 이수" />
          <InputField label="평점 평균 (GPA)" value={curr.summary?.gpa}
            onChange={v => updateCurrField('summary', { ...curr.summary, gpa: v })} placeholder="4.0 / 4.5" />
        </div>
      </SectionCard>

      <SectionCard title="교과목 수강 내역 | Course History" icon={BookOpen}>
        <div className="space-y-2">
          {(curr.courses || []).map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="grid grid-cols-3 gap-3 flex-1">
                <InputField label="학기" value={c.semester} onChange={v => updateCourse(i, { semester: v })} placeholder="2024-1" />
                <InputField label="과목명" value={c.name} onChange={v => updateCourse(i, { name: v })} placeholder="이산수학" />
                <InputField label="성적" value={c.grade} onChange={v => updateCourse(i, { grade: v })} placeholder="A+" />
              </div>
              <button onClick={() => removeCourse(i)} className="p-1.5 text-gray-300 hover:text-red-400 mt-5"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={addCourse}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 과목 추가
          </button>
        </div>
      </SectionCard>
    </>
  );
}

// ── Extracurricular Section ──
function ExtracurricularSection({ portfolio, update, updateNested }) {
  const extra = portfolio.extracurricular || { summary: '', badges: [], languages: [], details: [] };

  const updateExtraField = (field, value) => {
    update('extracurricular', { ...extra, [field]: value });
  };

  const addDetail = () => {
    updateExtraField('details', [...(extra.details || []), { title: '', description: '', period: '' }]);
  };
  const removeDetail = (idx) => {
    updateExtraField('details', extra.details.filter((_, i) => i !== idx));
  };
  const updateDetail = (idx, changes) => {
    const details = [...extra.details];
    details[idx] = { ...details[idx], ...changes };
    updateExtraField('details', details);
  };

  const addBadge = () => {
    updateExtraField('badges', [...(extra.badges || []), { name: '', issuer: '' }]);
  };
  const removeBadge = (idx) => {
    updateExtraField('badges', extra.badges.filter((_, i) => i !== idx));
  };
  const updateBadge = (idx, changes) => {
    const badges = [...extra.badges];
    badges[idx] = { ...badges[idx], ...changes };
    updateExtraField('badges', badges);
  };

  const addLang = () => {
    updateExtraField('languages', [...(extra.languages || []), { name: '', score: '', date: '' }]);
  };
  const removeLang = (idx) => {
    updateExtraField('languages', extra.languages.filter((_, i) => i !== idx));
  };
  const updateLang = (idx, changes) => {
    const languages = [...extra.languages];
    languages[idx] = { ...languages[idx], ...changes };
    updateExtraField('languages', languages);
  };

  return (
    <>
      <SectionCard title="비교과 활동 | Extracurricular Activities" icon={Star} description="비교과 프로그램, 디지털 배지, 어학 성적 등을 입력하세요">
        <TextareaField label="비교과 요약" value={extra.summary} onChange={v => updateExtraField('summary', v)}
          placeholder="비교과 프로그램 이수 내역, 졸업 요건 충족 현황 등을 자유롭게 적어주세요" rows={3} />
      </SectionCard>

      <SectionCard title="디지털 배지 | Digital Badge" icon={Award}>
        <div className="space-y-2">
          {(extra.badges || []).map((b, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="grid grid-cols-2 gap-3 flex-1">
                <InputField label="배지명" value={b.name} onChange={v => updateBadge(i, { name: v })} placeholder="SKKU Tutoring: Tutor" />
                <InputField label="발급기관" value={b.issuer} onChange={v => updateBadge(i, { issuer: v })} placeholder="Lecos" />
              </div>
              <button onClick={() => removeBadge(i)} className="p-1.5 text-gray-300 hover:text-red-400 mt-5"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={addBadge}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 배지 추가
          </button>
        </div>
      </SectionCard>

      <SectionCard title="어학 성적 | Language Certification" icon={Globe}>
        <div className="space-y-2">
          {(extra.languages || []).map((l, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="grid grid-cols-3 gap-3 flex-1">
                <InputField label="시험명" value={l.name} onChange={v => updateLang(i, { name: v })} placeholder="TOEIC" />
                <InputField label="점수/등급" value={l.score} onChange={v => updateLang(i, { score: v })} placeholder="900" />
                <InputField label="취득일" value={l.date} onChange={v => updateLang(i, { date: v })} placeholder="2025.03" />
              </div>
              <button onClick={() => removeLang(i)} className="p-1.5 text-gray-300 hover:text-red-400 mt-5"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={addLang}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 어학 성적 추가
          </button>
        </div>
      </SectionCard>

      <SectionCard title="세부 사항 | Details" icon={Star}>
        <div className="space-y-3">
          {(extra.details || []).map((d, i) => (
            <div key={i} className="p-4 bg-surface-50 rounded-xl border border-surface-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-700">활동 #{i + 1}</span>
                <button onClick={() => removeDetail(i)} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 mb-2">
                <InputField label="기간" value={d.period} onChange={v => updateDetail(i, { period: v })} placeholder="2025.01 - 2025.06" />
                <InputField label="활동명" value={d.title} onChange={v => updateDetail(i, { title: v })} placeholder="학술동아리 MIMIC" />
              </div>
              <TextareaField label="설명" value={d.description} onChange={v => updateDetail(i, { description: v })}
                placeholder="활동 소개, 참여 동기, 활동 내용 등" rows={3} />
            </div>
          ))}
          <button onClick={addDetail}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 활동 추가
          </button>
        </div>
      </SectionCard>
    </>
  );
}

// ── Skills Section ──
function SkillsSection({ portfolio, update }) {
  const skills = portfolio.skills || { tools: [], languages: [], frameworks: [], others: [] };

  const updateSkillCategory = (category, value) => {
    update('skills', { ...skills, [category]: value });
  };

  const SkillList = ({ category, label, placeholder }) => (
    <div className="mb-4">
      <label className="block text-xs text-gray-500 mb-2 font-medium">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {(skills[category] || []).map((skill, i) => (
          <span key={i} className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm">
            {skill}
            <button onClick={() => {
              const arr = [...skills[category]];
              arr.splice(i, 1);
              updateSkillCategory(category, arr);
            }} className="hover:text-red-500"><X size={12} /></button>
          </span>
        ))}
      </div>
      <input
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
        onKeyDown={e => {
          if (e.key === 'Enter' && e.target.value.trim()) {
            updateSkillCategory(category, [...(skills[category] || []), e.target.value.trim()]);
            e.target.value = '';
          }
        }}
      />
      <p className="text-xs text-gray-400 mt-1">Enter를 눌러 추가</p>
    </div>
  );

  return (
    <SectionCard title="기술 | Skills" icon={Code} description="도구, 프로그래밍 언어, 프레임워크 등을 키워드로 추가하세요">
      <SkillList category="tools" label="도구 (Tools)" placeholder="Notion, LaTeX, Figma..." />
      <SkillList category="languages" label="프로그래밍 언어" placeholder="Python, JavaScript, C++..." />
      <SkillList category="frameworks" label="프레임워크/라이브러리" placeholder="React, TensorFlow, PyTorch..." />
      <SkillList category="others" label="기타 역량" placeholder="데이터 분석, 수학적 모델링..." />
    </SectionCard>
  );
}

// ── Goals Section ──
function GoalsSection({ portfolio, addToArray, removeFromArray, updateArrayItem }) {
  return (
    <SectionCard title="목표와 계획 | Future Plans" icon={Target} description="단기/장기 목표를 적어보세요">
      <div className="space-y-3">
        {(portfolio.goals || []).map((goal, i) => (
          <div key={i} className="p-4 bg-surface-50 rounded-xl border border-surface-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <select
                  value={goal.type || 'short'}
                  onChange={e => updateArrayItem('goals', i, { type: e.target.value })}
                  className="px-2 py-1 border border-surface-200 rounded-lg text-xs outline-none"
                >
                  <option value="short">단기 목표</option>
                  <option value="mid">중기 목표</option>
                  <option value="long">장기 목표</option>
                </select>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  goal.status === 'done' ? 'bg-green-100 text-green-700'
                    : goal.status === 'ing' ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                }`}>
                  {goal.status === 'done' ? '완료' : goal.status === 'ing' ? '진행 중' : '예정'}
                </span>
              </div>
              <button onClick={() => removeFromArray('goals', i)} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
            <InputField label="목표" value={goal.title} onChange={v => updateArrayItem('goals', i, { title: v })} placeholder="목표명" className="mb-2" />
            <TextareaField label="상세 계획" value={goal.description} onChange={v => updateArrayItem('goals', i, { description: v })}
              placeholder="구체적인 계획과 기한..." rows={2} />
            <div className="mt-2">
              <select
                value={goal.status || 'planned'}
                onChange={e => updateArrayItem('goals', i, { status: e.target.value })}
                className="px-2 py-1 border border-surface-200 rounded-lg text-xs outline-none"
              >
                <option value="planned">예정</option>
                <option value="ing">진행 중</option>
                <option value="done">완료</option>
              </select>
            </div>
          </div>
        ))}
        <button onClick={() => addToArray('goals', { title: '', description: '', type: 'short', status: 'planned' })}
          className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Plus size={14} /> 목표 추가
        </button>
      </div>
    </SectionCard>
  );
}

// ── Values Section ──
function ValuesSection({ portfolio, update }) {
  return (
    <SectionCard title="가치관 | Values" icon={MessageSquare} description="포트폴리오 하단에 표시되는 자기소개 에세이를 작성하세요">
      <TextareaField label="가치관 에세이" value={portfolio.valuesEssay}
        onChange={v => update('valuesEssay', v)}
        placeholder="제가 추구하는 가치와 신념에 대해 자유롭게 작성해주세요. 이 내용은 포트폴리오의 '가치관' 섹션에 표시됩니다..." rows={10} />
    </SectionCard>
  );
}

// ── Contact Section ──
function ContactSection({ portfolio, updateNested }) {
  const contact = portfolio.contact || {};
  return (
    <SectionCard title="연락처 | Contact Information" icon={Mail} description="SNS, 이메일 등 연락 수단을 입력하세요">
      <div className="grid grid-cols-2 gap-4">
        <InputField label="전화번호" value={contact.phone} onChange={v => updateNested('contact', 'phone', v)} placeholder="+82 10-0000-0000" />
        <InputField label="이메일" value={contact.email} onChange={v => updateNested('contact', 'email', v)} placeholder="email@example.com" />
        <InputField label="LinkedIn" value={contact.linkedin} onChange={v => updateNested('contact', 'linkedin', v)} placeholder="www.linkedin.com/in/..." />
        <InputField label="Instagram" value={contact.instagram} onChange={v => updateNested('contact', 'instagram', v)} placeholder="@username" />
        <InputField label="GitHub" value={contact.github} onChange={v => updateNested('contact', 'github', v)} placeholder="github.com/username" />
        <InputField label="웹사이트" value={contact.website} onChange={v => updateNested('contact', 'website', v)} placeholder="https://..." />
      </div>
    </SectionCard>
  );
}
