/**
 * 요약 슬라이드 뷰어 — 큰 화면 + 썸네일 + 포인트 색 + 문구 편집 + PNG/ZIP 저장.
 * onChange 를 넘기지 않으면 읽기 전용(색 변경·편집 불가)이다.
 * PNG 는 화면 밖에 원본 크기(1600×900)로 따로 그린 슬라이드를 2400×1350 으로 캡처한다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FolderDown, Loader2, PenLine, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { DECK_ACCENTS, SummaryDeckSlide } from './SummaryDeckSlides';
import { getJobPortfolioMeta } from '../../utils/devPortfolio';

const W = 1600;
const H = 900;
const THUMB = 0.1;

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

async function waitForImages(root) {
  await Promise.all([...root.querySelectorAll('img')].map(img => (img.complete ? null : new Promise(resolve => {
    const timer = setTimeout(resolve, 6000);
    const done = () => { clearTimeout(timer); resolve(); };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  }))));
}

function setIn(obj, path, value) {
  const next = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let node = next;
  keys.slice(0, -1).forEach(key => { node = node[key]; });
  node[keys.at(-1)] = value;
  return next;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeName = text => String(text || '경험요약').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 40);

export default function SummaryDeckViewer({ deck, onChange, jobCategory, images = [], toolbar = null }) {
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [stageOn, setStageOn] = useState(false);
  const [busy, setBusy] = useState('');
  const [width, setWidth] = useState(1100);
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const accent = deck.accent || 'mint';
  const kicker = getJobPortfolioMeta(jobCategory)?.kicker || 'PORTFOLIO';
  const count = deck.slides.length;
  const current = Math.min(index, count - 1);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = e => {
      if (e.target?.isContentEditable || /INPUT|TEXTAREA/.test(e.target?.tagName)) return;
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, count - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  const edit = useCallback((path, value) => onChange?.(setIn(deck, path, value)), [deck, onChange]);

  const capture = async i => {
    const node = stageRef.current?.querySelector(`[data-sd-export="${i}"] .sd-slide`);
    if (!node) throw new Error('슬라이드를 찾지 못했습니다');
    await document.fonts.ready;
    await waitForImages(node);
    await nextFrame();
    await nextFrame();
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(node, {
      scale: 1.5, useCORS: true, backgroundColor: '#141518', logging: false,
      width: W, height: H, windowWidth: W, windowHeight: H,
    });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  };

  const prepareStage = async () => {
    if (!stageOn) {
      setStageOn(true);
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    await nextFrame();
  };

  const saveCurrent = async () => {
    setBusy('png');
    try {
      await prepareStage();
      const blob = await capture(current);
      download(blob, `${safeName(deck.title)}_${String(current + 1).padStart(2, '0')}.png`);
    } catch (error) {
      toast.error(`이미지 저장에 실패했어요: ${error.message}`);
    } finally {
      setBusy('');
    }
  };

  const saveAll = async () => {
    setBusy('zip');
    try {
      await prepareStage();
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (let i = 0; i < count; i++) {
        zip.file(`${String(i + 1).padStart(2, '0')}_${deck.slides[i].type}.png`, await capture(i));
      }
      download(await zip.generateAsync({ type: 'blob' }), `${safeName(deck.title)}_요약슬라이드.zip`);
    } catch (error) {
      toast.error(`이미지 저장에 실패했어요: ${error.message}`);
    } finally {
      setBusy('');
    }
  };

  const scale = width / W;
  const button = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold transition-colors disabled:opacity-50';

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] font-bold text-white/60">{current + 1} / {count}</span>
          {onChange && (
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="포인트 색">
              {DECK_ACCENTS.map(a => (
                <button
                  key={a.key}
                  type="button"
                  role="radio"
                  aria-checked={accent === a.key}
                  title={a.label}
                  onClick={() => onChange({ ...deck, accent: a.key })}
                  className={`h-5 w-5 rounded-full ring-offset-2 ring-offset-[#0b0c0e] transition ${accent === a.key ? 'ring-2 ring-white' : ''}`}
                  style={{ background: a.color }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {onChange && (
            <button type="button" onClick={() => setEditing(v => !v)} className={`${button} ${editing ? 'bg-white text-[#0b0c0e]' : 'bg-white/10 text-white hover:bg-white/15'}`}>
              {editing ? <Check size={14} /> : <PenLine size={14} />} {editing ? '수정 끝내기' : '문구 수정'}
            </button>
          )}
          <button type="button" onClick={saveCurrent} disabled={!!busy} className={`${button} bg-white/10 text-white hover:bg-white/15`}>
            {busy === 'png' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 이 장 PNG
          </button>
          <button type="button" onClick={saveAll} disabled={!!busy} className={`${button} bg-white/10 text-white hover:bg-white/15`}>
            {busy === 'zip' ? <Loader2 size={14} className="animate-spin" /> : <FolderDown size={14} />} 전체 ZIP
          </button>
          {toolbar}
        </div>
      </div>

      {editing && <p className="text-[12px] text-white/50">점선 안의 글자를 눌러 바로 고칠 수 있어요. 숫자도 직접 확인하고 고쳐주세요.</p>}

      <div className="relative">
        <div ref={frameRef} className="w-full overflow-hidden rounded-xl" style={{ height: H * scale }}>
          <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <SummaryDeckSlide deck={deck} index={current} accent={accent} kicker={kicker} images={images} editable={editing && !!onChange} onEdit={edit} />
          </div>
        </div>
        <button type="button" aria-label="이전 장" disabled={current === 0} onClick={() => setIndex(current - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-0"><ChevronLeft size={20} /></button>
        <button type="button" aria-label="다음 장" disabled={current === count - 1} onClick={() => setIndex(current + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-0"><ChevronRight size={20} /></button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {deck.slides.map((s, i) => (
          <button
            key={s.id || i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}번째 장`}
            className={`flex-none overflow-hidden rounded-md ring-2 transition ${i === current ? 'ring-white' : 'ring-transparent opacity-60 hover:opacity-100'}`}
            style={{ width: W * THUMB, height: H * THUMB }}
          >
            <div style={{ width: W, height: H, transform: `scale(${THUMB})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
              <SummaryDeckSlide deck={deck} index={i} accent={accent} kicker={kicker} images={images} />
            </div>
          </button>
        ))}
      </div>

      {/* PNG 캡처용 원본 크기 슬라이드 — 화면 뒤(z-index -1)에 둔다 */}
      {stageOn && (
        <div ref={stageRef} aria-hidden style={{ position: 'fixed', left: 0, top: 0, zIndex: -1, pointerEvents: 'none', width: W }}>
          {deck.slides.map((s, i) => (
            <div key={s.id || i} data-sd-export={i}>
              <SummaryDeckSlide deck={deck} index={i} accent={accent} kicker={kicker} images={images} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
