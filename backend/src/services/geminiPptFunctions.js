// AI PPT 생성 함수 — geminiService.js 에 re-export 됨
import { buildAiPptAnalyzePrompt, buildAiPptRevisePrompt } from '../prompts/portfolioPrompts.js';

// 이 파일에서 필요한 내부 헬퍼들은 geminiService.js 의 것을 쓸 수 없으므로 직접 정의
function parseJSON(text, pattern = /\{[\s\S]*\}/) {
  if (!text) return null;
  const m = text.match(pattern);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function callGeminiPro(prompt) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

function withTimeout(promise, ms = 90000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('AI 응답 시간 초과')), ms)),
  ]);
}

export async function generateAiPptDeck({ portfolio, templateHint, customTemplate }) {
  if (customTemplate) {
    try {
      const prompt = buildAiPptAnalyzePrompt({ portfolio, templateHint, customTemplate });
      const text = await withTimeout(callGeminiPro(prompt), 90000);
      const customDeck = parseJSON(text);
      if (customDeck && Array.isArray(customDeck.slides) && customDeck.slides.length > 0) return customDeck;
    } catch (err) {
      console.warn('[AiPptDeck] 커스텀 템플릿 생성 실패 — 결정적 deck 폴백:', err.message);
    }
  }
  const baseDeck = buildDeckFromPortfolio(portfolio);
  let polished = null;
  try {
    const prompt = buildAiPptAnalyzePrompt({ portfolio, templateHint, baseDeck });
    const text = await withTimeout(callGeminiPro(prompt), 90000);
    polished = parseJSON(text);
  } catch (err) {
    console.warn('[AiPptDeck] AI polish 실패 — 결정적 deck 사용:', err.message);
  }
  return mergeDecksWithPolish(baseDeck, polished);
}

export async function reviseAiPptSlide({ slide, instruction, portfolio }) {
  const prompt = buildAiPptRevisePrompt({ slide, instruction, portfolio });
  const text = await withTimeout(callGeminiPro(prompt), 60000);
  const parsed = parseJSON(text) || {};
  return {
    id: slide.id,
    layout: parsed.layout || slide.layout,
    title: String(parsed.title || slide.title || '').slice(0, 80),
    subtitle: parsed.subtitle ? String(parsed.subtitle).slice(0, 120) : (slide.subtitle || ''),
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(b => String(b).slice(0, 120)).slice(0, 8) : (slide.bullets || []),
    items: Array.isArray(parsed.items) ? parsed.items.slice(0, 4).map(it => ({
      heading: String(it.heading || '').slice(0, 60),
      period: String(it.period || '').slice(0, 40),
      role: String(it.role || '').slice(0, 60),
      body: String(it.body || '').slice(0, 200),
      bullets: Array.isArray(it.bullets) ? it.bullets.map(b => String(b).slice(0, 120)).slice(0, 6) : [],
    })) : (slide.items || []),
    notes: parsed.notes ? String(parsed.notes).slice(0, 200) : (slide.notes || ''),
  };
}

