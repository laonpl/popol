import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, MessageCircle, FolderOpen, FileText, Check } from 'lucide-react';
import FileCat from '../../components/FileCat';
import ResumeImportModal from '../../components/ResumeImportModal';
import useAuthGate from '../../hooks/useAuthGate';

const METHODS = [
  { id: 'chat', number: '01', icon: MessageCircle, title: '대화로 정리', hint: '기억나는 이야기부터', description: '자료가 없어도 괜찮아요. 질문에 답하며 내가 한 일과 성과를 찾아가요.', tags: ['자료 없이 시작', '질문으로 차근차근'], action: '이야기 시작하기', variant: 'curious', file: 'document' },
  { id: 'materials', number: '02', icon: FolderOpen, title: '자료로 만들기', hint: '흩어진 파일을 한곳에', description: '메모, 프로젝트 파일, 링크를 모아주세요. 경험에 필요한 내용을 함께 정리해요.', tags: ['파일 · 메모 · 링크', '프로젝트별 정리'], action: '자료 모으기', variant: 'happy', file: 'image' },
  { id: 'resume', number: '03', icon: FileText, title: '이력서 가져오기', hint: '이미 적어둔 경험이 있다면', description: '이력서나 포트폴리오에서 경험을 찾아요. 가져올 항목을 직접 고를 수 있어요.', tags: ['이력서 · 포트폴리오', '여러 경험 한 번에'], action: '문서 가져오기', variant: 'thinking', file: 'pdf' },
];

export default function ExperienceStart() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isGuest, requireAuth } = useAuthGate();
  const tutorial = params.get('tutorial') === '1';
  const importing = params.get('method') === 'resume' && !isGuest;

  useEffect(() => {
    document.getElementById('experience-start-heading')?.focus();
  }, [importing]);

  const choose = (method) => requireAuth(() => {
    if (method === 'resume') setParams({ method: 'resume' });
    else navigate(method === 'chat' ? '/app/experience/chat' : `/app/experience/new${tutorial ? '?tutorial=1' : ''}`);
  });

  return (
    <div className="fp-experience-start animate-fadeIn">
      <Link className="fp-flow-back" to="/app/experience"><ArrowLeft size={16} /> 경험 목록으로</Link>
      <section className="fp-start-intro" aria-labelledby="experience-start-heading">
        <div>
          <span className="fp-start-kicker">새 경험 추가</span>
          <h1 id="experience-start-heading" tabIndex={-1}>{importing ? '적어둔 경험을 데려올까요?' : <>어디서부터<br />모아볼까요?</>}</h1>
          <p>{importing ? '문서 속 경험을 찾아 나의 경험 목록에 차곡차곡 담아요.' : <>기억 속 이야기부터 흩어진 자료까지.<br />지금 가장 편한 방법을 고르면, 나머지는 함께 정리해요.</>}</p>
        </div>
        <div className="fp-start-companion" aria-hidden="true">
          <span className="fp-cat-bubble">흩어진 경험, 제가 모아올게요!</span>
          <FileCat variant="curious" file="document" withDocuments />
        </div>
      </section>
      {importing ? <>
        <button className="fp-flow-back" onClick={() => setParams({})}><ArrowLeft size={16} /> 다른 방법 고르기</button>
        <ResumeImportModal embedded onClose={() => setParams({})} onImported={() => navigate('/app/experience')} />
      </> : <>
        {tutorial && <p className="fp-start-tutorial">둘러보기에서는 <strong>자료로 만들기</strong>를 골라 샘플 경험을 만들어보세요.</p>}
        <div className="fp-start-methods">
          {METHODS.map(({ id, number, icon: Icon, title, hint, description, tags, action, variant, file }) => (
            <button key={id} type="button" onClick={() => choose(id)} className="fp-method-card" data-method={id}>
              <span className="fp-method-top"><span><Icon size={17} /> {hint}</span><span>{number}</span></span>
              <FileCat variant={variant} file={file} withDocuments={id === 'materials'} className="fp-method-cat" />
              <span className="fp-method-title">{title}</span>
              <span className="fp-method-description">{description}</span>
              <span className="fp-method-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</span>
              <span className="fp-method-action">{action}<ArrowUpRight size={19} /></span>
            </button>
          ))}
        </div>
        <p className="fp-start-note"><Check size={15} /> 어떤 방법으로 시작해도, 저장 전에 내용을 확인하고 수정할 수 있어요.</p>
      </>}
    </div>
  );
}
