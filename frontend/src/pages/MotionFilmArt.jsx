import MotionWorkingScene, { PhysicalDocument } from './MotionWorkingScene';
import pageTiles from '../../public/motion/page-tiles.json';
import detailCrops from '../../public/motion/detail-crops.json';

const P = { ink: '#343047', muted: '#8b839d', violet: '#8061ce', pale: '#f2eff9', blue: '#d7d6fa' };
const ease = n => { const p = Math.max(0, Math.min(1, n)); return p * p * p * (10 + p * (-15 + 6 * p)); };
// Preview and export share the original pixels; long pages use bounded SVG tiles below.
const asset = name => `/motion/${name}.png`;
const intro = (t, delay = 0, duration = 0.85) => ease((t - delay) / duration);
const STARTS = [0, 4, 7, 13, 23, 33, 44];
// The 자료 입력 capture is 4960x4720; the panel shows it 1120 wide, so everything below is in
// that display space. Measured off the PNG: dropzone centre 636/400, draft button 788/947.
const PAGE = { iw: 1120, vx: 70, left: 230, top: 128, w: 980, h: 560 };
const DROP = [636, 401], BUTTON = [788, 947];
// It holds still while the files drop in, then scrolls down to the draft button.
const SCROLL = t => 90 + intro(t, 6.5, 1.3) * 410;
// STEP 1 shows the whole 경험 선택 page, so it is drawn smaller — 880 display pixels wide.
// Button centres come from motion-hotspots.json, measured in the browser at capture time.
const SELECT = { src: 'actual-chat-select', iw: 880, vx: 6, vy: 6, left: 286, top: 56, w: 868, h: 780 };
const SELECT_BUTTON = [716, 614];
// STEP 3 fills the frame with the product's own progress screen and creeps toward its card.

