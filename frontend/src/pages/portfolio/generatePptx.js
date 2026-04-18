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
  if(theme==='developer') return 'tech';
  if(theme==='data_dashboard') return 'dashboard';
  if(theme==='marketer_dark') return 'story';
  if(theme==='marketer_light') return 'funnel';
  if(theme==='problem_solver') return 'consult';
  if(theme==='star_classic') return 'framework';
  if(theme==='designer') return 'design';
  if(theme==='t_shaped') return 'tshape';
  if(theme==='rookie') return 'growth';
  if(theme==='neon_cyber') return 'cyber';
  if(theme==='forest') return 'forest';
  if(theme==='aurora') return 'aurora';
  if(theme==='sunset') return 'sunset';
  if(theme==='navy_gold') return 'navygold';
  if(theme==='coral_white') return 'coral';
  if(theme==='slate_clean') return 'slate';
  if(theme==='cherry_blossom') return 'cherry';
  if(theme==='charcoal_mint') return 'charcoalmint';
  if(theme==='pastel_portfolio') return 'pastel';
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

/* 5f. SITUATION — Dashboard (KPI strip + Hypothesis | Analysis) */
function buildSituationDashboard(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'DATA OVERVIEW',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,7.8,0.46,{fontSize:21,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  // KPI strip
  const kx=f.keyExperiences.slice(0,3);
  const metrics=kx.length>0?kx:[{title:'목표',metric:'-'},{title:'과제',metric:'-'},{title:'범위',metric:'-'}];
  const mW=(SW-1.2)/Math.min(metrics.length,3);
  metrics.slice(0,3).forEach((m,i)=>{
    const mx=0.5+i*(mW+0.1);
    roundRect(slide,mx,1.04,mW-0.1,0.72,t.resBg||t.card,t.resBd||t.div,0.08);
    txt(slide,sh(m.title||'KPI',18),mx+0.14,1.1,mW-0.38,0.16,{fontSize:6.5,bold:true,color:hexClean(t.sub),charSpacing:2,isTextBox:true,align:'center'});
    txt(slide,sh(String(m.metric)||'-',12),mx+0.14,1.3,mW-0.38,0.4,{fontSize:20,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center'});
  });
  const CY=1.88, CH=SH-CY-0.3;
  const midX=0.5+(SW-1.0)*0.5;
  // Full-width analysis card
  roundRect(slide,0.5,CY,SW-1.0,CH,t.card,t.div,0.1);
  rect(slide,midX,CY+0.14,0.012,CH-0.28,t.div);
  // Left: Hypothesis
  const spItems=smartBullets(f.task||f.overview||f.description||'',3,62).slice(0,3);
  circle(slide,0.72,CY+0.2,0.08,t.accent);
  txt(slide,'HYPOTHESIS',0.86,CY+0.16,1.4,0.18,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  let ly=CY+0.46;
  spItems.forEach(item=>{
    const ih=Math.max(0.26,Math.ceil(item.length/50)*0.22+0.06);
    txt(slide,'{',0.72,ly-0.06,0.2,ih,{fontSize:16,color:hexClean(t.accent),isTextBox:true,transparency:50});
    txt(slide,item,0.92,ly,midX-1.14,ih,{fontSize:10.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
    ly+=ih+0.12;
  });
  // Right: Analysis
  const RX=midX+0.26, RW=SW-RX-0.72;
  circle(slide,RX,CY+0.2,0.08,t.accent);
  txt(slide,'ANALYSIS',RX+0.14,CY+0.16,1.2,0.18,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  const solItems=smartBullets(f.process||f.intro||'',3,62).slice(0,3);
  let ry=CY+0.46;
  solItems.forEach((item,i)=>{
    const ih=Math.max(0.26,Math.ceil(item.length/50)*0.22+0.06);
    txt(slide,'0'+(i+1),RX,ry,0.3,0.2,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,fontFace:'Courier New',transparency:40});
    txt(slide,item,RX+0.34,ry,RW-0.34,ih,{fontSize:10.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
    ry+=ih+0.12;
  });
}

/* 5g. SITUATION — Funnel (Funnel visual + detail cards) */
function buildSituationFunnel(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'STRATEGY',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,7.8,0.46,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const CY=1.08;
  // Funnel visual (left)
  const stages=['인지','분석','실행','최적화'];
  const FW=2.2;
  stages.forEach((s,i)=>{
    const w=FW-i*0.35;
    const fx=0.5+(FW-w)/2;
    const fy=CY+i*0.58;
    const opc=i===0?'18':i===1?'30':i===2?'50':'80';
    roundRect(slide,fx,fy,w,0.46,t.accent+opc,t.accent+(i===3?'AA':'44'),0.04);
    txt(slide,s,fx,fy,w,0.46,{fontSize:9,bold:i===3,color:hexClean(i>=2?t.accent:t.sub),align:'center',valign:'middle',isTextBox:true,charSpacing:1});
  });
  // Detail cards (right)
  const allItems=[
    ...smartBullets(f.task||f.overview||f.description||'',2,58).slice(0,2),
    ...smartBullets(f.process||f.intro||'',2,58).slice(0,2),
  ].slice(0,4);
  const RX=0.5+FW+0.3, RW=SW-RX-0.5;
  const cardH=(SH-CY-0.4)/Math.max(allItems.length,1);
  allItems.forEach((item,i)=>{
    const cy=CY+i*cardH;
    const ch=Math.min(cardH-0.1,0.72);
    roundRect(slide,RX,cy,RW,ch,t.card,t.div,0.08);
    rect(slide,RX,cy,0.04,ch,t.accent);
    txt(slide,String(i+1).padStart(2,'0'),RX+0.14,cy+0.08,0.5,0.26,{fontSize:20,bold:true,color:hexClean(t.accent),isTextBox:true,transparency:60});
    txt(slide,item,RX+0.14,cy+0.28,RW-0.28,ch-0.36,{fontSize:10.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
  });
  // Context bar
  if(exp.role||f.aiSummary){
    const barY=SH-0.52;
    roundRect(slide,RX,barY,RW,0.36,t.step,t.div+'55',0.06);
    txt(slide,sh(exp.role?exp.role+(exp.date?' · '+exp.date:''):f.aiSummary,140),RX+0.14,barY+0.06,RW-0.28,0.24,{fontSize:8.5,color:hexClean(t.sub),isTextBox:true,valign:'middle'});
  }
}

/* 5h. SITUATION — T-Shape (Breadth bar + 2-col depth) */
function buildSituationTshape(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'MULTI-SKILL',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,7.8,0.46,{fontSize:21,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  // Breadth bar
  roundRect(slide,0.5,1.04,SW-1.0,0.42,t.card,t.div,0.06);
  txt(slide,'BREADTH',0.72,1.1,0.8,0.18,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  rect(slide,1.52,1.14,0.012,0.22,t.div);
  const tags=(exp.tags||exp.skills||[]).slice(0,5).map(s=>typeof s==='string'?s:s?.name).filter(Boolean);
  let px=1.66;
  if(tags.length>0){
    tags.forEach(tg=>{
      const tw=Math.min(tg.length*0.08+0.22,1.4);
      if(px+tw>SW-0.6)return;
      roundRect(slide,px,1.12,tw,0.24,t.badge,t.div,0.08);
      txt(slide,tg,px+0.08,1.13,tw-0.08,0.22,{fontSize:8.5,bold:true,color:hexClean(t.text),isTextBox:true,valign:'middle'});
      px+=tw+0.08;
    });
  }else{
    txt(slide,'다양한 영역에 걸친 경험',1.66,1.14,3,0.2,{fontSize:9,color:hexClean(t.sub),isTextBox:true});
  }
  // 2-col depth
  const CY=1.58, CH=SH-CY-0.3;
  const LW=(SW-1.4)/2, RX=0.5+LW+0.4, RW=SW-RX-0.5;
  // Left: Challenge
  roundRect(slide,0.5,CY,LW,CH,t.card,t.div,0.08);
  rect(slide,0.5,CY,LW,0.04,t.accent);
  txt(slide,'DEPTH: CHALLENGE',0.72,CY+0.16,2.0,0.18,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  const spItems=smartBullets(f.task||f.overview||f.description||'',3,58).slice(0,3);
  let ly=CY+0.44;
  spItems.forEach(item=>{
    const ih=Math.max(0.26,Math.ceil(item.length/48)*0.22+0.06);
    rect(slide,0.72,ly+0.08,0.04,ih-0.08,t.accent,{rectRadius:0.02});
    txt(slide,item,0.86,ly,LW-0.56,ih,{fontSize:10.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
    ly+=ih+0.12;
  });
  // Right: Solution
  roundRect(slide,RX,CY,RW,CH,t.card,t.div,0.08);
  rect(slide,RX,CY,RW,0.04,t.accent);
  txt(slide,'DEPTH: SOLUTION',RX+0.22,CY+0.16,2.0,0.18,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:3,isTextBox:true});
  const solItems=smartBullets(f.process||f.intro||'',3,58).slice(0,3);
  let ry=CY+0.44;
  solItems.forEach((item,i)=>{
    const ih=Math.max(0.26,Math.ceil(item.length/48)*0.22+0.06);
    circle(slide,RX+0.22,ry+0.03,0.2,t.accent+'28');
    txt(slide,String(i+1),RX+0.22,ry+0.03,0.2,0.2,{fontSize:8.5,bold:true,color:hexClean(t.accent),align:'center',valign:'middle',isTextBox:true});
    txt(slide,item,RX+0.5,ry,RW-0.7,ih,{fontSize:10.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
    ry+=ih+0.12;
  });
}

/* 5i. SITUATION — Growth (3-column journey: Challenge → Learning → Application) */
function buildSituationGrowth(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'GROWTH JOURNEY',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,7.8,0.46,{fontSize:21,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  // Progress bar
  const barY=1.02;
  const phases=[{l:'CHALLENGE',emoji:'⚡'},{l:'LEARNING',emoji:'📚'},{l:'APPLICATION',emoji:'🚀'}];
  const barW=(SW-1.0)/3;
  phases.forEach((ph,i)=>{
    const bx=0.5+i*barW;
    roundRect(slide,bx,barY,barW-0.06,0.06,i===0?t.accent:t.accent+'60',null,0.03);
    if(i<2) txt(slide,'→',bx+barW-0.12,barY-0.06,0.2,0.18,{fontSize:12,bold:true,color:hexClean(t.accent),isTextBox:true});
  });
  // 3 cards
  const CY=1.22, CH=SH-CY-0.3;
  const colW=(SW-1.0-0.24)/3;
  const challengeB=smartBullets(f.task||f.overview||f.description||'',2,52).slice(0,2);
  const learningB=smartBullets(f.process||f.intro||'',2,52).slice(0,2);
  const applyB=smartBullets(f.output||f.growth||f.competency||'',2,52).slice(0,2);
  const cols=[
    {label:'CHALLENGE',emoji:'⚡',items:challengeB},
    {label:'LEARNING',emoji:'📚',items:learningB},
    {label:'APPLICATION',emoji:'🚀',items:applyB},
  ];
  cols.forEach((col,i)=>{
    const cx=0.5+i*(colW+0.12);
    roundRect(slide,cx,CY,colW,CH,t.card,t.div,0.1);
    txt(slide,col.emoji,cx+0.16,CY+0.14,0.3,0.3,{fontSize:15,isTextBox:true});
    txt(slide,col.label,cx+0.48,CY+0.18,colW-0.64,0.2,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:2.5,isTextBox:true});
    hrLine(slide,cx+0.16,CY+0.46,colW-0.32,t.div);
    let iy=CY+0.58;
    col.items.forEach(item=>{
      const ih=Math.max(0.28,Math.ceil(item.length/40)*0.22+0.08);
      txt(slide,item,cx+0.16,iy,colW-0.32,ih,{fontSize:10.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
      iy+=ih+0.1;
    });
    if(col.items.length===0) txt(slide,'내용 없음',cx+0.16,CY+0.58,colW-0.32,0.3,{fontSize:9.5,color:hexClean(t.sub),isTextBox:true,italic:true});
  });
}

/* 5j. SITUATION — Framework (Horizontal 4-step STAR flow) */
function buildSituationFramework(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'STAR FRAMEWORK',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,7.8,0.46,{fontSize:21,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const CY=1.06, CH=SH-CY-0.28;
  const steps=[
    {k:'S',label:'Situation',text:sh(f.overview||f.description||f.task||'',90)},
    {k:'T',label:'Task',text:sh(f.task||f.process||'',90)},
    {k:'A',label:'Action',text:sh(f.process||f.intro||'',90)},
    {k:'R',label:'Result',text:sh(f.output||f.growth||f.aiSummary||'',90)},
  ];
  const colW=(SW-1.0-0.36)/4;
  steps.forEach((s,i)=>{
    const cx=0.5+i*(colW+0.12);
    roundRect(slide,cx,CY,colW,CH,t.card,t.div,0.1);
    // top accent strip
    rect(slide,cx,CY,colW,0.04,t.accent,{transparency:Math.round((1-(0.3+i*0.2))*100)});
    // badge
    roundRect(slide,cx+0.16,CY+0.18,0.28,0.28,t.accent,null,0.06);
    txt(slide,s.k,cx+0.16,CY+0.18,0.28,0.28,{fontSize:12,bold:true,color:'ffffff',align:'center',valign:'middle',isTextBox:true});
    txt(slide,s.label.toUpperCase(),cx+0.52,CY+0.22,colW-0.68,0.2,{fontSize:8,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
    hrLine(slide,cx+0.16,CY+0.54,colW-0.32,t.div);
    // ghost letter
    txt(slide,s.k,cx+colW-0.52,CY+0.12,0.44,0.52,{fontSize:42,bold:true,color:hexClean(t.accent),isTextBox:true,transparency:90});
    // content
    txt(slide,s.text||'-',cx+0.16,CY+0.64,colW-0.32,CH-0.78,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
    // arrow
    if(i<3) txt(slide,'›',cx+colW+0.02,CY+CH/2-0.1,0.12,0.24,{fontSize:14,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
  });
}

/* ── 5k-t. New 10 Situation builders ── */
function buildSituationCyber(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'SYS.LOG',t,0.5,0.28,SW-1.0);
  // terminal header bar
  rect(slide,0.5,0.62,SW-1.0,0.28,'#000000',t.div);
  txt(slide,'● ● ●',0.64,0.67,0.8,0.16,{fontSize:8,color:'#ffaa00',isTextBox:true});
  txt(slide,'> '+(exp.title||'PROJECT').toUpperCase().slice(0,24),1.4,0.67,SW-2.4,0.16,{fontSize:8,color:'#888888',isTextBox:true,fontFace:'Courier New'});
  // terminal body bg
  rect(slide,0.5,0.90,SW-1.0,SH-1.28,'#080808',t.div);
  const CY=1.04; const CH=SH-CY-0.22;
  const midX=SW/2+0.06;
  // left: Problem
  txt(slide,'$ PROBLEM_DEFINITION --scan',0.66,CY,midX-0.90,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,fontFace:'Courier New',charSpacing:0.5});
  const spBullets=smartBullets(f.task||f.overview||f.description,3);
  spBullets.slice(0,3).forEach((b,i)=>{
    txt(slide,`[!${i+1}]`,0.66,CY+0.26+i*0.60,0.36,0.20,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,fontFace:'Courier New'});
    txt(slide,b,1.06,CY+0.24+i*0.60,midX-1.28,0.32,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
  // divider
  rect(slide,midX,CY-0.02,0.01,CH,'#ffffff',undefined,20);
  // right: Solution
  txt(slide,'$ SOLUTION_INIT --execute',midX+0.16,CY,SW-midX-0.66,0.18,{fontSize:7,bold:true,color:'#28c840',isTextBox:true,fontFace:'Courier New',charSpacing:0.5});
  const solBullets=smartBullets(f.process||f.intro,3);
  solBullets.slice(0,3).forEach((b,i)=>{
    txt(slide,'> S'+String(i+1).padStart(2,'0'),midX+0.16,CY+0.26+i*0.60,0.52,0.20,{fontSize:9,bold:true,color:'#28c840',isTextBox:true,fontFace:'Courier New'});
    txt(slide,b,midX+0.72,CY+0.24+i*0.60,SW-midX-1.0,0.32,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
}

function buildSituationForest(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'INITIATIVE',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const CY=1.06; const CH=SH-CY-0.30; const colW=(SW-1.14)/2;
  // Left: WHY card
  roundRect(slide,0.5,CY,colW,CH,t.card,t.accent,0.06);
  rect(slide,0.5,CY,0.04,CH,t.accent,undefined);
  txt(slide,'🌱 WHY',0.62,CY+0.12,colW-0.16,0.18,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
  addBulletRows(slide,smartBullets(f.task||f.overview||f.description,3),0.62,CY+0.38,colW-0.20,CH-0.56,t,'disc');
  // Arrow
  txt(slide,'→',SW/2-0.06,CY+CH/2-0.12,0.24,0.28,{fontSize:16,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
  // Right: HOW card with circle steps
  const rx=0.5+colW+0.14;
  roundRect(slide,rx,CY,colW,CH,t.card,t.accent,0.06);
  txt(slide,'🌿 HOW',rx+0.16,CY+0.12,colW-0.20,0.18,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
  const sb=smartBullets(f.process||f.intro,3);
  sb.slice(0,3).forEach((b,i)=>{
    circle(slide,rx+0.24,CY+0.42+i*0.62,0.18,t.accent);
    txt(slide,String(i+1),rx+0.18,CY+0.38+i*0.62,0.18,0.20,{fontSize:9,bold:true,color:'#ffffff',isTextBox:true,align:'center'});
    txt(slide,b,rx+0.50,CY+0.38+i*0.62,colW-0.62,0.42,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
}

function buildSituationAurora(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  // aurora gradient header (simulated with rect)
  rect(slide,0,0,SW,0.80,t.accent,undefined,15);
  projectLabel(slide,num,'DEEP WORK',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.52,SW-1.0,0.40,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const CY=1.08; const CH=SH-CY-0.30; const colW=(SW-1.10)/2;
  // Left: CHALLENGE card with gradient effect
  roundRect(slide,0.5,CY,colW,CH,t.card,t.accent,0.06);
  sectionLabel(slide,'CHALLENGE',0.66,CY+0.12,colW-0.20,t);
  addBulletRows(slide,smartBullets(f.task||f.overview||f.description,3),0.66,CY+0.38,colW-0.20,CH-0.52,t,'circle');
  // Right: APPROACH card
  const rx=0.5+colW+0.10;
  roundRect(slide,rx,CY,colW,CH,t.card,t.div,0.06);
  sectionLabel(slide,'APPROACH',rx+0.16,CY+0.12,colW-0.20,t);
  const sb=smartBullets(f.process||f.intro,3);
  sb.slice(0,3).forEach((b,i)=>{
    roundRect(slide,rx+0.16,CY+0.36+i*0.58,0.24,0.20,t.accent+'20',t.accent,0.04);
    txt(slide,String(i+1).padStart(2,'0'),rx+0.16,CY+0.36+i*0.58,0.24,0.20,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center'});
    txt(slide,b,rx+0.46,CY+0.34+i*0.58,colW-0.64,0.40,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
}

function buildSituationSunset(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'STORY',t,0.5,0.28,SW-1.0);
  // Pull-quote bar
  const quote=sh(f.aiSummary||f.task||f.overview||exp.description||exp.title||'',90);
  rect(slide,0.5,0.52,0.05,0.44,t.accent,undefined);
  roundRect(slide,0.5,0.52,SW-1.0,0.46,t.card,t.div,0.06);
  txt(slide,'"',0.62,0.46,0.40,0.44,{fontSize:36,bold:true,color:hexClean(t.accent),isTextBox:true,transparency:80});
  txt(slide,quote,0.98,0.56,SW-1.56,0.36,{fontSize:11,bold:true,italic:true,color:hexClean(t.text),isTextBox:true,valign:'middle'});
  const CY=1.08; const CH=SH-CY-0.30; const colW=(SW-1.10)/2;
  // Left: CONTEXT
  roundRect(slide,0.5,CY,colW,CH,t.card,t.div,0.06);
  sectionLabel(slide,'CONTEXT',0.66,CY+0.12,colW-0.20,t);
  addBulletRows(slide,smartBullets(f.task||f.overview||f.description,3),0.66,CY+0.36,colW-0.20,CH-0.50,t,'disc');
  // Right: ACTION
  const rx=0.5+colW+0.10;
  roundRect(slide,rx,CY,colW,CH,t.card,t.div,0.06);
  sectionLabel(slide,'ACTION',rx+0.16,CY+0.12,colW-0.20,t);
  const sb=smartBullets(f.process||f.intro,3);
  sb.slice(0,3).forEach((b,i)=>{
    roundRect(slide,rx+0.16,CY+0.36+i*0.58,0.28,0.26,t.accent+'20',undefined,0.04);
    txt(slide,String(i+1),rx+0.16,CY+0.35+i*0.58,0.28,0.26,{fontSize:11,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center',valign:'middle'});
    txt(slide,b,rx+0.52,CY+0.34+i*0.58,colW-0.70,0.42,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
}

function buildSituationNavyGold(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  // Header divider
  hrLine(slide,0.5,0.38,SW-1.0,t.div);
  txt(slide,'PROJECT '+num,0.5,0.26,1.8,0.18,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:3,textTransform:'uppercase'});
  txt(slide,'EXECUTIVE BRIEF',SW-2.3,0.26,1.8,0.18,{fontSize:8,bold:false,color:hexClean(t.sub),isTextBox:true,charSpacing:2,align:'right',textTransform:'uppercase'});
  txt(slide,sh(exp.title||'',42),0.5,0.46,SW-1.0,0.48,{fontSize:26,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  if(exp.role||exp.date) txt(slide,(exp.role||'')+(exp.date?' · '+exp.date:''),0.5,0.98,SW-1.0,0.22,{fontSize:11,bold:true,color:hexClean(t.accent),isTextBox:true});
  const CY=1.28; const CH=SH-CY-0.30;
  const leftW=SW*0.42-0.20;
  // Left: SITUATION cards
  sectionLabel(slide,'SITUATION',0.5,CY,leftW,t);
  const sp=smartBullets(f.task||f.overview||f.description,2);
  sp.slice(0,2).forEach((b,i)=>{
    roundRect(slide,0.5,CY+0.24+i*(CH-0.24)/2.1,leftW,CH/2-0.18,t.card,t.div,0.06);
    txt(slide,b,0.66,CY+0.32+i*(CH-0.24)/2.1,leftW-0.24,CH/2-0.36,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  // Divider
  rect(slide,leftW+0.60,CY,0.01,CH,t.div,undefined,30);
  // Right: Action timeline
  const rx=leftW+0.80;
  sectionLabel(slide,'ACTION PLAN',rx,CY,SW-rx-0.5,t);
  const sb=smartBullets(f.process||f.intro,3);
  sb.slice(0,3).forEach((b,i)=>{
    // Timeline line
    if(i<sb.length-1) rect(slide,rx+0.10,CY+0.44+i*0.64,0.02,0.64,t.accent,undefined,50);
    circle(slide,rx+0.14,CY+0.40+i*0.64,0.14,t.accent);
    txt(slide,'',rx+0.10,CY+0.38+i*0.64,0.14,0.14,{});
    txt(slide,b,rx+0.38,CY+0.34+i*0.64,SW-rx-0.70,0.42,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
}

function buildSituationCoral(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'PROJECT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const CY=1.06; const CH=SH-CY-0.30; const colW=(SW-1.20)/3;
  const items=[
    {emoji:'🔍',label:'WHY',text:toBullets(f.task||f.overview||f.description,1)[0]||''},
    {emoji:'💡',label:'WHAT',text:toBullets(f.process||f.intro||f.aiSummary,1)[0]||''},
    {emoji:'🚀',label:'HOW',text:toBullets(f.process||f.overview,1)[0]||''},
  ];
  items.forEach((item,i)=>{
    const cx=0.5+i*(colW+0.10);
    roundRect(slide,cx,CY,colW,CH,t.card,i===0?t.accent:t.div,0.08);
    txt(slide,item.emoji,cx+0.20,CY+0.16,0.36,0.36,{fontSize:22,isTextBox:true,align:'center'});
    txt(slide,item.label,cx+0.20,CY+0.58,colW-0.40,0.20,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2.5,textTransform:'uppercase'});
    hrLine(slide,cx+0.20,CY+0.82,0.40,t.accent,undefined,30);
    txt(slide,sh(item.text,100),cx+0.18,CY+0.96,colW-0.36,CH-1.12,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
}

function buildSituationSlate(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'BREAKDOWN',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const CY=1.06; const CH=SH-CY-0.30;
  const sp=smartBullets(f.task||f.overview||f.description,3);
  const sol=smartBullets(f.process||f.intro,3);
  const rows=[...sp.slice(0,3).map((b,i)=>({b,type:'P',i})),...sol.slice(0,2).map((b,i)=>({b,type:'S',i}))].slice(0,5);
  const rowH=CH/rows.length-0.06;
  rows.forEach(({b,type,i},j)=>{
    const ry=CY+j*(rowH+0.06);
    roundRect(slide,0.5,ry,SW-1.0,rowH,t.card,t.div,0.06);
    roundRect(slide,0.5,ry,0.56,rowH,t.accent+(type==='P'?'20':'40'),undefined,0.06);
    txt(slide,type+(i+1),0.50,ry,0.56,rowH,{fontSize:10,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center',valign:'middle',fontFace:'Courier New'});
    txt(slide,b,1.14,ry+0.06,SW-2.50,rowH-0.12,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'middle',paraSpaceAfter:2});
    roundRect(slide,SW-1.44,ry+0.06,0.86,rowH-0.12,t.step,undefined,0.04);
    txt(slide,type==='P'?'Problem':'Solution',SW-1.42,ry+0.06,0.84,rowH-0.12,{fontSize:8,bold:true,color:hexClean(t.sub),isTextBox:true,align:'center',valign:'middle'});
  });
}

function buildSituationCherry(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'EXPERIENCE',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const CY=1.04; const CH=SH-CY-0.28; const colW=(SW-1.10)/2;
  const sp=smartBullets(f.task||f.overview||f.description,3);
  const sol=smartBullets(f.process||f.intro,3);
  // Left: 과제
  sectionBold(slide,'🌸 과제',0.5,CY,colW,t);
  sp.slice(0,3).forEach((b,i)=>{
    const rh=(CH-0.28)/3;
    roundRect(slide,0.5,CY+0.24+i*(rh+0.06),colW,rh,t.card,t.div,0.06);
    rect(slide,0.5,CY+0.24+i*(rh+0.06),colW,0.03,t.accent+(i===0?'DD':'66'),undefined);
    txt(slide,b,0.66,CY+0.28+i*(rh+0.06),colW-0.24,rh-0.10,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
  // Right: 실행
  const rx=0.5+colW+0.10;
  sectionBold(slide,'🌸 실행',rx,CY,colW,t);
  sol.slice(0,3).forEach((b,i)=>{
    const rh=(CH-0.28)/3;
    roundRect(slide,rx,CY+0.24+i*(rh+0.06),colW,rh,t.card,t.div,0.06);
    rect(slide,rx,CY+0.24+i*(rh+0.06),colW,0.03,t.accent+(i===0?'DD':'66'),undefined);
    txt(slide,'Step '+(i+1),rx+0.16,CY+0.30+i*(rh+0.06),0.54,0.18,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});
    txt(slide,b,rx+0.70,CY+0.28+i*(rh+0.06),colW-0.82,rh-0.10,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
}

function buildSituationCharcoalMint(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  // Left accent panel
  const PW=2.20;
  rect(slide,0,0,PW,SH,t.coverBg,undefined);
  txt(slide,'PROJECT\n'+num,0.16,SH-1.20,PW-0.32,0.52,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:3,valign:'bottom'});
  txt(slide,sh(exp.title||'',20),0.16,SH-0.72,PW-0.32,0.58,{fontSize:17,bold:true,color:hexClean(t.text),isTextBox:true,valign:'bottom',charSpacing:-0.3});
  if(exp.role) txt(slide,exp.role,0.16,SH-0.22,PW-0.32,0.20,{fontSize:9,color:hexClean(t.sub),isTextBox:true,bold:true});
  rect(slide,0.20,SH-0.86,0.30,0.02,t.accent,undefined);
  // Right body
  const RX=PW+0.32;
  const RW=SW-RX-0.40;
  const CY=0.46; const CH=(SH-CY-0.26)/2-0.08;
  // PROBLEM
  roundRect(slide,RX,CY,RW,CH,t.card,t.div,0.06);
  sectionLabel(slide,'PROBLEM',RX+0.16,CY+0.10,RW-0.24,t);
  addBulletRows(slide,smartBullets(f.task||f.overview||f.description,3),RX+0.16,CY+0.32,RW-0.24,CH-0.44,t,'disc');
  // SOLUTION
  const SY=CY+CH+0.18;
  roundRect(slide,RX,SY,RW,CH,t.card,t.div,0.06);
  sectionLabel(slide,'SOLUTION',RX+0.16,SY+0.10,RW-0.24,t);
  const sol=smartBullets(f.process||f.intro,3);
  sol.slice(0,3).forEach((b,i)=>{
    txt(slide,'0'+(i+1),RX+0.16,SY+0.32+i*0.42,0.26,0.22,{fontSize:10,bold:true,color:hexClean(t.accent),isTextBox:true,fontFace:'Courier New'});
    txt(slide,b,RX+0.46,SY+0.30+i*0.42,RW-0.64,0.34,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
}

function buildSituationPastel(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'PROJECT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const CY=1.04; const CH=SH-CY-0.30;
  const colW=(SW-1.24)/3;
  const sections=[
    {emoji:'🎯',label:'Challenge',text:toBullets(f.task||f.overview||f.description,1)[0]||''},
    {emoji:'✨',label:'Approach',text:toBullets(f.process||f.intro,1)[0]||''},
    {emoji:'💬',label:'Summary',text:sh(f.aiSummary||exp.description||exp.role||'',100)},
  ];
  sections.forEach((sec,i)=>{
    const cx=0.5+i*(colW+0.12);
    // header tag
    roundRect(slide,cx,CY,colW,0.32,t.card,t.div,0.06);
    txt(slide,sec.emoji+' '+sec.label.toUpperCase(),cx+0.14,CY,colW-0.28,0.32,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:1.5,valign:'middle'});
    // content card
    roundRect(slide,cx,CY+0.38,colW,CH-0.44,t.accent+'22',t.accent,0.08);
    txt(slide,sec.text||'-',cx+0.16,CY+0.50,colW-0.32,CH-0.72,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:4,lineSpacingMultiple:1.3});
  });
}

/* 5. SITUATION — dispatcher */
function buildSituation(prs,exp,idx,t,f,theme){
  const layout=getLayout(theme);
  if(layout==='tech') return buildSituationTech(prs,exp,idx,t,f);
  if(layout==='story') return buildSituationStory(prs,exp,idx,t,f);
  if(layout==='consult') return buildSituationConsult(prs,exp,idx,t,f);
  if(layout==='design') return buildSituationDesign(prs,exp,idx,t,f);
  if(layout==='dashboard') return buildSituationDashboard(prs,exp,idx,t,f);
  if(layout==='funnel') return buildSituationFunnel(prs,exp,idx,t,f);
  if(layout==='tshape') return buildSituationTshape(prs,exp,idx,t,f);
  if(layout==='growth') return buildSituationGrowth(prs,exp,idx,t,f);
  if(layout==='framework') return buildSituationFramework(prs,exp,idx,t,f);
  if(layout==='cyber') return buildSituationCyber(prs,exp,idx,t,f);
  if(layout==='forest') return buildSituationForest(prs,exp,idx,t,f);
  if(layout==='aurora') return buildSituationAurora(prs,exp,idx,t,f);
  if(layout==='sunset') return buildSituationSunset(prs,exp,idx,t,f);
  if(layout==='navygold') return buildSituationNavyGold(prs,exp,idx,t,f);
  if(layout==='coral') return buildSituationCoral(prs,exp,idx,t,f);
  if(layout==='slate') return buildSituationSlate(prs,exp,idx,t,f);
  if(layout==='cherry') return buildSituationCherry(prs,exp,idx,t,f);
  if(layout==='charcoalmint') return buildSituationCharcoalMint(prs,exp,idx,t,f);
  if(layout==='pastel') return buildSituationPastel(prs,exp,idx,t,f);
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

/* 6c. RESULT — Dashboard (KPI grid + data insight 2-col) */
function buildResultDashboard(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'DATA RESULT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,7.8,0.46,{fontSize:21,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const kx=f.keyExperiences.slice(0,4);
  let bodyY=1.08;
  // KPI grid
  if(kx.length>0){
    const mW=(SW-1.0-(kx.length-1)*0.1)/Math.min(kx.length,4);
    kx.slice(0,4).forEach((ke,i)=>{
      const mx=0.5+i*(mW+0.1);
      roundRect(slide,mx,bodyY,mW-0.1,0.72,t.resBg||t.card,t.resBd||t.div,0.08);
      txt(slide,sh(ke.title||'KPI',20),mx+0.12,bodyY+0.08,mW-0.34,0.16,{fontSize:6.5,bold:true,color:hexClean(t.sub),charSpacing:2,isTextBox:true,align:'center'});
      txt(slide,sh(String(ke.metric)||'-',12),mx+0.12,bodyY+0.28,mW-0.34,0.38,{fontSize:22,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center'});
    });
    bodyY+=0.84;
  }
  // Before/After bar
  if(kx[0]?.beforeMetric&&kx[0]?.afterMetric){
    roundRect(slide,0.5,bodyY,SW-1.0,0.68,t.card,t.div,0.08);
    barPair(slide,0.72,bodyY+0.08,SW-1.44,kx[0].beforeMetric,kx[0].afterMetric,t);
    bodyY+=0.78;
  }
  // 2-col insight
  const CH=SH-bodyY-0.26;
  const LW=(SW-1.4)/2, RX=0.5+LW+0.4, RW=SW-RX-0.5;
  roundRect(slide,0.5,bodyY,LW,CH,t.card,t.div,0.08);
  circle(slide,0.72,bodyY+0.16,0.08,t.accent);
  txt(slide,'OUTPUT',0.86,bodyY+0.12,1.0,0.18,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
  const outB=toBullets(f.output,3);
  let by=bodyY+0.38;
  outB.forEach(b=>{const ih=Math.max(0.24,Math.ceil(b.length/50)*0.2+0.04);txt(slide,'>',0.72,by,0.16,ih,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});txt(slide,b,0.88,by,LW-0.56,ih,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top'});by+=ih+0.1;});
  roundRect(slide,RX,bodyY,RW,CH,t.card,t.div,0.08);
  circle(slide,RX+0.22,bodyY+0.16,0.08,t.accent);
  txt(slide,'INSIGHT',RX+0.36,bodyY+0.12,1.0,0.18,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
  const growB=toBullets(f.growth||f.competency,3);
  let gy=bodyY+0.38;
  growB.forEach(b=>{const ih=Math.max(0.24,Math.ceil(b.length/44)*0.2+0.04);txt(slide,'>',RX+0.22,gy,0.16,ih,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});txt(slide,b,RX+0.38,gy,RW-0.56,ih,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top'});gy+=ih+0.1;});
}

/* 6d. RESULT — Funnel (Big impact banner + detail 2-col) */
function buildResultFunnel(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'IMPACT',t,0.5,0.28,SW-1.0);
  const kx=f.keyExperiences.slice(0,3);
  const bigMetric=kx[0]?sh(String(kx[0].metric),14):'';
  const bigLabel=kx[0]?sh(kx[0].title||'핵심 성과',24):'Result';
  // Big impact banner
  roundRect(slide,0.5,0.52,SW-1.0,1.0,t.accent+'18',t.accent+'44',0.1);
  if(bigMetric) txt(slide,bigMetric,0.72,0.56,2.2,0.9,{fontSize:38,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
  txt(slide,bigLabel,3.1,0.58,1.8,0.2,{fontSize:8,bold:true,color:hexClean(t.sub),charSpacing:2,isTextBox:true});
  txt(slide,sh(exp.title||'',40),3.1,0.82,3.0,0.36,{fontSize:16,bold:true,color:hexClean(t.text),isTextBox:true});
  // Side metrics
  kx.slice(1,3).forEach((ke,i)=>{
    const mx=SW-0.5-1.6*(2-i);
    roundRect(slide,mx,0.62,1.5,0.8,t.resBg||t.card,t.resBd||t.div,0.06);
    txt(slide,sh(ke.title||'',16),mx+0.12,0.68,1.26,0.16,{fontSize:6.5,bold:true,color:hexClean(t.sub),charSpacing:1.5,isTextBox:true,align:'center'});
    txt(slide,sh(String(ke.metric)||'-',10),mx+0.12,0.88,1.26,0.44,{fontSize:18,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center'});
  });
  // Detail 2-col
  const CY=1.66, CH=SH-CY-0.3;
  const LW=(SW-1.4)/2, RX=0.5+LW+0.4, RW=SW-RX-0.5;
  roundRect(slide,0.5,CY,LW,CH,t.card,t.div,0.1);
  sectionBold(slide,'Achieved Result',t,0.72,CY+0.16,LW-0.44);
  const outB=toBullets(f.output,3);
  let by=CY+0.46;
  outB.forEach(b=>{const ih=Math.max(0.24,Math.ceil(b.length/50)*0.2+0.04);txt(slide,'>',0.72,by,0.16,ih,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});txt(slide,b,0.88,by,LW-0.58,ih,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top'});by+=ih+0.1;});
  roundRect(slide,RX,CY,RW,CH,t.card,t.div,0.1);
  sectionBold(slide,'Key Takeaway',t,RX+0.22,CY+0.16,RW-0.44);
  const growB=toBullets(f.growth,3);
  let gy=CY+0.46;
  growB.forEach(b=>{const ih=Math.max(0.24,Math.ceil(b.length/44)*0.2+0.04);txt(slide,'>',RX+0.22,gy,0.16,ih,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});txt(slide,b,RX+0.38,gy,RW-0.58,ih,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top'});gy+=ih+0.1;});
  if(kx[0]?.beforeMetric&&kx[0]?.afterMetric&&gy<CY+CH-0.7){
    roundRect(slide,RX+0.18,gy+0.08,RW-0.36,0.68,t.resBg||t.card,t.resBd||t.div,0.06);
    barPair(slide,RX+0.34,gy+0.16,RW-0.68,kx[0].beforeMetric,kx[0].afterMetric,t);
  }
}

/* 6e. RESULT — T-Shape (metric strip + 3 horizontal cards) */
function buildResultTshape(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'MULTI-IMPACT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,7.8,0.46,{fontSize:21,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const kx=f.keyExperiences.slice(0,3);
  let bodyY=1.06;
  // Metric strip
  if(kx.length>0){
    const mW=(SW-1.0-(kx.length-1)*0.1)/Math.min(kx.length,3);
    kx.slice(0,3).forEach((ke,i)=>{
      const mx=0.5+i*(mW+0.1);
      roundRect(slide,mx,bodyY,mW-0.1,0.56,t.resBg||t.card,t.resBd||t.div,0.06);
      txt(slide,sh(String(ke.metric)||'-',10),mx+0.16,bodyY+0.06,mW*0.4,0.44,{fontSize:18,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
      txt(slide,sh(ke.title||'',22),mx+mW*0.45,bodyY+0.16,mW*0.5,0.28,{fontSize:8,color:hexClean(t.sub),isTextBox:true,valign:'middle'});
    });
    bodyY+=0.68;
  }
  // 3-column cards
  const CH=SH-bodyY-0.28;
  const colW=(SW-1.0-0.24)/3;
  const outB=toBullets(f.output,3), growB=toBullets(f.growth,3), compB=toBullets(f.competency,2);
  const cols=[
    {label:'OUTPUT',items:outB},
    {label:'GROWTH',items:growB},
    {label:'COMPETENCY',items:compB.length>0?compB:growB.slice(0,2)},
  ];
  cols.forEach((col,i)=>{
    const cx=0.5+i*(colW+0.12);
    roundRect(slide,cx,bodyY,colW,CH,t.card,t.div,0.08);
    rect(slide,cx,bodyY,colW,0.04,t.accent);
    txt(slide,col.label,cx+0.16,bodyY+0.16,colW-0.32,0.18,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
    hrLine(slide,cx+0.16,bodyY+0.38,colW-0.32,t.div);
    let iy=bodyY+0.48;
    col.items.forEach(b=>{const ih=Math.max(0.24,Math.ceil(b.length/38)*0.2+0.04);txt(slide,'>',cx+0.16,iy,0.16,ih,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});txt(slide,b,cx+0.32,iy,colW-0.48,ih,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});iy+=ih+0.08;});
  });
}

/* 6f. RESULT — Growth (progress indicators + Before/After + 2-col) */
function buildResultGrowth(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'GROWTH RESULT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,7.8,0.46,{fontSize:21,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const kx=f.keyExperiences.slice(0,3);
  let bodyY=1.06;
  // Growth progress indicators
  if(kx.length>0){
    const mW=(SW-1.0-(kx.length-1)*0.1)/Math.min(kx.length,3);
    kx.slice(0,3).forEach((ke,i)=>{
      const mx=0.5+i*(mW+0.1);
      roundRect(slide,mx,bodyY,mW-0.1,0.62,t.card,t.div,0.08);
      txt(slide,sh(ke.title||'성과',18),mx+0.14,bodyY+0.08,mW-0.38,0.16,{fontSize:6.5,bold:true,color:hexClean(t.sub),charSpacing:1.5,isTextBox:true});
      txt(slide,sh(String(ke.metric)||'-',12),mx+0.14,bodyY+0.26,mW-0.38,0.28,{fontSize:18,bold:true,color:hexClean(t.accent),isTextBox:true});
      // progress bar at bottom
      roundRect(slide,mx,bodyY+0.58,mW-0.1,0.04,t.div,null,0.02);
      const pw=Math.min(0.7+i*0.15,1)*(mW-0.1);
      roundRect(slide,mx,bodyY+0.58,pw,0.04,t.accent,null,0.02);
    });
    bodyY+=0.76;
  }
  // Before/After emphasis
  if(kx[0]?.beforeMetric&&kx[0]?.afterMetric){
    roundRect(slide,0.5,bodyY,SW-1.0,0.72,t.resBg||t.card,t.resBd||t.div,0.08);
    txt(slide,'BEFORE',0.72,bodyY+0.1,0.7,0.16,{fontSize:7,bold:true,color:hexClean(t.sub),charSpacing:2,isTextBox:true});
    txt(slide,sh(String(kx[0].beforeMetric),20),1.5,bodyY+0.06,1.4,0.3,{fontSize:18,bold:true,color:hexClean(t.sub),isTextBox:true});
    txt(slide,'→',3.1,bodyY+0.1,0.3,0.2,{fontSize:18,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center'});
    txt(slide,'AFTER',3.5,bodyY+0.1,0.7,0.16,{fontSize:7,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
    txt(slide,sh(String(kx[0].afterMetric),20),4.3,bodyY+0.06,1.4,0.3,{fontSize:18,bold:true,color:hexClean(t.accent),isTextBox:true});
    barPair(slide,0.72,bodyY+0.38,SW-1.44,kx[0].beforeMetric,kx[0].afterMetric,t);
    bodyY+=0.82;
  }
  // 2-col: What I Achieved / Learned
  const CH=SH-bodyY-0.26;
  const LW=(SW-1.4)/2, RX=0.5+LW+0.4, RW=SW-RX-0.5;
  roundRect(slide,0.5,bodyY,LW,CH,t.card,t.div,0.08);
  sectionBold(slide,'What I Achieved',t,0.72,bodyY+0.14,LW-0.44);
  const outB=toBullets(f.output,3);
  let by=bodyY+0.42;
  outB.forEach(b=>{const ih=Math.max(0.22,Math.ceil(b.length/48)*0.2+0.04);txt(slide,'>',0.72,by,0.16,ih,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});txt(slide,b,0.88,by,LW-0.58,ih,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top'});by+=ih+0.1;});
  roundRect(slide,RX,bodyY,RW,CH,t.card,t.div,0.08);
  sectionBold(slide,'What I Learned',t,RX+0.22,bodyY+0.14,RW-0.44);
  const growB=toBullets(f.growth,3);
  let gy=bodyY+0.42;
  growB.forEach(b=>{const ih=Math.max(0.22,Math.ceil(b.length/44)*0.2+0.04);txt(slide,'>',RX+0.22,gy,0.16,ih,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});txt(slide,b,RX+0.38,gy,RW-0.58,ih,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top'});gy+=ih+0.1;});
  if(f.competency&&gy<bodyY+CH-0.5){
    roundRect(slide,RX+0.18,gy+0.06,RW-0.36,Math.min(0.46,bodyY+CH-gy-0.12),t.step,t.div+'44',0.05);
    rect(slide,RX+0.18,gy+0.06,0.03,Math.min(0.46,bodyY+CH-gy-0.12),t.accent);
    txt(slide,'CORE COMPETENCY',RX+0.28,gy+0.1,1.4,0.14,{fontSize:6,bold:true,color:hexClean(t.accent),charSpacing:1.5,isTextBox:true});
    txt(slide,sh(f.competency,80),RX+0.28,gy+0.26,RW-0.48,0.22,{fontSize:9,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
}

/* 6g. RESULT — Framework (Big R focus + metrics + reflection) */
function buildResultFramework(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'RESULT FRAMEWORK',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,7.8,0.46,{fontSize:21,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const CY=1.06, CH=SH-CY-0.28;
  const kx=f.keyExperiences.slice(0,3);
  const LW=(SW-1.0)*0.56, RX=0.5+LW+0.22, RW=SW-RX-0.5;
  // Left: Big R card
  roundRect(slide,0.5,CY,LW,CH,t.card,t.div,0.1);
  txt(slide,'R',0.5+LW-0.7,CY+0.06,0.6,0.8,{fontSize:80,bold:true,color:hexClean(t.accent),isTextBox:true,transparency:92});
  roundRect(slide,0.72,CY+0.16,0.28,0.28,t.accent,null,0.06);
  txt(slide,'R',0.72,CY+0.16,0.28,0.28,{fontSize:12,bold:true,color:'ffffff',align:'center',valign:'middle',isTextBox:true});
  txt(slide,'RESULT',1.08,CY+0.2,1.2,0.2,{fontSize:9,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
  hrLine(slide,0.72,CY+0.52,LW-0.44,t.div);
  const outB=toBullets(f.output,4);
  let by=CY+0.64;
  outB.forEach(b=>{const ih=Math.max(0.24,Math.ceil(b.length/52)*0.2+0.04);txt(slide,'>',0.72,by,0.16,ih,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});txt(slide,b,0.88,by,LW-0.6,ih,{fontSize:10.5,color:hexClean(t.text),isTextBox:true,valign:'top'});by+=ih+0.1;});
  if(f.competency&&by<CY+CH-0.5){
    roundRect(slide,0.72,by+0.06,LW-0.44,Math.min(0.5,CY+CH-by-0.12),t.step,t.div+'44',0.06);
    rect(slide,0.72,by+0.06,0.03,Math.min(0.5,CY+CH-by-0.12),t.accent);
    txt(slide,'COMPETENCY',0.82,by+0.1,1.2,0.14,{fontSize:6,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
    txt(slide,sh(f.competency,90),0.82,by+0.26,LW-0.52,0.22,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
  // Right: Metrics + Reflection
  let ry=CY;
  if(kx.length>0){
    kx.slice(0,2).forEach((ke,i)=>{
      metricBox(slide,RX+i*(RW/2+0.06),ry,RW/2-0.06,0.78,sh(ke.title||('성과 '+(i+1)),20),sh(String(ke.metric)||'-',12),t);
    });
    ry+=0.88;
  }
  if(kx[0]?.beforeMetric&&kx[0]?.afterMetric){
    roundRect(slide,RX,ry,RW,0.78,t.card,t.div,0.08);
    barPair(slide,RX+0.16,ry+0.08,RW-0.32,kx[0].beforeMetric,kx[0].afterMetric,t);
    ry+=0.88;
  }
  // Reflection card
  const refH=CY+CH-ry;
  if(refH>0.3){
    roundRect(slide,RX,ry,RW,refH,t.card,t.div,0.08);
    txt(slide,'REFLECTION',RX+0.16,ry+0.12,RW-0.32,0.16,{fontSize:7.5,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
    const growB=toBullets(f.growth,3);
    let gy2=ry+0.34;
    growB.forEach(b=>{const ih=Math.max(0.22,Math.ceil(b.length/38)*0.2+0.04);txt(slide,'>',RX+0.16,gy2,0.16,ih,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true});txt(slide,b,RX+0.32,gy2,RW-0.48,ih,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});gy2+=ih+0.08;});
  }
}

/* ── 6k-t. New 10 Result builders ── */
function buildResultCyber(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'OUTPUT.LOG',t,0.5,0.28,SW-1.0);
  txt(slide,'$ cat results.txt | grep SUCCESS',0.5,0.52,SW-1.0,0.18,{fontSize:7.5,bold:true,color:hexClean(t.accent),isTextBox:true,fontFace:'Courier New',charSpacing:0.5});
  const CY=0.82; const CH=SH-CY-0.28;
  const kx=f.keyExperiences.slice(0,3);
  const LW=SW*0.56;
  if(kx.length>0){
    const mW=(LW-0.06)/Math.min(kx.length,3);
    kx.slice(0,3).forEach((ke,i)=>{
      const mx=0.5+i*mW;
      roundRect(slide,mx,CY,mW-0.06,0.56,t.card,t.accent,0.06);
      txt(slide,'[KEY]',mx+0.12,CY+0.06,mW-0.24,0.14,{fontSize:6.5,bold:true,color:hexClean(t.accent),isTextBox:true,fontFace:'Courier New',charSpacing:1});
      txt(slide,sh(ke.keyword||ke.title||ke,18),mx+0.12,CY+0.22,mW-0.24,0.28,{fontSize:10,bold:true,color:hexClean(t.text),isTextBox:true,valign:'top'});
    });
  }
  const bodyY=kx.length>0?CY+0.64:CY;
  const bodyH=SH-bodyY-0.28;
  rect(slide,0.5,bodyY,LW-0.06,bodyH,'#080808',t.accent,20);
  const outB=toBullets(f.output,3);
  outB.slice(0,3).forEach((b,i)=>{
    txt(slide,'>> OK'+(i+1),0.64,bodyY+0.14+i*0.42,0.62,0.22,{fontSize:8,bold:true,color:'#28c840',isTextBox:true,fontFace:'Courier New'});
    txt(slide,b,1.30,bodyY+0.14+i*0.42,LW-1.02,0.30,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
  // Right panel: growth
  const RX=LW+0.60;
  const RW=SW-RX-0.40;
  txt(slide,'$ growth_log --verbose',RX,CY,RW,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,fontFace:'Courier New',charSpacing:0.5});
  const growB=toBullets(f.growth,2);
  growB.slice(0,2).forEach((b,i)=>{
    roundRect(slide,RX,CY+0.26+i*0.72,RW,0.60,t.card,t.div,0.06);
    txt(slide,'+'+String(i+1),RX+0.12,CY+0.34+i*0.72,0.20,0.18,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,fontFace:'Courier New'});
    txt(slide,b,RX+0.36,CY+0.30+i*0.72,RW-0.44,0.48,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
  if(f.competency){
    roundRect(slide,RX,CY+1.60,RW,bodyH-(1.60-0.26+0.18),t.card,t.div,0.06);
    txt(slide,'// COMPETENCY',RX+0.12,CY+1.68,RW-0.20,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,fontFace:'Courier New'});
    txt(slide,sh(f.competency,80),RX+0.12,CY+1.90,RW-0.20,0.42,{fontSize:9,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
}

function buildResultForest(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'GROWTH REPORT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const kx=f.keyExperiences.slice(0,3);
  let headerY=1.02;
  if(kx.length>0){
    kx.slice(0,3).forEach((ke,i)=>{
      roundRect(slide,0.5+i*2.2,headerY,2.0,0.26,t.tag,t.accent,0.04);
      txt(slide,sh(ke.keyword||ke.title||ke,22),0.64+i*2.2,headerY,1.82,0.26,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
    });
    headerY+=0.36;
  }
  const CY=headerY; const CH=SH-CY-0.28; const LW=(SW-1.10)*0.55;
  sectionBold(slide,'🌲 성과',0.5,CY,LW,t);
  const outB=toBullets(f.output,3);
  const itemH=(CH-0.28)/Math.min(outB.length,3);
  outB.slice(0,3).forEach((b,i)=>{
    roundRect(slide,0.5,CY+0.24+i*(itemH+0.06),LW,itemH,t.card,i===0?t.accent:t.div,0.06);
    txt(slide,'🍀',0.60,CY+0.30+i*(itemH+0.06),0.28,0.26,{fontSize:12,isTextBox:true,align:'center'});
    txt(slide,b,0.96,CY+0.28+i*(itemH+0.06),LW-1.08,itemH-0.08,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  const RX=0.5+LW+0.14; const RW=SW-RX-0.40;
  sectionBold(slide,'🌱 성장',RX,CY,RW,t);
  const growB=toBullets(f.growth,2);
  growB.slice(0,2).forEach((b,i)=>{
    roundRect(slide,RX,CY+0.24+i*1.00,RW,0.86,t.card,t.div,0.06);
    txt(slide,b,RX+0.16,CY+0.32+i*1.00,RW-0.24,0.68,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  if(f.competency){
    roundRect(slide,RX,CY+0.24+2*1.00,RW,CH-2*1.00-0.28,t.accent+'15',t.accent,0.06);
    txt(slide,'역량',RX+0.16,CY+0.32+2*1.00,RW-0.24,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
    txt(slide,sh(f.competency,100),RX+0.16,CY+0.52+2*1.00,RW-0.24,CH-2*1.00-0.72,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
}

function buildResultAurora(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  rect(slide,0,SH-0.80,SW,0.80,t.accent,undefined,18);
  projectLabel(slide,num,'OUTCOME',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const kx=f.keyExperiences.slice(0,4);
  let bodyY=1.02;
  if(kx.length>0){
    kx.slice(0,Math.min(kx.length,4)).forEach((ke,i)=>{
      const mW=(SW-1.0-(kx.length-1)*0.08)/Math.min(kx.length,4);
      const mx=0.5+i*(mW+0.08);
      roundRect(slide,mx,bodyY,mW,0.26,t.tag,t.accent,0.04);
      txt(slide,sh(ke.keyword||ke.title||ke,20),mx+0.12,bodyY,mW-0.24,0.26,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
    });
    bodyY+=0.36;
  }
  const CY=bodyY; const CH=SH-CY-0.36; const LW=(SW-1.10)*0.56;
  const outB=toBullets(f.output,3);
  const itemH=(CH-0.06)/Math.min(outB.length,3);
  outB.slice(0,3).forEach((b,i)=>{
    roundRect(slide,0.5,CY+i*(itemH+0.06),LW,itemH,t.card,t.accent,0.06);
    txt(slide,b,0.66,CY+0.08+i*(itemH+0.06),LW-0.24,itemH-0.12,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  const RX=0.5+LW+0.14; const RW=SW-RX-0.40;
  const growB=toBullets(f.growth,2);
  growB.slice(0,2).forEach((b,i)=>{
    const gh=(CH-0.12)/2;
    roundRect(slide,RX,CY+i*(gh+0.08),RW,gh,t.card,t.div,0.06);
    txt(slide,'Growth '+(i+1),RX+0.16,CY+0.08+i*(gh+0.08),RW-0.24,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
    txt(slide,b,RX+0.16,CY+0.28+i*(gh+0.08),RW-0.24,gh-0.36,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  if(f.competency){
    const gy=CY+2*(CH/2+0.04);
    roundRect(slide,RX,gy,RW,CY+CH-gy-0.02,t.card,t.div,0.06);
    txt(slide,'Competency',RX+0.16,gy+0.08,RW-0.24,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
    txt(slide,sh(f.competency,90),RX+0.16,gy+0.28,RW-0.24,CY+CH-gy-0.34,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
}

function buildResultSunset(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  rect(slide,0,0,SW,0.05,t.accent,undefined);
  projectLabel(slide,num,'RESULTS',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const kx=f.keyExperiences.slice(0,3);
  let bodyY=1.02;
  if(kx.length>0){
    kx.slice(0,3).forEach((ke,i)=>{
      roundRect(slide,0.5+i*2.4,bodyY,2.22,0.26,t.tag,t.div,0.04);
      txt(slide,sh(ke.keyword||ke.title||ke,22),0.64+i*2.4,bodyY,2.0,0.26,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
    });
    bodyY+=0.36;
  }
  const quote=sh(f.aiSummary||f.output||'',80);
  if(quote){
    roundRect(slide,0.5,bodyY,SW-1.0,0.38,t.card,t.div,0.06);
    rect(slide,0.5,bodyY,0.04,0.38,t.accent,undefined);
    txt(slide,quote,0.64,bodyY+0.04,SW-1.20,0.30,{fontSize:10,italic:true,bold:true,color:hexClean(t.text),isTextBox:true,valign:'middle'});
    bodyY+=0.48;
  }
  const CY=bodyY; const CH=SH-CY-0.28; const LW=(SW-1.10)*0.55;
  const outB=toBullets(f.output,3);
  const itemH=(CH-0.06*2)/Math.min(outB.length,3);
  outB.slice(0,3).forEach((b,i)=>{
    roundRect(slide,0.5,CY+i*(itemH+0.06),LW,itemH,t.card,t.div,0.06);
    roundRect(slide,0.5,CY+i*(itemH+0.06),0.34,itemH,t.accent+'20',undefined,0.06);
    txt(slide,String(i+1),0.5,CY+i*(itemH+0.06),0.34,itemH,{fontSize:10,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center',valign:'middle'});
    txt(slide,b,0.90,CY+0.08+i*(itemH+0.06),LW-1.02,itemH-0.16,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  const RX=0.5+LW+0.14; const RW=SW-RX-0.40;
  const growB=toBullets(f.growth,2);
  growB.slice(0,2).forEach((b,i)=>{
    roundRect(slide,RX,CY+i*(CH/2+0.04),RW,CH/2,t.card,t.div,0.06);
    txt(slide,b,RX+0.16,CY+0.10+i*(CH/2+0.04),RW-0.24,CH/2-0.18,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
}

function buildResultNavyGold(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  hrLine(slide,0.5,0.38,SW-1.0,t.div);
  txt(slide,'PROJECT '+num+' · RESULTS',0.5,0.26,SW-1.0,0.18,{fontSize:8,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:3});
  txt(slide,sh(exp.title||'',42),0.5,0.46,SW-1.0,0.48,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const kx=f.keyExperiences.slice(0,3);
  let bodyY=1.04;
  if(kx.length>0){
    kx.slice(0,3).forEach((ke,i)=>{
      roundRect(slide,0.5+i*2.4,bodyY,2.22,0.28,t.tag,t.accent,0.04);
      txt(slide,sh(ke.keyword||ke.title||ke,22),0.64+i*2.4,bodyY,2.0,0.28,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
    });
    bodyY+=0.38;
  }
  const CY=bodyY; const CH=SH-CY-0.28; const LW=(SW-1.10)*0.55;
  sectionLabel(slide,'DELIVERABLES',0.5,CY,LW,t);
  const outB=toBullets(f.output,3);
  const itemH=(CH-0.28)/Math.min(outB.length,3);
  outB.slice(0,3).forEach((b,i)=>{
    roundRect(slide,0.5,CY+0.24+i*(itemH+0.06),LW,itemH,t.card,t.div,0.06);
    rect(slide,0.5,CY+0.24+i*(itemH+0.06),0.04,itemH,t.accent,undefined);
    txt(slide,b,0.64,CY+0.30+i*(itemH+0.06),LW-0.76,itemH-0.12,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  const RX=0.5+LW+0.14; const RW=SW-RX-0.40;
  sectionLabel(slide,'LEARNING',RX,CY,RW,t);
  const growB=toBullets(f.growth,2);
  growB.slice(0,2).forEach((b,i)=>{
    roundRect(slide,RX,CY+0.24+i*0.92,RW,0.80,t.card,t.div,0.06);
    txt(slide,b,RX+0.16,CY+0.32+i*0.92,RW-0.24,0.62,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  if(f.competency){
    const gy=CY+0.24+2*0.92;
    roundRect(slide,RX,gy,RW,CY+CH-gy,t.accent+'18',t.accent,0.06);
    txt(slide,'COMPETENCY',RX+0.16,gy+0.10,RW-0.24,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
    txt(slide,sh(f.competency,90),RX+0.16,gy+0.30,RW-0.24,CY+CH-gy-0.38,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
}

function buildResultCoral(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'RESULT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const kx=f.keyExperiences.slice(0,3);
  let bodyY=1.02;
  if(kx.length>0){
    kx.slice(0,3).forEach((ke,i)=>{
      roundRect(slide,0.5+i*2.4,bodyY,2.22,0.26,t.tag,t.div,0.04);
      txt(slide,sh(ke.keyword||ke.title||ke,22),0.64+i*2.4,bodyY,2.0,0.26,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
    });
    bodyY+=0.36;
  }
  const CY=bodyY; const CH=SH-CY-0.28; const LW=(SW-1.10)*0.60;
  // 성과 header
  txt(slide,'🎉 성과',0.5,CY,1.2,0.24,{fontSize:10,bold:true,color:hexClean(t.accent),isTextBox:true});
  const outB=toBullets(f.output,3);
  const itemH=(CH-0.32)/Math.min(outB.length,3);
  outB.slice(0,3).forEach((b,i)=>{
    roundRect(slide,0.5,CY+0.28+i*(itemH+0.06),LW,itemH,t.card,i===0?t.accent:t.div,0.06);
    txt(slide,b,0.66,CY+0.34+i*(itemH+0.06),LW-0.24,itemH-0.12,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  const RX=0.5+LW+0.14; const RW=SW-RX-0.40;
  txt(slide,'📈 성장',RX,CY,RW,0.24,{fontSize:10,bold:true,color:hexClean(t.accent),isTextBox:true});
  const growB=toBullets(f.growth,2);
  growB.slice(0,2).forEach((b,i)=>{
    roundRect(slide,RX,CY+0.28+i*0.88,RW,0.76,t.card,t.div,0.06);
    txt(slide,b,RX+0.16,CY+0.34+i*0.88,RW-0.24,0.60,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  if(f.competency){
    const gy=CY+0.28+2*0.88;
    roundRect(slide,RX,gy,RW,CY+CH-gy,t.accent+'15',t.accent,0.06);
    txt(slide,'역량',RX+0.16,gy+0.10,RW-0.24,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
    txt(slide,sh(f.competency,70),RX+0.16,gy+0.30,RW-0.24,CY+CH-gy-0.38,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
}

function buildResultSlate(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'RESULT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const kx=f.keyExperiences.slice(0,3);
  let bodyY=1.02;
  if(kx.length>0){
    kx.slice(0,3).forEach((ke,i)=>{
      roundRect(slide,0.5+i*2.4,bodyY,2.22,0.26,t.tag,t.div,0.04);
      txt(slide,sh(ke.keyword||ke.title||ke,22),0.64+i*2.4,bodyY,2.0,0.26,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
    });
    bodyY+=0.36;
  }
  const CY=bodyY; const CH=SH-CY-0.28;
  const outB=toBullets(f.output,4);
  const rows=outB.slice(0,4);
  const rowH=(CH-0.06*rows.length)/rows.length;
  rows.forEach((b,i)=>{
    roundRect(slide,0.5,CY+i*(rowH+0.06),SW-1.0,rowH,t.card,t.div,0.06);
    roundRect(slide,0.5,CY+i*(rowH+0.06),0.48,rowH,t.accent+'30',undefined,0.06);
    txt(slide,'R'+(i+1),0.5,CY+i*(rowH+0.06),0.48,rowH,{fontSize:10,bold:true,color:hexClean(t.accent),isTextBox:true,align:'center',valign:'middle',fontFace:'Courier New'});
    txt(slide,b,1.06,CY+0.08+i*(rowH+0.06),SW-2.10,rowH-0.16,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  if(f.growth||f.competency){
    const extraY=CY+rows.length*(rowH+0.06);
    if(extraY<SH-0.50){
      const growB=toBullets(f.growth,1);
      if(growB[0]){
        roundRect(slide,0.5,extraY,SW/2-0.70,SH-extraY-0.22,t.step,t.div,0.06);
        txt(slide,'Growth',0.66,extraY+0.08,(SW/2-0.70)-0.24,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
        txt(slide,growB[0],0.66,extraY+0.28,(SW/2-0.70)-0.24,SH-extraY-0.56,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
      }
      if(f.competency){
        roundRect(slide,SW/2-0.20,extraY,SW/2-0.32,SH-extraY-0.22,t.step,t.div,0.06);
        txt(slide,'Competency',SW/2-0.04,extraY+0.08,(SW/2-0.32)-0.24,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
        txt(slide,sh(f.competency,80),SW/2-0.04,extraY+0.28,(SW/2-0.32)-0.24,SH-extraY-0.56,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
      }
    }
  }
}

function buildResultCherry(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'RESULT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const kx=f.keyExperiences.slice(0,3);
  let bodyY=1.02;
  if(kx.length>0){
    kx.slice(0,3).forEach((ke,i)=>{
      roundRect(slide,0.5+i*2.4,bodyY,2.22,0.26,t.tag,t.div,0.04);
      txt(slide,sh(ke.keyword||ke.title||ke,22),0.64+i*2.4,bodyY,2.0,0.26,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
    });
    bodyY+=0.36;
  }
  const CY=bodyY; const CH=SH-CY-0.28; const LW=(SW-1.10)*0.60;
  sectionBold(slide,'🌸 성과',0.5,CY,LW,t);
  const outB=toBullets(f.output,3);
  const itemH=(CH-0.30)/Math.min(outB.length,3);
  outB.slice(0,3).forEach((b,i)=>{
    roundRect(slide,0.5,CY+0.26+i*(itemH+0.06),LW,itemH,t.card,t.div,0.06);
    rect(slide,0.5,CY+0.26+(i+1)*(itemH+0.06)-0.09,LW,0.03,t.accent+(i===0?'DD':'66'),undefined);
    txt(slide,b,0.66,CY+0.32+i*(itemH+0.06),LW-0.24,itemH-0.12,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  const RX=0.5+LW+0.14; const RW=SW-RX-0.40;
  sectionBold(slide,'🌸 배움',RX,CY,RW,t);
  const growB=toBullets(f.growth,2);
  growB.slice(0,2).forEach((b,i)=>{
    roundRect(slide,RX,CY+0.26+i*0.92,RW,0.80,t.card,t.div,0.06);
    txt(slide,b,RX+0.16,CY+0.32+i*0.92,RW-0.24,0.62,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  if(f.competency){
    const gy=CY+0.26+2*0.92;
    roundRect(slide,RX,gy,RW,CY+CH-gy,t.accent+'15',t.accent,0.06);
    txt(slide,'역량',RX+0.16,gy+0.10,RW-0.24,0.18,{fontSize:7,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
    txt(slide,sh(f.competency,70),RX+0.16,gy+0.30,RW-0.24,CY+CH-gy-0.38,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
}

function buildResultCharcoalMint(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  const PW=2.20;
  rect(slide,0,0,PW,SH,t.coverBg,undefined);
  txt(slide,'RESULT\n'+num,0.16,SH-1.20,PW-0.32,0.52,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:3,valign:'bottom'});
  txt(slide,sh(exp.title||'',20),0.16,SH-0.72,PW-0.32,0.58,{fontSize:17,bold:true,color:hexClean(t.text),isTextBox:true,valign:'bottom',charSpacing:-0.3});
  const kx=f.keyExperiences.slice(0,2);
  kx.forEach((ke,i)=>{
    roundRect(slide,0.16,0.48+i*0.38,PW-0.32,0.28,t.accent+'20',t.accent,0.04);
    txt(slide,sh(ke.keyword||ke.title||ke,22),0.26,0.50+i*0.38,PW-0.44,0.24,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
  });
  const RX=PW+0.32; const RW=SW-RX-0.40;
  const CY=0.46; const CH=(SH-CY-0.26)/2-0.08;
  // OUTPUT
  roundRect(slide,RX,CY,RW,CH,t.card,t.div,0.06);
  sectionLabel(slide,'OUTPUT',RX+0.16,CY+0.10,RW-0.24,t);
  addBulletRows(slide,toBullets(f.output,3),RX+0.16,CY+0.32,RW-0.24,CH-0.44,t,'disc');
  // GROWTH + COMPETENCY
  const SY=CY+CH+0.18;
  roundRect(slide,RX,SY,RW,CH,t.card,t.div,0.06);
  sectionLabel(slide,'GROWTH & COMPETENCY',RX+0.16,SY+0.10,RW-0.24,t);
  const growB=toBullets(f.growth,2);
  growB.slice(0,2).forEach((b,i)=>{
    txt(slide,b,RX+0.16,SY+0.32+i*0.42,RW-0.24,0.34,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:2});
  });
  if(f.competency){
    const cy2=SY+0.32+growB.length*0.42;
    txt(slide,sh(f.competency,80),RX+0.16,cy2,RW-0.24,CH-(cy2-SY)-0.14,{fontSize:9,color:hexClean(t.sub),isTextBox:true,valign:'top'});
  }
}

function buildResultPastel(prs,exp,idx,t,f){
  const slide=prs.addSlide(); addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'RESULT',t,0.5,0.28,SW-1.0);
  txt(slide,sh(exp.title||'',42),0.5,0.50,SW-1.0,0.42,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-0.5});
  const kx=f.keyExperiences.slice(0,4);
  let bodyY=1.02;
  if(kx.length>0){
    kx.slice(0,Math.min(kx.length,4)).forEach((ke,i)=>{
      const mW=(SW-1.0-(kx.length-1)*0.08)/Math.min(kx.length,4);
      roundRect(slide,0.5+i*(mW+0.08),bodyY,mW,0.26,t.tag,t.accent,0.04);
      txt(slide,sh(ke.keyword||ke.title||ke,20),0.64+i*(mW+0.08),bodyY,mW-0.24,0.26,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'middle'});
    });
    bodyY+=0.36;
  }
  const CY=bodyY; const CH=SH-CY-0.28; const LW=(SW-1.10)*0.56;
  txt(slide,'🌟 Results',0.5,CY,1.4,0.26,{fontSize:10,bold:true,color:hexClean(t.accent),isTextBox:true});
  const outB=toBullets(f.output,3);
  const colors=[t.accent+'25',t.accent+'18',t.accent+'30'];
  const itemH=(CH-0.32)/Math.min(outB.length,3);
  outB.slice(0,3).forEach((b,i)=>{
    roundRect(slide,0.5,CY+0.28+i*(itemH+0.06),LW,itemH,colors[i%3],t.accent,0.08);
    txt(slide,b,0.66,CY+0.34+i*(itemH+0.06),LW-0.24,itemH-0.12,{fontSize:11,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  const RX=0.5+LW+0.14; const RW=SW-RX-0.40;
  txt(slide,'🌱 Growth',RX,CY,RW,0.26,{fontSize:10,bold:true,color:hexClean(t.accent),isTextBox:true});
  const growB=toBullets(f.growth,2);
  growB.slice(0,2).forEach((b,i)=>{
    roundRect(slide,RX,CY+0.28+i*0.88,RW,0.76,colors[(i+1)%3],t.accent,0.08);
    txt(slide,b,RX+0.16,CY+0.34+i*0.88,RW-0.24,0.60,{fontSize:10,color:hexClean(t.text),isTextBox:true,valign:'top',paraSpaceAfter:3});
  });
  if(f.competency){
    const gy=CY+0.28+2*0.88;
    roundRect(slide,RX,gy,RW,CY+CH-gy,t.card,t.div,0.06);
    txt(slide,'Competency',RX+0.16,gy+0.08,RW-0.24,0.20,{fontSize:7.5,bold:true,color:hexClean(t.accent),isTextBox:true,charSpacing:2});
    txt(slide,sh(f.competency,90),RX+0.16,gy+0.30,RW-0.24,CY+CH-gy-0.38,{fontSize:9.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
}

/* 6. RESULT — dispatcher */
function buildResult(prs,exp,idx,t,f,theme){
  const layout=getLayout(theme);
  if(layout==='story') return buildResultStory(prs,exp,idx,t,f);
  if(layout==='dashboard') return buildResultDashboard(prs,exp,idx,t,f);
  if(layout==='funnel') return buildResultFunnel(prs,exp,idx,t,f);
  if(layout==='tshape') return buildResultTshape(prs,exp,idx,t,f);
  if(layout==='growth') return buildResultGrowth(prs,exp,idx,t,f);
  if(layout==='framework') return buildResultFramework(prs,exp,idx,t,f);
  if(layout==='cyber') return buildResultCyber(prs,exp,idx,t,f);
  if(layout==='forest') return buildResultForest(prs,exp,idx,t,f);
  if(layout==='aurora') return buildResultAurora(prs,exp,idx,t,f);
  if(layout==='sunset') return buildResultSunset(prs,exp,idx,t,f);
  if(layout==='navygold') return buildResultNavyGold(prs,exp,idx,t,f);
  if(layout==='coral') return buildResultCoral(prs,exp,idx,t,f);
  if(layout==='slate') return buildResultSlate(prs,exp,idx,t,f);
  if(layout==='cherry') return buildResultCherry(prs,exp,idx,t,f);
  if(layout==='charcoalmint') return buildResultCharcoalMint(prs,exp,idx,t,f);
  if(layout==='pastel') return buildResultPastel(prs,exp,idx,t,f);
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