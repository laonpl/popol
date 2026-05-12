import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, MapPin, Calendar, GraduationCap, Phone, Mail, Globe,
  Code, Wrench, BookOpen, Check, X, Plus, Loader2, Search, Lock, Eye, EyeOff
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
  const { user, profile, saveProfile, changePassword, skipProfileSetup } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [skipSaving, setSkipSaving] = useState(false);

  // 비밀번호 변경
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const isEmailUser = user?.providerData?.[0]?.providerId === 'password';

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.current) { toast.error('현재 비밀번호를 입력해주세요'); return; }
    if (pwForm.next.length < 6) { toast.error('새 비밀번호는 6자 이상이어야 합니다'); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error('비밀번호가 일치하지 않습니다'); return; }
    setPwSaving(true);
    try {
      await changePassword(pwForm.current, pwForm.next);
      toast.success('비밀번호가 변경됐습니다');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('현재 비밀번호가 올바르지 않습니다');
      } else if (err.message === 'no-email') {
        toast.error('소셜 로그인 계정은 비밀번호를 변경할 수 없습니다');
      } else {
        toast.error('비밀번호 변경에 실패했습니다');
      }
    } finally {
      setPwSaving(false);
    }
  };

  const handleSkipProfileSetup = async () => {
    setSkipSaving(true);
    try {
      await skipProfileSetup();
      navigate('/app');
    } catch {
      toast.error('건너뛰기 상태 저장에 실패했습니다');
    } finally {
      setSkipSaving(false);
    }
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
        <label className="flex items-center gap-1.5 text-[13px] font-semibold text-bluewood-500 mb-2 uppercase tracking-wide">
          <Icon size={12} /> {label} <span className="text-bluewood-200 font-normal normal-case tracking-normal">(선택)</span>
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
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium border border-surface-200 text-bluewood-700 rounded-md hover:bg-surface-50 transition-colors"
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
                    <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-surface-100 shadow-md p-1.5 min-w-[140px]">
                      <p className="text-[20px] text-bluewood-300 mb-1.5 px-1">수준 설정</p>
                      {PROFICIENCY_LEVELS.map(lv => (
                        <button
                          key={lv.value}
                          type="button"
                          onClick={() => setProficiency(name, lv.value)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11.5px] hover:bg-surface-50 transition-colors ${prof === lv.value ? 'bg-bluewood-50 text-bluewood-800 font-semibold' : 'text-bluewood-500'}`}
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
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-bluewood-400 border-surface-200 hover:border-bluewood-300 hover:text-bluewood-600'
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
            className="flex-1 border-b border-surface-200 bg-transparent py-1 text-[12px] outline-none focus:border-bluewood-400 placeholder-bluewood-200 transition-colors text-bluewood-800"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          />
          <button
            type="button"
            onClick={addCustom}
            className="px-2 py-1 text-[11px] text-bluewood-500 border border-surface-200 rounded-md hover:bg-surface-50 transition-colors"
          >
            추가
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white py-8 px-6">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="mb-7 pb-5 border-b border-surface-100">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-bluewood-200 mb-2">Profile Setup</p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-bold tracking-[-0.02em] text-primary-600 leading-tight">기초 정보 설정</h1>
              <p className="mt-1 text-[13px] text-bluewood-400">
                포트폴리오 작성 시 자동으로 채워지는 기본 정보입니다. <span className="text-red-400">*</span>는 필수 항목입니다.
              </p>
            </div>
            <button
              onClick={handleSkipProfileSetup}
              disabled={skipSaving}
              className="flex-shrink-0 text-[13px] text-bluewood-300 hover:text-bluewood-600 transition-colors underline underline-offset-2"
            >
              {skipSaving ? '저장 중...' : '건너뛰기'}
            </button>
          </div>
        </div>

        {/* 2컬럼 레이아웃 */}
        <div className="grid grid-cols-2 gap-x-10 items-start">

          {/* ── 왼쪽: 기본 정보 + 학력 ── */}
          <div>
            <Section title="기본 정보" icon={User} noBorder>
              <div className="grid grid-cols-2 gap-4">
                <Field label="이름 (한글)" required value={form.nameKo}
                  onChange={v => update('nameKo', v)} placeholder="홍길동" maxLength={20} />
                <Field label="이름 (영문)" value={form.nameEn}
                  onChange={v => update('nameEn', v)} placeholder="Gil-dong Hong" optional maxLength={50} />

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[13px] font-semibold text-bluewood-500">
                      거주지 <span className="text-red-400">*</span>
                    </label>
                    <span className={`text-[11px] tabular-nums ${(form.location || '').length >= 100 ? 'text-red-400 font-semibold' : (form.location || '').length >= 85 ? 'text-amber-500' : 'text-gray-300'}`}>
                      {(form.location || '').length}/100
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-bluewood-300" />
                      <input
                        type="text"
                        value={form.location || ''}
                        onChange={e => update('location', e.target.value)}
                        placeholder="주소 검색을 눌러주세요"
                        maxLength={100}
                        className="w-full pl-4 pr-0 py-1.5 text-[13px] border-0 border-b border-surface-200 bg-transparent outline-none focus:border-bluewood-400 placeholder-bluewood-200 transition-colors text-bluewood-800"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={openAddressSearch}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-surface-200 text-bluewood-600 rounded-lg text-[11px] font-medium hover:bg-surface-50 transition-colors whitespace-nowrap"
                    >
                      <Search size={11} /> 주소 검색
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-bluewood-500 mb-1">
                    생년월일 <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={form.birthDate ? form.birthDate.split('.')[0] : ''}
                      onChange={e => {
                        const y = e.target.value;
                        const parts = (form.birthDate || '').split('.');
                        const m = parts[1] || '01'; const d = parts[2] || '01';
                        update('birthDate', y ? `${y}.${m}.${d}` : '');
                      }}
                      className="flex-[3] px-0 py-1.5 text-[13px] border-0 border-b border-surface-200 bg-transparent outline-none focus:border-bluewood-400 transition-colors appearance-none cursor-pointer text-bluewood-800"
                    >
                      <option value="">연도</option>
                      {Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={String(y)}>{y}년</option>
                      ))}
                    </select>
                    <select
                      value={form.birthDate ? (form.birthDate.split('.')[1] || '') : ''}
                      onChange={e => {
                        const m = e.target.value;
                        const parts = (form.birthDate || '').split('.');
                        const y = parts[0] || ''; const d = parts[2] || '01';
                        update('birthDate', y && m ? `${y}.${m}.${d}` : '');
                      }}
                      className="flex-[2] px-0 py-1.5 text-[13px] border-0 border-b border-surface-200 bg-transparent outline-none focus:border-bluewood-400 transition-colors appearance-none cursor-pointer text-bluewood-800"
                    >
                      <option value="">월</option>
                      {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                        <option key={m} value={m}>{i+1}월</option>
                      ))}
                    </select>
                    <select
                      value={form.birthDate ? (form.birthDate.split('.')[2] || '') : ''}
                      onChange={e => {
                        const d = e.target.value;
                        const parts = (form.birthDate || '').split('.');
                        const y = parts[0] || ''; const m = parts[1] || '01';
                        update('birthDate', y && m ? `${y}.${m}.${d || '01'}` : '');
                      }}
                      className="flex-[2] px-0 py-1.5 text-[13px] border-0 border-b border-surface-200 bg-transparent outline-none focus:border-bluewood-400 transition-colors appearance-none cursor-pointer text-bluewood-800"
                    >
                      <option value="">일</option>
                      {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                        <option key={d} value={d}>{parseInt(d)}일</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Field label="전화번호" required value={form.phone}
                  onChange={v => update('phone', v)} placeholder="010-0000-0000" icon={Phone} maxLength={13} />
                <Field label="이메일" required value={form.email}
                  onChange={v => update('email', v)} placeholder="example@email.com" icon={Mail} maxLength={100} />
              </div>
            </Section>

            <Section title="학력" icon={GraduationCap} required>
              <div className="space-y-3">
                {form.education.map((edu, i) => (
                  <div key={i} className="relative py-3 border-b border-surface-100 last:border-b-0">
                    {form.education.length > 1 && (
                      <button type="button" onClick={() => removeEducation(i)}
                        className="absolute top-2 right-0 p-1 text-gray-300 hover:text-red-400">
                        <X size={13} />
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="학교명" value={edu.school} required
                        onChange={v => updateEducation(i, 'school', v)} placeholder="가천대학교" small maxLength={50} />
                      <Field label="전공" value={edu.major}
                        onChange={v => updateEducation(i, 'major', v)} placeholder="컴퓨터공학과" small maxLength={50} />
                      <div>
                        <label className="block text-[13px] font-semibold text-bluewood-500 mb-1">학위/과정</label>
                        <select
                          value={edu.degree || ''}
                          onChange={e => updateEducation(i, 'degree', e.target.value)}
                          className="w-full px-0 py-1.5 text-[13px] border-0 border-b border-surface-200 bg-transparent outline-none focus:border-bluewood-400 transition-colors appearance-none cursor-pointer text-bluewood-800"
                        >
                          <option value="">선택해주세요</option>
                          {DEGREE_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <Field label="기간" value={edu.period}
                        onChange={v => updateEducation(i, 'period', v)} placeholder="2020.03 - 현재" small maxLength={30} />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addEducation}
                  className="flex items-center gap-1 px-0 py-1 text-[11px] text-bluewood-300 hover:text-bluewood-600 transition-colors">
                  <Plus size={10} /> 학력 추가
                </button>
              </div>
            </Section>
          </div>

          {/* ── 오른쪽: 어학 성적 + 기술/도구 + 비밀번호 변경 ── */}
          <div className="border-l border-surface-100 pl-10">
            <Section title="어학 성적" icon={Globe} optional noBorder>
              <div className="space-y-3">
                {form.languageScores.map((lang, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-surface-100">
                    <div className="grid grid-cols-3 gap-3 flex-1">
                      <div>
                        <label className="block text-[13px] font-semibold text-bluewood-500 mb-1">시험명</label>
                        <select
                          value={LANGUAGE_TEST_OPTIONS.includes(lang.name) ? lang.name : (lang.name ? '__custom__' : '')}
                          onChange={e => {
                            if (e.target.value === '__custom__') {
                              updateLang(i, 'name', '');
                            } else {
                              updateLang(i, 'name', e.target.value);
                            }
                          }}
                          className="w-full px-0 py-1.5 text-[13px] border-0 border-b border-surface-200 bg-transparent outline-none focus:border-bluewood-400 transition-colors appearance-none cursor-pointer text-bluewood-800"
                        >
                          <option value="">선택</option>
                          {LANGUAGE_TEST_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          <option value="__custom__">직접 입력</option>
                        </select>
                        {lang.name && !LANGUAGE_TEST_OPTIONS.includes(lang.name) && (
                          <div className="relative mt-1">
                            <input
                              value={lang.name}
                              onChange={e => updateLang(i, 'name', e.target.value)}
                              placeholder="시험명 직접 입력"
                              maxLength={30}
                              className="w-full px-0 py-1.5 text-[13px] border-0 border-b border-surface-200 bg-transparent outline-none focus:border-bluewood-400 transition-colors pr-8 text-bluewood-800"
                            />
                            <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[11px] tabular-nums pointer-events-none ${lang.name.length >= 30 ? 'text-red-400 font-semibold' : lang.name.length >= 26 ? 'text-amber-500' : 'text-gray-300'}`}>
                              {lang.name.length}/30
                            </span>
                          </div>
                        )}
                      </div>
                      <Field label="점수/등급" value={lang.score}
                        onChange={v => updateLang(i, 'score', v)} placeholder="900" small maxLength={20} />
                      <div>
                        <label className="block text-[13px] font-semibold text-bluewood-500 mb-1">취득일</label>
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
                          className="w-full px-0 py-1.5 text-[13px] border-0 border-b border-surface-200 bg-transparent outline-none focus:border-bluewood-400 transition-colors text-bluewood-800"
                        />
                      </div>
                    </div>
                    <button type="button" onClick={() => removeLang(i)}
                      className="p-1.5 text-gray-300 hover:text-red-400">
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addLang}
                  className="flex items-center gap-1 px-0 py-1 text-[11px] text-bluewood-300 hover:text-bluewood-600 transition-colors">
                  <Plus size={10} /> 어학 성적 추가
                </button>
              </div>
            </Section>

            <Section title="기술 / 도구" icon={Wrench} optional>
              <div className="space-y-5">
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

            {/* 비밀번호 변경 — 이메일 가입 유저만 표시 */}
            {isEmailUser && (
              <Section title="비밀번호 변경" icon={Lock}>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div className="relative">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-bluewood-300" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.current}
                      onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                      placeholder="현재 비밀번호"
                      className="w-full pl-9 pr-10 py-2 border border-surface-200 rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-bluewood-300 hover:text-bluewood-600">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-bluewood-300" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.next}
                      onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                      placeholder="새 비밀번호 (6자 이상)"
                      className="w-full pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
                    />
                  </div>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-bluewood-300" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.confirm}
                      onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                      placeholder="새 비밀번호 확인"
                      className="w-full pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pwSaving}
                    className="w-full py-2 bg-primary-600 text-white rounded-lg text-[13px] font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {pwSaving ? '변경 중...' : '비밀번호 변경'}
                  </button>
                </form>
              </Section>
            )}
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="mt-8 pt-6 border-t border-surface-100">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-lg text-[15px] font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> 저장 중...</>
            ) : (
              <><Check size={16} /> 프로필 저장하고 시작하기</>
            )}
          </button>
          <button
            onClick={handleSkipProfileSetup}
            disabled={skipSaving}
            className="w-full py-2.5 mt-1 text-[13px] text-bluewood-300 hover:text-bluewood-600 transition-colors"
          >
            {skipSaving ? '저장 중...' : '건너뛰기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, required, optional, noBorder }) {
  return (
    <div className={`pb-2 ${noBorder ? 'pt-0' : 'pt-6 border-t border-surface-100'}`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={13} className="text-bluewood-300" />
        <h2 className="text-[14px] font-bold text-bluewood-700">{title}</h2>
        {required && <span className="text-red-400 text-[12px] font-semibold">*필수</span>}
        {optional && <span className="text-bluewood-200 text-[12px]">(선택)</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required, optional, icon: Icon, small, maxLength }) {
  const len = (value || '').length;
  const near = maxLength && len >= maxLength * 0.85;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[13px] font-semibold text-bluewood-500">
          {label} {required && <span className="text-red-400">*</span>}
          {optional && <span className="text-bluewood-200">(선택)</span>}
        </label>
        {maxLength && (
          <span className={`text-[11px] tabular-nums ${len >= maxLength ? 'text-red-400 font-semibold' : near ? 'text-amber-500' : 'text-bluewood-200'}`}>
            {len}/{maxLength}
          </span>
        )}
      </div>
      <div className="relative">
        {Icon && <Icon size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-bluewood-300" />}
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`w-full ${Icon ? 'pl-4' : 'pl-0'} pr-0 py-1.5 text-[13px] border-0 border-b border-surface-200 bg-transparent outline-none focus:border-bluewood-400 placeholder-bluewood-200 transition-colors text-bluewood-800`}
        />
      </div>
    </div>
  );
}
