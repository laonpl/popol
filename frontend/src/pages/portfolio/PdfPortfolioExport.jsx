/**
 * PdfPortfolioExport.jsx
 * Wanted Portfolio Style - Premium Keynote PPT Preview
 * 구조: Cover → Profile → Skills → [SectionDivider + Situation + Result] × N → Outro
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, ChevronDown, UploadCloud, FileText, Wand2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';
import { generatePptx } from './generatePptx';
import { THEMES, getLayout } from '../../constants/portfolioThemes';
import { strip, extractFields, toBullets, smartBullets, shorten, nameSpaced } from '../../utils/textUtils';
import { analyzeAndPreviewTemplate, directTemplatePlaceholder, directTemplateSpecToText, extractDirectTemplateFromFile } from '../../utils/directTemplate';

const SW = 1200;
const SH = 675;

/* ─── Atoms ─── */
function Slide({ t, bg, children, style = {} }) {
  return <div className="ppt-slide" style={{
    width: SW, height: SH, flexShrink: 0, backgroundColor: bg || t.bg,
    position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
    fontFamily: "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',-apple-system,sans-serif",
    ...style
  }}>{children}</div>;
}
function SectionLabel({ children, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: 3.5, color: t.sub,
        textTransform: 'uppercase', flexShrink: 0, whiteSpace: 'nowrap'
      }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: t.div }} />
    </div>
  );
}
function ProjectLabel({ num, category, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
      <span style={{
        fontSize: 8.5, fontWeight: 800, letterSpacing: 3, color: t.accent,
        textTransform: 'uppercase', flexShrink: 0
      }}>PROJECT {num}</span>
      <span style={{ fontSize: 8.5, color: t.sub, flexShrink: 0 }}>—</span>
      <span style={{
        fontSize: 8.5, fontWeight: 600, letterSpacing: 2, color: t.sub,
        textTransform: 'uppercase', flexShrink: 0
      }}>{category}</span>
      <div style={{ flex: 1, height: 1, background: t.div }} />
    </div>
  );
}
function SlideTitle({ children, t, size = 28 }) {
  return <div style={{ fontSize: size, fontWeight: 900, color: t.text, letterSpacing: -1, lineHeight: 1.1, marginBottom: 20 }}>{children}</div>;
}
function SectionBold({ children, t, size = 15 }) {
  return <div style={{ fontSize: size, fontWeight: 800, color: t.accent, marginBottom: 10, letterSpacing: -0.3 }}>{children}</div>;
}
function CheckBullet({ children, t }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0, width: 15, height: 15, border: `1.5px solid ${t.div}`,
        borderRadius: 3, marginTop: 3, background: t.accent + '10'
      }} />
      <span style={{ fontSize: 14, color: t.text, lineHeight: 1.7, fontWeight: 500 }}>{children}</span>
    </div>
  );
}
function StepBullet({ step, children, t }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
      <span style={{
        fontSize: 12.5, fontWeight: 800, color: t.accent, flexShrink: 0,
        marginTop: 1, fontFamily: t.mono ? 'monospace' : 'inherit', letterSpacing: -0.3
      }}>Step{step}.</span>
      <span style={{ fontSize: 14, color: t.text, lineHeight: 1.7 }}>{children}</span>
    </div>
  );
}
function ArrowBullet({ children, t }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 11, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 13, color: t.accent, flexShrink: 0, marginTop: 1, fontWeight: 800 }}>{'▸'}</span>
      <span style={{ fontSize: 13.5, color: t.text, lineHeight: 1.65 }}>{children}</span>
    </div>
  );
}
function Pill({ children, t }) {
  return <span style={{
    fontSize: 11.5, padding: '5px 13px', background: t.badge, border: `1px solid ${t.div}`,
    borderRadius: 16, color: t.text, fontWeight: 600, whiteSpace: 'nowrap'
  }}>{children}</span>;
}
function MetricCard({ label, value, t }) {
  return <div style={{
    flex: 1, padding: '16px 20px', background: t.resBg, borderRadius: 10,
    border: `1px solid ${t.resBd}`, minWidth: 0
  }}>
    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: t.sub, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 900, color: t.accent, lineHeight: 1.1 }}>{value}</div>
  </div>;
}
function BarCompare({ before, after, t }) {
  const pn = v => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
  const bV = pn(before), aV = pn(after), mx = Math.max(bV, aV, 1);
  return <div style={{ marginTop: 8 }}>
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: t.sub, fontWeight: 700 }}>AS-IS</span>
        <span style={{ fontSize: 9, color: t.sub }}>{strip(String(before))}</span>
      </div>
      <div style={{ height: 8, background: t.div + '55', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(bV / mx * 100, 100)}%`, background: t.sub, borderRadius: 4 }} />
      </div>
    </div>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: t.accent, fontWeight: 700 }}>TO-BE</span>
        <span style={{ fontSize: 9, color: t.accent, fontWeight: 800 }}>{strip(String(after))}</span>
      </div>
      <div style={{ height: 10, background: t.div + '55', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(aV / mx * 100, 100)}%`, background: t.accent, borderRadius: 5 }} />
      </div>
    </div>
  </div>;
}

/* ─── 1. COVER (ref: image 6 style - clean personal intro) ─── */
function CoverSlide({ p, t, theme }) {
  const c = p.contact || {};
  const contacts = [c.email, c.phone, c.github, c.instagram ? '@' + c.instagram.replace('@', '') : ''].filter(Boolean);
  const vals = (p.values || []).slice(0, 5).map(v => v.keyword || String(v));
  return (
    <Slide t={t} bg={t.coverBg}>
      {t.dark && <>
        <div style={{
          position: 'absolute', top: -100, left: -60, width: 320, height: 320, borderRadius: '50%',
          background: `radial-gradient(circle, ${t.accent}20, transparent 65%)`
        }} />
        <div style={{
          position: 'absolute', bottom: -100, right: -60, width: 280, height: 280, borderRadius: '50%',
          background: `radial-gradient(circle, ${t.div}50, transparent 65%)`
        }} />
      </>}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 5, height: '100%', background: t.accent }} />
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 100px' }}>
        <div style={{ display: 'flex', gap: 60, alignItems: 'center', width: '100%' }}>
          {/* Left: Avatar + Name */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%', marginBottom: 20,
              background: `linear-gradient(135deg, ${t.accent}50, ${t.div}80)`,
              border: `3px solid ${t.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: t.accent, opacity: 0.8 }}>
                {(p.userName || '?').trim()[0]}
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, letterSpacing: 0.5, marginBottom: 10 }}>
              {p.targetPosition || 'Portfolio'}
            </div>
            <div style={{ fontSize: 52, fontWeight: 900, color: t.text, letterSpacing: '0.12em', lineHeight: 1.1, marginBottom: 16 }}>
              {nameSpaced(p.userName || '이름')}
            </div>
            {vals.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {vals.map((v, i) => <span key={i} style={{ fontSize: 11, color: t.sub, fontWeight: 500 }}>{'#' + v}</span>)}
              </div>
            )}
          </div>
          {/* Right: Tagline + Contact */}
          <div style={{ flex: 1 }}>
            {p.headline && (
              <div style={{
                padding: '20px 24px', background: t.dark ? 'rgba(255,255,255,0.05)' : t.card,
                borderLeft: `3px solid ${t.accent}`, borderRadius: '0 12px 12px 0', marginBottom: 24,
                border: `1px solid ${t.div}`, borderLeftColor: t.accent
              }}>
                <p style={{ fontSize: 16, color: t.text, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
                  {shorten(p.headline, 100)}
                </p>
              </div>
            )}
            {contacts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {contacts.map((l, i) => <span key={i} style={{
                  fontSize: 11, color: t.sub,
                  fontFamily: t.mono ? 'monospace' : 'inherit'
                }}>{l}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* ─── 2. PROFILE — 데이터 밀도 적응형 레이아웃 ─── */
function ProfileSlide({ p, t }) {
  const edu = (p.education || []).slice(0, 4);
  const sk = p.skills || {};
  const langs = [...(sk.languages || []), ...(sk.frameworks || [])].map(s => typeof s === 'string' ? s : s?.name).filter(Boolean).slice(0, 14);
  const tools = (sk.tools || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean).slice(0, 10);
  const exps = (p.experiences || []).slice(0, 4);
  const awards = (p.awards || []).slice(0, 4);
  // 컨텐츠 양에 따라 폰트·여백 스케일 결정 (적을수록 시원하게)
  const density = edu.length + exps.length + awards.length;
  const scale = density <= 2 ? 1.25 : density <= 4 ? 1.1 : 1;
  const s = (n) => Math.round(n * scale);
  const eduCardPad = scale > 1.15 ? '18px 22px' : '14px 18px';
  const expCardPad = scale > 1.15 ? '16px 20px' : '14px 16px';
  return (
    <Slide t={t}>
      <div style={{ padding: '44px 60px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 24 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 4, color: t.sub, textTransform: 'uppercase', flexShrink: 0 }}>PROFILE</span>
          <div style={{ flex: 1, height: 1, background: t.div }} />
          <span style={{ fontSize: 11, color: t.sub, fontWeight: 500, whiteSpace: 'nowrap' }}>{p.userName || ''}{p.targetPosition ? ' · ' + p.targetPosition : ''}</span>
        </div>
        {p.headline && (
          <div style={{ padding: '14px 18px', background: t.card, borderLeft: `4px solid ${t.accent}`, borderRadius: '0 10px 10px 0', marginBottom: 22, border: `1px solid ${t.div}`, borderLeftColor: t.accent }}>
            <div style={{ fontSize: s(14), color: t.text, lineHeight: 1.6, fontWeight: 500 }}>{shorten(p.headline, 140)}</div>
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', gap: 36, minHeight: 0 }}>
          {/* Left 40% */}
          <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
            {edu.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <SectionBold t={t} size={s(14)}>Education</SectionBold>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {edu.map((e, i) => (
                    <div key={i} style={{ padding: eduCardPad, background: t.card, borderRadius: 10, border: `1px solid ${t.div}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: s(15), fontWeight: 800, color: t.text, lineHeight: 1.3 }}>{e.name}</span>
                        {e.period && <span style={{ fontSize: s(10), color: t.sub, flexShrink: 0, fontWeight: 500 }}>{e.period}</span>}
                      </div>
                      {e.degree && <div style={{ fontSize: s(12), color: t.sub, marginTop: 6, lineHeight: 1.4 }}>{e.degree}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {langs.length > 0 && (
              <div>
                <SectionBold t={t} size={s(14)}>Tech Stack</SectionBold>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {langs.map((sv, i) => <Pill key={i} t={t}>{sv}</Pill>)}
                </div>
              </div>
            )}
            {langs.length === 0 && tools.length > 0 && (
              <div>
                <SectionBold t={t} size={s(14)}>Tools</SectionBold>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tools.map((sv, i) => <Pill key={i} t={t}>{sv}</Pill>)}
                </div>
              </div>
            )}
            {/* 빈 공간 흡수용 Bio/Values */}
            {(edu.length <= 1 || !langs.length) && (p.values || []).length > 0 && (
              <div style={{ marginTop: 'auto' }}>
                <SectionBold t={t} size={s(13)}>Core Values</SectionBold>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(p.values || []).slice(0, 6).map((v, i) => <Pill key={i} t={t}>{v.keyword || String(v)}</Pill>)}
                </div>
              </div>
            )}
          </div>
          <div style={{ width: 1, background: t.div, flexShrink: 0 }} />
          {/* Right 60% */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
            {exps.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: exps.length <= 2 ? 1 : 'none', minHeight: 0 }}>
                <SectionBold t={t} size={s(14)}>Work Experience</SectionBold>
                <div style={{ display: 'flex', flexDirection: 'column', gap: exps.length <= 2 ? 14 : 8, flex: exps.length <= 2 ? 1 : 'none' }}>
                  {exps.map((e, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 16, padding: expCardPad, background: t.card, borderRadius: 10,
                      border: `1px solid ${t.div}`, flex: exps.length <= 2 ? 1 : 'none'
                    }}>
                      <div style={{
                        width: s(44), height: s(44), borderRadius: 10, flexShrink: 0,
                        background: `linear-gradient(135deg,${t.accent}35,${t.div}80)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: s(18), fontWeight: 900, color: t.accent }}>
                          {(e.organization || e.title || '?').trim()[0]}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ fontSize: s(15), fontWeight: 800, color: t.text, lineHeight: 1.3 }}>{e.organization || shorten(e.title, 24)}</span>
                          {e.date && <span style={{ fontSize: s(10), color: t.sub, flexShrink: 0, fontWeight: 500 }}>{e.date}</span>}
                        </div>
                        {e.role && <div style={{ fontSize: s(12), color: t.accent, fontWeight: 700, marginTop: 4 }}>{e.role}</div>}
                        {e.description && <div style={{
                          fontSize: s(11), color: t.sub, marginTop: 6, lineHeight: 1.5,
                          display: '-webkit-box', WebkitLineClamp: exps.length <= 2 ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                        }}>
                          {strip(e.description)}
                        </div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {awards.length > 0 && (
              <div style={{ marginTop: exps.length > 2 ? 'auto' : 0 }}>
                <SectionBold t={t} size={s(14)}>Awards &amp; Certifications</SectionBold>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {awards.map((a, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', borderBottom: `1px solid ${t.div}55`
                    }}>
                      <span style={{ fontSize: s(13), fontWeight: 700, color: t.text }}>{a.title}</span>
                      {a.date && <span style={{ fontSize: s(11), color: t.sub }}>{a.date}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {exps.length === 0 && awards.length === 0 && tools.length > 0 && (
              <div>
                <SectionBold t={t} size={s(14)}>Tools &amp; Platforms</SectionBold>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tools.map((sv, i) => <Pill key={i} t={t}>{sv}</Pill>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* ─── 3. SKILLS (ref: image 8 — 3 rows with icon+category+description) ─── */
function SkillsSlide({ p, t }) {
  const sk = p.skills || {};
  const rows = [];
  const langs = [...(sk.languages || []), ...(sk.frameworks || [])].map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
  const tools = (sk.tools || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
  const others = (sk.others || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
  const vals = (p.values || []).slice(0, 3);
  if (langs.length > 0) rows.push({ emoji: '💻', name: 'Technical Skills', items: langs.slice(0, 8) });
  if (tools.length > 0) rows.push({ emoji: '🛠️', name: 'Tools & Platforms', items: tools.slice(0, 8) });
  if (others.length > 0) rows.push({ emoji: '✨', name: 'Other Skills', items: others.slice(0, 8) });
  if (vals.length > 0 && rows.length < 3) rows.push({ emoji: '🎯', name: 'Core Competency', items: vals.map(v => v.keyword || String(v)) });
  const show = rows.slice(0, 3);
  if (show.length === 0) return null;
  return (
    <Slide t={t}>
      <div style={{ padding: '40px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <SectionLabel t={t}>SKILLS</SectionLabel>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 8 }}>
          {show.map((row, i) => (
            <div key={i} style={{
              display: 'flex', gap: 32, alignItems: 'center',
              padding: '18px 24px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`
            }}>
              {/* Icon circle */}
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg,${t.accent}30,${t.div}60)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
              }}>
                {row.emoji}
              </div>
              {/* Category name */}
              <div style={{ flex: '0 0 180px' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: t.accent, letterSpacing: -0.3 }}>{row.name}</div>
              </div>
              {/* Horizontal divider */}
              <div style={{ width: 1, height: 40, background: t.div, flexShrink: 0 }} />
              {/* Items */}
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {row.items.map((item, j) => <Pill key={j} t={t}>{item}</Pill>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/* ─── 4. SECTION DIVIDER (ref: image 3 — cinematic dark + gradient blobs) ─── */
function SectionDivider({ exp, idx, t }) {
  const darkBg = '#0a0a0f';
  const ac = t.accent;
  return (
    <Slide t={t} bg={darkBg}>
      <div style={{
        position: 'absolute', top: -80, left: -40, width: 300, height: 300, borderRadius: '50%',
        background: `radial-gradient(circle, ${ac}35, transparent 70%)`
      }} />
      <div style={{
        position: 'absolute', bottom: -80, right: -40, width: 280, height: 280, borderRadius: '50%',
        background: `radial-gradient(circle, #1a4a4a60, transparent 70%)`
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        opacity: 0.06, fontSize: 200, fontWeight: 900, color: '#ffffff', letterSpacing: '-10px',
        whiteSpace: 'nowrap', userSelect: 'none'
      }}>
        {String(idx + 1).padStart(2, '0')}
      </div>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 100px', position: 'relative'
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 4, color: ac, textTransform: 'uppercase', marginBottom: 16 }}>
          {'PROJECT ' + String(idx + 1).padStart(2, '0')}
        </div>
        <div style={{ fontSize: 54, fontWeight: 900, color: '#ffffff', letterSpacing: -2, lineHeight: 1.1, maxWidth: 700 }}>
          {exp.title || '프로젝트'}
        </div>
        {exp.role && (
          <div style={{ marginTop: 20, fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
            {exp.role}{exp.date ? ' · ' + exp.date : ''}
          </div>
        )}
      </div>
    </Slide>
  );
}

/* ─── 5. SITUATION SLIDES — 레이아웃별 구현 ─── */

/* 5a. Default: 2컬럼 카드 */
function SituationDefaultSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <ProjectLabel num={num} category="CAREER" t={t} />
        <SlideTitle t={t} size={26}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, padding: '22px 26px', background: t.card, borderRadius: 14, border: `1px solid ${t.div}`, display: 'flex', gap: 24, overflow: 'hidden' }}>
          {spBullets.length > 0 && <div style={{ flex: 1, overflow: 'hidden' }}>
            <SectionBold t={t} size={14}>Situation &amp; Problem</SectionBold>
            {spBullets.map((b, i) => <CheckBullet key={i} t={t}>{b}</CheckBullet>)}
            {(exp.role || f.aiSummary) && <div style={{ marginTop: 12, padding: '10px 14px', background: t.step, borderRadius: 8, borderLeft: `3px solid ${t.accent}` }}>
              <p style={{ fontSize: 11, color: t.sub, margin: 0, lineHeight: 1.6 }}>{shorten(exp.role ? exp.role + (exp.date ? ' · ' + exp.date : '') : f.aiSummary, 130)}</p>
            </div>}
          </div>}
          {spBullets.length > 0 && solBullets.length > 0 && <div style={{ width: 1, background: t.div, flexShrink: 0 }} />}
          {solBullets.length > 0 && <div style={{ flex: 1, overflow: 'hidden' }}>
            <SectionBold t={t} size={14}>Solution</SectionBold>
            {solBullets.map((b, i) => <StepBullet key={i} step={i + 1} t={t}>{b}</StepBullet>)}
          </div>}
        </div>
      </div>
    </Slide>
  );
}

