// Run against Vite: node scripts/check-document-cabinet.mjs [http://127.0.0.1:3100]
// All account data and API writes are mocked inside an isolated browser.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boardDocumentId, createDocumentBoardService } from '../src/services/documentBoardService.js';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:3100').origin;
const out = join(tmpdir(), 'fitpoly-cabinet-review');
await mkdir(out, { recursive: true });
const folders = [
  { id: 'naver', company: '네이버', files: [
    { id: 'r', category: 'resume', name: '서비스 기획자 이력서.pdf', url: '#resume', size: 52000 },
    { id: 'e', category: 'etc', name: '경력증명서.pdf', url: '#etc', size: 18000 },
  ], essays: [{ id: 'essay', question: '지원 동기를 소개해 주세요.', answer: '사용자의 불편을 발견하고 제품으로 해결합니다.', limit: 500 }] },
  { id: 'gc', company: '녹십자웰빙 (GC WellBeing)', files: [], essays: [] },
  { id: 'kakao', company: '카카오', files: [], essays: [] },
];
const portfolios = [
  { id: 'p1', title: '사용자의 다음 행동을 설계하는 서비스 기획자', targetCompany: '네이버', templateType: 'notion', updatedAt: '2026-10-08', isFavorite: true, isPublic: false },
  { id: 'p2', title: '데이터로 증명한 제품 개선 프로젝트', targetCompany: '네이버', templateType: 'notion', isPublic: true, updatedAt: '2026-10-07' },
  { id: 'p3', title: '프로젝트 발표 자료', targetCompany: '네이버', outputType: 'ppt', pptDeck: { slides: [{}] }, updatedAt: '2026-10-06' },
  { id: 'p4', title: '새로운 포트폴리오', templateType: 'notion', updatedAt: '2026-10-05' },
];
const writes = [];
let failSave = false;
const boardWrites = [];
const portfolioMutations = [];
let failBoardSave = false;
let boardSaveDelay = 150;
// Exercise the production validator and batch writer without connecting to Firebase.
const boardDocuments = new Map();
const documentBoard = createDocumentBoardService({
  collection(name) {
    assert.equal(name, 'documentBoards');
    return { doc(uid) {
      assert.equal(uid, 'ui-fixture');
      return { collection(subcollection) {
        assert.equal(subcollection, 'documents');
        return {
          doc(id) { return { id }; },
          async get() { return { docs: [...boardDocuments.values()].map(value => ({ data: () => value })) }; },
        };
      } };
    } };
  },
  batch() {
    const changes = [];
    return {
      set(ref, value, options) {
        assert.deepEqual(options, { merge: true });
        assert.equal(ref.id, boardDocumentId(value.key));
        changes.push({ ref, value });
      },
      async commit() {
        changes.forEach(({ ref, value }) => boardDocuments.set(ref.id, { ...boardDocuments.get(ref.id), ...value }));
      },
    };
  },
});
const errors = [];
const dragWarnings = [];
const wideLayouts = [];
const browser = await puppeteer.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => {
    if (['error', 'warn'].includes(message.type()) && /@hello-pangea\/dnd|unsupported nested scroll|Droppable:|Draggable:/i.test(message.text())) {
      dragWarnings.push(message.text());
    }
  });
  await page.setRequestInterception(true);
  page.on('request', async req => {
    const url = new URL(req.url());
    const json = body => req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/src/services/apiBase.js') return req.respond({ status: 200, contentType: 'application/javascript', body: "export function getApiBaseUrl(){ return '/api'; }" });
    if (url.pathname === '/src/stores/authStore.js') {
      return req.respond({ status: 200, contentType: 'application/javascript', body: `
        import { create } from '/node_modules/.vite/deps/zustand.js';
        export default create(() => ({user:{uid:'ui-fixture',displayName:'미리보기'},profile:{nameKo:'미리보기'},loading:false,profileLoading:false,init:()=>()=>{},signOut:async()=>{}}));
      ` });
    }
    // Keep SPA unmount/remount testing focused on the cabinet and its save queue.
    if (url.pathname === '/src/pages/experience/ExperienceHub.jsx') {
      return req.respond({ status: 200, contentType: 'application/javascript', body: `
        import React from '/node_modules/.vite/deps/react.js';
        export default function ExperienceFixture() {
          return React.createElement('section', {id:'fixture-experience'}, '경험 정리 테스트 화면');
        }
      ` });
    }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/document-board' && req.method() === 'GET') {
        return json({ entries: await documentBoard.getEntries('ui-fixture') });
      }
      if (url.pathname === '/api/document-board' && req.method() === 'PATCH') {
        const body = JSON.parse(req.postData());
        boardWrites.push(body);
        // Keep a write in flight to test optimistic moves and queued updates.
        await new Promise(resolve => setTimeout(resolve, boardSaveDelay));
        if (failBoardSave) return req.respond({ status: 500, contentType: 'application/json', body: '{"error":"fixture board save failure"}' });
        try {
          return json({ entries: await documentBoard.patchEntries('ui-fixture', body) });
        } catch (error) {
          return req.respond({ status: error.status || 500, contentType: 'application/json', body: JSON.stringify({ error: error.message }) });
        }
      }
      if (url.pathname.startsWith('/api/portfolio') && req.method() !== 'GET') portfolioMutations.push({ path: url.pathname, method: req.method(), body: req.postData() });
      if (url.pathname === '/api/portfolio/list') return json(portfolios);
      if (url.pathname.includes('/billing/wallet')) return json({ balance: 10000, feedbackRewardGranted: true });
      if (url.pathname === '/api/company-folders' && req.method() === 'GET') return json(folders);
      if (url.pathname === '/api/company-folders' && req.method() === 'PUT') {
        const body = JSON.parse(req.postData());
        writes.push(body);
        if (failSave && body.essays) return req.respond({ status: 500, contentType: 'application/json', body: '{"error":"fixture save failure"}' });
        let folder = folders.find(f => f.company === body.company);
        if (!folder) { folder = { id: body.company, files: [], essays: [] }; folders.push(folder); }
        Object.assign(folder, body);
        // A slow first save exercises sequential writes.
        if (body.essays) await new Promise(resolve => setTimeout(resolve, 200));
        return json(folder);
      }
      return json({});
    }
    if (url.origin !== origin && !req.url().startsWith('data:')) return req.abort();
    return req.continue();
  });
  const clickText = async (selector, text) => {
    const clicked = await page.$$eval(selector, (nodes, text) => {
      const node = nodes.find(n => n.textContent.includes(text));
      node?.click();
      return !!node;
    }, text);
    assert.ok(clicked, `Missing ${selector}: ${text}`);
  };
  const selectFolder = async name => {
    await clickText('.ws-folder-item', name);
    await page.waitForFunction(name => document.querySelector('.ws-folder-heading h2')?.textContent === name, {}, name);
  };
  const noOverflow = async () => {
    const overflowing = await page.evaluate(() => [document.documentElement, document.body, document.querySelector('main')]
      .filter(node => node && node.scrollWidth > node.clientWidth + 1)
      .map(node => ({ tag: node.tagName, width: node.clientWidth, scrollWidth: node.scrollWidth })));
    assert.deepEqual(overflowing, [], 'Horizontal page overflow');
  };
  const horizontalCabinet = async () => {
    // Wait for the accordion width transition before comparing adjacent edges.
    await page.waitForFunction(() => {
      const slots = [...document.querySelectorAll('.ws-folder-slot')];
      if (!slots.length) return false;
      return slots.every(slot => {
        const body = slot.querySelector('.ws-folder-body');
        return slot.classList.contains('is-open')
          ? Math.abs(body.getBoundingClientRect().width - parseFloat(getComputedStyle(document.querySelector('.ws-cabinet')).getPropertyValue('--panel-width'))) < 2
          : body.getBoundingClientRect().width < 1;
      });
    });
    const layout = await page.evaluate(() => {
      const rect = node => {
        const { left, right, top, bottom, width } = node.getBoundingClientRect();
        return { left, right, top, bottom, width };
      };
      return [...document.querySelectorAll('.ws-folder-slot')].map(slot => ({
        name: slot.querySelector('.ws-folder-name').textContent,
        open: slot.classList.contains('is-open'),
        expanded: slot.querySelector('.ws-folder-item').getAttribute('aria-expanded'),
        spine: rect(slot.querySelector('.ws-folder-item')),
        body: rect(slot.querySelector('.ws-folder-body')),
      }));
    });
    assert.equal(layout.filter(folder => folder.open).length, 1, 'Exactly one folder must be open');
    assert.equal(await page.$$eval('#cabinet-documents', nodes => nodes.length), 1, 'Only the active document panel should be mounted');
    assert.equal(await page.$('.ws-sidebar'), null, 'Folder navigation must retain the horizontal cabinet');
    for (const [index, folder] of layout.entries()) {
      assert.equal(folder.expanded, String(folder.open), `Expanded state: ${folder.name}`);
      assert.ok(folder.spine.width >= 40, `Folder spine became too narrow: ${folder.name}`);
      assert.ok(Math.abs(folder.spine.top - layout[0].spine.top) < 2, `Folder spines no longer share a horizontal row: ${folder.name}`);
      assert.ok(folder.body.left >= folder.spine.right - 2, `Folder panel must open to the right of its spine: ${folder.name}`);
      if (index) {
        const previous = layout[index - 1];
        assert.ok(folder.spine.left >= previous.spine.right - 2, `Folder order or overlap: ${folder.name}`);
        assert.ok(folder.spine.left >= previous.body.right - 2, `Folder panel overlaps the following spine: ${folder.name}`);
      }
      if (folder.open) assert.ok(folder.body.width >= 200, `Opened folder content is too narrow: ${folder.name}`);
    }
    return layout.map(folder => folder.name);
  };
  const expectFolder = async name => {
    await page.waitForFunction(name => document.querySelector('.ws-folder-heading h2')?.textContent === name, {}, name);
    assert.equal(await page.$eval('.ws-folder-item[aria-expanded=true] .ws-folder-name', node => node.textContent), name);
  };
  const cardSelector = key => `.ws-board-card[data-document-key=${JSON.stringify(key)}]`;
  const cardStatus = async key => page.$eval(`${cardSelector(key)} .ws-card-status select`, node => node.value);
  const expectCardState = async (key, state) => {
    await page.waitForFunction((key, state) => {
      const card = [...document.querySelectorAll('.ws-board-card')].find(node => node.dataset.documentKey === key);
      return card?.querySelector('.ws-card-status select')?.value === state
        && card.closest(`.ws-lane--${state}`)
        && document.querySelector('.ws-board-help [role="status"]')?.textContent.trim() === '자동 저장';
    }, {}, key, state);
    assert.equal((await documentBoard.getEntries('ui-fixture'))[key]?.status, state, `The saved state differs from the card: ${key}`);
  };
  const moveCard = async (key, state) => {
    await page.waitForSelector(`${cardSelector(key)} .ws-card-status select:not(:disabled)`);
    await page.select(`${cardSelector(key)} .ws-card-status select`, state);
    await expectCardState(key, state);
  };
  const laneOrder = async state => page.$$eval(`.ws-lane--${state} .ws-board-card`, nodes => nodes.map(node => node.dataset.documentKey));
  const reloadAndSelect = async name => {
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.ws-folder-item');
    await selectFolder(name);
    await page.waitForSelector('.ws-card-status select:not(:disabled)');
  };
  const stableGeometry = async () => {
    await horizontalCabinet();
    return page.evaluate(() => {
      const rect = selector => {
        const { height, top, bottom } = document.querySelector(selector).getBoundingClientRect();
        return { height, top: top + scrollY, bottom: bottom + scrollY };
      };
      return { cabinet: rect('.ws-cabinet'), footer: rect('.ws-cabinet-footer'), pagination: rect('.ws-folder-pagination') };
    });
  };
  const sameGeometry = (actual, expected, message) => {
    for (const [part, values] of Object.entries(expected)) {
      for (const [dimension, value] of Object.entries(values)) {
        assert.ok(Math.abs(actual[part][dimension] - value) < 2, `${message}: ${part} ${dimension} changed from ${value} to ${actual[part][dimension]}`);
      }
    }
  };
  const uniformLaneHeights = async () => {
    const dimensions = await page.$$eval('.ws-lane', nodes => nodes.map(node => ({
      stage: node.getAttribute('aria-label'),
      height: node.getBoundingClientRect().height,
      scrollHeight: node.querySelector('.ws-lane-scroll')?.getBoundingClientRect().height,
      scrollClientHeight: node.querySelector('.ws-lane-scroll')?.clientHeight,
    })));
    assert.equal(dimensions.length, 3);
    const heights = dimensions.map(lane => lane.height);
    assert.ok(Math.max(...heights) - Math.min(...heights) < 2, `Stage heights differ: ${JSON.stringify(dimensions)}`);
    const viewportHeights = dimensions.map(lane => lane.scrollClientHeight);
    assert.ok(viewportHeights.every(height => Number.isFinite(height) && height > 0), `Stage scroll viewports are missing or collapsed: ${JSON.stringify(dimensions)}`);
    assert.ok(Math.max(...viewportHeights) - Math.min(...viewportHeights) < 2, `Stage scroll viewport heights differ: ${JSON.stringify(dimensions)}`);
  };
  const lastCardReachable = async () => {
    const scrolling = await page.$eval('.ws-lane--draft .ws-lane-scroll', node => {
      node.scrollTop = node.scrollHeight;
      const card = [...node.querySelectorAll('.ws-board-card')].at(-1);
      const viewport = node.getBoundingClientRect();
      const rect = card?.getBoundingClientRect();
      return { screen: { width: innerWidth, height: innerHeight },
        scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, scrollTop: node.scrollTop,
        overflowY: getComputedStyle(node).overflowY, viewport: viewport.toJSON(),
        lastCard: rect?.toJSON(), lastDocumentKey: card?.dataset.documentKey,
        reachedLast: !!card && rect.top >= viewport.top - 2 && rect.bottom <= viewport.bottom + 2 };
    });
    assert.ok(scrolling.scrollHeight > scrolling.clientHeight, `Many documents must scroll inside their stage: ${JSON.stringify(scrolling)}`);
    assert.ok(['auto', 'scroll'].includes(scrolling.overflowY), `The overflowing stage has no usable scrollbar: ${JSON.stringify(scrolling)}`);
    assert.ok(scrolling.scrollTop > 0 && scrolling.reachedLast, `The last document cannot be reached with the stage scrollbar: ${JSON.stringify(scrolling)}`);
  };
  const wideCabinetLayout = async (minimumCards) => {
    await page.evaluate(() => {
      document.querySelector('main').scrollTop = 0;
      document.querySelector('.ws-lane--draft .ws-lane-scroll').scrollTop = 0;
    });
    const layout = await page.evaluate(() => {
      const root = document.querySelector('.ws.fp-portfolio-hub');
      const cabinet = document.querySelector('.ws-cabinet');
      const board = document.querySelector('.ws-board');
      const main = cabinet.closest('main');
      const rect = node => node.getBoundingClientRect().toJSON();
      const containers = new Set();
      for (const node of [root, cabinet, board, ...board.querySelectorAll('.ws-board-card')]) {
        for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) containers.add(ancestor);
      }
      const scaleStyles = [...containers].map(node => {
        const style = getComputedStyle(node);
        return { node: `${node.tagName.toLowerCase()}.${[...node.classList].slice(0, 3).join('.')}`,
          zoom: style.zoom, transform: style.transform, scale: style.scale };
      });
      const mainRect = main.getBoundingClientRect();
      const draftScroll = board.querySelector('.ws-lane--draft .ws-lane-scroll');
      const scrollRect = draftScroll.getBoundingClientRect();
      const cards = [...draftScroll.querySelectorAll('.ws-board-card')].map(node => ({ key: node.dataset.documentKey, rect: rect(node) }));
      const visibleCards = cards.filter(({ rect }) => rect.top >= scrollRect.top - 2
        && rect.bottom <= scrollRect.bottom + 2 && rect.left >= scrollRect.left - 2 && rect.right <= scrollRect.right + 2);
      return {
        screen: { width: innerWidth, height: innerHeight }, root: rect(root), cabinet: rect(cabinet),
        footer: rect(document.querySelector('.ws-cabinet-footer')),
        mainViewport: { top: mainRect.top + main.clientTop, bottom: mainRect.top + main.clientTop + main.clientHeight,
          left: mainRect.left + main.clientLeft, right: mainRect.left + main.clientLeft + main.clientWidth },
        folderCount: cabinet.querySelectorAll('.ws-folder-slot').length,
        lanes: [...board.querySelectorAll('.ws-lane')].map(node => ({ name: node.getAttribute('aria-label'), rect: rect(node), scrollClientHeight: node.querySelector('.ws-lane-scroll').clientHeight })),
        draftViewport: rect(draftScroll), visibleCards, scaleStyles,
      };
    });
    const diagnostic = JSON.stringify(layout);
    if (layout.screen.width >= 1920) {
      assert.ok(layout.root.width > 1280 && layout.root.width <= 1500, `The large-screen workspace should have a bounded, readable width: ${diagnostic}`);
      assert.ok(layout.cabinet.width > 1280 && layout.cabinet.width <= 1500, `The large-screen cabinet should have a bounded, readable width: ${diagnostic}`);
      const previousLargeScreen = wideLayouts.find(previous => previous.screen.width >= 1920);
      if (previousLargeScreen) {
        assert.ok(Math.abs(layout.root.width - previousLargeScreen.workspaceWidth) < 2,
          `The workspace width cap changed between large screens: ${JSON.stringify({ previous: previousLargeScreen, current: layout.root })}`);
        assert.ok(Math.abs(layout.cabinet.width - previousLargeScreen.cabinetWidth) < 2,
          `The cabinet width cap changed between large screens: ${JSON.stringify({ previous: previousLargeScreen, current: layout.cabinet })}`);
      }
    } else {
      assert.ok(layout.root.width >= layout.screen.width * 0.9 && layout.root.width <= layout.screen.width,
        `The laptop workspace should fit fluidly within the viewport: ${diagnostic}`);
    }
    assert.ok(Math.abs(layout.cabinet.width - layout.root.width) < 2, `The cabinet does not use the bounded workspace width: ${diagnostic}`);
    const mainCenter = (layout.mainViewport.left + layout.mainViewport.right) / 2;
    assert.ok(Math.abs((layout.root.left + layout.root.right) / 2 - mainCenter) < 2,
      `The workspace is not centered in the main viewport: ${diagnostic}`);
    assert.ok(Math.abs((layout.cabinet.left + layout.cabinet.right) / 2 - mainCenter) < 2,
      `The cabinet is not centered in the main viewport: ${diagnostic}`);
    for (const style of layout.scaleStyles) {
      assert.ok(style.zoom === 'normal' || Number(style.zoom) === 1, `CSS zoom was used to scale ${style.node}: ${JSON.stringify(style)}`);
      assert.equal(style.transform, 'none', `A stationary cabinet or ancestor is transformed: ${JSON.stringify(style)}`);
      assert.ok(!style.scale || style.scale === 'none', `CSS scale was used on ${style.node}: ${JSON.stringify(style)}`);
    }
    assert.equal(layout.lanes.length, 3, `Wide screens must show all three stages: ${diagnostic}`);
    const widths = layout.lanes.map(lane => lane.rect.width);
    assert.ok(Math.max(...widths) - Math.min(...widths) < 2, `Wide-screen stage widths differ: ${diagnostic}`);
    assert.equal(layout.folderCount, 6, `The bounded-width fixture should show six folders: ${diagnostic}`);
    assert.ok(widths.every(width => width >= 280 && width <= 390), `Document stages are too narrow or stretched at six folders: ${diagnostic}`);
    await uniformLaneHeights();
    for (const [name, rect] of [['cabinet', layout.cabinet], ['footer', layout.footer]]) {
      assert.ok(rect.top >= layout.mainViewport.top - 2 && rect.bottom <= layout.mainViewport.bottom + 2,
        `The ${name} is not completely visible in the main viewport: ${diagnostic}`);
      assert.ok(rect.left >= layout.mainViewport.left - 2 && rect.right <= layout.mainViewport.right + 2,
        `The ${name} overflows the main viewport horizontally: ${diagnostic}`);
    }
    assert.ok(layout.visibleCards.length >= minimumCards, `A crowded stage shows fewer than ${minimumCards} complete cards at once: ${diagnostic}`);
    wideLayouts.push({ screen: layout.screen, workspaceWidth: layout.root.width, cabinetWidth: layout.cabinet.width,
      cabinetHeight: layout.cabinet.height, stageWidth: layout.lanes[0].rect.width,
      stageScrollHeight: layout.lanes[0].scrollClientHeight, completeCardsVisible: layout.visibleCards.length, minimumCards });
  };
  const consistentFonts = async () => {
    const families = await page.$$eval('.ws-header h1, .ws-folder-heading h2, .ws-folder-name, .ws-board-card-main strong, .ws-card-status select, .ws-lane h3', nodes => nodes.map(node => ({ text: node.textContent, family: getComputedStyle(node).fontFamily })));
    assert.ok(families.length > 5);
    families.forEach(({ text, family }) => {
      assert.match(family, /Pretendard/i, `Reading font is inconsistent: ${text}`);
      assert.doesNotMatch(family, /Jua/i, `Decorative font remains in document text: ${text}`);
    });
  };
  const editEssays = async () => {
    if (await page.$eval('.ws-manage-toggle', node => node.getAttribute('aria-expanded')) !== 'true') {
      await clickText('.ws-manage-toggle', '자기소개서');
    }
    await page.waitForSelector('#company-essays textarea', { visible: true });
  };
  await page.goto(`${origin}/app/portfolio`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => [...document.querySelectorAll('.ws-folder-item')].some(n => n.textContent.includes('네이버')));
  await selectFolder('네이버');
  assert.equal(await page.$$eval('.ws-board-card', n => n.length), 6);
  assert.equal(await page.$$eval('.ws-lane', nodes => nodes.length), 3, 'The three document stages must remain visible on desktop');
  const originalOrder = await horizontalCabinet();
  await uniformLaneHeights();
  await consistentFonts();
  const initialGeometry = await stableGeometry();
  assert.equal(await page.$('.ws-cabinet .ws-management-drawer'), null, 'The management editor must sit outside the fixed cabinet');
  assert.ok(await page.$('.ws-section-label .ws-folder-pagination'), 'Folder pagination must remain above the cabinet');
  await noOverflow();
  await page.screenshot({ path: join(out, 'desktop.png'), fullPage: true });
  await selectFolder('녹십자웰빙 (GC WellBeing)');
  assert.deepEqual(await horizontalCabinet(), originalOrder, 'Changing folders reordered the spines');
  sameGeometry(await stableGeometry(), initialGeometry, 'An empty company folder moved the cabinet or navigation');
  await uniformLaneHeights();
  await selectFolder('기본 서류');
  sameGeometry(await stableGeometry(), initialGeometry, 'The base resume folder moved the cabinet or navigation');
  await selectFolder('네이버');
  await clickText('.ws-tabs button', '기타 서류');
  assert.equal(await page.$$eval('.ws-board-card', n => n.length), 1);
  await selectFolder('네이버');
  assert.equal(await page.$eval('.ws-tabs button[aria-pressed=true]', node => node.textContent), '기타 서류', 'Clicking the open folder reset its type filter');
  assert.equal(await page.$$eval('.ws-board-card', nodes => nodes.length), 1);
  await clickText('.ws-tabs button', '전체');
  await clickText('.ws-stages button', '제출');
  assert.equal(await page.$$eval('.ws-board-card', n => n.length), 1);
  await selectFolder('네이버');
  assert.ok(await page.$eval('.ws-stages button[aria-pressed=true]', node => node.textContent.includes('제출')), 'Clicking the open folder reset its status filter');
  assert.equal(await page.$$eval('.ws-board-card', nodes => nodes.length), 1);
  await selectFolder('기본 서류');
  assert.equal(await page.$eval('.ws-stages button[aria-pressed=true]', n => n.textContent.startsWith('전체')), true);
  await page.focus('.ws-folder-item[aria-expanded=true]');
  for (const [key, name] of [
    ['ArrowRight', originalOrder[1]], ['ArrowLeft', originalOrder[0]],
    ['End', originalOrder.at(-1)], ['Home', originalOrder[0]],
    ['ArrowLeft', originalOrder.at(-1)], ['ArrowRight', originalOrder[0]],
  ]) {
    await page.keyboard.press(key);
    await expectFolder(name);
    assert.equal(await page.evaluate(() => document.activeElement.querySelector('.ws-folder-name')?.textContent), name, `${key} did not move focus with the selected folder`);
  }
  await page.type('.ws-search input', '경력증명서');
  await page.waitForFunction(() => document.querySelectorAll('.ws-board-card').length === 1 && document.querySelector('.ws-board-card')?.textContent.includes('경력증명서'));
  await page.click('[aria-label="검색 지우기"]');
  await selectFolder('네이버');
  // The dropdown provides the same state control for every document type.
  for (const state of ['done', 'public', 'draft']) {
    await page.focus(`${cardSelector('portfolio:p1')} .ws-card-status select`);
    await moveCard('portfolio:p1', state);
    await page.waitForFunction(() => document.activeElement?.matches('[data-document-key="portfolio:p1"] .ws-card-status select'));
  }
  await page.click('.ws-stages .ws-stage--draft');
  await page.focus(`${cardSelector('portfolio:p1')} .ws-card-status select`);
  await page.select(`${cardSelector('portfolio:p1')} .ws-card-status select`, 'done');
  await page.waitForFunction(() => !document.querySelector('[data-document-key="portfolio:p1"]')
    && document.activeElement === document.querySelector('.ws-stages .ws-stage--draft[aria-pressed=true]')
    && document.querySelector('.ws-board-help [role="status"]')?.textContent.trim() === '자동 저장');
  assert.equal((await documentBoard.getEntries('ui-fixture'))['portfolio:p1'].status, 'done', 'Moving out of a filtered stage did not persist');
  await page.click('.ws-stages .ws-stage--all');
  await moveCard('portfolio:p1', 'draft');
  assert.equal(portfolios.find(portfolio => portfolio.id === 'p1').isPublic, false, 'Moving a card published a private portfolio');
  await moveCard('portfolio:p2', 'draft');
  assert.ok(await page.$(`${cardSelector('portfolio:p2')} .ws-link-live`), 'Board stage changes hid an existing public link');
  assert.equal(portfolios.find(portfolio => portfolio.id === 'p2').isPublic, true, 'Moving a public portfolio unpublished its link');
  await moveCard('portfolio:p2', 'public');
  for (const key of ['file:r', 'essays:naver']) {
    const original = await cardStatus(key);
    await moveCard(key, 'public');
    await moveCard(key, original);
  }
  await selectFolder('기본 서류');
  const baseStatus = await cardStatus('base-resume');
  await moveCard('base-resume', 'public');
  await moveCard('base-resume', baseStatus);
  await selectFolder('네이버');
  await moveCard('portfolio:p1', 'done');
  await reloadAndSelect('네이버');
  await expectCardState('portfolio:p1', 'done');
  await moveCard('portfolio:p1', 'draft');

  failBoardSave = true;
  await page.select(`${cardSelector('portfolio:p1')} .ws-card-status select`, 'public');
  await page.waitForFunction(() => {
    const card = document.querySelector('[data-document-key="portfolio:p1"]');
    return card?.closest('.ws-lane--draft')
      && card.querySelector('select')?.value === 'draft'
      && document.querySelector('.ws-board-help [role="status"]')?.textContent.includes('이전 위치로');
  });
  assert.equal((await documentBoard.getEntries('ui-fixture'))['portfolio:p1'].status, 'draft', 'A failed save changed persisted metadata');
  failBoardSave = false;
  await reloadAndSelect('네이버');
  await expectCardState('portfolio:p1', 'draft');

  const rapidStart = boardWrites.length;
  for (const state of ['done', 'public', 'draft', 'public']) {
    await page.select(`${cardSelector('portfolio:p1')} .ws-card-status select`, state);
    assert.equal(await cardStatus('portfolio:p1'), state, 'An in-flight save prevented the next optimistic move');
  }
  await expectCardState('portfolio:p1', 'public');
  assert.deepEqual(boardWrites.slice(rapidStart).map(body => body.changes[0].status), ['done', 'public', 'draft', 'public'], 'Rapid moves were lost or saved out of order');
  await reloadAndSelect('네이버');
  await expectCardState('portfolio:p1', 'public');
  await moveCard('portfolio:p1', 'draft');

  // Leaving the hub must retain both the in-flight move and the queued move.
  boardSaveDelay = 300;
  const spaQueueStart = boardWrites.length;
  await page.evaluate(() => { window.__cabinetDocumentToken = 'same SPA document'; });
  await page.select(`${cardSelector('portfolio:p1')} .ws-card-status select`, 'done');
  await page.select(`${cardSelector('portfolio:p1')} .ws-card-status select`, 'public');
  assert.ok(await page.$eval('.ws-board-help [role="status"]', node => node.textContent.includes('저장 중')), 'The SPA navigation fixture did not leave a save pending');
  await page.click('header nav a[href="/app/experience"]');
  await page.waitForSelector('#fixture-experience');
  assert.equal(await page.$('.ws-cabinet'), null, 'SPA navigation did not unmount the cabinet');
  await page.click('header nav a[href="/app/portfolio"]');
  await page.waitForSelector('.ws-folder-item');
  await selectFolder('네이버');
  await expectCardState('portfolio:p1', 'public');
  assert.equal(await page.evaluate(() => window.__cabinetDocumentToken), 'same SPA document', 'The navigation test performed a page reload instead of SPA navigation');
  assert.deepEqual(boardWrites.slice(spaQueueStart).flatMap(body => body.changes.filter(item => item.key === 'portfolio:p1').map(item => item.status)), ['done', 'public'], 'Unmounting the hub discarded a queued board move');
  boardSaveDelay = 150;
  await moveCard('portfolio:p1', 'draft');

  const keyboardDrag = async (key, direction) => {
    const handle = `${cardSelector(key)} .ws-card-drag-handle`;
    await page.focus(handle);
    await page.keyboard.press('Space');
    await page.waitForSelector('.ws-board-card.is-dragging');
    await page.keyboard.press(direction);
    // Keyboard drags animate to their destination before the drop is accepted.
    await new Promise(resolve => setTimeout(resolve, 350));
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.querySelector('.ws-board-card.is-dragging'));
  };
  await horizontalCabinet();
  await keyboardDrag('portfolio:p1', 'ArrowRight');
  await expectCardState('portfolio:p1', 'done');
  const beforeReorder = await laneOrder('done');
  assert.ok(beforeReorder.length >= 2, 'Reorder fixture needs two completed documents');
  const reorderedKey = beforeReorder[1];
  await keyboardDrag(reorderedKey, 'ArrowUp');
  const expectedOrder = [beforeReorder[1], beforeReorder[0], ...beforeReorder.slice(2)];
  await page.waitForFunction(expected => JSON.stringify([...document.querySelectorAll('.ws-lane--done .ws-board-card')].map(node => node.dataset.documentKey)) === JSON.stringify(expected), {}, expectedOrder);
  await expectCardState(reorderedKey, 'done');
  assert.deepEqual(await laneOrder('done'), expectedOrder, 'Keyboard dragging did not change order within a stage');
  await reloadAndSelect('네이버');
  await expectCardState(reorderedKey, 'done');
  assert.deepEqual(await laneOrder('done'), expectedOrder, 'Document order did not survive a reload');
  portfolios.unshift({
    id: 'new-latest', title: '방금 추가한 최신 발표 자료', targetCompany: '네이버', outputType: 'ppt',
    pptDeck: { slides: [{}] }, isFavorite: true, isPublic: false, updatedAt: '2030-01-01',
  });
  const editedPortfolio = portfolios.find(portfolio => portfolio.id === 'p3');
  editedPortfolio.isFavorite = true;
  editedPortfolio.updatedAt = '2030-01-02';
  await reloadAndSelect('네이버');
  const existingKeys = new Set(expectedOrder);
  assert.ok((await laneOrder('done')).includes('portfolio:new-latest'), 'The latest-document fixture was not loaded');
  assert.deepEqual((await laneOrder('done')).filter(key => existingKeys.has(key)), expectedOrder, 'Adding a latest document or updating favourites reshuffled manually arranged cards');
  await moveCard('portfolio:p1', 'draft');
  assert.deepEqual(portfolioMutations, [], 'Board movement must not write portfolio publication settings');
  await horizontalCabinet();
  // Let the cabinet's local scroll finish before opening a menu that closes on scroll.
  await new Promise(resolve => setTimeout(resolve, 650));
  await page.click('.ws-card-menu');
  await page.waitForSelector('[role="menu"]');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'menuitem');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'ws-card-menu');
  await editEssays();
  await page.type('#company-essays textarea', ' 마지막 입력');
  await selectFolder('카카오');
  assert.ok(writes.some(w => w.company === '네이버' && w.essays?.[0].answer.includes(' 마지막 입력')), 'Switching folders lost the pending draft');
  assert.ok(!writes.some(w => w.company === '카카오' && w.essays?.length), 'Draft saved into the wrong folder');
  await selectFolder('네이버');
  await editEssays();
  failSave = true;
  await page.type('#company-essays textarea', ' 재시도');
  await clickText('.ws-folder-item', '카카오');
  await page.waitForFunction(() => document.querySelector('#company-essays')?.textContent.includes('저장 실패'));
  await expectFolder('네이버');
  assert.equal(await page.$eval('.ws-manage-toggle', node => node.getAttribute('aria-expanded')), 'true', 'A failed save must keep the editor open');
  assert.ok(await page.$eval('#company-essays textarea', node => node.value.includes(' 재시도')), 'A failed switch discarded the unsaved input');
  failSave = false;
  await clickText('#company-essays button', '다시 시도');
  await page.waitForFunction(() => document.querySelector('#company-essays')?.textContent.includes('저장됨'));
  await page.type('#company-essays textarea', ' 빠른 연속 전환');
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.ws-folder-item')];
    for (const name of ['녹십자웰빙 (GC WellBeing)', '기본 서류', '카카오']) {
      buttons.find(node => node.querySelector('.ws-folder-name')?.textContent === name).click();
    }
  });
  await expectFolder('카카오');
  assert.ok(writes.some(write => write.company === '네이버' && write.essays?.[0].answer.includes(' 빠른 연속 전환')), 'Rapid switching lost the draft');
  await selectFolder('네이버');
  await editEssays();
  assert.ok(await page.$eval('#company-essays textarea', node => node.value.includes(' 빠른 연속 전환')), 'Returning to the folder restored stale essay data');
  await clickText('.ws-manage-toggle', '자기소개서');
  await page.click('.ws-add-folder');
  await page.type('.ws-new-folder input', '토스');
  await page.click('.ws-new-folder button[type=submit]');
  await page.waitForFunction(() => document.querySelector('.ws-folder-heading h2')?.textContent === '토스');
  await page.waitForFunction(() => !document.body.innerText.includes('자소서를 저장하지 못했습니다'));
  portfolios.push(...Array.from({ length: 24 }, (_, index) => ({
    id: `dense-${index}`, title: `계속 작성할 포트폴리오 ${String(index + 1).padStart(2, '0')}`,
    targetCompany: '네이버', templateType: 'notion', isPublic: false, updatedAt: '2026-10-08',
  })));
  await reloadAndSelect('네이버');
  await horizontalCabinet();
  const denseGeometry = await stableGeometry();
  await uniformLaneHeights();
  sameGeometry(denseGeometry, initialGeometry, 'A folder with many documents moved the cabinet or navigation');
  await lastCardReachable();
  await selectFolder('기본 서류');
  sameGeometry(await stableGeometry(), denseGeometry, 'Switching from a crowded folder to the base resume moved navigation');
  await selectFolder('카카오');
  sameGeometry(await stableGeometry(), denseGeometry, 'Switching from a crowded folder to an empty folder moved navigation');
  await selectFolder('네이버');
  await horizontalCabinet();
  await page.screenshot({ path: join(out, 'dense-desktop.png'), fullPage: true });
  for (const [width, height, minimumCards] of [[1920, 1080, 3], [1440, 900, 2], [2560, 1440, 3]]) {
    await page.setViewport({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await selectFolder('네이버');
    await horizontalCabinet();
    await noOverflow();
    await consistentFonts();
    await wideCabinetLayout(minimumCards);
    await page.screenshot({ path: join(out, `wide-${width}-${height}.png`), fullPage: true });
    await lastCardReachable();
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewport({ width, height: 844 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await selectFolder('네이버');
    await horizontalCabinet();
    await noOverflow();
    await consistentFonts();
    if (width === 1440) {
      await uniformLaneHeights();
      await lastCardReachable();
    }
    await page.screenshot({ path: join(out, `width-${width}.png`), fullPage: true });
  }
  folders.push(...Array.from({ length: 20 }, (_, index) => ({
    id: `many-${index}`, company: `테스트 기업 ${String(index + 1).padStart(2, '0')} 긴 기업명`, files: [], essays: [],
  })));
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('.ws-folder-item').length > 20);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewport({ width, height: 844 });
    await selectFolder('테스트 기업 20 긴 기업명');
    await horizontalCabinet();
    await noOverflow();
    assert.ok(await page.$eval('.ws-cabinet', node => node.scrollWidth > node.clientWidth), 'Many folders should scroll inside the cabinet');
    await page.waitForFunction(() => {
      const viewport = document.querySelector('.ws-cabinet').getBoundingClientRect();
      const selected = document.querySelector('.ws-folder-slot.is-open').getBoundingClientRect();
      return selected.left >= viewport.left - 2 && selected.right <= viewport.right + 2;
    }, { timeout: 5000 });
    await page.screenshot({ path: join(out, `many-folders-${width}.png`), fullPage: true });
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await selectFolder('네이버');
  await horizontalCabinet();
  assert.equal(await page.$eval('.ws-folder-body', node => getComputedStyle(node).transitionDuration), '0s');
  assert.equal(await page.$eval('.ws-board-card', node => getComputedStyle(node).animationName), 'none');
  assert.deepEqual(errors, []);
  assert.deepEqual(dragWarnings, [], 'Drag and drop emitted an unsupported-container or accessibility warning');
  assert.deepEqual(portfolioMutations, [], 'Document board operations wrote portfolio settings');
  console.log(JSON.stringify({ wideLayouts }, null, 2));
  console.log(JSON.stringify({ result: 'PASS', checks: ['horizontal spine order and right-opening panel', 'single mounted document panel', 'three equal-height document stages', 'Pretendard typography', 'fixed cabinet/footer/pagination positions across base, empty, and crowded folders', 'independent stage scroll reaches the last document', 'status dropdowns for portfolios, files, essays, and base resume', 'board stages never change public links', 'state restored after reload', 'failed board save rolls back', 'rapid board changes persist in order', 'queued moves survive SPA unmount/remount', 'keyboard drag across stages', 'keyboard reorder survives reload', 'manual order survives new documents and favourite changes', 'no drag-and-drop nested-scroll warnings', 'type and status filters survive repeated selection', 'folder arrow/Home/End keyboard navigation', 'search', 'keyboard menus', 'management editor outside the cabinet', 'autosave on switch', 'failed save blocks switching', 'save retry', 'latest rapid selection wins', 'saved draft restored on return', 'folder creation', '1440/768/390/320px overflow', '20+ folders scroll locally at every width', 'reduced motion'], boardWrites: boardWrites.length, screenshots: out }, null, 2));
} catch (error) {
  const [page] = await browser.pages().then(pages => pages.slice(-1));
  console.error({ errors, dragWarnings, boardWrites, entries: await documentBoard.getEntries('ui-fixture'), geometry: await page.evaluate(() => {
    const cabinet = document.querySelector('.ws-cabinet');
    const slot = document.querySelector('.ws-folder-slot.is-open');
    return { screen: innerWidth, cabinet: cabinet?.getBoundingClientRect().toJSON(), slot: slot?.getBoundingClientRect().toJSON(), scroll: cabinet?.scrollLeft, offset: slot?.offsetLeft, panel: cabinet?.style.getPropertyValue('--panel-width'), focus: { tag: document.activeElement?.tagName, className: document.activeElement?.className, label: document.activeElement?.getAttribute('aria-label'), documentKey: document.activeElement?.closest('[data-document-key]')?.dataset.documentKey }, lanes: [...document.querySelectorAll('.ws-lane')].map(node => ({ className: node.className, height: node.getBoundingClientRect().height, scroll: node.querySelector('.ws-lane-scroll')?.getBoundingClientRect().toJSON() })) };
  }) });
  await page.screenshot({ path: join(out, 'failure.png'), fullPage: true });
  throw error;
} finally {
  await browser.close();
}
