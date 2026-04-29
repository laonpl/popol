import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, MapPin, Calendar, GraduationCap, Phone, Mail, Globe,
  Code, Wrench, BookOpen, Check, X, Plus, Loader2, Search
} from 'lucide-react';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';

const DEGREE_OPTIONS = ['학사 재학', '학사 졸업', '학사 수료', '석사 재학', '석사 졸업', '석사 수료', '박사 재학', '박사 졸업', '박사 수료', '전문학사', '고등학교 졸업'];
const LANGUAGE_TEST_OPTIONS = ['TOEIC', 'TOEFL', 'IELTS', 'TOEIC Speaking', 'OPIc', 'JLPT', 'JPT', 'HSK', 'DELF/DALF', 'DELE', 'TestDaF'];

const PRESET_TOOLS = ['Notion', 'Figma', 'Photoshop', 'Illustrator', 'Canva', 'Slack', 'Jira', 'Trello', 'Google Analytics', 'Excel', 'PowerPoint', 'Premiere Pro', 'After Effects', 'Sketch', 'Miro', 'Zeplin', 'InDesign', 'Lightroom', 'Blender', 'AutoCAD', 'GitHub', 'VS Code'];
const PRESET_LANGUAGES = ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'Ruby', 'PHP', 'R', 'MATLAB', 'SQL', 'HTML/CSS', 'Dart', 'Scala', 'Perl'];
const PRESET_FRAMEWORKS = ['React', 'Vue.js', 'Angular', 'Next.js', 'Spring', 'Django', 'Flask', 'Express.js', 'Node.js', 'TensorFlow', 'PyTorch', 'Flutter', 'React Native', 'Svelte', 'Tailwind CSS', 'Bootstrap', 'Laravel', 'FastAPI', 'NestJS', '.NET'];
const PRESET_OTHERS = ['데이터 분석', 'UI/UX 디자인', '프로젝트 관리', '기획', '마케팅', '글쓰기', '발표', '리더십'];

