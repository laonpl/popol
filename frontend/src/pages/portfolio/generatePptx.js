/**
 * generatePptx.js
 * Wanted Portfolio Style PPTX Generator (pptxgenjs)
 * 구조: Cover → Profile → Skills → [SectionDivider + Situation + Result] × N → Outro
 */
import PptxGenJS from 'pptxgenjs';

const SW = 10;
const SH = 5.625;

/* ─── Utils ─── */
function strip(txt){
  if(txt==null)return'';
  const s=Array.isArray(txt)?txt.join(', '):String(txt);
  return s.replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1')
    .replace(/#{1,6}\s*/g,'').replace(/`(.+?)`/g,'$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/^>\s*/gm,'').trim();
}
function extractFields(exp){
  const sr=exp.structuredResult||{}, fc=exp.frameworkContent||{}, fs={};
  (exp.sections||[]).forEach(s=>{
    const tt=(s.title||'').replace(/\s/g,''), c=s.content?.trim();
    if(!c)return;
    if(/소개|intro/i.test(tt)) fs.intro=fs.intro||c;
    else if(/개요|overview|배경/i.test(tt)) fs.overview=fs.overview||c;
    else if(/진행|task|문제|일/i.test(tt)) fs.task=fs.task||c;
    else if(/과정|process/i.test(tt)) fs.process=fs.process||c;
    else if(/결과물|output/i.test(tt)) fs.output=fs.output||c;
    else if(/성장|growth|배운/i.test(tt)) fs.growth=fs.growth||c;
    else if(/역량|competency/i.test(tt)) fs.competency=fs.competency||c;
  });
  const g=k=>strip(sr[k]?.trim?.()||fc[k]?.trim?.()||fs[k]?.trim?.()||'');
  return{
    intro:g('intro'),overview:g('overview'),task:g('task'),process:g('process'),
    output:g('output'),growth:g('growth'),competency:g('competency'),
    description:strip(exp.description?.trim()||''),
    aiSummary:strip(exp.aiSummary?.trim()||sr.projectOverview?.summary?.trim()||''),
    keyExperiences:sr.keyExperiences||[],projectOverview:sr.projectOverview||{},
  };
}
function toBullets(text,max=5){
  if(!text)return[];
  return text.split('\n').map(l=>strip(l.replace(/^(\d+[.)]\s*|[-•▸■□·]\s*)/,'').trim()))
    .filter(l=>l.length>3).slice(0,max);
}
function smartBullets(text,maxItems=4,maxChars=80){
  if(!text)return[];
  const raw=strip(text);
  if(!raw)return[];
  // 줄바꿈 기반 분리 우선
  const byLine=raw.split('\n')
    .map(l=>strip(l.replace(/^(\d+[.)]\s*|[-•▸■□·]\s*)/,'').trim()))
    .filter(l=>l.length>8);
  if(byLine.length>=2){
    // 너무 긴 항목은 쉼표/마침표로 재분리
    const result=[];
    for(const line of byLine){
      if(result.length>=maxItems)break;
      if(line.length<=maxChars){result.push(line);continue;}
      const sub=line.split(/(?<=[.,;])/g).reduce((acc,s)=>{
        const cur=acc[acc.length-1]||'';
        if((cur+s).length>maxChars&&cur.length>0){acc.push(s.trim());}else{acc[acc.length-1]=(cur+s).trim();}
        return acc;
      },[line.slice(0,maxChars)]);
      result.push(...sub.slice(0,maxItems-result.length));
    }
    return result.slice(0,maxItems);
  }
  // 문장 단위 분리
  const sentences=raw.split(/(?<=[.!?。])/g).map(s=>s.trim()).filter(s=>s.length>5);
  if(sentences.length<=1)return[raw];
  const chunks=[];
  let cur='';
  for(const s of sentences){
    if(cur.length+s.length>maxChars&&cur.length>0){
      chunks.push(cur.trim());
      cur=s+' ';
      if(chunks.length>=maxItems-1){cur+=sentences.slice(sentences.indexOf(s)+1).join(' ');break;}
    }else{cur+=s+' ';}
  }
  if(cur.trim())chunks.push(cur.trim());
  return chunks.slice(0,maxItems);
}
function sh(txt,max=55){
  if(!txt)return'';
  const s=strip(txt);
  return s.length>max?s.slice(0,max)+'...':s;
}
function hexA(hex,opacity){
  const h=hex.replace('#','');
  const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
  return'rgba('+r+','+g+','+b+','+opacity+')';
}
function hexClean(hex){
  return(hex||'#888888').replace('#','').replace(/^rgba.*$/,'888888');
}
function nameSpaced(name){
  if(!name)return name;
  const n=name.trim();
  if(n.length===3&&/[가-힣]/.test(n))return n[0]+' '+n[1]+' '+n[2];
  return n;
}