/* 5b. Tech: Problem | Approach + context bar */
function SituationTechSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 4).slice(0, 4);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px 20px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProjectLabel num={num} category="TECHNICAL" t={t} />
        <SlideTitle t={t} size={24}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          {/* Problem card */}
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>PROBLEM</span>
              <div style={{ flex: 1, height: 1, background: t.div }} />
            </div>
            {spBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent + '80', flexShrink: 0, marginTop: 6 }} />
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          {/* Approach card */}
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>APPROACH</span>
              <div style={{ flex: 1, height: 1, background: t.div }} />
            </div>
            {solBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 24, height: 24, borderRadius: 6, background: t.accent + '28',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: t.accent
                }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Context bar */}
        <div style={{ padding: '10px 18px', background: t.step, borderRadius: 8, border: `1px solid ${t.div}55`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 2, color: t.accent, textTransform: 'uppercase', flexShrink: 0 }}>CONTEXT</span>
          <span style={{ fontSize: 11, color: t.sub, lineHeight: 1.5 }}>{shorten(f.aiSummary || exp.description || exp.role || '', 160)}</span>
        </div>
      </div>
    </Slide>
  );
}

/* 5c. Story (마케터): Hero hook + Background | Challenge&Action */
function SituationStorySlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const bgBullets = toBullets(f.overview || f.description || f.task, 3).slice(0, 3);
  const actBullets = toBullets(f.process || f.intro || f.task, 3).slice(0, 3);
  const hook = shorten(f.aiSummary || f.task || f.description || exp.title || '', 110);
  const tags = ['CHALLENGE', 'ACTION', 'APPROACH'];
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="CAMPAIGN" t={t} />
        {/* Hero hook */}
        <div style={{ padding: '14px 20px', background: t.card, borderRadius: 10, border: `1px solid ${t.div}`, borderLeft: `4px solid ${t.accent}` }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.6 }}>{hook}</p>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          {/* Background */}
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>BACKGROUND</span>
              <div style={{ flex: 1, height: 1, background: t.div }} />
            </div>
            {bgBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, color: t.accent, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>·</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          {/* Challenge & Action */}
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>CHALLENGE &amp; ACTION</span>
              <div style={{ flex: 1, height: 1, background: t.div }} />
            </div>
            {actBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, padding: '2px 8px', borderRadius: 6, fontSize: 8, fontWeight: 800, color: '#fff',
                  background: t.accent + (i === 0 ? 'EE' : i === 1 ? '99' : '55'), whiteSpace: 'nowrap'
                }}>{tags[i]}</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 5d. Consult / STAR: 4-quadrant */
function SituationConsultSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const quads = [
    { k: 'S', name: 'Situation', src: f.overview || f.description || f.task || '' },
    { k: 'T', name: 'Task', src: f.task || f.process || '' },
    { k: 'A', name: 'Action', src: f.process || f.intro || '' },
    { k: 'R', name: 'Result', src: f.output || f.growth || f.aiSummary || '' },
  ];
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 52px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProjectLabel num={num} category="S·T·A·R" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 12, minHeight: 0 }}>
          {quads.map(({ k, name, src }, i) => {
            const bullets = toBullets(src, 2).slice(0, 2);
            return (
              <div key={i} style={{ padding: '16px 20px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden', position: 'relative' }}>
                {/* Ghost letter */}
                <span style={{ position: 'absolute', right: 16, bottom: 8, fontSize: 64, fontWeight: 900, color: t.accent, opacity: 0.08, lineHeight: 1, userSelect: 'none' }}>{k}</span>
                {/* Badge + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 7, background: t.accent, color: '#fff',
                    fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>{k}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: t.accent, letterSpacing: 2, textTransform: 'uppercase' }}>{name}</span>
                </div>
                <div style={{ height: 1, background: t.div, marginBottom: 12 }} />
                {bullets.length > 0 ? bullets.map((b, j) => (
                  <div key={j} style={{
                    fontSize: 13, color: t.text, lineHeight: 1.6, marginBottom: 6,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}>{b}</div>
                )) : (
                  <div style={{
                    fontSize: 12.5, color: t.text, lineHeight: 1.6,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}>{shorten(src, 100)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Slide>
  );
}

/* 5e. Design: Process bar + User Problem | Design Solution */
function SituationDesignSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const probBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  const steps = ['Research', 'Define', 'Design', 'Deliver'];
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="DESIGN" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        {/* Process bar */}
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.map((s, i) => {
            const active = i === 1 || i === 2;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={{
                  flex: 1, padding: '6px 10px', background: active ? t.accent + '30' : t.card,
                  border: `1px solid ${active ? t.accent + '80' : t.div}`, borderRadius: 6, textAlign: 'center'
                }}>
                  <span style={{ fontSize: 10, fontWeight: active ? 800 : 500, color: active ? t.accent : t.sub }}>{s}</span>
                </div>
                {i < 3 && <span style={{ fontSize: 12, color: t.accent, fontWeight: 700 }}>›</span>}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>USER PROBLEM</span>
              <div style={{ flex: 1, height: 1, background: t.div }} />
            </div>
            {probBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: t.accent + '30', flexShrink: 0, marginTop: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent }} />
                </div>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>DESIGN SOLUTION</span>
              <div style={{ flex: 1, height: 1, background: t.div }} />
            </div>
            {solBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: t.accent + '28',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: t.accent
                }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 5f. Dashboard: KPI Overview strip + full-width analysis */
function SituationDashboardSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  const metrics = kx.length > 0 ? kx : [{ title: '목표', metric: '-' }, { title: '과제', metric: '-' }, { title: '범위', metric: '-' }];
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProjectLabel num={num} category="DATA OVERVIEW" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        {/* KPI strip */}
        <div style={{ display: 'flex', gap: 10 }}>
          {metrics.slice(0, 3).map((m, i) => (
            <div key={i} style={{
              flex: 1, padding: '10px 16px', background: t.resBg || t.card, borderRadius: 8,
              border: `1px solid ${t.resBd || t.div}`, textAlign: 'center'
            }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: t.sub, textTransform: 'uppercase', marginBottom: 4 }}>{shorten(m.title || 'KPI', 18)}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: t.accent, lineHeight: 1.1 }}>{shorten(String(m.metric) || '-', 12)}</div>
            </div>
          ))}
        </div>
        {/* Full-width analysis */}
        <div style={{ flex: 1, display: 'flex', gap: 0, background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
          {/* Left: Data-problem */}
          <div style={{ flex: 1, padding: '18px 22px', borderRight: `1px solid ${t.div}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>HYPOTHESIS</span>
            </div>
            {spBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, color: t.accent, fontWeight: 300, flexShrink: 0, lineHeight: 1, marginTop: -2 }}>{'{'}</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          {/* Right: Analysis approach */}
          <div style={{ flex: 1, padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>ANALYSIS</span>
            </div>
            {solBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: t.accent, flexShrink: 0,
                  fontFamily: 'monospace', opacity: 0.7, marginTop: 2
                }}>{'0' + (i + 1)}</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 5g. Funnel: Vertical funnel stages + actions */
function SituationFunnelSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const allBullets = [
    ...toBullets(f.task || f.overview || f.description, 2).slice(0, 2),
    ...toBullets(f.process || f.intro, 2).slice(0, 2),
  ].slice(0, 4);
  const stages = ['인지', '분석', '실행', '최적화'];
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="STRATEGY" t={t} />
        <SlideTitle t={t} size={24}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, display: 'flex', gap: 24, minHeight: 0 }}>
          {/* Left: Funnel visual */}
          <div style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
            {stages.map((s, i) => {
              const w = 200 - i * 30;
              return (
                <div key={i} style={{
                  width: w, height: 48, margin: '0 auto', background: t.accent + (i === 0 ? '18' : i === 1 ? '30' : i === 2 ? '50' : '80'),
                  borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${t.accent}${i === 3 ? 'AA' : '44'}`
                }}>
                  <span style={{ fontSize: 11, fontWeight: i === 3 ? 800 : 600, color: i >= 2 ? t.accent : t.sub, letterSpacing: 1 }}>{s}</span>
                </div>
              );
            })}
          </div>
          {/* Right: Detail cards */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '14px 20px', background: t.card, borderRadius: 10,
                border: `1px solid ${t.div}`, borderLeft: `3px solid ${t.accent}`,
                display: 'flex', alignItems: 'center', gap: 14
              }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: t.accent, opacity: 0.3, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
            {(exp.role || f.aiSummary) && (
              <div style={{ padding: '10px 16px', background: t.step, borderRadius: 8, border: `1px solid ${t.div}55` }}>
                <span style={{ fontSize: 11, color: t.sub, lineHeight: 1.5 }}>{shorten(exp.role ? exp.role + (exp.date ? ' · ' + exp.date : '') : f.aiSummary, 160)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 5h. T-Shape: Breadth bar + deep-dive */
function SituationTshapeSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  const tags = (exp.tags || exp.skills || []).slice(0, 5).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProjectLabel num={num} category="MULTI-SKILL" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        {/* Breadth bar */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 16px', background: t.card, borderRadius: 8, border: `1px solid ${t.div}`, alignItems: 'center' }}>
          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', flexShrink: 0 }}>BREADTH</span>
          <div style={{ width: 1, height: 20, background: t.div, margin: '0 8px', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tags.length > 0 ? tags.map((tg, i) => <Pill key={i} t={t}>{tg}</Pill>) :
              <span style={{ fontSize: 11, color: t.sub }}>다양한 영역에 걸친 경험</span>}
          </div>
        </div>
        {/* Depth: 2-col cards */}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{
            flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`,
            borderTop: `3px solid ${t.accent}`, overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>DEPTH: CHALLENGE</span>
            </div>
            {spBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 3, height: '100%', minHeight: 16, background: t.accent, borderRadius: 2, flexShrink: 0, marginTop: 4 }} />
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{
            flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`,
            borderTop: `3px solid ${t.accent}`, overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>DEPTH: SOLUTION</span>
            </div>
            {solBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: t.accent, flexShrink: 0, marginTop: 2,
                  width: 22, height: 22, borderRadius: '50%', background: t.accent + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 5i. Growth (신입): Challenge → Learning → Application journey */
function SituationGrowthSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const challengeB = toBullets(f.task || f.overview || f.description, 2).slice(0, 2);
  const learningB = toBullets(f.process || f.intro, 2).slice(0, 2);
  const applyB = toBullets(f.output || f.growth || f.competency, 2).slice(0, 2);
  const phases = [
    { label: 'CHALLENGE', icon: '⚡', bullets: challengeB },
    { label: 'LEARNING', icon: '📚', bullets: learningB },
    { label: 'APPLICATION', icon: '🚀', bullets: applyB },
  ];
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="GROWTH JOURNEY" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {phases.map((ph, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ flex: 1, height: 4, background: i === 0 ? t.accent : t.accent + '50', borderRadius: 2 }} />
              {i < 2 && <span style={{ fontSize: 14, color: t.accent, fontWeight: 700, margin: '0 4px' }}>{'→'}</span>}
            </div>
          ))}
        </div>
        {/* 3-column cards */}
        <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
          {phases.map((ph, i) => (
            <div key={i} style={{
              flex: 1, padding: '16px 18px', background: t.card, borderRadius: 12,
              border: `1px solid ${t.div}`, overflow: 'hidden', display: 'flex', flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>{ph.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color: t.accent, textTransform: 'uppercase' }}>{ph.label}</span>
              </div>
              <div style={{ height: 1, background: t.div, marginBottom: 12 }} />
              {ph.bullets.map((b, j) => (
                <div key={j} style={{
                  fontSize: 12.5, color: t.text, lineHeight: 1.6, marginBottom: 8,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>{b}</div>
              ))}
              {ph.bullets.length === 0 && (
                <div style={{ fontSize: 12, color: t.sub, fontStyle: 'italic' }}>내용 없음</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/* 5j. Framework (STAR 전략형): Horizontal STAR flow strip */
function SituationFrameworkSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const steps = [
    { k: 'S', label: 'Situation', text: shorten(f.overview || f.description || f.task || '', 90) },
    { k: 'T', label: 'Task', text: shorten(f.task || f.process || '', 90) },
    { k: 'A', label: 'Action', text: shorten(f.process || f.intro || '', 90) },
    { k: 'R', label: 'Result', text: shorten(f.output || f.growth || f.aiSummary || '', 90) },
  ];
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="STAR FRAMEWORK" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        {/* Horizontal STAR flow */}
        <div style={{ flex: 1, display: 'flex', gap: 8, minHeight: 0 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'stretch', flex: 1, gap: 8 }}>
              <div style={{
                flex: 1, background: t.card, borderRadius: 12, border: `1px solid ${t.div}`,
                overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative'
              }}>
                {/* Top colored strip */}
                <div style={{ height: 4, background: t.accent, opacity: 0.3 + i * 0.2 }} />
                <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: 8, background: t.accent, color: '#fff',
                      fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>{s.k}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: t.accent, letterSpacing: 2, textTransform: 'uppercase' }}>{s.label}</span>
                  </div>
                  <div style={{ height: 1, background: t.div, marginBottom: 12 }} />
                  <div style={{
                    fontSize: 12.5, color: t.text, lineHeight: 1.65, flex: 1,
                    display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}>{s.text || '-'}</div>
                </div>
                {/* Ghost letter */}
                <span style={{
                  position: 'absolute', right: 12, bottom: 8, fontSize: 48, fontWeight: 900, color: t.accent,
                  opacity: 0.06, lineHeight: 1, userSelect: 'none'
                }}>{s.k}</span>
              </div>
              {i < 3 && <span style={{ display: 'flex', alignItems: 'center', fontSize: 16, color: t.accent, fontWeight: 700 }}>{'›'}</span>}
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/* 5k. Cyber: Terminal command log style */
function SituationCyberSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  const ps1 = `> ${(exp.title || 'PROJECT').toUpperCase().slice(0, 20)}`;
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProjectLabel num={num} category="SYS.LOG" t={t} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
          background: '#000000', borderRadius: '8px 8px 0 0', border: `1px solid ${t.div}`
        }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
          <span style={{ fontSize: 10, color: '#888', fontFamily: 'monospace', marginLeft: 8 }}>{ps1}</span>
        </div>
        <div style={{
          flex: 1, padding: '20px 24px', background: '#080808', borderRadius: '0 0 12px 12px',
          border: `1px solid ${t.div}`, borderTop: 'none', fontFamily: 'monospace', display: 'flex', gap: 24
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: t.accent, letterSpacing: 2, marginBottom: 12 }}>$ PROBLEM_DEFINITION --scan</div>
            {spBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{ color: t.accent, flexShrink: 0, fontWeight: 700 }}>{'[!' + (i + 1) + ']'}</span>
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
            {(exp.role || f.aiSummary) && <div style={{
              marginTop: 12, padding: '8px 12px', background: '#111', borderRadius: 6,
              border: `1px solid ${t.div}55`, fontSize: 10, color: t.sub, lineHeight: 1.5
            }}>
              {'// ' + shorten(exp.role || f.aiSummary, 120)}</div>}
          </div>
          <div style={{ width: 1, background: t.div + '50', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: t.accent, letterSpacing: 2, marginBottom: 12 }}>$ SOLUTION_INIT --execute</div>
            {solBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#28c840', flexShrink: 0, fontWeight: 700 }}>{'> S' + String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function SituationForestSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ProjectLabel num={num} category="INITIATIVE" t={t} />
        <SlideTitle t={t} size={24}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, display: 'flex', gap: 20, minHeight: 0 }}>
          <div style={{
            flex: 1, padding: '20px 24px', background: t.card, borderRadius: 16,
            border: `2px solid ${t.accent}30`, borderLeft: `4px solid ${t.accent}`, overflow: 'hidden'
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 14 }}>🌱 WHY</div>
            {spBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, color: t.accent, flexShrink: 0, lineHeight: 1 }}>·</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 20, color: t.accent }}>→</span>
          </div>
          <div style={{
            flex: 1, padding: '20px 24px', background: t.card, borderRadius: 16,
            border: `2px solid ${t.accent}30`, overflow: 'hidden'
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 14 }}>🌿 HOW</div>
            {solBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: 2 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: t.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff'
                  }}>{i + 1}</div>
                  {i < solBullets.length - 1 && <div style={{ width: 2, height: 12, background: t.accent + '40' }} />}
                </div>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65, paddingTop: 2 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function SituationAuroraSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  return (
    <Slide t={t}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: 90,
        background: `linear-gradient(135deg, ${t.accent}30, #7c3aed20, transparent)`,
        borderRadius: '0 0 40% 0'
      }} />
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
        <ProjectLabel num={num} category="DEEP WORK" t={t} />
        <SlideTitle t={t} size={24}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{
            flex: 1, padding: '18px 22px', borderRadius: 12,
            background: `linear-gradient(180deg, ${t.accent}12 0%, ${t.card} 100%)`,
            border: `1px solid ${t.accent}30`, overflow: 'hidden'
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 12 }}>CHALLENGE</div>
            {spBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 11, alignItems: 'flex-start' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${t.accent}80`, flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{
            flex: 1, padding: '18px 22px', borderRadius: 12,
            background: `linear-gradient(180deg, ${t.accent}08 0%, ${t.card} 100%)`,
            border: `1px solid ${t.div}`, overflow: 'hidden'
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 12 }}>APPROACH</div>
            {solBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 11, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, padding: '2px 7px', borderRadius: 4, fontSize: 8, fontWeight: 800,
                  color: t.accent, border: `1px solid ${t.accent}60`, background: t.accent + '15'
                }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function SituationSunsetSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const quote = shorten(f.aiSummary || f.task || f.overview || exp.description || exp.title || '', 100);
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  return (
    <Slide t={t}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 300, height: 300,
        background: `radial-gradient(circle, ${t.accent}18, transparent 70%)`
      }} />
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
        <ProjectLabel num={num} category="STORY" t={t} />
        <div style={{
          padding: '14px 20px 14px 28px', background: t.card, borderRadius: 12,
          borderLeft: `5px solid ${t.accent}`, position: 'relative', overflow: 'hidden'
        }}>
          <span style={{ position: 'absolute', top: -8, left: 12, fontSize: 48, color: t.accent, fontWeight: 900, opacity: 0.15, lineHeight: 1 }}>{'"'}</span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.6, fontStyle: 'italic' }}>{quote}</p>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 12 }}>CONTEXT</div>
            {spBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, flexShrink: 0, marginTop: 5 }} />
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 12 }}>ACTION</div>
            {solBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, background: t.accent + '20', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: t.accent
                }}>{i + 1}</div>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function SituationNavyGoldSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 2).slice(0, 2);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 4, color: t.accent, textTransform: 'uppercase', flexShrink: 0 }}>PROJECT {num}</span>
          <div style={{ flex: 1, height: 1, background: t.div }} />
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 2, color: t.sub, textTransform: 'uppercase', flexShrink: 0 }}>EXECUTIVE BRIEF</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: t.text, letterSpacing: -0.5, lineHeight: 1.1 }}>
          {shorten(exp.title || '프로젝트', 42)}
        </div>
        {(exp.role || exp.date) && <div style={{ fontSize: 12, color: t.accent, fontWeight: 600, letterSpacing: 1, marginTop: -8 }}>
          {exp.role || ''}{exp.date ? ' · ' + exp.date : ''}
        </div>}
        <div style={{ flex: 1, display: 'flex', gap: 0, minHeight: 0 }}>
          <div style={{ flex: '0 0 42%', paddingRight: 24, borderRight: `1px solid ${t.div}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>SITUATION</div>
            {spBullets.map((b, i) => (
              <div key={i} style={{ padding: '12px 16px', background: t.card, borderRadius: 10, border: `1px solid ${t.div}` }}>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 14 }}>ACTION PLAN</div>
            {solBullets.map((b, i) => (
              <div key={i} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                paddingBottom: i < solBullets.length - 1 ? 16 : 0,
                borderLeft: `2px solid ${t.accent}${i === 0 ? 'FF' : '50'}`, paddingLeft: 14
              }}>
                <div style={{ flexShrink: 0, marginLeft: -20, marginTop: 2 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%', background: t.accent,
                    border: `2px solid ${t.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.bg }} />
                  </div>
                </div>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function SituationCoralSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const items = [
    { emoji: '🔍', label: 'WHY', text: shorten(f.task || f.overview || f.description || '', 90) },
    { emoji: '💡', label: 'WHAT', text: shorten(f.process || f.intro || f.aiSummary || '', 90) },
    { emoji: '🚀', label: 'HOW', text: shorten(f.process || f.overview || '', 90) },
  ];
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ProjectLabel num={num} category="PROJECT" t={t} />
        <SlideTitle t={t} size={24}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              flex: 1, padding: '22px 20px', background: t.card, borderRadius: 16,
              border: `2px solid ${i === 0 ? t.accent + '60' : t.div}`, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{item.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>{item.label}</span>
              </div>
              <div style={{ height: 2, borderRadius: 1, background: t.accent, width: 40, opacity: 0.5 }} />
              <p style={{ fontSize: 13, color: t.text, lineHeight: 1.7, margin: 0, flex: 1 }}>{item.text || '-'}</p>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}
function SituationSlateSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ProjectLabel num={num} category="BREAKDOWN" t={t} />
        <SlideTitle t={t} size={24}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...spBullets.map((b, i) => ({ b, type: 'P', i })), ...solBullets.map((b, i) => ({ b, type: 'S', i }))].slice(0, 5).map(({ b, type, i }, j) => (
            <div key={j} style={{
              flex: 1, display: 'flex', gap: 16, alignItems: 'center', padding: '12px 20px',
              background: t.card, borderRadius: 10, border: `1px solid ${t.div}`, overflow: 'hidden'
            }}>
              <div style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: 8,
                background: type === 'P' ? t.accent + '20' : t.accent + '40',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace'
              }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: t.accent }}>{type}{i + 1}</span>
              </div>
              <div style={{ flex: 1, fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</div>
              <div style={{
                flexShrink: 0, fontSize: 10, fontWeight: 700, color: t.sub,
                padding: '3px 10px', background: t.step, borderRadius: 4
              }}>
                {type === 'P' ? 'Problem' : 'Solution'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}
function SituationCherrySlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  return (
    <Slide t={t}>
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%',
        background: `radial-gradient(circle, ${t.accent}20, transparent 70%)`
      }} />
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
        <ProjectLabel num={num} category="EXPERIENCE" t={t} />
        <SlideTitle t={t} size={24}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, display: 'flex', gap: 20, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 2 }}>🌸 과제</div>
            {spBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '14px 18px', background: t.card, borderRadius: 12,
                border: `1px solid ${t.div}`, borderTop: `3px solid ${t.accent}${i === 0 ? 'DD' : '66'}`
              }}>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 2 }}>🌸 실행</div>
            {solBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '14px 18px', background: t.card, borderRadius: 12,
                border: `1px solid ${t.div}`, borderTop: `3px solid ${t.accent}${i === 0 ? 'DD' : '66'}`
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: t.accent, flexShrink: 0 }}>Step {i + 1}</span>
                  <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function SituationCharcoalMintSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const solBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  return (
    <Slide t={t}>
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{
          width: 220, background: `linear-gradient(180deg,${t.accent}20,${t.coverBg})`,
          padding: '44px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 12,
          borderRight: `1px solid ${t.div}`
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>PROJECT {num}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: t.text, lineHeight: 1.2, letterSpacing: -0.5 }}>
            {shorten(exp.title || '프로젝트', 22)}
          </div>
          {exp.role && <div style={{ fontSize: 10, color: t.sub, fontWeight: 600 }}>{exp.role}</div>}
          <div style={{ width: 30, height: 2, background: t.accent, borderRadius: 1 }} />
          <div style={{ fontSize: 10, color: t.sub, lineHeight: 1.5 }}>{shorten(f.aiSummary || exp.description || '', 80)}</div>
        </div>
        <div style={{ flex: 1, padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 12 }}>PROBLEM</div>
            {spBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent, flexShrink: 0, marginTop: 5 }} />
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 12 }}>SOLUTION</div>
            {solBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: t.accent, flexShrink: 0, fontFamily: 'monospace' }}>{'0' + (i + 1)}</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function SituationPastelSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const spBullets = toBullets(f.task || f.overview || f.description, 2).slice(0, 2);
  const solBullets = toBullets(f.process || f.intro, 2).slice(0, 2);
  const colors = [t.accent + '25', t.accent + '18', t.accent + '30', t.accent + '20'];
  const sections = [
    { emoji: '🎯', label: 'Challenge', bullets: spBullets },
    { emoji: '✨', label: 'Approach', bullets: solBullets },
  ];
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="PROJECT" t={t} />
        <SlideTitle t={t} size={24}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          {sections.map((sec, si) => (
            <div key={si} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                background: t.card, borderRadius: 10, border: `1px solid ${t.div}`
              }}>
                <span style={{ fontSize: 18 }}>{sec.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, color: t.accent, textTransform: 'uppercase' }}>{sec.label}</span>
              </div>
              {sec.bullets.map((b, i) => (
                <div key={i} style={{
                  flex: 1, padding: '16px 18px', background: colors[(si * 2 + i) % 4], borderRadius: 14,
                  border: `1.5px solid ${t.accent}30`
                }}>
                  <span style={{ fontSize: 13, color: t.text, lineHeight: 1.7 }}>{b}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, gap: 8 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent, opacity: 0.3 + i * 0.3 }} />
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
              background: t.card, borderRadius: 10, border: `1px solid ${t.div}`
            }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, color: t.accent, textTransform: 'uppercase' }}>Summary</span>
            </div>
            <div style={{
              flex: 1, padding: '16px 18px', background: colors[1], borderRadius: 14,
              border: `1.5px solid ${t.accent}30`
            }}>
              <p style={{ fontSize: 13, color: t.text, lineHeight: 1.7, margin: 0 }}>{shorten(f.aiSummary || exp.description || exp.role || '', 150)}</p>
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}

function SituationSubmissionSlide({ exp, idx, t, f }) {
  const problemBullets = toBullets(f.task || f.overview || f.description, 3).slice(0, 3);
  const actionBullets = toBullets(f.process || f.intro, 3).slice(0, 3);
  const context = shorten(f.aiSummary || exp.description || exp.role || '', 140);
  const rowStyle = { display: 'grid', gridTemplateColumns: '96px 1fr', gap: 16, alignItems: 'start', padding: '14px 0', borderBottom: `1px solid ${t.div}` };
  return (
    <Slide t={t}>
      <div style={{ padding: '40px 58px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <SubmissionHeader
          t={t}
          label={`Case ${String(idx + 1).padStart(2, '0')} / Problem Solving`}
          title={shorten(exp.title || '프로젝트', 48)}
          meta={exp.role ? `${exp.role}${exp.date ? ' · ' + exp.date : ''}` : '문제 정의와 실행 근거'}
        />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 24, minHeight: 0 }}>
          <div style={{ background: t.step, border: `1px solid ${t.div}`, borderRadius: 6, padding: '24px 26px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2.8, color: t.accent, textTransform: 'uppercase', marginBottom: 14 }}>Why This Matters</div>
            <p style={{ fontSize: 17, fontWeight: 800, color: t.text, lineHeight: 1.55, letterSpacing: 0, margin: 0 }}>{context || '기업 관점의 문제를 정의하고, 실행 과정과 결과를 연결해 설명합니다.'}</p>
            <div style={{ marginTop: 'auto', paddingTop: 22 }}>
              <SubmissionBadge t={t}>Role Fit Evidence</SubmissionBadge>
            </div>
          </div>
          <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 6, padding: '22px 28px', overflow: 'hidden' }}>
            <div style={rowStyle}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2.2, color: t.accent, textTransform: 'uppercase' }}>Problem</div>
              <div>{problemBullets.map((b, i) => <div key={i} style={{ fontSize: 13.5, color: t.text, lineHeight: 1.62, marginBottom: 8 }}>{b}</div>)}</div>
            </div>
            <div style={rowStyle}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2.2, color: t.accent, textTransform: 'uppercase' }}>Action</div>
              <div>{actionBullets.map((b, i) => <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 900, color: t.accent, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span><span style={{ fontSize: 13.5, color: t.text, lineHeight: 1.62 }}>{b}</span></div>)}</div>
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2.2, color: t.accent, textTransform: 'uppercase' }}>Decision</div>
              <div style={{ fontSize: 13.5, color: t.text, lineHeight: 1.62 }}>{shorten(f.competency || f.growth || f.output || '지원 직무에 재사용 가능한 판단 기준과 실행 역량을 남겼습니다.', 170)}</div>
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 5. SITUATION — Dispatcher */
function SituationSlide({ exp, idx, t, f, theme }) {
  if (theme === 'accepted_submission') return <SituationSubmissionSlide exp={exp} idx={idx} t={t} f={f} />;
  const layout = getLayout(theme);
  if (layout === 'story') return <SituationStorySlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'consult') return <SituationConsultSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'design') return <SituationDesignSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'dashboard') return <SituationDashboardSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'funnel') return <SituationFunnelSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'tshape') return <SituationTshapeSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'growth') return <SituationGrowthSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'framework') return <SituationFrameworkSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'cyber') return <SituationCyberSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'forest') return <SituationForestSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'aurora') return <SituationAuroraSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'sunset') return <SituationSunsetSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'navygold') return <SituationNavyGoldSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'coral') return <SituationCoralSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'slate') return <SituationSlateSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'cherry') return <SituationCherrySlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'charcoalmint') return <SituationCharcoalMintSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'pastel') return <SituationPastelSlide exp={exp} idx={idx} t={t} f={f} />;
  return <SituationDefaultSlide exp={exp} idx={idx} t={t} f={f} />;
}

/* ─── 6. RESULT SLIDES ─── */

/* 6a. Story Result: Big metric bar + 2-col bullets */
function ResultStorySlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3);
  const growBullets = toBullets(f.growth, 3);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="CAMPAIGN RESULT" t={t} />
        <SlideTitle t={t} size={24}>{shorten(exp.title || '', 40)}</SlideTitle>
        {kx.length > 0 && (
          <div style={{ display: 'flex', gap: 12 }}>
            {kx.slice(0, 3).map((ke, i) => (
              <div key={i} style={{ flex: 1, padding: '14px 20px', background: t.resBg || t.card, borderRadius: 10, border: `1px solid ${t.resBd || t.div}`, textAlign: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: t.sub, textTransform: 'uppercase', marginBottom: 6 }}>{shorten(ke.title || '성과', 22)}</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: t.accent, lineHeight: 1.1 }}>{shorten(String(ke.metric) || '-', 14)}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <SectionBold t={t} size={13}>Campaign Result</SectionBold>
            {outBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
          </div>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <SectionBold t={t} size={13}>Growth &amp; Learning</SectionBold>
            {growBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
            {kx[0]?.beforeMetric && kx[0]?.afterMetric && (
              <div style={{ marginTop: 12 }}>
                <BarCompare before={kx[0].beforeMetric} after={kx[0].afterMetric} t={t} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 6b. Default Result */
function ResultDefaultSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 4);
  const growBullets = toBullets(f.growth, 3);
  const showRight = kx.length > 0;
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <ProjectLabel num={num} category="RESULT" t={t} />
        <SlideTitle t={t} size={26}>{shorten(exp.title || '프로젝트', 40)}</SlideTitle>
        <div style={{ flex: 1, display: 'flex', gap: 24 }}>
          <div style={{
            flex: showRight ? '0 0 55%' : '1', padding: '20px 24px', background: t.card,
            borderRadius: 14, border: `1px solid ${t.div}`, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden'
          }}>
            <SectionBold t={t} size={14}>Key Result</SectionBold>
            {outBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
            {growBullets.length > 0 && <>
              <div style={{ height: 1, background: t.div + '55', margin: '6px 0' }} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.sub, textTransform: 'uppercase', marginBottom: 4 }}>GROWTH</div>
              {growBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
            </>}
            {f.competency && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: t.step, borderRadius: 8, borderLeft: `2px solid ${t.accent}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: t.accent, marginBottom: 4 }}>COMPETENCY</div>
                <p style={{
                  fontSize: 11.5, color: t.text, margin: 0, lineHeight: 1.6,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>{f.competency}</p>
              </div>
            )}
          </div>
          {showRight && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {kx.slice(0, 2).map((ke, i) => <MetricCard key={i} t={t} label={ke.title || ('성과 ' + (i + 1))} value={strip(ke.metric) || '-'} />)}
              </div>
              {kx[0]?.beforeMetric && kx[0]?.afterMetric && (
                <div style={{ padding: '16px 20px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}` }}>
                  <BarCompare before={kx[0].beforeMetric} after={kx[0].afterMetric} t={t} />
                </div>
              )}
              {kx[2] && (
                <div style={{ padding: '14px 18px', background: t.resBg, borderRadius: 12, border: `1px solid ${t.resBd}` }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: t.sub, textTransform: 'uppercase', marginBottom: 6 }}>{kx[2].title || '추가 성과'}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: t.accent }}>{strip(kx[2].metric) || '-'}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Slide>
  );
}

/* 6c. Dashboard Result: KPI grid + data insight */
function ResultDashboardSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 4);
  const outBullets = toBullets(f.output, 3);
  const growBullets = toBullets(f.growth || f.competency, 3);
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProjectLabel num={num} category="DATA RESULT" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 38)}</SlideTitle>
        {/* KPI grid */}
        {kx.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(kx.length, 4)}, 1fr)`, gap: 10 }}>
            {kx.slice(0, 4).map((ke, i) => (
              <div key={i} style={{
                padding: '12px 16px', background: t.resBg || t.card, borderRadius: 10,
                border: `1px solid ${t.resBd || t.div}`, textAlign: 'center'
              }}>
                <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 2, color: t.sub, textTransform: 'uppercase', marginBottom: 6 }}>{shorten(ke.title || 'KPI', 20)}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: t.accent, lineHeight: 1.1 }}>{shorten(String(ke.metric) || '-', 12)}</div>
              </div>
            ))}
          </div>
        )}
        {/* Before/After bar */}
        {kx[0]?.beforeMetric && kx[0]?.afterMetric && (
          <div style={{ padding: '14px 20px', background: t.card, borderRadius: 10, border: `1px solid ${t.div}` }}>
            <BarCompare before={kx[0].beforeMetric} after={kx[0].afterMetric} t={t} />
          </div>
        )}
        {/* 2-col insight */}
        <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
          <div style={{ flex: 1, padding: '16px 20px', background: t.card, borderRadius: 10, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: t.accent, textTransform: 'uppercase' }}>OUTPUT</span>
            </div>
            {outBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
          </div>
          <div style={{ flex: 1, padding: '16px 20px', background: t.card, borderRadius: 10, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: t.accent, textTransform: 'uppercase' }}>INSIGHT</span>
            </div>
            {growBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 6d. Funnel Result: Big impact banner + detail cards */
function ResultFunnelSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3);
  const growBullets = toBullets(f.growth, 3);
  const bigMetric = kx[0] ? strip(kx[0].metric) : '';
  const bigLabel = kx[0] ? shorten(kx[0].title || '핵심 성과', 24) : 'Result';
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="IMPACT" t={t} />
        {/* Big impact banner */}
        <div style={{
          padding: '18px 28px', background: `linear-gradient(135deg, ${t.accent}18, ${t.card})`,
          borderRadius: 14, border: `1px solid ${t.accent}40`, display: 'flex', alignItems: 'center', gap: 24
        }}>
          {bigMetric && <div style={{ fontSize: 44, fontWeight: 900, color: t.accent, lineHeight: 1, flexShrink: 0 }}>{shorten(bigMetric, 14)}</div>}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: t.sub, textTransform: 'uppercase', marginBottom: 4 }}>{bigLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text, lineHeight: 1.2 }}>{shorten(exp.title || '', 40)}</div>
          </div>
          {kx.slice(1, 3).map((ke, i) => (
            <div key={i} style={{ padding: '10px 18px', background: t.resBg, borderRadius: 8, border: `1px solid ${t.resBd}`, textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1.5, color: t.sub, textTransform: 'uppercase', marginBottom: 3 }}>{shorten(ke.title || '', 16)}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: t.accent }}>{shorten(String(ke.metric) || '-', 10)}</div>
            </div>
          ))}
        </div>
        {/* Detail cards */}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <SectionBold t={t} size={13}>Achieved Result</SectionBold>
            {outBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
          </div>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <SectionBold t={t} size={13}>Key Takeaway</SectionBold>
            {growBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
            {kx[0]?.beforeMetric && kx[0]?.afterMetric && (
              <div style={{ marginTop: 12 }}>
                <BarCompare before={kx[0].beforeMetric} after={kx[0].afterMetric} t={t} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 6e. T-Shape Result: 3 horizontal cards */
function ResultTshapeSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3);
  const growBullets = toBullets(f.growth, 3);
  const compBullets = toBullets(f.competency, 2);
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProjectLabel num={num} category="MULTI-IMPACT" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 38)}</SlideTitle>
        {/* Metric strip */}
        {kx.length > 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            {kx.slice(0, 3).map((ke, i) => (
              <div key={i} style={{
                flex: 1, padding: '10px 16px', background: t.resBg, borderRadius: 8,
                border: `1px solid ${t.resBd}`, display: 'flex', alignItems: 'center', gap: 12
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: t.accent, flexShrink: 0 }}>{shorten(String(ke.metric) || '-', 10)}</div>
                <div style={{ fontSize: 9, color: t.sub, fontWeight: 600, lineHeight: 1.3 }}>{shorten(ke.title || '', 22)}</div>
              </div>
            ))}
          </div>
        )}
        {/* 3-column: Output / Growth / Competency */}
        <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
          <div style={{
            flex: 1, padding: '16px 18px', background: t.card, borderRadius: 12,
            border: `1px solid ${t.div}`, borderTop: `3px solid ${t.accent}`, overflow: 'hidden'
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: t.accent, textTransform: 'uppercase' }}>OUTPUT</span>
            <div style={{ height: 1, background: t.div, margin: '8px 0' }} />
            {outBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
          </div>
          <div style={{
            flex: 1, padding: '16px 18px', background: t.card, borderRadius: 12,
            border: `1px solid ${t.div}`, borderTop: `3px solid ${t.accent}`, overflow: 'hidden'
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: t.accent, textTransform: 'uppercase' }}>GROWTH</span>
            <div style={{ height: 1, background: t.div, margin: '8px 0' }} />
            {growBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
          </div>
          <div style={{
            flex: 1, padding: '16px 18px', background: t.card, borderRadius: 12,
            border: `1px solid ${t.div}`, borderTop: `3px solid ${t.accent}`, overflow: 'hidden'
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: t.accent, textTransform: 'uppercase' }}>COMPETENCY</span>
            <div style={{ height: 1, background: t.div, margin: '8px 0' }} />
            {compBullets.length > 0 ? compBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>) :
              growBullets.slice(0, 2).map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 6f. Growth Result: Before/After emphasis + growth metrics */
function ResultGrowthSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3);
  const growBullets = toBullets(f.growth, 3);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="GROWTH RESULT" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 38)}</SlideTitle>
        {/* Growth progress indicators */}
        <div style={{ display: 'flex', gap: 12 }}>
          {kx.slice(0, 3).map((ke, i) => (
            <div key={i} style={{
              flex: 1, padding: '12px 16px', background: t.card, borderRadius: 10,
              border: `1px solid ${t.div}`, position: 'relative', overflow: 'hidden'
            }}>
              {/* progress bar bg */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 3, background: t.div }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: `${Math.min(70 + i * 15, 100)}%`, height: 3, background: t.accent, borderRadius: '0 2px 0 0' }} />
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: t.sub, textTransform: 'uppercase', marginBottom: 4 }}>{shorten(ke.title || '성과', 18)}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: t.accent, lineHeight: 1.1 }}>{shorten(String(ke.metric) || '-', 12)}</div>
            </div>
          ))}
        </div>
        {/* Before/After if available */}
        {kx[0]?.beforeMetric && kx[0]?.afterMetric && (
          <div style={{ padding: '14px 24px', background: t.resBg, borderRadius: 12, border: `1px solid ${t.resBd}`, display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: t.sub, marginBottom: 4 }}>BEFORE</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: t.sub }}>{strip(String(kx[0].beforeMetric))}</div>
            </div>
            <span style={{ fontSize: 24, color: t.accent, fontWeight: 700 }}>→</span>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: t.accent, marginBottom: 4 }}>AFTER</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: t.accent }}>{strip(String(kx[0].afterMetric))}</div>
            </div>
            <div style={{ flex: 1 }} />
            <BarCompare before={kx[0].beforeMetric} after={kx[0].afterMetric} t={t} />
          </div>
        )}
        {/* Result + Growth */}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <SectionBold t={t} size={13}>What I Achieved</SectionBold>
            {outBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
          </div>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <SectionBold t={t} size={13}>What I Learned</SectionBold>
            {growBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
            {f.competency && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: t.step, borderRadius: 6, borderLeft: `2px solid ${t.accent}` }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: t.accent, marginBottom: 3 }}>CORE COMPETENCY</div>
                <p style={{
                  fontSize: 11, color: t.text, margin: 0, lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>{f.competency}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 6g. Framework Result: Big R focus + reflection */
function ResultFrameworkSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 4);
  const growBullets = toBullets(f.growth, 3);
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProjectLabel num={num} category="RESULT FRAMEWORK" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 38)}</SlideTitle>
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          {/* Left: Big R card */}
          <div style={{
            flex: '0 0 55%', padding: '20px 24px', background: t.card, borderRadius: 14,
            border: `1px solid ${t.div}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative'
          }}>
            <span style={{ position: 'absolute', right: 20, top: 10, fontSize: 100, fontWeight: 900, color: t.accent, opacity: 0.05, lineHeight: 1 }}>R</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{
                width: 32, height: 32, borderRadius: 8, background: t.accent, color: '#fff',
                fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>R</span>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: t.accent, textTransform: 'uppercase' }}>RESULT</span>
            </div>
            <div style={{ height: 1, background: t.div, marginBottom: 12 }} />
            {outBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
            {f.competency && (
              <div style={{ marginTop: 'auto', padding: '10px 14px', background: t.step, borderRadius: 8, borderLeft: `2px solid ${t.accent}` }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: t.accent, marginBottom: 3 }}>COMPETENCY</div>
                <p style={{
                  fontSize: 11, color: t.text, margin: 0, lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>{f.competency}</p>
              </div>
            )}
          </div>
          {/* Right: Metrics + Growth */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Metrics */}
            {kx.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {kx.slice(0, 2).map((ke, i) => <MetricCard key={i} t={t} label={ke.title || ('성과 ' + (i + 1))} value={strip(ke.metric) || '-'} />)}
              </div>
            )}
            {kx[0]?.beforeMetric && kx[0]?.afterMetric && (
              <div style={{ padding: '14px 18px', background: t.card, borderRadius: 10, border: `1px solid ${t.div}` }}>
                <BarCompare before={kx[0].beforeMetric} after={kx[0].afterMetric} t={t} />
              </div>
            )}
            {/* Growth & Reflection */}
            <div style={{ flex: 1, padding: '16px 20px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: t.accent, textTransform: 'uppercase' }}>REFLECTION</span>
              </div>
              {growBullets.map((b, i) => <ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* Result slides for new 10 themes */
function ResultCyberSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3).slice(0, 3);
  const growBullets = toBullets(f.growth, 2).slice(0, 2);
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ProjectLabel num={num} category="OUTPUT.LOG" t={t} />
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: t.accent, letterSpacing: 2, marginBottom: 4 }}>{'$ cat results.txt | grep SUCCESS'}</div>
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {kx.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {kx.map((ke, i) => (
                <span key={i} style={{
                  padding: '4px 10px', background: t.accent + '25', color: t.accent,
                  borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', border: `1px solid ${t.accent}50`
                }}>
                  [KEY] {shorten(ke.keyword || ke.title || ke, 20)}
                </span>
              ))}
            </div>}
            {outBullets.map((b, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, padding: '10px 14px', background: '#080808',
                borderRadius: 6, border: `1px solid ${t.accent}30`, fontFamily: 'monospace'
              }}>
                <span style={{ color: '#28c840', flexShrink: 0 }}>{'>> OK' + (i + 1)}</span>
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 9, color: t.accent, letterSpacing: 2, fontFamily: 'monospace' }}>$ growth_log --verbose</div>
            {growBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '12px 16px', background: '#0a0a0a', borderRadius: 8,
                border: `1px solid ${t.div}`, display: 'flex', gap: 10, alignItems: 'flex-start'
              }}>
                <span style={{ color: t.accent, fontFamily: 'monospace', fontSize: 11, flexShrink: 0 }}>+{i + 1}</span>
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
            {f.competency && <div style={{
              padding: '10px 14px', background: t.card, borderRadius: 8,
              border: `1px solid ${t.div}`, fontFamily: 'monospace', fontSize: 10, color: t.sub, lineHeight: 1.5
            }}>
              {'// COMPETENCY: ' + shorten(f.competency, 80)}</div>}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function ResultForestSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3).slice(0, 3);
  const growBullets = toBullets(f.growth, 2).slice(0, 2);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="GROWTH REPORT" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 40)}</SlideTitle>
        {kx.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {kx.map((ke, i) => <Pill key={i} t={t}>{shorten(ke.keyword || ke.title || ke, 18)}</Pill>)}
        </div>}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>🌲 성과</div>
            {outBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, display: 'flex', gap: 10, padding: '12px 16px', background: t.card,
                borderRadius: 12, border: `2px solid ${t.accent}${i === 0 ? '60' : '20'}`, alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{'🍀'}</span>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>🌱 성장</div>
            {growBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '12px 16px', background: t.card, borderRadius: 12,
                border: `1px solid ${t.div}`
              }}>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
            {f.competency && <div style={{
              padding: '12px 16px', background: t.accent + '15', borderRadius: 12,
              border: `1px solid ${t.accent}40`, fontSize: 12, color: t.text, lineHeight: 1.5
            }}>
              <strong style={{ color: t.accent, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>역량</strong>
              {shorten(f.competency, 100)}
            </div>}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function ResultAuroraSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 4);
  const outBullets = toBullets(f.output, 3).slice(0, 3);
  const growBullets = toBullets(f.growth, 2).slice(0, 2);
  return (
    <Slide t={t}>
      <div style={{
        position: 'absolute', bottom: 0, right: 0, width: 280, height: 180,
        background: `radial-gradient(circle, ${t.accent}20, transparent 70%)`
      }} />
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
        <ProjectLabel num={num} category="OUTCOME" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 40)}</SlideTitle>
        {kx.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {kx.map((ke, i) => <Pill key={i} t={t}>{shorten(ke.keyword || ke.title || ke, 18)}</Pill>)}
        </div>}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '12px 18px', background: `linear-gradient(135deg,${t.accent}15,${t.card})`,
                borderRadius: 12, border: `1px solid ${t.accent}30`
              }}>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {growBullets.map((b, i) => (
              <div key={i} style={{ flex: 1, padding: '12px 18px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: t.accent, textTransform: 'uppercase', marginBottom: 6 }}>Growth {i + 1}</div>
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
            {f.competency && <div style={{ flex: 1, padding: '12px 18px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}` }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: t.accent, textTransform: 'uppercase', marginBottom: 6 }}>Competency</div>
              <span style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>{shorten(f.competency, 100)}</span>
            </div>}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function ResultSunsetSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3).slice(0, 3);
  const growBullets = toBullets(f.growth, 2).slice(0, 2);
  const quote = shorten(f.aiSummary || f.output || '', 90);
  return (
    <Slide t={t}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 5, background: t.accent }} />
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="RESULTS" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 40)}</SlideTitle>
        {kx.length > 0 && <div style={{ display: 'flex', gap: 8 }}>
          {kx.map((ke, i) => <Pill key={i} t={t}>{shorten(ke.keyword || ke.title || ke, 18)}</Pill>)}
        </div>}
        {quote && <div style={{
          padding: '10px 18px', background: t.card, borderRadius: 8, borderLeft: `4px solid ${t.accent}`,
          fontSize: 12, fontStyle: 'italic', color: t.text
        }}>{quote}</div>}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '12px 16px', background: t.card, borderRadius: 10,
                border: `1px solid ${t.div}`, display: 'flex', gap: 10, alignItems: 'flex-start'
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 4, background: t.accent, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff'
                }}>{i + 1}</div>
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {growBullets.map((b, i) => (
              <div key={i} style={{ flex: 1, padding: '12px 16px', background: t.card, borderRadius: 10, border: `1px solid ${t.div}` }}>
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function ResultNavyGoldSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3).slice(0, 3);
  const growBullets = toBullets(f.growth, 2).slice(0, 2);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 4, color: t.accent, textTransform: 'uppercase', flexShrink: 0 }}>PROJECT {num} · RESULTS</span>
          <div style={{ flex: 1, height: 1, background: t.div }} />
        </div>
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 40)}</SlideTitle>
        {kx.length > 0 && <div style={{ display: 'flex', gap: 8 }}>
          {kx.map((ke, i) => <Pill key={i} t={t}>{shorten(ke.keyword || ke.title || ke, 18)}</Pill>)}
        </div>}
        <div style={{ flex: 1, display: 'flex', gap: 20, minHeight: 0 }}>
          <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>DELIVERABLES</div>
            {outBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '12px 16px', background: t.card, borderRadius: 10,
                border: `1px solid ${t.div}`, borderLeft: `3px solid ${t.accent}`
              }}>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>LEARNING</div>
            {growBullets.map((b, i) => (
              <div key={i} style={{ flex: 1, padding: '12px 16px', background: t.card, borderRadius: 10, border: `1px solid ${t.div}` }}>
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
            {f.competency && <div style={{
              padding: '12px 16px', background: t.accent + '18', borderRadius: 10,
              border: `1px solid ${t.accent}40`, fontSize: 12, color: t.text, lineHeight: 1.5
            }}>
              <strong style={{ color: t.accent, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>COMPETENCY</strong>
              {shorten(f.competency, 90)}
            </div>}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function ResultCoralSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3).slice(0, 3);
  const growBullets = toBullets(f.growth, 2).slice(0, 2);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="RESULT" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 40)}</SlideTitle>
        {kx.length > 0 && <div style={{ display: 'flex', gap: 8 }}>
          {kx.map((ke, i) => <Pill key={i} t={t}>{shorten(ke.keyword || ke.title || ke, 18)}</Pill>)}
        </div>}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🎉</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>성과</span>
            </div>
            {outBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '14px 18px', background: t.card, borderRadius: 12,
                border: `2px solid ${i === 0 ? t.accent + '80' : t.div}`
              }}>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📈</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>성장</span>
            </div>
            {growBullets.map((b, i) => (
              <div key={i} style={{ flex: 1, padding: '14px 18px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}` }}>
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
            {f.competency && <div style={{
              padding: '12px 16px', background: t.accent + '15', borderRadius: 12,
              border: `1px solid ${t.accent}40`, fontSize: 11, color: t.text, lineHeight: 1.5
            }}>
              <strong style={{ color: t.accent, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>역량</strong>
              {shorten(f.competency, 70)}
            </div>}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function ResultSlateSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 4).slice(0, 4);
  const growBullets = toBullets(f.growth, 1).slice(0, 1);
  return (
    <Slide t={t}>
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="RESULT" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 40)}</SlideTitle>
        {kx.length > 0 && <div style={{ display: 'flex', gap: 8 }}>
          {kx.map((ke, i) => <Pill key={i} t={t}>{shorten(ke.keyword || ke.title || ke, 18)}</Pill>)}
        </div>}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {outBullets.map((b, i) => (
            <div key={i} style={{
              flex: 1, display: 'flex', gap: 16, alignItems: 'center', padding: '12px 20px',
              background: t.card, borderRadius: 10, border: `1px solid ${t.div}`, overflow: 'hidden'
            }}>
              <div style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: t.accent + '30',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace'
              }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: t.accent }}>R{i + 1}</span>
              </div>
              <div style={{ flex: 1, fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</div>
            </div>
          ))}
          {(growBullets[0] || f.competency) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {growBullets[0] && <div style={{
                flex: 1, padding: '12px 16px', background: t.step, borderRadius: 10,
                border: `1px solid ${t.div}`, fontSize: 12, color: t.text, lineHeight: 1.5
              }}>
                <strong style={{ color: t.accent, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Growth</strong>
                {growBullets[0]}
              </div>}
              {f.competency && <div style={{
                flex: 1, padding: '12px 16px', background: t.step, borderRadius: 10,
                border: `1px solid ${t.div}`, fontSize: 12, color: t.text, lineHeight: 1.5
              }}>
                <strong style={{ color: t.accent, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Competency</strong>
                {shorten(f.competency, 80)}
              </div>}
            </div>
          )}
        </div>
      </div>
    </Slide>
  );
}
function ResultCherrySlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3).slice(0, 3);
  const growBullets = toBullets(f.growth, 2).slice(0, 2);
  return (
    <Slide t={t}>
      <div style={{
        position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%',
        background: `radial-gradient(circle, ${t.accent}15, transparent 70%)`
      }} />
      <div style={{ padding: '36px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
        <ProjectLabel num={num} category="RESULT" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 40)}</SlideTitle>
        {kx.length > 0 && <div style={{ display: 'flex', gap: 8 }}>
          {kx.map((ke, i) => <Pill key={i} t={t}>{shorten(ke.keyword || ke.title || ke, 18)}</Pill>)}
        </div>}
        <div style={{ flex: 1, display: 'flex', gap: 20, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 2 }}>🌸 성과</div>
            {outBullets.map((b, i) => (
              <div key={i} style={{
                flex: 1, padding: '14px 18px', background: t.card, borderRadius: 12,
                border: `1px solid ${t.div}`, borderBottom: `3px solid ${t.accent}${i === 0 ? 'DD' : '66'}`
              }}>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 2 }}>🌸 배움</div>
            {growBullets.map((b, i) => (
              <div key={i} style={{ flex: 1, padding: '14px 18px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}` }}>
                <span style={{ fontSize: 12, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
            {f.competency && <div style={{
              padding: '12px 16px', background: t.accent + '15', borderRadius: 12,
              border: `1px solid ${t.accent}40`, fontSize: 11, color: t.text, lineHeight: 1.5
            }}>
              <strong style={{ color: t.accent, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>역량</strong>
              {shorten(f.competency, 70)}
            </div>}
          </div>
        </div>
      </div>
    </Slide>
  );
}
function ResultCharcoalMintSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 3);
  const outBullets = toBullets(f.output, 3).slice(0, 3);
  const growBullets = toBullets(f.growth, 2).slice(0, 2);
  return (
    <Slide t={t}>
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{
          width: 220, background: `linear-gradient(180deg,${t.coverBg},${t.accent}25)`,
          padding: '44px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 12,
          borderRight: `1px solid ${t.div}`
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase' }}>RESULT {num}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: t.text, lineHeight: 1.2 }}>
            {shorten(exp.title || '', 22)}
          </div>
          <div style={{ width: 30, height: 2, background: t.accent, borderRadius: 1 }} />
          {kx.length > 0 && kx.slice(0, 2).map((ke, i) => (
            <div key={i} style={{
              padding: '4px 10px', background: t.accent + '20', borderRadius: 4,
              fontSize: 9, fontWeight: 700, color: t.accent, border: `1px solid ${t.accent}50`
            }}>
              {shorten(ke.keyword || ke.title || ke, 22)}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ flex: 1, padding: '18px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}`, overflow: 'hidden' }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 12 }}>OUTPUT</div>
            {outBullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent, flexShrink: 0, marginTop: 5 }} />
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: '0 0 auto', padding: '14px 22px', background: t.card, borderRadius: 12, border: `1px solid ${t.div}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: t.accent, textTransform: 'uppercase', marginBottom: 8 }}>GROWTH & COMPETENCY</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {growBullets.map((b, i) => (
                <div key={i} style={{ flex: 1, fontSize: 12, color: t.text, lineHeight: 1.5 }}>{b}</div>
              ))}
              {f.competency && <div style={{ flex: 1, fontSize: 11, color: t.sub, lineHeight: 1.5 }}>{shorten(f.competency, 80)}</div>}
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}
function ResultPastelSlide({ exp, idx, t, f }) {
  const num = String(idx + 1).padStart(2, '0');
  const kx = f.keyExperiences.slice(0, 4);
  const outBullets = toBullets(f.output, 3).slice(0, 3);
  const growBullets = toBullets(f.growth, 2).slice(0, 2);
  const colors = [t.accent + '25', t.accent + '18', t.accent + '30', t.accent + '20'];
  return (
    <Slide t={t}>
      <div style={{ padding: '32px 56px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProjectLabel num={num} category="RESULT" t={t} />
        <SlideTitle t={t} size={22}>{shorten(exp.title || '', 40)}</SlideTitle>
        {kx.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {kx.map((ke, i) => <Pill key={i} t={t}>{shorten(ke.keyword || ke.title || ke, 18)}</Pill>)}
        </div>}
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: t.card, borderRadius: 10, border: `1px solid ${t.div}` }}>
              <span style={{ fontSize: 18 }}>🌟</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, color: t.accent, textTransform: 'uppercase' }}>Results</span>
            </div>
            {outBullets.map((b, i) => (
              <div key={i} style={{ flex: 1, padding: '14px 18px', background: colors[i % 4], borderRadius: 14, border: `1.5px solid ${t.accent}30` }}>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.7 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: t.card, borderRadius: 10, border: `1px solid ${t.div}` }}>
              <span style={{ fontSize: 18 }}>🌱</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, color: t.accent, textTransform: 'uppercase' }}>Growth</span>
            </div>
            {growBullets.map((b, i) => (
              <div key={i} style={{ flex: 1, padding: '14px 18px', background: colors[(i + 2) % 4], borderRadius: 14, border: `1.5px solid ${t.accent}30` }}>
                <span style={{ fontSize: 13, color: t.text, lineHeight: 1.7 }}>{b}</span>
              </div>
            ))}
            {f.competency && <div style={{ padding: '14px 18px', background: t.card, borderRadius: 14, border: `1px solid ${t.div}` }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color: t.accent, textTransform: 'uppercase', marginBottom: 6 }}>Competency</div>
              <p style={{ fontSize: 12, color: t.text, lineHeight: 1.6, margin: 0 }}>{shorten(f.competency, 90)}</p>
            </div>}
          </div>
        </div>
      </div>
    </Slide>
  );
}

function ResultSubmissionSlide({ exp, idx, t, f }) {
  const metrics = f.keyExperiences?.length
    ? f.keyExperiences.slice(0, 3)
    : [
        { title: 'Outcome', metric: shorten(f.output || '산출물 완성', 18) },
        { title: 'Learning', metric: shorten(f.growth || '역량 확장', 18) },
        { title: 'Fit', metric: shorten(f.competency || '직무 적합성', 18) },
      ];
  const resultBullets = toBullets(f.output || f.growth || f.aiSummary, 3).slice(0, 3);
  const growthBullets = toBullets(f.growth || f.competency || f.process, 3).slice(0, 3);
  return (
    <Slide t={t}>
      <div style={{ padding: '40px 58px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <SubmissionHeader
          t={t}
          label={`Case ${String(idx + 1).padStart(2, '0')} / Impact`}
          title="결과와 재현 가능한 역량"
          meta={shorten(exp.title || '프로젝트', 44)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {metrics.map((metric, i) => (
            <div key={i} style={{ background: t.resBg, border: `1px solid ${t.resBd}`, borderRadius: 6, padding: '16px 18px', minHeight: 92 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: t.sub, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 9 }}>{shorten(metric.title || metric.keyword || 'Metric', 20)}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: t.accent, lineHeight: 1.15, letterSpacing: 0 }}>{shorten(String(metric.metric || metric.afterMetric || metric.beforeMetric || '-'), 18)}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, minHeight: 0 }}>
          <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 6, padding: '24px 26px' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: t.accent, letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 18 }}>Delivered Result</div>
            {resultBullets.map((b, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: 12, marginBottom: 16 }}>
                <span style={{ width: 26, height: 26, borderRadius: 13, background: t.accent, color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span style={{ fontSize: 14, color: t.text, lineHeight: 1.65 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ background: t.step, border: `1px solid ${t.div}`, borderRadius: 6, padding: '24px 26px' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: t.accent, letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 18 }}>Transferable Value</div>
            {growthBullets.map((b, i) => (
              <div key={i} style={{ padding: '0 0 14px', marginBottom: 14, borderBottom: i < growthBullets.length - 1 ? `1px solid ${t.div}` : 'none' }}>
                <div style={{ fontSize: 14, fontWeight: 850, color: t.text, lineHeight: 1.55 }}>{b}</div>
              </div>
            ))}
            <div style={{ marginTop: 8, padding: '14px 16px', background: t.card, border: `1px solid ${t.div}`, borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 2, color: t.sub, textTransform: 'uppercase', marginBottom: 6 }}>Hiring Signal</div>
              <div style={{ fontSize: 12.5, color: t.text, lineHeight: 1.55 }}>{shorten(f.competency || '입사 후 유사한 문제를 구조화하고 실행까지 끌고 갈 수 있는 근거를 제시합니다.', 120)}</div>
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 6. RESULT — Dispatcher */
function ResultSlide({ exp, idx, t, f, theme }) {
  if (theme === 'accepted_submission') return <ResultSubmissionSlide exp={exp} idx={idx} t={t} f={f} />;
  const layout = getLayout(theme);
  if (layout === 'story') return <ResultStorySlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'dashboard') return <ResultDashboardSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'funnel') return <ResultFunnelSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'tshape') return <ResultTshapeSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'growth') return <ResultGrowthSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'framework') return <ResultFrameworkSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'cyber') return <ResultCyberSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'forest') return <ResultForestSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'aurora') return <ResultAuroraSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'sunset') return <ResultSunsetSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'navygold') return <ResultNavyGoldSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'coral') return <ResultCoralSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'slate') return <ResultSlateSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'cherry') return <ResultCherrySlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'charcoalmint') return <ResultCharcoalMintSlide exp={exp} idx={idx} t={t} f={f} />;
  if (layout === 'pastel') return <ResultPastelSlide exp={exp} idx={idx} t={t} f={f} />;
  return <ResultDefaultSlide exp={exp} idx={idx} t={t} f={f} />;
}

/* ─── 7. OUTRO ─── */
function OutroSlide({ p, t }) {
  const c = p.contact || {};
  const cl = [c.email, c.phone, c.github].filter(Boolean);
  const goals = (p.goals || []).filter(g => g.status !== 'done').slice(0, 3);
  return (
    <Slide t={t} bg={t.coverBg}>
      {t.dark && <>
        <div style={{
          position: 'absolute', top: -100, right: -60, width: 300, height: 300, borderRadius: '50%',
          background: `radial-gradient(circle,${t.accent}20,transparent 65%)`
        }} />
      </>}
      <div style={{ height: '100%', display: 'flex', gap: 0 }}>
        {/* Left: goals */}
        {goals.length > 0 && (
          <div style={{ flex: 1, padding: '48px 40px 40px 56px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionLabel t={t}>FUTURE GOALS</SectionLabel>
            {goals.map((g, i) => (
              <div key={i} style={{
                padding: '12px 16px', background: t.card + 'dd', borderRadius: 10,
                borderLeft: `3px solid ${t.accent}`, border: `1px solid ${t.div}44`, borderLeftColor: t.accent
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{g.title}</div>
                {g.description && <p style={{
                  fontSize: 10, color: t.sub, margin: '4px 0 0', lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>{g.description}</p>}
              </div>
            ))}
          </div>
        )}
        <div style={{ width: 1, background: t.div }} />
        {/* Right: Thank you */}
        <div style={{
          flex: '0 0 380px', padding: '48px 56px 40px 40px', display: 'flex',
          flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 12
        }}>
          <div style={{ fontSize: 42, fontWeight: 900, color: t.accent, letterSpacing: -1, lineHeight: 1 }}>
            Thank You
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.text, marginTop: 8, letterSpacing: '0.1em' }}>
            {nameSpaced(p.userName || '')}
          </div>
          <div style={{ fontSize: 13, color: t.sub, fontWeight: 600, marginTop: 0 }}>
            {p.targetPosition || ''}
          </div>
          <div style={{ width: 40, height: 2, background: t.accent, borderRadius: 2, margin: '8px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {cl.map((l, i) => <span key={i} style={{ fontSize: 10, color: t.sub }}>{l}</span>)}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* ─── DirectSlidePreview ─── */
const DIRECT_INTENT_LABELS = {
  cover: '표지', profile: '프로필', skills: '역량/기술', project: '프로젝트',
  process: '문제해결 과정', result: '성과/지표', details: '상세 내용',
  education: '학력/수상', contact: '연락처/마무리',
};
const SLIDE_THEMES_DIRECT = {
  cover:     { bg: 'linear-gradient(135deg,#0f2044 0%,#1a3a6b 100%)',   bar: '#60A5FA', tc: '#fff',    bc: '#93C5FD', nb: 'rgba(59,130,246,0.25)',   nt: '#93C5FD' },
  profile:   { bg: 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)',   bar: '#22C55E', tc: '#14532d', bc: '#166534', nb: 'rgba(34,197,94,0.15)',    nt: '#15803d' },
  skills:    { bg: 'linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)',   bar: '#F59E0B', tc: '#78350f', bc: '#92400e', nb: 'rgba(245,158,11,0.15)',   nt: '#92400e' },
  project:   { bg: 'linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)',   bar: '#3B82F6', tc: '#1e3a8a', bc: '#1d4ed8', nb: 'rgba(59,130,246,0.12)',   nt: '#1d4ed8' },
  process:   { bg: 'linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%)',   bar: '#8B5CF6', tc: '#3b0764', bc: '#5b21b6', nb: 'rgba(139,92,246,0.12)',   nt: '#5b21b6' },
  result:    { bg: 'linear-gradient(135deg,#ecfdf5 0%,#bbf7d0 100%)',   bar: '#10B981', tc: '#064e3b', bc: '#065f46', nb: 'rgba(16,185,129,0.12)',   nt: '#065f46' },
  details:   { bg: 'linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)',  bar: '#64748B', tc: '#0f172a', bc: '#334155', nb: 'rgba(100,116,139,0.1)',    nt: '#334155' },
  education: { bg: 'linear-gradient(135deg,#fdf4ff 0%,#fae8ff 100%)',   bar: '#A855F7', tc: '#3b0764', bc: '#7e22ce', nb: 'rgba(168,85,247,0.12)',   nt: '#7e22ce' },
  contact:   { bg: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',   bar: '#94A3B8', tc: '#f1f5f9', bc: '#cbd5e1', nb: 'rgba(148,163,184,0.15)',  nt: '#cbd5e1' },
};
const BASE_W = 720, BASE_H = 405;
function DirectSlidePreview({ slide }) {
  const th = SLIDE_THEMES_DIRECT[slide.intent] || SLIDE_THEMES_DIRECT.project;
  const label = DIRECT_INTENT_LABELS[slide.intent] || '슬라이드';
  const lines = (slide.lines || []).filter(Boolean);
  const title = lines[0] || '(내용 없음)';
  const bodyLines = lines.slice(1, 7);
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: `${100 * BASE_H / BASE_W}%`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 6px 28px rgba(0,0,0,0.18)' }}>
      <div style={{ position: 'absolute', inset: 0, background: th.bg, display: 'flex', flexDirection: 'column' }}>
        {/* 상단 색상 바 */}
        <div style={{ height: '1%', background: th.bar, flexShrink: 0 }} />
        {/* 본문 */}
        <div style={{ flex: 1, padding: '5.5% 6% 4.5%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {/* 헤더: 슬라이드 타입 배지 + 번호 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4.5%' }}>
            <span style={{ fontSize: '1.9%', fontWeight: 700, background: th.nb, color: th.nt, padding: '0.6% 2%', borderRadius: 99, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ fontSize: '2.2%', fontWeight: 800, color: th.bar, opacity: 0.9 }}>{String(slide.slideIndex + 1).padStart(2, '0')}</span>
          </div>
          {/* 제목 */}
          <div style={{ fontSize: '3.8%', fontWeight: 800, color: th.tc, lineHeight: 1.25, marginBottom: '3.5%', wordBreak: 'keep-all', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {title}
          </div>
          {/* 본문 줄 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2%', overflow: 'hidden' }}>
            {bodyLines.map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '2%' }}>
                <span style={{ flexShrink: 0, width: '1.2%', height: '1.2%', borderRadius: '50%', background: th.bar, marginTop: '1%', opacity: 0.7 }} />
                <span style={{ fontSize: '2.4%', color: th.bc, lineHeight: 1.4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>{line}</span>
              </div>
            ))}
          </div>
          {/* 더 있음 표시 */}
          {lines.length > 7 && (
            <div style={{ marginTop: '2%', fontSize: '1.8%', color: th.bar, opacity: 0.6 }}>+{lines.length - 7}줄 더...</div>
          )}
        </div>
        {/* 왼쪽 세로 액센트 */}
        <div style={{ position: 'absolute', left: 0, top: '8%', bottom: '8%', width: '0.6%', background: th.bar, borderRadius: '0 2px 2px 0' }} />
      </div>
    </div>
  );
}

/* ─── MAIN ─── */
export default function PdfPortfolioExport() {
  const { id } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [theme, setTheme] = useState('marketer_light');
  const [customTemplateText, setCustomTemplateText] = useState('');
  const [directTemplateFileName, setDirectTemplateFileName] = useState('');
  const [directTemplateArrayBuffer, setDirectTemplateArrayBuffer] = useState(null);
  const [directTemplateSlideCount, setDirectTemplateSlideCount] = useState(0);
  const [parsingTemplate, setParsingTemplate] = useState(false);
  const [directPreviewData, setDirectPreviewData] = useState(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const directTemplateInputRef = useRef(null);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const snap = await getDoc(doc(db, 'portfolios', id));
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() };
        setPortfolio(p);
        setCustomTemplateText(sessionStorage.getItem(`direct-template:${snap.id}`) || '');
        const pos = (p.targetPosition || p.headline || '').toLowerCase();
        if (/개발|developer|engineer|frontend|backend|node|react|ios|android/.test(pos)) setTheme('developer');
        else if (/데이터|data|analyst|분석|sql|bi/.test(pos)) setTheme('data_dashboard');
        else if (/디자인|design|ux|ui|figma/.test(pos)) setTheme('designer');
        else if (/마케터|마케팅|marketer|marketing|cpc|roas|퍼포먼스/.test(pos)) setTheme('marketer_light');
        else if (/pm|po|product|기획/.test(pos)) setTheme('star_classic');
        else if (/컨설|consultant|전략|strategy/.test(pos)) setTheme('problem_solver');
        else if (/신입|주니어|junior|학부/.test(pos)) setTheme('rookie');
      }
    } catch (e) { toast.error('불러오기 실패'); }
    setLoading(false);
  };

  useEffect(() => {
    if (id) sessionStorage.setItem(`direct-template:${id}`, customTemplateText);
  }, [customTemplateText, id]);

  const handleDirectTemplateFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setParsingTemplate(true);
    const tid = toast.loading('템플릿 파일 구조 분석 중...');
    try {
      const spec = await extractDirectTemplateFromFile(file);
      setCustomTemplateText(directTemplateSpecToText(spec));
      setDirectTemplateFileName(file.name);
      setDirectTemplateArrayBuffer(spec.arrayBuffer || null);
      setDirectTemplateSlideCount(spec.slideCount || 0);
      setDirectPreviewData(null);
      toast.success(spec.arrayBuffer ? '템플릿 디자인을 읽었습니다.' : '템플릿 구조를 읽었습니다.', { id: tid });
    } catch (error) {
      console.error(error);
      setDirectTemplateArrayBuffer(null);
      setDirectTemplateFileName('');
      setDirectTemplateSlideCount(0);
      toast.error(error?.message || '템플릿 파일 분석 실패', { id: tid });
    } finally {
      setParsingTemplate(false);
      event.target.value = '';
    }
  };

  const handleApplyTemplate = async () => {
    if (!directTemplateArrayBuffer) { toast.error('PPTX 템플릿 파일을 먼저 업로드해 주세요.'); return; }
    setApplyingTemplate(true);
    const tid = toast.loading('AI가 템플릿 슬라이드를 분석 중...');
    try {
      const previewSlides = await analyzeAndPreviewTemplate(
        directTemplateArrayBuffer,
        portfolio,
        customTemplateText.trim() || directTemplatePlaceholder()
      );
      setDirectPreviewData(previewSlides);
      toast.success(`${previewSlides.length}개 슬라이드 분석 완료!`, { id: tid });
    } catch (e) {
      console.error(e);
      toast.error('템플릿 분석 실패: ' + (e?.message || '알 수 없는 오류'), { id: tid });
    }
    setApplyingTemplate(false);
  };

  const handleDownload = useCallback(async () => {
    if (!portfolio) return;
    setGenerating(true);
    const tid = toast.loading(getLayout(theme) === 'direct_ppt' ? 'AI가 PPT 템플릿을 분석 중...' : 'PPT 생성 중...');
    try {
      if (getLayout(theme) === 'direct_ppt' && !directTemplateArrayBuffer) {
        toast.error('디자인을 채울 PPTX 템플릿 파일을 먼저 업로드해 주세요.', { id: tid });
        setGenerating(false);
        return;
      }
      const exportPortfolio = getLayout(theme) === 'direct_ppt'
        ? { ...portfolio, customTemplateText: customTemplateText.trim() || directTemplatePlaceholder(), customTemplateArrayBuffer: directTemplateArrayBuffer, directPreviewSlides: directPreviewData }
        : portfolio;
      await generatePptx(exportPortfolio, theme, THEMES[theme]);
      toast.success('PPT 다운로드 완료!', { id: tid });
    } catch (e) {
      console.error(e);
      toast.error('생성 실패: ' + (e?.message || '알 수 없는 오류'), { id: tid });
    }
    setGenerating(false);
  }, [portfolio, theme, customTemplateText, directTemplateArrayBuffer, directPreviewData]);

  const handlePrintPdf = useCallback(() => {
    window.print();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-600" /></div>;
  if (!portfolio) return <p className="text-center py-20 text-gray-400">포트폴리오를 찾을 수 없습니다</p>;

  const t = THEMES[theme];
  const p = portfolio;
  const exps = p.experiences || [];
  const layout = getLayout(theme);
  const isSubmissionTheme = theme === 'accepted_submission';
  const isTestTemplate = ['test1_ppt', 'test2_ppt', 'test3_ppt'].includes(layout);
  const isDirectTemplate = layout === 'direct_ppt';
  const sk = p.skills || {};
  const hasSkills = [...(sk.languages || []), ...(sk.frameworks || []), ...(sk.tools || []), ...(sk.others || [])].length > 0;

  const expSlides = exps.map(exp => {
    const f = extractFields(exp);
    const hasSit = !!(f.task || f.process || f.overview || f.description || f.intro);
    const hasRes = !!(f.output || f.growth || f.competency || f.keyExperiences?.length);
    return { exp, f, hasSit, hasRes };
  });

  const totalSlides = isDirectTemplate
    ? directPreviewData ? directPreviewData.length : (directTemplateSlideCount || 0)
    : isTestTemplate
    ? 3 + previewT1ProjectStories(p).reduce((sum, proof) => sum + 1 + Math.ceil(previewT1SectionCards(proof.exp, proof.fields).length / 4), 0)
    : 2 + (hasSkills ? 1 : 0) + expSlides.reduce((a, d) => a + 1 + (d.hasSit ? 1 : 0) + (d.hasRes ? 1 : 0), 0) + 1;

  return (
    <div className="animate-fadeIn">
      <div className="print:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-surface-200 shadow-sm">
        <div style={{ maxWidth: 1040, margin: '0 auto' }} className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to={'/app/portfolio/preview/' + id} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={14} />{'  미리보기'}
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-bold text-gray-800">{'Wanted Style PPT'}</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{totalSlides + ' slides'}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select value={theme} onChange={e => setTheme(e.target.value)}
                className="appearance-none bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 pr-7 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-primary-300">
                {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button onClick={handleDownload} disabled={generating}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {generating ? <><Loader2 size={14} className="animate-spin" />{'  생성 중...'}</> : <><Download size={14} />{' PPT 저장 (.pptx)'}</>}
            </button>
            <button onClick={handlePrintPdf}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
              <FileText size={14} />{' PDF 저장'}
            </button>
          </div>
        </div>
        {isDirectTemplate && (
          <div style={{ maxWidth: 1040, margin: '0 auto' }} className="px-4 pb-3">
            <input
              ref={directTemplateInputRef}
              type="file"
              accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="hidden"
              onChange={handleDirectTemplateFile}
            />
            <button
              type="button"
              onClick={() => directTemplateInputRef.current?.click()}
              disabled={parsingTemplate}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-left text-xs text-gray-700 outline-none transition-colors hover:bg-white disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-2">
                {parsingTemplate ? <Loader2 size={15} className="animate-spin text-blue-600" /> : directTemplateFileName ? <FileText size={15} className="text-blue-600" /> : <UploadCloud size={15} className="text-gray-500" />}
                <span className="truncate">{directTemplateFileName || 'PPTX 템플릿 파일 업로드'}</span>
              </span>
              <span className="shrink-0 text-[11px] text-gray-500">.pptx</span>
            </button>
            <div className="mt-1 text-[11px] text-gray-500">업로드한 PPTX의 문구와 텍스트 자리 수를 AI가 분석해, 배경·이미지·도형·색상·레이아웃은 유지한 채 내용만 채웁니다.</div>
            {directTemplateSlideCount > 0 && <div className="mt-1 text-[11px] text-blue-600">{directTemplateSlideCount}개 슬라이드를 읽었습니다. 저장하면 AI가 템플릿 맥락에 맞춰 포트폴리오 내용을 배치합니다.</div>}
            {directTemplateArrayBuffer && !parsingTemplate && (
              <button
                type="button"
                onClick={handleApplyTemplate}
                disabled={applyingTemplate}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {applyingTemplate ? <><Loader2 size={14} className="animate-spin" />{'  분석 중...'}</> : <><Wand2 size={14} />{'  템플릿 적용하기'}</>}
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: '32px 24px 72px' }}
        className="print:gap-0 print:p-0">
        {isDirectTemplate ? (
          <div style={{ maxWidth: 1040, width: '100%' }} className="print:hidden px-4">
            {applyingTemplate ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 size={32} className="animate-spin text-blue-600" />
                <div className="text-sm text-gray-500">AI가 슬라이드 콘텐츠를 분석 중입니다...</div>
              </div>
            ) : directPreviewData ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-bold text-gray-700">슬라이드 미리보기 — {directPreviewData.length}개</div>
                  <button type="button" onClick={() => setDirectPreviewData(null)} className="text-xs text-blue-600 hover:underline">다시 분석</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {directPreviewData.map(slide => <DirectSlidePreview key={slide.slideIndex} slide={slide} />)}
                </div>
                <div className="mt-4 text-[11px] text-gray-400 text-center">위 내용이 각 슬라이드 텍스트 자리에 배치됩니다. 마음에 들면 상단의 'PPT 저장'을 누르세요.</div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50 px-8 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Wand2 size={22} />
                </div>
                <div className="text-base font-bold text-gray-800">템플릿 적용하기를 눌러 미리보기</div>
                <div className="mt-2 text-sm leading-6 text-gray-500">
                  {directTemplateArrayBuffer ? "위의 '템플릿 적용하기' 버튼을 눌러 AI가 슬라이드별 내용을 배치한 미리보기를 확인하세요." : 'PPTX 템플릿 파일을 먼저 업로드하세요.'}
                </div>
              </div>
            )}
          </div>
        ) : isTestTemplate ? (
          <>
            {layout === 'test2_ppt' ? <Test2CoverSlide p={p} t={t} /> : layout === 'test3_ppt' ? <Test3CoverSlide p={p} t={t} /> : <Test1CoverSlide p={p} t={t} />}
            {layout === 'test2_ppt' ? <Test2SummarySlide p={p} t={t} /> : layout === 'test3_ppt' ? <Test3SummarySlide p={p} t={t} /> : <Test1SummarySlide p={p} t={t} />}
            {previewT1ProjectStories(p).map((proof, idx) => {
              const cards = previewT1SectionCards(proof.exp, proof.fields);
              const detailSlides = [];
              for (let j = 0; j < cards.length; j += 4) {
                detailSlides.push(
                  layout === 'test2_ppt'
                    ? <Test2SectionDigestSlide key={`section-${idx}-${j}`} proof={proof} pageIdx={Math.floor(j / 4)} cards={cards.slice(j, j + 4)} t={t} />
                    : layout === 'test3_ppt'
                      ? <Test3SectionDigestSlide key={`section-${idx}-${j}`} proof={proof} pageIdx={Math.floor(j / 4)} cards={cards.slice(j, j + 4)} t={t} />
                      : <Test1SectionDigestSlide key={`section-${idx}-${j}`} proof={proof} pageIdx={Math.floor(j / 4)} cards={cards.slice(j, j + 4)} t={t} />
                );
              }
              return <div key={idx} style={{ display: 'contents' }}>
                {layout === 'test2_ppt' ? <Test2CaseSlide proof={proof} idx={idx} t={t} /> : layout === 'test3_ppt' ? <Test3CaseSlide proof={proof} idx={idx} t={t} /> : <Test1CaseSlide proof={proof} idx={idx} t={t} />}
                {detailSlides}
              </div>;
            })}
            <OutroSlide p={p} t={t} />
          </>
        ) : isSubmissionTheme ? (
          <>
            <SubmissionCoverSlide p={p} t={t} />
            <SubmissionProfileSlide p={p} t={t} />
            {hasSkills && <SubmissionSkillsSlide p={p} t={t} />}
            {expSlides.map(({ exp, f, hasSit, hasRes }, idx) => (
              <div key={idx} style={{ display: 'contents' }}>
                <SubmissionSectionDivider exp={exp} idx={idx} t={t} />
                {hasSit && <SituationSlide exp={exp} idx={idx} t={t} f={f} theme={theme} />}
                {hasRes && <ResultSlide exp={exp} idx={idx} t={t} f={f} theme={theme} />}
              </div>
            ))}
            <OutroSlide p={p} t={t} />
          </>
        ) : (
          <>
            <CoverSlide p={p} t={t} theme={theme} />
            <ProfileSlide p={p} t={t} />
            {hasSkills && <SkillsSlide p={p} t={t} />}
            {expSlides.map(({ exp, f, hasSit, hasRes }, idx) => (
              <div key={idx} style={{ display: 'contents' }}>
                <SectionDivider exp={exp} idx={idx} t={t} />
                {hasSit && <SituationSlide exp={exp} idx={idx} t={t} f={f} theme={theme} />}
                {hasRes && <ResultSlide exp={exp} idx={idx} t={t} f={f} theme={theme} />}
              </div>
            ))}
            <OutroSlide p={p} t={t} />
          </>
        )
      </div>
            ) : directPreviewData ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-bold text-gray-700">슬라이드 미리보기 — {directPreviewData.length}개</div>
                  <button type="button" onClick={() => setDirectPreviewData(null)} className="text-xs text-blue-600 hover:underline">다시 분석</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {directPreviewData.map(slide => <DirectSlidePreview key={slide.slideIndex} slide={slide} />)}
                </div>
                <div className="mt-4 text-[11px] text-gray-400 text-center">위 내용이 각 슬라이드 텍스트 자리에 배치됩니다. 마음에 들면 상단의 'PPT 저장'을 누르세요.</div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50 px-8 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Wand2 size={22} />
                </div>
                <div className="text-base font-bold text-gray-800">템플릿 적용하기를 눌러 미리보기</div>
                <div className="mt-2 text-sm leading-6 text-gray-500">
                  {directTemplateArrayBuffer ? "위의 '템플릿 적용하기' 버튼을 눌러 AI가 슬라이드별 내용을 배치한 미리보기를 확인하세요." : 'PPTX 템플릿 파일을 먼저 업로드하세요.'}
                </div>
              </div>
            )}
          </div>
        ) : isTestTemplate ? (
          <>
            {layout === 'test2_ppt' ? <Test2CoverSlide p={p} t={t} /> : layout === 'test3_ppt' ? <Test3CoverSlide p={p} t={t} /> : <Test1CoverSlide p={p} t={t} />}
            {layout === 'test2_ppt' ? <Test2SummarySlide p={p} t={t} /> : layout === 'test3_ppt' ? <Test3SummarySlide p={p} t={t} /> : <Test1SummarySlide p={p} t={t} />}
            {previewT1ProjectStories(p).map((proof, idx) => {
              const cards = previewT1SectionCards(proof.exp, proof.fields);
              const detailSlides = [];
              for (let i = 0; i < cards.length; i += 4) {
                detailSlides.push(
                  layout === 'test2_ppt'
                    ? <Test2SectionDigestSlide key={`section-${idx}-${i}`} proof={proof} pageIdx={Math.floor(i / 4)} cards={cards.slice(i, i + 4)} t={t} />
                    : layout === 'test3_ppt'
                      ? <Test3SectionDigestSlide key={`section-${idx}-${i}`} proof={proof} pageIdx={Math.floor(i / 4)} cards={cards.slice(i, i + 4)} t={t} />
                      : <Test1SectionDigestSlide key={`section-${idx}-${i}`} proof={proof} pageIdx={Math.floor(i / 4)} cards={cards.slice(i, i + 4)} t={t} />
                );
              }
              return <div key={idx} style={{ display: 'contents' }}>
                {layout === 'test2_ppt' ? <Test2CaseSlide proof={proof} idx={idx} t={t} /> : layout === 'test3_ppt' ? <Test3CaseSlide proof={proof} idx={idx} t={t} /> : <Test1CaseSlide proof={proof} idx={idx} t={t} />}
                {detailSlides}
              </div>;
            })}
            <OutroSlide p={p} t={t} />
          </>
        ) : (
          <>
            <CoverSlide p={p} t={t} theme={theme} />
            <ProfileSlide p={p} t={t} />
            {hasSkills && <SkillsSlide p={p} t={t} />}
            {expSlides.map(({ exp, f, hasSit, hasRes }, idx) => (
              <div key={idx} style={{ display: 'contents' }}>
                <SectionDivider exp={exp} idx={idx} t={t} />
                {hasSit && <SituationSlide exp={exp} idx={idx} t={t} f={f} theme={theme} />}
                {hasRes && <ResultSlide exp={exp} idx={idx} t={t} f={f} theme={theme} />}
              </div>
            ))}
            <OutroSlide p={p} t={t} />
          </>
        )}
      </div>

      <style>{`
        @media print{body{margin:0;padding:0;}.print\\:hidden{display:none!important;}.ppt-slide{page-break-after:always;page-break-inside:avoid;box-shadow:none!important;border-radius:0!important;}.ppt-slide:last-child{page-break-after:avoid;}@page{margin:0;size:A4 landscape;}}
        .ppt-slide{box-shadow:0 8px 40px rgba(0,0,0,0.22);border-radius:8px;}
      `}</style>
    </div>
  );
}

function SubmissionBadge({ children, t }) {
  return <span style={{
    fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: t.accent,
    padding: '5px 10px', border: `1px solid ${t.resBd || t.div}`, borderRadius: 999,
    background: t.badge, whiteSpace: 'nowrap', textTransform: 'uppercase'
  }}>{children}</span>;
}

function SubmissionHeader({ label, title, t, meta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 22 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 3.2, color: t.accent, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: t.text, letterSpacing: 0, lineHeight: 1.15 }}>{title}</div>
      </div>
      {meta && <div style={{ flexShrink: 0, fontSize: 10.5, color: t.sub, lineHeight: 1.55, textAlign: 'right', maxWidth: 260 }}>{meta}</div>}
    </div>
  );
}

function SubmissionCoverSlide({ p, t }) {
  const c = p.contact || {};
  const contacts = [c.email, c.phone, c.github || c.website].filter(Boolean);
  const values = (p.values || []).slice(0, 3).map(v => v.keyword || String(v));
  const experiences = (p.experiences || []).slice(0, 3);
  const summary = shorten(p.headline || `${p.targetPosition || '지원 직무'}에 바로 연결되는 문제 해결 경험을 정리했습니다.`, 130);
  return (
    <Slide t={t} bg={t.coverBg}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 9, background: t.accent }} />
      <div style={{ height: '100%', padding: '58px 70px 50px', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 46 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <SubmissionBadge t={t}>Template 22 / Submission Portfolio</SubmissionBadge>
            <div style={{ marginTop: 34, fontSize: 16, fontWeight: 800, color: t.accent }}>{p.targetCompany || '지원 기업'} · {p.targetPosition || '지원 직무'}</div>
            <div style={{ marginTop: 14, fontSize: 54, fontWeight: 900, color: t.text, lineHeight: 1.02, letterSpacing: 0 }}>
              {p.userName || '지원자'}<br />Portfolio
            </div>
            <p style={{ marginTop: 26, fontSize: 16, lineHeight: 1.72, color: t.text, fontWeight: 600, maxWidth: 560 }}>{summary}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[p.targetPosition, ...values].filter(Boolean).slice(0, 4).map((item, i) => <Pill key={i} t={t}>{item}</Pill>)}
          </div>
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 6, padding: '30px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 3, color: t.sub, textTransform: 'uppercase', marginBottom: 16 }}>Evidence Summary</div>
            {experiences.length > 0 ? experiences.map((exp, i) => {
              const f = extractFields(exp);
              const metric = f.keyExperiences?.[0]?.metric || shorten(f.output || f.growth || '검증된 산출물', 18);
              return <div key={i} style={{ padding: '13px 0', borderBottom: i < experiences.length - 1 ? `1px solid ${t.div}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 850, color: t.text, lineHeight: 1.35 }}>{shorten(exp.title || '프로젝트', 32)}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: t.accent, whiteSpace: 'nowrap' }}>{shorten(String(metric), 16)}</span>
                </div>
                <div style={{ marginTop: 5, fontSize: 10.5, color: t.sub, lineHeight: 1.45 }}>{shorten(exp.role || f.aiSummary || exp.description || '', 70)}</div>
              </div>;
            }) : <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.7 }}>대표 프로젝트 2~3개와 정량 성과를 입력하면 제출용 요약이 자동 구성됩니다.</div>}
          </div>
          <div style={{ borderTop: `1px solid ${t.div}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {contacts.map((contact, i) => <span key={i} style={{ fontSize: 11, color: t.sub }}>{contact}</span>)}
          </div>
        </div>
      </div>
    </Slide>
  );
}

function SubmissionProfileSlide({ p, t }) {
  const sk = p.skills || {};
  const stack = [...(sk.languages || []), ...(sk.frameworks || []), ...(sk.tools || []), ...(sk.others || [])]
    .map(s => typeof s === 'string' ? s : s?.name).filter(Boolean).slice(0, 12);
  const education = (p.education || []).slice(0, 3);
  const awards = (p.awards || []).slice(0, 3);
  const values = (p.values || []).slice(0, 3);
  return (
    <Slide t={t}>
      <div style={{ padding: '44px 60px', height: '100%', boxSizing: 'border-box' }}>
        <SubmissionHeader t={t} label="Candidate Fit" title="직무 적합성을 먼저 증명하는 요약" meta={`${p.userName || ''}${p.targetPosition ? ' · ' + p.targetPosition : ''}`} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 28, height: 520 }}>
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 16 }}>
            <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 6, padding: '22px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: t.accent, letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 14 }}>Positioning Statement</div>
              <div style={{ fontSize: 20, fontWeight: 850, color: t.text, lineHeight: 1.45, letterSpacing: 0 }}>{shorten(p.headline || '문제를 구조화하고 끝까지 실행해 결과를 만드는 지원자입니다.', 135)}</div>
              {values.length > 0 && <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>{values.map((v, i) => <Pill key={i} t={t}>{v.keyword || String(v)}</Pill>)}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 6, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: t.accent, marginBottom: 12 }}>Education</div>
                {education.map((edu, i) => <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{edu.name}</div>
                  <div style={{ fontSize: 10.5, color: t.sub, lineHeight: 1.45 }}>{[edu.degree, edu.period].filter(Boolean).join(' · ')}</div>
                </div>)}
              </div>
              <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 6, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: t.accent, marginBottom: 12 }}>Recognition</div>
                {awards.length > 0 ? awards.map((award, i) => <div key={i} style={{ marginBottom: 11 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: t.text }}>{award.title}</div>
                  <div style={{ fontSize: 10.5, color: t.sub }}>{award.date || award.organization || ''}</div>
                </div>) : <div style={{ fontSize: 11.5, color: t.sub, lineHeight: 1.6 }}>수상, 자격증, 외부 검증 이력을 배치합니다.</div>}
              </div>
            </div>
          </div>
          <div style={{ background: t.step, border: `1px solid ${t.div}`, borderRadius: 6, padding: '24px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: t.accent, letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 16 }}>Capability Stack</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start' }}>
              {stack.map((item, i) => <Pill key={i} t={t}>{item}</Pill>)}
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 18, borderTop: `1px solid ${t.div}` }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: t.sub, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Submission Rule</div>
              <div style={{ fontSize: 12.5, color: t.text, lineHeight: 1.65 }}>핵심 경험은 문제, 행동, 성과, 배운 점 순서로 배치하여 채용 담당자가 1분 안에 판단할 수 있게 구성합니다.</div>
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}

function SubmissionSkillsSlide({ p, t }) {
  const sk = p.skills || {};
  const groups = [
    { title: 'Core Tools', items: sk.tools || [] },
    { title: 'Languages', items: sk.languages || [] },
    { title: 'Frameworks', items: sk.frameworks || [] },
    { title: 'Other Strengths', items: sk.others || [] },
  ].map(g => ({ ...g, items: g.items.map(s => typeof s === 'string' ? s : s?.name).filter(Boolean).slice(0, 8) })).filter(g => g.items.length);
  if (!groups.length) return null;
  return (
    <Slide t={t}>
      <div style={{ padding: '44px 60px', height: '100%', boxSizing: 'border-box' }}>
        <SubmissionHeader t={t} label="Capability Evidence" title="업무에 바로 투입 가능한 역량" meta="도구 나열보다 활용 가능한 범위를 명확히 보여주는 구성" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
          {groups.slice(0, 4).map((group, i) => (
            <div key={i} style={{ minHeight: 190, background: t.card, border: `1px solid ${t.div}`, borderRadius: 6, padding: '22px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: t.text }}>{group.title}</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: t.accent, opacity: 0.18 }}>{String(i + 1).padStart(2, '0')}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{group.items.map((item, j) => <Pill key={j} t={t}>{item}</Pill>)}</div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

function SubmissionSectionDivider({ exp, idx, t }) {
  return (
    <Slide t={t} bg={t.coverBg}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 9, height: '100%', background: t.accent }} />
      <div style={{ height: '100%', padding: '62px 84px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 4, color: t.accent, textTransform: 'uppercase', marginBottom: 20 }}>CASE STUDY {String(idx + 1).padStart(2, '0')}</div>
        <div style={{ fontSize: 52, fontWeight: 900, color: t.text, lineHeight: 1.08, letterSpacing: 0, maxWidth: 820 }}>{exp.title || '프로젝트'}</div>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 12, color: t.sub, fontSize: 14, fontWeight: 650 }}>
          <span>{exp.role || '역할'}</span>{exp.date && <><span style={{ width: 4, height: 4, borderRadius: '50%', background: t.sub }} /><span>{exp.date}</span></>}
        </div>
      </div>
    </Slide>
  );
}
function previewSkillNames(p, max = 10) {
  const sk = p.skills || {};
  return [...(sk.languages || []), ...(sk.frameworks || []), ...(sk.tools || []), ...(sk.others || [])]
    .map(s => typeof s === 'string' ? s : s?.name)
    .filter(Boolean)
    .slice(0, max);
}

function previewContacts(p) {
  const c = p.contact || {};
  return [c.email, c.phone, c.github, c.website || c.linkedin || c.instagram].filter(Boolean);
}

function previewExpTitle(exp, idx) {
  return exp.title || exp.company || exp.name || exp.organization || `프로젝트 ${idx + 1}`;
}

function previewImpactText(exp, f) {
  const kx = (f.keyExperiences || []).find(item => item?.metric || item?.result);
  return kx?.metric || kx?.result || f.output || f.growth || f.competency || exp.description || f.aiSummary || '';
}

function previewTechStack(exp, f) {
  const stack = f.projectOverview?.techStack || exp.techStack || exp.skills || [];
  return stack.map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
}

function previewExperienceScore(exp) {
  const f = extractFields(exp);
  const sr = exp.structuredResult || exp.frameworkContent || {};
  const techCount = previewTechStack(exp, f).length;
  return [
    f.keyExperiences?.length ? f.keyExperiences.length * 8 : 0,
    previewImpactText(exp, f) ? 12 : 0,
    f.output ? 8 : 0,
    f.process ? 6 : 0,
    f.competency || f.growth ? 5 : 0,
    sr.projectOverview?.summary || f.overview || f.description ? 4 : 0,
    Math.min(techCount, 6),
  ].reduce((sum, value) => sum + value, 0);
}

function previewT1FeaturedExperiences(p, max = 5) {
  return (p.experiences || [])
    .map((exp, originalIdx) => ({ exp, originalIdx, score: previewExperienceScore(exp) }))
    .filter(item => item.exp)
    .sort((a, b) => b.score - a.score || a.originalIdx - b.originalIdx)
    .slice(0, max);
}

function previewProofMetric(proof) {
  const item = proof.item || {};
  const f = proof.fields || extractFields(proof.exp);
  return item.metric || item.afterMetric || previewImpactText(proof.exp, f) || f.output || '';
}

function previewProofTitle(proof, idx) {
  return proof.item?.title || previewExpTitle(proof.exp, idx);
}

function previewT1Proofs(p, max = 5) {
  const proofs = [];
  (p.experiences || []).forEach((exp, expIdx) => {
    const fields = extractFields(exp);
    const keyItems = fields.keyExperiences?.length ? fields.keyExperiences : [];
    if (keyItems.length) {
      keyItems.forEach((item, itemIdx) => {
        const score = [
          item.metric || item.afterMetric ? 24 : 0,
          item.beforeMetric && item.afterMetric ? 20 : 0,
          item.result ? 12 : 0,
          item.action ? 8 : 0,
          item.situation ? 6 : 0,
          item.keywords?.length ? Math.min(item.keywords.length, 5) : 0,
        ].reduce((sum, value) => sum + value, 0);
        proofs.push({ exp, fields, item, expIdx, itemIdx, score });
      });
      return;
    }
    proofs.push({
      exp,
      fields,
      item: {
        title: previewExpTitle(exp, expIdx),
        metric: previewImpactText(exp, fields),
        situation: fields.overview || fields.description || fields.intro,
        action: [fields.task, fields.process].filter(Boolean).join('\n'),
        result: [fields.output, fields.growth || fields.competency].filter(Boolean).join('\n'),
        keywords: previewTechStack(exp, fields).slice(0, 5),
      },
      expIdx,
      itemIdx: 0,
      score: previewExperienceScore(exp),
    });
  });
  return proofs.sort((a, b) => b.score - a.score || a.expIdx - b.expIdx || a.itemIdx - b.itemIdx).slice(0, max);
}

function previewPrimaryProof(exp, expIdx) {
  const fields = extractFields(exp);
  const keyItems = fields.keyExperiences?.length ? fields.keyExperiences : [];
  const item = keyItems
    .map((keyItem, itemIdx) => ({
      item: keyItem,
      itemIdx,
      score: [
        keyItem.metric || keyItem.afterMetric ? 24 : 0,
        keyItem.beforeMetric && keyItem.afterMetric ? 20 : 0,
        keyItem.result ? 12 : 0,
        keyItem.action ? 8 : 0,
        keyItem.situation ? 6 : 0,
      ].reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => b.score - a.score || a.itemIdx - b.itemIdx)[0]?.item;
  return {
    exp,
    fields,
    expIdx,
    item: item || {
      title: previewExpTitle(exp, expIdx),
      metric: previewImpactText(exp, fields),
      situation: fields.overview || fields.description || fields.intro,
      action: [fields.task, fields.process].filter(Boolean).join('\n'),
      result: [fields.output, fields.growth || fields.competency].filter(Boolean).join('\n'),
      keywords: previewTechStack(exp, fields).slice(0, 5),
    },
  };
}

function previewT1ProjectStories(p) {
  return (p.experiences || []).map((exp, idx) => previewPrimaryProof(exp, idx));
}

function previewSectionCards(exp, fields = extractFields(exp)) {
  const cards = [];
  const seen = new Set();
  const add = (label, content) => {
    const text = strip(Array.isArray(content) ? content.filter(Boolean).join('\n') : content);
    const key = text.replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    cards.push({ label, content: smartBullets(text, 2, 58).join('\n') || shorten(text, 110) });
  };
  add('개요', [fields.intro, fields.overview, fields.description, fields.aiSummary]);
  add('문제/목표', fields.task);
  add('과정', fields.process);
  add('결과', fields.output);
  add('성장/역량', [fields.growth, fields.competency]);
  (exp.sections || []).forEach((section, idx) => add(section.title || `섹션 ${idx + 1}`, section.content));
  if (Array.isArray(exp.details)) exp.details.forEach((detail, idx) => add(`상세 ${idx + 1}`, detail));
  if (Array.isArray(exp.bullets)) exp.bullets.forEach((bullet, idx) => add(`포인트 ${idx + 1}`, bullet));
  return cards;
}

const previewT1SectionCards = previewSectionCards;

function previewMetricDisplay(proof) {
  const raw = previewProofMetric(proof);
  const hasNumber = /\d/.test(String(raw || ''));
  if (!raw) return '핵심 성과';
  return hasNumber || String(raw).length <= 34 ? raw : '핵심 성과';
}

function previewNumber(value) {
  if (!value) return null;
  const match = String(value).replace(/,/g, '').match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

function Test1MetricVisual({ proof, t }) {
  const item = proof.item || {};
  const metric = previewMetricDisplay(proof);
  const before = previewNumber(item.beforeMetric);
  const after = previewNumber(item.afterMetric || metric);
  const max = Math.max(before || 0, after || 0, 1);
  return <div style={{ background: t.resBg || t.step, border: `1px solid ${t.resBd || t.div}`, borderRadius: 8, padding: 26, height: 352 }}>
    <div style={{ fontSize: 11, fontWeight: 900, color: t.sub, marginBottom: 14, textTransform: 'uppercase' }}>{item.metricLabel || 'Impact Metric'}</div>
    <div style={{ fontSize: 30, fontWeight: 900, color: t.accent, lineHeight: 1.12, marginBottom: 24 }}>{shorten(metric || '핵심 성과', 26)}</div>
    {(item.beforeMetric || item.afterMetric) ? <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
      <MetricBar label="Before" value={item.beforeMetric || '기존'} pct={Math.max(((before || max) / max) * 100, 6)} color={t.sub} t={t} />
      <MetricBar label="After" value={item.afterMetric || metric || '개선 후'} pct={Math.max(((after || max) / max) * 100, 6)} color={t.accent} t={t} />
    </div> : <div style={{ marginTop: 20 }}>
      <div style={{ height: 12, background: `${t.div}66`, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(previewNumber(metric) || 72, 100)}%`, background: t.accent, borderRadius: 6 }} />
      </div>
      <div style={{ fontSize: 12, color: t.sub, marginTop: 14 }}>성과 지표 기반 하이라이트</div>
    </div>}
    <div style={{ fontSize: 13, lineHeight: 1.55, color: t.text, marginTop: 24 }}>{shorten(item.result || proof.fields.output || proof.fields.growth || proof.fields.competency, 120)}</div>
  </div>;
}

function MetricBar({ label, value, pct, color, t }) {
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 900, color }}>{label}</span>
      <span style={{ fontSize: 11, color: t.text, fontWeight: 700 }}>{shorten(value, 22)}</span>
    </div>
    <div style={{ height: 10, background: `${t.div}66`, borderRadius: 5, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 5 }} />
    </div>
  </div>;
}

function Test1PointCard({ label, children, t, accent = false }) {
  return <div style={{ background: t.card, border: `1px solid ${accent ? t.resBd : t.div}`, borderRadius: 8, padding: 22, minHeight: 156 }}>
    <div style={{ fontSize: 12, fontWeight: 900, color: accent ? t.accent : t.sub, marginBottom: 12, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 13, lineHeight: 1.65, color: t.text, whiteSpace: 'pre-line' }}>{smartBullets(children, 2, 58).join('\n') || shorten(children, 120)}</div>
  </div>;
}

function Test1Label({ num, children, t }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
    <span style={{ fontSize: 13, fontWeight: 900, color: t.accent }}>{String(num).padStart(2, '0')}</span>
    <span style={{ fontSize: 12, fontWeight: 800, color: t.sub }}>{children}</span>
    <div style={{ flex: 1, height: 1, background: t.div }} />
  </div>;
}

function Test1CoverSlide({ p, t }) {
  const proofs = previewT1ProjectStories(p);
  return <Slide t={t} bg={t.bg}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 14, background: t.accent }} />
    <div style={{ margin: 66, height: 520, background: t.card, border: `1px solid ${t.div}`, borderRadius: 8, padding: 42, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 36 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, color: t.accent, marginBottom: 22 }}>TEST1 TEMPLATE</div>
        <div style={{ fontSize: 17, color: t.sub, marginBottom: 28 }}>합격자 포트폴리오 구조로 재정리한 커리어노트형 PPT</div>
        <div style={{ fontSize: 54, fontWeight: 900, color: t.text, lineHeight: 1.1, marginBottom: 24 }}>{nameSpaced(p.userName || '이름')}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.text, lineHeight: 1.35 }}>{shorten(p.headline || p.targetPosition || 'Portfolio', 72)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 42, maxWidth: 560 }}>
          {previewContacts(p).slice(0, 4).map((line, idx) => <div key={idx} style={{ background: t.step, border: `1px solid ${t.div}`, borderRadius: 4, padding: '8px 10px', fontSize: 10, color: t.sub }}>{shorten(line, 32)}</div>)}
        </div>
      </div>
      <div style={{ background: t.step, border: `1px solid ${t.div}`, borderRadius: 8, padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: t.text, marginBottom: 20 }}>Project Flow</div>
        {proofs.slice(0, 5).map((proof, idx) => <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: t.accent }}>{String(idx + 1).padStart(2, '0')}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: t.text, lineHeight: 1.35 }}>{shorten(previewExpTitle(proof.exp, proof.expIdx), 26)}</span>
        </div>)}
        {proofs.length > 5 && <div style={{ fontSize: 11, color: t.sub, marginTop: 8 }}>{`+ ${proofs.length - 5} more projects`}</div>}
      </div>
    </div>
  </Slide>;
}




