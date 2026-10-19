import test from 'node:test';
import assert from 'node:assert/strict';
import { coverLetterWritingGuide } from '../src/utils/coverLetterWritingGuide.js';
import { coverLetterQualityProblems } from '../src/utils/coverLetterQuality.js';
import { countAnswerCharacters, experienceSource, validateGeneratedAnswer } from '../src/services/coverLetterEvidence.js';
import { generateCoverLetterAnswer } from '../src/services/coverLetterService.js';
import { buildCoverLetterAnswerPrompt, buildCoverLetterAuditPrompt, buildCoverLetterLengthRevisionPrompt, buildCoverLetterLengthEditsPrompt } from '../src/prompts/coverLetterPrompts.js';

const question = {
  question: 'kt ds 및 해당 직무에 지원한 동기와 입사 후 해당 직무의 전문가로 성장하기 위해 어떠한 노력을 할지 구체적으로 기술해 주십시오. (최소 650자, 최대 700자 입력 가능)',
  minLength: 650, maxLength: 700, countSpaces: true,
};
// The reported output is a regression fixture, not evidence of the applicant's history.
const weakAnswer = 'KT DS가 AX Specialist로서 클라우드와 AI 기반 혁신을 선도하는 비전에 공감하여 SW Engineering 직무에 지원합니다. 저는 FitPoly 프로젝트에서 Python 기반 AI(LLM)와 React를 활용해 취준생의 비정형 경험 데이터를 구조화하는 서비스를 개발하며 역량을 쌓았습니다. ‘경험 1건당 AI 구조화 완료율 60%’ 달성을 목표로 데이터 기반 문제 정의와 해결책 설계에 집중했고, AI의 ‘생성’보다 ‘추출 및 검증’이 신뢰도 확보에 핵심임을 체득했습니다. 이러한 경험은 KT DS에서 AI 솔루션을 개발하고 고객에게 실질적인 가치를 제공하는 데 기여할 것입니다. 입사 후 SW Engineering 전문가로 성장하기 위해 AI/MLOps 및 클라우드 기술을 심화 학습하여 KT DS의 AX 전환을 가속화하겠습니다. FitPoly에서 배운 ‘검증’의 중요성을 바탕으로 신뢰성 높은 시스템을 구축하고, 고객의 ‘시선 차이’를 분석해 해결책을 모색했듯 실제 목소리에 귀 기울여 비즈니스 가치를 극대화하겠습니다. 팀원들과 지식을 공유하고 끊임없이 도전하여 KT DS가 지향하는 지속적인 혁신을 SW Engineering 관점에서 실현하겠습니다. 기술적 완성도를 넘어 사용자의 문제를 근본적으로 해결하는 가치를 창출하기 위해, 매 프로젝트마다 데이터에 기반한 의사결정을 내리고 기술적 난제를 해결하며 꾸준히 성장하겠습니다.';
const rawExperience = { id: 'fitpoly', content: { rawInput: 'FitPoly에서 Python 기반 LLM과 React를 사용해 취업 준비생의 경험 데이터를 구조화했습니다. 구조화 완료율 60%를 목표로 삼았습니다. 생성한 내용보다 원문 추출과 검증이 중요하다는 점을 배웠습니다.' } };
const quote = '생성한 내용보다 원문 추출과 검증이 중요하다는 점을 배웠습니다.';
const draft = answer => ({ answer, evidence: [{ experienceId: 'fitpoly', quote }], warnings: [] });

test('the reported motivation and growth question receives guidance for all its demands at every writing stage', () => {
  const input = { question, experiences: [experienceSource(rawExperience)] };
  for (const prompt of [buildCoverLetterAnswerPrompt(input), buildCoverLetterAuditPrompt(input, draft(weakAnswer)),
    buildCoverLetterLengthRevisionPrompt(input, draft(weakAnswer), countAnswerCharacters(weakAnswer)),
    buildCoverLetterLengthEditsPrompt(input, draft(weakAnswer))]) {
    assert.match(prompt, /기업 선택 이유와 직무 선택 이유/);
    assert.match(prompt, /어떤 방식으로 연습·적용할지/);
    assert.match(prompt, /무엇을 점검해 개선할지/);
    assert.match(prompt, /같은 말을 반복하지/);
  }
  assert.doesNotMatch(coverLetterWritingGuide('갈등을 해결한 경험과 배운 점을 설명해주세요.'), /기업 선택 이유와 직무 선택 이유/);
});

