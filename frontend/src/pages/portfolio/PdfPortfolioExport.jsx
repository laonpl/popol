/**
 * PdfPortfolioExport.jsx
 * Wanted Portfolio Style - Premium Keynote PPT Preview
 * 구조: Cover → Profile → Skills → [SectionDivider + Situation + Result] × N → Outro
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, ChevronDown } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';
import { generatePptx } from './generatePptx';

const SW = 1200;
const SH = 675;

const THEMES = {
  developer: {
    label: 'Tech-Driven (개발자형)',
    bg: '#0d1117', coverBg: '#161b22', accent: '#58a6ff',
    text: '#e6edf3', sub: '#8b949e', div: '#30363d',
    card: '#1c2128', step: '#21262d', tag: '#21262d',
    badge: '#21262d', resBg: 'rgba(88,166,255,0.08)', resBd: 'rgba(88,166,255,0.28)',
    dark: true, mono: true,
  },
  data_dashboard: {
    label: 'Data-Dashboard (PO/마케터)',
    bg: '#04090f', coverBg: '#020609', accent: '#00d4aa',
    text: '#c8e8e0', sub: '#508070', div: '#0a2828',
    card: '#061818', step: '#082020', tag: '#0a1c1c',
    badge: '#061818', resBg: 'rgba(0,212,170,0.08)', resBd: 'rgba(0,212,170,0.28)',
    dark: true, mono: true,
  },
  designer: {
    label: 'Process-Canvas (디자이너)',
    bg: '#faf9ff', coverBg: '#ede9fe', accent: '#7c3aed',
    text: '#1f1235', sub: '#6b7280', div: '#ddd6fe',
    card: '#f5f3ff', step: '#ede9fe', tag: '#ede9fe',
    badge: '#ede9fe', resBg: '#f5f3ff', resBd: '#c4b5fd',
    dark: false, mono: false,
  },
  marketer_dark: {
    label: 'Storyteller (브랜드마케터)',
    bg: '#606060', coverBg: '#4a4a4a', accent: '#d4f200',
    text: '#ffffff', sub: 'rgba(255,255,255,0.58)', div: 'rgba(255,255,255,0.18)',
    card: 'rgba(0,0,0,0.18)', step: 'rgba(255,255,255,0.06)', tag: 'rgba(212,242,0,0.14)',
    badge: 'rgba(255,255,255,0.09)', resBg: 'rgba(212,242,0,0.12)', resBd: 'rgba(212,242,0,0.35)',
    dark: true, mono: false,
  },
  problem_solver: {
    label: 'Problem-Solver (컨설턴트)',
    bg: '#0f1e3a', coverBg: '#091527', accent: '#ff6b35',
    text: '#e8f0ff', sub: '#8aa0c0', div: '#1e344f',
    card: '#0d1c35', step: '#132244', tag: '#172840',
    badge: '#172840', resBg: 'rgba(255,107,53,0.10)', resBd: 'rgba(255,107,53,0.32)',
    dark: true, mono: false,
  },
  minimalist: {
    label: 'Minimalist (미니멀)',
    bg: '#ffffff', coverBg: '#f6f6f6', accent: '#111111',
    text: '#111111', sub: '#888888', div: '#e0e0e0',
    card: '#f8f8f8', step: '#f2f2f2', tag: '#eeeeee',
    badge: '#f0f0f0', resBg: '#f5f5f5', resBd: '#cccccc',
    dark: false, mono: false,
  },
  marketer_light: {
    label: 'Marketer / PM (라이트)',
    bg: '#f0f2f7', coverBg: '#e8ecf4', accent: '#2d3d9b',
    text: '#1a1a2e', sub: '#555577', div: '#d0d8f0',
    card: '#ffffff', step: '#eef0fb', tag: '#dde3f8',
    badge: '#eef0fb', resBg: '#e8ecff', resBd: '#b8c0f0',
    dark: false, mono: false,
  },
  t_shaped: {
    label: 'T-Shaped (다능자형)',
    bg: '#fffbf2', coverBg: '#fff7e6', accent: '#d97706',
    text: '#1c0f00', sub: '#7a6040', div: '#e8d0a0',
    card: '#fff9ed', step: '#fef3d0', tag: '#fde68a',
    badge: '#fef3d0', resBg: '#fef3d0', resBd: '#f0c060',
    dark: false, mono: false,
  },
  rookie: {
    label: 'Rookie (신입/대학생)',
    bg: '#f0f9ff', coverBg: '#e0f2fe', accent: '#0ea5e9',
    text: '#0c2a3a', sub: '#4a7a96', div: '#bae6fd',
    card: '#e8f6ff', step: '#ddf3ff', tag: '#cceeff',
    badge: '#e0f5ff', resBg: '#e0f5ff', resBd: '#7dd3fc',
    dark: false, mono: false,
  },
  star_classic: {
    label: 'STAR Framework (전략형)',
    bg: '#fafafa', coverBg: '#f0f0f0', accent: '#2563eb',
    text: '#1a1a2e', sub: '#555577', div: '#d0d8e8',
    card: '#f4f6fa', step: '#eef1f8', tag: '#e8ecf8',
    badge: '#eef2ff', resBg: '#eef2ff', resBd: '#b8c8f0',
    dark: false, mono: false,
  },
};

/* ─── Layout Routing ─── */
function getLayout(theme){
  if(!theme) return 'default';
  if(['developer','data_dashboard'].includes(theme)) return 'tech';
  if(['marketer_dark','marketer_light'].includes(theme)) return 'story';
  if(['problem_solver','star_classic'].includes(theme)) return 'consult';
  if(theme==='designer') return 'design';
  return 'default';
}

