import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  MapPin, Calendar, Mail, Phone, Globe, ChevronUp, ExternalLink,
  Loader2, Code, Tag
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

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
      <div className="max-w-[1100px] mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" id="public-portfolio">

        {/* Header */}
        <div className="px-10 pt-10 pb-6 border-b border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{p.headline || p.title || '포트폴리오'}</h1>
          <p className="text-xs text-gray-400">POPOL Portfolio</p>
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
                      <h4 className="text-base font-bold text-gray-900">{edu.name} {edu.nameEn && <span className="font-normal text-gray-500">({edu.nameEn})</span>}</h4>
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
                  {contact.instagram && <p className="flex items-center gap-2 text-gray-600"><Globe size={14} /> {contact.instagram}</p>}
                  {contact.github && <p className="flex items-center gap-2 text-gray-600"><Globe size={14} /> {contact.github}</p>}
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
                      {(e.classify || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {e.classify.map((tag, ti) => (
                            <span key={ti} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Full-width sections */}
        <div className="px-10 py-8 border-t border-gray-100">
          {/* 교과 활동 */}
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
                <thead><tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 border border-gray-200">학기</th>
                  <th className="text-left px-3 py-2 border border-gray-200">과목명</th>
                  <th className="text-left px-3 py-2 border border-gray-200">성적</th>
                </tr></thead>
                <tbody>{curr.courses.map((c, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 border border-gray-200">{c.semester}</td>
                    <td className="px-3 py-2 border border-gray-200">{c.name}</td>
                    <td className="px-3 py-2 border border-gray-200">{c.grade}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </section>

          {/* 비교과 활동 */}
          <section id="pub-비교과 활동" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">💡 비교과 활동</h2>
            {extra.summary && <div className="bg-gray-50 rounded-xl p-4 mb-4"><p className="text-sm text-gray-700 whitespace-pre-line">{extra.summary}</p></div>}
            {(extra.badges || []).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">디지털 배지</h4>
                <div className="grid grid-cols-2 gap-2">
                  {extra.badges.map((b, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-sm font-medium text-gray-800">{b.name}</p>
                      <p className="text-xs text-gray-400">{b.issuer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(extra.languages || []).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">어학 성적</h4>
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 border border-gray-200">시험명</th>
                    <th className="text-left px-3 py-2 border border-gray-200">점수</th>
                    <th className="text-left px-3 py-2 border border-gray-200">취득일</th>
                  </tr></thead>
                  <tbody>{extra.languages.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 border border-gray-200">{l.name}</td>
                      <td className="px-3 py-2 border border-gray-200">{l.score}</td>
                      <td className="px-3 py-2 border border-gray-200">{l.date}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {(extra.details || []).length > 0 && (
              <div className="space-y-3">
                {extra.details.map((d, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-800">{d.title}</span>
                      <span className="text-xs text-gray-400">{d.period}</span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{d.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 기술 */}
          <section id="pub-기술" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">🛠 기술</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(skills).filter(([_, arr]) => arr?.length > 0).map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-sm font-bold text-gray-600 mb-2">
                    {category === 'tools' ? '도구' : category === 'languages' ? '프로그래밍 언어' : category === 'frameworks' ? '프레임워크' : '기타'}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 bg-green-50 text-green-800 rounded-md text-xs font-medium border border-green-100">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 목표 */}
          <section id="pub-목표와 계획" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">✨ 목표와 계획</h2>
            {(p.goals || []).length > 0 ? (
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
            ) : <p className="text-sm text-gray-400">등록된 목표가 없습니다</p>}
          </section>

          {/* 가치관 */}
          <section id="pub-가치관" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">💬 가치관</h2>
            {p.valuesEssay ? (
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{p.valuesEssay}</div>
            ) : (p.values || []).length > 0 ? (
              <div className="space-y-6">
                {p.values.map((v, i) => (
                  <div key={i}>
                    <h4 className="text-base font-bold text-gray-800 mb-2">{['➕','➖','✖️','➗','🎓'][i%5]} {v.keyword}</h4>
                    {v.description && <p className="text-sm text-gray-600 leading-relaxed">{v.description}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">작성된 가치관이 없습니다</p>}
          </section>
        </div>

        {/* Footer */}
        <div className="px-10 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>POPOL Portfolio · {p.userName || ''}</span>
          <a href="#public-portfolio" className="flex items-center gap-1 hover:text-gray-600">맨 위로 <ChevronUp size={12} /></a>
        </div>
      </div>

      {/* Experience Detail Modal */}
      {selectedExp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedExp(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{selectedExp.title}</h3>
              <button onClick={() => setSelectedExp(null)} className="p-1 text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
              {selectedExp.date && <span>{selectedExp.date}</span>}
              {selectedExp.role && <span>· {selectedExp.role}</span>}
            </div>
            {selectedExp.description && <p className="text-sm text-gray-700 mb-4 whitespace-pre-line">{selectedExp.description}</p>}
            {(selectedExp.skills || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selectedExp.skills.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{s}</span>
                ))}
              </div>
            )}
            {(selectedExp.sections || []).map((sec, i) => (
              <div key={i} className="mt-4">
                <h4 className="text-sm font-bold text-gray-800 mb-2">{sec.title}</h4>
                <p className="text-sm text-gray-600 whitespace-pre-line">{sec.content}</p>
              </div>
            ))}
            {selectedExp.link && (
              <a href={selectedExp.link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-4 text-sm text-blue-600 hover:underline">
                <ExternalLink size={14} /> 링크 보기
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