function Test1SummarySlide({ p, t }) {
  const skills = previewSkillNames(p, 99);
  const featured = previewT1ProjectStories(p);
  const metrics = [
    ['Projects', `${featured.length}건`],
    ['Skills', `${skills.length}개`],
    ['Awards', `${(p.awards || []).length}건`],
    ['Links', `${previewContacts(p).length}개`],
  ];
  return <Slide t={t} bg={t.bg}>
    <div style={{ padding: 54 }}>
      <Test1Label num={1} t={t}>PORTFOLIO SUMMARY</Test1Label>
      <div style={{ fontSize: 30, fontWeight: 900, color: t.text, marginBottom: 30 }}>핵심 경험만 압축한 합격자형 포트폴리오 요약</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 38 }}>
        {metrics.map(([label, value]) => <MetricCard key={label} label={label} value={value} t={t} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34 }}>
        <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 8, padding: 28 }}>
          <SectionBold t={t}>Candidate Narrative</SectionBold>
          <div style={{ fontSize: 15, lineHeight: 1.75, color: t.text }}>{shorten(p.about || p.valuesEssay || p.headline || '모든 프로젝트 경험과 링크형 섹션을 흐름에 맞게 압축해 정리했습니다.', 190)}</div>
        </div>
        <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 8, padding: 28 }}>
          <SectionBold t={t}>Core Keywords</SectionBold>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {skills.slice(0, 18).map((skill, idx) => <span key={idx} style={{ background: idx % 3 === 0 ? t.accent : t.badge, color: idx % 3 === 0 ? '#fff' : t.text, border: `1px solid ${idx % 3 === 0 ? t.accent : t.div}`, borderRadius: 16, padding: '7px 14px', fontSize: 12, fontWeight: 800 }}>{skill}</span>)}
          </div>
        </div>
      </div>
    </div>
  </Slide>;
}