/* ─── Utils ─── */
function strip(txt) {
  if (txt == null) return '';
  const s = Array.isArray(txt) ? txt.join(', ') : String(txt);
  return s.replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1')
    .replace(/#{1,6}\s*/g,'').replace(/`(.+?)`/g,'$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/^>\s*/gm,'').trim();
}
function extractFields(exp){
  const sr=exp.structuredResult||{}, fc=exp.frameworkContent||{}, fs={};
  (exp.sections||[]).forEach(s=>{
    const t=(s.title||'').replace(/\s/g,''), c=s.content?.trim();
    if(!c) return;
    if(/소개|intro/i.test(t)) fs.intro=fs.intro||c;
    else if(/개요|overview|배경/i.test(t)) fs.overview=fs.overview||c;
    else if(/진행|task|문제|일/i.test(t)) fs.task=fs.task||c;
    else if(/과정|process/i.test(t)) fs.process=fs.process||c;
    else if(/결과물|output/i.test(t)) fs.output=fs.output||c;
    else if(/성장|growth|배운/i.test(t)) fs.growth=fs.growth||c;
    else if(/역량|competency/i.test(t)) fs.competency=fs.competency||c;
  });
  const g=k=>strip(sr[k]?.trim?.()||fc[k]?.trim?.()||fs[k]?.trim?.()||'');
  return {
    intro:g('intro'),overview:g('overview'),task:g('task'),process:g('process'),
    output:g('output'),growth:g('growth'),competency:g('competency'),
    description:strip(exp.description?.trim()||''),
    aiSummary:strip(exp.aiSummary?.trim()||sr.projectOverview?.summary?.trim()||''),
    keyExperiences:sr.keyExperiences||[], projectOverview:sr.projectOverview||{},
  };
}
function toBullets(text,max=5){
  if(!text)return[];
  return text.split('\n').map(l=>strip(l.replace(/^(\d+[.)]\s*|[-•▸■□·]\s*)/,'').trim()))
    .filter(l=>l.length>3).slice(0,max);
}
function shorten(txt,max=60){
  if(!txt)return '';
  const s=strip(txt);
  return s.length>max?s.slice(0,max)+'...':s;
}
function nameSpaced(name){
  if(!name)return name;
  const n=name.trim();
  if(n.length===3&&/[가-힣]/.test(n)) return n[0]+' '+n[1]+' '+n[2];
  return n;
}

