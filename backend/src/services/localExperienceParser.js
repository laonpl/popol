// The same source-only parser runs in the browser and on the server.
import { CAREER_FIELD_PROFILES } from '../prompts/careerFieldProfiles.js';
import { analyzeBlock as analyze, parseExperiencesLocally as parse } from '../../../shared/localExperienceParser.mjs';

export { toLines } from '../../../shared/localExperienceParser.mjs';
export const analyzeBlock = (title, lines, options = {}) => analyze(title, lines, { ...options, profiles: CAREER_FIELD_PROFILES });
export const parseExperiencesLocally = (text, fallbackTitle = '') => parse(text, fallbackTitle, { profiles: CAREER_FIELD_PROFILES });