function Test1CaseSlide({ proof, idx, t }) {
  const exp = proof.exp;
  const f = proof.fields || extractFields(exp);
  const item = proof.item || {};
  return <Slide t={t} bg={t.bg}>
    <div style={{ padding: 54 }}>
      <Test1Label num={proof.expIdx + 2} t={t}>PROJECT STORY</Test1Label>
      <div style={{ fontSize: 30, fontWeight: 900, color: t.text, marginBottom: 8 }}>{shorten(previewExpTitle(exp, proof.expIdx), 72)}</div>
      <div style={{ fontSize: 12, color: t.sub, marginBottom: 28 }}>{[f.projectOverview?.duration || exp.period || exp.date, f.projectOverview?.role || exp.role].filter(Boolean).join(' · ')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24 }}>
        <Test1MetricVisual proof={proof} t={t} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Test1PointCard label="Problem" t={t}>{item.situation || f.overview || f.description || f.intro}</Test1PointCard>
          <Test1PointCard label="Action" t={t}>{item.action || [f.task, f.process].filter(Boolean).join('\n')}</Test1PointCard>
          <div style={{ gridColumn: '1 / span 2' }}>
            <Test1PointCard label="Impact" t={t} accent>{item.result || [f.output, f.growth || f.competency].filter(Boolean).join('\n')}</Test1PointCard>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {[...(item.keywords || []), ...previewTechStack(exp, f)].filter(Boolean).slice(0, 8).map((skill, skillIdx) => <span key={skillIdx} style={{ background: t.badge, border: `1px solid ${t.div}`, borderRadius: 14, padding: '5px 10px', fontSize: 10, color: t.text }}>{shorten(skill, 12)}</span>)}
      </div>
    </div>
  </Slide>;
}