const PROFICIENCY_LEVELS = [
  { value: 1, label: '기초', color: 'bg-gray-300' },
  { value: 2, label: '초급', color: 'bg-blue-300' },
  { value: 3, label: '중급', color: 'bg-green-400' },
  { value: 4, label: '상급', color: 'bg-amber-400' },
  { value: 5, label: '전문가', color: 'bg-red-400' },
];

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user, profile, saveProfile } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const getSkipKey = () => user?.uid ? `profile-setup-skipped:${user.uid}` : null;
  const markProfileSetupSkipped = () => {
    const key = getSkipKey();
    if (key) localStorage.setItem(key, 'true');
  };
  const clearProfileSetupSkipped = () => {
    const key = getSkipKey();
    if (key) localStorage.removeItem(key);
  };

  const [form, setForm] = useState({
    nameKo: '',
    nameEn: '',
    location: '',
    birthDate: '',
    phone: '',
    email: '',
    education: [{ school: '', degree: '', period: '', major: '' }],
    languageScores: [],
    tools: [],
    programmingLanguages: [],
    frameworks: [],
    others: [],
  });

  useEffect(() => {
    if (profile) {
      setForm(prev => ({
        ...prev,
        nameKo: profile.nameKo || user?.displayName || '',
        nameEn: profile.nameEn || '',
        location: profile.location || '',
        birthDate: profile.birthDate || '',
        phone: profile.phone || '',
        email: profile.email || user?.email || '',
        education: profile.education?.length > 0
          ? profile.education
          : [{ school: '', degree: '', period: '', major: '' }],
        languageScores: profile.languageScores || [],
        tools: profile.tools || [],
        programmingLanguages: profile.programmingLanguages || [],
        frameworks: profile.frameworks || [],
        others: profile.others || [],
      }));
    } else {
      setForm(prev => ({
        ...prev,
        nameKo: user?.displayName || '',
        email: user?.email || '',
      }));
    }
  }, [profile, user]);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // 컴포넌트 마운트 시 스크립트 미리 로드 (클릭과 무관하게 준비)
  useEffect(() => {
    if (window.daum?.Postcode) return;
    const s = document.createElement('script');
    s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    document.head.appendChild(s);
  }, []);

  // 클릭 즉시 동기 호출 → 팝업 차단기 우회
  const openAddressSearch = () => {
    if (!window.daum?.Postcode) {
      toast.error('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        update('location', data.roadAddress || data.jibunAddress || data.address);
      },
    }).open();
  };

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const handleSubmit = async () => {
    const nameKo = form.nameKo.trim();
    const nameEn = form.nameEn.trim();
    const location = form.location.trim();
    const birthDate = form.birthDate.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();

    // 이름 (한글)
    if (!nameKo) { toast.error('이름(한글)을 입력해주세요'); return; }
    if (!/^[가-힣]{2,10}$/.test(nameKo)) {
      toast.error('이름(한글)은 한글 2~10자로 입력해주세요 (공백·숫자·특수문자 불가)'); return;
    }

    // 이름 (영문) - 선택이지만 입력 시 형식 검증
    if (nameEn && !/^[a-zA-Z][a-zA-Z\s\-\.]{1,}$/.test(nameEn)) {
      toast.error('이름(영문)은 영문자만 입력 가능합니다'); return;
    }

    // 거주지
    if (!location) { toast.error('거주지를 입력해주세요'); return; }
    if (location.length < 5) { toast.error('유효한 주소를 입력해주세요 (주소 검색 버튼을 이용하세요)'); return; }

    // 생년월일
    if (!birthDate) { toast.error('생년월일을 입력해주세요'); return; }
    const bParts = birthDate.split('.');
    const birthYear = parseInt(bParts[0]);
    const currentYear = new Date().getFullYear();
    if (isNaN(birthYear) || birthYear < 1940 || birthYear > currentYear - 15) {
      toast.error(`생년월일은 1940년 ~ ${currentYear - 15}년생까지 입력 가능합니다`); return;
    }

    // 전화번호
    if (!phone) { toast.error('전화번호를 입력해주세요'); return; }
    const phoneDigits = phone.replace(/[-\s]/g, '');
    if (!/^0[0-9]{9,10}$/.test(phoneDigits)) {
      toast.error('올바른 전화번호를 입력해주세요 (예: 010-1234-5678)'); return;
    }

    // 이메일
    if (!email) { toast.error('이메일을 입력해주세요'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast.error('올바른 이메일 형식으로 입력해주세요'); return;
    }

    // 학력
    const validEducation = form.education.filter(e => e.school.trim());
    if (validEducation.length === 0) { toast.error('학력을 하나 이상 입력해주세요'); return; }
    for (const edu of validEducation) {
      if (edu.school.trim().length < 2) { toast.error('학교명을 2자 이상 입력해주세요'); return; }
      if (!edu.degree) { toast.error('학위/과정을 선택해주세요'); return; }
      if (!edu.period.trim()) { toast.error('재학 기간을 입력해주세요 (예: 2020.03 - 현재)'); return; }
      if (!/\d{4}/.test(edu.period)) { toast.error('재학 기간에 연도(YYYY)를 포함해주세요 (예: 2020.03 - 현재)'); return; }
    }

    // 어학 성적 (입력된 항목 검증)
    for (const lang of form.languageScores) {
      if (!lang.name.trim()) { toast.error('어학 성적 시험명을 입력하거나 해당 항목을 삭제해주세요'); return; }
      if (!lang.score.trim()) { toast.error('어학 성적 점수/등급을 입력해주세요'); return; }
    }

    setSaving(true);
    try {
      await saveProfile({
        nameKo,
        nameEn,
        location,
        birthDate,
        phone,
        email,
        education: validEducation,
        languageScores: form.languageScores.filter(l => l.name.trim()),
        tools: form.tools.filter(Boolean),
        programmingLanguages: form.programmingLanguages.filter(Boolean),
        frameworks: form.frameworks.filter(Boolean),
        others: form.others.filter(Boolean),
      });
      clearProfileSetupSkipped();
      toast.success('프로필이 저장되었습니다!');
      navigate('/app');
    } catch (err) {
      toast.error('프로필 저장에 실패했습니다');
    }
    setSaving(false);
  };

  const addEducation = () => update('education', [...form.education, { school: '', degree: '', period: '', major: '' }]);
  const removeEducation = (i) => update('education', form.education.filter((_, idx) => idx !== i));
  const updateEducation = (i, field, value) => {
    const arr = [...form.education];
    arr[i] = { ...arr[i], [field]: value };
    update('education', arr);
  };

  const addLang = () => update('languageScores', [...form.languageScores, { name: '', score: '', date: '' }]);
  const removeLang = (i) => update('languageScores', form.languageScores.filter((_, idx) => idx !== i));
  const updateLang = (i, field, value) => {
    const arr = [...form.languageScores];
    arr[i] = { ...arr[i], [field]: value };
    update('languageScores', arr);
  };

  const SkillBubbleInput = ({ label, icon: Icon, field, presets, placeholder }) => {
    const [customInput, setCustomInput] = useState('');
    const [showProficiency, setShowProficiency] = useState(null);
    const selectedItems = form[field] || [];

    const getItemName = (item) => typeof item === 'string' ? item : item.name;
    const getItemProficiency = (item) => typeof item === 'string' ? 0 : (item.proficiency || 0);
    const selectedNames = selectedItems.map(getItemName);

    const toggleSkill = (name) => {
      if (selectedNames.includes(name)) {
        update(field, selectedItems.filter(item => getItemName(item) !== name));
      } else {
        update(field, [...selectedItems, { name, proficiency: 3 }]);
      }
    };

    const setProficiency = (name, level) => {
      update(field, selectedItems.map(item =>
        getItemName(item) === name
          ? { name: getItemName(item), proficiency: level }
          : (typeof item === 'string' ? { name: item, proficiency: 0 } : item)
      ));
      setShowProficiency(null);
    };

    const addCustom = () => {
      const val = customInput.trim();
      if (!val || selectedNames.includes(val)) return;
      update(field, [...selectedItems, { name: val, proficiency: 3 }]);
      setCustomInput('');
    };

    return (
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
          <Icon size={13} /> {label} <span className="text-gray-300">(선택)</span>
        </label>

        {selectedItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedItems.map((item, i) => {
              const name = getItemName(item);
              const prof = getItemProficiency(item);
              return (
                <div key={i} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProficiency(showProficiency === name ? null : name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium border border-primary-200 hover:bg-primary-100 transition-colors"
                  >
                    {name}
                    {prof > 0 && (
                      <span className="flex gap-0.5 ml-1">
                        {[1,2,3,4,5].map(l => (
                          <span key={l} className={`w-1.5 h-3 rounded-sm ${l <= prof ? PROFICIENCY_LEVELS[prof-1].color : 'bg-gray-200'}`} />
                        ))}
                      </span>
                    )}
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); toggleSkill(name); }}
                      className="hover:text-red-500 ml-0.5"
                    >
                      <X size={11} />
                    </span>
                  </button>
                  {showProficiency === name && (
                    <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-surface-200 rounded-xl shadow-lg p-2 min-w-[160px]">
                      <p className="text-[10px] text-gray-400 mb-1.5 px-1">수준 설정</p>
                      {PROFICIENCY_LEVELS.map(lv => (
                        <button
                          key={lv.value}
                          type="button"
                          onClick={() => setProficiency(name, lv.value)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-surface-50 transition-colors ${prof === lv.value ? 'bg-primary-50 text-primary-700' : 'text-gray-600'}`}
                        >
                          <span className="flex gap-0.5">
                            {[1,2,3,4,5].map(l => (
                              <span key={l} className={`w-1.5 h-3 rounded-sm ${l <= lv.value ? lv.color : 'bg-gray-200'}`} />
                            ))}
                          </span>
                          {lv.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-2">
          {presets.map(name => {
            const isSelected = selectedNames.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleSkill(name)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  isSelected
                    ? 'bg-primary-100 text-primary-700 border-primary-300'
                    : 'bg-surface-50 text-gray-500 border-surface-200 hover:border-primary-300 hover:text-primary-600'
                }`}
              >
                {isSelected && <Check size={10} className="inline mr-0.5 -mt-0.5" />}
                {name}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          />
          <button
            type="button"
            onClick={addCustom}
            className="px-3 py-2 bg-surface-100 text-gray-500 rounded-lg text-sm hover:bg-surface-200 transition-colors"
          >
            추가
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] via-white to-primary-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-bluewood-900 mb-2">기초 정보 설정</h1>
          <p className="text-sm text-gray-500">
            포트폴리오 작성 시 자동으로 채워지는 기본 정보입니다.<br />
            <span className="text-red-400">*</span> 표시는 필수 항목입니다.
          </p>
          <div className="mt-5 inline-flex flex-col items-center gap-2">
            <p className="text-[12px] text-gray-400 font-medium">지금 당장 하지 않아도 나중에 추가할 수 있어요</p>
            <button
              onClick={() => {
                markProfileSetupSkipped();
                navigate('/app');
              }}
              className="text-[13px] text-gray-400 font-semibold underline underline-offset-2 hover:text-gray-600 transition-colors"
            >
              건너뛰기
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <Section title="기본 정보" icon={User}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="이름 (한글)" required value={form.nameKo}
                onChange={v => update('nameKo', v)} placeholder="홍길동" />
              <Field label="이름 (영문)" value={form.nameEn}
                onChange={v => update('nameEn', v)} placeholder="Gil-dong Hong" optional />

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  거주지 <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={form.location || ''}
                      onChange={e => update('location', e.target.value)}
                      placeholder="주소 검색을 눌러주세요"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={openAddressSearch}
                    className="flex items-center gap-1 px-3 py-2 bg-primary-50 text-primary-600 border border-primary-200 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors whitespace-nowrap"
                  >
                    <Search size={13} /> 주소 검색
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  생년월일 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    value={form.birthDate ? form.birthDate.replace(/\./g, '-') : ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val) {
                        const [y, m, d] = val.split('-');
                        update('birthDate', `${y}.${m}.${d}`);
                      } else {
                        update('birthDate', '');
                      }
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    min="1950-01-01"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-200"
                  />
                </div>
              </div>

              <Field label="전화번호" required value={form.phone}
                onChange={v => update('phone', v)} placeholder="010-0000-0000" icon={Phone} />
              <Field label="이메일" required value={form.email}
                onChange={v => update('email', v)} placeholder="example@email.com" icon={Mail} />
            </div>
          </Section>

          <Section title="학력" icon={GraduationCap} required>
            <div className="space-y-4">
              {form.education.map((edu, i) => (
                <div key={i} className="relative p-4 bg-surface-50 rounded-xl border border-surface-100">
                  {form.education.length > 1 && (
                    <button type="button" onClick={() => removeEducation(i)}
                      className="absolute top-3 right-3 p-1 text-gray-300 hover:text-red-400">
                      <X size={14} />
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="학교명" value={edu.school} required
                      onChange={v => updateEducation(i, 'school', v)} placeholder="가천대학교" small />
                    <Field label="전공" value={edu.major}
                      onChange={v => updateEducation(i, 'major', v)} placeholder="컴퓨터공학과" small />
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">학위/과정</label>
                      <select
                        value={edu.degree || ''}
                        onChange={e => updateEducation(i, 'degree', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-200 bg-white"
                      >
                        <option value="">선택해주세요</option>
                        {DEGREE_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <Field label="기간" value={edu.period}
                      onChange={v => updateEducation(i, 'period', v)} placeholder="2020.03 - 현재" small />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addEducation}
                className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
                <Plus size={13} /> 학력 추가
              </button>
            </div>
          </Section>

          <Section title="어학 성적" icon={Globe} optional>
            <div className="space-y-3">
              {form.languageScores.map((lang, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
                  <div className="grid grid-cols-3 gap-3 flex-1">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">시험명</label>
                      <select
                        value={LANGUAGE_TEST_OPTIONS.includes(lang.name) ? lang.name : (lang.name ? '__custom__' : '')}
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            updateLang(i, 'name', '');
                          } else {
                            updateLang(i, 'name', e.target.value);
                          }
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-200 bg-white"
                      >
                        <option value="">선택</option>
                        {LANGUAGE_TEST_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                        <option value="__custom__">직접 입력</option>
                      </select>
                      {lang.name && !LANGUAGE_TEST_OPTIONS.includes(lang.name) && (
                        <input
                          value={lang.name}
                          onChange={e => updateLang(i, 'name', e.target.value)}
                          placeholder="시험명 직접 입력"
                          className="w-full mt-1 px-3 py-1.5 text-xs border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-200"
                        />
                      )}
                    </div>
                    <Field label="점수/등급" value={lang.score}
                      onChange={v => updateLang(i, 'score', v)} placeholder="900" small />
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">취득일</label>
                      <input
                        type="month"
                        value={lang.date ? lang.date.replace(/\./g, '-').replace(/-$/, '') : ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (val) {
                            const [y, m] = val.split('-');
                            updateLang(i, 'date', `${y}.${m}`);
                          } else {
                            updateLang(i, 'date', '');
                          }
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    </div>
                  </div>
                  <button type="button" onClick={() => removeLang(i)}
                    className="p-1.5 text-gray-300 hover:text-red-400 mt-4">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addLang}
                className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
                <Plus size={13} /> 어학 성적 추가
              </button>
            </div>
          </Section>

          <Section title="기술 / 도구" icon={Wrench} optional>
            <div className="space-y-6">
              <SkillBubbleInput label="도구 (Tools)" icon={Wrench} field="tools"
                presets={PRESET_TOOLS} placeholder="기타 도구 직접 입력..." />
              <SkillBubbleInput label="프로그래밍 언어" icon={Code} field="programmingLanguages"
                presets={PRESET_LANGUAGES} placeholder="기타 언어 직접 입력..." />
              <SkillBubbleInput label="프레임워크/라이브러리" icon={BookOpen} field="frameworks"
                presets={PRESET_FRAMEWORKS} placeholder="기타 프레임워크 입력..." />
              <SkillBubbleInput label="기타 역량" icon={Check} field="others"
                presets={PRESET_OTHERS} placeholder="기타 역량 직접 입력..." />
            </div>
          </Section>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-2xl text-base font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-lg shadow-primary-200"
          >
            {saving ? (
              <><Loader2 size={18} className="animate-spin" /> 저장 중...</>
            ) : (
              <><Check size={18} /> 프로필 저장하고 시작하기</>
            )}
          </button>

          <button
            onClick={() => {
              markProfileSetupSkipped();
              navigate('/app');
            }}
            className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            건너뛰기
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, required, optional }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-primary-600" />
        <h2 className="text-sm font-bold text-bluewood-900">{title}</h2>
        {required && <span className="text-red-400 text-xs">*필수</span>}
        {optional && <span className="text-gray-300 text-xs">(선택)</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required, optional, icon: Icon, small }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
        {optional && <span className="text-gray-300">(선택)</span>}
      </label>
      <div className="relative">
        {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 ${small ? 'py-1.5 text-xs' : 'py-2 text-sm'} border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-200`}
        />
      </div>
    </div>
  );
}