/* ─── Atoms ─── */
function Slide({t,bg,children,style={}}){
  return <div className="ppt-slide" style={{
    width:SW,height:SH,flexShrink:0,backgroundColor:bg||t.bg,
    position:'relative',overflow:'hidden',boxSizing:'border-box',
    fontFamily:"'Pretendard','Apple SD Gothic Neo','Noto Sans KR',-apple-system,sans-serif",
    ...style}}>{children}</div>;
}
function SectionLabel({children,t}){
  return (
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
      <span style={{fontSize:9,fontWeight:800,letterSpacing:3.5,color:t.sub,
        textTransform:'uppercase',flexShrink:0,whiteSpace:'nowrap'}}>{children}</span>
      <div style={{flex:1,height:1,background:t.div}}/>
    </div>
  );
}
function ProjectLabel({num,category,t}){
  return (
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
      <span style={{fontSize:8.5,fontWeight:800,letterSpacing:3,color:t.accent,
        textTransform:'uppercase',flexShrink:0}}>PROJECT {num}</span>
      <span style={{fontSize:8.5,color:t.sub,flexShrink:0}}>—</span>
      <span style={{fontSize:8.5,fontWeight:600,letterSpacing:2,color:t.sub,
        textTransform:'uppercase',flexShrink:0}}>{category}</span>
      <div style={{flex:1,height:1,background:t.div}}/>
    </div>
  );
}
function SlideTitle({children,t,size=28}){
  return <div style={{fontSize:size,fontWeight:900,color:t.text,letterSpacing:-1,lineHeight:1.1,marginBottom:20}}>{children}</div>;
}
function SectionBold({children,t,size=15}){
  return <div style={{fontSize:size,fontWeight:800,color:t.accent,marginBottom:10,letterSpacing:-0.3}}>{children}</div>;
}
function CheckBullet({children,t}){
  return (
    <div style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
      <div style={{flexShrink:0,width:15,height:15,border:`1.5px solid ${t.div}`,
        borderRadius:3,marginTop:3,background:t.accent+'10'}}/>
      <span style={{fontSize:14,color:t.text,lineHeight:1.7,fontWeight:500}}>{children}</span>
    </div>
  );
}
function StepBullet({step,children,t}){
  return (
    <div style={{display:'flex',gap:10,marginBottom:14,alignItems:'flex-start'}}>
      <span style={{fontSize:12.5,fontWeight:800,color:t.accent,flexShrink:0,
        marginTop:1,fontFamily:t.mono?'monospace':'inherit',letterSpacing:-0.3}}>Step{step}.</span>
      <span style={{fontSize:14,color:t.text,lineHeight:1.7}}>{children}</span>
    </div>
  );
}
function ArrowBullet({children,t}){
  return (
    <div style={{display:'flex',gap:10,marginBottom:11,alignItems:'flex-start'}}>
      <span style={{fontSize:13,color:t.accent,flexShrink:0,marginTop:1,fontWeight:800}}>{'▸'}</span>
      <span style={{fontSize:13.5,color:t.text,lineHeight:1.65}}>{children}</span>
    </div>
  );
}
function Pill({children,t}){
  return <span style={{fontSize:11.5,padding:'5px 13px',background:t.badge,border:`1px solid ${t.div}`,
    borderRadius:16,color:t.text,fontWeight:600,whiteSpace:'nowrap'}}>{children}</span>;
}
function MetricCard({label,value,t}){
  return <div style={{flex:1,padding:'16px 20px',background:t.resBg,borderRadius:10,
    border:`1px solid ${t.resBd}`,minWidth:0}}>
    <div style={{fontSize:8,fontWeight:700,letterSpacing:2,color:t.sub,textTransform:'uppercase',marginBottom:8}}>{label}</div>
    <div style={{fontSize:28,fontWeight:900,color:t.accent,lineHeight:1.1}}>{value}</div>
  </div>;
}
function BarCompare({before,after,t}){
  const pn=v=>parseFloat(String(v).replace(/[^0-9.]/g,''))||0;
  const bV=pn(before),aV=pn(after),mx=Math.max(bV,aV,1);
  return <div style={{marginTop:8}}>
    <div style={{marginBottom:6}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <span style={{fontSize:9,color:t.sub,fontWeight:700}}>AS-IS</span>
        <span style={{fontSize:9,color:t.sub}}>{strip(String(before))}</span>
      </div>
      <div style={{height:8,background:t.div+'55',borderRadius:4,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${Math.min(bV/mx*100,100)}%`,background:t.sub,borderRadius:4}}/>
      </div>
    </div>
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <span style={{fontSize:9,color:t.accent,fontWeight:700}}>TO-BE</span>
        <span style={{fontSize:9,color:t.accent,fontWeight:800}}>{strip(String(after))}</span>
      </div>
      <div style={{height:10,background:t.div+'55',borderRadius:5,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${Math.min(aV/mx*100,100)}%`,background:t.accent,borderRadius:5}}/>
      </div>
    </div>
  </div>;
}

/* ─── 1. COVER (ref: image 6 style - clean personal intro) ─── */
function CoverSlide({p,t,theme}){
  const c=p.contact||{};
  const contacts=[c.email,c.phone,c.github,c.instagram?'@'+c.instagram.replace('@',''):''].filter(Boolean);
  const vals=(p.values||[]).slice(0,5).map(v=>v.keyword||String(v));
  return (
    <Slide t={t} bg={t.coverBg}>
      {t.dark&&<>
        <div style={{position:'absolute',top:-100,left:-60,width:320,height:320,borderRadius:'50%',
          background:`radial-gradient(circle, ${t.accent}20, transparent 65%)`}}/>
        <div style={{position:'absolute',bottom:-100,right:-60,width:280,height:280,borderRadius:'50%',
          background:`radial-gradient(circle, ${t.div}50, transparent 65%)`}}/>
      </>}
      <div style={{position:'absolute',top:0,left:0,width:5,height:'100%',background:t.accent}}/>
      <div style={{height:'100%',display:'flex',alignItems:'center',padding:'0 100px'}}>
        <div style={{display:'flex',gap:60,alignItems:'center',width:'100%'}}>
          {/* Left: Avatar + Name */}
          <div style={{flexShrink:0}}>
            <div style={{width:100,height:100,borderRadius:'50%',marginBottom:20,
              background:`linear-gradient(135deg, ${t.accent}50, ${t.div}80)`,
              border:`3px solid ${t.accent}40`,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontSize:36,fontWeight:900,color:t.accent,opacity:0.8}}>
                {(p.userName||'?').trim()[0]}
              </span>
            </div>
            <div style={{fontSize:14,fontWeight:700,color:t.accent,letterSpacing:0.5,marginBottom:10}}>
              {p.targetPosition||'Portfolio'}
            </div>
            <div style={{fontSize:52,fontWeight:900,color:t.text,letterSpacing:'0.12em',lineHeight:1.1,marginBottom:16}}>
              {nameSpaced(p.userName||'이름')}
            </div>
            {vals.length>0&&(
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {vals.map((v,i)=><span key={i} style={{fontSize:11,color:t.sub,fontWeight:500}}>{'#'+v}</span>)}
              </div>
            )}
          </div>
          {/* Right: Tagline + Contact */}
          <div style={{flex:1}}>
            {p.headline&&(
              <div style={{padding:'20px 24px',background:t.dark?'rgba(255,255,255,0.05)':t.card,
                borderLeft:`3px solid ${t.accent}`,borderRadius:'0 12px 12px 0',marginBottom:24,
                border:`1px solid ${t.div}`,borderLeftColor:t.accent}}>
                <p style={{fontSize:16,color:t.text,lineHeight:1.7,margin:0,fontWeight:500}}>
                  {shorten(p.headline,100)}
                </p>
              </div>
            )}
            {contacts.length>0&&(
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {contacts.map((l,i)=><span key={i} style={{fontSize:11,color:t.sub,
                  fontFamily:t.mono?'monospace':'inherit'}}>{l}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* ─── 2. PROFILE — 데이터 밀도 적응형 레이아웃 ─── */
function ProfileSlide({p,t}){
  const edu=(p.education||[]).slice(0,4);
  const sk=p.skills||{};
  const langs=[...(sk.languages||[]),...(sk.frameworks||[])].map(s=>typeof s==='string'?s:s?.name).filter(Boolean).slice(0,14);
  const tools=(sk.tools||[]).map(s=>typeof s==='string'?s:s?.name).filter(Boolean).slice(0,10);
  const exps=(p.experiences||[]).slice(0,4);
  const awards=(p.awards||[]).slice(0,4);
  // 컨텐츠 양에 따라 폰트·여백 스케일 결정 (적을수록 시원하게)
  const density=edu.length+exps.length+awards.length;
  const scale=density<=2?1.25:density<=4?1.1:1;
  const s=(n)=>Math.round(n*scale);
  const eduCardPad=scale>1.15?'18px 22px':'14px 18px';
  const expCardPad=scale>1.15?'16px 20px':'14px 16px';
  return (
    <Slide t={t}>
      <div style={{padding:'44px 60px',height:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',alignItems:'baseline',gap:14,marginBottom:24}}>
          <span style={{fontSize:10,fontWeight:800,letterSpacing:4,color:t.sub,textTransform:'uppercase',flexShrink:0}}>PROFILE</span>
          <div style={{flex:1,height:1,background:t.div}}/>
          <span style={{fontSize:11,color:t.sub,fontWeight:500,whiteSpace:'nowrap'}}>{p.userName||''}{p.targetPosition?' · '+p.targetPosition:''}</span>
        </div>
        {p.headline&&(
          <div style={{padding:'14px 18px',background:t.card,borderLeft:`4px solid ${t.accent}`,borderRadius:'0 10px 10px 0',marginBottom:22,border:`1px solid ${t.div}`,borderLeftColor:t.accent}}>
            <div style={{fontSize:s(14),color:t.text,lineHeight:1.6,fontWeight:500}}>{shorten(p.headline,140)}</div>
          </div>
        )}
        <div style={{flex:1,display:'flex',gap:36,minHeight:0}}>
          {/* Left 40% */}
          <div style={{flex:'0 0 38%',display:'flex',flexDirection:'column',gap:20,minHeight:0}}>
            {edu.length>0&&(
              <div style={{display:'flex',flexDirection:'column'}}>
                <SectionBold t={t} size={s(14)}>Education</SectionBold>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {edu.map((e,i)=>(
                    <div key={i} style={{padding:eduCardPad,background:t.card,borderRadius:10,border:`1px solid ${t.div}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                        <span style={{fontSize:s(15),fontWeight:800,color:t.text,lineHeight:1.3}}>{e.name}</span>
                        {e.period&&<span style={{fontSize:s(10),color:t.sub,flexShrink:0,fontWeight:500}}>{e.period}</span>}
                      </div>
                      {e.degree&&<div style={{fontSize:s(12),color:t.sub,marginTop:6,lineHeight:1.4}}>{e.degree}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {langs.length>0&&(
              <div>
                <SectionBold t={t} size={s(14)}>Tech Stack</SectionBold>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {langs.map((sv,i)=><Pill key={i} t={t}>{sv}</Pill>)}
                </div>
              </div>
            )}
            {langs.length===0&&tools.length>0&&(
              <div>
                <SectionBold t={t} size={s(14)}>Tools</SectionBold>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {tools.map((sv,i)=><Pill key={i} t={t}>{sv}</Pill>)}
                </div>
              </div>
            )}
            {/* 빈 공간 흡수용 Bio/Values */}
            {(edu.length<=1||!langs.length)&&(p.values||[]).length>0&&(
              <div style={{marginTop:'auto'}}>
                <SectionBold t={t} size={s(13)}>Core Values</SectionBold>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {(p.values||[]).slice(0,6).map((v,i)=><Pill key={i} t={t}>{v.keyword||String(v)}</Pill>)}
                </div>
              </div>
            )}
          </div>
          <div style={{width:1,background:t.div,flexShrink:0}}/>
          {/* Right 60% */}
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:18,minHeight:0}}>
            {exps.length>0&&(
              <div style={{display:'flex',flexDirection:'column',flex:exps.length<=2?1:'none',minHeight:0}}>
                <SectionBold t={t} size={s(14)}>Work Experience</SectionBold>
                <div style={{display:'flex',flexDirection:'column',gap:exps.length<=2?14:8,flex:exps.length<=2?1:'none'}}>
                  {exps.map((e,i)=>(
                    <div key={i} style={{display:'flex',gap:16,padding:expCardPad,background:t.card,borderRadius:10,
                      border:`1px solid ${t.div}`,flex:exps.length<=2?1:'none'}}>
                      <div style={{width:s(44),height:s(44),borderRadius:10,flexShrink:0,
                        background:`linear-gradient(135deg,${t.accent}35,${t.div}80)`,
                        display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <span style={{fontSize:s(18),fontWeight:900,color:t.accent}}>
                          {(e.organization||e.title||'?').trim()[0]}
                        </span>
                      </div>
                      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',justifyContent:'center'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10}}>
                          <span style={{fontSize:s(15),fontWeight:800,color:t.text,lineHeight:1.3}}>{e.organization||shorten(e.title,24)}</span>
                          {e.date&&<span style={{fontSize:s(10),color:t.sub,flexShrink:0,fontWeight:500}}>{e.date}</span>}
                        </div>
                        {e.role&&<div style={{fontSize:s(12),color:t.accent,fontWeight:700,marginTop:4}}>{e.role}</div>}
                        {e.description&&<div style={{fontSize:s(11),color:t.sub,marginTop:6,lineHeight:1.5,
                          display:'-webkit-box',WebkitLineClamp:exps.length<=2?3:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                          {strip(e.description)}
                        </div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {awards.length>0&&(
              <div style={{marginTop:exps.length>2?'auto':0}}>
                <SectionBold t={t} size={s(14)}>Awards &amp; Certifications</SectionBold>
                <div style={{display:'flex',flexDirection:'column'}}>
                  {awards.map((a,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                      padding:'10px 0',borderBottom:`1px solid ${t.div}55`}}>
                      <span style={{fontSize:s(13),fontWeight:700,color:t.text}}>{a.title}</span>
                      {a.date&&<span style={{fontSize:s(11),color:t.sub}}>{a.date}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {exps.length===0&&awards.length===0&&tools.length>0&&(
              <div>
                <SectionBold t={t} size={s(14)}>Tools &amp; Platforms</SectionBold>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {tools.map((sv,i)=><Pill key={i} t={t}>{sv}</Pill>)}
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
function SkillsSlide({p,t}){
  const sk=p.skills||{};
  const rows=[];
  const langs=[...(sk.languages||[]),...(sk.frameworks||[])].map(s=>typeof s==='string'?s:s?.name).filter(Boolean);
  const tools=(sk.tools||[]).map(s=>typeof s==='string'?s:s?.name).filter(Boolean);
  const others=(sk.others||[]).map(s=>typeof s==='string'?s:s?.name).filter(Boolean);
  const vals=(p.values||[]).slice(0,3);
  if(langs.length>0) rows.push({emoji:'💻',name:'Technical Skills',items:langs.slice(0,8)});
  if(tools.length>0) rows.push({emoji:'🛠️',name:'Tools & Platforms',items:tools.slice(0,8)});
  if(others.length>0) rows.push({emoji:'✨',name:'Other Skills',items:others.slice(0,8)});
  if(vals.length>0&&rows.length<3) rows.push({emoji:'🎯',name:'Core Competency',items:vals.map(v=>v.keyword||String(v))});
  const show=rows.slice(0,3);
  if(show.length===0) return null;
  return (
    <Slide t={t}>
      <div style={{padding:'40px 56px',height:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column'}}>
        <SectionLabel t={t}>SKILLS</SectionLabel>
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'space-around',gap:8}}>
          {show.map((row,i)=>(
            <div key={i} style={{display:'flex',gap:32,alignItems:'center',
              padding:'18px 24px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`}}>
              {/* Icon circle */}
              <div style={{width:56,height:56,borderRadius:'50%',flexShrink:0,
                background:`linear-gradient(135deg,${t.accent}30,${t.div}60)`,
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
                {row.emoji}
              </div>
              {/* Category name */}
              <div style={{flex:'0 0 180px'}}>
                <div style={{fontSize:14,fontWeight:800,color:t.accent,letterSpacing:-0.3}}>{row.name}</div>
              </div>
              {/* Horizontal divider */}
              <div style={{width:1,height:40,background:t.div,flexShrink:0}}/>
              {/* Items */}
              <div style={{flex:1,display:'flex',flexWrap:'wrap',gap:6}}>
                {row.items.map((item,j)=><Pill key={j} t={t}>{item}</Pill>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/* ─── 4. SECTION DIVIDER (ref: image 3 — cinematic dark + gradient blobs) ─── */
function SectionDivider({exp,idx,t}){
  const darkBg='#0a0a0f';
  const ac=t.accent;
  return (
    <Slide t={t} bg={darkBg}>
      <div style={{position:'absolute',top:-80,left:-40,width:300,height:300,borderRadius:'50%',
        background:`radial-gradient(circle, ${ac}35, transparent 70%)`}}/>
      <div style={{position:'absolute',bottom:-80,right:-40,width:280,height:280,borderRadius:'50%',
        background:`radial-gradient(circle, #1a4a4a60, transparent 70%)`}}/>
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        opacity:0.06,fontSize:200,fontWeight:900,color:'#ffffff',letterSpacing:'-10px',
        whiteSpace:'nowrap',userSelect:'none'}}>
        {String(idx+1).padStart(2,'0')}
      </div>
      <div style={{height:'100%',display:'flex',flexDirection:'column',
        justifyContent:'center',padding:'60px 100px',position:'relative'}}>
        <div style={{fontSize:9,fontWeight:800,letterSpacing:4,color:ac,textTransform:'uppercase',marginBottom:16}}>
          {'PROJECT '+String(idx+1).padStart(2,'0')}
        </div>
        <div style={{fontSize:54,fontWeight:900,color:'#ffffff',letterSpacing:-2,lineHeight:1.1,maxWidth:700}}>
          {exp.title||'프로젝트'}
        </div>
        {exp.role&&(
          <div style={{marginTop:20,fontSize:15,color:'rgba(255,255,255,0.5)',fontWeight:500}}>
            {exp.role}{exp.date?' · '+exp.date:''}
          </div>
        )}
      </div>
    </Slide>
  );
}

/* ─── 5. SITUATION SLIDES — 레이아웃별 구현 ─── */

/* 5a. Default: 2컬럼 카드 */
function SituationDefaultSlide({exp,idx,t,f}){
  const num=String(idx+1).padStart(2,'0');
  const spBullets=toBullets(f.task||f.overview||f.description,3).slice(0,3);
  const solBullets=toBullets(f.process||f.intro,3).slice(0,3);
  return (
    <Slide t={t}>
      <div style={{padding:'36px 56px',height:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column'}}>
        <ProjectLabel num={num} category="CAREER" t={t}/>
        <SlideTitle t={t} size={26}>{shorten(exp.title||'프로젝트',40)}</SlideTitle>
        <div style={{flex:1,padding:'22px 26px',background:t.card,borderRadius:14,border:`1px solid ${t.div}`,display:'flex',gap:24,overflow:'hidden'}}>
          {spBullets.length>0&&<div style={{flex:1,overflow:'hidden'}}>
            <SectionBold t={t} size={14}>Situation &amp; Problem</SectionBold>
            {spBullets.map((b,i)=><CheckBullet key={i} t={t}>{b}</CheckBullet>)}
            {(exp.role||f.aiSummary)&&<div style={{marginTop:12,padding:'10px 14px',background:t.step,borderRadius:8,borderLeft:`3px solid ${t.accent}`}}>
              <p style={{fontSize:11,color:t.sub,margin:0,lineHeight:1.6}}>{shorten(exp.role?exp.role+(exp.date?' · '+exp.date:''):f.aiSummary,130)}</p>
            </div>}
          </div>}
          {spBullets.length>0&&solBullets.length>0&&<div style={{width:1,background:t.div,flexShrink:0}}/>}
          {solBullets.length>0&&<div style={{flex:1,overflow:'hidden'}}>
            <SectionBold t={t} size={14}>Solution</SectionBold>
            {solBullets.map((b,i)=><StepBullet key={i} step={i+1} t={t}>{b}</StepBullet>)}
          </div>}
        </div>
      </div>
    </Slide>
  );
}

/* 5b. Tech: Problem | Approach + context bar */
function SituationTechSlide({exp,idx,t,f}){
  const num=String(idx+1).padStart(2,'0');
  const spBullets=toBullets(f.task||f.overview||f.description,3).slice(0,3);
  const solBullets=toBullets(f.process||f.intro,4).slice(0,4);
  return (
    <Slide t={t}>
      <div style={{padding:'36px 56px 20px',height:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column',gap:12}}>
        <ProjectLabel num={num} category="TECHNICAL" t={t}/>
        <SlideTitle t={t} size={24}>{shorten(exp.title||'프로젝트',40)}</SlideTitle>
        <div style={{flex:1,display:'flex',gap:16,minHeight:0}}>
          {/* Problem card */}
          <div style={{flex:1,padding:'18px 22px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <span style={{fontSize:9,fontWeight:800,letterSpacing:3,color:t.accent,textTransform:'uppercase'}}>PROBLEM</span>
              <div style={{flex:1,height:1,background:t.div}}/>
            </div>
            {spBullets.map((b,i)=>(
              <div key={i} style={{display:'flex',gap:10,marginBottom:12,alignItems:'flex-start'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:t.accent+'80',flexShrink:0,marginTop:6}}/>
                <span style={{fontSize:13,color:t.text,lineHeight:1.65}}>{b}</span>
              </div>
            ))}
          </div>
          {/* Approach card */}
          <div style={{flex:1,padding:'18px 22px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <span style={{fontSize:9,fontWeight:800,letterSpacing:3,color:t.accent,textTransform:'uppercase'}}>APPROACH</span>
              <div style={{flex:1,height:1,background:t.div}}/>
            </div>
            {solBullets.map((b,i)=>(
              <div key={i} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
                <span style={{flexShrink:0,width:24,height:24,borderRadius:6,background:t.accent+'28',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:10,fontWeight:800,color:t.accent}}>{i+1}</span>
                <span style={{fontSize:13,color:t.text,lineHeight:1.65}}>{b}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Context bar */}
        <div style={{padding:'10px 18px',background:t.step,borderRadius:8,border:`1px solid ${t.div}55`,display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:8.5,fontWeight:800,letterSpacing:2,color:t.accent,textTransform:'uppercase',flexShrink:0}}>CONTEXT</span>
          <span style={{fontSize:11,color:t.sub,lineHeight:1.5}}>{shorten(f.aiSummary||exp.description||exp.role||'',160)}</span>
        </div>
      </div>
    </Slide>
  );
}

/* 5c. Story (마케터): Hero hook + Background | Challenge&Action */
function SituationStorySlide({exp,idx,t,f}){
  const num=String(idx+1).padStart(2,'0');
  const bgBullets=toBullets(f.overview||f.description||f.task,3).slice(0,3);
  const actBullets=toBullets(f.process||f.intro||f.task,3).slice(0,3);
  const hook=shorten(f.aiSummary||f.task||f.description||exp.title||'',110);
  const tags=['CHALLENGE','ACTION','APPROACH'];
  return (
    <Slide t={t}>
      <div style={{padding:'36px 56px',height:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column',gap:14}}>
        <ProjectLabel num={num} category="CAMPAIGN" t={t}/>
        {/* Hero hook */}
        <div style={{padding:'14px 20px',background:t.card,borderRadius:10,border:`1px solid ${t.div}`,borderLeft:`4px solid ${t.accent}`}}>
          <p style={{margin:0,fontSize:14,fontWeight:700,color:t.text,lineHeight:1.6}}>{hook}</p>
        </div>
        <div style={{flex:1,display:'flex',gap:16,minHeight:0}}>
          {/* Background */}
          <div style={{flex:1,padding:'18px 22px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <span style={{fontSize:9,fontWeight:800,letterSpacing:3,color:t.accent,textTransform:'uppercase'}}>BACKGROUND</span>
              <div style={{flex:1,height:1,background:t.div}}/>
            </div>
            {bgBullets.map((b,i)=>(
              <div key={i} style={{display:'flex',gap:10,marginBottom:12,alignItems:'flex-start'}}>
                <span style={{fontSize:14,color:t.accent,fontWeight:800,flexShrink:0,marginTop:1}}>·</span>
                <span style={{fontSize:13,color:t.text,lineHeight:1.65}}>{b}</span>
              </div>
            ))}
          </div>
          {/* Challenge & Action */}
          <div style={{flex:1,padding:'18px 22px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <span style={{fontSize:9,fontWeight:800,letterSpacing:3,color:t.accent,textTransform:'uppercase'}}>CHALLENGE &amp; ACTION</span>
              <div style={{flex:1,height:1,background:t.div}}/>
            </div>
            {actBullets.map((b,i)=>(
              <div key={i} style={{display:'flex',gap:10,marginBottom:12,alignItems:'flex-start'}}>
                <span style={{flexShrink:0,padding:'2px 8px',borderRadius:6,fontSize:8,fontWeight:800,color:'#fff',
                  background:t.accent+(i===0?'EE':i===1?'99':'55'),whiteSpace:'nowrap'}}>{tags[i]}</span>
                <span style={{fontSize:13,color:t.text,lineHeight:1.65}}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 5d. Consult / STAR: 4-quadrant */
function SituationConsultSlide({exp,idx,t,f}){
  const num=String(idx+1).padStart(2,'0');
  const quads=[
    {k:'S',name:'Situation',src:f.overview||f.description||f.task||''},
    {k:'T',name:'Task',src:f.task||f.process||''},
    {k:'A',name:'Action',src:f.process||f.intro||''},
    {k:'R',name:'Result',src:f.output||f.growth||f.aiSummary||''},
  ];
  return (
    <Slide t={t}>
      <div style={{padding:'32px 52px',height:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column',gap:12}}>
        <ProjectLabel num={num} category="S·T·A·R" t={t}/>
        <SlideTitle t={t} size={22}>{shorten(exp.title||'프로젝트',40)}</SlideTitle>
        <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',gap:12,minHeight:0}}>
          {quads.map(({k,name,src},i)=>{
            const bullets=toBullets(src,2).slice(0,2);
            return (
              <div key={i} style={{padding:'16px 20px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`,overflow:'hidden',position:'relative'}}>
                {/* Ghost letter */}
                <span style={{position:'absolute',right:16,bottom:8,fontSize:64,fontWeight:900,color:t.accent,opacity:0.08,lineHeight:1,userSelect:'none'}}>{k}</span>
                {/* Badge + label */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                  <span style={{width:28,height:28,borderRadius:7,background:t.accent,color:'#fff',
                    fontSize:12,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{k}</span>
                  <span style={{fontSize:10,fontWeight:800,color:t.accent,letterSpacing:2,textTransform:'uppercase'}}>{name}</span>
                </div>
                <div style={{height:1,background:t.div,marginBottom:12}}/>
                {bullets.length>0?bullets.map((b,j)=>(
                  <div key={j} style={{fontSize:13,color:t.text,lineHeight:1.6,marginBottom:6,
                    display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{b}</div>
                )):(
                  <div style={{fontSize:12.5,color:t.text,lineHeight:1.6,
                    display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{shorten(src,100)}</div>
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
function SituationDesignSlide({exp,idx,t,f}){
  const num=String(idx+1).padStart(2,'0');
  const probBullets=toBullets(f.task||f.overview||f.description,3).slice(0,3);
  const solBullets=toBullets(f.process||f.intro,3).slice(0,3);
  const steps=['Research','Define','Design','Deliver'];
  return (
    <Slide t={t}>
      <div style={{padding:'36px 56px',height:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column',gap:14}}>
        <ProjectLabel num={num} category="DESIGN" t={t}/>
        <SlideTitle t={t} size={22}>{shorten(exp.title||'프로젝트',40)}</SlideTitle>
        {/* Process bar */}
        <div style={{display:'flex',gap:4}}>
          {steps.map((s,i)=>{
            const active=i===1||i===2;
            return (
              <div key={i} style={{display:'flex',alignItems:'center',gap:4,flex:1}}>
                <div style={{flex:1,padding:'6px 10px',background:active?t.accent+'30':t.card,
                  border:`1px solid ${active?t.accent+'80':t.div}`,borderRadius:6,textAlign:'center'}}>
                  <span style={{fontSize:10,fontWeight:active?800:500,color:active?t.accent:t.sub}}>{s}</span>
                </div>
                {i<3&&<span style={{fontSize:12,color:t.accent,fontWeight:700}}>›</span>}
              </div>
            );
          })}
        </div>
        <div style={{flex:1,display:'flex',gap:16,minHeight:0}}>
          <div style={{flex:1,padding:'18px 22px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <span style={{fontSize:9,fontWeight:800,letterSpacing:3,color:t.accent,textTransform:'uppercase'}}>USER PROBLEM</span>
              <div style={{flex:1,height:1,background:t.div}}/>
            </div>
            {probBullets.map((b,i)=>(
              <div key={i} style={{display:'flex',gap:10,marginBottom:12,alignItems:'flex-start'}}>
                <div style={{width:18,height:18,borderRadius:'50%',background:t.accent+'30',flexShrink:0,marginTop:2,
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:t.accent}}/>
                </div>
                <span style={{fontSize:13,color:t.text,lineHeight:1.65}}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{flex:1,padding:'18px 22px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <span style={{fontSize:9,fontWeight:800,letterSpacing:3,color:t.accent,textTransform:'uppercase'}}>DESIGN SOLUTION</span>
              <div style={{flex:1,height:1,background:t.div}}/>
            </div>
            {solBullets.map((b,i)=>(
              <div key={i} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
                <span style={{flexShrink:0,width:24,height:24,borderRadius:'50%',background:t.accent+'28',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:t.accent}}>{i+1}</span>
                <span style={{fontSize:13,color:t.text,lineHeight:1.65}}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 5. SITUATION — Dispatcher */
function SituationSlide({exp,idx,t,f,theme}){
  const layout=getLayout(theme);
  if(layout==='tech') return <SituationTechSlide exp={exp} idx={idx} t={t} f={f}/>;
  if(layout==='story') return <SituationStorySlide exp={exp} idx={idx} t={t} f={f}/>;
  if(layout==='consult') return <SituationConsultSlide exp={exp} idx={idx} t={t} f={f}/>;
  if(layout==='design') return <SituationDesignSlide exp={exp} idx={idx} t={t} f={f}/>;
  return <SituationDefaultSlide exp={exp} idx={idx} t={t} f={f}/>;
}

/* ─── 6. RESULT SLIDES ─── */

/* 6a. Story Result: Big metric bar + 2-col bullets */
function ResultStorySlide({exp,idx,t,f}){
  const num=String(idx+1).padStart(2,'0');
  const kx=f.keyExperiences.slice(0,3);
  const outBullets=toBullets(f.output,3);
  const growBullets=toBullets(f.growth,3);
  return (
    <Slide t={t}>
      <div style={{padding:'36px 56px',height:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column',gap:14}}>
        <ProjectLabel num={num} category="CAMPAIGN RESULT" t={t}/>
        <SlideTitle t={t} size={24}>{shorten(exp.title||'',40)}</SlideTitle>
        {kx.length>0&&(
          <div style={{display:'flex',gap:12}}>
            {kx.slice(0,3).map((ke,i)=>(
              <div key={i} style={{flex:1,padding:'14px 20px',background:t.resBg||t.card,borderRadius:10,border:`1px solid ${t.resBd||t.div}`,textAlign:'center'}}>
                <div style={{fontSize:8,fontWeight:700,letterSpacing:2,color:t.sub,textTransform:'uppercase',marginBottom:6}}>{shorten(ke.title||'성과',22)}</div>
                <div style={{fontSize:30,fontWeight:900,color:t.accent,lineHeight:1.1}}>{shorten(String(ke.metric)||'-',14)}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{flex:1,display:'flex',gap:16,minHeight:0}}>
          <div style={{flex:1,padding:'18px 22px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`,overflow:'hidden'}}>
            <SectionBold t={t} size={13}>Campaign Result</SectionBold>
            {outBullets.map((b,i)=><ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
          </div>
          <div style={{flex:1,padding:'18px 22px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`,overflow:'hidden'}}>
            <SectionBold t={t} size={13}>Growth &amp; Learning</SectionBold>
            {growBullets.map((b,i)=><ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
            {kx[0]?.beforeMetric&&kx[0]?.afterMetric&&(
              <div style={{marginTop:12}}>
                <BarCompare before={kx[0].beforeMetric} after={kx[0].afterMetric} t={t}/>
              </div>
            )}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* 6b. Default Result */
function ResultDefaultSlide({exp,idx,t,f}){
  const num=String(idx+1).padStart(2,'0');
  const kx=f.keyExperiences.slice(0,3);
  const outBullets=toBullets(f.output,4);
  const growBullets=toBullets(f.growth,3);
  const showRight=kx.length>0;
  return (
    <Slide t={t}>
      <div style={{padding:'36px 56px',height:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column'}}>
        <ProjectLabel num={num} category="RESULT" t={t}/>
        <SlideTitle t={t} size={26}>{shorten(exp.title||'프로젝트',40)}</SlideTitle>
        <div style={{flex:1,display:'flex',gap:24}}>
          <div style={{flex:showRight?'0 0 55%':'1',padding:'20px 24px',background:t.card,
            borderRadius:14,border:`1px solid ${t.div}`,display:'flex',flexDirection:'column',gap:4,overflow:'hidden'}}>
            <SectionBold t={t} size={14}>Key Result</SectionBold>
            {outBullets.map((b,i)=><ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
            {growBullets.length>0&&<>
              <div style={{height:1,background:t.div+'55',margin:'6px 0'}}/>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:t.sub,textTransform:'uppercase',marginBottom:4}}>GROWTH</div>
              {growBullets.map((b,i)=><ArrowBullet key={i} t={t}>{b}</ArrowBullet>)}
            </>}
            {f.competency&&(
              <div style={{marginTop:8,padding:'10px 14px',background:t.step,borderRadius:8,borderLeft:`2px solid ${t.accent}`}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:2,color:t.accent,marginBottom:4}}>COMPETENCY</div>
                <p style={{fontSize:11.5,color:t.text,margin:0,lineHeight:1.6,
                  display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{f.competency}</p>
              </div>
            )}
          </div>
          {showRight&&(
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',gap:10}}>
                {kx.slice(0,2).map((ke,i)=><MetricCard key={i} t={t} label={ke.title||('성과 '+(i+1))} value={strip(ke.metric)||'-'}/>)}
              </div>
              {kx[0]?.beforeMetric&&kx[0]?.afterMetric&&(
                <div style={{padding:'16px 20px',background:t.card,borderRadius:12,border:`1px solid ${t.div}`}}>
                  <BarCompare before={kx[0].beforeMetric} after={kx[0].afterMetric} t={t}/>
                </div>
              )}
              {kx[2]&&(
                <div style={{padding:'14px 18px',background:t.resBg,borderRadius:12,border:`1px solid ${t.resBd}`}}>
                  <div style={{fontSize:8,fontWeight:700,letterSpacing:2,color:t.sub,textTransform:'uppercase',marginBottom:6}}>{kx[2].title||'추가 성과'}</div>
                  <div style={{fontSize:24,fontWeight:900,color:t.accent}}>{strip(kx[2].metric)||'-'}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Slide>
  );
}

/* 6. RESULT — Dispatcher */
function ResultSlide({exp,idx,t,f,theme}){
  const layout=getLayout(theme);
  if(layout==='story') return <ResultStorySlide exp={exp} idx={idx} t={t} f={f}/>;
  return <ResultDefaultSlide exp={exp} idx={idx} t={t} f={f}/>;
}

/* ─── 7. OUTRO ─── */
function OutroSlide({p,t}){
  const c=p.contact||{};
  const cl=[c.email,c.phone,c.github].filter(Boolean);
  const goals=(p.goals||[]).filter(g=>g.status!=='done').slice(0,3);
  return (
    <Slide t={t} bg={t.coverBg}>
      {t.dark&&<>
        <div style={{position:'absolute',top:-100,right:-60,width:300,height:300,borderRadius:'50%',
          background:`radial-gradient(circle,${t.accent}20,transparent 65%)`}}/>
      </>}
      <div style={{height:'100%',display:'flex',gap:0}}>
        {/* Left: goals */}
        {goals.length>0&&(
          <div style={{flex:1,padding:'48px 40px 40px 56px',display:'flex',flexDirection:'column',gap:14}}>
            <SectionLabel t={t}>FUTURE GOALS</SectionLabel>
            {goals.map((g,i)=>(
              <div key={i} style={{padding:'12px 16px',background:t.card+'dd',borderRadius:10,
                borderLeft:`3px solid ${t.accent}`,border:`1px solid ${t.div}44`,borderLeftColor:t.accent}}>
                <div style={{fontSize:13,fontWeight:700,color:t.text}}>{g.title}</div>
                {g.description&&<p style={{fontSize:10,color:t.sub,margin:'4px 0 0',lineHeight:1.5,
                  display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{g.description}</p>}
              </div>
            ))}
          </div>
        )}
        <div style={{width:1,background:t.div}}/>
        {/* Right: Thank you */}
        <div style={{flex:'0 0 380px',padding:'48px 56px 40px 40px',display:'flex',
          flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center',gap:12}}>
          <div style={{fontSize:42,fontWeight:900,color:t.accent,letterSpacing:-1,lineHeight:1}}>
            Thank You
          </div>
          <div style={{fontSize:22,fontWeight:700,color:t.text,marginTop:8,letterSpacing:'0.1em'}}>
            {nameSpaced(p.userName||'')}
          </div>
          <div style={{fontSize:13,color:t.sub,fontWeight:600,marginTop:0}}>
            {p.targetPosition||''}
          </div>
          <div style={{width:40,height:2,background:t.accent,borderRadius:2,margin:'8px 0'}}/>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {cl.map((l,i)=><span key={i} style={{fontSize:10,color:t.sub}}>{l}</span>)}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* ─── MAIN ─── */
export default function PdfPortfolioExport(){
  const {id}=useParams();
  const [portfolio,setPortfolio]=useState(null);
  const [loading,setLoading]=useState(true);
  const [generating,setGenerating]=useState(false);
  const [theme,setTheme]=useState('marketer_light');

  useEffect(()=>{loadData();},[id]);

  const loadData=async()=>{
    try{
      const snap=await getDoc(doc(db,'portfolios',id));
      if(snap.exists()){
        const p={id:snap.id,...snap.data()};
        setPortfolio(p);
        const pos=(p.targetPosition||p.headline||'').toLowerCase();
        if(/개발|developer|engineer|frontend|backend|node|react|ios|android/.test(pos)) setTheme('developer');
        else if(/데이터|data|analyst|분석|sql|bi/.test(pos)) setTheme('data_dashboard');
        else if(/디자인|design|ux|ui|figma/.test(pos)) setTheme('designer');
        else if(/마케터|마케팅|marketer|marketing|cpc|roas|퍼포먼스/.test(pos)) setTheme('marketer_light');
        else if(/pm|po|product|기획/.test(pos)) setTheme('star_classic');
        else if(/컨설|consultant|전략|strategy/.test(pos)) setTheme('problem_solver');
        else if(/신입|주니어|junior|학부/.test(pos)) setTheme('rookie');
      }
    }catch(e){toast.error('불러오기 실패');}
    setLoading(false);
  };

  const handleDownload=useCallback(async()=>{
    if(!portfolio)return;
    setGenerating(true);
    const tid=toast.loading('PPT 생성 중...');
    try{
      await generatePptx(portfolio,theme,THEMES[theme]);
      toast.success('PPT 다운로드 완료!',{id:tid});
    }catch(e){
      console.error(e);
      toast.error('생성 실패: '+(e?.message||'알 수 없는 오류'),{id:tid});
    }
    setGenerating(false);
  },[portfolio,theme]);

  if(loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-600"/></div>;
  if(!portfolio) return <p className="text-center py-20 text-gray-400">포트폴리오를 찾을 수 없습니다</p>;

  const t=THEMES[theme];
  const p=portfolio;
  const exps=p.experiences||[];
  const sk=p.skills||{};
  const hasSkills=[...(sk.languages||[]),...(sk.frameworks||[]),...(sk.tools||[]),...(sk.others||[])].length>0;

  const expSlides=exps.map(exp=>{
    const f=extractFields(exp);
    const hasSit=!!(f.task||f.process||f.overview||f.description||f.intro);
    const hasRes=!!(f.output||f.growth||f.competency||f.keyExperiences?.length);
    return {exp,f,hasSit,hasRes};
  });

  const totalSlides=2+(hasSkills?1:0)+expSlides.reduce((a,d)=>a+1+(d.hasSit?1:0)+(d.hasRes?1:0),0)+1;

  return (
    <div className="animate-fadeIn">
      <div className="print:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-surface-200 shadow-sm">
        <div style={{maxWidth:1040,margin:'0 auto'}} className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to={'/app/portfolio/preview/'+id} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={14}/>{'  미리보기'}
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-bold text-gray-800">{'Wanted Style PPT'}</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{totalSlides+' slides'}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select value={theme} onChange={e=>setTheme(e.target.value)}
                className="appearance-none bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 pr-7 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-primary-300">
                {Object.entries(THEMES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            </div>
            <button onClick={handleDownload} disabled={generating}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {generating?<><Loader2 size={14} className="animate-spin"/>{'  생성 중...'}</>:<><Download size={14}/>{' PPT 저장 (.pptx)'}</>}
            </button>
          </div>
        </div>
        <div className="bg-blue-50 border-t border-blue-100 text-center py-1.5">
          <p className="text-xs text-blue-700">
            {'Wanted Portfolio Style · ① Cover → ② Profile → ③ Skills → ④ [Section + Situation + Result] × N → ⑤ Outro'}
          </p>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:28,padding:'32px 24px 72px'}}
        className="print:gap-0 print:p-0">
        <CoverSlide p={p} t={t} theme={theme}/>
        <ProfileSlide p={p} t={t}/>
        {hasSkills&&<SkillsSlide p={p} t={t}/>}
        {expSlides.map(({exp,f,hasSit,hasRes},idx)=>(
          <div key={idx} style={{display:'contents'}}>
            <SectionDivider exp={exp} idx={idx} t={t}/>
            {hasSit&&<SituationSlide exp={exp} idx={idx} t={t} f={f} theme={theme}/>}
            {hasRes&&<ResultSlide exp={exp} idx={idx} t={t} f={f} theme={theme}/>}
          </div>
        ))}
        <OutroSlide p={p} t={t}/>
      </div>

      <style>{`
        @media print{body{margin:0;padding:0;}.print\\:hidden{display:none!important;}.ppt-slide{page-break-after:always;page-break-inside:avoid;box-shadow:none!important;border-radius:0!important;}.ppt-slide:last-child{page-break-after:avoid;}@page{margin:0;size:A4 landscape;}}
        .ppt-slide{box-shadow:0 8px 40px rgba(0,0,0,0.22);border-radius:8px;}
      `}</style>
    </div>
  );
}