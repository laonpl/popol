const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const RENDER_SCALE = 2;
const SPREAD_PAGE_WIDTH = 560;
const SPREAD_GAP = 4;

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

async function waitForImages(root) {
  await Promise.all([...root.querySelectorAll('img')].map(async img => {
    if (!img.complete) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 5000);
        const finish = () => { clearTimeout(timer); resolve(); };
        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', finish, { once: true });
      });
    }
    if (img.naturalWidth) await img.decode?.().catch(() => {});
  }));
}

function pageCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * RENDER_SCALE);
  canvas.height = Math.round(height * RENDER_SCALE);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

function addSpreadPages(pdf, rendered, sourceHeight) {
  for (let page = 0; page < 2; page += 1) {
    if (page) pdf.addPage();
    const sourceX = Math.round(page * (SPREAD_PAGE_WIDTH + SPREAD_GAP) * RENDER_SCALE);
    const sourceWidth = Math.round(SPREAD_PAGE_WIDTH * RENDER_SCALE);
    const sourcePixels = Math.round(sourceHeight * RENDER_SCALE);
    const { canvas, context } = pageCanvas(SPREAD_PAGE_WIDTH, sourceHeight);
    context.drawImage(rendered, sourceX, 0, sourceWidth, sourcePixels, 0, 0, sourceWidth, sourcePixels);

    // 내용이 화면의 A4 종이보다 길면 비율을 유지해 한 장 안에 넣는다.
    const ratio = Math.min(A4_WIDTH_MM / SPREAD_PAGE_WIDTH, A4_HEIGHT_MM / sourceHeight);
    const width = SPREAD_PAGE_WIDTH * ratio;
    const height = sourceHeight * ratio;
    pdf.addImage(canvas, 'PNG', (A4_WIDTH_MM - width) / 2, (A4_HEIGHT_MM - height) / 2, width, height);
  }
}

function verticalBreaks(root, sourceHeight, pageHeight) {
  const origin = root.getBoundingClientRect().top;
  const positions = selector => [...root.querySelectorAll(selector)]
    .map(element => Math.round(element.getBoundingClientRect().top - origin))
    .filter(y => y > 0 && y < sourceHeight)
    .sort((a, b) => a - b);
  const itemStarts = positions('section, [data-resume-pdf-break]');
  const paragraphStarts = positions('header, p, li');
  const breaks = [0];
  const maxContent = pageHeight - 40;

  while (true) {
    const start = breaks.at(-1);
    const capacity = start === 0 ? pageHeight : maxContent;
    if (sourceHeight - start <= capacity) {
      breaks.push(sourceHeight);
      break;
    }
    const limit = start + capacity;
    const item = itemStarts.filter(y => y > start + 200 && y <= limit).at(-1);
    const paragraph = paragraphStarts.filter(y => y > start + 200 && y <= limit).at(-1);
    const next = item && limit - item < 300
      ? item
      : paragraph && limit - paragraph < 180 ? paragraph : limit;
    breaks.push(next);
  }
  return breaks;
}

function addVerticalPages(pdf, rendered, root, sourceWidth, sourceHeight) {
  const pageHeight = Math.round(sourceWidth * A4_HEIGHT_MM / A4_WIDTH_MM);
  const breaks = verticalBreaks(root, sourceHeight, pageHeight);
  for (let page = 0; page < breaks.length - 1; page += 1) {
    if (page) pdf.addPage();
    const from = breaks[page];
    const height = breaks[page + 1] - from;
    const { canvas, context } = pageCanvas(sourceWidth, pageHeight);
    context.drawImage(
      rendered,
      0, Math.round(from * RENDER_SCALE), rendered.width, Math.round(height * RENDER_SCALE),
      0, page ? 40 * RENDER_SCALE : 0, rendered.width, Math.round(height * RENDER_SCALE),
    );
    pdf.addImage(canvas, 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
  }
}

/** 화면의 이력서 DOM을 같은 글꼴 그대로 A4 PDF에 담는다. */
export async function buildResumePdf(host, layout) {
  const root = host.querySelector('[data-resume-pdf-root]');
  if (!root) throw new Error('이력서 화면을 찾지 못했습니다');

  await document.fonts.load('400 12px "Resume Pretendard"');
  await document.fonts.load('800 12px "Resume Pretendard"');
  await document.fonts.ready;
  await waitForImages(root);
  await nextFrame();

  const width = Math.ceil(root.getBoundingClientRect().width);
  const height = Math.ceil(root.getBoundingClientRect().height);
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'), import('jspdf'),
  ]);
  const rendered = await html2canvas(root, {
    backgroundColor: '#ffffff',
    scale: RENDER_SCALE,
    useCORS: true,
    logging: false,
    width,
    height,
    windowWidth: Math.max(window.innerWidth, 1200),
    onclone: clonedDocument => {
      const clonedHost = clonedDocument.getElementById(host.id);
      if (clonedHost) clonedHost.style.visibility = 'visible';
    },
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  if (layout === 'horizontal') addSpreadPages(pdf, rendered, height);
  else addVerticalPages(pdf, rendered, root, width, height);
  return pdf.output('blob');
}