function Test1SectionDigestSlide({ proof, pageIdx, cards, t }) {
  const exp = proof.exp;
  const f = proof.fields || extractFields(exp);
  return <Slide t={t} bg={t.bg}>
    <div style={{ padding: 54 }}>
      <Test1Label num={proof.expIdx + 2} t={t}>{`PROJECT SECTIONS ${pageIdx + 1}`}</Test1Label>
      <div style={{ fontSize: 27, fontWeight: 900, color: t.text, marginBottom: 8 }}>{shorten(previewExpTitle(exp, proof.expIdx), 74)}</div>
      <div style={{ fontSize: 12, color: t.sub, marginBottom: 24 }}>{[f.projectOverview?.duration || exp.period || exp.date, f.projectOverview?.role || exp.role].filter(Boolean).join(' · ')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {cards.map((card, cardIdx) => <Test1PointCard key={cardIdx} label={card.label} t={t} accent={cardIdx === 0}>{card.content}</Test1PointCard>)}
      </div>
    </div>
  </Slide>;
}

function Test2CoverSlide({ p, t }) {
  const stories = previewT1ProjectStories(p);
  return <Slide t={t} bg={t.coverBg}>
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 22, background: t.accent }} />
    <div style={{ padding: 72, display: 'grid', gridTemplateColumns: '1fr 440px', gap: 54, height: '100%' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, color: t.accent, marginBottom: 34 }}>TEST2 TEMPLATE</div>
        <div style={{ fontSize: 54, fontWeight: 900, color: t.text, lineHeight: 1.08, marginBottom: 28 }}>{nameSpaced(p.userName || '이름')}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.text, lineHeight: 1.38 }}>{shorten(p.headline || p.targetPosition || 'Portfolio', 90)}</div>
        <div style={{ fontSize: 14, color: t.sub, marginTop: 170 }}>Casebook Timeline Portfolio</div>
      </div>
      <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 8, padding: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: t.sub, marginBottom: 24 }}>PROJECT SEQUENCE</div>
        {stories.slice(0, 6).map((story, idx) => <div key={idx} style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
          <span style={{ width: 18, height: 18, borderRadius: 9, background: idx === 0 ? t.accent : t.div, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{shorten(previewExpTitle(story.exp, story.expIdx), 36)}</span>
        </div>)}
        {stories.length > 6 && <div style={{ fontSize: 12, color: t.sub }}>{`+ ${stories.length - 6} more`}</div>}
      </div>
    </div>
  </Slide>;
}

function Test2SummarySlide({ p, t }) {
  const stories = previewT1ProjectStories(p);
  const sectionCount = stories.reduce((sum, proof) => sum + previewT1SectionCards(proof.exp, proof.fields).length, 0);
  return <Slide t={t} bg={t.bg}>
    <div style={{ padding: 54 }}>
      <Test1Label num={1} t={t}>CASEBOOK OVERVIEW</Test1Label>
      <div style={{ fontSize: 30, fontWeight: 900, color: t.text, marginBottom: 30 }}>경험 흐름을 한눈에 읽는 케이스북 구성</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 36 }}>
        <MetricCard label="Projects" value={`${stories.length}건`} t={t} />
        <MetricCard label="Sections" value={`${sectionCount}개`} t={t} />
        <MetricCard label="Skills" value={`${previewSkillNames(p, 99).length}개`} t={t} />
        <MetricCard label="Evidence" value={`${stories.filter(proof => previewProofMetric(proof)).length}건`} t={t} />
      </div>
      <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 8, padding: 26 }}>
        {stories.slice(0, 6).map((proof, idx) => <div key={idx} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 260px', gap: 14, alignItems: 'center', padding: '10px 0', borderBottom: idx === Math.min(stories.length, 6) - 1 ? 'none' : `1px solid ${t.div}` }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: t.accent }}>{String(idx + 1).padStart(2, '0')}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{shorten(previewExpTitle(proof.exp, proof.expIdx), 50)}</span>
          <span style={{ fontSize: 12, color: t.sub }}>{shorten(previewMetricDisplay(proof), 42)}</span>
        </div>)}
      </div>
    </div>
  </Slide>;
}