function buildDeckFromPortfolio(p) {
  const slides = [];
  const userName = p.userName || '';
  const target = `${p.targetCompany || ''} ${p.targetPosition || ''}`.trim();

  slides.push({ id: 's1', layout: 'cover', title: p.title || `${userName} 포트폴리오`, subtitle: target || (p.headline || '') });

  const profileBullets = [
    userName && `이름 · ${userName}`,
    p.userBirth && `생년 · ${p.userBirth}`,
    p.userAddress && `거주 · ${p.userAddress}`,
    p.contact?.email && `Email · ${p.contact.email}`,
    p.contact?.phone && `Phone · ${p.contact.phone}`,
    (p.contact?.website || p.contact?.linkedin) && `Web · ${p.contact.website || p.contact.linkedin}`,
  ].filter(Boolean);
  if (profileBullets.length) slides.push({ id: `s${slides.length + 1}`, layout: 'profile', title: 'Profile', subtitle: target, bullets: profileBullets });

  const education = Array.isArray(p.education) ? p.education : [];
  if (education.length) {
    slides.push({
      id: `s${slides.length + 1}`, layout: 'education', title: 'Education',
      items: education.slice(0, 3).map(e => ({ heading: e.school || e.name || '', period: e.period || '', role: e.degree || e.major || '', body: e.major || e.description || '', bullets: Array.isArray(e.bullets) ? e.bullets : [], metrics: [] })),
    });
  }

  const experiences = Array.isArray(p.experiences) ? p.experiences : [];
  experiences.slice(0, 6).forEach((e, idx) => {
    const sr = e.structuredResult || e.frameworkContent || {};
    const ov = sr.projectOverview || {};
    const heading = e.company || e.title || `프로젝트 ${idx + 1}`;
    const period = ov.duration || e.period || '';
    const role = ov.role || e.role || '';
    const body = e.description || sr.intro || sr.overview || ov.summary || e.detail || '';
    let itemBullets = [];
    if (Array.isArray(e.bullets) && e.bullets.length) itemBullets = e.bullets.slice(0, 5);
    else if (Array.isArray(e.sections)) itemBullets = e.sections.slice(0, 4).map(s => s.title || s.content).filter(Boolean);
    const keyExps = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
    const metrics = keyExps.slice(0, 3).map(k => ({ label: k.metricLabel || k.title || '', value: k.metric || '', before: k.beforeMetric || '', after: k.afterMetric || '' })).filter(m => m.label || m.value);
    if (!itemBullets.length && keyExps.length) itemBullets = keyExps.slice(0, 4).map(k => k.result || k.action || k.title).filter(Boolean);
    const compact = (s, max = 80) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
    const problem = keyExps.map(k => compact(k.situation)).filter(Boolean).slice(0, 3);
    const action = keyExps.map(k => compact(k.action)).filter(Boolean).slice(0, 3);
    const result = keyExps.map(k => compact(k.result)).filter(Boolean).slice(0, 3);
    if (!problem.length && !action.length && !result.length && itemBullets.length) {
      itemBullets.slice(0, 3).forEach((b, i) => { if (i === 0) problem.push(compact(b)); else if (i === 1) action.push(compact(b)); else result.push(compact(b)); });
    }
    const highlight_metric = metrics[0] || null;
    const totalLen = [...problem, ...action, ...result].join(' ').length;
    const layout_type = highlight_metric && totalLen < 80 ? 'CENTER_METRIC' : highlight_metric && (problem.length || action.length || result.length) ? 'SPLIT_HALF' : 'STACK_LIST';
    slides.push({ id: `s${slides.length + 1}`, layout: 'experience', title: `핵심 경험: ${heading}`, subtitle: role || period, layout_type, highlight_metric, details: { problem, action, result }, items: [{ heading, period, role, body, bullets: itemBullets, metrics }] });
  });

  const skills = p.skills || {};
  const techBullets = [];
  [['languages', 'Languages'], ['frameworks', 'Frameworks'], ['tools', 'Tools'], ['others', 'Others']].forEach(([cat, label]) => {
    const arr = Array.isArray(skills[cat]) ? skills[cat] : [];
    const names = arr.slice(0, 6).map(s => typeof s === 'string' ? s : s.name).filter(Boolean).join(', ');
    if (names) techBullets.push(`${label} · ${names}`);
  });
  if (techBullets.length) slides.push({ id: `s${slides.length + 1}`, layout: 'skills', title: 'Skills', bullets: techBullets });

  const awards = Array.isArray(p.awards) ? p.awards : [];
  if (awards.length) slides.push({ id: `s${slides.length + 1}`, layout: 'awards', title: 'Awards', bullets: awards.slice(0, 6).map(a => typeof a === 'string' ? a : [a.name || a.title, a.issuer, a.date || a.period].filter(Boolean).join(' · ')) });

  const values = p.values || p.valuesEssay || p.about;
  if (values && String(values).trim()) {
    const trimmed = String(values).trim();
    const sentences = trimmed.split(/[.!?。\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 5);
    slides.push({ id: `s${slides.length + 1}`, layout: 'values', title: 'Values', bullets: sentences.length ? sentences : [trimmed.slice(0, 200)] });
  }

  slides.push({ id: `s${slides.length + 1}`, layout: 'closing', title: 'Thank You', subtitle: userName, bullets: [p.contact?.email && `Email · ${p.contact.email}`, p.contact?.phone && `Phone · ${p.contact.phone}`, p.contact?.website && `Web · ${p.contact.website}`].filter(Boolean) });

  return { meta: { title: p.title || `${userName} 포트폴리오`, subtitle: target, accentColor: '#0F172A' }, slides };
}

function mergeDecksWithPolish(baseDeck, polished) {
  if (!polished || !Array.isArray(polished.slides)) return baseDeck;
  const byId = new Map();
  polished.slides.forEach((s, i) => byId.set(s.id || `s${i + 1}`, s));
  const slides = baseDeck.slides.map(b => {
    const p = byId.get(b.id);
    if (!p) return b;
    const mergedBullets = Array.isArray(p.bullets) && p.bullets.length ? p.bullets.map(x => String(x).slice(0, 120)).slice(0, 8) : b.bullets || [];
    const mergedItems = Array.isArray(p.items) && p.items.length ? p.items.map((pit, idx) => {
      const bit = (b.items || [])[idx] || {};
      return {
        heading: String(pit.heading || bit.heading || '').slice(0, 60),
        period: String(pit.period || bit.period || '').slice(0, 40),
        role: String(pit.role || bit.role || '').slice(0, 60),
        body: String(pit.body || bit.body || '').slice(0, 200),
        bullets: Array.isArray(pit.bullets) && pit.bullets.length ? pit.bullets.map(x => String(x).slice(0, 120)).slice(0, 6) : (bit.bullets || []),
        metrics: Array.isArray(pit.metrics) && pit.metrics.length ? pit.metrics.slice(0, 4).map(m => ({ label: String(m.label || '').slice(0, 40), value: String(m.value || '').slice(0, 30), before: m.before ? String(m.before).slice(0, 20) : '', after: m.after ? String(m.after).slice(0, 20) : '' })).filter(m => m.label || m.value) : (bit.metrics || []),
      };
    }) : (b.items || []);
    return {
      id: b.id, layout: b.layout,
      title: String(p.title || b.title || '').slice(0, 80),
      subtitle: String(p.subtitle || b.subtitle || '').slice(0, 120),
      bullets: mergedBullets, items: mergedItems,
      layout_type: ['SPLIT_HALF', 'CENTER_METRIC', 'STACK_LIST'].includes(p.layout_type) ? p.layout_type : (b.layout_type || undefined),
      highlight_metric: p.highlight_metric && (p.highlight_metric.value || p.highlight_metric.label) ? { label: String(p.highlight_metric.label || '').slice(0, 30), value: String(p.highlight_metric.value || '').slice(0, 24), before: p.highlight_metric.before ? String(p.highlight_metric.before).slice(0, 16) : '', after: p.highlight_metric.after ? String(p.highlight_metric.after).slice(0, 16) : '' } : (b.highlight_metric || undefined),
      details: p.details && typeof p.details === 'object' ? {
        problem: (Array.isArray(p.details.problem) ? p.details.problem : (b.details?.problem || [])).map(x => String(x).slice(0, 90)).slice(0, 3),
        action: (Array.isArray(p.details.action) ? p.details.action : (b.details?.action || [])).map(x => String(x).slice(0, 90)).slice(0, 3),
        result: (Array.isArray(p.details.result) ? p.details.result : (b.details?.result || [])).map(x => String(x).slice(0, 90)).slice(0, 3),
      } : (b.details || undefined),
      notes: p.notes ? String(p.notes).slice(0, 200) : '',
    };
  });
  return { meta: { ...baseDeck.meta, ...(polished.meta || {}) }, slides };
}
