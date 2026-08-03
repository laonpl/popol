import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Plus, Loader2, Search, Eye, EyeOff, WalletCards, Info, AlertCircle } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';
import useUnsavedChanges from '../hooks/useUnsavedChanges';

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

const INPUT_CLS = 'w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 text-[14px] text-bluewood-800 outline-none transition-colors placeholder:text-bluewood-300 focus:border-primary-300 focus:ring-2 focus:ring-primary-100';
const INPUT_ERROR_CLS = 'w-full rounded-lg border border-red-300 bg-red-50/40 px-3 py-2.5 text-[14px] text-bluewood-800 outline-none transition-colors placeholder:text-bluewood-300 focus:border-red-400 focus:ring-2 focus:ring-red-100';
const SELECT_CLS = `${INPUT_CLS} cursor-pointer appearance-none`;

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user, profile, saveProfile, changePassword, skipProfileSetup } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [skipSaving, setSkipSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  // 필드별 검증 오류 — { 'nameKo': '메시지', 'education.0.school': '메시지', ... }
  const [errors, setErrors] = useState({});

  // 편집 중 이탈 방지 (저장/건너뛰기 진행 중에는 화면 전환 허용)
  useUnsavedChanges(dirty && !saving && !skipSaving);

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
    // 추가 섹션 (블록 추가로 활성화)
    awards: [],
    curricular: { credits: '', gpa: '', courses: [] },
    extracurricular: { summary: '', badges: [], details: [] },
    goals: [],
    values: [],
    valuesEssay: '',
    contact: { linkedin: '', instagram: '', github: '', website: '' },
  });

  // 활성화된 추가 섹션 키 목록
  const [activeSections, setActiveSections] = useState([]);

  useEffect(() => {
    if (profile) {
      const curricular = profile.curricular || {};
      const extracurricular = profile.extracurricular || {};
      const contact = profile.contact || {};
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
        awards: profile.awards || [],
        curricular: {
          credits: curricular.credits ?? curricular.summary?.credits ?? '',
          gpa: curricular.gpa ?? curricular.summary?.gpa ?? '',
          courses: curricular.courses || [],
        },
        extracurricular: {
          summary: extracurricular.summary || '',
          badges: extracurricular.badges || [],
          details: extracurricular.details || [],
        },
        goals: profile.goals || [],
        values: profile.values || [],
        valuesEssay: profile.valuesEssay || '',
        contact: {
          linkedin: contact.linkedin || '',
          instagram: contact.instagram || '',
          github: contact.github || '',
          website: contact.website || '',
        },
      }));
      // 데이터가 있는 추가 섹션은 자동 활성화
      const active = [];
      if (profile.awards?.length) active.push('awards');
      if (curricular.courses?.length || curricular.credits || curricular.gpa || curricular.summary?.credits) active.push('curricular');
      if (extracurricular.summary || extracurricular.badges?.length || extracurricular.details?.length) active.push('extracurricular');
      if (profile.goals?.length) active.push('goals');
      if (profile.values?.length || profile.valuesEssay) active.push('values');
      if (contact.linkedin || contact.instagram || contact.github || contact.website) active.push('contact');
      setActiveSections(active);
    } else {
      setForm(prev => ({
        ...prev,
        nameKo: user?.displayName || '',
        email: user?.email || '',
      }));
    }
  }, [profile, user]);

  const update = (field, value) => {
    setDirty(true);
    setForm(prev => ({ ...prev, [field]: value }));
    // 사용자가 고치기 시작하면 그 필드 오류는 즉시 지운다 (오류가 남아 있으면 혼란)
    setErrors(prev => {
      if (!Object.keys(prev).length) return prev;
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(next)) {
        if (key === field || key.startsWith(`${field}.`)) { delete next[key]; changed = true; }
        // 배열 필드(education/languageScores)는 접두어가 다르므로 별도 매핑
        if (field === 'education' && key.startsWith('education.')) { delete next[key]; changed = true; }
        if (field === 'languageScores' && key.startsWith('lang.')) { delete next[key]; changed = true; }
      }
      return changed ? next : prev;
    });
  };

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

    /* ── 검증 ──
       예전에는 toast로 한 번에 한 개씩만 알려줘서, 긴 폼에서 사용자가
       "어느 칸이 문제인지" 직접 찾아다녀야 했다(3초 뒤 사라짐).
       이제는 모든 오류를 한 번에 모아 각 필드 아래에 표시하고, 첫 오류로 스크롤한다.

       또한 필수 항목을 이름·이메일로 줄였다. 포트폴리오를 만들러 온 사람에게
       집 주소·생년월일·전화번호를 강제할 이유가 없다(입력하면 채워주되 선택). */
    const nextErrors = {};

    if (!nameKo) nextErrors.nameKo = '이름을 입력해주세요';
    else if (nameKo.length > 40) nextErrors.nameKo = '이름은 40자 이내로 입력해주세요';

    if (nameEn && !/^[a-zA-Z][a-zA-Z\s\-.']*$/.test(nameEn)) {
      nextErrors.nameEn = '영문 이름은 영문자·공백·하이픈만 사용할 수 있어요';
    }

    if (birthDate) {
      const birthYear = parseInt(birthDate.split('.')[0], 10);
      const thisYear = new Date().getFullYear();
      if (Number.isNaN(birthYear) || birthYear < 1940 || birthYear > thisYear) {
        nextErrors.birthDate = `생년월일은 1940년 ~ ${thisYear}년 사이로 선택해주세요`;
      }
    }

    if (phone) {
      const phoneDigits = phone.replace(/[-\s]/g, '');
      if (!/^0[0-9]{8,10}$/.test(phoneDigits)) {
        nextErrors.phone = '전화번호 형식을 확인해주세요 (예: 010-1234-5678)';
      }
    }

    if (!email) nextErrors.email = '이메일을 입력해주세요';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      nextErrors.email = '이메일 형식을 확인해주세요 (예: name@example.com)';
    }

    // 학력은 선택. 단, 적기 시작했다면 학교명은 있어야 저장된다.
    form.education.forEach((edu, i) => {
      const hasAny = edu.school?.trim() || edu.major?.trim() || edu.degree || edu.period?.trim();
      if (hasAny && !edu.school?.trim()) {
        nextErrors[`education.${i}.school`] = '학교명을 입력하거나 이 항목을 삭제해주세요';
      }
    });

    form.languageScores.forEach((lang, i) => {
      if (!lang.name.trim()) nextErrors[`lang.${i}.name`] = '시험명을 선택하거나 이 항목을 삭제해주세요';
      else if (!lang.score.trim()) nextErrors[`lang.${i}.score`] = '점수/등급을 입력해주세요';
    });

    setErrors(nextErrors);
    const errorKeys = Object.keys(nextErrors);
    if (errorKeys.length > 0) {
      // 첫 오류 필드로 스크롤 + 포커스
      const el = document.querySelector(`[data-field="${errorKeys[0]}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.querySelector('input, select, textarea')?.focus({ preventScroll: true });
      }
      toast.error(
        errorKeys.length === 1
          ? '입력을 하나 확인해주세요'
          : `입력 ${errorKeys.length}곳을 확인해주세요`
      );
      return;
    }

    const validEducation = form.education.filter(e => e.school.trim());

    setSaving(true);
    try {
      await saveProfile({
        nameKo, nameEn, location, birthDate, phone, email,
        education: validEducation,
        languageScores: form.languageScores.filter(l => l.name.trim()),
        tools: form.tools.filter(Boolean),
        programmingLanguages: form.programmingLanguages.filter(Boolean),
        frameworks: form.frameworks.filter(Boolean),
        others: form.others.filter(Boolean),
        // 추가 섹션
        awards: form.awards.filter(a => a.title?.trim() || a.date?.trim() || a.organization?.trim() || a.description?.trim()),
        curricular: {
          credits: form.curricular.credits || '',
          gpa: form.curricular.gpa || '',
          courses: (form.curricular.courses || []).filter(c => c.name?.trim() || c.semester?.trim() || c.grade?.trim()),
        },
        extracurricular: {
          summary: form.extracurricular.summary || '',
          badges: (form.extracurricular.badges || []).filter(b => b.name?.trim() || b.issuer?.trim()),
          details: (form.extracurricular.details || []).filter(d => d.title?.trim() || d.description?.trim() || d.period?.trim()),
        },
        goals: form.goals.filter(g => g.title?.trim() || g.description?.trim()),
        values: form.values.filter(v => v.keyword?.trim()),
        valuesEssay: form.valuesEssay || '',
        contact: form.contact,
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

  // ── 추가 섹션 (블록 추가) ──
  const initData = {
    awards: () => update('awards', [{ date: '', title: '', organization: '', description: '' }]),
    curricular: () => update('curricular', { credits: '', gpa: '', courses: [{ semester: '', name: '', grade: '' }] }),
    extracurricular: () => update('extracurricular', { summary: '', badges: [{ name: '', issuer: '' }], details: [] }),
    goals: () => update('goals', [{ title: '', description: '' }]),
    values: () => update('values', [{ keyword: '' }]),
    contact: () => {},
  };
  const clearData = {
    awards: () => update('awards', []),
    curricular: () => update('curricular', { credits: '', gpa: '', courses: [] }),
    extracurricular: () => update('extracurricular', { summary: '', badges: [], details: [] }),
    goals: () => update('goals', []),
    values: () => { update('values', []); update('valuesEssay', ''); },
    contact: () => update('contact', { linkedin: '', instagram: '', github: '', website: '' }),
  };
  const activateSection = (key) => {
    if (activeSections.includes(key)) return;
    setActiveSections(prev => [...prev, key]);
    initData[key]?.();
  };
  const deactivateSection = (key) => {
    setActiveSections(prev => prev.filter(k => k !== key));
    clearData[key]?.();
  };

  // 중첩 객체(curricular/extracurricular) 내부 배열 업데이트 헬퍼
  const updateNestedArr = (parent, arrKey, items) => update(parent, { ...form[parent], [arrKey]: items });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1939 }, (_, i) => currentYear - i);

  // 선택된 연/월의 실제 일수 (윤년 포함)
  const daysInSelectedMonth = (() => {
    const [y, m] = (form.birthDate || '').split('.');
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    if (!year || !month) return 31;
    return new Date(year, month, 0).getDate();
  })();


  const renderAdditionalSection = (key) => {
    switch (key) {
      case 'awards':
        return (
          <Card key={key}>
            <Section title="수상" optional first onRemove={() => deactivateSection('awards')}>
              <RepeatableRows items={form.awards} onChange={items => update('awards', items)} addLabel="수상 추가" cols={2}
                fields={[
                  { key: 'title', label: '수상명', placeholder: '공모전 대상' },
                  { key: 'date', label: '날짜', placeholder: '2024.06' },
                  { key: 'organization', label: '기관', placeholder: '주최 기관' },
                  { key: 'description', label: '설명', placeholder: '간단한 설명', full: true },
                ]} />
            </Section>
          </Card>
        );
      case 'goals':
        return (
          <Card key={key}>
            <Section title="목표와 계획" optional first onRemove={() => deactivateSection('goals')}>
              <RepeatableRows items={form.goals} onChange={items => update('goals', items)} addLabel="목표 추가" cols={1}
                fields={[
                  { key: 'title', label: '목표', placeholder: '예: 3년 안에 프로젝트 매니저로 성장' },
                  { key: 'description', label: '상세 계획', placeholder: '구체적인 실행 계획을 적어주세요', textarea: true, full: true },
                ]} />
            </Section>
          </Card>
        );
      case 'values':
        return (
          <Card key={key}>
            <Section title="가치관" optional first onRemove={() => deactivateSection('values')}>
              <p className="mb-2 text-[13px] font-semibold text-bluewood-600">중요하게 생각하는 가치</p>
              <RepeatableRows items={form.values} onChange={items => update('values', items)} addLabel="가치 추가" cols={1}
                fields={[{ key: 'keyword', label: '가치 키워드', placeholder: '예: 성장, 책임감, 협업' }]} />
              <div className="mt-4">
                <Label>경험과 연결되는 이야기</Label>
                <textarea value={form.valuesEssay} onChange={e => update('valuesEssay', e.target.value)}
                  placeholder="가치관을 보여준 경험을 자유롭게 적어주세요" rows={3} className={INPUT_CLS} />
              </div>
            </Section>
          </Card>
        );
      case 'contact':
        return (
          <Card key={key}>
            <Section title="연락처" optional first onRemove={() => deactivateSection('contact')}>
              <p className="mb-3 text-[13px] text-bluewood-400">전화번호와 이메일은 기본 정보에서 가져옵니다. 추가 링크만 입력해주세요.</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="LinkedIn" value={form.contact.linkedin} onChange={v => update('contact', { ...form.contact, linkedin: v })} placeholder="linkedin.com/in/..." maxLength={150} />
                <Field label="GitHub" value={form.contact.github} onChange={v => update('contact', { ...form.contact, github: v })} placeholder="github.com/..." maxLength={150} />
                <Field label="Instagram" value={form.contact.instagram} onChange={v => update('contact', { ...form.contact, instagram: v })} placeholder="@username" maxLength={100} />
                <Field label="웹사이트" value={form.contact.website} onChange={v => update('contact', { ...form.contact, website: v })} placeholder="https://..." maxLength={150} />
              </div>
            </Section>
          </Card>
        );
      case 'curricular':
        return (
          <Card key={key}>
            <Section title="교과 활동" optional first onRemove={() => deactivateSection('curricular')}>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <Field label="이수 학점" value={form.curricular.credits} onChange={v => update('curricular', { ...form.curricular, credits: v })} placeholder="120" maxLength={10} />
                <Field label="평점 평균" value={form.curricular.gpa} onChange={v => update('curricular', { ...form.curricular, gpa: v })} placeholder="4.0 / 4.5" maxLength={10} />
              </div>
              <p className="mb-2 text-[13px] font-semibold text-bluewood-600">수강 과목</p>
              <RepeatableRows items={form.curricular.courses} onChange={items => updateNestedArr('curricular', 'courses', items)} addLabel="과목 추가" cols={1}
                fields={[
                  { key: 'semester', label: '학기', placeholder: '2023-1' },
                  { key: 'name', label: '과목명', placeholder: '자료구조' },
                  { key: 'grade', label: '성적', placeholder: 'A+' },
                ]} />
            </Section>
          </Card>
        );
      case 'extracurricular':
        return (
          <Card key={key}>
            <Section title="비교과 활동" optional first onRemove={() => deactivateSection('extracurricular')}>
              <div className="mb-4">
                <Label>요약</Label>
                <textarea value={form.extracurricular.summary} onChange={e => update('extracurricular', { ...form.extracurricular, summary: e.target.value })}
                  placeholder="비교과 활동을 한 줄로 요약해주세요" rows={2} className={INPUT_CLS} />
              </div>
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-bluewood-600">디지털 배지 / 자격</p>
                  <RepeatableRows items={form.extracurricular.badges} onChange={items => updateNestedArr('extracurricular', 'badges', items)} addLabel="배지 추가" cols={1}
                    fields={[
                      { key: 'name', label: '배지명 또는 자격명', placeholder: '정보처리기사' },
                      { key: 'issuer', label: '발급 기관', placeholder: '한국산업인력공단' },
                    ]} />
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-bluewood-600">세부 활동</p>
                  <RepeatableRows items={form.extracurricular.details} onChange={items => updateNestedArr('extracurricular', 'details', items)} addLabel="활동 추가" cols={1}
                    fields={[
                      { key: 'title', label: '활동명', placeholder: '동아리 회장' },
                      { key: 'period', label: '기간', placeholder: '2023.03 - 2024.02' },
                      { key: 'description', label: '설명', placeholder: '활동 내용', full: true },
                    ]} />
                </div>
              </div>
            </Section>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface-50/40 py-10 px-5">
      <div className="mx-auto max-w-6xl">
        {/* 헤더 */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-bluewood-900">프로필 설정</h1>
            <p className="mt-1.5 text-[14px] text-bluewood-400">포트폴리오에 자동으로 채워지는 기본 정보예요. 필수는 이름과 이메일뿐이고, 나머지는 나중에 채워도 됩니다.</p>
          </div>
          {profile && (
            <button
              onClick={() => navigate('/app/settings/credits')}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-2 text-[13px] font-semibold text-primary-600 transition-colors hover:bg-primary-50"
            >
              <WalletCards size={15} /> 크레딧
            </button>
          )}
        </div>

        {/* 첫 가입자 안내: 건너뛰기 가능 */}
        {!profile && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 px-5 py-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <Info size={18} />
            </span>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-bluewood-800">프로필은 나중에 작성해도 괜찮아요</p>
              <p className="mt-0.5 text-[13px] text-bluewood-500">지금 입력하면 포트폴리오에 자동으로 채워져 편리하지만, 필수는 아니에요. 바로 시작하고 싶다면 건너뛰세요.</p>
            </div>
            <button onClick={handleSkipProfileSetup} disabled={skipSaving}
              className="flex-shrink-0 self-center rounded-lg border border-primary-200 bg-white px-4 py-2 text-[13px] font-semibold text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-50">
              {skipSaving ? '저장 중...' : '건너뛰기'}
            </button>
          </div>
        )}

        {/* ── 1행: 기본 정보 | 학력 ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <Section title="기본 정보" first>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="이름" name="nameKo" required error={errors.nameKo} value={form.nameKo} onChange={v => update('nameKo', v)} placeholder="홍길동" maxLength={40} />
                <Field label="이름 (영문)" name="nameEn" optional error={errors.nameEn} value={form.nameEn} onChange={v => update('nameEn', v)} placeholder="Gildong Hong" maxLength={50} />
                <div className="sm:col-span-2">
                  <Label>거주지 <span className="font-normal text-bluewood-300">(선택)</span></Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input type="text" value={form.location || ''} onChange={e => update('location', e.target.value)}
                      placeholder="예: 서울 강남구 (정확한 주소는 선택)" maxLength={100} className={INPUT_CLS} />
                    <button type="button" onClick={openAddressSearch}
                      className="flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg border border-surface-200 px-3.5 py-2.5 text-[13px] font-semibold text-bluewood-600 transition-colors hover:bg-surface-50">
                      <Search size={14} /> 주소 검색
                    </button>
                  </div>
                </div>
                <div data-field="birthDate">
                  <Label>생년월일 <span className="font-normal text-bluewood-300">(선택)</span></Label>
                  <div className="flex gap-1.5">
                    <select value={form.birthDate ? form.birthDate.split('.')[0] : ''}
                      onChange={e => { const y = e.target.value; const parts = (form.birthDate || '').split('.'); const m = parts[1] || '01'; const d = parts[2] || '01'; update('birthDate', y ? `${y}.${m}.${d}` : ''); }}
                      className={`${SELECT_CLS} flex-[3]`}>
                      <option value="">연도</option>
                      {years.map(y => <option key={y} value={String(y)}>{y}년</option>)}
                    </select>
                    <select value={form.birthDate ? (form.birthDate.split('.')[1] || '') : ''}
                      onChange={e => { const m = e.target.value; const parts = (form.birthDate || '').split('.'); const y = parts[0] || ''; const d = parts[2] || '01'; update('birthDate', y && m ? `${y}.${m}.${d}` : ''); }}
                      className={`${SELECT_CLS} flex-[2]`}>
                      <option value="">월</option>
                      {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => <option key={m} value={m}>{i + 1}월</option>)}
                    </select>
                    <select value={form.birthDate ? (form.birthDate.split('.')[2] || '') : ''}
                      onChange={e => { const d = e.target.value; const parts = (form.birthDate || '').split('.'); const y = parts[0] || ''; const m = parts[1] || '01'; update('birthDate', y && m ? `${y}.${m}.${d || '01'}` : ''); }}
                      className={`${SELECT_CLS} flex-[2]`}>
                      <option value="">일</option>
                      {/* 선택한 연·월에 실제로 있는 날짜만 노출 (2월 31일 같은 선택 방지) */}
                      {Array.from({ length: daysInSelectedMonth }, (_, i) => String(i + 1).padStart(2, '0')).map(d => <option key={d} value={d}>{parseInt(d)}일</option>)}
                    </select>
                  </div>
                  <FieldError message={errors.birthDate} />
                </div>
                <Field label="전화번호" name="phone" optional error={errors.phone} value={form.phone} onChange={v => update('phone', formatPhone(v))} placeholder="010-0000-0000" maxLength={13} />
                <div className="sm:col-span-2">
                  <Field label="이메일" name="email" required error={errors.email} value={form.email} onChange={v => update('email', v)} placeholder="example@email.com" maxLength={100} />
                </div>
              </div>
            </Section>
          </Card>

          <Card>
            <Section title="학력" optional first>
              <div className="space-y-3">
                {form.education.map((edu, i) => (
                  <div key={i} className="relative rounded-xl border border-surface-200 bg-surface-50/40 p-4">
                    {form.education.length > 1 && (
                      <button type="button" onClick={() => removeEducation(i)}
                        className="absolute right-3 top-3 rounded p-1 text-bluewood-300 transition-colors hover:bg-white hover:text-red-400">
                        <X size={15} />
                      </button>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="학교명" name={`education.${i}.school`} error={errors[`education.${i}.school`]} value={edu.school} onChange={v => updateEducation(i, 'school', v)} placeholder="가천대학교" maxLength={50} />
                      <Field label="전공" value={edu.major} onChange={v => updateEducation(i, 'major', v)} placeholder="컴퓨터공학과" maxLength={50} />
                      <div>
                        <Label>학위/과정</Label>
                        <select value={edu.degree || ''} onChange={e => updateEducation(i, 'degree', e.target.value)} className={SELECT_CLS}>
                          <option value="">선택해주세요</option>
                          {DEGREE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <Field label="기간" value={edu.period} onChange={v => updateEducation(i, 'period', v)} placeholder="2020.03 - 현재" maxLength={30} />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addEducation}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-primary-600 transition-colors hover:text-primary-700">
                  <Plus size={15} /> 학력 추가
                </button>
              </div>
            </Section>
          </Card>
        </div>

        {/* ── 2행: 어학 성적 + 섹션 추가 | 기술·도구 ── */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
          <Card>
            <Section title="어학 성적" optional first>
              <div className="space-y-3">
                {form.languageScores.length === 0 && (
                  <p className="text-[13px] text-bluewood-300">보유한 어학 성적이 있다면 추가해주세요.</p>
                )}
                {form.languageScores.map((lang, i) => (
                  <div key={i} className="relative rounded-xl border border-surface-200 bg-surface-50/40 p-4">
                    <button type="button" onClick={() => removeLang(i)}
                      className="absolute right-3 top-3 rounded p-1 text-bluewood-300 transition-colors hover:bg-white hover:text-red-400">
                      <X size={15} />
                    </button>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div data-field={`lang.${i}.name`}>
                        <Label>시험명</Label>
                        <select
                          value={LANGUAGE_TEST_OPTIONS.includes(lang.name) ? lang.name : (lang.name ? '__custom__' : '')}
                          onChange={e => updateLang(i, 'name', e.target.value === '__custom__' ? '' : e.target.value)}
                          className={errors[`lang.${i}.name`] ? `${INPUT_ERROR_CLS} cursor-pointer appearance-none` : SELECT_CLS}>
                          <option value="">선택</option>
                          {LANGUAGE_TEST_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          <option value="__custom__">직접 입력</option>
                        </select>
                        {lang.name && !LANGUAGE_TEST_OPTIONS.includes(lang.name) && (
                          <input value={lang.name} onChange={e => updateLang(i, 'name', e.target.value)}
                            placeholder="시험명 직접 입력" maxLength={30} className={`${INPUT_CLS} mt-2`} />
                        )}
                        <FieldError message={errors[`lang.${i}.name`]} />
                      </div>
                      <Field label="점수/등급" name={`lang.${i}.score`} error={errors[`lang.${i}.score`]} value={lang.score} onChange={v => updateLang(i, 'score', v)} placeholder="900" maxLength={20} />
                      <div>
                        <Label>취득일</Label>
                        <input type="month"
                          value={lang.date ? lang.date.replace(/\./g, '-').replace(/-$/, '') : ''}
                          onChange={e => { const val = e.target.value; if (val) { const [y, m] = val.split('-'); updateLang(i, 'date', `${y}.${m}`); } else updateLang(i, 'date', ''); }}
                          className={INPUT_CLS} />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addLang}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-primary-600 transition-colors hover:text-primary-700">
                  <Plus size={15} /> 어학 성적 추가
                </button>
              </div>
            </Section>
          </Card>

          {activeSections.map(renderAdditionalSection)}

          {/* ── 섹션 추가 (어학 성적 아래 빈 공간 채움) ── */}
          {ADDABLE_SECTIONS.some(s => !activeSections.includes(s.key)) && (
            <div className="rounded-2xl border border-surface-200 bg-white p-6">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-[17px] font-extrabold text-bluewood-900">섹션 추가</h2>
                <span className="text-[12px] font-medium text-bluewood-300">선택</span>
              </div>
              <p className="mb-3 text-[13px] text-bluewood-400">필요한 항목을 추가해 미리 입력해두면, 새 포트폴리오를 만들 때 자동으로 채워집니다.</p>
              <div className="grid grid-cols-2 gap-2">
                {ADDABLE_SECTIONS.filter(s => !activeSections.includes(s.key)).map(s => (
                  <button key={s.key} type="button" onClick={() => activateSection(s.key)}
                    className="flex items-center gap-2.5 rounded-xl border border-dashed border-surface-300 bg-surface-50/40 px-3 py-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><Plus size={14} /></span>
                    <span>
                      <span className="block text-[13px] font-semibold text-bluewood-800">{s.label}</span>
                      <span className="block text-[12px] text-bluewood-300">섹션 세트 추가</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>

          <Card>
            <Section title="기술 · 도구" optional first>
              <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                <SkillBubbleInput label="도구 (Tools)" field="tools" presets={PRESET_TOOLS} placeholder="기타 도구 직접 입력 후 Enter"
                  selectedItems={form.tools || []} onChange={items => update('tools', items)} />
                <SkillBubbleInput label="프로그래밍 언어" field="programmingLanguages" presets={PRESET_LANGUAGES} placeholder="기타 언어 직접 입력 후 Enter"
                  selectedItems={form.programmingLanguages || []} onChange={items => update('programmingLanguages', items)} />
                <SkillBubbleInput label="프레임워크 · 라이브러리" field="frameworks" presets={PRESET_FRAMEWORKS} placeholder="기타 프레임워크 직접 입력 후 Enter"
                  selectedItems={form.frameworks || []} onChange={items => update('frameworks', items)} />
                <SkillBubbleInput label="기타 역량" field="others" presets={PRESET_OTHERS} placeholder="기타 역량 직접 입력 후 Enter"
                  selectedItems={form.others || []} onChange={items => update('others', items)} />
              </div>
            </Section>
          </Card>
        </div>

        {/* ── 비밀번호 변경 ── */}
        {isEmailUser && (
          <div className="mt-4 rounded-2xl border border-surface-200 bg-white p-6">
            <Section title="비밀번호 변경" optional first>
              <form onSubmit={handleChangePassword} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={pwForm.current}
                    onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                    placeholder="현재 비밀번호" className={`${INPUT_CLS} pr-10`} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-bluewood-300 hover:text-bluewood-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <input type={showPw ? 'text' : 'password'} value={pwForm.next}
                  onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                  placeholder="새 비밀번호 (6자 이상)" className={INPUT_CLS} />
                <input type={showPw ? 'text' : 'password'} value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="새 비밀번호 확인" className={INPUT_CLS} />
                <button type="submit" disabled={pwSaving}
                  className="rounded-lg border border-surface-200 py-2.5 text-[14px] font-semibold text-bluewood-700 transition-colors hover:bg-surface-50 disabled:opacity-50 sm:col-span-3">
                  {pwSaving ? '변경 중...' : '비밀번호 변경'}
                </button>
              </form>
            </Section>
          </div>
        )}

        {/* ── 저장 / 건너뛰기 ── */}
        <div className="mt-6">
          <button onClick={handleSubmit} disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3.5 text-[15px] font-bold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700 disabled:opacity-50">
            {saving ? <><Loader2 size={17} className="animate-spin" /> 저장 중...</> : '프로필 저장하고 시작하기'}
          </button>
          <button onClick={handleSkipProfileSetup} disabled={skipSaving}
            className="mt-2 w-full py-2 text-[13px] text-bluewood-400 transition-colors hover:text-bluewood-700">
            {skipSaving ? '저장 중...' : '나중에 할게요 (건너뛰기)'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ADDABLE_SECTIONS = [
  { key: 'awards', label: '수상' },
  { key: 'curricular', label: '교과 활동' },
  { key: 'extracurricular', label: '비교과 활동' },
  { key: 'goals', label: '목표와 계획' },
  { key: 'values', label: '가치관' },
  { key: 'contact', label: '연락처' },
];

function Card({ children, className = '' }) {
  return <div className={`rounded-2xl border border-surface-200 bg-white p-6 ${className}`}>{children}</div>;
}

const GRID_CLS = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };
const SPAN_CLS = { 1: '', 2: 'sm:col-span-2', 3: 'sm:col-span-3' };

function RepeatableRows({ items, onChange, fields, addLabel, cols = 2 }) {
  const list = items || [];
  const blank = Object.fromEntries(fields.map(f => [f.key, '']));
  const add = () => onChange([...list, { ...blank }]);
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const setField = (i, key, v) => onChange(list.map((it, idx) => idx === i ? { ...it, [key]: v } : it));
  return (
    <div className="space-y-4">
      {list.map((it, i) => (
        <div key={i} className="relative rounded-xl border border-surface-200 bg-surface-50/40 p-4">
          <button type="button" onClick={() => remove(i)}
            className="absolute right-3 top-3 rounded p-1 text-bluewood-300 transition-colors hover:bg-white hover:text-red-400">
            <X size={15} />
          </button>
          <div className={`grid grid-cols-1 gap-3 ${GRID_CLS[cols] || ''}`}>
            {fields.map(f => (
              <div key={f.key} className={f.full ? SPAN_CLS[cols] : ''}>
                {f.textarea ? (
                  <>
                    <Label>{f.label}</Label>
                    <textarea value={it[f.key] || ''} onChange={e => setField(i, f.key, e.target.value)} placeholder={f.placeholder} rows={2} className={INPUT_CLS} />
                  </>
                ) : (
                  <Field label={f.label} value={it[f.key]} onChange={v => setField(i, f.key, v)} placeholder={f.placeholder} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-primary-600 transition-colors hover:text-primary-700">
        <Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}

function Section({ title, required, optional, first, onRemove, children }) {
  return (
    <section className={first ? '' : 'mt-9 border-t border-surface-100 pt-9'}>
      <div className="mb-5 flex items-center gap-2">
        <h2 className="text-[17px] font-extrabold text-bluewood-900">{title}</h2>
        {required && <span className="text-[12px] font-bold text-red-400">필수</span>}
        {optional && <span className="text-[12px] font-medium text-bluewood-300">선택</span>}
        {onRemove && (
          <button type="button" onClick={onRemove}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-bluewood-300 transition-colors hover:bg-surface-50 hover:text-red-400">
            <X size={13} /> 섹션 삭제
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Label({ children, required }) {
  return (
    <label className="mb-1.5 block text-[13px] font-semibold text-bluewood-600">
      {children} {required && <span className="text-red-400">*</span>}
    </label>
  );
}

function Field({ label, value, onChange, placeholder, required, optional, maxLength, error, name }) {
  const len = (value || '').length;
  const near = maxLength && len >= maxLength * 0.9;
  return (
    <div data-field={name}>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block text-[13px] font-semibold text-bluewood-600">
          {label} {required && <span className="text-red-400">*</span>}
          {optional && <span className="font-normal text-bluewood-300"> (선택)</span>}
        </label>
        {maxLength && near && (
          <span className={`text-[12px] tabular-nums ${len >= maxLength ? 'font-semibold text-red-400' : 'text-amber-500'}`}>{len}/{maxLength}</span>
        )}
      </div>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : undefined}
        className={error ? INPUT_ERROR_CLS : INPUT_CLS}
      />
      <FieldError message={error} />
    </div>
  );
}

/* 필드 아래 인라인 오류 — 토스트와 달리 사라지지 않고 위치를 정확히 알려준다 */
function FieldError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 flex items-start gap-1 text-[12px] font-medium leading-4 text-red-500">
      <AlertCircle size={13} className="mt-px flex-shrink-0" />
      {message}
    </p>
  );
}

/* 기술·도구 선택 입력.
   [주의] 이 컴포넌트는 반드시 최상위에 있어야 한다.
   예전엔 ProfileSetup 내부에 정의돼 있어서, 부모가 리렌더될 때마다 컴포넌트 타입이
   새로 만들어지고 → React가 언마운트/재마운트 → 직접 입력 중이던 텍스트와
   숙련도 팝오버 상태가 날아갔다. (프리셋 칩을 누르면 입력칸이 비워지던 증상) */
function SkillBubbleInput({ label, field, presets, placeholder, selectedItems, onChange }) {
  const [customInput, setCustomInput] = useState('');
  const [showProficiency, setShowProficiency] = useState(null);

  const getItemName = (item) => typeof item === 'string' ? item : item.name;
  const getItemProficiency = (item) => typeof item === 'string' ? 0 : (item.proficiency || 0);
  const selectedNames = selectedItems.map(getItemName);

  const toggleSkill = (name) => {
    if (selectedNames.includes(name)) {
      onChange(selectedItems.filter(item => getItemName(item) !== name));
    } else {
      onChange([...selectedItems, { name, proficiency: 3 }]);
    }
  };

  const setProficiency = (name, level) => {
    onChange(selectedItems.map(item =>
      getItemName(item) === name
        ? { name: getItemName(item), proficiency: level }
        : (typeof item === 'string' ? { name: item, proficiency: 0 } : item)
    ));
    setShowProficiency(null);
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (!val || selectedNames.includes(val)) return;
    onChange([...selectedItems, { name: val, proficiency: 3 }]);
    setCustomInput('');
  };

  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-bluewood-600">{label}</p>

      {/* 선택된 항목 (수준 설정 가능) */}
      {selectedItems.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedItems.map((item, i) => {
            const name = getItemName(item);
            const prof = getItemProficiency(item);
            return (
              <div key={i} className="relative">
                <button
                  type="button"
                  onClick={() => setShowProficiency(showProficiency === name ? null : name)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-2.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-primary-700"
                >
                  {name}
                  {prof > 0 && (
                    <span className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(l => (
                        <span key={l} className={`h-3 w-1.5 rounded-sm ${l <= prof ? PROFICIENCY_LEVELS[prof - 1].color : 'bg-white/30'}`} />
                      ))}
                    </span>
                  )}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); toggleSkill(name); }}
                    className="ml-0.5 text-white/70 hover:text-white"
                  >
                    <X size={12} />
                  </span>
                </button>
                {showProficiency === name && (
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[150px] rounded-lg border border-surface-200 bg-white p-1.5 shadow-lg">
                    <p className="mb-1 px-1.5 text-[12px] font-semibold text-bluewood-300">수준 설정</p>
                    {PROFICIENCY_LEVELS.map(lv => (
                      <button
                        key={lv.value}
                        type="button"
                        onClick={() => setProficiency(name, lv.value)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-50 ${prof === lv.value ? 'bg-primary-50 font-semibold text-primary-700' : 'text-bluewood-500'}`}
                      >
                        <span className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(l => (
                            <span key={l} className={`h-3 w-1.5 rounded-sm ${l <= lv.value ? lv.color : 'bg-gray-200'}`} />
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

      {/* 프리셋 칩 */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {presets.map(name => {
          const isSelected = selectedNames.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggleSkill(name)}
              className={`rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-all ${
                isSelected
                  ? 'border-primary-200 bg-primary-50 text-primary-600'
                  : 'border-surface-200 bg-white text-bluewood-400 hover:border-bluewood-300 hover:text-bluewood-600'
              }`}
            >
              {isSelected && <Check size={11} className="-mt-0.5 mr-0.5 inline" />}
              {name}
            </button>
          );
        })}
      </div>

      {/* 직접 입력 */}
      <div className="flex gap-2">
        <input
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          placeholder={placeholder}
          className={INPUT_CLS}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
        />
        <button
          type="button"
          onClick={addCustom}
          className="flex-shrink-0 rounded-lg border border-surface-200 px-4 text-[13px] font-semibold text-bluewood-600 transition-colors hover:bg-surface-50"
        >
          추가
        </button>
      </div>
    </div>
  );
}
