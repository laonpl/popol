import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Edit, Loader2, MapPin, Calendar,
  ExternalLink, Mail, Phone, Globe, ChevronUp, X, Key, FileText, Info,
  Code, Monitor, ChevronRight, Tag, Share2, Copy, Check, Link2
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import { FRAMEWORKS } from '../../stores/experienceStore';
import KeyExperienceSlider from '../../components/KeyExperienceSlider';
import toast from 'react-hot-toast';

const NOTION_TOKEN_KEY = 'popol_notion_token';
const NOTION_PAGE_KEY = 'popol_notion_page';

export default function NotionPortfolioPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { updatePortfolio, setCurrentPortfolio } = usePortfolioStore();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExp, setSelectedExp] = useState(null);
  const [isPublic, setIsPublic] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const snap = await getDoc(doc(db, 'portfolios', id));
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() };
        setPortfolio(p);
        setCurrentPortfolio(p);
        setIsPublic(!!p.isPublic);
      }
    } catch (e) { toast.error('불러오기 실패'); }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-600" /></div>;
  if (!portfolio) return <p className="text-center py-20 text-gray-400">포트폴리오를 찾을 수 없습니다</p>;

  const p = portfolio;
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || {};
  const extra = p.extracurricular || {};

  return (
    <div className="animate-fadeIn">
      {/* Admin bar */}
      <div className="flex items-center justify-between mb-4 max-w-[1100px] mx-auto">
        <Link to="/app/portfolio" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft size={16} /> 목록으로
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/app/portfolio/edit-notion/${id}`)}
            className="flex items-center gap-2 px-4 py-2 border border-surface-200 rounded-xl text-sm text-gray-600 hover:bg-surface-50">
            <Edit size={14} /> 편집
          </button>
          <button onClick={() => navigate(`/app/portfolio/pdf/${id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-medium hover:from-red-600 hover:to-red-700">
            <FileText size={14} /> PDF 내보내기
          </button>
          <button onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl text-sm font-medium hover:from-gray-900 hover:to-black">
            <Download size={14} /> Notion으로 내보내기
          </button>
        </div>
      </div>

      {/* 공유 링크 */}
      <div className="max-w-[1100px] mx-auto mb-4">
        <div className="flex items-center gap-4 bg-white rounded-xl border border-surface-200 px-5 py-3">
          <Share2 size={16} className="text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">공개 링크</span>
              <button
                onClick={async () => {
                  setTogglingPublic(true);
                  const newVal = !isPublic;
                  try {
                    await updatePortfolio(id, { isPublic: newVal });
                    setIsPublic(newVal);
                    toast.success(newVal ? '포트폴리오가 공개되었습니다' : '공개가 해제되었습니다');
                  } catch { toast.error('공개 설정 변경 실패'); }
                  setTogglingPublic(false);
                }}
                disabled={togglingPublic}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isPublic ? 'bg-primary-500' : 'bg-gray-300'} ${togglingPublic ? 'opacity-50' : ''}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {isPublic && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{`${window.location.origin}/p/${id}`}</p>
            )}
          </div>
          {isPublic && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/p/${id}`);
                setLinkCopied(true);
                toast.success('링크가 복사되었습니다!');
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors flex-shrink-0"
            >
              {linkCopied ? <Check size={12} /> : <Copy size={12} />}
              {linkCopied ? '복사됨' : '링크 복사'}
            </button>
          )}
        </div>
      </div>

      {/* ── Template Layouts ── */}
      {(!p.templateId || p.templateId === 'notion') ? (
      <div className="max-w-[1100px] mx-auto bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden" id="notion-portfolio">

        {/* Header / Title */}
        <div className="px-10 pt-10 pb-6 border-b border-surface-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{p.headline || p.title || '포트폴리오'}</h1>
          <p className="text-xs text-gray-400">본 포트폴리오는 PC 환경에 최적화되어 있습니다.</p>
        </div>

        {/* Quick Menu - 템플릿별 차별화 */}
        <div className="px-10 py-4 border-b border-surface-100 flex gap-3 overflow-x-auto">
          {(p.templateId === 'ashley'
            ? ['프로젝트', '기술', '가치관']
            : p.templateId === 'academic'
            ? ['학력', '교과 활동', '비교과 활동', '기술', '수상 내역', '목표와 계획', '가치관']
            : ['교과 활동', '비교과 활동', '기술', '목표와 계획', '가치관']
          ).map(menu => (
            <a key={menu} href={`#section-${menu}`}
              className="px-4 py-2 bg-surface-50 hover:bg-surface-100 rounded-lg text-sm text-gray-600 font-medium whitespace-nowrap transition-colors">
              {menu}
            </a>
          ))}
        </div>

        {/* Three-column layout */}
        <div className="grid grid-cols-[260px_1fr_300px] min-h-[600px]">

          {/* ── Left: Profile ── */}
          <div className="p-6 border-r border-surface-100 bg-[#fafaf8]">
            <div className="text-xs font-bold text-gray-400 tracking-wider mb-4 border-l-2 border-primary-600 pl-2">PROFILE</div>
            {p.profileImageUrl && (
              <img src={p.profileImageUrl} alt="profile" className="w-full aspect-square object-cover rounded-xl mb-4" />
            )}
            {!p.profileImageUrl && (
              <div className="w-full aspect-square bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl mb-4 flex items-center justify-center">
                <span className="text-5xl">👤</span>
              </div>
            )}
            <h2 className="text-lg font-bold">{p.userName || '이름'}</h2>
            {p.nameEn && <p className="text-sm text-gray-500">({p.nameEn})</p>}
            {p.location && (
              <p className="flex items-center gap-1 text-sm text-gray-500 mt-2"><MapPin size={12} /> {p.location}</p>
            )}
            {p.birthDate && (
              <p className="flex items-center gap-1 text-sm text-gray-500 mt-1"><Calendar size={12} /> {p.birthDate}</p>
            )}

            {/* Values */}
            {(p.values || []).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold italic mb-3">My Own Values</h3>
                <div className="space-y-2">
                  {p.values.map((v, i) => (
                    <div key={i} className="p-2.5 bg-white rounded-lg border border-surface-100">
                      <p className="text-sm font-medium text-gray-700">
                        {['➕', '➖', '✖️', '➗', '🎓'][i % 5]} {v.keyword}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Center: Education, Interests ── */}
          <div className="p-6">
            {/* Education - Ashley 템플릿에서는 숨김 */}
            {p.templateId !== 'ashley' && (p.education || []).length > 0 && (
              <div className="mb-8" id="section-학력">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">🎓 Education</h3>
                <div className="space-y-6">
                  {p.education.map((edu, i) => (
                    <div key={i} className="pb-5 border-b border-surface-100 last:border-0">
                      <h4 className="text-base font-bold text-gray-900">
                        {edu.name} {edu.nameEn && <span className="font-normal text-gray-500">({edu.nameEn})</span>}
                      </h4>
                      <p className="text-sm text-gray-400 mt-1">{edu.period}</p>
                      {edu.degree && <p className="text-sm text-gray-600 mt-1">{edu.degree}</p>}
                      {edu.detail && <p className="text-sm text-gray-500 mt-1">{edu.detail}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {(p.interests || []).length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">💡 Interest</h3>
                <ul className="space-y-1.5">
                  {p.interests.map((interest, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      {interest}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contact */}
            {(contact.phone || contact.email || contact.linkedin) && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">📞 Contact Information</h3>
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

          {/* ── Right: Awards & Experience ── */}
          <div className="p-6 border-l border-surface-100 bg-[#fafaf8]">
            {/* Awards - Ashley 템플릿에서는 숨김 */}
            {p.templateId !== 'ashley' && (p.awards || []).length > 0 && (
              <div className="mb-8" id="section-수상 내역">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">🏆 Scholarship and Awards</h3>
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

            {/* Experience (요약 목록) */}
            {(p.experiences || []).length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">🔥 Experience</h3>
                <div className="space-y-1.5">
                  {p.experiences.slice(0, 5).map((e, i) => (
                    <button key={i} onClick={() => setSelectedExp(e)}
                      className="w-full text-left text-sm group hover:bg-white rounded-lg p-1 -mx-1 transition-colors">
                      <span className="font-semibold text-gray-600 underline">{e.date}</span>{' '}
                      <span className="text-gray-700">{e.title}</span>
                    </button>
                  ))}
                  {p.experiences.length > 5 && <p className="text-xs text-gray-400">외 {p.experiences.length - 5}건 — 아래 갤러리에서 확인</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Experience Gallery ── */}
        {(p.experiences || []).length > 0 && (
          <div className="px-10 py-8 border-t border-surface-100">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold pb-2 border-b-2 border-green-300 inline-block">🔥 프로젝트 / 경험</h2>
              <p className="text-xs text-gray-400">⚠️ 각 항목을 클릭하시면 소개, 참여 동기, 활동 내용에 대한 정보를 확인하실 수 있습니다.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
              {p.experiences.map((e, i) => {
                const statusMap = { expected: { label: 'Expected', cls: 'bg-blue-500' }, doing: { label: 'Doing', cls: 'bg-green-500' }, finished: { label: 'Finished', cls: 'bg-red-500' } };
                const st = statusMap[e.status] || statusMap.finished;
                return (
                  <button key={i} onClick={() => setSelectedExp(e)}
                    className="group bg-white rounded-xl border border-surface-200 overflow-hidden text-left hover:shadow-md hover:border-surface-300 transition-all">
                    {/* Thumbnail */}
                    <div className="aspect-[4/3] bg-surface-50 overflow-hidden relative">
                      {e.thumbnailUrl ? (
                        <img src={e.thumbnailUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-100 to-surface-50">
                          <span className="text-4xl opacity-50">📋</span>
                        </div>
                      )}
                      {e.date && (
                        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{e.date}</span>
                      )}
                    </div>
                    {/* Card body */}
                    <div className="p-3">
                      <h4 className="text-sm font-bold text-gray-800 leading-snug line-clamp-2 mb-1.5">{e.title || '(제목 없음)'}</h4>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`w-2 h-2 rounded-full ${st.cls}`} />
                        <span className="text-[11px] text-gray-500">{st.label}</span>
                      </div>
                      {(e.classify || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {e.classify.map((tag, ti) => (
                            <span key={ti} className="px-1.5 py-0.5 bg-surface-100 text-gray-500 rounded text-[10px]">{tag}</span>
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

        {/* ── Full-width sections ── */}
        <div className="px-10 py-8 border-t border-surface-100">

          {/* 교과 활동 - Ashley 템플릿에서는 숨김 */}
          {p.templateId !== 'ashley' && (
          <section id="section-교과 활동" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">📝 교과 활동 | Curricular Activities</h2>
            {(curr.summary?.credits || curr.summary?.gpa) && (
              <div className="bg-surface-50 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">요약 | Summary</h4>
                {curr.summary?.credits && <p className="text-sm text-gray-700">📚 이수 학점: {curr.summary.credits}</p>}
                {curr.summary?.gpa && <p className="text-sm text-gray-700">📊 평점 평균: {curr.summary.gpa}</p>}
              </div>
            )}
            {(curr.courses || []).length > 0 && (
              <div>
                <h4 className="text-sm font-bold mb-2 text-gray-600">교과목 수강 내역 | Course History</h4>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-50">
                      <th className="text-left px-3 py-2 border border-surface-200">학기</th>
                      <th className="text-left px-3 py-2 border border-surface-200">과목명</th>
                      <th className="text-left px-3 py-2 border border-surface-200">성적</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curr.courses.map((c, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 border border-surface-200">{c.semester}</td>
                        <td className="px-3 py-2 border border-surface-200">{c.name}</td>
                        <td className="px-3 py-2 border border-surface-200">{c.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(curr.creditStatus || []).length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">이수 현황 | Credit Status</h4>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-50">
                      <th className="text-left px-3 py-2 border border-surface-200">구분</th>
                      <th className="text-left px-3 py-2 border border-surface-200">영역</th>
                      <th className="text-left px-3 py-2 border border-surface-200">기준학점</th>
                      <th className="text-left px-3 py-2 border border-surface-200">취득학점</th>
                      <th className="text-left px-3 py-2 border border-surface-200">잔여학점</th>
                      <th className="text-left px-3 py-2 border border-surface-200">달성률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curr.creditStatus.map((cs, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 border border-surface-200">{cs.category}</td>
                        <td className="px-3 py-2 border border-surface-200">{cs.area}</td>
                        <td className="px-3 py-2 border border-surface-200">{cs.required}</td>
                        <td className="px-3 py-2 border border-surface-200">{cs.earned}</td>
                        <td className="px-3 py-2 border border-surface-200">{cs.remaining}</td>
                        <td className="px-3 py-2 border border-surface-200">{cs.rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          )}

          {/* 비교과 활동 - Ashley 템플릿에서는 숨김 */}
          {p.templateId !== 'ashley' && (
          <section id="section-비교과 활동" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">💡 비교과 활동 | Extracurricular Activities</h2>
            {extra.summary && (
              <div className="bg-surface-50 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">요약 | Summary</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line">{extra.summary}</p>
              </div>
            )}
            {(extra.badges || []).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">디지털 배지 | Digital Badge</h4>
                <div className="grid grid-cols-2 gap-2">
                  {extra.badges.map((b, i) => (
                    <div key={i} className="p-3 bg-surface-50 rounded-lg border border-surface-100">
                      <p className="text-sm font-medium text-gray-800">{b.name}</p>
                      <p className="text-xs text-gray-400">{b.issuer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(extra.languages || []).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-bold mb-2 text-gray-600">어학 성적 | Language Certification</h4>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-50">
                      <th className="text-left px-3 py-2 border border-surface-200">시험명</th>
                      <th className="text-left px-3 py-2 border border-surface-200">점수/등급</th>
                      <th className="text-left px-3 py-2 border border-surface-200">취득일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extra.languages.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 border border-surface-200">{l.name}</td>
                        <td className="px-3 py-2 border border-surface-200">{l.score}</td>
                        <td className="px-3 py-2 border border-surface-200">{l.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(extra.details || []).length > 0 && (
              <div>
                <h4 className="text-sm font-bold mb-2 text-gray-600">세부 사항 | Details</h4>
                <div className="space-y-3">
                  {extra.details.map((d, i) => (
                    <div key={i} className="p-4 bg-surface-50 rounded-lg border border-surface-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-800">{d.title}</span>
                        <span className="text-xs text-gray-400">{d.period}</span>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-line">{d.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
          )}

          {/* 기술 */}
          <section id="section-기술" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">🛠 기술 | Skills</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(skills).filter(([_, arr]) => arr && arr.length > 0).map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-sm font-bold text-gray-600 mb-2 capitalize">
                    {category === 'tools' ? '도구' : category === 'languages' ? '프로그래밍 언어' : category === 'frameworks' ? '프레임워크' : '기타'}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((skill, i) => {
                      const sName = typeof skill === 'string' ? skill : (skill?.name || '');
                      const sProf = typeof skill === 'string' ? 0 : (skill?.proficiency || 0);
                      return (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-800 rounded-md text-xs font-medium border border-green-100">
                          {sName}
                          {sProf > 0 && (
                            <span className="flex gap-0.5 ml-0.5">
                              {[1,2,3,4,5].map(l => (
                                <span key={l} className={`w-1 h-2.5 rounded-sm ${l <= sProf ? 'bg-green-500' : 'bg-green-200'}`} />
                              ))}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 목표와 계획 - Ashley 템플릿에서는 숨김 */}
          {p.templateId !== 'ashley' && (
          <section id="section-목표와 계획" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">✨ 목표와 계획 | Future Plans</h2>
            {(p.goals || []).length > 0 ? (
              <div className="space-y-3">
                {p.goals.map((g, i) => (
                  <div key={i} className="p-4 bg-surface-50 rounded-lg border border-surface-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        g.status === 'done' ? 'bg-green-100 text-green-700'
                          : g.status === 'ing' ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}>
                        {g.type === 'long' ? '장기' : g.type === 'mid' ? '중기' : '단기'}
                      </span>
                      <h4 className="text-sm font-bold text-gray-800">{g.title}</h4>
                      <span className={`ml-auto text-xs ${g.status === 'done' ? 'text-green-600' : g.status === 'ing' ? 'text-blue-600' : 'text-gray-400'}`}>
                        {g.status === 'done' ? '✅ 완료' : g.status === 'ing' ? '🔄 진행 중' : '📋 예정'}
                      </span>
                    </div>
                    {g.description && <p className="text-sm text-gray-600 mt-1">{g.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">아직 등록된 목표가 없습니다</p>
            )}
          </section>
          )}

          {/* 가치관 */}
          <section id="section-가치관" className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b-2 border-green-300 inline-block">💬 가치관 | Values</h2>
            {p.valuesEssay ? (
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                {p.valuesEssay}
              </div>
            ) : (p.values || []).length > 0 ? (
              <div className="space-y-6">
                {p.values.map((v, i) => (
                  <div key={i}>
                    <h4 className="text-base font-bold text-gray-800 mb-2">
                      {['➕', '➖', '✖️', '➗', '🎓'][i % 5]} {v.keyword}
                    </h4>
                    {v.description && <p className="text-sm text-gray-600 leading-relaxed">{v.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">아직 작성된 가치관이 없습니다</p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-10 py-4 bg-surface-50 border-t border-surface-100 flex items-center justify-between text-xs text-gray-400">
          <span>POPOL Portfolio · {p.userName || ''}</span>
          <a href="#notion-portfolio" className="flex items-center gap-1 hover:text-gray-600">맨 위로 <ChevronUp size={12} /></a>
        </div>
      </div>
      ) : p.templateId === 'academic' ? (
        <AcademicLayout p={p} setSelectedExp={setSelectedExp} />
      ) : p.templateId === 'timeline' ? (
        <TimelineLayout p={p} setSelectedExp={setSelectedExp} />
      ) : (
        <AshleyLayout p={p} setSelectedExp={setSelectedExp} />
      )}

      {/* Notion Export Modal */}
      {showExportModal && (
        <NotionExportModal
          portfolio={portfolio}
          userId={user.uid}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Experience Detail Modal */}
      {selectedExp && (
        <ExperienceDetailModal
          exp={selectedExp}
          onClose={() => setSelectedExp(null)}
        />
      )}
    </div>
  );
}

// ── Export Modal (HTML + Notion API) ──
function NotionExportModal({ portfolio, userId, onClose }) {
  const [tab, setTab] = useState('html'); // 'html' | 'notion'
  const [notionToken, setNotionToken] = useState(() => localStorage.getItem(NOTION_TOKEN_KEY) || '');
  const [parentPage, setParentPage] = useState(() => localStorage.getItem(NOTION_PAGE_KEY) || '');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [notionStep, setNotionStep] = useState(1);

  // ── HTML Export: DOM 캡처 + standalone HTML 생성 ──
  const handleHtmlExport = () => {
    const el = document.getElementById('notion-portfolio');
    if (!el) { toast.error('포트폴리오 요소를 찾을 수 없습니다'); return; }

    // DOM 복제 후 정리: 버튼→div 변환, onClick 제거, 앱 전용 요소 제거
    const clone = el.cloneNode(true);

    // button → div 변환 (인터랙티브 요소를 정적으로)
    clone.querySelectorAll('button').forEach(btn => {
      const div = document.createElement('div');
      div.className = btn.className;
      div.innerHTML = btn.innerHTML;
      if (btn.style.cssText) div.style.cssText = btn.style.cssText;
      btn.parentNode.replaceChild(div, btn);
    });

    // a 태그의 내부 링크(#) → span 변환
    clone.querySelectorAll('a[href^="#"]').forEach(a => {
      const span = document.createElement('span');
      span.className = a.className;
      span.innerHTML = a.innerHTML;
      a.parentNode.replaceChild(span, a);
    });

    // "맨 위로" 네비게이션 제거
    clone.querySelectorAll('a').forEach(a => {
      if (a.textContent.includes('맨 위로')) a.remove();
    });

    // onclick/data-* 속성 정리
    clone.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));

    const cleanedHTML = clone.outerHTML;

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${portfolio.headline || portfolio.title || '포트폴리오'} - POPOL Portfolio</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: { 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d' },
        surface: { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1' }
      },
      fontFamily: { sans: ['Pretendard','-apple-system','BlinkMacSystemFont','system-ui','sans-serif'] }
    }
  }
}
<\/script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Pretendard',-apple-system,BlinkMacSystemFont,system-ui,sans-serif; background:#f5f5f7; color:#1a1a1a; }
::-webkit-scrollbar { width:6px; }
::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:3px; }
@media print {
  body { background: white; }
  @page { margin: 10mm; size: A4 landscape; }
}
</style>
</head>
<body>
<div style="max-width:1100px;margin:40px auto;padding:0 16px;">
${cleanedHTML}
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${portfolio.headline || portfolio.title || 'portfolio'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('HTML 파일이 다운로드되었습니다!');
  };

  // ── Notion API Export ──
  const handleNotionExport = async () => {
    if (!notionToken.trim() || !parentPage.trim()) {
      toast.error('Notion 토큰과 부모 페이지 URL을 모두 입력해주세요');
      return;
    }
    localStorage.setItem(NOTION_TOKEN_KEY, notionToken);
    localStorage.setItem(NOTION_PAGE_KEY, parentPage);
    setExporting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/export/notion-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ notionToken: notionToken.trim(), parentPageId: parentPage.trim(), data: portfolio }),
      });
      const data = await res.json();
      if (data.success) { setResult(data); toast.success('Notion 페이지가 생성되었습니다!'); }
      else toast.error(data.message || data.error || 'Notion 내보내기에 실패했습니다');
    } catch (e) { toast.error('내보내기 중 오류가 발생했습니다: ' + (e.message || '')); }
    setExporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-100">
          <h2 className="text-lg font-bold">내보내기</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-surface-50">
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h3 className="text-lg font-bold mb-2">Notion 페이지가 생성되었습니다!</h3>
            <a href={result.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-black transition-colors">
              <ExternalLink size={16} /> Notion에서 확인하기
            </a>
            <button onClick={onClose} className="block mx-auto mt-3 text-sm text-gray-400 hover:text-gray-600">닫기</button>
          </div>
        ) : (
          <div className="p-6">
            {/* Tab selector */}
            <div className="flex bg-surface-50 rounded-xl p-1 mb-6">
              <button onClick={() => setTab('html')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'html' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                <Monitor size={15} /> HTML 다운로드
              </button>
              <button onClick={() => setTab('notion')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'notion' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                <Code size={15} /> Notion API
              </button>
            </div>

            {/* ── HTML Tab ── */}
            {tab === 'html' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-emerald-800 mb-2">✨ CSS 100% 동일한 HTML 파일</h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    현재 프리뷰 화면의 레이아웃, 색상, 폰트, 간격까지 <strong>완벽하게 동일한</strong> HTML 파일을 다운로드합니다.
                    브라우저에서 바로 열어보거나, 웹 호스팅에 업로드할 수 있습니다.
                  </p>
                </div>

                <div className="bg-surface-50 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">사용 방법</h4>
                  <ul className="text-xs text-gray-500 space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-emerald-500 font-bold mt-0.5">1.</span> 아래 버튼으로 HTML 파일을 다운로드</li>
                    <li className="flex items-start gap-2"><span className="text-emerald-500 font-bold mt-0.5">2.</span> 브라우저에서 열어 그대로 확인</li>
                    <li className="flex items-start gap-2"><span className="text-emerald-500 font-bold mt-0.5">3.</span> GitHub Pages, Netlify 등에 호스팅 가능</li>
                    <li className="flex items-start gap-2"><span className="text-emerald-500 font-bold mt-0.5">4.</span> Notion에서 <code className="bg-white px-1 py-0.5 rounded text-[11px]">/embed</code> 블록으로 호스팅 URL 삽입</li>
                  </ul>
                </div>

                <button onClick={handleHtmlExport}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">
                  <Download size={16} /> HTML 파일 다운로드
                </button>
              </div>
            )}

            {/* ── Notion API Tab ── */}
            {tab === 'notion' && (
              <div className="space-y-4">
                {notionStep === 1 && (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-1"><Info size={14} /> Notion Integration 설정 방법</h4>
                      <ol className="text-sm text-amber-700 space-y-2 list-decimal list-inside">
                        <li><a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline font-medium">notion.so/my-integrations</a> 접속</li>
                        <li><strong>+ New integration</strong> 클릭 → 이름 입력 후 생성</li>
                        <li>생성된 Integration의 <strong>Internal Integration Secret</strong> 복사</li>
                        <li>Notion에서 포트폴리오를 생성할 <strong>부모 페이지</strong> 열기</li>
                        <li>페이지 우측 상단 <strong>···</strong> → <strong>Connections</strong> → Integration 추가</li>
                        <li>해당 페이지의 <strong>URL</strong> 복사</li>
                      </ol>
                    </div>
                    <div className="bg-surface-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Notion API로 생성하면 3컬럼 레이아웃, 표, 콜아웃 등이 <strong>Notion 네이티브 블록</strong>으로 생성됩니다.
                        CSS는 Notion 기본 스타일을 따르므로 앱 프리뷰와 약간의 차이가 있을 수 있습니다.
                      </p>
                    </div>
                    <button onClick={() => setNotionStep(2)}
                      className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-black transition-colors">
                      다음 단계로 →
                    </button>
                  </>
                )}

                {notionStep === 2 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Key size={14} /> Integration Token</label>
                      <input type="password" value={notionToken} onChange={e => setNotionToken(e.target.value)}
                        placeholder="ntn_xxxxxxxxxxxxxxxxxxxxx..."
                        className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-300" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><FileText size={14} /> 부모 페이지 URL</label>
                      <input value={parentPage} onChange={e => setParentPage(e.target.value)}
                        placeholder="https://www.notion.so/My-Page-abc123..."
                        className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-300" />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <p className="text-xs text-blue-700">💡 토큰과 URL은 브라우저에 저장되어 다음에 자동 입력됩니다.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setNotionStep(1)}
                        className="flex-1 py-3 border border-surface-200 text-gray-600 rounded-xl font-medium hover:bg-surface-50 transition-colors">← 이전</button>
                      <button onClick={handleNotionExport} disabled={exporting || !notionToken.trim() || !parentPage.trim()}
                        className="flex-[2] flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-black disabled:opacity-50 transition-colors">
                        {exporting ? <><Loader2 size={16} className="animate-spin" /> 생성 중...</> : <><Download size={16} /> Notion 내보내기</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Academic Layout (학생 이력서 - 클린 그라데이션 헤더 + 타임라인) ──
function AcademicLayout({ p, setSelectedExp }) {
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || {};
  const extra = p.extracurricular || {};

  return (
    <div className="max-w-[900px] mx-auto" id="notion-portfolio">
      {/* Hero Banner */}
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
          <div className="pb-1 text-right">
            {p.location && <p className="text-blue-200/60 text-xs flex items-center gap-1 justify-end"><MapPin size={11} /> {p.location}</p>}
            {p.birthDate && <p className="text-blue-200/60 text-xs flex items-center gap-1 justify-end mt-1"><Calendar size={11} /> {p.birthDate}</p>}
          </div>
        </div>
        {/* Quick Nav */}
        <div className="flex gap-2 px-10 pb-4 overflow-x-auto">
          {['소개','학력','경험','기술','수상','교과','비교과','목표'].map(m => (
            <a key={m} href={`#acad-${m}`} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white/80 font-medium whitespace-nowrap transition-colors">{m}</a>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-b-2xl border border-t-0 border-surface-200 shadow-sm">
        {/* About / Values */}
        <div className="px-10 py-8 border-b border-surface-100" id="acad-소개">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" /> 자기소개
          </h2>
          {p.valuesEssay ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{p.valuesEssay}</p>
          ) : (p.values || []).length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {p.values.map((v, i) => (
                <div key={i} className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <p className="text-sm font-bold text-blue-900 mb-1">{v.keyword}</p>
                  {v.description && <p className="text-xs text-blue-700/70 leading-relaxed">{v.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">아직 소개가 작성되지 않았습니다.</p>
          )}
        </div>

        {/* Contact Bar */}
        {(contact.phone || contact.email || contact.github || contact.linkedin) && (
          <div className="px-10 py-4 border-b border-surface-100 flex flex-wrap gap-4 bg-surface-50/50">
            {contact.email && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Mail size={12} className="text-gray-400" /> {contact.email}</span>}
            {contact.phone && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Phone size={12} className="text-gray-400" /> {contact.phone}</span>}
            {contact.github && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Globe size={12} className="text-gray-400" /> {contact.github}</span>}
            {contact.linkedin && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Globe size={12} className="text-gray-400" /> {contact.linkedin}</span>}
          </div>
        )}

        {/* Education + Awards side by side */}
        <div className="px-10 py-8 border-b border-surface-100" id="acad-학력">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-8">
            {/* Education */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-500 rounded-full inline-block" /> 학력
              </h2>
              <div className="space-y-4 relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-emerald-100" />
                {(p.education || []).map((edu, i) => (
                  <div key={i} className="flex items-start gap-3 relative">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white z-10 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">{edu.name}</h4>
                      {edu.degree && <p className="text-xs text-gray-500">{edu.degree}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{edu.period}</p>
                      {edu.detail && <p className="text-xs text-gray-500 mt-1">{edu.detail}</p>}
                    </div>
                  </div>
                ))}
                {(p.education || []).length === 0 && <p className="text-xs text-gray-400 ml-6">학력 정보가 없습니다</p>}
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-surface-200" />

            {/* Awards */}
            <div id="acad-수상">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-500 rounded-full inline-block" /> 수상 / 장학금
              </h2>
              <div className="space-y-3">
                {(p.awards || []).map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-lg">🏆</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.title}</p>
                      <p className="text-xs text-gray-400">{a.date}</p>
                    </div>
                  </div>
                ))}
                {(p.awards || []).length === 0 && <p className="text-xs text-gray-400">수상 내역이 없습니다</p>}
              </div>
            </div>
          </div>
        </div>

        {/* 활동 기록 (타임라인) */}
        {(p.activityRecords || []).length > 0 && (
          <div className="px-10 py-8 border-b border-surface-100" id="acad-활동기록">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" /> 활동 기록
            </h2>
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-blue-100" />
              <div className="space-y-4">
                {p.activityRecords.map((act, i) => {
                  const catColors = {
                    award: 'bg-amber-400', study: 'bg-purple-400', project: 'bg-blue-400',
                    intern: 'bg-green-400', certificate: 'bg-red-400', volunteer: 'bg-pink-400', other: 'bg-gray-400',
                  };
                  return (
                    <div key={i} className="flex items-start gap-3 relative">
                      <div className={`w-3.5 h-3.5 rounded-full ${catColors[act.category] || 'bg-gray-400'} border-2 border-white z-10 mt-0.5 flex-shrink-0`} />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-800">{act.title || '(제목 없음)'}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{act.date || ''}</p>
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 rounded-md px-2 py-0.5">{act.category || 'other'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Experiences */}
        {(p.experiences || []).length > 0 && (
          <div className="px-10 py-8 border-b border-surface-100" id="acad-경험">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-violet-500 rounded-full inline-block" /> 프로젝트 / 경험
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {p.experiences.map((e, i) => {
                const stMap = { expected: 'bg-blue-500', doing: 'bg-green-500', finished: 'bg-gray-400' };
                return (
                  <button key={i} onClick={() => setSelectedExp(e)}
                    className="group text-left bg-white rounded-xl border border-surface-200 overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all">
                    <div className="aspect-[16/10] bg-gradient-to-br from-slate-100 to-blue-50 overflow-hidden relative">
                      {e.thumbnailUrl ? (
                        <img src={e.thumbnailUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><span className="text-3xl opacity-40">📋</span></div>
                      )}
                      <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${stMap[e.status] || stMap.finished}`} />
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-bold text-gray-800 line-clamp-1 mb-1">{e.title || '(제목 없음)'}</h4>
                      <p className="text-xs text-gray-400">{e.date || ''}</p>
                      {(e.classify || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">{e.classify.slice(0, 3).map((t, ti) => (
                          <span key={ti} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">{t}</span>
                        ))}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Skills */}
        <div className="px-10 py-8 border-b border-surface-100" id="acad-기술">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-teal-500 rounded-full inline-block" /> 기술
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(skills).filter(([_, arr]) => arr && arr.length > 0).map(([category, items]) => (
              <div key={category} className="p-4 bg-surface-50 rounded-xl">
                <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
                  {category === 'tools' ? '도구' : category === 'languages' ? '언어' : category === 'frameworks' ? '프레임워크' : '기타'}
                </h4>
                <div className="space-y-2">
                  {items.map((skill, i) => {
                    const sName = typeof skill === 'string' ? skill : (skill?.name || '');
                    const sProf = typeof skill === 'string' ? 0 : (skill?.proficiency || 0);
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{sName}</span>
                        {sProf > 0 && (
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(l => (
                              <div key={l} className={`w-4 h-1.5 rounded-full ${l <= sProf ? 'bg-teal-500' : 'bg-gray-200'}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Curricular */}
        {(curr.courses?.length > 0 || curr.summary?.credits || curr.summary?.gpa) && (
          <div className="px-10 py-8 border-b border-surface-100" id="acad-교과">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-orange-500 rounded-full inline-block" /> 교과 활동
            </h2>
            {(curr.summary?.credits || curr.summary?.gpa) && (
              <div className="flex gap-4 mb-4">
                {curr.summary.credits && <div className="px-4 py-3 bg-orange-50 rounded-xl"><p className="text-xs text-orange-600 font-medium">이수 학점</p><p className="text-lg font-bold text-orange-800">{curr.summary.credits}</p></div>}
                {curr.summary.gpa && <div className="px-4 py-3 bg-orange-50 rounded-xl"><p className="text-xs text-orange-600 font-medium">평점 평균</p><p className="text-lg font-bold text-orange-800">{curr.summary.gpa}</p></div>}
              </div>
            )}
            {(curr.courses || []).length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-surface-50"><th className="text-left px-3 py-2 border border-surface-200 text-xs font-medium text-gray-500">학기</th><th className="text-left px-3 py-2 border border-surface-200 text-xs font-medium text-gray-500">과목명</th><th className="text-left px-3 py-2 border border-surface-200 text-xs font-medium text-gray-500">성적</th></tr></thead>
                <tbody>{curr.courses.map((c, i) => (<tr key={i}><td className="px-3 py-2 border border-surface-200 text-xs">{c.semester}</td><td className="px-3 py-2 border border-surface-200 text-xs">{c.name}</td><td className="px-3 py-2 border border-surface-200 text-xs">{c.grade}</td></tr>))}</tbody>
              </table>
            )}
          </div>
        )}

        {/* Extracurricular */}
        {(extra.details?.length > 0 || extra.badges?.length > 0 || extra.languages?.length > 0 || extra.summary) && (
          <div className="px-10 py-8 border-b border-surface-100" id="acad-비교과">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-pink-500 rounded-full inline-block" /> 비교과 활동
            </h2>
            {extra.summary && <p className="text-sm text-gray-600 mb-4 leading-relaxed whitespace-pre-line">{extra.summary}</p>}
            {(extra.badges || []).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 mb-2">디지털 배지</h4>
                <div className="flex flex-wrap gap-2">{extra.badges.map((b, i) => (
                  <span key={i} className="px-3 py-1.5 bg-pink-50 text-pink-700 rounded-lg text-xs font-medium border border-pink-100">{b.name}</span>
                ))}</div>
              </div>
            )}
            {(extra.languages || []).length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 mb-2">어학</h4>
                <div className="flex flex-wrap gap-2">{extra.languages.map((l, i) => (
                  <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs border border-indigo-100">{l.name} {l.score}</span>
                ))}</div>
              </div>
            )}
            {(extra.details || []).length > 0 && (
              <div className="space-y-3">{extra.details.map((d, i) => (
                <div key={i} className="p-4 bg-surface-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-800">{d.title}</span>
                    <span className="text-xs text-gray-400">{d.period}</span>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-line">{d.description}</p>
                </div>
              ))}</div>
            )}
          </div>
        )}

        {/* Goals */}
        {(p.goals || []).length > 0 && (
          <div className="px-10 py-8 border-b border-surface-100" id="acad-목표">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-cyan-500 rounded-full inline-block" /> 목표와 계획
            </h2>
            <div className="space-y-3">
              {p.goals.map((g, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                    g.status === 'done' ? 'bg-green-500' : g.status === 'ing' ? 'bg-blue-500' : 'bg-gray-400'
                  }`}>{g.status === 'done' ? '✓' : g.status === 'ing' ? '→' : '○'}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 text-gray-500 font-medium">{g.type === 'long' ? '장기' : g.type === 'mid' ? '중기' : '단기'}</span>
                      <h4 className="text-sm font-bold text-gray-800">{g.title}</h4>
                    </div>
                    {g.description && <p className="text-xs text-gray-500 mt-1">{g.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-10 py-4 bg-surface-50 flex items-center justify-between text-xs text-gray-400 rounded-b-2xl">
          <span>POPOL Portfolio · {p.userName || ''}</span>
          <a href="#notion-portfolio" className="hover:text-gray-600">맨 위로 ↑</a>
        </div>
      </div>
    </div>
  );
}

// ── Ashley Layout (크리에이티브 - 따뜻한 스크롤형 포트폴리오) ──
function AshleyLayout({ p, setSelectedExp }) {
  const contact = p.contact || {};
  const skills = p.skills || {};

  return (
    <div className="max-w-[860px] mx-auto" id="notion-portfolio">
      {/* Hero */}
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
            {p.profileImageUrl ? (
              <img src={p.profileImageUrl} alt="profile" className="w-24 h-24 rounded-2xl object-cover shadow-md" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-[#e8e4dc] flex items-center justify-center text-4xl shadow-md">👤</div>
            )}
          </div>
        </div>

        {/* 한눈에 보기 + 저는 이런 사람이에요 */}
        <div className="px-10 pb-8">
          <div className="grid grid-cols-2 gap-4">
            {/* 한눈에 보기 */}
            <div className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
              <h3 className="font-bold text-sm text-[#2d2a26] mb-4 flex items-center gap-2">📋 한눈에 보기</h3>
              <div className="space-y-3 text-sm">
                {p.location && <div className="flex justify-between"><span className="text-[#8a8578]">위치</span><span className="font-medium text-[#2d2a26]">{p.location}</span></div>}
                {p.birthDate && <div className="flex justify-between"><span className="text-[#8a8578]">생년월일</span><span className="font-medium text-[#2d2a26]">{p.birthDate}</span></div>}
                {contact.email && <div className="flex justify-between"><span className="text-[#8a8578]">이메일</span><span className="font-medium text-[#2d2a26] text-xs">{contact.email}</span></div>}
                {contact.phone && <div className="flex justify-between"><span className="text-[#8a8578]">연락처</span><span className="font-medium text-[#2d2a26]">{contact.phone}</span></div>}
                {(p.education || []).length > 0 && <div className="flex justify-between"><span className="text-[#8a8578]">학교</span><span className="font-medium text-[#2d2a26] text-xs text-right">{p.education[0].name}</span></div>}
              </div>
            </div>
            {/* 저는 이런 사람이에요 */}
            <div className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
              <h3 className="font-bold text-sm text-[#2d2a26] mb-4 flex items-center gap-2">✨ 저는 이런 사람이에요</h3>
              {(p.values || []).length > 0 ? (
                <ul className="space-y-2.5">
                  {p.values.map((v, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#5a564e]">
                      <span className="w-2 h-2 bg-[#c4a882] rounded-full mt-1.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-[#2d2a26]">{v.keyword}</span>
                        {v.description && <span className="text-[#8a8578]"> — {v.description}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : p.valuesEssay ? (
                <p className="text-sm text-[#5a564e] leading-relaxed whitespace-pre-line line-clamp-6">{p.valuesEssay}</p>
              ) : (
                <p className="text-sm text-[#8a8578]">가치관 정보가 없습니다.</p>
              )}
            </div>
          </div>
        </div>

        {/* 인터뷰 섹션 (경험 기반) */}
        {(p.experiences || []).length > 0 && (
          <div className="px-10 pb-8">
            <div className="bg-white rounded-xl p-6 border border-[#e8e4dc]">
              <h3 className="font-bold text-lg text-[#2d2a26] mb-5">💬 인터뷰</h3>
              <div className="space-y-5">
                {p.experiences.slice(0, 3).map((e, i) => (
                  <div key={i} className="flex gap-5 cursor-pointer group" onClick={() => setSelectedExp(e)}>
                    <div className="flex-1">
                      <p className="font-medium text-[#2d2a26] text-sm mb-1 group-hover:text-[#c4a882] transition-colors">Q. {e.title}에 대해 이야기해주세요.</p>
                      <p className="text-sm text-[#8a8578] leading-relaxed line-clamp-3">{e.description || (e.sections || []).find(s => s.content)?.content || '클릭하여 자세한 내용을 확인하세요.'}</p>
                    </div>
                    {e.thumbnailUrl && (
                      <img src={e.thumbnailUrl} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0 group-hover:shadow-md transition-shadow" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 프로젝트 갤러리 */}
        {(p.experiences || []).length > 0 && (
          <div className="px-10 pb-8">
            <h3 className="font-bold text-lg text-[#2d2a26] mb-4">🎨 프로젝트</h3>
            <div className="grid grid-cols-3 gap-4">
              {p.experiences.map((e, i) => (
                <button key={i} onClick={() => setSelectedExp(e)}
                  className="group text-left bg-white rounded-xl border border-[#e8e4dc] overflow-hidden hover:shadow-lg transition-all">
                  <div className="aspect-[4/3] bg-[#f0ece4] overflow-hidden">
                    {e.thumbnailUrl ? (
                      <img src={e.thumbnailUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">{['🎯','📱','🎨','💡','📊','🚀'][i % 6]}</div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-bold text-[#2d2a26] line-clamp-1 mb-1">{e.title || '(제목 없음)'}</h4>
                    <p className="text-xs text-[#8a8578]">{e.date || ''}</p>
                    {(e.classify || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">{e.classify.slice(0, 2).map((t, ti) => (
                        <span key={ti} className="px-1.5 py-0.5 bg-[#f7f5f0] text-[#8a8578] rounded text-[10px]">{t}</span>
                      ))}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 이런 일을 할 수 있어요 (Skills) */}
        <div className="px-10 pb-8">
          <h3 className="font-bold text-lg text-[#2d2a26] mb-4">💼 이런 일을 할 수 있어요</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(skills).filter(([_, arr]) => arr && arr.length > 0).map(([category, items]) => (
              <div key={category} className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
                <h4 className="text-xs font-bold text-[#8a8578] mb-3 uppercase tracking-wider">
                  {category === 'tools' ? '도구' : category === 'languages' ? '프로그래밍' : category === 'frameworks' ? '프레임워크' : '기타'}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {items.map((skill, i) => {
                    const sName = typeof skill === 'string' ? skill : (skill?.name || '');
                    const sProf = typeof skill === 'string' ? 0 : (skill?.proficiency || 0);
                    return (
                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f7f5f0] text-[#5a564e] rounded-full text-xs font-medium">
                        {sName}
                        {sProf > 0 && <span className="flex gap-0.5 ml-0.5">{[1,2,3,4,5].map(l => (
                          <span key={l} className={`w-1 h-2.5 rounded-sm ${l <= sProf ? 'bg-[#c4a882]' : 'bg-[#e8e4dc]'}`} />
                        ))}</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 가치관 에세이 (긴 글) */}
        {p.valuesEssay && (
          <div className="px-10 pb-8">
            <div className="bg-white rounded-xl p-6 border border-[#e8e4dc]">
              <h3 className="font-bold text-lg text-[#2d2a26] mb-4">📝 나를 들려주는 이야기</h3>
              <div className="prose prose-sm max-w-none text-[#5a564e] leading-[1.9] whitespace-pre-line">{p.valuesEssay}</div>
            </div>
          </div>
        )}

        {/* Interests */}
        {(p.interests || []).length > 0 && (
          <div className="px-10 pb-8">
            <h3 className="font-bold text-lg text-[#2d2a26] mb-4">🌿 관심사</h3>
            <div className="flex flex-wrap gap-2">
              {p.interests.map((interest, i) => (
                <span key={i} className="px-4 py-2 bg-white rounded-full text-sm text-[#5a564e] border border-[#e8e4dc]">{interest}</span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-10 py-5 border-t border-[#e8e4dc] flex items-center justify-between text-xs text-[#8a8578]">
          <span>POPOL Portfolio · {p.userName || ''}</span>
          <a href="#notion-portfolio" className="hover:text-[#5a564e]">맨 위로 ↑</a>
        </div>
      </div>
    </div>
  );
}

// ── Experience Detail Modal (Notion Page Style) ──
const STATUS_DISPLAY = {
  expected: { label: 'Expected', cls: 'bg-blue-100 text-blue-700' },
  doing:    { label: 'Doing',    cls: 'bg-green-100 text-green-700' },
  finished: { label: 'Finished', cls: 'bg-red-100 text-red-700' },
};

const FIELD_ACCENTS = [
  'border-l-red-400', 'border-l-amber-400', 'border-l-green-400',
  'border-l-blue-400', 'border-l-purple-400',
];

const EXP_SECTION_META_PREVIEW = {
  intro:      { num: '01', label: '프로젝트 소개' },
  overview:   { num: '02', label: '프로젝트 개요' },
  task:       { num: '03', label: '진행한 일' },
  process:    { num: '04', label: '과정' },
  output:     { num: '05', label: '결과물' },
  growth:     { num: '06', label: '성장한 점' },
  competency: { num: '07', label: '나의 역량' },
};
const EXP_SECTION_KEYS_PREVIEW = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];

function ExperienceDetailModal({ exp, onClose }) {
  const fw = exp.framework && FRAMEWORKS[exp.framework];
  const hasSections = (exp.sections || []).some(s => s.title && s.content);
  const hasFramework = !hasSections && fw && exp.frameworkContent && Object.keys(exp.frameworkContent).length > 0;
  const keyExperiences = (exp.structuredResult?.keyExperiences || []).filter(k => k.title);
  const st = STATUS_DISPLAY[exp.status] || STATUS_DISPLAY.finished;
  const [showAllProps, setShowAllProps] = useState(false);

  // structuredResult 섹션 데이터
  const structured = exp?.structuredResult || {};
  const sectionContents = EXP_SECTION_KEYS_PREVIEW.reduce((acc, k) => {
    acc[k] = (typeof structured[k] === 'string' ? structured[k] : '') || '';
    return acc;
  }, {});
  const hasStructuredSections = EXP_SECTION_KEYS_PREVIEW.some(k => sectionContents[k]?.trim());

  // Firestore에서 이미지 로드 (experienceId가 있을 때)
  const [allImages, setAllImages] = useState([]);
  const [sectionImages, setSectionImages] = useState({});
  const [imageConfig, setImageConfig] = useState({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => {
    const expId = exp?.experienceId;
    if (!expId) { setImagesLoaded(true); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'experiences', expId));
        if (snap.exists()) {
          const data = snap.data();
          setAllImages(data.images || []);
          setSectionImages(data.sectionImages || {});
          setImageConfig(data.imageConfig || {});
        }
      } catch {}
      setImagesLoaded(true);
    })();
  }, [exp?.experienceId]);

  // 섹션 내 이미지 렌더링 (읽기 전용)
  const renderSectionImages = (sectionKey, position) => {
    const imgIndices = sectionImages[sectionKey] || [];
    const sizeMap = { sm: 'max-w-[140px]', md: 'max-w-[280px]', lg: 'max-w-full' };
    const filtered = imgIndices.map((imgIdx, pos) => ({ imgIdx, pos })).filter(({ imgIdx }) => {
      const cfg = imageConfig[`${sectionKey}:${imgIdx}`] || {};
      return (cfg.position || 'below') === position;
    });
    if (filtered.length === 0) return null;
    return (
      <div className={`flex flex-wrap gap-3 ${position === 'above' ? 'mb-3' : 'mt-3'}`}>
        {filtered.map(({ imgIdx }) => {
          const img = allImages[imgIdx];
          if (!img) return null;
          const cfg = imageConfig[`${sectionKey}:${imgIdx}`] || {};
          const size = cfg.size || 'md';
          return (
            <div key={`${sectionKey}-${imgIdx}`} className={sizeMap[size] || sizeMap.md}>
              <img src={img.url} alt={img.name || '이미지'} className="w-full rounded-lg border border-surface-200 shadow-sm" />
            </div>
          );
        })}
      </div>
    );
  };

  // 속성 목록
  const props = [];
  if (exp.status) props.push({ label: 'Status', node: <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${st.cls}`}>{st.label}</span> });
  if ((exp.classify || []).length > 0) props.push({ label: 'Classify', node: <div className="flex flex-wrap gap-1">{exp.classify.map((c, i) => <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{c}</span>)}</div> });
  if ((exp.skills || []).length > 0) props.push({ label: 'Skills', node: <div className="flex flex-wrap gap-1">{exp.skills.map((s, i) => <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{s}</span>)}</div> });
  if (exp.role) props.push({ label: '역할', node: <span className="text-sm text-gray-700">{exp.role}</span> });
  if (exp.date) props.push({ label: '기간', node: <span className="text-sm text-gray-700">{exp.date}</span> });
  if (exp.link) props.push({ label: '링크', node: <a href={exp.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline"><ExternalLink size={12} /> {exp.link}</a> });
  if ((exp.keywords || []).length > 0) props.push({ label: 'Keywords', node: <div className="flex flex-wrap gap-1">{exp.keywords.map((kw, i) => <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs border border-emerald-100"><Tag size={10} /> {kw}</span>)}</div> });
  if (exp.framework) props.push({ label: '프레임워크', node: <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">{fw ? fw.name : exp.framework}</span> });

  const visibleProps = showAllProps ? props : props.slice(0, 3);
  const hiddenCount = props.length - 3;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-[5vh] p-4 overflow-auto" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-[900px] shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <div className="flex justify-start p-3 pb-0">
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-surface-50">
            <X size={18} />
          </button>
        </div>

        {/* Title */}
        <div className="px-16 pt-4 pb-2">
          <h1 className="text-[28px] font-bold text-gray-900 leading-tight mb-4">{exp.title || '(제목 없음)'}</h1>

          {/* Properties table (Notion style) */}
          <div className="space-y-2">
            {visibleProps.map((pr, i) => (
              <div key={i} className="flex items-start gap-4 min-h-[32px] py-1">
                <span className="w-24 text-sm text-gray-400 shrink-0 flex items-center gap-1.5 pt-0.5">
                  {pr.label}
                </span>
                <div className="flex-1">{pr.node}</div>
              </div>
            ))}
          </div>

          {hiddenCount > 0 && !showAllProps && (
            <button onClick={() => setShowAllProps(true)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2 py-1">
              <ChevronRight size={12} /> 속성 {hiddenCount}개 더 보기
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="mx-16 my-2 border-t border-surface-100" />

        {/* Content */}
        <div className="px-16 pb-10 space-y-6">
          {/* 썸네일 */}
          {exp.thumbnailUrl && (
            <div className="w-full h-44 rounded-xl overflow-hidden bg-surface-50">
              <img src={exp.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* 기본 정보 */}
          <div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
              {exp.date && <span>{exp.date}</span>}
              {exp.role && <span>{exp.role}</span>}
              {structured.projectOverview?.team && <span>{structured.projectOverview.team}</span>}
              {structured.projectOverview?.duration && <span>{structured.projectOverview.duration}</span>}
              {exp.link && <a href={exp.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">링크</a>}
            </div>
            {(exp.skills || (structured.projectOverview?.techStack || [])).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(exp.skills?.length ? exp.skills : (structured.projectOverview?.techStack || [])).map((sk, si) => (
                  <span key={si} className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-md text-xs font-medium border border-primary-100">{typeof sk === 'string' ? sk : sk?.name}</span>
                ))}
              </div>
            )}
          </div>

          {/* AI 요약 */}
          {exp.aiSummary && (
            <div className="bg-surface-50 border border-surface-200 rounded-lg p-4">
              <p className="text-xs font-bold text-gray-700 mb-1">AI 역량 요약</p>
              <p className="text-sm text-gray-600 leading-relaxed">{exp.aiSummary}</p>
            </div>
          )}

          {/* 설명 또는 배경 */}
          {(exp.description || structured.projectOverview?.background || structured.projectOverview?.summary) && (
            <p className="text-sm text-gray-600 leading-relaxed bg-surface-50 rounded-xl p-4">
              {exp.description || structured.projectOverview?.background || structured.projectOverview?.summary}
            </p>
          )}

          {/* 핵심 경험 슬라이더 */}
          {keyExperiences.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3">핵심 경험 & 성과</h4>
              <KeyExperienceSlider keyExperiences={keyExperiences} />
            </div>
          )}

          {/* 상세 섹션 (StructuredResult - 경험정리 내용) */}
          {hasStructuredSections && (
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              <div className="divide-y divide-surface-100">
                {EXP_SECTION_KEYS_PREVIEW.map(key => {
                  const meta = EXP_SECTION_META_PREVIEW[key];
                  const val = sectionContents[key];
                  if (!val?.trim()) return null;
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-3 px-5 py-2.5 bg-surface-50/40">
                        <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary-500 text-white flex items-center justify-center text-[11px] font-bold">{meta.num}</span>
                        <span className="text-[13px] font-bold text-primary-700">{meta.label}</span>
                      </div>
                      <div className="px-5 py-3 pl-[60px]">
                        {imagesLoaded && renderSectionImages(key, 'above')}
                        <p className="text-[13px] text-gray-700 leading-[1.85] whitespace-pre-wrap">{val}</p>
                        {imagesLoaded && renderSectionImages(key, 'below')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 경험 구조화 섹션 (sections - structuredResult이 없을 때) */}
          {!hasStructuredSections && (exp.sections || []).map((sec, i) => (
            sec.title && sec.content ? (
              <div key={i}>
                <h2 className="text-lg font-bold text-gray-900 mb-3">{sec.title}</h2>
                <p className="text-[15px] text-gray-700 leading-[1.8] whitespace-pre-line">{sec.content}</p>
              </div>
            ) : null
          ))}

          {/* 프레임워크 기반 상세 (sections 없을 때만 표시) */}
          {!hasStructuredSections && hasFramework && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3">{fw.name} 상세</h2>
              <div className="space-y-4">
                {fw.fields.map((field, idx) => {
                  const val = exp.frameworkContent[field.key];
                  if (!val) return null;
                  return (
                    <div key={field.key} className={`border-l-4 ${FIELD_ACCENTS[idx % FIELD_ACCENTS.length]} pl-4 py-1`}>
                      <p className="text-xs font-bold text-gray-500 mb-1">{field.label}</p>
                      <p className="text-[15px] text-gray-700 leading-[1.8] whitespace-pre-line">{val}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 아무 내용도 없을 때 */}
          {!exp.description && !hasSections && !hasFramework && !exp.aiSummary && keyExperiences.length === 0 && !hasStructuredSections && (
            <p className="text-sm text-gray-400 text-center py-8">상세 내용이 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Timeline Layout (시간순 대시보드) ──
function TimelineLayout({ p, setSelectedExp }) {
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || {};

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = now.getDate();
  const dayNames = ['일','월','화','수','목','금','토'];

  // 학기별 그룹핑
  const coursesBySemester = (curr.courses || []).reduce((acc, c) => {
    const sem = c.semester || '기타';
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(c);
    return acc;
  }, {});
  const semesterKeys = Object.keys(coursesBySemester).sort();

  const sortedExperiences = [...(p.experiences || [])].sort((a, b) => (b.period || '').localeCompare(a.period || ''));

  return (
    <div className="max-w-[900px] mx-auto" id="notion-portfolio">
      {/* Dark header with calendar */}
      <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-t-2xl px-8 pt-8 pb-6">
        <div className="flex items-center gap-4 mb-6">
          {p.profileImageUrl ? (
            <img src={p.profileImageUrl} alt="" className="w-16 h-16 rounded-full object-cover ring-4 ring-white/20" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-3xl ring-4 ring-white/20">👤</div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{p.headline || p.userName || '대시보드'}</h1>
            {p.education?.length > 0 && (
              <p className="text-blue-200/70 text-xs mt-0.5">{p.education[0].name} · {p.education[0].degree}</p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {contact.github && <a href={contact.github} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-white/10 rounded-lg text-xs text-white/70 hover:bg-white/20 transition-colors">GitHub</a>}
            {contact.website && <a href={contact.website} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-white/10 rounded-lg text-xs text-white/70 hover:bg-white/20 transition-colors">Web</a>}
            {contact.instagram && <a href={contact.instagram} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-white/10 rounded-lg text-xs text-white/70 hover:bg-white/20 transition-colors">Instagram</a>}
          </div>
        </div>
        {/* Calendar */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <p className="text-sm text-white/50 mb-3 text-center font-medium">{year}년 {month+1}월</p>
          <div className="grid grid-cols-7 gap-1 text-center">
            {dayNames.map(d => <div key={d} className="text-xs text-white/30 font-medium pb-1">{d}</div>)}
            {Array.from({ length: firstDay }, (_, i) => <div key={'e'+i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => (
              <div key={i} className={`text-xs py-1.5 rounded-lg ${i+1 === today ? 'bg-purple-500 text-white font-bold' : 'text-white/40'}`}>{i+1}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-b-2xl border border-t-0 border-surface-200 shadow-sm">
        {/* Quick nav */}
        <div className="px-8 py-4 border-b border-surface-100 flex gap-3 overflow-x-auto">
          {['학기별 수업', '활동 기록', '스터디 계획', '기술', '수상'].map(menu => (
            <a key={menu} href={`#section-${menu}`} className="px-4 py-2 bg-surface-50 hover:bg-surface-100 rounded-lg text-sm text-gray-600 font-medium whitespace-nowrap transition-colors">{menu}</a>
          ))}
        </div>

        {/* 학기별 수업 */}
        {(curr.courses || []).length > 0 && (
          <div className="px-8 py-6 border-b border-surface-100" id="section-학기별 수업">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-purple-500 rounded-full" /> 학기별 수업
            </h2>
            <div className="space-y-4">
              {semesterKeys.map(sem => (
                <div key={sem} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-sm font-bold text-gray-700 mb-2">{sem}</p>
                  <div className="flex flex-wrap gap-2">
                    {coursesBySemester[sem].map((c, i) => (
                      <span key={i} className="px-3 py-1.5 bg-white rounded-lg text-sm text-gray-600 border border-gray-200">
                        {c.name}{c.grade ? ` (${c.grade})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 활동 기록 */}
        {sortedExperiences.length > 0 && (
          <div className="px-8 py-6 border-b border-surface-100" id="section-활동 기록">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full" /> 활동 기록
            </h2>
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {sortedExperiences.map((exp, i) => (
                  <div key={i} className="flex items-start gap-3 relative cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                    onClick={() => setSelectedExp(exp)}>
                    <div className={`w-4 h-4 rounded-full flex-shrink-0 mt-0.5 z-10 border-2 border-white ${
                      exp.category === 'award' ? 'bg-amber-400' : exp.category === 'study' ? 'bg-purple-400' : 'bg-blue-400'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{exp.title}</p>
                      <p className="text-xs text-gray-400">{exp.period} {exp.role ? `· ${exp.role}` : ''}</p>
                      {exp.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{exp.description}</p>}
                    </div>
                    {exp.framework && <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">{exp.framework}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 스터디 계획 */}
        {(p.goals || []).length > 0 && (
          <div className="px-8 py-6 border-b border-surface-100" id="section-스터디 계획">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-emerald-500 rounded-full" /> 스터디 계획
            </h2>
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

        {/* 기술 */}
        <div className="px-8 py-6 border-b border-surface-100" id="section-기술">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-teal-500 rounded-full" /> 기술
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...(skills.tools || []), ...(skills.languages || []), ...(skills.frameworks || []), ...(skills.others || [])].map((s, i) => (
              <span key={i} className="px-3 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200">
                {typeof s === 'string' ? s : s.name || s}
              </span>
            ))}
          </div>
        </div>

        {/* 수상 */}
        {(p.awards || []).length > 0 && (
          <div className="px-8 py-6 border-b border-surface-100" id="section-수상">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-amber-500 rounded-full" /> 수상/장학금
            </h2>
            <div className="space-y-2">
              {p.awards.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-base">🏆</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.name}</p>
                    <p className="text-xs text-gray-400">{a.org} · {a.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 bg-surface-50 flex items-center justify-between text-xs text-gray-400 rounded-b-2xl">
          <span>POPOL Dashboard · {p.userName || ''}</span>
          <a href="#notion-portfolio" className="flex items-center gap-1 hover:text-gray-600">맨 위로 <ChevronUp size={12} /></a>
        </div>
      </div>
    </div>
  );
}
