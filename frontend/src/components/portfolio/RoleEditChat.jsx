/**
 * 핵심 경험 한 장(PM·마케터) 고양이 편집 챗봇 — 오른쪽 아래 고양이를 눌러 "요약을 더 짧게"처럼 말하면
 * POST /experience/edit-role-chat 이 바뀐 칸만 돌려주고, 화면 편집과 같은 경로(onApply → patchRolePage)로 반영한다.
 * 저장은 상단 '저장' 버튼 — 화면에서 직접 고친 것과 똑같이 다룬다. 답마다 '되돌리기'로 그 수정 전으로 돌아갈 수 있다.
 * 숫자는 서버가 자료·요청·현재 한 장에 있는 것만 남긴다(없으면 고양이가 숫자를 되묻는다).
 */
import { useEffect, useRef, useState } from 'react';
import { X, ArrowUp } from 'lucide-react';
import FileCat from '../FileCat';
import api from '../../services/api';

const FIELD_LABELS = {
  summary: '한 줄 요약', goal: '목표', contribution: '내가 한 일', retrospective: '회고', headline: '대표 지표',
  research: '리서치 규모', deliverables: '기획 산출물', role: '역할', team: '팀', tools: '도구',
  problem: '문제 정의', solution: '해결 방법', outcomes: '주요 성과', flow: '사용자 플로우', exceptions: '예외 정책', decisions: '의사결정',
  stats: '캠페인 규모', channels: '채널 믹스', funnel: '전환 퍼널', strategy: '전략', structure: '캠페인 구조', executions: '단계별 최적화',
};
const MARKETER_LABELS = { problem: '캠페인 과제' };

const EXAMPLES = {
  pm: ['한 줄 요약을 더 짧고 힘 있게 바꿔줘', '주요 성과에 재방문율 32% 추가해줘', '문제 정의를 두 문장으로 줄여줘'],
  marketer: ['핵심 메시지를 더 짧게 다듬어줘', '주요 성과에 ROAS 405% 넣어줘', '회고를 한 문장으로 줄여줘'],
};

const PANEL_STYLE = { border: '2px solid #111', borderRadius: 20, boxShadow: '6px 6px 0 #111', background: '#fff' };
const BUBBLE_STYLE = { border: '1.5px solid #111', borderRadius: 14, background: '#fff', fontFamily: "'Jua','Pretendard',sans-serif" };

