import { Client } from '@notionhq/client';

// ── Rich Text Helpers ──

function rt(content, opts = {}) {
  if (!content) return [];
  return [{
    type: 'text',
    text: { content, link: opts.link ? { url: opts.link } : null },
    annotations: {
      bold: opts.bold || false,
      italic: opts.italic || false,
      underline: opts.underline || false,
      strikethrough: false,
      code: opts.code || false,
      color: opts.color || 'default',
    }
  }];
}

function multiRt(segments) {
  return segments.map(seg => ({
    type: 'text',
    text: { content: seg.text, link: seg.link ? { url: seg.link } : null },
    annotations: {
      bold: seg.bold || false,
      italic: seg.italic || false,
      underline: seg.underline || false,
      strikethrough: false,
      code: seg.code || false,
      color: seg.color || 'default',
    }
  }));
}

// ── Block Helpers ──

const heading2 = (text, opts = {}) => ({
  object: 'block', type: 'heading_2',
  heading_2: { rich_text: rt(text, opts) }
});

const heading3 = (text, opts = {}) => ({
  object: 'block', type: 'heading_3',
  heading_3: { rich_text: rt(text, opts) }
});

const paragraph = (text, opts = {}) => ({
  object: 'block', type: 'paragraph',
  paragraph: { rich_text: text ? rt(text, opts) : [] }
});

const paragraphMulti = (segments) => ({
  object: 'block', type: 'paragraph',
  paragraph: { rich_text: multiRt(segments) }
});

const bullet = (text, opts = {}) => ({
  object: 'block', type: 'bulleted_list_item',
  bulleted_list_item: { rich_text: rt(text, opts) }
});

const bulletMulti = (segments) => ({
  object: 'block', type: 'bulleted_list_item',
  bulleted_list_item: { rich_text: multiRt(segments) }
});

const divider = () => ({
  object: 'block', type: 'divider', divider: {}
});

const callout = (text, emoji = '💡', opts = {}) => ({
  object: 'block', type: 'callout',
  callout: {
    rich_text: rt(text, opts),
    icon: { type: 'emoji', emoji },
    color: opts.bgColor || 'gray_background',
  }
});

const calloutMulti = (segments, emoji = '💡', bgColor = 'gray_background') => ({
  object: 'block', type: 'callout',
  callout: {
    rich_text: multiRt(segments),
    icon: { type: 'emoji', emoji },
    color: bgColor,
  }
});

const image = (url) => ({
  object: 'block', type: 'image',
  image: { type: 'external', external: { url } }
});

const table = (width, hasHeader, rows) => ({
  object: 'block', type: 'table',
  table: {
    table_width: width,
    has_column_header: hasHeader,
    has_row_header: false,
    children: rows.map(cells => ({
      object: 'block',
      type: 'table_row',
      table_row: {
        cells: cells.map(c => typeof c === 'string' ? rt(c) : c)
      }
    }))
  }
});

const toggle = (title, children = []) => ({
  object: 'block', type: 'toggle',
  toggle: {
    rich_text: rt(title, { bold: true }),
    children,
  }
});

// ── Main Export Function ──

