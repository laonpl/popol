# FitPoly 3D 비주얼 홍보영상

- 화면: `/motion` — 52초 웹 모션그래픽, 무음 자동재생, 선택형 BGM·AI 내레이션·자막.
- 다운로드: 컨트롤 바의 내려받기 버튼이 자막·내레이션 조합을 고르는 패널을 연다. 실제 파일은 `frontend/public/motion/downloads/` 에 미리 구워 두고 `downloads.json` 이 목록이다. 아직 굽지 않은 조합은 필요한 명령을 그대로 보여 준다.
- 아트: `frontend/src/pages/MotionFilmArt.jsx`, 오프닝 7초는 `frontend/src/pages/MotionWorkingScene.jsx`. 오프닝의 모든 타이밍은 `OPENING` 하나에서 나온다. 모든 이동·줌·등장 효과는 재생 시간 하나로 계산한다.
- 플레이어: `frontend/src/pages/MotionFilm.jsx`. 필요한 이미지와 로컬 가변 한글 글꼴을 불러온 뒤 재생을 시작한다.
- 로고: 사이트가 쓰는 `frontend/public/logo.png` 원본을 그대로 넣는다. 파일에 흰 판이 깔려 있어 `logo-key` 필터로 휘도에서 알파를 만들어 배경만 지운다. 심볼만 쓸 때와 워드마크까지 쓸 때의 crop이 `LOGO_MARK` / `LOGO_LOCKUP`.
- 이미지 제작: **built-in image_gen**, CLI/API fallback 미사용. 사용자가 제공한 두 이미지는 스타일 참고용이다.
- 표현 방식: 생성한 3D 이미지에 손목·손가락 레이어 애니메이션, 카메라 이동과 입체 UI를 합성한다. 3D 메시 리깅은 아니다. 캐릭터 원본은 1672×941이므로 4K 출력에도 원본 디테일의 한계가 남는다. 문구·모니터 UI는 벡터, 제품 화면 캡처는 3–6배 해상도다.
- 사운드: `frontend/public/motion/bgm/` 의 BGM 10곡. `scripts/make-bgm.py` 가 전부 합성하므로 외부 라이선스가 없다. 받은 음원으로 바꾸려면 `assets/bgm-source/` 에 넣고 `scripts/import-bgm.py` 를 돌린다. 플레이어와 MP4가 **같은 mp3 파일**을 쓴다.
- 내레이션: `frontend/public/motion/narration/` 의 목소리 6종. 자막을 읽어 주며, 켜면 BGM이 자동으로 물러난다(웹은 볼륨 0.62→0.3, MP4는 `sidechaincompress`). 플레이어의 내레이션 버튼에서 끄기와 목소리 고르기를 함께 한다.
- 자막·내레이션 문구의 유일한 출처는 `frontend/public/motion/film-script.json` 이다. 플레이어와 내레이션 생성 스크립트가 같은 파일을 읽으므로 문구를 고치면 양쪽이 함께 바뀐다.

## 구성

| 시간 | 내용 | 연출 |
| --- | --- | --- |
| 00–07 | 컴퓨터 앞에서 과제·GitHub·Figma 작업을 이어가는 사이 서류가 쌓임 | 양손의 서로 다른 타건 리듬과 짧은 휴지, 화면 크로스페이드, 종이·바인더가 감속하며 착지. 왼쪽에서는 파일 목록이 점점 빠르게 도착해 위로 밀려 올라감 |
| 07–13 | 취업을 앞두고 정리할 일이 막막함 | 얼굴과 서로 겹치지 않는 말풍선 네 개, 마감 D-3 |
| 13–23 | 1단계 경험 선택 · 2단계 자료 입력 | 두 단계 모두 같은 문법으로 끝난다 — 화면이 비스듬히 들어와 정면으로 서고, 카메라가 다음으로 넘어가는 버튼까지 밀고 들어간 뒤 버튼이 스스로 눌린다. 2단계에서는 그 전에 서류가 드롭존으로 떨어진다 |
| 23–33 | 3단계 AI 분석 · 4단계 결과 완성 | 제품의 실제 진행 화면이 프레임을 채운 채 천천히 밀려 들어오고, 이어서 결과 페이지를 한 번에 훑으며 지표 타일·핵심 강점 세 가지·성과 그래프에서 멈춰 확대 |
| 33–44 | 이력서·포트폴리오 | 배경 없이 결과물이 프레임을 채움. 실제 이력서 렌더를 세로로 통째로 놓고 한 경험을 2.4배 콜아웃, 이어서 `/example2` 전체를 위에서 아래로 스크롤하며 섹션마다 멈춤 |
| 44–52 | 다음 기회에 집중 | 같은 캐릭터의 안도하는 표정, 정돈된 책상 |

