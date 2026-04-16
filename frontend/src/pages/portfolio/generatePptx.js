/**
 * generatePptx.js
 * Wanted Portfolio Style PPTX Generator (pptxgenjs)
 * 구조: Cover → Profile → Skills → [SectionDivider + Situation + Result] × N → Outro
 */
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

/* 2. PROFILE */
function buildProfile(prs,p,t){
  const slide=prs.addSlide();
  addBg(slide,t.bg);
  const PX=0.5,PY=0.38;
  sectionLabel(slide,'PROFILE',t,PX,PY,SW-1.0);
  const y0=PY+0.32;
  // Left: Education
  const edu=(p.education||[]).slice(0,3);
  const sk=p.skills||{};
  const langs=[...(sk.languages||[]),...(sk.frameworks||[])].map(s=>typeof s==='string'?s:s?.name).filter(Boolean).slice(0,10);
  if(edu.length>0){
    sectionBold(slide,'Education',t,PX,y0,3.5);
    edu.forEach((e,i)=>{
      const ey=y0+0.32+i*0.72;
      roundRect(slide,PX,ey,3.5,0.62,t.card,t.div,0.06);
      txt(slide,sh(e.name,30),PX+0.16,ey+0.1,2.8,0.24,{fontSize:11,bold:true,color:hexClean(t.text),isTextBox:true});
      if(e.degree) txt(slide,e.degree,PX+0.16,ey+0.35,2.2,0.18,{fontSize:9,color:hexClean(t.sub),isTextBox:true});
      if(e.period) txt(slide,e.period,PX+0.16+2.2,ey+0.1,0.94,0.24,{fontSize:9,color:hexClean(t.sub),isTextBox:true,align:'right'});
    });
  }
  if(langs.length>0){
    const baseY=y0+0.32+edu.length*0.72+0.1;
    sectionBold(slide,'Tech Stack',t,PX,baseY,3.5);
    let px2=PX,py2=baseY+0.28;
    langs.forEach(s=>{
      const sw2=s.length*0.075+0.22;
      if(px2+sw2>PX+3.5){px2=PX;py2+=0.26;}
      roundRect(slide,px2,py2,sw2,0.21,t.badge,t.div,0.08);
      txt(slide,s,px2+0.08,py2+0.02,sw2-0.08,0.17,{fontSize:8.5,bold:true,color:hexClean(t.text),isTextBox:true,valign:'middle'});
      px2+=sw2+0.07;
    });
  }
  // Divider
  const midX=4.2;
  rect(slide,midX,y0,0.012,SH-y0-0.3,t.div);
  // Right: Work experience
  const exps=(p.experiences||[]).slice(0,4);
  const RX=midX+0.28;
  if(exps.length>0){
    sectionBold(slide,'Work Experience',t,RX,y0,SW-RX-0.4);
    let ey=y0+0.32;
    exps.forEach((e,i)=>{
      const iconS=0.32;
      roundRect(slide,RX,ey+0.02,iconS,iconS,t.accent+'28',null,0.05);
      txt(slide,(e.organization||e.title||'?').trim()[0],RX,ey+0.02,iconS,iconS,{fontSize:13,bold:true,color:hexClean(t.accent),align:'center',valign:'middle',isTextBox:true});
      txt(slide,sh(e.organization||e.title,30),RX+0.4,ey,SW-RX-1.2,0.22,{fontSize:11,bold:true,color:hexClean(t.text),isTextBox:true});
      if(e.role) txt(slide,e.role,RX+0.4,ey+0.23,2.5,0.18,{fontSize:9,bold:true,color:hexClean(t.accent),isTextBox:true});
      if(e.date) txt(slide,e.date,RX+2.95,ey,SW-RX-3.2,0.2,{fontSize:8,color:hexClean(t.sub),isTextBox:true,align:'right'});
      if(e.description){
        const desc=sh(strip(e.description),80);
        txt(slide,desc,RX+0.4,ey+0.42,SW-RX-0.9,0.22,{fontSize:8.5,color:hexClean(t.sub),isTextBox:true});
      }
      hrLine(slide,RX,ey+0.64,(SW-RX-0.5),t.div+'44');
      ey+=0.74;
    });
  }else{
    // fallback: awards
    const awards=(p.awards||[]).slice(0,5);
    sectionBold(slide,'Awards',t,RX,y0,SW-RX-0.4);
    awards.forEach((a,i)=>{
      txt(slide,sh(a.title,50),RX,y0+0.32+i*0.34,SW-RX-1.5,0.24,{fontSize:10.5,bold:true,color:hexClean(t.text),isTextBox:true});
      if(a.date) txt(slide,a.date,SW-1.5,y0+0.32+i*0.34,1.2,0.24,{fontSize:9,color:hexClean(t.sub),isTextBox:true,align:'right'});
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

/* 5. SITUATION */
function buildSituation(prs,exp,idx,t,f){
  const slide=prs.addSlide();
  addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'CAREER',t,0.5,0.30,SW-1.0);
  txt(slide,sh(exp.title||'프로젝트',40),0.5,0.52,7.5,0.52,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const CY=1.14;
  const CH=SH-CY-0.36;
  roundRect(slide,0.5,CY,SW-1.0,CH,t.card,t.div,0.1);
  // 스마트 분리: 긴 텍스트를 논리적 단락으로 나눔
  const spRaw=f.task||f.overview||f.description||'';
  const solRaw=f.process||f.intro||'';
  const spItems=smartBullets(spRaw,4,78);
  const solItems=smartBullets(solRaw,4,78);
  const midX=0.5+(SW-1.0)*0.5;
  // S&P section
  if(spItems.length>0){
    sectionBold(slide,'Situation & Problem',t,0.76,CY+0.18,midX-0.76-0.1);
    const spFS=spItems.length<=2?11:9.5;
    const spW=midX-0.85-0.1;
    let spY=CY+0.5;
    spItems.forEach((item,i)=>{
      const cpl=Math.max(15,Math.floor((spW-0.17)*13));
      const lines=Math.max(1,Math.ceil(item.length/cpl));
      const ih=Math.max(0.24,lines*(spFS*0.016)+0.06);
      roundRect(slide,0.76,spY+0.06,0.11,0.11,t.card,t.div,0.02);
      txt(slide,item,0.76+0.17,spY,spW-0.17,ih,{fontSize:spFS,color:hexClean(t.text),isTextBox:true,valign:'top'});
      spY+=ih+0.12;
    });
    // 남은 공간이 충분하면 역할/맥락 카드 삽입
    const spEnd=spY;
    const spRem=(CY+CH-0.18)-spEnd;
    if(spRem>0.6&&(exp.role||exp.date||f.aiSummary)){
      const ctxY=spEnd+0.08;
      const ctxH=Math.min(spRem-0.1,0.88);
      roundRect(slide,0.76,ctxY,spW,ctxH,t.step||t.badge||t.card,t.div+'66',0.06);
      rect(slide,0.76,ctxY,0.035,ctxH,t.accent);
      const ctxTxt=exp.role?(exp.role+(exp.date?' · '+exp.date:'')):(sh(f.aiSummary,140)||'');
      txt(slide,ctxTxt,0.82,ctxY+0.1,spW-0.14,ctxH-0.2,{fontSize:9.5,color:hexClean(t.sub),isTextBox:true,valign:'middle'});
    }
  }
  // vertical divider in card
  rect(slide,midX,CY+0.18,0.012,CH-0.36,t.div);
  // Solution section
  if(solItems.length>0){
    const RX=midX+0.26;
    const solW=SW-RX-0.76;
    sectionBold(slide,'Solution',t,RX,CY+0.18,solW);
    const solFS=solItems.length<=2?11:9.5;
    let solY=CY+0.5;
    solItems.forEach((item,i)=>{
      const cpl=Math.max(15,Math.floor((solW-0.52)*13));
      const lines=Math.max(1,Math.ceil(item.length/cpl));
      const ih=Math.max(0.24,lines*(solFS*0.016)+0.06);
      txt(slide,'Step'+(i+1)+'.',RX,solY,0.54,0.2,{fontSize:8.5,bold:true,color:hexClean(t.accent),isTextBox:true,valign:'top',fontFace:'Courier New'});
      txt(slide,item,RX+0.54,solY,solW-0.54,ih,{fontSize:solFS-0.5,color:hexClean(t.text),isTextBox:true,valign:'top'});
      solY+=ih+0.12;
    });
    // 남은 공간에 AI 요약 삽입
    const solEnd=solY;
    const solRem=(CY+CH-0.18)-solEnd;
    if(solRem>0.6&&f.aiSummary){
      const ctxY=solEnd+0.08;
      const ctxH=Math.min(solRem-0.1,0.88);
      const RX2=midX+0.26;
      roundRect(slide,RX2,ctxY,SW-RX2-0.76,ctxH,t.step||t.badge||t.card,t.div+'66',0.06);
      rect(slide,RX2,ctxY,0.035,ctxH,t.accent);
      txt(slide,sh(f.aiSummary,140),RX2+0.1,ctxY+0.1,SW-RX2-1.0,ctxH-0.2,{fontSize:9.5,color:hexClean(t.sub),isTextBox:true,valign:'middle'});
    }
  }
}

/* 6. RESULT */
function buildResult(prs,exp,idx,t,f){
  const slide=prs.addSlide();
  addBg(slide,t.bg);
  const num=String(idx+1).padStart(2,'0');
  projectLabel(slide,num,'RESULT',t,0.5,0.30,SW-1.0);
  txt(slide,sh(exp.title||'프로젝트',40),0.5,0.52,7.5,0.52,{fontSize:22,bold:true,color:hexClean(t.text),isTextBox:true,charSpacing:-1});
  const CY=1.14;
  const CH=SH-CY-0.36;
  const kx=f.keyExperiences.slice(0,3);
  const showRight=kx.length>0;
  const LW=showRight?(SW-1.0)*0.58:(SW-1.0);
  const cardX=0.5;
  // Left card
  roundRect(slide,cardX,CY,LW,CH,t.card,t.div,0.1);
  sectionBold(slide,'결과 Key Result',t,cardX+0.24,CY+0.18,LW-0.48);
  const outB=toBullets(f.output,4);
  const growB=toBullets(f.growth,3);
  let bulletY=CY+0.5;
  if(outB.length>0){
    bulletY=addBulletRows(slide,outB,cardX+0.24,bulletY,LW-0.48,t,65,'arrow');
    bulletY+=0.08;
  }
  if(growB.length>0){
    hrLine(slide,cardX+0.24,bulletY,LW-0.48,t.div+'55');
    bulletY+=0.14;
    txt(slide,'GROWTH',cardX+0.24,bulletY,1.5,0.16,{fontSize:6.5,bold:true,color:hexClean(t.sub),charSpacing:2,isTextBox:true});
    bulletY+=0.2;
    bulletY=addBulletRows(slide,growB,cardX+0.24,bulletY,LW-0.48,t,65,'arrow');
    bulletY+=0.08;
  }
  if(f.competency){
    roundRect(slide,cardX+0.24,bulletY,LW-0.48,0.56,t.step,t.div+'44',0.06);
    rect(slide,cardX+0.24,bulletY,0.04,0.56,t.accent);
    txt(slide,'COMPETENCY',cardX+0.28,bulletY+0.06,1.5,0.14,{fontSize:6.5,bold:true,color:hexClean(t.accent),charSpacing:2,isTextBox:true});
    txt(slide,sh(f.competency,90),cardX+0.28,bulletY+0.22,LW-0.56,0.28,{fontSize:9,color:hexClean(t.text),isTextBox:true,valign:'top'});
  }
  // Right: metrics
  if(showRight){
    const RX=cardX+LW+0.22;
    const RW=SW-RX-0.5;
    kx.slice(0,2).forEach((ke,i)=>{
      metricBox(slide,RX+i*(RW/2+0.06)/2*2,CY,RW/2-0.06,0.8,sh(ke.title||('성과 '+(i+1)),20),sh(String(ke.metric)||'-',12),t);
    });
    if(kx[0]?.beforeMetric&&kx[0]?.afterMetric){
      roundRect(slide,RX,CY+0.88,RW,0.85,t.card,t.div,0.08);
      barPair(slide,RX+0.16,CY+0.98,RW-0.32,kx[0].beforeMetric,kx[0].afterMetric,t);
    }
    if(kx[2]){
      const y3=CY+(kx[0]?.beforeMetric?1.82:0.88);
      roundRect(slide,RX,y3,RW,CH-(y3-CY),t.resBg||t.card,t.resBd||t.div,0.08);
      txt(slide,sh(kx[2].title||'추가 성과',25),RX+0.16,y3+0.12,RW-0.32,0.16,{fontSize:6.5,bold:true,color:hexClean(t.sub),charSpacing:2,isTextBox:true});
      txt(slide,sh(String(kx[2].metric)||'-',15),RX+0.16,y3+0.3,RW-0.32,0.4,{fontSize:20,bold:true,color:hexClean(t.accent),isTextBox:true});
    }
  }
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
  const { default: PptxGenJS } = await import('pptxgenjs');
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
    if(hasSit) buildSituation(prs,exp,idx,t,f);
    if(hasRes) buildResult(prs,exp,idx,t,f);
  });

  buildOutro(prs,p,t);

  const name=(p.userName||'portfolio').replace(/\s+/g,'_')+'_portfolio.pptx';
  await prs.writeFile({fileName:name});
}