/* ─── Low-level helpers ─── */
function addBg(slide,color,opacity){
  slide.addShape('rect',{x:0,y:0,w:SW,h:SH,fill:{color:hexClean(color),transparency:opacity?Math.round((1-opacity)*100):0}});
}
function rect(slide,x,y,w,h,fill,opts={}){
  slide.addShape('rect',{x,y,w,h,fill:{color:hexClean(fill)},line:{color:hexClean(fill)},rectRadius:0,...opts});
}
function roundRect(slide,x,y,w,h,fill,border,radius=0.1){
  const lo={x,y,w,h,fill:{color:hexClean(fill)},rectRadius:radius};
  if(border) lo.line={color:hexClean(border),pt:0.5};
  else lo.line={color:hexClean(fill),pt:0};
  slide.addShape('rect',lo);
}
function circle(slide,x,y,d,fill){
  slide.addShape('ellipse',{x,y,w:d,h:d,fill:{color:hexClean(fill)},line:{color:hexClean(fill),pt:0}});
}
function hrLine(slide,x,y,w,color){
  slide.addShape('rect',{x,y,w,h:0.012,fill:{color:hexClean(color)},line:{color:hexClean(color),pt:0}});
}
function txt(slide,text,x,y,w,h,opts={}){
  if(!text)return;
  slide.addText(String(text),{x,y,w,h,...opts});
}
function sectionLabel(slide,label,t,x,y,lineW){
  txt(slide,label,x,y,2.5,0.18,{fontSize:7,bold:true,color:hexClean(t.sub),charSpacing:3,isTextBox:true});
  hrLine(slide,x+1.8,y+0.07,lineW-1.8,t.div);
}
function projectLabel(slide,num,category,t,x,y,lineW){
  txt(slide,'PROJECT '+num,x,y,1.4,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  txt(slide,'—',x+1.4,y,0.2,0.18,{fontSize:7,color:hexClean(t.sub),isTextBox:true});
  txt(slide,category,x+1.65,y,1.2,0.18,{fontSize:7,bold:true,color:hexClean(t.sub),charSpacing:2,isTextBox:true});
  hrLine(slide,x+2.9,y+0.07,lineW-2.9,t.div);
}
function sectionBold(slide,text,t,x,y,w){
  txt(slide,text,x,y,w,0.24,{fontSize:12,bold:true,color:hexClean(t.accent),isTextBox:true});
}
function addBulletRows(slide,bullets,x,y,w,t,maxW,style='check'){
  let cy=y;
  bullets.forEach((b,i)=>{
    const s=maxW?sh(b,maxW):b;
    // 텍스트 길이 기반 높이 동적 계산 (폰트 9.5pt, 1인치 ≈ 14글자)
    const charsPerLine=Math.max(15,Math.floor(w*13.5));
    const lines=Math.max(1,Math.ceil(s.length/charsPerLine));
    const itemH=Math.max(0.22,lines*0.2+0.06);
    if(style==='check'){
      roundRect(slide,x,cy+0.06,0.11,0.11,t.card,t.div,0.02);
      txt(slide,s,x+0.17,cy,w-0.17,itemH,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
    }else if(style==='step'){
      txt(slide,'Step'+(i+1)+'.',x,cy,0.52,0.2,{fontSize:8.5,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'top',fontFace:'Courier New'});
      txt(slide,s,x+0.52,cy,w-0.52,itemH,{fontSize:9,color:hexClean(t.text),isTextBox:true,valign:'top'});
    }else if(style==='arrow'){
      txt(slide,'>',x,cy,0.18,0.22,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'top'});
      txt(slide,s,x+0.2,cy,w-0.2,itemH,{fontSize:9,color:hexClean(t.text),isTextBox:true,valign:'top'});
    }
    cy+=itemH+0.1;
  });
  return cy;
}
function metricBox(slide,x,y,w,h,label,value,t){
  roundRect(slide,x,y,w,h,t.resBg||t.card,t.resBd||t.div,0.08);
  txt(slide,label,x+0.15,y+0.12,w-0.3,0.14,{fontSize:6.5,bold:true,color:hexClean(t.sub),charSpacing:2,isTextBox:true});
  txt(slide,value,x+0.15,y+0.3,w-0.3,0.35,{fontSize:22,bold:true,color:hexClean(t.accent),isTextBox:true});
}
function barPair(slide,x,y,w,before,after,t){
  const pn=v=>parseFloat(String(v).replace(/[^0-9.]/g,''))||0;
  const bV=pn(before),aV=pn(after),mx=Math.max(bV,aV,1);
  const bW=Math.min(bV/mx,1)*w*0.82;
  const aW=Math.min(aV/mx,1)*w*0.82;
  txt(slide,'AS-IS',x,y,0.5,0.14,{fontSize:7,bold:true,color:hexClean(t.sub),isTextBox:true});
  txt(slide,sh(String(before),20),x+0.52,y,w-0.52,0.14,{fontSize:7,color:hexClean(t.sub),isTextBox:true,align:'right'});
  roundRect(slide,x,y+0.17,w*0.82,0.07,t.div+'88'||'cccccc',null,0.04);
  if(bW>0)roundRect(slide,x,y+0.17,Math.max(bW,0.02),0.07,t.sub,null,0.04);
  txt(slide,'TO-BE',x,y+0.32,0.5,0.14,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true});
  txt(slide,sh(String(after),20),x+0.52,y+0.32,w-0.52,0.14,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,align:'right'});
  roundRect(slide,x,y+0.45,w*0.82,0.09,t.div+'88'||'cccccc',null,0.04);
  if(aW>0)roundRect(slide,x,y+0.45,Math.max(aW,0.02),0.09,t.accent,null,0.04);
}

/* ─── Slide Builders ─── */

/* 1. COVER */
function buildCover(prs,p,t){
  const slide=prs.addSlide();
  addBg(slide,t.coverBg);
  // accent bar
  rect(slide,0,0,0.04,SH,t.accent);
  // gradient blobs for dark themes
  if(t.dark){
    circle(slide,-0.5,-0.8,2.5,t.accent+'18');
    circle(slide,SW-2.3,SH-2.3,2.5,'1a4a4a');
  }
  // avatar circle / profile photo
  if(p.profileImageUrl){
    try{
      slide.addImage({data:p.profileImageUrl,x:0.65,y:0.55,w:0.78,h:0.78,rounding:true});
    }catch(e){
      circle(slide,0.65,0.55,0.78,hexClean(t.accent)+'28');
      txt(slide,(p.userName||'?').trim()[0],0.65,0.55,0.78,0.78,{fontSize:26,bold:true,color:hexClean(t.accent),align:'center',valign:'middle',isTextBox:true});
    }
  }else{
    circle(slide,0.65,0.55,0.78,hexClean(t.accent)+'28');
    txt(slide,(p.userName||'?').trim()[0],0.65,0.55,0.78,0.78,{fontSize:26,bold:true,color:hexClean(t.accent),align:'center',valign:'middle',isTextBox:true});
  }
  const LX=0.65;
  // position tag
  txt(slide,sh(p.targetPosition||'Portfolio',35),LX,1.5,4,0.22,{fontSize:10.5,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:0.5});
  // spaced name
  txt(slide,nameSpaced(p.userName||'이름'),LX,1.78,5,0.75,{fontSize:42,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:8});
  // hashtags
  const vals=(p.values||[]).slice(0,5).map(v=>v.keyword||String(v));
  if(vals.length>0){
    const tagStr=vals.map(v=>'#'+v).join('  ');
    txt(slide,tagStr,LX,2.62,5.5,0.22,{fontSize:9,color:hexClean(t.sub),isTextBox:true,charSpacing:0.5});
  }
  // tagline box
  if(p.headline){
    roundRect(slide,LX,2.92,5.4,0.62,t.card||t.bg+'88',t.div,0.06);
    rect(slide,LX,2.92,0.04,0.62,t.accent);
    txt(slide,sh(p.headline,100),LX+0.14,3.0,5.2,0.5,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'middle',paraSpaceAfter:3});
  }
  // contacts
  const c=p.contact||{};
  const cl=[c.email,c.phone,c.github].filter(Boolean);
  cl.forEach((cc,i)=>{
    txt(slide,cc,LX+i*2.8,4.95,2.6,0.2,{fontSize:8,color:hexClean(t.sub),isTextBox:true,fontFace:t.mono?'Courier New':undefined});
  });
}