test('generated paragraph breaks survive final review and count toward the 650–700 character range', async () => {
  const answer = weakAnswer.replace(' 입사 후', '\n\n입사 후').replace(' 팀원들과', '\n\n팀원들과');
  assert.equal(answer.split('\n\n').length, 3);
  assert.ok(countAnswerCharacters(answer) >= 650 && countAnswerCharacters(answer) <= 700);
  const result = await generateCoverLetterAnswer({ question }, [rawExperience], {
    generateAI: async prompt => prompt.startsWith('분량 보정이 끝난')
      ? JSON.stringify({ status: 'pass', requirements: [{ requirement: '지원 동기', answerQuote: 'SW Engineering 직무에 지원합니다.' }], issues: [] })
      : JSON.stringify(draft(answer)),
  });
  assert.equal(result.answer, answer);
  assert.equal(result.review.charCount, countAnswerCharacters(answer));
  assert.equal(result.review.withinLimit, true);
  assert.equal(countAnswerCharacters('첫 문단\n\n다음 문단'), 11);
  assert.equal(countAnswerCharacters('첫 문단\n\n다음 문단', false), 7);
});

test('a draft inside the requested length still fails review when its required growth plan is missing', () => {
  assert.ok(countAnswerCharacters(weakAnswer) >= 650 && countAnswerCharacters(weakAnswer) <= 700);
  const result = validateGeneratedAnswer({ ...draft(weakAnswer), qualityIssues: ['전문가로 성장하기 위한 실행 방법과 점검 방법이 빠져 있습니다.'] },
    { question, experiences: [experienceSource(rawExperience)] });
  assert.equal(result.review.withinLimit, true);
  assert.match(result.problems.join(' '), /실행 방법과 점검 방법/);
});

test('a passing label cannot hide missing requirements or quotations absent from the final answer', () => {
  const review = { status: 'pass', requirements: [
    { requirement: '지원 이유', answerQuote: 'SW Engineering 직무에 지원합니다.' },
    { requirement: '성장 노력', answerQuote: '' },
    { requirement: '구체적인 점검 방법', answerQuote: '운영 로그를 점검하겠습니다.' },
  ], issues: [] };
  const problems = coverLetterQualityProblems(review, weakAnswer);
  assert.equal(problems.length, 2);
  assert.match(problems.join(' '), /성장 노력/);
  assert.match(problems.join(' '), /구체적인 점검 방법/);
  assert.deepEqual(coverLetterQualityProblems({ status: 'pass', requirements: [{ requirement: '직무 지원', answerQuote: 'SW Engineering 직무에 지원합니다.' }], issues: [] }, weakAnswer), []);
  assert.match(coverLetterQualityProblems({ status: 'pass', requirements: [{ requirement: '직무 지원', answerQuote: 'SW Engineering 직무에 지원합니다.' }], issues: [] }, weakAnswer + '…').join(' '), /마지막 문장을 완결/);
});

test('audit findings reach the repair prompt even when a draft fits the character range', async () => {
  let calls = 0;
  const result = await generateCoverLetterAnswer({ question }, [rawExperience], {
    generateAI: async prompt => {
      calls++;
      if (calls === 5) return JSON.stringify({ status: 'pass', requirements: [{ requirement: '직무 지원', answerQuote: 'SW Engineering 직무에 지원합니다.' }], issues: [] });
      if (calls === 2) return JSON.stringify({ ...draft(weakAnswer), qualityIssues: ['성장 노력에 실행 방법과 점검 방법이 필요합니다.'] });
      if (calls === 3) assert.match(prompt, /직전 검증 결과를 반드시 해결하세요: 성장 노력에 실행 방법과 점검 방법/);
      return JSON.stringify(draft(weakAnswer));
    },
  });
  assert.equal(calls, 5);
  assert.equal(result.review.withinLimit, true);
});