function Text({ x = 720, y, size = 52, fill = P.ink, weight = 750, anchor = 'middle', children, ...rest }) {
  return <text x={x} y={y} fill={fill} fontSize={size} fontWeight={weight} textAnchor={anchor} letterSpacing={size > 40 ? -2.5 : -0.6} {...rest}>{children}</text>;
}
function Arrive({ t, delay = 0, x = 0, y = 0, children, float = false }) {
  const p = intro(t, delay);
  return <g opacity={p} transform={`translate(${x} ${y + (1 - p) * 38 + (float ? Math.sin(t * 1.1 + delay) * 4 : 0)})`}>{children}</g>;
}
function Bubble({ t, delay, x, y, w = 330, lines, lavender = false, scale = 1 }) {
  const p = intro(t, delay);
  return <g opacity={p} transform={`translate(${x} ${y + 30 * (1 - p) + Math.sin(t * 1.5 + delay) * 5}) scale(${scale * (0.82 + p * 0.18)})`}>
    <path d={`M24 0H${w - 24}Q${w} 0 ${w} 24V92Q${w} 116 ${w - 24} 116H${w - 61}L${w - 68} 145Q${w - 72} 154 ${w - 79} 145L${w - 106} 116H24Q0 116 0 92V24Q0 0 24 0Z`} fill={lavender ? 'url(#clay-blue)' : 'url(#clay-white)'} stroke="#ffffff90" strokeWidth="2" filter="url(#clay-shadow)" />
    {lines.map((line, i) => <Text key={line} x={w / 2} y={lines.length === 1 ? 68 : 49 + i * 33} size={lines.length === 1 ? 25 : 24} weight={650} fill="#655d78">{line}</Text>)}
  </g>;
}
// The mark the product actually ships, cropped out of the shared /logo.png.
const LOGO_MARK = '112 84 246 249';
const LOGO_LOCKUP = '112 84 250 326';
function Logo({ x, y, w, h, box = LOGO_MARK }) {
  return <svg x={x} y={y} width={w} height={h} viewBox={box}><image href="/logo.png" width="512" height="512" filter="url(#logo-key)" /></svg>;
}
// A window onto one of the captured product screens; `vy` scrolls it like the real page.
function Shot({ src, nw, nh, x, y, w, h, vx = 0, vy = 0, vw, border = true }) {
  return <><svg x={x} y={y} width={w} height={h} viewBox={`${vx} ${vy} ${vw} ${vw * h / w}`}><image href={`/motion/${src}.png`} width={nw} height={nh} /></svg>{border && <rect x={x} y={y} width={w} height={h} fill="none" stroke="#e2dcec" />}</>;
}
function Photo({ src, scale = 1, x = 0, y = 0, opacity = 1 }) {
  return <g opacity={opacity} transform={`translate(${720 + x} ${405 + y}) scale(${scale}) translate(-720 -405)`}><image href={`/motion/${src}.png`} width="1440" height="810" preserveAspectRatio="xMidYMid slice" /></g>;
}
// Soft colour fields that drift behind the product shots, so each chapter has its own air.
const BLOBS = [['#c4aef2', 168, 372, 268], ['#9fd6ef', 1316, 190, 214], ['#f2b4df', 1214, 690, 262], ['#b9c5f8', 268, 736, 214]];
function Blobs({ t, only }) {
  return <g>{BLOBS.filter((_, i) => !only || only.includes(i)).map(([fill, x, y, r], i) => {
    const p = intro(t, .1 + i * .18, 1.4);
    return <circle key={x} cx={x + Math.sin(t * .32 + i) * 26} cy={y + Math.cos(t * .27 + i * 2) * 20} r={r * (.6 + p * .4)} fill={fill} opacity={p * .5} filter="url(#clay-blur)" />;
  })}</g>;
}
// Real projective perspective, where lines actually converge. SVG cannot do it, so the page
// lives in a foreignObject under a CSS 3D transform; the film and the MP4 renderer are the
// same Chrome, so what /motion shows is exactly what gets captured.
function Panel3D({ src, iw, vx = 0, vy = 0, left, top, w, h, rx = 0, ry = 0, rz = 0, scale = 1, ox, oy, persp = 1250, radius = 12, bezel = 0, opacity = 1, children }) {
  // ox/oy are given in screen-content coordinates; the device frame shifts them by its bezel.
  const origin = ox === undefined ? '50% 50%' : `${ox + bezel}px ${oy + bezel}px`;
  return <foreignObject x="0" y="0" width="4320" height="2430" transform="scale(.3333333333)" opacity={opacity} style={{ pointerEvents: 'none' }}>
    <div style={{ zoom: 3, width: 1440, height: 810, perspective: `${persp}px` }}>
      <div style={{
        position: 'absolute', left: left - bezel, top: top - bezel, padding: bezel,
        borderRadius: bezel ? bezel + radius : radius, background: bezel ? '#272138' : '#fff',
        boxShadow: '0 40px 84px rgba(74,54,108,.28), 0 5px 16px rgba(74,54,108,.14)',
        transformOrigin: origin, transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`,
      }}>
        <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden', borderRadius: radius, background: '#fff' }}>
          {/* maxWidth:none is load-bearing: the app's preflight clamps images to their box,
              which would silently rescale the page and throw every measured crop off. */}
          <img src={asset(src)} alt="" style={{ width: iw, maxWidth: 'none', height: 'auto', display: 'block',
            position: 'absolute', left: 0, top: 0, transform: `translate3d(${-vx}px,${-vy}px,0)` }} />
          {children}
        </div>
      </div>
    </div>
  </foreignObject>;
}
// A full-frame typographic beat: the line splits and an object passes between the halves.
function TypeCard({ t, inAt, outAt, eyebrow, left, right, y = 430, size = 72, object }) {
  const p = intro(t, inAt, .55), out = intro(t, outAt, .45);
  if (p <= 0 || out >= 1) return null;
  const lift = (1 - p) * 40 - out * 34;
  return <g opacity={p * (1 - out)}>
    <g transform={`translate(0 ${lift * .5})`}><Text y={y - 118} size={22} fill={P.violet}>{eyebrow}</Text></g>
    <g transform={`translate(${-(1 - p) * 34 - out * 26} ${lift})`}><Text x={642} y={y} size={size} anchor="end">{left}</Text></g>
    <g transform={`translate(0 ${lift * .3}) rotate(${-11 + out * 14} 720 ${y - 26})`}>{object}</g>
    <g transform={`translate(${(1 - p) * 34 + out * 26} ${lift})`}><Text x={798} y={y} size={size} anchor="start" fill={P.violet}>{right}</Text></g>
  </g>;
}
// Scroll that eases between holds, so every section gets a beat long enough to read.
function track(t, frames) {
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, v0] = frames[i], [t1, v1] = frames[i + 1];
    if (t < t1) return t <= t0 ? v0 : v0 + (v1 - v0) * ease((t - t0) / (t1 - t0));
  }
  return frames[frames.length - 1][1];
}
// The cursor arrives before the click; the real button and click ring react together.
// It shows the button's own pixels, so nothing is redrawn by hand, and it sits inside the
// panel where the perspective carries it.
function PressButton({ t, at, src, iw, vx, vy, x, y, w, h, radius = 11, plate = '#fff' }) {
  const lift = intro(t, at - 1, .7);
  const dip = Math.max(0, Math.min(1, (t - at) / .08)) * (1 - intro(t, at + .1, .3));
  const up = lift * (1 - dip);
  const approach = intro(t, at - 1.35, .85);
  const cursorOpacity = intro(t, at - 1.45, .2) * (1 - intro(t, at + .4, .3));
  const click = intro(t, at, .42);
  const cursorX = x + w * .22 + (1 - approach) * 95;
  const cursorY = y + 3 + (1 - approach) * 80 - Math.sin(approach * Math.PI) * 22;
  return <>
  {/* The page still has the original button printed on it. Cover that footprint with the
      page's own colour, or the moving copy reads as a second button beside it. */}
  <div style={{ position: 'absolute', left: x - w / 2 - 3, top: y - h / 2 - 3,
    width: w + 6, height: h + 6, background: plate }} />
  <div style={{
    position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: radius,
    backgroundImage: `url(${asset(src)})`, backgroundSize: `${iw}px auto`,
    backgroundPosition: `${-(x - w / 2 + vx)}px ${-(y - h / 2 + vy)}px`,
    transform: `translateY(${lift * -h * .1 + dip * h * .19}px) scale(${1 + up * .03 - dip * .06})`,
    boxShadow: `0 ${1 + up * 17}px ${4 + up * 27}px rgba(46,28,78,${.08 + up * .32})`,
  }} />
  <svg width="54" height="62" viewBox="-18 -18 54 62" style={{ position: 'absolute', overflow: 'visible',
    left: cursorX - 18, top: cursorY - 18, opacity: cursorOpacity, transformOrigin: '18px 18px', transform: `scale(${1 - dip * .12})` }}>
    {click > 0 && click < 1 && <circle r={5 + click * 18} fill="none" stroke="#9671d0" strokeWidth="2" opacity={1 - click} />}
    <path d="M0 0L0 26L7 20L13 33L19 30L12 18L23 18Z" fill="#30273e" stroke="white" strokeWidth="2" strokeLinejoin="round" />
  </svg>
  </>;
}
// SVG paints native pixels at the final viewport resolution. Only nearby tiles are
// mounted, avoiding oversized compositor textures and a 1440px intermediate raster.
function PageSweep({ src, nw, nh, vy }) {
  const { tileHeight, tiles } = pageTiles[src];
  const top = Math.max(0, Math.min(nh - 810 * nw / 1440, vy * nw / 1440));
  const bottom = top + 810 * nw / 1440;
  return <svg width="1440" height="810" viewBox={`0 ${top} ${nw} ${810 * nw / 1440}`} data-page-sweep={src}>
    <rect width={nw} height={nh} fill="white" />
    {tiles.map((href, i) => i * tileHeight <= bottom + tileHeight && (i + 1) * tileHeight >= top - tileHeight
      ? <image key={href} href={href} y={i * tileHeight} width={nw} height={Math.min(tileHeight, nh - i * tileHeight)} /> : null)}
  </svg>;
}
// The reference film's emphasis move: a real region of the product screen, shown larger and
// ringed. Each region is its own small file so blowing it up costs nothing.
function Callout({ t, delay, hold = 1.2, src, nw, nh, x, y, w }) {
  const p = intro(t, delay, .55), out = intro(t, delay + hold, .4);
  if (p <= 0 || out >= 1) return null;
  const detail = detailCrops[src];
  const h = w * (detail ? detail.height / detail.width : nh / nw), k = .93 + p * .07;
  return <g opacity={p * (1 - out)} transform={`translate(${x + w / 2} ${y + h / 2}) scale(${k}) translate(${-x - w / 2} ${-y - h / 2})`}>
    <rect x={x - 10} y={y - 10} width={w + 20} height={h + 20} rx="22" fill="white" filter="url(#clay-shadow)" />
    <image href={`/motion/${src}-hd.png`} x={x} y={y} width={w} height={h} preserveAspectRatio="none" data-detail={src} />
    <rect x={x - 10} y={y - 10} width={w + 20} height={h + 20} rx="22" fill="none" stroke={P.violet} strokeWidth="5" />
  </g>;
}
// A plain line of type, bottom left, saying what this shot is. No card — the film already
// dropped those — just the eyebrow and the sentence in the film's own voice.
function Caption({ t, at, until, step, children }) {
  const p = intro(t, at, .5), out = intro(t, until, .4);
  if (p <= 0 || out >= 1) return null;
  return <g opacity={p * (1 - out)} transform={`translate(${(1 - p) * -18} 0)`}>
    <Text x={64} y={700} size={17} anchor="start" fill={P.violet} weight={700}>{step}</Text>
    <Text x={64} y={742} size={31} anchor="start" weight={750}>{children}</Text>
  </g>;
}
function MotionFilmScene({ time }) {
  const scene = Math.max(0, STARTS.findLastIndex(at => time >= at));
  const t = time - STARTS[scene];
  return <svg className="motion-art" viewBox="0 0 1440 810" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`3D 캐릭터와 함께하는 FitPoly 홍보영상, 장면 ${scene + 1}`} style={{ fontFamily: '"Motion Pretendard", Pretendard, Arial, sans-serif', textRendering: 'optimizeLegibility' }}>
    <defs>
      <linearGradient id="clay-bg" x2="1" y2="1"><stop stopColor="#f6f3fb" /><stop offset=".55" stopColor="#eeebf7" /><stop offset="1" stopColor="#e4dff1" /></linearGradient>
      <linearGradient id="clay-white" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#ffffff" /><stop offset=".65" stopColor="#f6f5f9" /><stop offset="1" stopColor="#dedbe6" /></linearGradient>
      <linearGradient id="clay-blue" x2=".8" y2="1"><stop stopColor="#e5e3ff" /><stop offset="1" stopColor="#c2bbed" /></linearGradient>
      <linearGradient id="clay-violet" x2=".8" y2="1"><stop stopColor="#c2acee" /><stop offset=".5" stopColor="#9d81d6" /><stop offset="1" stopColor="#7656b0" /></linearGradient>
      <radialGradient id="clay-glow"><stop stopColor="white" stopOpacity=".95" /><stop offset="1" stopColor="white" stopOpacity="0" /></radialGradient>
      <filter id="clay-shadow" x="-30%" y="-40%" width="170%" height="200%"><feDropShadow dx="8" dy="16" stdDeviation="12" floodColor="#706181" floodOpacity=".19" /><feDropShadow dx="-3" dy="-3" stdDeviation="3" floodColor="white" floodOpacity=".85" /></filter>
      <filter id="clay-small" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="3" dy="5" stdDeviation="3" floodColor="#64537c" floodOpacity=".25" /></filter>
      <filter id="clay-blur"><feGaussianBlur stdDeviation="16" /></filter>
      {/* /logo.png ships on a white plate; alpha from luminance drops it without touching the mark. */}
      <filter id="logo-key" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -.2126 -.7152 -.0722 0 1" /></filter>
    </defs>
    <rect width="1440" height="810" fill="url(#clay-bg)" />
    {/* 00-15: one continuous take. The working scene reads the master clock, so the
        chapter change at 08s only swaps the caption, never cuts the shot. */}
    {scene < 2 && <MotionWorkingScene time={time} />}
    {scene === 2 && <>
      <Photo src="graduate-wide" scale={1 + t * .002} />
      <Bubble t={t} delay={0.2} x={155} y={104} w={410} lines={['취업할 때가 됐는데…']} />
      <Bubble t={t} delay={1.1} x={916} y={123} w={354} lines={['내가 맡은 역할은', '뭐였더라?']} lavender />
      <Bubble t={t} delay={2} x={288} y={278} w={290} lines={['성과는 어떻게', '써야 하지?']} scale={.94} />
      <Bubble t={t} delay={2.9} x={846} y={289} w={418} lines={['이걸 언제 다 정리하지?']} />
      <Arrive t={t} delay={4} x={727} y={245}><rect x="-62" y="-24" width="124" height="48" rx="24" fill="url(#clay-white)" filter="url(#clay-shadow)" /><Text x={0} y={8} size={20} fill="#996078">마감 D-3</Text></Arrive>
    </>}
    {/* 22-32 — STEP 1 경험 선택, STEP 2 자료 입력. Each step ends the same way: the camera
        pushes into the button that carries it forward, and the button presses itself. */}
    {scene === 3 && <>
      <rect width="1440" height="810" fill="#fcfbfe" />
      <Blobs t={t} only={[0, 1, 2]} />
      <TypeCard t={t} inAt={.1} outAt={1.4} eyebrow="01 · 네 단계면 끝나요" left="가지고 있는" right="자료로."
        object={<PhysicalDocument x={720} y={396} scale={.5} rotation={0} label={false} />} />
      {(() => {
        const swing = intro(t, 1.4, 1.4), push = intro(t, 2.8, 1.1), out = intro(t, 4.35, .45);
        if (swing <= 0 || out >= 1) return null;
        const [bx, by] = [SELECT_BUTTON[0] - SELECT.vx, SELECT_BUTTON[1] - SELECT.vy];
        // A shallow dip on contact, so the whole page reacts to its own button.
        const dip = 1 - intro(t, 3.82, .12) * .02 + intro(t, 3.94, .2) * .02;
        return <Panel3D {...SELECT} bezel={15} ox={bx} oy={by} top={SELECT.top - push * 250} opacity={swing * (1 - out)}
          rx={4 - swing * 4 + push * 2} ry={-32 + swing * 26 + push * 5} rz={-3 + swing * 3}
          scale={(.95 + swing * .05) * (1 + push * 1.95) * dip}>
          <PressButton t={t} at={3.88} src={SELECT.src} iw={SELECT.iw} vx={SELECT.vx} vy={SELECT.vy} x={bx} y={by} w={133} h={34} radius={8} plate="#f7f9fc" />
        </Panel3D>;
      })()}
      {(() => {
        const swing = intro(t, 4.6, 1.3), push = intro(t, 7.6, 1.3);
        if (swing <= 0) return null;
        const filled = intro(t, 6.2, .6), vy = SCROLL(t);
        const [bx, by] = [BUTTON[0] - PAGE.vx, BUTTON[1] - vy];
        const dip = 1 - intro(t, 8.98, .12) * .02 + intro(t, 9.1, .2) * .02;
        const common = { ...PAGE, vy, bezel: 15, ox: bx, oy: by, top: PAGE.top - push * 130,
          rx: 5 - swing * 5 + push * 3, ry: -36 + swing * 29 + push * 6, rz: -3.5 + swing * 3.5,
          scale: (.94 + swing * .06) * (1 + push * .85) * dip };
        return <>
          <Panel3D {...common} src="actual-chat-materials" opacity={swing} />
          <Panel3D {...common} src="actual-chat-materials-ready" opacity={swing * filled}>
            <PressButton t={t} at={9.04} src="actual-chat-materials-ready" iw={PAGE.iw} vx={PAGE.vx} vy={vy} x={bx} y={by} w={305} h={45} radius={10} />
          </Panel3D>
        </>;
      })()}
      <Caption t={t} at={1.7} until={4.3} step="STEP 1">정리할 분야를 고르고</Caption>
      <Caption t={t} at={4.9} until={9.5} step="STEP 2">가지고 있는 파일을 넣으면</Caption>
      {/* The paper from the opening lands on the dropzone once STEP 2 has settled. */}
      {[0, 1, 2].map(i => {
        const p = intro(t, 5.1 + i * .35), drop = intro(t, 5.5 + i * .32, 1.2);
        const startX = 210 + i * 520, startY = 470 + (i === 1 ? 110 : -60);
        const [tx, ty] = [PAGE.left + DROP[0] - PAGE.vx, PAGE.top + DROP[1] - 90];
        return <PhysicalDocument key={i} kind={i} x={startX + (tx - startX) * drop} y={startY + (ty - startY) * drop} rotation={(i - 1) * 12 * (1 - drop)} scale={.98 * (1 - drop * .84)} opacity={p * (1 - drop) * (1 - intro(t, 7.5, .45))} />;
      })}
    </>}
    {/* 32-42 — STEP 3 the product's own progress screen, then STEP 4 the result page swept
        end to end, stopping on the numbers and on the three strengths it found. */}
    {scene === 4 && <>
      <rect width="1440" height="810" fill="white" />
      <TypeCard t={t} inAt={.1} outAt={1.05} eyebrow="02 · 기록 속에서 발견하는 나" left="파일이" right="경험이 됩니다."
        object={<PhysicalDocument x={720} y={396} scale={.5} rotation={0} label={false} />} />
      {(() => {
        const p = intro(t, 1, .6), out = intro(t, 2.45, .42);
        if (p <= 0 || out >= 1) return null;
        const zoom = 1 + intro(t, 1.1, 1.7) * .2;
        return <svg width="1440" height="810" opacity={p * (1 - out)}>
          <g transform={`translate(720 291) scale(${zoom}) translate(-720 -291)`}>
            <image href={asset('actual-chat-loading')} y="-66" width="1440" height={4720 * 1440 / 4960} />
          </g>
        </svg>;
      })()}
      <Caption t={t} at={1.3} until={2.6} step="STEP 3">AI가 자료를 읽는 동안</Caption>
      {/* The capture is 4290 wide shown at 1440, so one frame pixel is 2.979 image pixels
          and the scroll below is written in frame pixels. The page is 4633 tall that way. */}
      {(() => {
        const p = intro(t, 2.95, .55);
        if (p <= 0) return null;
        const vy = track(t, [[3.15, 0], [4.6, 0], [5.5, 700], [6.6, 700], [7.5, 1340], [8.5, 1340], [9.2, 2450], [10, 3240]]);
        return <g opacity={p} transform={`translate(0 ${(1 - p) * 58})`}>
          <PageSweep src="actual-experience-full" nw={4290} nh={13803} vy={vy} />
          <Callout t={t} delay={3.7} hold={.9} src="crop-metrics" nw={1700} nh={460} x={250} y={424} w={940} />
          <Callout t={t} delay={5.7} hold={1.05} src="crop-strengths" nw={1060} nh={490} x={560} y={305} w={720} />
          <Callout t={t} delay={7.7} hold={.8} src="crop-results" nw={1170} nh={890} x={640} y={130} w={740} />
        </g>;
      })()}
      <g opacity={intro(t, 3.1, .5) * (1 - intro(t, 9.5, .4))}>
        <rect x="40" y="675" width="428" height="88" rx="16" fill="white" fillOpacity=".96" />
        <Text x={64} y={703} size={17} anchor="start" fill={P.violet}>STEP 4 · 경험 정리</Text>
        <Text x={64} y={742} size={29} anchor="start">역할과 성과가 경험으로</Text>
      </g>
    </>}
    {/* 42-53: the finished work, shown the way the site actually looks. No blobs, no browser
        chrome, no side-by-side shrinking — the page fills the frame and scrolls, and the
        callout lifts out the parts worth reading. */}
    {scene === 5 && <>
      <rect width="1440" height="810" fill="white" />
      {/* Opening beat alone on white: small setup line, oversized punch line. */}
      {(() => {
        const p = intro(t, .05, .6), out = intro(t, 1.5, .45);
        if (out >= 1) return null;
        return <g opacity={p * (1 - out)} transform={`translate(720 405) scale(${1.16 - p * .16 + out * .07}) translate(-720 -405)`}>
          <Text y={348} size={27} fill={P.muted} weight={600}>03 · 정리된 경험을 바탕으로</Text>
          <Text y={462} size={92}>이력서부터 <tspan fill="url(#clay-violet)">포트폴리오</tspan>까지.</Text>
        </g>;
      })()}
      {/* The real resume renderer at full height, with one experience entry lifted out at 2x. */}
      {(() => {
        const p = intro(t, 1.45, .7), out = intro(t, 4.1, .5);
        if (p <= 0 || out >= 1) return null;
        const w = 560, h = w * 3369 / 2382, x = 100, y = 405 - h / 2;
        return <g opacity={p * (1 - out)} transform={`translate(${(1 - p) * 44 - out * 64} 0)`}>
          <rect x={x} y={y} width={w} height={h} rx="7" fill="white" filter="url(#clay-shadow)" />
          <Shot src="actual-resume" nw={2382} nh={3369} x={x} y={y} w={w} h={h} vw={2382} border={false} />
          <Callout t={t} delay={1.85} hold={2.05} src="crop-resume-entry" nw={1120} nh={310} x={680} y={310} w={720} />
        </g>;
      })()}
      {/* /example2 end to end. The capture is 4290 wide, shown at 1440, so one frame pixel is
          2.979 image pixels and the scroll below is written in frame pixels. */}
      {(() => {
        const p = intro(t, 4.15, .7);
        if (p <= 0) return null;
        const vy = track(t, [[4.5, 0], [5.6, 0], [6.6, 800], [8.1, 800], [9.1, 1560], [9.7, 1560], [10.5, 2114], [11, 2114]]);
        return <g opacity={p} transform={`translate(0 ${(1 - p) * 64})`}>
          <PageSweep src="actual-portfolio-full" nw={4290} nh={8712} vy={vy} />
          <Callout t={t} delay={6.7} hold={1.5} src="crop-portfolio-card" nw={950} nh={640} x={660} y={128} w={650} />
        </g>;
      })()}
    </>}
    {scene === 6 && <>
      <Photo src="graduate-relieved" scale={1.01 + t * .002} x={-4} />
      <Arrive t={t} delay={.3}><Text x={101} y={226} size={34} anchor="start" fill="#887b99" weight={500}>나의 경험,</Text><Text x={97} y={318} size={66} anchor="start">이제 <tspan fill={P.violet}>꺼내볼까요?</tspan></Text></Arrive>
      <Arrive t={t} delay={1.2} x={100} y={352}><Logo box={LOGO_LOCKUP} x={0} y={0} w={90} h={117} /></Arrive>
      <Arrive t={t} delay={2}><Text x={104} y={526} size={22} anchor="start" fill={P.violet}>fitpoly.kr</Text></Arrive>
    </>}
    <g opacity=".66"><Logo x={46} y={31} w={28} h={28} /><Text x={82} y={53} size={18} anchor="start">FitPoly</Text><Text x={1387} y={51} size={11} anchor="end" fill="#8c809a" weight={500}>기록이 경험으로, 경험이 기회로.</Text></g>
  </svg>;
}

export default function MotionFilmArt({ time }) {
  const scene = Math.max(0, STARTS.findLastIndex(at => time >= at));
  const elapsed = time - STARTS[scene];
  const dissolve = scene > 1 && elapsed < .7;
  return <div className="motion-art" style={{ position: 'relative' }}>
    {dissolve && <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}><MotionFilmScene time={STARTS[scene] - .001} /></div>}
    <div style={{ position: 'absolute', inset: 0, opacity: dissolve ? ease(elapsed / .7) : 1 }}><MotionFilmScene time={time} /></div>
  </div>;
}