export async function createNotionPortfolioPage(notionToken, parentPageId, portfolioData) {
  const notion = new Client({ auth: notionToken });
  const p = portfolioData;
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || {};
  const extra = p.extracurricular || {};

  // ── Build Profile Column (Left) ──
  const profileBlocks = [];
  profileBlocks.push(paragraph('PROFILE', { bold: true, color: 'gray' }));
  if (p.profileImageUrl) {
    profileBlocks.push(image(p.profileImageUrl));
  }
  // 이름/영문이름 분리 (빈 paragraph 제거 → Notion 컬럼 안에서 bullet "•" 방지)
  profileBlocks.push(heading3(p.userName || '이름'));
  if (p.nameEn) profileBlocks.push(paragraph(`(${p.nameEn})`, { color: 'gray' }));
  if (p.location) profileBlocks.push(paragraphMulti([{ text: '📍 ' }, { text: p.location }]));
  if (p.birthDate) profileBlocks.push(paragraphMulti([{ text: '📅 ' }, { text: p.birthDate }]));

  // My Own Values
  if ((p.values || []).length > 0) {
    profileBlocks.push(paragraph('My Own Values', { bold: true, italic: true }));
    const emojis = ['➕', '➖', '✖️', '➗', '🎓'];
    p.values.forEach((v, i) => {
      profileBlocks.push(callout(v.keyword || '', emojis[i % emojis.length], { bgColor: 'gray_background' }));
    });
  }

  // ── Build Education/Contact Column (Center) ──
  const centerBlocks = [];

  // Education
  if ((p.education || []).length > 0) {
    centerBlocks.push(heading2('🎓 Education'));
    p.education.forEach(edu => {
      centerBlocks.push(paragraph(edu.name || '', { bold: true }));
      if (edu.period) centerBlocks.push(paragraph(edu.period, { italic: true, color: 'gray' }));
      if (edu.degree) centerBlocks.push(paragraph(edu.degree));
      if (edu.detail) centerBlocks.push(paragraph(edu.detail));
    });
  }

  // Interests
  if ((p.interests || []).length > 0) {
    centerBlocks.push(heading3('💡 Interest'));
    p.interests.forEach(interest => {
      centerBlocks.push(bullet(interest));
    });
  }

  // Contact
  if (contact.phone || contact.email || contact.linkedin || contact.github) {
    centerBlocks.push(heading3('📞 Contact Information'));
    if (contact.phone) centerBlocks.push(paragraphMulti([{ text: '📱 ', color: 'gray' }, { text: contact.phone }]));
    if (contact.email) centerBlocks.push(paragraphMulti([{ text: '📧 ', color: 'gray' }, { text: contact.email }]));
    if (contact.linkedin) centerBlocks.push(paragraphMulti([{ text: '🔗 ', color: 'gray' }, { text: contact.linkedin }]));
    if (contact.instagram) centerBlocks.push(paragraphMulti([{ text: '📸 ', color: 'gray' }, { text: contact.instagram }]));
    if (contact.github) centerBlocks.push(paragraphMulti([{ text: '💻 ', color: 'gray' }, { text: contact.github }]));
    if (contact.website) centerBlocks.push(paragraphMulti([{ text: '🌐 ', color: 'gray' }, { text: contact.website }]));
  }

  // ── Build Awards/Experience Column (Right) ──
  const rightBlocks = [];

  // Awards
  if ((p.awards || []).length > 0) {
    rightBlocks.push(heading3('🏆 Scholarship and Awards'));
    p.awards.forEach(a => {
      rightBlocks.push(paragraphMulti([
        { text: a.date || '', bold: true, underline: true },
        { text: ' ' + (a.title || '') }
      ]));
    });
  }

  // Experience
  if ((p.experiences || []).length > 0) {
    rightBlocks.push(heading3('🔥 Experience'));
    p.experiences.forEach(e => {
      rightBlocks.push(paragraphMulti([
        { text: e.date || '', bold: true, underline: true },
        { text: ' ' + (e.title || '') }
      ]));
    });
  }

  // ── Quick Menu as Table ──
  // cells[i] must be Array<RichTextItemRequest> — rt() already returns that array, so no extra []
  const quickMenuRow = [
    rt('📝 교과 활동', { bold: true }),
    rt('💡 비교과 활동', { bold: true }),
    rt('🛠 기술', { bold: true }),
    rt('✨ 목표와 계획', { bold: true }),
    rt('💬 가치관', { bold: true }),
  ];
  const quickMenuTable = {
    object: 'block', type: 'table',
    table: {
      table_width: 5,
      has_column_header: false,
      has_row_header: false,
      children: [{
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: quickMenuRow
        }
      }]
    }
  };

  // ── 3-Column Layout ──
  const columnList = {
    object: 'block',
    type: 'column_list',
    column_list: {
      children: [
        {
          object: 'block',
          type: 'column',
          column: { children: profileBlocks.length > 0 ? profileBlocks : [paragraph('')] }
        },
        {
          object: 'block',
          type: 'column',
          column: { children: centerBlocks.length > 0 ? centerBlocks : [paragraph('')] }
        },
        {
          object: 'block',
          type: 'column',
          column: { children: rightBlocks.length > 0 ? rightBlocks : [paragraph('')] }
        },
      ]
    }
  };

  // ── Page children (Phase 1: title area + columns) ──
  const pageChildren = [
    callout('본 포트폴리오는 PC 환경에 최적화되어 있습니다.', '💡', { bgColor: 'gray_background' }),
    paragraph(''),
    heading3('⚡ Quick Menu'),
    quickMenuTable,
    divider(),
    columnList,
    divider(),
  ];

  // ── Create Page ──
  const page = await notion.pages.create({
    parent: { page_id: parentPageId },
    icon: { type: 'emoji', emoji: '💡' },
    cover: null,
    properties: {
      title: {
        title: [{ text: { content: p.headline || p.title || '포트폴리오' } }]
      }
    },
    children: pageChildren,
  });

  // ── Phase 2: Append full-width sections below columns ──
  const appendBlocks = [];

  // 교과 활동
  appendBlocks.push(heading2('📝 교과 활동 | Curricular Activities'));
  if (curr.summary?.credits || curr.summary?.gpa) {
    appendBlocks.push(calloutMulti([
      { text: '요약 | Summary', bold: true },
    ], '📊', 'gray_background'));
    if (curr.summary?.credits) appendBlocks.push(paragraph(`📚 이수 학점: ${curr.summary.credits}`));
    if (curr.summary?.gpa) appendBlocks.push(paragraph(`📊 평점 평균: ${curr.summary.gpa}`));
  }
  if ((curr.courses || []).length > 0) {
    appendBlocks.push(heading3('교과목 수강 내역 | Course History'));
    const courseRows = [['학기', '과목명', '성적']];
    curr.courses.forEach(c => courseRows.push([c.semester || '', c.name || '', c.grade || '']));
    appendBlocks.push(table(3, true, courseRows));
  }
  appendBlocks.push(divider());

  // 비교과 활동
  appendBlocks.push(heading2('💡 비교과 활동 | Extracurricular Activities'));
  if (extra.summary) {
    appendBlocks.push(callout(extra.summary, '📋', { bgColor: 'gray_background' }));
  }
  if ((extra.badges || []).length > 0) {
    appendBlocks.push(heading3('🏅 디지털 배지 | Digital Badge'));
    extra.badges.forEach(b => {
      appendBlocks.push(bullet(`${b.name}${b.issuer ? ` (${b.issuer})` : ''}`));
    });
  }
  if ((extra.languages || []).length > 0) {
    appendBlocks.push(heading3('🌍 어학 성적 | Language Certification'));
    const langRows = [['시험명', '점수/등급', '취득일']];
    extra.languages.forEach(l => langRows.push([l.name || '', l.score || '', l.date || '']));
    appendBlocks.push(table(3, true, langRows));
  }
  if ((extra.details || []).length > 0) {
    appendBlocks.push(heading3('📋 세부 사항 | Details'));
    extra.details.forEach(d => {
      const children = [];
      if (d.period) children.push(paragraph(d.period, { italic: true, color: 'gray' }));
      if (d.description) children.push(paragraph(d.description));
      appendBlocks.push(toggle(`${d.title || '활동'}`, children.length > 0 ? children : [paragraph('')]));
    });
  }
  appendBlocks.push(divider());

  // 기술
  appendBlocks.push(heading2('🛠 기술 | Skills'));
  const categoryNames = { tools: '도구', languages: '프로그래밍 언어', frameworks: '프레임워크', others: '기타' };
  for (const [cat, items] of Object.entries(skills)) {
    if (items && items.length > 0) {
      const segments = [{ text: `${categoryNames[cat] || cat}: `, bold: true }];
      items.forEach((s, i) => {
        if (i > 0) segments.push({ text: ', ' });
        segments.push({ text: s, code: true });
      });
      appendBlocks.push(paragraphMulti(segments));
    }
  }
  appendBlocks.push(divider());

  // 목표와 계획
  appendBlocks.push(heading2('✨ 목표와 계획 | Future Plans'));
  const typeLabel = { short: '단기', mid: '중기', long: '장기' };
  const statusEmoji = { done: '✅', ing: '🔄', planned: '📋' };
  if ((p.goals || []).length > 0) {
    p.goals.forEach(g => {
      const children = [];
      if (g.description) children.push(paragraph(g.description));
      children.push(paragraphMulti([
        { text: `상태: ${statusEmoji[g.status] || '📋'} ` },
        { text: g.status === 'done' ? '완료' : g.status === 'ing' ? '진행 중' : '예정', color: g.status === 'done' ? 'green' : g.status === 'ing' ? 'blue' : 'gray' }
      ]));
      appendBlocks.push(toggle(`[${typeLabel[g.type] || ''}] ${g.title || ''}`, children));
    });
  }
  appendBlocks.push(divider());

  // 가치관
  appendBlocks.push(heading2('💬 가치관 | Values'));
  if (p.valuesEssay) {
    // Split long essay into paragraphs
    const paras = p.valuesEssay.split('\n').filter(s => s.trim());
    paras.forEach(para => appendBlocks.push(paragraph(para)));
  } else if ((p.values || []).length > 0) {
    const emojis = ['➕', '➖', '✖️', '➗', '🎓'];
    p.values.forEach((v, i) => {
      appendBlocks.push(heading3(`${emojis[i % emojis.length]} ${v.keyword}`));
      if (v.description) appendBlocks.push(paragraph(v.description));
    });
  }

  // Footer
  appendBlocks.push(divider());
  appendBlocks.push(paragraph(`POPOL Portfolio · ${p.userName || ''}`, { italic: true, color: 'gray' }));

  // Notion API limits: 100 blocks per append call
  const BATCH_SIZE = 100;
  for (let i = 0; i < appendBlocks.length; i += BATCH_SIZE) {
    const batch = appendBlocks.slice(i, i + BATCH_SIZE);
    await notion.blocks.children.append({
      block_id: page.id,
      children: batch,
    });
  }

  return {
    pageId: page.id,
    url: page.url,
  };
}

// ── Parse Notion Page ID from URL ──
export function parseNotionPageId(input) {
  if (!input) return null;
  const trimmed = input.trim();

  // UUID format
  const uuidMatch = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (uuidMatch) return uuidMatch[1];

  // 32-char hex from URL
  const hexMatch = trimmed.match(/([a-f0-9]{32})/i);
  if (hexMatch) {
    const h = hexMatch[1];
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }

  return trimmed;
}