test('the reported weak answer is independently reviewed even when no length adjustment was needed', async () => {
  let calls = 0;
  const result = await generateCoverLetterAnswer({ question }, [rawExperience], {
    generateAI: async prompt => {
      calls++;
      if (calls <= 2) return JSON.stringify(draft(weakAnswer));
      if (calls === 3) {
        assert.match(prompt, /본문을 수정하거나 글자 수를 추정하지 말고 판정만/);
        return JSON.stringify({ status: 'revise', requirements: [
          { requirement: '기업 선택 이유', answerQuote: '' },
          { requirement: '성장하기 위한 구체적인 노력', answerQuote: '' },
        ], issues: ['기업 선택 이유가 찬사에 머물고 성장 계획에 실행·점검 방법이 없습니다.'] });
      }
      assert.match(prompt, /직전 검증 결과를 반드시 해결하세요: 기업 선택 이유가 찬사에 머물고/);
      return JSON.stringify({ status: 'needs_context', followUpQuestion: 'KT DS의 어떤 업무에 관심이 있는지와 그 이유를 알려주세요.' });
    },
  });
  assert.equal(calls, 4);
  assert.equal(result.status, 'needs_context');
  assert.equal(result.answer, '');
  assert.match(result.followUpQuestion, /KT DS의 어떤 업무/);
});

test('quality review repairs an awkward length edit and checks the repaired result without changing its length', async () => {
  const original = draft('원문 추출과 검증을 배웠습니다.');
  const awkward = '원문 추출과 검증의 신뢰성을 극대화하는 역량 고도화를 실현하였습니다.';
  const repaired = '원문을 먼저 추출한 뒤 생성 결과와 비교하겠습니다. 오류 사례는 테스트로 남겨 수정 효과를 확인하겠습니다.';
  let calls = 0;
  const result = await generateCoverLetterAnswer({ question: { question: '직무 전문가로 성장하기 위한 노력을 설명해주세요.', minLength: 35, maxLength: 100 } }, [rawExperience], {
    generateAI: async prompt => {
      calls++;
      if (calls <= 2) return JSON.stringify(original);
      if (calls === 3) return JSON.stringify(draft(awkward));
      if (calls === 4) return JSON.stringify({ status: 'revise', requirements: [{ requirement: '구체적인 노력', answerQuote: '' }], issues: ['명사 나열이 어색하고 실행·점검 방법이 빠져 있습니다.'] });
      if (calls === 5) assert.match(prompt, /명사 나열이 어색하고 실행·점검 방법이 빠져/);
      if (calls <= 6) return JSON.stringify(draft(repaired));
      assert.match(prompt, /본문을 수정하거나 글자 수를 추정하지 말고 판정만/);
      assert.ok(prompt.includes(repaired));
      return JSON.stringify({ status: 'pass', requirements: [{ requirement: '실행과 점검', answerQuote: repaired }], issues: [] });
    },
  });
  assert.equal(calls, 7);
  assert.equal(result.answer, repaired);
  assert.equal(result.review.charCount, countAnswerCharacters(repaired));
  assert.equal(result.review.withinLimit, true);
});

test('a reviewer rejection is not ignored when the repair keeps returning the same weak wording', async () => {
  const original = draft('추출과 검증을 배웠습니다.');
  const awkward = draft('추출과 검증을 통한 고객 가치 극대화 역량 고도화를 실현하겠습니다.');
  await assert.rejects(generateCoverLetterAnswer({ question: { question: '전문가로 성장하기 위한 노력을 설명해주세요.', minLength: 30, maxLength: 100 } }, [rawExperience], {
    generateAI: async prompt => {
      if (prompt.startsWith('분량 보정이 끝난')) return JSON.stringify({ status: 'revise', requirements: [{ requirement: '성장 노력', answerQuote: '' }], issues: ['실행 방법이 없습니다.'] });
      if (prompt.startsWith('자기소개서 초안을')) return JSON.stringify(awkward);
      if (prompt.includes('직전 검증 결과를 반드시 해결하세요:')) return JSON.stringify(awkward);
      if (prompt.startsWith('자기소개서의 사실과 문장') && prompt.includes(awkward.answer)) return JSON.stringify(awkward);
      return JSON.stringify(original);
    },
  }), error => error.code === 'COVERLETTER_QUALITY_FAILED');
});

test('a missing-context result from the length stage is propagated through the final checks', async () => {
  let calls = 0;
  const result = await generateCoverLetterAnswer({ question: { ...question, minLength: 800, maxLength: 900 } }, [rawExperience], {
    generateAI: async () => ++calls <= 2 ? JSON.stringify(draft(weakAnswer))
      : JSON.stringify({ status: 'needs_context', followUpQuestion: '입사 후 직접 실천하려는 학습·검증 방법을 알려주세요.' }),
  });
  assert.equal(calls, 3);
  assert.equal(result.status, 'needs_context');
  assert.match(result.followUpQuestion, /학습·검증/);
});