function Test2CaseSlide({ proof, t }) {
  const exp = proof.exp;
  const f = proof.fields || extractFields(exp);
  const item = proof.item || {};
  const steps = [
    ['01', 'Problem', item.situation || f.overview || f.description || f.intro],
    ['02', 'Action', item.action || [f.task, f.process].filter(Boolean).join('\n')],
    ['03', 'Impact', item.result || [f.output, f.growth || f.competency].filter(Boolean).join('\n')],
  ];
  return <Slide t={t} bg={t.bg}>
    <div style={{ padding: 54 }}>
      <Test1Label num={proof.expIdx + 2} t={t}>CASEBOOK PROJECT</Test1Label>
      <div style={{ fontSize: 28, fontWeight: 900, color: t.text, marginBottom: 8 }}>{shorten(previewExpTitle(exp, proof.expIdx), 76)}</div>
      <div style={{ fontSize: 12, color: t.sub, marginBottom: 28 }}>{[f.projectOverview?.duration || exp.period || exp.date, f.projectOverview?.role || exp.role].filter(Boolean).join(' · ')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: 28 }}>
        <div>
          {steps.map(([num, label, content], idx) => <div key={label} style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: 18, alignItems: 'center', marginBottom: 22 }}>
            <span style={{ width: 28, height: 28, borderRadius: 14, background: idx === 2 ? t.accent : t.step, color: idx === 2 ? '#fff' : t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>{num}</span>
            <Test1PointCard label={label} t={t} accent={idx === 2}>{content}</Test1PointCard>
          </div>)}
        </div>
        <Test1MetricVisual proof={proof} t={t} />
      </div>
    </div>
  </Slide>;
}