/* 2. PROFILE — 데이터 밀도 적응형 */
function buildProfile(prs,p,t){
  const slide=prs.addSlide();
  addBg(slide,t.bg);
  const PX=0.5,PY=0.35;
  const LW=3.4; // 왼쪽 컬럼 폭
  const midX=PX+LW+0.26;
  const RX=midX+0.26;
  const RW=SW-RX-0.5;
  const edu=(p.education||[]).slice(0,4);
  const sk=p.skills||{};
  const langs=[...(sk.languages||[]),...(sk.frameworks||[])].map(s=>typeof s==='string'?s:s?.name).filter(Boolean).slice(0,14);
  const tools=(sk.tools||[]).map(s=>typeof s==='string'?s:s?.name).filter(Boolean).slice(0,10);
  const exps=(p.experiences||[]).slice(0,4);
  const awards=(p.awards||[]).slice(0,4);
  const density=edu.length+exps.length+awards.length;
  const scale=density<=2?1.2:density<=4?1.08:1;
  const fs=(n)=>Math.round(n*scale*10)/10;

  // 상단 섹션 라벨 + 이름/포지션
  txt(slide,'PROFILE',PX,PY,1.3,0.2,{fontSize:8,bold:true,color:hexClean(t.sub),charSpacing:3.5,isTextBox:true});
  hrLine(slide,PX+1.0,PY+0.08,SW-PX*2-2.2,t.div);
  const nameLine=(p.userName||'')+(p.targetPosition?' · '+p.targetPosition:'');
  if(nameLine.trim()){
    txt(slide,nameLine,SW-PX-2.0,PY,2.0,0.2,{fontSize:8.5,color:hexClean(t.sub),isTextBox:true,align:'right'});
  }

  let cursorY=PY+0.38;
  // 헤드라인 카드
  if(p.headline){
    const hlH=0.62;
    roundRect(slide,PX,cursorY,SW-PX*2,hlH,t.card,t.div,0.08);
    rect(slide,PX,cursorY,0.045,hlH,t.accent);
    txt(slide,sh(p.headline,140),PX+0.18,cursorY+0.06,SW-PX*2-0.3,hlH-0.12,{fontSize:fs(12),color:hexClean(t.text),isTextBox:true,valign:'middle'});
    cursorY+=hlH+0.18;
  }
  const contentY=cursorY;
  const contentH=SH-contentY-0.3;

  // 중앙 세로 구분선
  rect(slide,midX,contentY,0.012,contentH,t.div);

  /* ── 왼쪽 컬럼 ── */
  let ly=contentY;
  if(edu.length>0){
    sectionBold(slide,'Education',t,PX,ly,LW);
    ly+=0.32;
    // Education 카드 높이: 공간을 고루 분배 (최대 1.0, 최소 0.7)
    const eduBudget=Math.min(contentH*0.55, edu.length*1.05);
    const eduH=Math.max(0.7, Math.min(1.0, eduBudget/edu.length));
    edu.forEach((e,i)=>{
      const ey=ly+i*(eduH+0.1);
      roundRect(slide,PX,ey,LW,eduH,t.card,t.div,0.08);
      txt(slide,sh(e.name,28),PX+0.18,ey+0.14,LW-1.2,0.28,{fontSize:fs(13),bold:true,color:hexClean(t.text),isTextBox:true});
      if(e.period) txt(slide,e.period,PX+LW-1.1,ey+0.14,0.95,0.22,{fontSize:fs(9),color:hexClean(t.sub),isTextBox:true,align:'right'});
      if(e.degree) txt(slide,sh(e.degree,32),PX+0.18,ey+0.44,LW-0.36,0.26,{fontSize:fs(10.5),color:hexClean(t.sub),isTextBox:true});
    });
    ly+=edu.length*(eduH+0.1)+0.14;
  }
  // Tech Stack
  const stackItems=langs.length>0?langs:tools;
  const stackLabel=langs.length>0?'Tech Stack':'Tools';
  if(stackItems.length>0&&ly<contentY+contentH-0.4){
    sectionBold(slide,stackLabel,t,PX,ly,LW);
    ly+=0.3;
    let px2=PX,py2=ly;
    stackItems.forEach(s=>{
      const sw2=Math.min(s.length*0.085+0.24,LW);
      if(px2+sw2>PX+LW){px2=PX;py2+=0.3;}
      if(py2+0.22>contentY+contentH-0.05) return;
      roundRect(slide,px2,py2,sw2,0.24,t.badge,t.div,0.09);
      txt(slide,s,px2+0.1,py2+0.03,sw2-0.1,0.2,{fontSize:fs(9),bold:true,color:hexClean(t.text),isTextBox:true,valign:'middle'});
      px2+=sw2+0.08;
    });
  }

  /* ── 오른쪽 컬럼 ── */
  let ry=contentY;
  if(exps.length>0){
    sectionBold(slide,'Work Experience',t,RX,ry,RW);
    ry+=0.32;
    // 컨텐츠가 적을 때: 사용 가능한 높이를 고루 분배
    const expBudget=awards.length>0?Math.min(contentH*0.58,exps.length*1.05):(contentH-0.32);
    const expH=Math.max(0.8, Math.min(1.3, expBudget/Math.max(1,exps.length)));
    exps.forEach((e,i)=>{
      const ey=ry+i*(expH+0.12);
      roundRect(slide,RX,ey,RW,expH,t.card,t.div,0.08);
      const iconS=Math.min(0.5, expH*0.55);
      const iconY=ey+(expH-iconS)/2;
      roundRect(slide,RX+0.16,iconY,iconS,iconS,t.accent+'30',null,0.06);
      txt(slide,(e.organization||e.title||'?').trim()[0],RX+0.16,iconY,iconS,iconS,{fontSize:fs(15),bold:true,color:hexClean(t.accent),align:'center',valign:'middle',isTextBox:true});
      const tx=RX+0.16+iconS+0.18;
      const tw=RW-(0.16+iconS+0.18)-0.16;
      txt(slide,sh(e.organization||e.title,28),tx,ey+0.14,tw-1.1,0.28,{fontSize:fs(13),bold:true,color:hexClean(t.text),isTextBox:true});
      if(e.date) txt(slide,e.date,RX+RW-1.2,ey+0.14,1.04,0.24,{fontSize:fs(9),color:hexClean(t.sub),isTextBox:true,align:'right'});
      if(e.role) txt(slide,sh(e.role,30),tx,ey+0.42,tw,0.22,{fontSize:fs(10),bold:true,color:hexClean(t.accent),isTextBox:true});
      if(e.description&&expH>0.9){
        const descLines=expH>1.1?2:1;
        const descH=descLines*0.22;
        txt(slide,sh(strip(e.description),descLines===2?130:80),tx,ey+0.68,tw,descH,{fontSize:fs(9),color:hexClean(t.sub),isTextBox:true,valign:'top'});
      }
    });
    ry+=exps.length*(expH+0.12)+0.12;
  }
  // Awards
  if(awards.length>0&&ry<contentY+contentH-0.4){
    sectionBold(slide,'Awards & Certifications',t,RX,ry,RW);
    ry+=0.3;
    const awH=Math.min(0.34,(contentY+contentH-ry)/awards.length);
    awards.forEach((a,i)=>{
      const ay=ry+i*awH;
      if(ay+awH>contentY+contentH-0.05) return;
      txt(slide,sh(a.title,48),RX,ay,RW-1.2,awH,{fontSize:fs(11),bold:true,color:hexClean(t.text),isTextBox:true,valign:'middle'});
      if(a.date) txt(slide,a.date,RX+RW-1.1,ay,1.0,awH,{fontSize:fs(9),color:hexClean(t.sub),isTextBox:true,align:'right',valign:'middle'});
      hrLine(slide,RX,ay+awH-0.01,RW,t.div+'55');
    });
  }
  // fallback: exps/awards 모두 없을 때 tools 노출
  if(exps.length===0&&awards.length===0&&tools.length>0){
    sectionBold(slide,'Tools & Platforms',t,RX,ry,RW);
    ry+=0.3;
    let px3=RX,py3=ry;
    tools.forEach(s=>{
      const sw2=Math.min(s.length*0.085+0.24,RW);
      if(px3+sw2>RX+RW){px3=RX;py3+=0.3;}
      if(py3+0.22>contentY+contentH-0.05) return;
      roundRect(slide,px3,py3,sw2,0.24,t.badge,t.div,0.09);
      txt(slide,s,px3+0.1,py3+0.03,sw2-0.1,0.2,{fontSize:fs(9),bold:true,color:hexClean(t.text),isTextBox:true,valign:'middle'});
      px3+=sw2+0.08;
    });
  }
}