23–33초와 33–44초는 실제 페이지가 프레임을 채운 채 `track`으로 스크롤하며, 주요 내용에서 멈추고 `Callout`이 해당 영역을 확대한다.

- `Panel3D` — **진짜 원근**. SVG에는 투영 변환이 없어서, 페이지를 `foreignObject` 안에 넣고 CSS 3D를 건다. 선이 실제로 수렴하고, 화면과 MP4 렌더가 같은 Chrome이라 `/motion`에서 보이는 그대로 캡처된다. `bezel`을 주면 기기 프레임이 화면과 함께 돌아간다.
- `TypeCard` — UI 없이 큰 글자만 있는 컷. 문장이 둘로 갈라지고 그 사이로 오브젝트가 지나간다.
- `Blobs` — 뒤에서 흐르는 컬러 필드. 이 구간은 배경을 거의 흰색으로 깔고 색은 블롭이 낸다.
- `Callout` — 제품의 실제 지표·강점·성과 영역을 크게 보여준다. 별도의 DPR 6 캡처와 실제 종횡비를 사용한다. 강점과 이력서 항목은 제품 DOM과 계산된 스타일을 별도 캡처 영역에 복제해 스크롤 위치의 영향을 없앤다.
- 포인터 — `PressButton` 안에 있는 SVG 커서. 13–23초 패널과 원근을 함께 받고, 클릭할 때 링이 퍼진다.
- `track` — 정지 구간이 있는 스크롤. `[시간, 위치]` 쌍 사이를 감속 보간하므로 각 섹션이 읽힐 만큼 멈춘다.

각 장은 타입 컷으로 열고 제품 화면으로 넘어간다. 문구 사이의 서류는 글자를 가리지 않는 크기로 배치한다. 13–23초에는 버튼으로 카메라가 접근하면서 포인터가 들어와 멈춘 뒤 누른다. 장면 사이는 이전 장면과 0.7초 크로스페이드한다.

각 장면에는 `Caption`이 한 줄씩 붙는다 — 카드 없이 눈썹 문구와 문장만 놓아서, 자막을 끄고 봐도 지금 무엇을 하는 중인지 읽힌다.

`PressButton`은 실제 버튼 픽셀을 쓰며, 포인터가 곡선 경로로 접근해 멈춘 뒤 클릭한다. 버튼의 눌림과 클릭 링이 같은 시간에 반응한다. 포인터와 버튼은 `Panel3D` 안에서 같은 원근을 받는다. 버튼 좌표는 `motion-hotspots.json`에 기록되어 있다. 패널 내부를 CSS `zoom:3`으로 그린 뒤 SVG 좌표로 되돌려, 작은 HTML 합성 레이어를 확대하면서 글씨가 뭉개지는 현상을 방지한다.

모니터는 `motionGeometry.js`에서 원본 1672×941 이미지의 유리 경계 네 꼭짓점을 독립적으로 측정한다. 오른쪽 경계는 아래로 갈수록 15.47px 왼쪽으로 기울어져 있어 위아래 X좌표를 같게 두면 베젤을 침범한다. 8개 계수를 푸는 투영 행렬과 원본 좌표의 클리핑 경로를 사용하고, 캐릭터와 화면을 동일한 좌표계로 축소한다. 위쪽 두 모서리만 실제 유리 곡률을 따른다. 화면 내부도 4배로 그려 텍스트 합성 해상도를 확보한다.

`Panel3D`의 `<img>`에는 `max-width:none`이 반드시 있어야 한다. 앱의 preflight가 이미지를 상자 크기로 잘라버리면 페이지가 조용히 축소되어 측정해둔 크롭 좌표가 전부 어긋난다.

