# 여기에 받은 음원을 넣으세요

mp3 · wav · m4a · flac · ogg 아무거나 넣고:

```sh
python scripts/import-bgm.py            # 가져온 곡이 목록 맨 위로
python scripts/import-bgm.py --replace  # 합성 20곡을 지우고 가져온 곡만
python scripts/bake-film-variants.py    # 다운로드용 MP4 에도 반영
```

스크립트가 알아서 합니다 — 가장 좋은 52초 구간을 잘라내고, 앞뒤 페이드를 넣고,
나머지 곡과 같은 −17 dBFS 로 음량을 맞추고, 플레이어 목록에 등록합니다.

## tracks.json (선택)

제목·설명·크레딧·시작 위치를 직접 정하고 싶을 때만 씁니다. 없으면 파일의
ID3 태그와 파일명에서 가져옵니다.

```json
{
  "받은파일이름.mp3": {
    "title": "목록에 보일 제목",
    "note": "한 줄 설명",
    "credit": "Artist / source.com — CC BY 4.0",
    "start": 32
  }
}
```

`credit` 을 적으면 플레이어의 BGM 목록에 그대로 표시됩니다. **CC BY 처럼 표기가
필요한 라이선스는 반드시 채워 넣으세요** — 영상에 크레딧을 빠뜨리면 라이선스 위반입니다.

## 라이선스 주의

유튜브에서 유행하는 곡 대부분은 저작권이 있어 홍보 영상에 쓸 수 없습니다.
상업적 사용이 명시적으로 허용된 음원만 넣으세요.
