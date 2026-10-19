import { useEffect, useRef, useState } from 'react';

// Preview the real first page, never a generated replacement for a work sample.
export default function ArtifactPdfPreview({ url, name }) {
  const ref = useRef(null), [state, setState] = useState('loading');
  useEffect(() => {
    let stopped = false, document, task, render;
    const controller = new AbortController();
    const destroy = () => { render?.cancel(); Promise.resolve((document || task)?.destroy()).catch(() => {}); };
    const timeout = setTimeout(() => { controller.abort(); destroy(); }, 12000);
    setState('loading');
    (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok || Number(response.headers.get('content-length') || 0) > 20 * 1024 * 1024) throw new Error('preview unavailable');
        const data = new Uint8Array(await response.arrayBuffer());
        if (data.byteLength > 20 * 1024 * 1024 || stopped) throw new Error('preview unavailable');
        const pdf = await import('pdfjs-dist');
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        if (stopped || controller.signal.aborted) throw new Error('preview cancelled');
        pdf.GlobalWorkerOptions.workerSrc = worker.default;
        task = pdf.getDocument({ data, isEvalSupported: false });
        document = await task.promise;
        if (stopped) return;
        const page = await document.getPage(1), size = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(850 / size.width, 1.5) });
        const canvas = ref.current;
        if (!canvas || stopped) return;
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        render = page.render({ canvasContext: canvas.getContext('2d'), viewport });
        await render.promise;
        if (!stopped) setState('ready');
      } catch { if (!stopped) setState('failed'); }
      finally { clearTimeout(timeout); }
    })();
    return () => { stopped = true; clearTimeout(timeout); controller.abort(); destroy(); };
  }, [url]);
  return <div className="role-pdf-preview" data-state={state}>
    <canvas ref={ref} aria-label={`${name} 첫 페이지 미리보기`} style={{ display: state === 'ready' ? 'block' : 'none' }} />
    {state !== 'ready' && <span>{state === 'loading' ? 'PDF 첫 페이지를 불러오는 중…' : 'PDF 미리보기를 불러오지 못했습니다. 원본을 열어 확인하세요.'}</span>}
    {state === 'ready' && <small>원본 PDF · 첫 페이지</small>}
  </div>;
}
