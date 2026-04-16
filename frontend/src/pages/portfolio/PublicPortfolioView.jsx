import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  MapPin, Calendar, Mail, Phone, Globe, ChevronUp, ExternalLink,
  Loader2, Code, Tag, X
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const EXP_SECTION_META = {
  intro:      { num: '01', label: '프로젝트 소개' },
  overview:   { num: '02', label: '프로젝트 개요' },
  task:       { num: '03', label: '진행한 일' },
  process:    { num: '04', label: '과정' },
  output:     { num: '05', label: '결과물' },
  growth:     { num: '06', label: '성장한 점' },
  competency: { num: '07', label: '나의 역량' },
};
const EXP_SECTION_KEYS = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];

export default function PublicPortfolioView() {
  const { id } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedExp, setSelectedExp] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'portfolios', id));
        if (snap.exists()) {
          const data = snap.data();
          if (data.isPublic) {
            setPortfolio({ id: snap.id, ...data });
          } else {
            setError('비공개 포트폴리오입니다.');
          }
        } else {
          setError('포트폴리오를 찾을 수 없습니다.');
        }
      } catch (e) {
        setError('포트폴리오를 불러오는데 실패했습니다.');
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-700 mb-2">{error}</p>
          <p className="text-sm text-gray-400">올바른 링크인지 확인해주세요.</p>
        </div>
      </div>
    );
  }

  const p = portfolio;
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || {};
  const extra = p.extracurricular || {};

  const STATUS_MAP = {
    expected: { label: 'Expected', cls: 'bg-blue-500' },
    doing: { label: 'Doing', cls: 'bg-green-500' },
    finished: { label: 'Finished', cls: 'bg-red-500' },
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-8 px-4">

      {/* ── Notion Layout ── */}
      {(!p.templateId || p.templateId === 'notion') && (
      <div className="max-w-[1100px] mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" id="public-portfolio">

        {/* Header */}
        <div className="px-10 pt-10 pb-6 border-b border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{p.headline || p.title || '포트폴리오'}</h1>
          <p className="text-xs text-gray-400">FitPoly Portfolio</p>
        </div>

        {/* Quick Menu */}
        <div className="px-10 py-4 border-b border-gray-100 flex gap-3 overflow-x-auto">
          {['교과 활동', '비교과 활동', '기술', '목표와 계획', '가치관'].map(menu => (
            <a key={menu} href={`#pub-${menu}`}
              className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-600 font-medium whitespace-nowrap transition-colors">
              {menu}
            </a>
          ))}
        </div>

        {/* Three-column layout */}
        <div className="grid grid-cols-[260px_1fr_300px] min-h-[600px]">
          {/* Left: Profile */}
          <div className="p-6 border-r border-gray-100 bg-[#fafaf8]">
            <div className="text-xs font-bold text-gray-400 tracking-wider mb-4 border-l-2 border-blue-600 pl-2">PROFILE</div>
            {p.profileImageUrl ? (
              <img src={p.profileImageUrl} alt="profile" className="w-full aspect-square object-cover rounded-xl mb-4" />
            ) : (
              <div className="w-full aspect-square bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl mb-4 flex items-center justify-center">
                <span className="text-5xl">👤</span>
              </div>
            )}
            <h2 className="text-lg font-bold">{p.userName || '이름'}</h2>
            {p.nameEn && <p className="text-sm text-gray-500">({p.nameEn})</p>}
            {p.location && <p className="flex items-center gap-1 text-sm text-gray-500 mt-2"><MapPin size={12} /> {p.location}</p>}
            {p.birthDate && <p className="flex items-center gap-1 text-sm text-gray-500 mt-1"><Calendar size={12} /> {p.birthDate}</p>}
            {(p.values || []).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold italic mb-3">My Own Values</h3>
                <div className="space-y-2">
                  {p.values.map((v, i) => (
                    <div key={i} className="p-2.5 bg-white rounded-lg border border-gray-100">
                      <p className="text-sm font-medium text-gray-700">{['➕','➖','✖️','➗','🎓'][i%5]} {v.keyword}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Center */}
          <div className="p-6">
            {(p.education || []).length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4">🎓 Education</h3>
                <div className="space-y-6">
                  {p.education.map((edu, i) => (
                    <div key={i} className="pb-5 border-b border-gray-100 last:border-0">
                      <h4 className="text-base font-bold text-gray-900">{edu.name}</h4>
                      <p className="text-sm text-gray-400 mt-1">{edu.period}</p>
                      {edu.degree && <p className="text-sm text-gray-600 mt-1">{edu.degree}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(p.interests || []).length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-3">💡 Interest</h3>
                <ul className="space-y-1.5">
                  {p.interests.map((interest, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-gray-400">•</span>{interest}</li>
                  ))}
                </ul>
              </div>
            )}
            {(contact.phone || contact.email) && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-3">📞 Contact</h3>
                <div className="space-y-2 text-sm">
                  {contact.phone && <p className="flex items-center gap-2 text-gray-600"><Phone size={14} /> {contact.phone}</p>}
                  {contact.email && <p className="flex items-center gap-2 text-gray-600"><Mail size={14} /> {contact.email}</p>}
                  {contact.linkedin && <p className="flex items-center gap-2 text-gray-600"><Globe size={14} /> {contact.linkedin}</p>}
                </div>
              </div>
            )}
          </div>
          {/* Right */}
          <div className="p-6 border-l border-gray-100 bg-[#fafaf8]">
            {(p.awards || []).length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-bold mb-3">🏆 Awards</h3>
                <div className="space-y-2">
                  {p.awards.map((a, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-semibold text-gray-600 underline">{a.date}</span>{' '}
                      <span className="text-gray-700">{a.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(p.experiences || []).length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-3">🔥 Experience</h3>
                <div className="space-y-1.5">
                  {p.experiences.slice(0, 5).map((e, i) => (
                    <button key={i} onClick={() => setSelectedExp(e)} className="w-full text-left text-sm hover:bg-white rounded-lg p-1 -mx-1 transition-colors">
                      <span className="font-semibold text-gray-600 underline">{e.date}</span>{' '}
                      <span className="text-gray-700">{e.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Experience Gallery */}
        {(p.experiences || []).length > 0 && (
          <div className="px-10 py-8 border-t border-gray-100">
            <h2 className="text-xl font-bold pb-2 border-b-2 border-green-300 inline-block mb-4">🔥 프로젝트 / 경험</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
              {p.experiences.map((e, i) => {
                const st = STATUS_MAP[e.status] || STATUS_MAP.finished;
                return (
                  <button key={i} onClick={() => setSelectedExp(e)} className="group bg-white rounded-xl border border-gray-200 overflow-hidden text-left hover:shadow-md transition-all">
                    <div className="aspect-[4/3] bg-gray-50 overflow-hidden relative">
                      {e.thumbnailUrl ? (
                        <img src={e.thumbnailUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50"><span className="text-4xl opacity-50">📋</span></div>
                      )}
                      {e.date && <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{e.date}</span>}
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-bold text-gray-800 line-clamp-2 mb-1.5">{e.title || '(제목 없음)'}</h4>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`w-2 h-2 rounded-full ${st.cls}`} />
                        <span className="text-[11px] text-gray-500">{st.label}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Full-width sections */}
        <div className="px-10 py-8 border-t border-gray-100">
          {(curr.courses?.length > 0 || curr.summary?.credits) && (
          <section id="pub-교과 활동" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">📝 교과 활동</h2>
            {(curr.summary?.credits || curr.summary?.gpa) && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                {curr.summary?.credits && <p className="text-sm text-gray-700">📚 이수 학점: {curr.summary.credits}</p>}
                {curr.summary?.gpa && <p className="text-sm text-gray-700">📊 평점 평균: {curr.summary.gpa}</p>}
              </div>
            )}
            {(curr.courses || []).length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-gray-50"><th className="text-left px-3 py-2 border border-gray-200">학기</th><th className="text-left px-3 py-2 border border-gray-200">과목명</th><th className="text-left px-3 py-2 border border-gray-200">성적</th></tr></thead>
                <tbody>{curr.courses.map((c, i) => (<tr key={i}><td className="px-3 py-2 border border-gray-200">{c.semester}</td><td className="px-3 py-2 border border-gray-200">{c.name}</td><td className="px-3 py-2 border border-gray-200">{c.grade}</td></tr>))}</tbody>
              </table>
            )}
          </section>
          )}

          {(extra.details?.length > 0 || extra.badges?.length > 0 || extra.languages?.length > 0) && (
          <section id="pub-비교과 활동" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">💡 비교과 활동</h2>
            {extra.summary && <div className="bg-gray-50 rounded-xl p-4 mb-4"><p className="text-sm text-gray-700 whitespace-pre-line">{extra.summary}</p></div>}
            {(extra.badges || []).length > 0 && (
              <div className="mb-4"><h4 className="text-sm font-bold mb-2 text-gray-600">디지털 배지</h4>
                <div className="grid grid-cols-2 gap-2">{extra.badges.map((b, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100"><p className="text-sm font-medium text-gray-800">{b.name}</p><p className="text-xs text-gray-400">{b.issuer}</p></div>
                ))}</div>
              </div>
            )}
            {(extra.languages || []).length > 0 && (
              <div className="mb-4"><h4 className="text-sm font-bold mb-2 text-gray-600">어학 성적</h4>
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="bg-gray-50"><th className="text-left px-3 py-2 border border-gray-200">시험명</th><th className="text-left px-3 py-2 border border-gray-200">점수</th><th className="text-left px-3 py-2 border border-gray-200">취득일</th></tr></thead>
                  <tbody>{extra.languages.map((l, i) => (<tr key={i}><td className="px-3 py-2 border border-gray-200">{l.name}</td><td className="px-3 py-2 border border-gray-200">{l.score}</td><td className="px-3 py-2 border border-gray-200">{l.date}</td></tr>))}</tbody>
                </table>
              </div>
            )}
            {(extra.details || []).length > 0 && (
              <div className="space-y-3">{extra.details.map((d, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2 mb-1"><span className="text-sm font-bold text-gray-800">{d.title}</span><span className="text-xs text-gray-400">{d.period}</span></div>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{d.description}</p>
                </div>
              ))}</div>
            )}
          </section>
          )}

          <section id="pub-기술" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">🛠 기술</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(skills).filter(([_, arr]) => arr?.length > 0).map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-sm font-bold text-gray-600 mb-2">{category === 'tools' ? '도구' : category === 'languages' ? '프로그래밍 언어' : category === 'frameworks' ? '프레임워크' : '기타'}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((s, i) => {
                      const sName = typeof s === 'string' ? s : (s?.name || '');
                      const sProf = typeof s === 'string' ? 0 : (s?.proficiency || 0);
                      return (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-800 rounded-md text-xs font-medium border border-green-100">
                          {sName}
                          {sProf > 0 && <span className="flex gap-0.5 ml-0.5">{[1,2,3,4,5].map(l => (<span key={l} className={`w-1 h-2.5 rounded-sm ${l <= sProf ? 'bg-green-500' : 'bg-green-200'}`} />))}</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {(p.goals || []).length > 0 && (
          <section id="pub-목표와 계획" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">✨ 목표와 계획</h2>
            <div className="space-y-3">
              {p.goals.map((g, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${g.status === 'done' ? 'bg-green-100 text-green-700' : g.status === 'ing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {g.type === 'long' ? '장기' : g.type === 'mid' ? '중기' : '단기'}
                    </span>
                    <h4 className="text-sm font-bold text-gray-800">{g.title}</h4>
                  </div>
                  {g.description && <p className="text-sm text-gray-600 mt-1">{g.description}</p>}
                </div>
              ))}
            </div>
          </section>
          )}

          <section id="pub-가치관" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">💬 가치관</h2>
            {p.valuesEssay ? (
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{p.valuesEssay}</div>
            ) : (p.values || []).length > 0 ? (
              <div className="space-y-6">{p.values.map((v, i) => (
                <div key={i}><h4 className="text-base font-bold text-gray-800 mb-2">{v.keyword}</h4>{v.description && <p className="text-sm text-gray-600 leading-relaxed">{v.description}</p>}</div>
              ))}</div>
            ) : <p className="text-sm text-gray-400">작성된 가치관이 없습니다</p>}
          </section>
        </div>

        <div className="px-10 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>FitPoly Portfolio · {p.userName || ''}</span>
          <a href="#public-portfolio" className="flex items-center gap-1 hover:text-gray-600">맨 위로 <ChevronUp size={12} /></a>
        </div>
      </div>
      )}

      {/* ── Academic Layout ── */}
      {p.templateId === 'academic' && (
      <div className="max-w-[900px] mx-auto" id="public-portfolio">
        <div className="relative rounded-t-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 20% 50%, #60a5fa 0%, transparent 50%), radial-gradient(circle at 80% 50%, #818cf8 0%, transparent 50%)'}} />
          <div className="relative px-10 pt-12 pb-10 flex items-end gap-6">
            {p.profileImageUrl ? (
              <img src={p.profileImageUrl} alt="profile" className="w-28 h-28 rounded-2xl object-cover border-4 border-white/20 shadow-lg" />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-white/10 border-4 border-white/20 flex items-center justify-center text-5xl">👤</div>
            )}
            <div className="flex-1 pb-1">
              <h1 className="text-3xl font-bold text-white mb-1">{p.userName || '이름'}</h1>
              {p.nameEn && <p className="text-blue-200 text-sm">{p.nameEn}</p>}
              <p className="text-blue-300/70 text-xs mt-2">{p.headline || p.title || ''}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-b-2xl border border-t-0 border-gray-200 shadow-sm">
          {/* About */}
          <div className="px-10 py-8 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" /> 자기소개</h2>
            {p.valuesEssay ? <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{p.valuesEssay}</p>
            : (p.values || []).length > 0 ? (
              <div className="grid grid-cols-2 gap-3">{p.values.map((v, i) => (
                <div key={i} className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <p className="text-sm font-bold text-blue-900 mb-1">{v.keyword}</p>
                  {v.description && <p className="text-xs text-blue-700/70">{v.description}</p>}
                </div>
              ))}</div>
            ) : <p className="text-sm text-gray-400">소개가 없습니다.</p>}
          </div>
          {/* Contact */}
          {(contact.phone || contact.email) && (
            <div className="px-10 py-4 border-b border-gray-100 flex flex-wrap gap-4 bg-gray-50/50">
              {contact.email && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Mail size={12} /> {contact.email}</span>}
              {contact.phone && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Phone size={12} /> {contact.phone}</span>}
            </div>
          )}
          {/* Education + Awards */}
          <div className="px-10 py-8 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-emerald-500 rounded-full inline-block" /> 학력</h2>
                <div className="space-y-4 relative">
                  <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-emerald-100" />
                  {(p.education || []).map((edu, i) => (
                    <div key={i} className="flex items-start gap-3 relative">
                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white z-10 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-gray-800">{edu.name}</h4>
                        {edu.degree && <p className="text-xs text-gray-500">{edu.degree}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{edu.period}</p>
                      </div>
                    </div>
                  ))}
                  {(p.education || []).length === 0 && <p className="text-xs text-gray-400 ml-6">학력 정보 없음</p>}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-amber-500 rounded-full inline-block" /> 수상</h2>
                <div className="space-y-3">
                  {(p.awards || []).map((a, i) => (
                    <div key={i} className="flex items-start gap-3"><span className="text-lg">🏆</span><div><p className="text-sm font-medium text-gray-800">{a.title}</p><p className="text-xs text-gray-400">{a.date}</p></div></div>
                  ))}
                  {(p.awards || []).length === 0 && <p className="text-xs text-gray-400">수상 내역 없음</p>}
                </div>
              </div>
            </div>
          </div>
          {/* Experiences */}
          {(p.experiences || []).length > 0 && (
            <div className="px-10 py-8 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-violet-500 rounded-full inline-block" /> 프로젝트 / 경험</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {p.experiences.map((e, i) => (
                  <button key={i} onClick={() => setSelectedExp(e)} className="group text-left bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                    <div className="aspect-[16/10] bg-gradient-to-br from-slate-100 to-blue-50 overflow-hidden relative">
                      {e.thumbnailUrl ? <img src={e.thumbnailUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      : <div className="w-full h-full flex items-center justify-center"><span className="text-3xl opacity-40">📋</span></div>}
                    </div>
                    <div className="p-3"><h4 className="text-sm font-bold text-gray-800 line-clamp-1 mb-1">{e.title}</h4><p className="text-xs text-gray-400">{e.date}</p></div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Skills */}
          <div className="px-10 py-8 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-teal-500 rounded-full inline-block" /> 기술</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(skills).filter(([_, arr]) => arr?.length > 0).map(([category, items]) => (
                <div key={category} className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase">{category === 'tools' ? '도구' : category === 'languages' ? '언어' : category === 'frameworks' ? '프레임워크' : '기타'}</h4>
                  <div className="space-y-2">{items.map((s, i) => {
                    const sName = typeof s === 'string' ? s : (s?.name || '');
                    const sProf = typeof s === 'string' ? 0 : (s?.proficiency || 0);
                    return (<div key={i} className="flex items-center justify-between"><span className="text-sm text-gray-700">{sName}</span>
                      {sProf > 0 && <div className="flex gap-0.5">{[1,2,3,4,5].map(l => (<div key={l} className={`w-4 h-1.5 rounded-full ${l <= sProf ? 'bg-teal-500' : 'bg-gray-200'}`} />))}</div>}
                    </div>);
                  })}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Goals */}
          {(p.goals || []).length > 0 && (
            <div className="px-10 py-8 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-cyan-500 rounded-full inline-block" /> 목표</h2>
              <div className="space-y-3">{p.goals.map((g, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${g.status === 'done' ? 'bg-green-500' : g.status === 'ing' ? 'bg-blue-500' : 'bg-gray-400'}`}>{g.status === 'done' ? '✓' : '→'}</div>
                  <div><div className="flex items-center gap-2"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{g.type === 'long' ? '장기' : g.type === 'mid' ? '중기' : '단기'}</span><h4 className="text-sm font-bold text-gray-800">{g.title}</h4></div>
                  {g.description && <p className="text-xs text-gray-500 mt-1">{g.description}</p>}</div>
                </div>
              ))}</div>
            </div>
          )}
          <div className="px-10 py-4 bg-gray-50 flex items-center justify-between text-xs text-gray-400 rounded-b-2xl">
            <span>FitPoly Portfolio · {p.userName || ''}</span>
            <a href="#public-portfolio" className="hover:text-gray-600">맨 위로 ↑</a>
          </div>
        </div>
      </div>
      )}

      {/* ── Ashley Layout ── */}
      {p.templateId === 'ashley' && (
      <div className="max-w-[860px] mx-auto" id="public-portfolio">
        <div className="bg-[#f7f5f0] rounded-2xl border border-[#e8e4dc] shadow-sm overflow-hidden">
          <div className="px-10 pt-10 pb-8">
            <div className="flex items-start gap-6">
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-[#2d2a26] mb-2 tracking-tight">{p.userName || '이름'}</h1>
                {p.nameEn && <p className="text-[#8a8578] text-sm mb-3">{p.nameEn}</p>}
                <p className="text-[#5a564e] text-sm leading-relaxed">{p.headline || p.title || ''}</p>
                <div className="flex items-center gap-4 mt-4 text-xs text-[#8a8578]">
                  {contact.email && <span>{contact.email}</span>}
                  {contact.instagram && <span>Instagram</span>}
                  {contact.github && <span>GitHub</span>}
                </div>
              </div>
              {p.profileImageUrl ? <img src={p.profileImageUrl} alt="profile" className="w-24 h-24 rounded-2xl object-cover shadow-md" />
              : <div className="w-24 h-24 rounded-2xl bg-[#e8e4dc] flex items-center justify-center text-4xl shadow-md">👤</div>}
            </div>
          </div>
          {/* 한눈에 보기 + 이런 사람 */}
          <div className="px-10 pb-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
                <h3 className="font-bold text-sm text-[#2d2a26] mb-4">📋 한눈에 보기</h3>
                <div className="space-y-3 text-sm">
                  {p.location && <div className="flex justify-between"><span className="text-[#8a8578]">위치</span><span className="font-medium text-[#2d2a26]">{p.location}</span></div>}
                  {p.birthDate && <div className="flex justify-between"><span className="text-[#8a8578]">생년월일</span><span className="font-medium text-[#2d2a26]">{p.birthDate}</span></div>}
                  {contact.email && <div className="flex justify-between"><span className="text-[#8a8578]">이메일</span><span className="font-medium text-[#2d2a26] text-xs">{contact.email}</span></div>}
                  {(p.education || []).length > 0 && <div className="flex justify-between"><span className="text-[#8a8578]">학교</span><span className="font-medium text-[#2d2a26] text-xs">{p.education[0].name}</span></div>}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
                <h3 className="font-bold text-sm text-[#2d2a26] mb-4">✨ 저는 이런 사람이에요</h3>
                {(p.values || []).length > 0 ? (
                  <ul className="space-y-2.5">{p.values.map((v, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#5a564e]">
                      <span className="w-2 h-2 bg-[#c4a882] rounded-full mt-1.5 flex-shrink-0" />
                      <span className="font-medium text-[#2d2a26]">{v.keyword}</span>
                    </li>
                  ))}</ul>
                ) : <p className="text-sm text-[#8a8578]">가치관 정보가 없습니다.</p>}
              </div>
            </div>
          </div>
          {/* 인터뷰 */}
          {(p.experiences || []).length > 0 && (
            <div className="px-10 pb-8">
              <div className="bg-white rounded-xl p-6 border border-[#e8e4dc]">
                <h3 className="font-bold text-lg text-[#2d2a26] mb-5">💬 인터뷰</h3>
                <div className="space-y-5">{p.experiences.slice(0, 3).map((e, i) => (
                  <div key={i} className="flex gap-5 cursor-pointer group" onClick={() => setSelectedExp(e)}>
                    <div className="flex-1">
                      <p className="font-medium text-[#2d2a26] text-sm mb-1 group-hover:text-[#c4a882] transition-colors">Q. {e.title}에 대해 이야기해주세요.</p>
                      <p className="text-sm text-[#8a8578] leading-relaxed line-clamp-3">{e.description || '클릭하여 확인'}</p>
                    </div>
                    {e.thumbnailUrl && <img src={e.thumbnailUrl} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />}
                  </div>
                ))}</div>
              </div>
            </div>
          )}
          {/* 프로젝트 */}
          {(p.experiences || []).length > 0 && (
            <div className="px-10 pb-8">
              <h3 className="font-bold text-lg text-[#2d2a26] mb-4">🎨 프로젝트</h3>
              <div className="grid grid-cols-3 gap-4">{p.experiences.map((e, i) => (
                <button key={i} onClick={() => setSelectedExp(e)} className="group text-left bg-white rounded-xl border border-[#e8e4dc] overflow-hidden hover:shadow-lg transition-all">
                  <div className="aspect-[4/3] bg-[#f0ece4] overflow-hidden">
                    {e.thumbnailUrl ? <img src={e.thumbnailUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">{['🎯','📱','🎨'][i % 3]}</div>}
                  </div>
                  <div className="p-3"><h4 className="text-sm font-bold text-[#2d2a26] line-clamp-1">{e.title}</h4><p className="text-xs text-[#8a8578]">{e.date}</p></div>
                </button>
              ))}</div>
            </div>
          )}
          {/* Skills */}
          <div className="px-10 pb-8">
            <h3 className="font-bold text-lg text-[#2d2a26] mb-4">💼 이런 일을 할 수 있어요</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(skills).filter(([_, arr]) => arr?.length > 0).map(([category, items]) => (
                <div key={category} className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
                  <h4 className="text-xs font-bold text-[#8a8578] mb-3 uppercase">{category === 'tools' ? '도구' : category === 'languages' ? '프로그래밍' : category === 'frameworks' ? '프레임워크' : '기타'}</h4>
                  <div className="flex flex-wrap gap-2">{items.map((s, i) => {
                    const sName = typeof s === 'string' ? s : (s?.name || '');
                    return <span key={i} className="px-3 py-1.5 bg-[#f7f5f0] text-[#5a564e] rounded-full text-xs font-medium">{sName}</span>;
                  })}</div>
                </div>
              ))}
            </div>
          </div>
          {/* 가치관 */}
          {p.valuesEssay && (
            <div className="px-10 pb-8">
              <div className="bg-white rounded-xl p-6 border border-[#e8e4dc]">
                <h3 className="font-bold text-lg text-[#2d2a26] mb-4">📝 나를 들려주는 이야기</h3>
                <div className="text-sm text-[#5a564e] leading-[1.9] whitespace-pre-line">{p.valuesEssay}</div>
              </div>
            </div>
          )}
          <div className="px-10 py-5 border-t border-[#e8e4dc] flex items-center justify-between text-xs text-[#8a8578]">
            <span>FitPoly Portfolio · {p.userName || ''}</span>
            <a href="#public-portfolio" className="hover:text-[#5a564e]">맨 위로 ↑</a>
          </div>
        </div>
      </div>
      )}

      {/* ── Timeline Layout ── */}
      {p.templateId === 'timeline' && (
      <div className="max-w-[900px] mx-auto" id="public-portfolio">
        <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-t-2xl px-8 pt-8 pb-6">
          <div className="flex items-center gap-4 mb-6">
            {p.profileImageUrl ? (
              <img src={p.profileImageUrl} alt="" className="w-16 h-16 rounded-full object-cover ring-4 ring-white/20" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-3xl ring-4 ring-white/20">👤</div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{p.headline || p.userName || '대시보드'}</h1>
              {(p.education || []).length > 0 && (
                <p className="text-blue-200/70 text-xs mt-0.5">{p.education[0].name} · {p.education[0].degree}</p>
              )}
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <p className="text-sm text-white/50 mb-3 text-center font-medium">{new Date().getFullYear()}년 {new Date().getMonth()+1}월</p>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['일','월','화','수','목','금','토'].map(d => <div key={d} className="text-xs text-white/30 font-medium pb-1">{d}</div>)}
              {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }, (_, i) => <div key={'e'+i} />)}
              {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate() }, (_, i) => (
                <div key={i} className={`text-xs py-1.5 rounded-lg ${i+1 === new Date().getDate() ? 'bg-purple-500 text-white font-bold' : 'text-white/40'}`}>{i+1}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-b-2xl border border-t-0 border-surface-200 shadow-sm">
          {(() => {
            const curr = p.curricular || {};
            const coursesBySemester = (curr.courses || []).reduce((acc, c) => { const sem = c.semester || '기타'; if (!acc[sem]) acc[sem] = []; acc[sem].push(c); return acc; }, {});
            const semesterKeys = Object.keys(coursesBySemester).sort();
            return semesterKeys.length > 0 && (
              <div className="px-8 py-6 border-b border-surface-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-purple-500 rounded-full" /> 학기별 수업</h2>
                <div className="space-y-4">
                  {semesterKeys.map(sem => (
                    <div key={sem} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm font-bold text-gray-700 mb-2">{sem}</p>
                      <div className="flex flex-wrap gap-2">
                        {coursesBySemester[sem].map((c, i) => (
                          <span key={i} className="px-3 py-1.5 bg-white rounded-lg text-sm text-gray-600 border border-gray-200">{c.name}{c.grade ? ` (${c.grade})` : ''}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {(p.experiences || []).length > 0 && (
            <div className="px-8 py-6 border-b border-surface-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-blue-500 rounded-full" /> 활동 기록</h2>
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
                <div className="space-y-4">
                  {[...(p.experiences || [])].sort((a, b) => (b.period || '').localeCompare(a.period || '')).map((exp, i) => (
                    <div key={i} className="flex items-start gap-3 relative cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors" onClick={() => setSelectedExp(exp)}>
                      <div className={`w-4 h-4 rounded-full flex-shrink-0 mt-0.5 z-10 border-2 border-white ${exp.category === 'award' ? 'bg-amber-400' : exp.category === 'study' ? 'bg-purple-400' : 'bg-blue-400'}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{exp.title}</p>
                        <p className="text-xs text-gray-400">{exp.period} {exp.role ? `· ${exp.role}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {(p.goals || []).length > 0 && (
            <div className="px-8 py-6 border-b border-surface-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-emerald-500 rounded-full" /> 스터디 계획</h2>
              <div className="grid grid-cols-2 gap-3">
                {p.goals.map((g, i) => (
                  <div key={i} className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-sm font-bold text-emerald-800 mb-1">{g.title}</p>
                    <p className="text-xs text-emerald-600">{g.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="px-8 py-4 bg-surface-50 flex items-center justify-between text-xs text-gray-400 rounded-b-2xl">
            <span>FitPoly Dashboard · {p.userName || ''}</span>
            <a href="#public-portfolio" className="hover:text-gray-600">맨 위로 ↑</a>
          </div>
        </div>
      </div>
      )}

      {/* Experience Detail Modal */}
      {selectedExp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedExp(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900 truncate max-w-[480px]">{selectedExp.title}</h3>
              <button onClick={() => setSelectedExp(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 썸네일 */}
              {selectedExp.thumbnailUrl && (
                <div className="w-full h-44 rounded-xl overflow-hidden bg-gray-50">
                  <img src={selectedExp.thumbnailUrl} alt={selectedExp.title} className="w-full h-full object-cover" />
                </div>
              )}

              {/* 기본 정보 */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                {selectedExp.date && <span>📅 {selectedExp.date}</span>}
                {selectedExp.role && <span>👤 {selectedExp.role}</span>}
                {selectedExp.structuredResult?.projectOverview?.team && (
                  <span>👥 {selectedExp.structuredResult.projectOverview.team}</span>
                )}
                {selectedExp.structuredResult?.projectOverview?.duration && (
                  <span>⏱ {selectedExp.structuredResult.projectOverview.duration}</span>
                )}
              </div>

              {/* 스킬 태그 */}
              {((selectedExp.skills?.length ? selectedExp.skills : (selectedExp.structuredResult?.projectOverview?.techStack || [])).length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {(selectedExp.skills?.length ? selectedExp.skills : selectedExp.structuredResult.projectOverview.techStack).map((s, i) => (
                    <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-100">
                      {typeof s === 'string' ? s : s?.name}
                    </span>
                  ))}
                </div>
              )}

              {/* 설명 */}
              {(selectedExp.description || selectedExp.structuredResult?.projectOverview?.summary) && (
                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4 whitespace-pre-line">
                  {selectedExp.description || selectedExp.structuredResult.projectOverview.summary}
                </p>
              )}

              {/* structuredResult 상세 섹션 */}
              {(() => {
                const structured = selectedExp.structuredResult || {};
                const hasSections = EXP_SECTION_KEYS.some(k => (typeof structured[k] === 'string' ? structured[k] : '')?.trim());
                if (!hasSections) return null;
                return (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="divide-y divide-gray-100">
                      {EXP_SECTION_KEYS.map(key => {
                        const meta = EXP_SECTION_META[key];
                        const val = typeof structured[key] === 'string' ? structured[key] : '';
                        if (!val?.trim()) return null;
                        return (
                          <div key={key}>
                            <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-50">
                              <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center text-[11px] font-bold">
                                {meta.num}
                              </span>
                              <span className="text-[13px] font-bold text-blue-700">{meta.label}</span>
                            </div>
                            <div className="px-5 py-3 pl-[60px]">
                              <p className="text-[13px] text-gray-700 leading-[1.85] whitespace-pre-wrap">{val}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* keyExperiences */}
              {(selectedExp.structuredResult?.keyExperiences || []).length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3">핵심 경험 &amp; 성과</h4>
                  <div className="space-y-2">
                    {selectedExp.structuredResult.keyExperiences.map((ke, ki) => (
                      <div key={ki} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-sm font-semibold text-gray-800">{ke.title}</p>
                        {ke.metric && <p className="text-xs text-green-600 font-bold mt-0.5">{ke.metric}</p>}
                        {ke.description && <p className="text-xs text-gray-500 mt-1">{ke.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 커스텀 섹션 (exp.sections) */}
              {(selectedExp.sections || []).length > 0 && (
                <div className="space-y-3">
                  {selectedExp.sections.map((sec, i) => (
                    sec.content?.trim() ? (
                      <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        {sec.title && <h4 className="text-sm font-bold text-gray-800 mb-2">{sec.title}</h4>}
                        <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{sec.content}</p>
                      </div>
                    ) : null
                  ))}
                </div>
              )}

              {/* 링크 */}
              {selectedExp.link && (
                <a href={selectedExp.link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                  <ExternalLink size={14} /> 링크 보기
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