/* 3. SKILLS */
function buildSkills(prs,p,t){
  const sk=p.skills||{};
  const rows=[];
  const langs=[...(sk.languages||[]),...(sk.frameworks||[])].map(s=>typeof s==='string'?s:s?.name).filter(Boolean);
  const tools=(sk.tools||[]).map(s=>typeof s==='string'?s:s?.name).filter(Boolean);
  const others=(sk.others||[]).map(s=>typeof s==='string'?s:s?.name).filter(Boolean);
  const vals=(p.values||[]).slice(0,3);
  if(langs.length>0) rows.push({emoji:'Dev',name:'Technical Skills',items:langs.slice(0,10)});
  if(tools.length>0) rows.push({emoji:'Tool',name:'Tools & Platforms',items:tools.slice(0,10)});
  if(others.length>0) rows.push({emoji:'Skill',name:'Other Skills',items:others.slice(0,10)});
  if(vals.length>0&&rows.length<3) rows.push({emoji:'Core',name:'Core Competency',items:vals.map(v=>v.keyword||String(v))});
  const show=rows.slice(0,3);
  if(show.length===0) return;
  const slide=prs.addSlide();
  addBg(slide,t.bg);
  sectionLabel(slide,'SKILLS',t,0.5,0.38,SW-1.0);
  const totalH=SH-0.38-0.32-0.4;
  const rowH=Math.min((totalH-0.16*2)/show.length,1.3);
  show.forEach((row,i)=>{
    const RY=0.38+0.32+0.16+i*(rowH+0.14);
    roundRect(slide,0.5,RY,SW-1.0,rowH,t.card,t.div,0.08);
    // icon circle
    circle(slide,0.72,RY+(rowH-0.5)/2,0.5,t.accent+'30');
    txt(slide,row.emoji,0.72,RY+(rowH-0.5)/2,0.5,0.5,{fontSize:8,bold:true,color:hexClean(t.accent),align:'center',valign:'middle',isTextBox:true});
    // category name
    txt(slide,row.name,1.36,RY+(rowH-0.26)/2,1.7,0.26,{fontSize:12,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
    // vertical divider
    rect(slide,3.18,RY+0.2,0.012,rowH-0.4,t.div);
    // items as pills
    let px=3.36,py=RY+(rowH-0.22)/2;
    row.items.forEach(s=>{
      const sw2=Math.min(s.length*0.072+0.22,1.4);
      if(px+sw2>SW-0.6){px=3.36;py+=0.28;}
      roundRect(slide,px,py,sw2,0.21,t.badge,t.div,0.08);
      txt(slide,s,px+0.07,py+0.02,sw2-0.07,0.17,{fontSize:8,bold:true,color:hexClean(t.text),isTextBox:true,valign:'middle'});
      px+=sw2+0.08;
    });
  });
}

/* 4. SECTION DIVIDER */
function buildSectionDivider(prs,exp,idx,t){
  const slide=prs.addSlide();
  addBg(slide,'0a0a0f');
  // gradient blobs
  circle(slide,-0.3,-0.7,2.5,hexClean(t.accent)+'25');
  circle(slide,SW-2.2,SH-2.2,2.5,'1a4a4a');
  // large ghost number
  txt(slide,String(idx+1).padStart(2,'0'),0.2,SH/2-1.4,SW*0.6,2.2,{fontSize:160,bold:true,color:'ffffff',isTextBox:true,transparency:94,charSpacing:-10,valign:'middle'});
  // project number tag
  txt(slide,'PROJECT '+String(idx+1).padStart(2,'0'),0.9,SH/2-0.72,4,0.20,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:4});
  // main title
  const title=sh(exp.title||'프로젝트',35);
  txt(slide,title,0.9,SH/2-0.42,8.0,1.0,{fontSize:44,bold:true,color:'ffffff',isTextBox:true,charSpacing:-2});
  // role/date
  if(exp.role||exp.date){
    txt(slide,(exp.role||'')+(exp.date?' · '+exp.date:''),0.9,SH/2+0.65,6,0.24,{fontSize:12,color:'ffffff',isTextBox:true,transparency:50});
  }
}

/* ─── Layout Routing ─── */
function getLayout(theme){
  if(!theme) return 'default';
  if(['developer','data_dashboard'].includes(theme)) return 'tech';
  if(['marketer_dark','marketer_light'].includes(theme)) return 'story';
  if(['problem_solver','star_classic'].includes(theme)) return 'consult';
  if(theme==='designer') return 'design';
  return 'default';
}
function slideHeader(slide,num,category,title,t){
  projectLabel(slide,num,category,t,0.5,0.28,SW-1.0);
  txt(slide,sh(title,42),0.5,0.50,7.8,0.50,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
}

/* 5a. SITUATION — Default (깔끔 2컬럼) */
function buildSituationDefault(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  slideHeader(slide,String(idx+1).padStart(2,'0'),'CAREER',exp.title||'프로젝트',t);
  const CY=1.12, CH=SH-CY-0.3;
  roundRect(slide,0.5,CY,SW-1.0,CH,t.card,t.div,0.1);
  const midX=0.5+(SW-1.0)*0.5;
  const spItems=smartBullets(f.task||f.overview||f.description||'',3,68).slice(0,3);
  const solItems=smartBullets(f.process||f.intro||'',3,68).slice(0,3);
  if(spItems.length>0){
    sectionBold(slide,'Situation & Problem',t,0.76,CY+0.18,midX-0.9);
    let sy=CY+0.5;
    spItems.forEach(item=>{
      const ih=Math.max(0.28,Math.ceil(item.length/54)*0.22+0.06);
      roundRect(slide,0.76,sy+0.07,0.12,0.12,t.card,t.div,0.02);
      txt(slide,item,0.96,sy,midX-0.9,ih,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top'});
      sy+=ih+0.14;
    });
    const rem=(CY+CH-0.22)-sy;
    if(rem>0.5&&(exp.role||f.aiSummary)){
      const ch=Math.min(rem-0.1,0.72);
      roundRect(slide,0.76,sy+0.08,midX-0.96,ch,t.step,t.div+'55',0.06);
      rect(slide,0.76,sy+0.08,0.036,ch,t.accent);
      txt(slide,sh(exp.role?exp.role+(exp.date?' · '+exp.date:''):f.aiSummary,120),0.82,sy+0.16,midX-1.06,ch-0.2,{fontSize:9.5,color:hexClean(t.sub),isTextBox:true,valign:'top'});
    }
  }
  rect(slide,midX,CY+0.18,0.012,CH-0.36,t.div);
  if(solItems.length>0){
    const RX=midX+0.26, solW=SW-RX-0.76;
    sectionBold(slide,'Solution',t,RX,CY+0.18,solW);
    let ry=CY+0.5;
    solItems.forEach((item,i)=>{
      const ih=Math.max(0.28,Math.ceil(item.length/54)*0.22+0.06);
      txt(slide,'Step'+(i+1)+'.',RX,ry,0.52,0.2,{fontSize:8.5,bold:true,color:hexClean(t.accent),isTextBox:true,fontFace:'Courier New',valign:'top'});
      txt(slide,item,RX+0.54,ry,solW-0.54,ih,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top'});
      ry+=ih+0.14;
    });
  }
}

/* 5b. SITUATION — Tech (Problem | Approach + context bar) */
function buildSituationTech(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  slideHeader(slide,String(idx+1).padStart(2,'0'),'TECHNICAL',exp.title||'프로젝트',t);
  const CY=1.12, barH=0.44, CH=SH-CY-barH-0.44;
  const LW=4.2, RX=0.5+LW+0.26, RW=SW-RX-0.5;
  const spItems=smartBullets(f.task||f.overview||f.description||'',3,60).slice(0,3);
  const solItems=smartBullets(f.process||f.intro||'',4,60).slice(0,4);
  // Left card: Problem
  roundRect(slide,0.5,CY,LW,CH,t.card,t.div,0.1);
  txt(slide,'PROBLEM',0.72,CY+0.18,1.1,0.2,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  hrLine(slide,0.72+0.82,CY+0.25,LW-1.04,t.div);
  let ly=CY+0.5;
  spItems.forEach(item=>{
    const ih=Math.max(0.26,Math.ceil(item.length/46)*0.22+0.04);
    roundRect(slide,0.72,ly+0.05,0.1,0.1,t.accent+'50',null,0.02);
    txt(slide,item,0.90,ly,LW-0.58,ih,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top'});
    ly+=ih+0.14;
  });
  // Right card: Approach
  roundRect(slide,RX,CY,RW,CH,t.card,t.div,0.1);
  txt(slide,'APPROACH',RX+0.22,CY+0.18,1.2,0.2,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  hrLine(slide,RX+1.1,CY+0.25,RW-1.28,t.div);
  let ry=CY+0.5;
  solItems.forEach((item,i)=>{
    const ih=Math.max(0.26,Math.ceil(item.length/46)*0.22+0.04);
    roundRect(slide,RX+0.2,ry+0.02,0.26,0.22,t.accent+'28',null,0.04);
    txt(slide,String(i+1),RX+0.2,ry+0.02,0.26,0.22,{fontSize:9,bold:true,color:hexClean(t.accent),align:'center',isTextBox:true});
    txt(slide,item,RX+0.56,ry,RW-0.76,ih,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top'});
    ry+=ih+0.14;
  });
  // Bottom context bar (full width)
  const barY=SH-barH-0.26;
  roundRect(slide,0.5,barY,SW-1.0,barH,t.step,t.div+'55',0.06);
  txt(slide,'CONTEXT',0.72,barY+0.12,0.72,0.14,{fontSize:6.5,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
  txt(slide,sh(f.aiSummary||exp.description||exp.role||'프로젝트 배경',180),1.52,barY+0.06,SW-2.2,barH-0.08,{fontSize:9,color:hexClean(t.sub),isTextBox:true,valign:'middle'});
}

/* 5c. SITUATION — Story (마케터: Hero hook + Context | Challenge&Action) */
function buildSituationStory(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'CAMPAIGN',t,0.5,0.28,SW-1.0);
  // Hero 한 줄 인사이트
  const hook=sh(f.aiSummary||f.task||f.description||exp.title||'',110);
  roundRect(slide,0.5,0.52,SW-1.0,0.72,t.card,t.div,0.1);
  rect(slide,0.5,0.52,0.045,0.72,t.accent);
  txt(slide,hook,0.72,0.58,SW-1.4,0.60,{fontSize:13,bold:true,color:hexClean(t.text),isTextBox:true,valign:'middle'});
  const CY=1.38, CH=SH-CY-0.3;
  const LW=(SW-1.4)/2, RX=0.5+LW+0.4, RW=SW-RX-0.5;
  // Left: Background
  roundRect(slide,0.5,CY,LW,CH,t.card,t.div,0.1);
  txt(slide,'BACKGROUND',0.72,CY+0.18,1.5,0.2,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  hrLine(slide,0.72+1.14,CY+0.25,LW-1.34,t.div);
  const bgItems=smartBullets(f.overview||f.description||f.task||'',3,62).slice(0,3);
  let ly=CY+0.5;
  bgItems.forEach(item=>{
    const ih=Math.max(0.26,Math.ceil(item.length/50)*0.22+0.06);
    txt(slide,'·',0.72,ly,0.18,ih,{fontSize:13,color:hexClean(t.accent),bold:true,isTextBox:true});
    txt(slide,item,0.90,ly,LW-0.56,ih,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top'});
    ly+=ih+0.14;
  });
  // Right: Challenge & Action
  roundRect(slide,RX,CY,RW,CH,t.card,t.div,0.1);
  txt(slide,'CHALLENGE & ACTION',RX+0.22,CY+0.18,2.2,0.2,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  hrLine(slide,RX+2.1,CY+0.25,RW-2.28,t.div);
  const tags=['CHALLENGE','ACTION','APPROACH'];
  const actItems=smartBullets(f.process||f.intro||f.task||'',3,62).slice(0,3);
  let ry=CY+0.5;
  actItems.forEach((item,i)=>{
    const ih=Math.max(0.28,Math.ceil(item.length/50)*0.22+0.08);
    const tw=0.76;
    roundRect(slide,RX+0.18,ry+0.03,tw,0.22,t.accent+(i===0?'DD':i===1?'88':'44'),null,0.06);
    txt(slide,tags[i],RX+0.18,ry+0.03,tw,0.22,{fontSize:6.5,bold:true,color:'ffffff',align:'center',valign:'middle',isTextBox:true});
    txt(slide,item,RX+1.04,ry,RW-1.22,ih,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top'});
    ry+=ih+0.14;
  });
}

/* 5d. SITUATION — Consult / STAR (4-quadrant) */
function buildSituationConsult(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'S·T·A·R',t,0.5,0.24,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.46,7.8,0.46,{fontSize:21,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const CY=1.0, CH=SH-CY-0.28;
  const qW=(SW-1.24)/2, qH=(CH-0.14)/2;
  const quads=[
    {k:'S',name:'Situation',src:f.overview||f.description||f.task||''},
    {k:'T',name:'Task',src:f.task||f.process||''},
    {k:'A',name:'Action',src:f.process||f.intro||''},
    {k:'R',name:'Result',src:f.output||f.growth||f.aiSummary||''},
  ];
  quads.forEach(({k,name,src},i)=>{
    const col=i%2, row=Math.floor(i/2);
    const qx=0.5+col*(qW+0.24);
    const qy=CY+row*(qH+0.14);
    roundRect(slide,qx,qy,qW,qH,t.card,t.div,0.08);
    // ghost letter background
    txt(slide,k,qx+qW-0.62,qy+0.08,0.58,0.56,{fontSize:54,bold:true,color:hexClean(t.accent),isTextBox:true,transparency:84});
    // badge + label
    roundRect(slide,qx+0.18,qy+0.15,0.24,0.24,t.accent,null,0.04);
    txt(slide,k,qx+0.18,qy+0.15,0.24,0.24,{fontSize:10,bold:true,color:'ffffff',align:'center',valign:'middle',isTextBox:true});
    txt(slide,name.toUpperCase(),qx+0.50,qy+0.19,qW-0.68,0.18,{fontSize:8.5,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
    hrLine(slide,qx+0.18,qy+0.46,qW-0.36,t.div);
    // content (max 2 bullets)
    const items=smartBullets(src,2,58).slice(0,2);
    let iy=qy+0.58;
    items.forEach(item=>{
      const ih=Math.max(0.22,Math.ceil(item.length/46)*0.19+0.04);
      txt(slide,item,qx+0.18,iy,qW-0.36,ih,{fontSize:10.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
      iy+=ih+0.1;
    });
    if(!items.length&&src) txt(slide,sh(src,75),qx+0.18,qy+0.58,qW-0.36,qH-0.64,{fontSize:10.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
  });
}

/* 5e. SITUATION — Design (Process bar + User Problem | Design Solution) */
function buildSituationDesign(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  slideHeader(slide,String(idx+1).padStart(2,'0'),'DESIGN',exp.title||'프로젝트',t);
  // Process bar
  const steps=['Research','Define','Design','Deliver'];
  const stepW=(SW-1.0)/4;
  steps.forEach((s,i)=>{
    const sx=0.5+i*stepW;
    const active=i===1||i===2;
    roundRect(slide,sx+0.05,1.04,stepW-0.1,0.3,active?t.accent+'35':t.card,active?t.accent+'70':t.div,0.06);
    txt(slide,s,sx+0.05,1.04,stepW-0.1,0.3,{fontSize:9.5,bold:active,color:hexClean(active?t.accent:t.sub),align:'center',valign:'middle',isTextBox:true});
    if(i<3) txt(slide,'›',sx+stepW-0.08,1.08,0.14,0.22,{fontSize:11,color:hexClean(t.accent),bold:true,isTextBox:true,valign:'middle'});
  });
  const CY=1.46, CH=SH-CY-0.3;
  const LW=(SW-1.4)/2, RX=0.5+LW+0.4, RW=SW-RX-0.5;
  roundRect(slide,0.5,CY,LW,CH,t.card,t.div,0.1);
  txt(slide,'USER PROBLEM',0.72,CY+0.16,1.8,0.2,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  hrLine(slide,0.72+1.44,CY+0.23,LW-1.64,t.div);
  const probItems=smartBullets(f.task||f.overview||f.description||'',3,60).slice(0,3);
  let ly=CY+0.46;
  probItems.forEach(item=>{
    const ih=Math.max(0.26,Math.ceil(item.length/48)*0.22+0.06);
    circle(slide,0.74,ly+0.07,0.14,t.accent+'40');
    txt(slide,item,0.94,ly,LW-0.62,ih,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top'});
    ly+=ih+0.14;
  });
  roundRect(slide,RX,CY,RW,CH,t.card,t.div,0.1);
  txt(slide,'DESIGN SOLUTION',RX+0.22,CY+0.16,2.0,0.2,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  hrLine(slide,RX+1.82,CY+0.23,RW-2.02,t.div);
  const solItems=smartBullets(f.process||f.intro||'',3,60).slice(0,3);
  let ry=CY+0.46;
  solItems.forEach((item,i)=>{
    const ih=Math.max(0.26,Math.ceil(item.length/48)*0.22+0.06);
    roundRect(slide,RX+0.2,ry+0.02,0.24,0.22,t.accent+'28',null,0.04);
    txt(slide,String(i+1),RX+0.2,ry+0.02,0.24,0.22,{fontSize:9,bold:true,color:hexClean(t.accent),align:'center',isTextBox:true});
    txt(slide,item,RX+0.54,ry,RW-0.74,ih,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top'});
    ry+=ih+0.14;
  });
}

/* 5. SITUATION — dispatcher */
function buildSituation(prs,exp,idx,t,f,theme){
  const layout=getLayout(theme);
  if(layout==='tech') return buildSituationTech(prs,exp,idx,t,f);
  if(layout==='story') return buildSituationStory(prs,exp,idx,t,f);
  if(layout==='consult') return buildSituationConsult(prs,exp,idx,t,f);
  if(layout==='design') return buildSituationDesign(prs,exp,idx,t,f);
  return buildSituationDefault(prs,exp,idx,t,f);
}

/* 6. RESULT — Story variant (campaign metrics focus) */
function buildResultStory(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'CAMPAIGN RESULT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,7.8,0.5,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const CY=1.12, CH=SH-CY-0.3;
  const kx=f.keyExperiences.slice(0,3);
  // Full-width 주요 숫자 metric bar
  if(kx.length>0){
    const mW=(SW-1.0)/Math.min(kx.length,3);
    kx.slice(0,3).forEach((ke,i)=>{
      const mx=0.5+i*mW;
      roundRect(slide,mx+0.05,CY,mW-0.1,0.9,t.resBg||t.card,t.resBd||t.div,0.08);
      txt(slide,sh(ke.title||'성과',20),mx+0.18,CY+0.1,mW-0.36,0.18,{fontSize:7,bold:true,color:hexClean(t.sub),charSpacing:1.5,isTextBox:true,align:'center'});
      txt(slide,sh(String(ke.metric)||'-',14),mx+0.18,CY+0.32,mW-0.36,0.5,{fontSize:26,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center'});
    });
  }
  const bodyY=CY+(kx.length>0?1.04:0);
  const bodyH=SH-bodyY-0.3;
  const LW=(SW-1.4)/2, RX=0.5+LW+0.4, RW=SW-RX-0.5;
  // Left: Results bullets
  roundRect(slide,0.5,bodyY,LW,bodyH,t.card,t.div,0.1);
  sectionBold(slide,'Campaign Result',t,0.72,bodyY+0.18,LW-0.44);
  const outB=toBullets(f.output,3);
  let by=bodyY+0.5;
  outB.forEach(b=>{ const ih=Math.max(0.26,Math.ceil(b.length/50)*0.22+0.06); txt(slide,'>',0.72,by,0.18,ih,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true}); txt(slide,b,0.90,by,LW-0.6,ih,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top'}); by+=ih+0.12; });
  // Right: Growth + Insight
  roundRect(slide,RX,bodyY,RW,bodyH,t.card,t.div,0.1);
  sectionBold(slide,'Growth & Learning',t,RX+0.22,bodyY+0.18,RW-0.44);
  const growB=toBullets(f.growth||f.competency,3);
  let gy=bodyY+0.5;
  growB.forEach(b=>{ const ih=Math.max(0.26,Math.ceil(b.length/44)*0.22+0.06); txt(slide,'>',RX+0.22,gy,0.18,ih,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true}); txt(slide,b,RX+0.40,gy,RW-0.6,ih,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top'}); gy+=ih+0.12; });
  if(kx[0]?.beforeMetric&&kx[0]?.afterMetric&&gy<bodyY+bodyH-0.7){
    const bpY=gy+0.1;
    roundRect(slide,RX+0.18,bpY,RW-0.36,0.72,t.resBg||t.card,t.resBd||t.div,0.06);
    barPair(slide,RX+0.34,bpY+0.08,RW-0.68,kx[0].beforeMetric,kx[0].afterMetric,t);
  }
}

/* 6. RESULT — Default + Tech (공통: key result + metrics) */
function buildResultDefault(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'RESULT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'프로젝트',42),0.5,0.50,7.8,0.50,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const CY=1.12, CH=SH-CY-0.3;
  const kx=f.keyExperiences.slice(0,3);
  const showRight=kx.length>0;
  const LW=showRight?(SW-1.0)*0.56:(SW-1.0), cardX=0.5;
  roundRect(slide,cardX,CY,LW,CH,t.card,t.div,0.1);
  sectionBold(slide,'Key Result',t,cardX+0.24,CY+0.18,LW-0.48);
  const outB=toBullets(f.output,4), growB=toBullets(f.growth,3);
  let by=CY+0.5;
  if(outB.length>0){ by=addBulletRows(slide,outB,cardX+0.24,by,LW-0.48,t,62,'arrow'); by+=0.08; }
  if(growB.length>0){
    hrLine(slide,cardX+0.24,by,LW-0.48,t.div+'55'); by+=0.14;
    txt(slide,'GROWTH',cardX+0.24,by,1.5,0.16,{fontSize:6.5,bold:true,color:hexClean(t.sub),charSpacing:2,isTextBox:true}); by+=0.2;
    by=addBulletRows(slide,growB,cardX+0.24,by,LW-0.48,t,62,'arrow'); by+=0.08;
  }
  if(f.competency&&by<CY+CH-0.62){
    roundRect(slide,cardX+0.24,by,LW-0.48,Math.min(0.62,CY+CH-by-0.06),t.step,t.div+'44',0.06);
    rect(slide,cardX+0.24,by,0.04,Math.min(0.62,CY+CH-by-0.06),t.accent);
    txt(slide,'COMPETENCY',cardX+0.28,by+0.06,1.5,0.14,{fontSize:6.5,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
    txt(slide,sh(f.competency,90),cardX+0.28,by+0.22,LW-0.56,0.34,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
  if(showRight){
    const RX=cardX+LW+0.22, RW=SW-RX-0.5;
    kx.slice(0,2).forEach((ke,i)=>{
      metricBox(slide,RX+i*(RW/2+0.06)/2*2,CY,RW/2-0.06,0.82,sh(ke.title||('성과 '+(i+1)),20),sh(String(ke.metric)||'-',12),t);
    });
    if(kx[0]?.beforeMetric&&kx[0]?.afterMetric){
      roundRect(slide,RX,CY+0.9,RW,0.84,t.card,t.div,0.08);
      barPair(slide,RX+0.16,CY+1.0,RW-0.32,kx[0].beforeMetric,kx[0].afterMetric,t);
    }
    if(kx[2]){
      const y3=CY+(kx[0]?.beforeMetric?1.84:0.9);
      roundRect(slide,RX,y3,RW,CH-(y3-CY),t.resBg||t.card,t.resBd||t.div,0.08);
      txt(slide,sh(kx[2].title||'추가 성과',25),RX+0.16,y3+0.12,RW-0.32,0.16,{fontSize:6.5,bold:true,color:hexClean(t.sub),charSpacing:2,isTextBox:true});
      txt(slide,sh(String(kx[2].metric)||'-',15),RX+0.16,y3+0.30,RW-0.32,0.42,{fontSize:22,bold:true,color:hexClean(t.accent),isTextBox:true});
    }
  }
}

/* 6. RESULT — dispatcher */
function buildResult(prs,exp,idx,t,f,theme){
  const layout=getLayout(theme);
  if(layout==='story') return buildResultStory(prs,exp,idx,t,f);
  return buildResultDefault(prs,exp,idx,t,f);
}

/* 7. OUTRO */
function buildOutro(prs,p,t){
  const slide=prs.addSlide();
  addBg(slide,t.coverBg);
  if(t.dark){
    circle(slide,SW-2.2,-0.7,2.5,hexClean(t.accent)+'18');
  }
  rect(slide,0,0,0.04,SH,t.accent);
  const goals=(p.goals||[]).filter(g=>g.status!=='done').slice(0,3);
  const c=p.contact||{};
  const cl=[c.email,c.phone,c.github].filter(Boolean);
  if(goals.length>0){
    sectionLabel(slide,'FUTURE GOALS',t,0.5,0.38,SW/2-0.7);
    goals.forEach((g,i)=>{
      const GY=0.78+i*0.82;
      roundRect(slide,0.5,GY,SW/2-0.7,0.7,t.card+'dd',t.div+'44',0.08);
      rect(slide,0.5,GY,0.04,0.7,t.accent);
      txt(slide,sh(g.title,45),0.7,GY+0.1,SW/2-1.2,0.26,{fontSize:11,bold:true,color:hexClean(t.text),isTextBox:true});
      if(g.description) txt(slide,sh(g.description,80),0.7,GY+0.38,SW/2-1.2,0.26,{fontSize:8.5,color:hexClean(t.sub),isTextBox:true});
    });
    rect(slide,SW/2,0,0.012,SH,t.div);
  }
  // Thank You area
  const TX=goals.length>0?SW/2+0.28:SW*0.2;
  const TW=goals.length>0?SW/2-0.48:SW*0.6;
  txt(slide,'Thank You',TX,SH/2-1.05,TW,0.82,{fontSize:40,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center',charSpacing:-1});
  txt(slide,nameSpaced(p.userName||''),TX,SH/2-0.15,TW,0.38,{fontSize:20,bold:true,color:hexClean(t.text),isTextBox:true,align:'center',charSpacing:6});
  if(p.targetPosition) txt(slide,p.targetPosition,TX,SH/2+0.28,TW,0.24,{fontSize:11,color:hexClean(t.sub),bold:true,isTextBox:true,align:'center'});
  hrLine(slide,TX+TW*0.35,SH/2+0.58,TW*0.3,t.accent);
  cl.forEach((cc,i)=>{
    txt(slide,cc,TX,SH/2+0.68+i*0.22,TW,0.2,{fontSize:8.5,color:hexClean(t.sub),isTextBox:true,align:'center',fontFace:t.mono?'Courier New':undefined});
  });
}

/* 8. VALUES – 가치관 슬라이드 */
function buildValues(prs,p,t){
  const vals=(p.values||[]).filter(v=>v.keyword);
  const essay=strip(p.valuesEssay||'');
  if(vals.length===0&&!essay)return;
  const slide=prs.addSlide();
  addBg(slide,t.bg);
  sectionLabel(slide,'PHILOSOPHY',t,0.5,0.30,SW-1.0);
  txt(slide,'이런 가치관으로 일합니다',0.5,0.52,SW-1.0,0.52,{fontSize:24,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  // 에세이를 단락으로 분리해 각 가치관 설명으로 활용
  const essayParas=essay?essay.split(/\n\n+/).map(s=>strip(s)).filter(s=>s.length>5):[];
  if(vals.length>0){
    const maxCards=Math.min(vals.length,4);
    const rows=Math.ceil(maxCards/2);
    const colW=(SW-1.2)/2;
    const cardH=Math.min(1.6,(SH-1.25-0.4-(rows-1)*0.12)/rows);
    for(let i=0;i<maxCards;i++){
      const v=vals[i];
      const col=i%2;
      const row=Math.floor(i/2);
      const vx=0.5+col*(colW+0.2);
      const vy=1.25+row*(cardH+0.12);
      roundRect(slide,vx,vy,colW,cardH,t.card,t.div,0.08);
      rect(slide,vx,vy,0.035,cardH,t.accent);
      txt(slide,sh(v.keyword,38),vx+0.18,vy+0.14,colW-0.28,0.3,{fontSize:13,bold:true,color:hexClean(t.text),isTextBox:true});
      const desc=v.description?strip(v.description):(essayParas[i]?sh(strip(essayParas[i]),200):'');
      if(desc){
        txt(slide,desc,vx+0.18,vy+0.48,colW-0.28,cardH-0.58,{fontSize:9,color:hexClean(t.sub),isTextBox:true,valign:'top',paraSpaceAfter:2});
      }
    }
  }else if(essay){
    // 에세이만 있을 때: 최대 2단 레이아웃
    const paras=essayParas.slice(0,2);
    const ncol=paras.length>=2?2:1;
    const colW=(SW-1.0-(ncol-1)*0.14)/ncol;
    const pH=SH-1.25-0.4;
    paras.forEach((para,i)=>{
      const px=0.5+i*(colW+0.14);
      roundRect(slide,px,1.25,colW,pH,t.card,t.div,0.08);
      rect(slide,px,1.25,0.035,pH,t.accent);
      txt(slide,sh(para,350),px+0.18,1.4,colW-0.28,pH-0.2,{fontSize:10,color:hexClean(t.text),isTextBox:true,paraSpaceAfter:5,valign:'top'});
    });
  }
}

/* 9. TIMELINE – 내 일대기 */
function buildTimeline(prs,p,t){
  const items=[];
  (p.education||[]).forEach(e=>{
    const year=e.period||e.year||'';
    if(e.name)items.push({year,title:sh(e.name,32),sub:e.degree||'',type:'edu'});
  });
  (p.experiences||[]).forEach(e=>{
    const year=e.date||e.period||'';
    if(e.organization||e.title)items.push({year,title:sh(e.organization||e.title,32),sub:e.role||'',type:'work'});
  });
  (p.awards||[]).forEach(a=>{
    const year=a.date||a.year||'';
    if(a.title)items.push({year,title:sh(a.title,32),sub:'',type:'award'});
  });
  if(items.length===0)return;
  items.sort((a,b)=>String(a.year||'').localeCompare(String(b.year||'')));
  const show=items.slice(0,6);
  const slide=prs.addSlide();
  addBg(slide,t.bg);
  sectionLabel(slide,'TIMELINE',t,0.5,0.30,SW-1.0);
  txt(slide,'내 일대기',0.5,0.52,SW-1.0,0.52,{fontSize:24,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const TY=1.22;
  const BH=SH-TY-0.44;
  const LX=SW/2;
  // 중앙 타임라인 선
  rect(slide,LX-0.012,TY,0.024,BH,t.accent+'44');
  const itemH=BH/show.length;
  // 타입별 색상
  const typeColor=tp=>tp==='edu'?t.accent:tp==='award'?'f59e0b':t.sub;
  show.forEach((item,i)=>{
    const cy=TY+i*itemH+itemH/2;
    const ch=Math.min(itemH-0.1,0.7);
    // 타임라인 점
    circle(slide,LX-0.1,cy-0.1,0.2,hexClean(typeColor(item.type)));
    const isLeft=i%2===0;
    if(isLeft){
      // 오른쪽 카드
      const cx=LX+0.22;
      const cw=SW-cx-0.5;
      roundRect(slide,cx,cy-ch/2,cw,ch,t.card,t.div,0.05);
      if(item.year)txt(slide,String(item.year).slice(0,7),cx+0.12,cy-ch/2+0.06,1.2,0.18,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});
      txt(slide,item.title,cx+0.12,cy-ch/2+0.25,cw-0.24,0.24,{fontSize:11,bold:true,color:hexClean(t.text),isTextBox:true});
      if(item.sub)txt(slide,item.sub,cx+0.12,cy-ch/2+0.5,cw-0.24,0.18,{fontSize:8.5,color:hexClean(t.sub),isTextBox:true});
    }else{
      // 왼쪽 카드
      const cw=LX-0.32-0.5;
      const cx=0.5;
      roundRect(slide,cx,cy-ch/2,cw,ch,t.card,t.div,0.05);
      if(item.year)txt(slide,String(item.year).slice(0,7),cx+0.12,cy-ch/2+0.06,1.2,0.18,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});
      txt(slide,item.title,cx+0.12,cy-ch/2+0.25,cw-0.24,0.24,{fontSize:11,bold:true,color:hexClean(t.text),isTextBox:true});
      if(item.sub)txt(slide,item.sub,cx+0.12,cy-ch/2+0.5,cw-0.24,0.18,{fontSize:8.5,color:hexClean(t.sub),isTextBox:true});
    }
  });
}

/* 10. STRENGTHS – 강점 슬라이드 */
function buildStrengths(prs,p,t){
  const vals=(p.values||[]).filter(v=>v.keyword);
  // 경험들에서 역량 수집
  const competencies=[...(p.experiences||[])]
    .map(e=>strip(e.structuredResult?.competency||e.frameworkContent?.competency||''))
    .filter(Boolean)
    .map(c=>sh(c,55));
  const strengths=[
    ...vals.map((v,i)=>({title:sh(v.keyword,32),desc:v.description?sh(strip(v.description),130):(competencies[i]||''),idx:i})),
    ...competencies.slice(vals.length,6-vals.length).map((c,i)=>({title:sh(c,32),desc:'',idx:vals.length+i})),
  ].slice(0,6);
  if(strengths.length===0)return;
  const slide=prs.addSlide();
  addBg(slide,t.bg);
  sectionLabel(slide,'STRENGTHS',t,0.5,0.30,SW-1.0);
  txt(slide,'나의 강점',0.5,0.52,SW-1.0,0.52,{fontSize:24,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const cols=Math.min(3,strengths.length);
  const rows=Math.ceil(strengths.length/cols);
  const cardW=(SW-1.0-(cols-1)*0.16)/cols;
  const cardH=Math.min(1.5,(SH-1.25-0.4-(rows-1)*0.14)/rows);
  strengths.forEach((s,i)=>{
    const col=i%cols;
    const row=Math.floor(i/cols);
    const sx=0.5+col*(cardW+0.16);
    const sy=1.25+row*(cardH+0.14);
    roundRect(slide,sx,sy,cardW,cardH,t.card,t.div,0.1);
    // 상단 악센트 바
    rect(slide,sx,sy,cardW,0.04,t.accent);
    // 번호 원형
    circle(slide,sx+0.32,sy+0.22,0.32,t.accent+'28');
    txt(slide,String(s.idx+1).padStart(2,'0'),sx+0.16,sy+0.1,0.32,0.32,{fontSize:11,bold:true,color:hexClean(t.accent),align:'center',valign:'middle',isTextBox:true});
    txt(slide,s.title,sx+0.14,sy+0.54,cardW-0.28,0.32,{fontSize:12,bold:true,color:hexClean(t.text),isTextBox:true});
    if(s.desc){
      txt(slide,s.desc,sx+0.14,sy+0.9,cardW-0.28,cardH-1.0,{fontSize:9,color:hexClean(t.sub),isTextBox:true,valign:'top',paraSpaceAfter:2});
    }
  });
}

/* ─── MAIN EXPORT ─── */
export async function generatePptx(portfolio,theme,themeObj){
  const prs=new PptxGenJS();
  prs.layout='LAYOUT_WIDE';
  prs.title=(portfolio.userName||'Portfolio')+' PPT';
  prs.author=portfolio.userName||'';
  const t=themeObj;
  const p=portfolio;
  const exps=p.experiences||[];
  const sk=p.skills||{};
  const hasSkills=[...(sk.languages||[]),...(sk.frameworks||[]),...(sk.tools||[]),...(sk.others||[])].length>0;
  const hasValues=!!(p.valuesEssay||(p.values||[]).some(v=>v.keyword));
  const hasTimeline=!!([...(p.education||[]),...(p.experiences||[]),...(p.awards||[])].length>0);
  const hasStrengths=!!((p.values||[]).some(v=>v.keyword)||(p.experiences||[]).some(e=>e.structuredResult?.competency||e.frameworkContent?.competency));

  buildCover(prs,p,t);
  buildProfile(prs,p,t);
  if(hasSkills) buildSkills(prs,p,t);
  // 가치관 / 일대기 / 강점 슬라이드 (프로젝트 앞부분에 배치)
  if(hasValues) buildValues(prs,p,t);
  if(hasTimeline) buildTimeline(prs,p,t);
  if(hasStrengths) buildStrengths(prs,p,t);

  exps.forEach((exp,idx)=>{
    const f=extractFields(exp);
    const hasSit=!!(f.task||f.process||f.overview||f.description||f.intro);
    const hasRes=!!(f.output||f.growth||f.competency||f.keyExperiences?.length);
    buildSectionDivider(prs,exp,idx,t);
    if(hasSit) buildSituation(prs,exp,idx,t,f,theme);
    if(hasRes) buildResult(prs,exp,idx,t,f,theme);
  });

  buildOutro(prs,p,t);

  const name=(p.userName||'portfolio').replace(/\s+/g,'_')+'_portfolio.pptx';
  await prs.writeFile({fileName:name});
}