function Test2SectionDigestSlide({ proof, pageIdx, cards, t }) {
  const exp = proof.exp;
  return <Slide t={t} bg={t.bg}>
    <div style={{ padding: 54 }}>
      <Test1Label num={proof.expIdx + 2} t={t}>{`CASEBOOK NOTES ${pageIdx + 1}`}</Test1Label>
      <div style={{ fontSize: 27, fontWeight: 900, color: t.text, marginBottom: 26 }}>{shorten(previewExpTitle(exp, proof.expIdx), 72)}</div>
      {cards.map((card, idx) => <div key={idx} style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 18, alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: t.accent }}>{String(idx + 1 + pageIdx * 4).padStart(2, '0')}</span>
        <Test1PointCard label={card.label} t={t}>{card.content}</Test1PointCard>
      </div>)}
    </div>
  </Slide>;
}

function Test3CoverSlide({ p, t }) {
  const skills = previewSkillNames(p, 12);
  return <Slide t={t} bg={t.bg}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 50, background: t.accent }} />
    <div style={{ padding: 72, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 54 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, color: t.accent, marginBottom: 34 }}>TEST3 TEMPLATE / PORTFOLIO REPORT</div>
        <div style={{ fontSize: 54, fontWeight: 900, color: t.text, lineHeight: 1.08, marginBottom: 28 }}>{nameSpaced(p.userName || '이름')}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.text, lineHeight: 1.38 }}>{shorten(p.headline || p.targetPosition || 'Portfolio', 90)}</div>
        <div style={{ fontSize: 14, color: t.sub, marginTop: 170 }}>Evidence Dashboard</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignContent: 'flex-start', marginTop: 54 }}>
        {skills.slice(0, 8).map((skill, idx) => <span key={idx} style={{ background: t.badge, border: `1px solid ${t.div}`, borderRadius: 16, padding: '8px 14px', fontSize: 12, color: t.text, fontWeight: 800 }}>{shorten(skill, 15)}</span>)}
      </div>
    </div>
  </Slide>;
}

function Test3SummarySlide({ p, t }) {
  const stories = previewT1ProjectStories(p);
  const sectionCount = stories.reduce((sum, proof) => sum + previewT1SectionCards(proof.exp, proof.fields).length, 0);
  return <Slide t={t} bg={t.bg}>
    <div style={{ padding: 54 }}>
      <Test1Label num={1} t={t}>REPORT SNAPSHOT</Test1Label>
      <div style={{ fontSize: 30, fontWeight: 900, color: t.text, marginBottom: 30 }}>성과와 섹션을 대시보드처럼 정리한 리포트 구성</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 34 }}>
        <MetricCard label="Projects" value={`${stories.length}`} t={t} />
        <MetricCard label="Sections" value={`${sectionCount}`} t={t} />
        <MetricCard label="Skills" value={`${previewSkillNames(p, 99).length}`} t={t} />
        <MetricCard label="Awards" value={`${(p.awards || []).length}`} t={t} />
      </div>
      <div style={{ background: t.card, border: `1px solid ${t.div}`, borderRadius: 8, padding: 30 }}>
        <SectionBold t={t}>Portfolio Positioning</SectionBold>
        <div style={{ fontSize: 16, lineHeight: 1.75, color: t.text }}>{shorten(p.about || p.valuesEssay || p.headline || '지원 직무와 연결되는 경험, 성과 지표, 프로젝트 섹션을 리포트 형태로 압축했습니다.', 210)}</div>
      </div>
    </div>
  </Slide>;
}

function Test3CaseSlide({ proof, t }) {
  const exp = proof.exp;
  const f = proof.fields || extractFields(exp);
  const item = proof.item || {};
  const cards = [
    ['Problem', item.situation || f.overview || f.description || f.intro],
    ['Action', item.action || [f.task, f.process].filter(Boolean).join('\n')],
    ['Result', item.result || f.output],
    ['Growth', f.growth || f.competency],
  ];
  return <Slide t={t} bg={t.bg}>
    <div style={{ padding: 54 }}>
      <Test1Label num={proof.expIdx + 2} t={t}>PROJECT DASHBOARD</Test1Label>
      <div style={{ fontSize: 28, fontWeight: 900, color: t.text, marginBottom: 8 }}>{shorten(previewExpTitle(exp, proof.expIdx), 74)}</div>
      <div style={{ fontSize: 12, color: t.sub, marginBottom: 24 }}>{[f.projectOverview?.duration || exp.period || exp.date, f.projectOverview?.role || exp.role].filter(Boolean).join(' · ')}</div>
      <div style={{ background: t.resBg, border: `1px solid ${t.resBd}`, borderRadius: 8, padding: 22, marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: t.sub, marginBottom: 8 }}>{item.metricLabel || 'Impact Metric'}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: t.accent }}>{shorten(previewMetricDisplay(proof), 46)}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {cards.map(([label, content], idx) => <Test1PointCard key={label} label={label} t={t} accent={idx === 2}>{content}</Test1PointCard>)}
      </div>
    </div>
  </Slide>;
}

function Test3SectionDigestSlide({ proof, pageIdx, cards, t }) {
  const exp = proof.exp;
  return <Slide t={t} bg={t.bg}>
    <div style={{ padding: 54 }}>
      <Test1Label num={proof.expIdx + 2} t={t}>{`REPORT DETAILS ${pageIdx + 1}`}</Test1Label>
      <div style={{ fontSize: 27, fontWeight: 900, color: t.text, marginBottom: 24 }}>{shorten(previewExpTitle(exp, proof.expIdx), 72)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {cards.map((card, idx) => <Test1PointCard key={idx} label={card.label} t={t} accent={idx === 0}>{card.content}</Test1PointCard>)}
      </div>
    </div>
  </Slide>;
}