`FileTrail`은 7초 동안 문서→GitHub 커밋→Figma 파일 20개를 양쪽으로 쌓는다. 도착 속도는 점차 빨라지며 후반의 최종·최최종 파일 이름을 보라색으로 강조한다. 화면의 작업에 맞춰 “열심히 만들수록,” → “커밋은 쌓이고,” → “최종 다음에, 또 최종.”이라는 큰 문장이 교체되어 자막 없이도 장면의 이유가 읽힌다.

`MotionMaterials.jsx`의 `PaperStack`은 15초 장면의 `graduate-wide.png`에서 종이와 라벤더 바인더를 SVG로 클리핑해 그대로 사용한다. 각 물체는 두께를 유지하며 1.05초 동안 감속해서 내려앉고 0.5초 동안 작게 안착한다. 이미 쌓인 층은 고정된다. 모니터는 네 꼭짓점을 일치시키는 projective `matrix3d`로 맞춘다. 타건·서류·UI·카메라는 모두 master time에서 계산되어 탐색 시 동일하게 재현된다.

`MotionTypingCharacter.jsx`의 손/손가락 clip은 1672×941 원본 좌표다. `graduate-typing.png` 위에 손 주변만 `graduate-typing-clean.png`로 교체하고, 원본 손을 관절 중심 회전과 작은 이동으로 되올린다. 양손의 주파수·위상과 손가락 타이밍은 서로 다르다. 독립적인 CSS animation이나 난수는 쓰지 않는다.

## 실제 제품 캡처

13초 이후에는 실제 제품 화면 캡처를 사용한다. 일반 재생과 MP4 모두 원본 화질을 사용하며 `*-preview.png`는 더 이상 읽지 않는다. 경험정리·포트폴리오 전체 화면은 원본 너비 4290px을 유지한 높이 1536px 타일로 나눈다. `PageSweep`은 화면 주변 타일만 SVG에 올리고 `viewBox`를 이동하므로 긴 캡처를 낮은 해상도의 HTML 레이어로 먼저 그리지 않는다. 확대 영역은 실제 제품을 DPR 6으로 다시 렌더한 `crop-*-hd.png`이며, 단순 업스케일이 아니다. 지표와 강점 영역은 DOM 경계를 측정해 옆 문구가 잘려 들어오지 않게 한다.

전체 캡처는 `backend/scripts/capture-motion-assets.mjs`, 고해상도 확대 영역과 타일은 `backend/scripts/capture-motion-detail.mjs`로 만든다. 후자는 `MOTION_BASE_URL` 환경변수(기본 `http://127.0.0.1:3001`)를 쓰고 GET·HEAD·OPTIONS 외 요청을 차단한다. `page-tiles.json`과 `detail-crops.json`이 실제 크기를 기록한다. 전체 캡처를 갱신했다면 상세 캡처 스크립트도 실행해야 한다.

## 참고한 모션 기법

