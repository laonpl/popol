import { useState } from 'react';
import { ArrowUpRight, Search, MapPin, Briefcase, ChevronDown, RotateCcw, FileText } from 'lucide-react';
import FileCat from './FileCat';
import { recommendLiveJobs } from '../services/jobAI';
import './career-dashboard.css';

const ROLES = ['서비스 기획자', '프론트엔드 개발자', '백엔드 개발자', '모바일 개발자', '데이터 분석가', '프로덕트 디자이너', '그래픽 디자이너', '마케터', '영업', '인사 담당자', '회계 담당자'];
const ALIASES = { '기획 / PM': '서비스 기획자', '개발 / 엔지니어': '백엔드 개발자', '디자인 / UX': '프로덕트 디자이너', '데이터 분석': '데이터 분석가', '마케팅 / 콘텐츠': '마케터' };
function dateLabel(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '미확인';
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

export default function JobDiscoveryPanel({ targetRole = '', experienceCount = 0 }) {
  const [role, setRole] = useState(null);
  const [level, setLevel] = useState('전체');
  const [years, setYears] = useState('');
  const [location, setLocation] = useState('전국');
  const [recentDays, setRecentDays] = useState(0);
  const [sort, setSort] = useState('relevance');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(6);
  const currentRole = role ?? ALIASES[targetRole] ?? targetRole;
  const jobs = result?.recommendations || [];
  const search = async event => {
    event?.preventDefault();
    if (loading || !currentRole.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setVisible(6);
    try {
      const data = await recommendLiveJobs({ search: { role: currentRole.trim(), level, location, recentDays, sort, ...(level === '경력' && years !== '' ? { years: Number(years) } : {}) }, limit: 200 });
      setResult(data);
    } catch (err) {
      if (err.response?.data?.sources) setResult(err.response.data);
      setError(err.response?.status === 503 ? '지금은 채용 사이트에 연결하지 못했어요. 잠시 후 다시 찾아주세요.' : err.response?.data?.error || '공고를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally { setLoading(false); }
  };

  return <section className="fp-job-discovery" aria-labelledby="job-discovery-title">
    <header className="fp-discovery-heading">
      <div><span className="fp-career-eyebrow">NEXT CHAPTER / 공고 찾기</span>
        <h3 id="job-discovery-title">내 경험이 필요한 곳을 찾아요.</h3>
        <p>정리한 경험 {experienceCount}개를 바탕으로, 공개 채용 공고를 모아드릴게요.</p>
      </div>
      <FileCat variant={loading ? 'collecting' : jobs.length ? 'offering' : 'curious'} file="document" withDocuments className="fp-discovery-cat" />
    </header>
    <form onSubmit={search} className="fp-job-search">
      <fieldset disabled={loading}>
        <legend className="sr-only">공고 검색 조건</legend>
        <label className="fp-job-role">관심 직무<input list="fitpoly-job-roles" value={currentRole} onChange={e => setRole(e.target.value)} maxLength={60} placeholder="예: 서비스 기획자" required />
          <datalist id="fitpoly-job-roles">{ROLES.map(item => <option key={item} value={item} />)}</datalist>
        </label>
        <label>경력<select value={level} onChange={e => setLevel(e.target.value)}>{['전체', '신입', '경력', '인턴', '프리랜서'].map(item => <option key={item}>{item}</option>)}</select></label>
        {level === '경력' && <label>경력 연수<input type="number" min="0" max="60" step="1" value={years} onChange={e => setYears(e.target.value)} placeholder="제한 없음" /></label>}
        <label>지역<select value={location} onChange={e => setLocation(e.target.value)}>{['전국', '서울', '경기', '인천', '부산', '대전', '대구', '광주', '제주'].map(item => <option key={item}>{item}</option>)}</select></label>
        <label>등록 기간<select value={recentDays} onChange={e => setRecentDays(Number(e.target.value))}><option value={0}>전체 기간</option>{[7, 14, 30].map(days => <option key={days} value={days}>최근 {days}일</option>)}</select></label>
        <label>정렬<select value={sort} onChange={e => setSort(e.target.value)}><option value="relevance">관련도순</option><option value="latest">최신 등록순</option></select></label>
        <button type="submit" className="fp-career-button" disabled={!currentRole.trim()}><Search size={16} />{loading ? '찾고 있어요' : '공고 찾기'}</button>
      </fieldset>
    </form>
    <div aria-live="polite" aria-busy={loading}>
      {loading ? <div className="fp-job-state"><FileCat variant="loading" file="document" withDocuments /><div><h4>맞는 공고를 물어올게요!</h4><p>채용 목록과 공고 원문을 확인하고 있어요.<br />여러 채널을 확인하느라 잠시 걸릴 수 있어요.</p></div></div>
        : error ? <div className="fp-job-state" role="alert"><FileCat variant="thinking" /><div><h4>잠깐, 연결이 매끄럽지 않아요.</h4><p>{error}</p><button className="fp-career-text-button" onClick={search}><RotateCcw size={14} /> 다시 찾기</button></div></div>
        : !result ? <div className="fp-job-intro"><span><FileText size={20} /></span><div><h4>흩어진 공고도, 한곳에 차곡차곡.</h4><p>원티드·사람인·잡코리아·점핏과 기업 채용 페이지를 찾아봐요.<br />관심 직무와 조건을 확인하고 공고 찾기를 눌러주세요.</p></div></div>
        : !jobs.length ? <div className="fp-job-state"><FileCat variant="thinking" /><div><h4>조건을 조금 넓혀볼까요?</h4><p>이번 검색에서는 맞는 공고를 찾지 못했어요.<br />지역이나 등록 기간을 넓혀 다시 찾아보세요.</p></div></div>
        : <>
          <div className="fp-job-result-heading"><p><strong>{jobs.length}개</strong>의 공고를 가져왔어요 <span>· {result.profile?.role}</span></p><span>{result.cached ? '최근 조회 결과' : '조회'} {dateLabel(result.generatedAt)}</span></div>
          <div className="fp-job-results">{jobs.slice(0, visible).map((job, index) => <article className="fp-job-card" key={job.id || job.url}>
            <div className="fp-job-card-top"><span className="fp-job-number">{String(index + 1).padStart(2, '0')}</span><span>{job.platform}</span><span className="fp-job-score">관련도 {job.fitScore ?? 0}점</span></div>
            <p className="fp-job-company">{job.company}</p><h4><a href={job.url} target="_blank" rel="noopener noreferrer">{job.title}<ArrowUpRight size={17} /></a></h4>
            <div className="fp-job-meta"><span><MapPin size={13} />{job.location}</span><span><Briefcase size={13} />{job.experience || '경력 조건 원문 확인'}</span></div>
            <p className="fp-job-dates">등록 {dateLabel(job.postedAt)} · {job.dueAt ? `마감 ${dateLabel(job.dueAt)}` : job.deadlineLabel || '마감일 원문 확인'}</p>
            <p className="fp-job-reason">{job.reason || job.matchingReasons?.[0]}</p>
            {job.skills?.length > 0 && <div className="fp-career-chips">{job.skills.slice(0, 4).map(skill => <span key={skill}>{skill}</span>)}</div>}
            <details className="fp-job-detail"><summary>내 경험과 비교하기 <ChevronDown size={14} /></summary>
              <dl><div><dt>연결할 경험</dt><dd>{job.matchedExperiences?.length ? job.matchedExperiences.map(exp => <span key={exp.id}>{exp.title}</span>) : '직무가 비슷한 공고예요. 세부 요건을 확인해보세요.'}</dd></div>
                <div><dt>제출 서류</dt><dd>{job.documents?.length ? job.documents.join(' · ') : '공고에 명시되지 않았어요. 원문을 확인해주세요.'}</dd></div>
                <div><dt>추가 확인할 기술</dt><dd>{job.missingSkills?.length ? job.missingSkills.map(skill => `${skill.name}${skill.preferred ? ' (우대)' : ''}`).join(' · ') : '추가로 확인된 기술 요건이 없어요.'}</dd></div></dl>
              <p>경험에 기록된 기술과 직무의 관련도이며 합격 가능성을 뜻하지 않아요. 기록에 없는 내용은 원문과 함께 확인해주세요.</p>
            </details>
            <footer><span>{job.verification === 'detail' ? '상세 원문 확인' : '채용 목록 확인'}</span><a href={job.url} target="_blank" rel="noopener noreferrer">공고 보기 <ArrowUpRight size={14} /></a></footer>
          </article>)}</div>
          {visible < jobs.length && <button className="fp-job-more" onClick={() => setVisible(value => value + 6)}>공고 더 보기 ({Math.min(visible, jobs.length)}/{jobs.length}) <ChevronDown size={15} /></button>}
        </>}
    </div>
    {result && <details className="fp-job-sources"><summary>조회한 채널과 검색 범위 <ChevronDown size={14} /></summary><p>{result.message}</p><ul>{result.sources?.map(source => <li key={source.name}><span>{source.name}</span><strong>{source.status === 'ok' ? `${source.count}건 확인` : source.status === 'skipped' ? '이번 검색 생략' : '연결 실패'}</strong></li>)}</ul></details>}
  </section>;
}
