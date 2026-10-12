// A specific requested experience takes precedence over generic lessons and job fit.
const FOOD_EXPERIENCE = /(?:식문화|음식|식생활|식사|food|cuisine)[\s\S]{0,90}(?:경험|experience)|(?:경험한|경험했던)[\s\S]{0,60}(?:식문화|음식|식생활|식사)/i;
const FOOD_SOURCE = /식문화|음식|식생활|식사|식단|식품|식탁|요리|조리|급식|메뉴|먹거리|먹었|먹은|먹어|먹는|맛보|시식|식당|음료|레시피|food|cuisine|cooking|meal/gi;

export function coverLetterQuestionFocus(question = '') {
  return FOOD_EXPERIENCE.test(String(question)) ? {
    label: '음식·식문화',
    followUpQuestion: '음식·식문화와 관련해 직접 경험한 일과 그 경험에서 깨달은 점을 알려주세요. 관련 경험을 연결하거나 아래에 직접 적어주세요.',
  } : null;
}

export function questionFocusWords(question, source = '') {
  if (!coverLetterQuestionFocus(question)) return [];
  return [...new Set([...String(source).matchAll(FOOD_SOURCE)].map(match => match[0]))];
}