// open/onOpenChange: 결과 화면이 열림 상태를 쥔다 — 넓은 화면에서는 처음부터 열고 본문을 오른쪽 패널만큼 비켜 둔다
export default function RoleEditChat({ jobCategory, page, material, onApply, open, onOpenChange }) {
  const setOpen = onOpenChange;
  const [opened, setOpened] = useState(open); // 한 번 열어 본 뒤에는 말풍선을 숨겨 본문을 덜 가린다
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const pageRef = useRef(page);
  pageRef.current = page; // 응답이 오는 사이 화면에서 고친 내용 위에 반영한다
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const isPm = jobCategory === 'pm';
  const labelOf = (k) => (!isPm && MARKETER_LABELS[k]) || FIELD_LABELS[k] || k;

  // 사용자가 열었을 때만 입력칸에 커서 — 처음부터 열려 있는 경우엔 페이지 포커스를 뺏지 않는다
  const mounted = useRef(false);
  useEffect(() => { if (mounted.current && open) inputRef.current?.focus(); mounted.current = true; }, [open]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, sending]);

  const send = async (text = input) => {
    const instruction = text.trim();
    if (!instruction || sending) return;
    setInput('');
    const history = messages.map(m => ({ role: m.role, text: m.text })).slice(-6);
    setMessages(prev => [...prev, { role: 'user', text: instruction }]);
    setSending(true);
    try {
      const { analyzed, source, edited, ...current } = pageRef.current || {}; // eslint-disable-line no-unused-vars
      const { data } = await api.post('/experience/edit-role-chat', { jobCategory, page: current, instruction, material, history }, { timeout: 90000 });
      const changes = data?.changes || {};
      const keys = Object.keys(changes);
      const before = pageRef.current;
      if (keys.length) onApply({ ...before, ...changes });
      setMessages(prev => [...prev, { role: 'bot', text: data?.reply || '고쳤어요.', changed: keys, undo: keys.length ? before : null }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: err?.response?.data?.error || '지금은 고치지 못했어요. 잠시 후 다시 말해 주세요.', error: true }]);
    } finally {
      setSending(false);
    }
  };

  const undo = (i) => {
    const m = messages[i];
    if (!m?.undo) return;
    onApply(m.undo);
    setMessages(prev => prev.map((x, xi) => (xi === i ? { ...x, undo: null, undone: true } : x)));
  };

  const applied = messages.some(m => m.changed?.length && !m.undone);

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); setOpened(true); }} aria-label="편집 고양이 열기" title="편집 고양이"
        className="group fixed bottom-4 right-4 z-40 flex items-end gap-1 print:hidden sm:bottom-6 sm:right-6">
        <span className={`mb-12 hidden px-3 py-2 text-[14px] leading-tight text-bluewood-900 transition-transform group-hover:-translate-y-0.5 ${opened ? 'sm:group-hover:block' : 'sm:block'}`} style={BUBBLE_STYLE}>
          고칠 부분, 말로 해 주세요
        </span>
        <FileCat variant="welcome" file="document" className="h-[92px] w-[92px] transition-transform group-hover:-translate-y-1" />
      </button>
    );
  }

  return (
    // 좁은 화면: 오른쪽 아래에 떠 있는 창 / xl 이상: 상단 바 아래부터 화면 끝까지 오른쪽에 붙은 칸 (본문은 결과 화면이 비켜 둔다)
    <div className="fixed bottom-3 right-3 z-40 flex h-[min(600px,calc(100vh-96px))] w-[min(380px,calc(100vw-24px))] flex-col print:hidden sm:bottom-6 sm:right-6 xl:top-[164px] xl:h-auto xl:w-[340px]"
      style={PANEL_STYLE}>
      <div className="flex items-center gap-2.5 border-b-2 border-[#111] px-3.5 py-2.5">
        <FileCat variant={sending ? 'thinking' : 'happy'} file="document" className="h-11 w-11 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] leading-tight text-bluewood-900" style={{ fontFamily: "'Jua','Pretendard',sans-serif" }}>편집 고양이</p>
          <p className="text-[11.5px] text-bluewood-400">말하면 이 한 장을 고쳐 드려요</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="rounded-full p-1.5 text-bluewood-400 hover:bg-surface-100 hover:text-bluewood-800"><X size={17} /></button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3.5">
        <BotLine>
          고치고 싶은 부분을 말해 주세요. 요청한 칸만 고치고, 자료에 없는 숫자는 만들지 않아요.
          <div className="mt-2 space-y-1">
            {EXAMPLES[isPm ? 'pm' : 'marketer'].map(ex => (
              <button key={ex} type="button" onClick={() => send(ex)} disabled={sending}
                className="block w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-left text-[12px] font-semibold text-bluewood-600 hover:border-[#111] hover:text-bluewood-900 disabled:opacity-50">
                {ex}
              </button>
            ))}
          </div>
        </BotLine>
        {messages.map((m, i) => (m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-[#111] px-3 py-2 text-[13px] leading-[1.55] text-white" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{m.text}</p>
          </div>
        ) : (
          <BotLine key={i} error={m.error}>
            {m.text}
            {m.changed?.length > 0 && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-bluewood-400">
                <span>바뀐 칸: {m.changed.map(labelOf).join(', ')}</span>
                {m.undo && <button type="button" onClick={() => undo(i)} className="font-bold text-bluewood-600 underline underline-offset-2 hover:text-bluewood-900">되돌리기</button>}
                {m.undone && <span>되돌렸어요</span>}
              </p>
            )}
          </BotLine>
        )))}
        {sending && <BotLine><span className="text-bluewood-400">고치는 중…</span></BotLine>}
      </div>

      <div className="border-t border-surface-200 px-3 pb-3 pt-2.5">
        {applied && <p className="mb-1.5 text-[11px] text-bluewood-400">고친 내용은 상단 ‘저장’을 눌러야 저장돼요.</p>}
        <div className="flex items-end gap-2 rounded-xl border border-surface-300 px-2.5 py-1.5 focus-within:border-[#111]">
          <textarea ref={inputRef} value={input} rows={2} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            placeholder="예: 문제 정의를 더 짧게 줄여줘"
            className="max-h-28 min-w-0 flex-1 resize-none bg-transparent py-1 text-[13px] leading-[1.5] text-bluewood-900 outline-none placeholder:text-bluewood-300"
            style={{ minHeight: 0, outline: 'none' }} /* 전역 :focus-visible 링 대신 바깥 칸 테두리로 포커스 표시 */ />
          <button type="button" onClick={() => send()} disabled={sending || !input.trim()} aria-label="보내기"
            className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#111] text-white disabled:opacity-30">
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function BotLine({ children, error }) {
  return (
    <div className="flex items-start gap-2">
      <FileCat variant="curious" file="document" className="mt-0.5 h-7 w-7 flex-shrink-0" />
      <div className={`max-w-[85%] rounded-2xl rounded-tl-md border px-3 py-2 text-[13px] leading-[1.6] ${error ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-surface-200 bg-surface-50 text-bluewood-800'}`} style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
        {children}
      </div>
    </div>
  );
}