사용자가 첨부한 예시 이미지의 큰 타이포그래피·전체 화면 UI 구성을 적용했다. 제공된 YouTube 주소는 접근 제한으로 직접 재생해 확인하지 못했다. [Screen Studio](https://screen.studio/)의 포인터 중심 확대, [애니메이션 가이드](https://preview.screen.studio/guide/animations)의 정지 구간, [Material 모션 구성](https://m1.material.io/motion/choreography.html)의 입력과 화면 반응 연결을 참고해 포인터 도착→클릭→전환, 감속 스크롤→읽기 위한 정지→성과 확대 순서로 구성했다. 텍스트가 이동 중 번지는 모션 블러는 사용하지 않는다.

| 파일 | 쓰이는 곳 | 출처 |
| --- | --- | --- |
| `actual-chat-materials.png` / `-ready.png` | 22–32초 노트북 화면 | `ExperienceChat` 자료 입력 전후 (4배, 4960×4720) |
| `actual-experience-top.png` | 참고 캡처 | `ExperienceResult` (id=demo) 상단 (3배) |
| `actual-experience-detail.png` | 참고 캡처 | `ExperienceResult` (id=demo) 경험정리 카드 (3배, 4320×3000) |
| `actual-experience-full.png` | 32–42초 | `ExperienceResult` (id=demo) 전체 페이지 (3배, 4290×13803) |
| `actual-chat-select.png` | 22–26초 | `ExperienceChat` 1/4단계 경험 선택 (4배, 4960×4720) |
| `actual-chat-loading.png` | 32–35초 | `ExperienceChat` 분석 중 화면. 분석 POST를 가로채 응답하지 않은 채 찍으므로 AI는 호출되지 않는다 |
| `actual-resume.png` | 42–53초 | `resumePdfService.buildResumeHtml(PORTFOLIO_EXAMPLES.example2)` |
| `actual-portfolio-top.png` | 참고 캡처 | `/example2` 첫 화면 |
| `actual-portfolio-full.png` | 42–53초 | `/example2` 전체 페이지 (3배, 4290×8712). 페이지가 스크롤 진입 시 나타나므로, 끝까지 훑어 리빌을 발동시킨 뒤 `fullPage`로 찍는다 |

캡처 스크립트는 `prefers-color-scheme: light`를 강제한다. 이력서 HTML은 body 배경을 지정하지 않아서, 이 설정이 없으면 headless Chrome이 어두운 배경으로 그려 글자가 보이지 않는다.

## 이미지 파일과 최종 프롬프트

아래 프롬프트는 built-in 도구에 전달한 최종 프롬프트다. 생성본을 수정하지 않고 프로젝트에 복사했다.

### graduate-rear.png

기존 뒷모습 컷으로, 수정한 타자 자세의 참조 원본이다. 현재 오프닝에는 `graduate-typing.png`를 쓴다. 수정 프롬프트는 [motion-quality-prompts.md](motion-quality-prompts.md)에 기록했다.

### graduate-close.png

현재 장면에서는 쓰지 않는다. 오프닝을 뒷모습 컷으로 바꾸면서 빠졌고, 파일은 참고용으로 남겨둔다.

Use case: stylized-concept. Create ONE polished 16:9 widescreen 3D animated advertising film still, based on the soft rounded 3D character design, matte materials and pale lavender studio lighting in the two attached reference images. These are STYLE REFERENCES, not edit targets. New original young Korean male university graduate, dark wavy sculpted hair, ivory casual collared shirt over lavender tee, expressive brown eyes, seated at a pale desk with silver laptop, looking worried with one hand under chin. Tall irregular stacks of university papers, pastel binders, project printouts flank him. Close-medium cinematic composition: character and desk occupy RIGHT TWO THIRDS, LEFT THIRD is clean pale lavender negative space for typography added later in code. Character head fully visible, papers not obscuring face. Soft ivory and lavender background, realistic soft contact shadows, warm skin subsurface scattering, tactile claylike premium 3D, refined fabric and hair detail, gentle studio depth of field, matching visual quality of references. Laptop has no logo, paper has only subtle abstract marks. No text, no watermark, no speech bubbles, no border, not a collage. This asset will be animated with camera movement and floating UI for a 60-second career portfolio service film.

### graduate-wide.png

Use case: stylized-concept. Create the NEXT cinematic film shot featuring EXACTLY the same original 3D young Korean graduate character, hair, face, ivory overshirt and lavender tee, same studio materials and soft lavender lighting as the input image. This is a supporting CHARACTER AND STYLE REFERENCE. WIDE shot, camera pulled far back: character centered at x50%, seated behind silver laptop on pale desk; concerned hand-under-chin expression; stacks of papers and cream/lavender binders flanking laptop on both sides, pen holder and mug. Entire desk vignette occupies the LOWER 55% of frame, with desk bottom near 90% and head near 48%. Upper 43% is completely empty pale lavender-white seamless studio background, reserved for several animated thought bubbles added later in code. Symmetrical balanced wide composition, full desk width only 65% of image, gentle contact shadows, high quality soft rounded detailed 3D commercial animation aesthetic. Render ONE 16:9 widescreen image. No bubbles, no text, no labels, no watermark, no border, no collage. Preserve character identity precisely.

### graduate-relieved.png

Use case: stylized-concept. NEXT SHOT of same 3D advertising film. Match EXACT same original young Korean male graduate character, sculpted dark wavy hair, face proportions, ivory overshirt and lavender t-shirt from reference. Now he feels RELIEVED AND CONFIDENT, soft genuine smile, relaxed eyebrows, both hands resting naturally on desk beside a silver laptop. The desk is now tidy: one neatly stacked lavender binder, small lavender mug, simple pen. No piles of paper. Character and laptop occupy RIGHT 55% of frame. LEFT 45% is clear pale lavender-white empty space reserved for large final brand copy. Mid-shot head to waist, head fully visible, beautifully composed 16:9 premium 3D animated film still, soft warm studio lighting, subtle pastel lavender gradient cyclorama, tactile matte materials, rounded forms, detailed hair, warm soft skin, gentle shallow depth of field. No text, no logo, no watermarks, no speech bubbles, no borders, no collage. This is the happy resolution scene after his portfolio has been organized.

## 사운드 — BGM 10곡과 AI 내레이션

```sh
pip install numpy imageio-ffmpeg
python scripts/make-bgm.py          # frontend/public/motion/bgm/*.mp3 + bgm.json
python scripts/make-narration.py    # frontend/public/motion/narration/narration.mp3 + .json
```

`make-bgm.py`는 오실레이터·엔벨로프·탭 리버브만으로 20곡을 직접 합성한다. 곡마다 코드 진행과 악기 구성이 다르고, 곡을 고치려면 `SCORES` 의 해당 함수만 손대면 된다. 목록은 세 묶음으로 나뉘어 플레이어에도 그 순서로 보인다.

**서비스 소개 영상** — 이 필름에 가장 잘 맞는 톤

| id | 제목 | 성격 |
| --- | --- | --- |
| `corporate-uplift` | 코퍼레이트 업라이트 | 밝은 플럭과 피아노, 회사 소개의 표준 |
| `clean-tech` | 클린 테크 인트로 | 미니멀 아르페지오, 제품 투어·SaaS 데모 |
| `infographic-pizz` | 인포그래픽 피치카토 | 스타카토 현과 손뼉, 설명 영상의 기본값 |
| `brand-story` | 브랜드 스토리 피아노 | 피아노로 시작해 스트링이 차오름 |
| `launch-day` | 런치 데이 팝 | 손뼉과 코드 스탭, 런칭·발표 |

**많이 쓰는 장르**

| id | 제목 | 성격 |
| --- | --- | --- |
| `lofi-study` | 로파이 스터디 | 스윙 비트와 노이즈 |
| `calm-piano` | 잔잔한 피아노 | 내레이션을 가장 적게 가린다 |
| `soft-ambient` | 소프트 앰비언트 | 리듬 없는 패드 |
| `bright-pop` | 밝은 신스팝 | 가벼운 4비트와 플럭 리드 |
| `warm-acoustic` | 따뜻한 어쿠스틱 | 핑거피킹 기타 |
| `hopeful-build` | 희망의 빌드업 | 12·26·40초에 악기가 늘어 영상 전개를 따라간다 |
| `cinematic-rise` | 시네마틱 상승 | 드론과 스트링, 44초에 크게 열림 |
| `playful-marimba` | 경쾌한 마림바 | **기본값.** 가볍고 빠름 |
| `minimal-tech` | 미니멀 테크 | 16비트 펄스 |
| `night-chill` | 나이트 칠 | 낮은 베이스와 로즈 |

**요즘 유행** — 숏폼에서 실제로 번지고 있는 장르

| id | 제목 | 성격 |
| --- | --- | --- |
| `drift-phonk` | 드리프트 펑크 | 808 카우벨과 눌린 베이스 |
| `amapiano` | 아마피아노 | 로그드럼과 셰이커 |
| `jersey-club` | 저지 클럽 | 다섯 번 튀는 특유의 킥 패턴 |
| `hyper-plugg` | 하이퍼팝 플럭 | 디튠된 밝은 플럭과 종소리 |
| `dream-bedroom` | 드림 베드룸팝 | 리버브에 잠긴 기타 |

### 음량 맞추기

곡을 바꿔도 볼륨이 튀지 않아야 해서 `scripts/audio_loudness.py` 가 전부 **−16 LUFS · true peak −1.5 dBTP** 로 인코딩한다. 피크나 RMS로 맞추면 안 된다 — 패드처럼 이어지는 곡과 저지 클럽처럼 때리는 곡은 같은 RMS에서도 체감 음량이 몇 LU씩 벌어진다.

라우드니스 정규화만으로도 부족하다. 피크가 천장에 닿으면 더 못 올리기 때문에, 타악기가 성긴 곡(피치카토·손뼉·저지 클럽 킥)은 목표보다 한참 아래에서 멈춘다. 그래서 앞단에 컴프레서(`4:1`, threshold `0.03`)를 둬서 크레스트 팩터를 먼저 낮춘다. 실측으로 편차가 **5.6 LU → 1.8 LU** 로 줄었고 클리핑도 사라졌다.

같은 함수를 `import-bgm.py` 도 쓰므로 받아온 음원이 합성곡과 같은 음량으로 들어온다.

### 받은 음원으로 바꾸기

```sh
# assets/bgm-source/ 에 mp3·wav·m4a·flac 을 넣고
python scripts/import-bgm.py             # 가져온 곡을 목록 맨 위로
python scripts/import-bgm.py --replace   # 합성 10곡을 지우고 가져온 곡만 남김
python scripts/bake-film-variants.py     # 다운로드용 MP4 에도 반영
```

`import-bgm.py` 는 곡에서 가장 에너지가 높은 52초 구간을 잘라 앞뒤 페이드를 넣고, 합성곡과 같은 −17 dBFS 로 맞춘 뒤 `bgm.json` 에 등록한다. 제목·설명·크레딧·시작 위치를 직접 정하려면 `assets/bgm-source/tracks.json` 에 파일명을 키로 적는다. `credit` 을 넣으면 플레이어 BGM 목록에 표시된다 — **CC BY 처럼 표기가 필요한 라이선스면 반드시 채운다.**

유튜브에서 유행하는 곡은 대부분 저작권이 있어 홍보 영상에 쓸 수 없다. 상업적 사용이 명시적으로 허용된 음원만 넣는다.

`make-narration.py`는 `film-script.json` 의 `narration` 문장을 챕터 시각에 하나씩 얹는다. `caption` 과 따로 두는 이유는 세 가지다 — 읽는 문장은 더 짧아야 하고(0초·4초 챕터는 간격이 3~4초뿐이다), "FitPoly"를 "핏폴리"로 적어야 제대로 읽으며, 무엇보다 **자막은 장면을 설명하고 내레이션은 보는 사람에게 말을 건다**. 화면의 자막을 소리내어 반복하면 지루해진다.

내레이션만 고치는 한 자막 픽셀은 바뀌지 않으므로 영상 마스터를 다시 렌더할 필요가 없다. `make-narration.py` → `bake-film-variants.py` 두 번이면 끝난다.

한 번 실행하면 `VOICES` 에 적힌 목소리를 전부 굽고 `narration.json` 에 목록을 남긴다. 하나만 다시 만들려면 `--only`.

| id | 이름 | 성격 | 엔진 음성 |
| --- | --- | --- | --- |
| `sunhi` | 선히 | 여성 · 또렷한 아나운서 톤 | `ko-KR-SunHiNeural` |
| `injoon` | 인준 | 남성 · 차분하고 낮은 톤 | `ko-KR-InJoonNeural` |
| `hyunsu` | 현수 | 남성 · 부드러운 최신 모델 | `ko-KR-HyunsuMultilingualNeural` |
| `ava` | 에이바 | **기본값.** 여성 · 표현이 살아 있는 다국어 모델 | `en-US-AvaMultilingualNeural` |
| `andrew` | 앤드루 | 남성 · 따뜻하고 단단한 다국어 모델 | `en-US-AndrewMultilingualNeural` |
| `emma` | 엠마 | 여성 · 밝고 대화하듯 읽는 톤 | `en-US-EmmaMultilingualNeural` |

`en-US-*Multilingual` 계열은 한국어도 읽는 최신 모델이라 한국어 전용 음성과 톤이 꽤 다르다. 실측 속도는 전부 4.7~5.1음절/초로 비슷하다.

### 기계음처럼 들리지 않게 하는 두 가지

**문장 양끝 무음을 잘라낸다.** 합성 결과에는 앞뒤로 0.3~0.5초의 여백이 붙어 오는데, 이게 챕터 길이에 그대로 잡히면서 짧은 챕터(0초·4초)의 문장이 계속 타임 스트레치됐다. 무음을 걷어내니 6종 중 5종은 압축이 **전혀** 필요 없어졌고, 남은 하나도 1.02배다. 이전에는 1.13배가 걸려 있었다 — 페이즈 보코더가 음성에 금속성을 입히는 구간이다.

**타임 스트레치 상한은 1.08.** 그보다 더 필요하면 압축하지 않고 "문장을 줄이라"고 경고한다. 문구를 고치는 게 늘 더 낫다.

엔진은 세 가지다.

- `--engine edge` (기본) — Microsoft Edge 읽어주기. API 키가 필요 없고 네트워크만 있으면 된다.
- `--engine sapi` — Windows `System.Speech`. 오프라인이지만 기계적이라 대체용이다. `--rate` 는 -10~10.
- `--engine gemini` — `GEMINI_API_KEY` 가 `generativelanguage.googleapis.com` 을 쓸 수 있어야 한다. 현재 키는 Vertex 전용이고 해당 프로젝트에 결제가 꺼져 있어 403이 난다.

```sh
pip install edge-tts
python scripts/make-narration.py                 # 6종 전부
python scripts/make-narration.py --only injoon   # 하나만 다시
```

## MP4 다시 만들기

영상에서 바뀌는 것은 **자막뿐**이다. BGM과 내레이션은 오디오라서, 무음 마스터를 한 번 렌더해 두면 나머지 조합은 비디오 스트림을 복사만 해서 몇 초 만에 만든다.

```sh
# 1. 무음 마스터 (자막 유무마다 한 번씩) — build/motion-masters/ 에 저장, git 제외
python scripts/render-motion.py --url http://127.0.0.1:3001 --captions on  --workers 3 --lossless-frames
python scripts/render-motion.py --url http://127.0.0.1:3001 --captions off --workers 3 --lossless-frames

# 2. 다운로드용 조합 굽기 — frontend/public/motion/downloads/
python scripts/bake-film-variants.py                    # 기본 BGM · 기본 목소리로 4개
python scripts/bake-film-variants.py --bgm lofi-study   # 다른 곡으로
python scripts/bake-film-variants.py --voice injoon     # 다른 목소리로
python scripts/bake-film-variants.py --all-bgm          # 20곡 × 4 = 80개 (용량 주의)
```

`render-motion.py`는 `/motion?render=1&capture=1&cc=1|0`에서 프레임 범위를 세 프로세스에 나눠 렌더링한 뒤 재인코딩 없이 연결한다. H.264 CRF 16, BT.709, 60fps, 중간 프레임 JPEG quality 100. 무손실 PNG 중간 프레임이 필요하면 `--lossless-frames`. 전체 성공 후에만 마스터를 원자적으로 교체한다. **장면 코드나 문구를 바꾼 후에는 마스터를 다시 렌더해야 한다.**

`bake-film-variants.py`는 `-c:v copy` 라 화질 손실이 없다. 내레이션이 들어가는 조합은 BGM을 `sidechaincompress` 로 눌러 목소리가 항상 위에 오게 섞고 `alimiter` 로 마무리한다. 만든 목록은 `downloads/downloads.json` 에 적히고 플레이어가 그대로 읽는다 — 없는 조합은 버튼 대신 실행할 명령을 보여 준다.

자막 없는 마스터가 아직 없으면 `film-cc.mp4` 는 기존 `fitpoly-3d-film.mp4` 에서 오디오만 떼어 자동으로 만든다. 그래서 렌더를 돌리기 전에도 자막 있는 두 조합은 바로 받을 수 있다.

글꼴은 `frontend/public/motion/fonts/PretendardVariable.woff2`, 라이선스는 같은 폴더의 `LICENSE.txt`다. 자막 크기는 영상 너비에 비례한다. 렌더 모드는 스크롤바 공간을 제거해 정확한 16:9 프레임을 채운다.
