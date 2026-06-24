// 스킬(소프트웨어) 아이콘 카탈로그 — public/brand-icons/*.svg (컬러)
export const SKILL_ICONS = [
  { id: 'figma', label: 'Figma', src: '/brand-icons/figma.svg' },
  { id: 'photoshop', label: 'Photoshop', src: '/brand-icons/photoshop.svg' },
  { id: 'illustrator', label: 'Illustrator', src: '/brand-icons/illustrator.svg' },
  { id: 'xd', label: 'Adobe XD', src: '/brand-icons/xd.svg' },
  { id: 'aftereffects', label: 'After Effects', src: '/brand-icons/aftereffects.svg' },
  { id: 'premiere', label: 'Premiere Pro', src: '/brand-icons/premiere.svg' },
  { id: 'indesign', label: 'InDesign', src: '/brand-icons/indesign.svg' },
  { id: 'lightroom', label: 'Lightroom', src: '/brand-icons/lightroom.svg' },
  { id: 'excel', label: 'Excel', src: '/brand-icons/excel.svg' },
  { id: 'powerpoint', label: 'PowerPoint', src: '/brand-icons/powerpoint.svg' },
  { id: 'word', label: 'Word', src: '/brand-icons/word.svg' },
  { id: 'notion', label: 'Notion', src: '/brand-icons/notion.svg' },
  { id: 'javascript', label: 'JavaScript', src: '/brand-icons/javascript.svg' },
  { id: 'typescript', label: 'TypeScript', src: '/brand-icons/typescript.svg' },
  { id: 'react', label: 'React', src: '/brand-icons/react.svg' },
  { id: 'html5', label: 'HTML', src: '/brand-icons/html5.svg' },
  { id: 'css3', label: 'CSS', src: '/brand-icons/css3.svg' },
  { id: 'python', label: 'Python', src: '/brand-icons/python.svg' },
  { id: 'java', label: 'Java', src: '/brand-icons/java.svg' },
  { id: 'firebase', label: 'Firebase', src: '/brand-icons/firebase.svg' },
  { id: 'github', label: 'GitHub', src: '/brand-icons/github.svg' },
  { id: 'slack', label: 'Slack', src: '/brand-icons/slack.svg' },
];

const BY_ID = Object.fromEntries(SKILL_ICONS.map(i => [i.id, i]));

const ALIASES = {
  figma: 'figma', 피그마: 'figma',
  photoshop: 'photoshop', ps: 'photoshop', 포토샵: 'photoshop',
  illustrator: 'illustrator', ai: 'illustrator', 일러스트: 'illustrator', 일러스트레이터: 'illustrator',
  adobexd: 'xd', xd: 'xd',
  aftereffects: 'aftereffects', ae: 'aftereffects', 애프터이펙트: 'aftereffects', 애프터이펙츠: 'aftereffects',
  premiere: 'premiere', premierepro: 'premiere', pr: 'premiere', 프리미어: 'premiere',
  indesign: 'indesign', id: 'indesign', 인디자인: 'indesign',
  lightroom: 'lightroom', lr: 'lightroom', 라이트룸: 'lightroom',
  excel: 'excel', 엑셀: 'excel',
  powerpoint: 'powerpoint', ppt: 'powerpoint', 파워포인트: 'powerpoint',
  word: 'word', 워드: 'word',
  notion: 'notion', 노션: 'notion',
  javascript: 'javascript', js: 'javascript',
  typescript: 'typescript', ts: 'typescript',
  react: 'react', reactjs: 'react', 리액트: 'react',
  html: 'html5', html5: 'html5',
  css: 'css3', css3: 'css3',
  python: 'python', py: 'python', 파이썬: 'python',
  java: 'java', 자바: 'java',
  firebase: 'firebase', 파이어베이스: 'firebase',
  github: 'github', git: 'github', 깃허브: 'github',
  slack: 'slack', 슬랙: 'slack',
};

// 스킬명 → 아이콘 src (자동 매칭). 없으면 null.
export function matchSkillIcon(name = '') {
  const n = String(name).toLowerCase().replace(/[\s._/-]/g, '');
  if (!n) return null;
  if (ALIASES[n]) return BY_ID[ALIASES[n]].src;
  for (const [k, id] of Object.entries(ALIASES)) {
    if (k.length >= 3 && n.includes(k)) return BY_ID[id].src;
  }
  return null;
}
