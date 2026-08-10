import { Fragment } from 'react';

/**
 * 지원 서류를 만드는 전체 흐름에서 지금 어디인지 보여주는 단계 표시기.
 * 아이콘 없이 번호와 라벨만 쓴다.
 */
export const PORTFOLIO_FLOW_STEPS = ['경험 정리', '사실 확인', '경험 선택', '템플릿', '완성'];

export default function FlowSteps({ steps = PORTFOLIO_FLOW_STEPS, current = 1 }) {
  return (
    <nav aria-label="진행 단계" className="flex items-start justify-center">
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <Fragment key={label}>
            {index > 0 && (
              <div className={`mt-[15px] h-px min-w-[16px] max-w-[88px] flex-1 ${step <= current ? 'bg-gray-300' : 'bg-gray-200'}`} />
            )}
            <div className="flex w-[88px] flex-col items-center sm:w-[104px]">
              <span
                aria-current={active ? 'step' : undefined}
                className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border text-[12.5px] font-bold transition-colors ${
                  done
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : active
                      ? 'border-primary-600 bg-white text-primary-600'
                      : 'border-gray-200 bg-white text-gray-300'
                }`}
              >
                {step}
              </span>
              <span className={`mt-2 text-center text-[12px] leading-tight ${active ? 'font-bold text-primary-600' : done ? 'font-medium text-gray-500' : 'text-gray-300'}`}>
                {label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </nav>
  );
}
