import { useEffect, forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';

function getTargetRect(selector) {
  if (!selector || typeof window === 'undefined') return null;
  const target = document.querySelector(selector);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const GuidedTutorial = forwardRef(function GuidedTutorial({ visible, steps = [], onSkip, onNeverShow, initialStep = 0, onStepChange }, ref) {
  const [current, setCurrent] = useState(initialStep);
  const [rect, setRect] = useState(null);
  const enteredStepRef = useRef(null);
  const step = steps[current];
  const stepSelector = step?.selector;

  useImperativeHandle(ref, () => ({
    next: () => setCurrent(c => Math.min(c + 1, steps.length - 1)),
  }), [steps.length]);

  useEffect(() => {
    onStepChange?.(current);
  }, [current, onStepChange]);

  useEffect(() => {
    if (visible) setCurrent(initialStep);
    else enteredStepRef.current = null;
  }, [visible, initialStep]);

  useEffect(() => {
    if (!visible || !step) return undefined;

    const enterKey = `${current}:${stepSelector || ''}`;
    if (enteredStepRef.current !== enterKey) {
      enteredStepRef.current = enterKey;
      step.onEnter?.();
    }

    if (!stepSelector) {
      setRect(null);
      return undefined;
    }

    let hasScrolledToTarget = false;

    const measure = () => {
      const target = document.querySelector(stepSelector);
      if (target && !hasScrolledToTarget) {
        hasScrolledToTarget = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      const newRect = getTargetRect(stepSelector);
      setRect(prev => {
        if (!prev && !newRect) return prev;
        if (!prev || !newRect) return newRect;
        if (prev.top === newRect.top && prev.left === newRect.left &&
            prev.width === newRect.width && prev.height === newRect.height) return prev;
        return newRect;
      });
    };

    const timer = window.setTimeout(measure, 220);
    const lateTimer = window.setTimeout(measure, 900);
    const finalTimer = window.setTimeout(measure, 1700);
    const interval = window.setInterval(measure, 500);
    const stopInterval = window.setTimeout(() => window.clearInterval(interval), 3000);
    const observer = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(measure)
      : null;

    observer?.observe(document.body, { childList: true, subtree: true });
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(lateTimer);
      window.clearTimeout(finalTimer);
      window.clearTimeout(stopInterval);
      window.clearInterval(interval);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [visible, current, stepSelector]);

  const cardStyle = useMemo(() => {
    const width = typeof window === 'undefined' ? 440 : Math.min(440, window.innerWidth - 32);
    const margin = 18;
    const estimatedHeight = 340;

    if (!rect) {
      return {
        left: `calc(50% - ${width / 2}px)`,
        top: 'calc(50% - 180px)',
        width,
      };
    }

    const belowTop = rect.top + rect.height + margin;
    const aboveTop = rect.top - estimatedHeight - margin;

    let top;
    if (belowTop + estimatedHeight <= window.innerHeight - margin) {
      top = belowTop;
    } else if (aboveTop >= margin) {
      top = aboveTop;
    } else {
      top = clamp(rect.top, margin, Math.max(margin, window.innerHeight - estimatedHeight - margin));
    }

    const left = clamp(
      rect.left + rect.width / 2 - width / 2,
      margin,
      window.innerWidth - width - margin,
    );

    return { left, top, width };
  }, [rect]);

  if (!visible || !step) return null;

  const isFirst = current === 0;
  const isLast = current === steps.length - 1;
  const paddedRect = rect
    ? {
        top: Math.max(8, rect.top - 8),
        left: Math.max(8, rect.left - 8),
        width: rect.width + 16,
        height: rect.height + 16,
      }
    : null;
  const dimPanels = paddedRect
    ? [
        { top: 0, left: 0, right: 0, height: paddedRect.top },
        { top: paddedRect.top + paddedRect.height, left: 0, right: 0, bottom: 0 },
        { top: paddedRect.top, left: 0, width: paddedRect.left, height: paddedRect.height },
        { top: paddedRect.top, left: paddedRect.left + paddedRect.width, right: 0, height: paddedRect.height },
      ]
    : null;

  const goNext = () => {
    if (isLast) onSkip?.();
    else setCurrent(index => Math.min(index + 1, steps.length - 1));
  };

  const goPrev = () => {
    steps[current]?.onPrev?.();
    setCurrent(index => Math.max(index - 1, 0));
  };

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      {dimPanels ? (
        dimPanels.map((style, index) => (
          <div key={index} className="absolute bg-slate-950/72" style={style} />
        ))
      ) : (
        <div className="absolute inset-0 bg-slate-950/72" />
      )}

      {paddedRect && (
        <div
          className="absolute rounded-2xl border-2 border-white bg-transparent shadow-[0_0_34px_10px_rgba(96,165,250,0.55)] animate-tour-glow"
          style={paddedRect}
        />
      )}

      <div
        className="absolute pointer-events-auto rounded-2xl border border-white/20 bg-white shadow-2xl animate-tour-card"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3 border-b border-surface-100 px-5 py-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary-500">
              {current + 1} / {steps.length}
            </p>
            <h2 className="mt-1 text-lg font-extrabold leading-snug text-bluewood-800">{step.title}</h2>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg p-1.5 text-bluewood-300 hover:bg-surface-50 hover:text-bluewood-700 transition-colors"
            aria-label="튜토리얼 닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-bluewood-500">{step.body}</p>
          {step.preview && (
            <div className="rounded-xl border border-primary-100 bg-primary-50/70 p-3 text-sm text-bluewood-700">
              {step.preview}
            </div>
          )}
          {step.actionLabel && (
            <button
              type="button"
              onClick={step.onAction}
              className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 transition-colors shadow-sm shadow-primary-100"
            >
              {step.actionLabel}
            </button>
          )}
        </div>

        {!step.hideNav && (
        <div className="flex items-center justify-between gap-3 border-t border-surface-100 px-5 py-4">
          <button
            type="button"
            onClick={onNeverShow}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold text-bluewood-400 hover:text-bluewood-700 transition-colors"
          >
            <Check size={14} /> 다시보지 않기
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold text-bluewood-400 hover:bg-surface-50 hover:text-bluewood-700 transition-colors"
            >
              건너뛰기
            </button>
            <button
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-surface-200 px-3 py-2 text-[13px] font-semibold transition-colors ${
                isFirst
                  ? 'invisible pointer-events-none'
                  : 'text-bluewood-500 hover:bg-surface-50'
              }`}
            >
              <ChevronLeft size={14} /> 이전
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-bluewood-800 px-3 py-2 text-[13px] font-bold text-white hover:bg-bluewood-900 transition-colors"
            >
              {isLast ? '완료' : '다음'} <ChevronRight size={14} />
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
});

export default GuidedTutorial;
