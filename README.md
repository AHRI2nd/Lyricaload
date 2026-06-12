# Lyricaload

A lyrics-type addon for [ivLyrics](https://github.com/ivLis-Studio/ivLyrics) that loads
**local `.lrc` files** as synced lyrics for the currently playing track.

> Pure JavaScript, single file, no build step. Built on the official ivLyrics
> `LyricsAddonManager` SDK. Distributable via the ivLyrics Marketplace
> (`ivlyrics-addon` GitHub topic + `manifest.json`).

---

## English

### What it does

- Adds an **`LRC` button** to the lyrics panel.
- Click it → pick a local `.lrc` file → the lyrics are parsed and shown immediately for the current track.
- The result is cached per track (`trackId`), so it restores automatically when you return to that song.
- If no local lyrics exist for a track, Lyricaload returns nothing and ivLyrics **falls back** to its other providers (Spotify, lrclib, …).

### LRC parsing

- `[MM:SS.xxx]` / `[MM:SS,xxx]`, millisecond normalization (`xx → xx0`, `x → x00`)
- Multiple timestamps on a single line
- `[offset:N]` tag applied to all timestamps
- Metadata tags (`[ar:]`, `[ti:]`, `[al:]`, …) ignored

### Installation

**A. ivLyrics Marketplace (recommended)**

1. Host this repository as a **public** GitHub repo.
2. Add the GitHub topic **`ivlyrics-addon`**.
3. Keep `manifest.json` in the repo root and point its `downloadUrl` to the raw `Addon_Lyrics_Local.js`.
4. In ivLyrics, open **Marketplace** → Refresh → search `Lyricaload` → **Install**.

> Installed addons are stored in IndexedDB (`ivLyrics_marketplace`) and auto-loaded on startup.

**B. Spicetify extension (local testing, no GitHub)**

```bash
cp Addon_Lyrics_Local.js ~/.config/spicetify/Extensions/
spicetify config extensions Addon_Lyrics_Local.js
spicetify apply
```

The script self-registers with `LyricsAddonManager` at startup. To remove later:
`spicetify config extensions Addon_Lyrics_Local.js-` then `spicetify apply`.

### Architecture

Platform-independent **core** (parser / cache / file picker / button UI) is separated from
platform-specific **adapters**. Only the ivLyrics adapter is active now; a Spicetify
(Lyrics Plus) adapter can be added later without touching the core.

| Layer | Responsibility |
|---|---|
| Core | `parseLRC`, cache, `openFilePicker`, track id, button UI |
| Adapter | `name`, `isAvailable()`, `init()`, `applyLyrics(trackId, parsed)` |

### Status

- **Phase 1 — manual selection + cache:** done
- **Phase 2 — folder auto-matching** (settings UI + local static server): planned
- **Phase 3 — sync offset / saved-list management / translation lines:** future

---

## 한국어

### 기능

- 가사 패널에 **`LRC` 버튼**을 추가합니다.
- 클릭 → 로컬 `.lrc` 파일 선택 → 현재 곡의 동기화 가사로 즉시 표시됩니다.
- 트랙(`trackId`) 단위로 캐시되어, 해당 곡으로 돌아오면 자동 복원됩니다.
- 로컬 가사가 없으면 아무것도 반환하지 않아, ivLyrics가 다른 프로바이더(Spotify·lrclib 등)로 **폴백**합니다.

### LRC 파싱

- `[MM:SS.xxx]` / `[MM:SS,xxx]`, 밀리초 정규화(`xx → xx0`, `x → x00`)
- 한 줄 다중 타임스탬프 지원
- `[offset:N]` 태그를 전체 타임스탬프에 가산
- 메타 태그(`[ar:]`, `[ti:]`, `[al:]` 등) 무시

### 설치

**A. ivLyrics 마켓플레이스 (권장)**

1. 이 저장소를 **공개** GitHub 저장소로 호스팅합니다.
2. GitHub 토픽 **`ivlyrics-addon`**을 추가합니다.
3. `manifest.json`을 저장소 루트에 두고 `downloadUrl`이 raw `Addon_Lyrics_Local.js`를 가리키게 합니다.
4. ivLyrics에서 **Marketplace** 열기 → 새로고침 → `Lyricaload` 검색 → **Install**.

> 설치된 애드온은 IndexedDB(`ivLyrics_marketplace`)에 저장되어 시작 시 자동 로드됩니다.

**B. Spicetify 확장 (로컬 테스트, GitHub 불필요)**

```bash
cp Addon_Lyrics_Local.js ~/.config/spicetify/Extensions/
spicetify config extensions Addon_Lyrics_Local.js
spicetify apply
```

스크립트가 시작 시 `LyricsAddonManager`에 스스로 등록됩니다. 제거하려면:
`spicetify config extensions Addon_Lyrics_Local.js-` 후 `spicetify apply`.

> macOS/Linux는 DevTools 단축키 버그가 있어 콘솔 붙여넣기 대신 이 방식이나 마켓플레이스로 검증하세요.

### 아키텍처

플랫폼 비의존 **코어**(파서·캐시·파일선택·버튼 UI)와 플랫폼 의존 **어댑터**를 분리했습니다.
현재는 ivLyrics 어댑터만 활성이며, Spicetify(Lyrics Plus) 어댑터는 코어 수정 없이 추가할 수 있습니다.

| 계층 | 역할 |
|---|---|
| 코어 | `parseLRC`, 캐시, `openFilePicker`, 트랙 식별, 버튼 UI |
| 어댑터 | `name`, `isAvailable()`, `init()`, `applyLyrics(trackId, parsed)` |

### 진행 상황

- **Phase 1 — 수동 선택 + 캐시:** 완료
- **Phase 2 — 폴더 자동 매칭**(설정 UI + 로컬 정적 서버): 예정
- **Phase 3 — 싱크 오프셋 / 저장 목록 관리 / 번역줄:** 미래

---

## License

MIT
