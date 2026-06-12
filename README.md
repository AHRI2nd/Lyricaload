# Lyricaload

**로컬 `.lrc` 파일을 현재 재생 중인 곡의 가사로 표시하는 [ivLyrics](https://github.com/ivLis-Studio/ivLyrics) 가사 제공자 애드온**
*A local `.lrc` lyrics provider addon for [ivLyrics](https://github.com/ivLis-Studio/ivLyrics).*

---

There is an English introduction at the bottom of this page.

---

## 소개

로컬 `.lrc` 파일을 가사로 띄웁니다.
**파일을 직접 고르는 수동 방식**과, **폴더를 지정해 곡이 바뀔 때마다 자동으로 찾아주는 방식**을 모두 지원합니다.

### 주요 기능

- 🎵 **수동 불러오기** — 재생 중인 곡에 `.lrc` 파일을 직접 적용
- 📁 **폴더 자동 매칭** — 폴더를 한 번 지정하면 곡이 바뀔 때마다 `아티스트--제목.lrc`를 자동으로 찾아 적용
- 💾 **자동 복원** — 곡별로 저장되어, 그 곡으로 돌아오면 다시 표시

### 사용법

1. ivLyrics **설정 → 가사 제공자**에서 **Lyricaload를 목록 맨 위로** 올립니다.
   > 위에 있는 제공자부터 먼저 시도하므로, 맨 위에 둬야 로컬 가사가 우선 적용됩니다.
2. **Lyricaload 카드를 펼쳐** 설정 UI를 엽니다.
3. 원하는 방식으로 가사를 불러옵니다.

**① 수동으로 한 곡씩**
- 곡을 재생한 상태에서 **`현재 곡 .lrc 불러오기`** 클릭 → `.lrc` 파일 선택 → 즉시 적용됩니다.

**② 폴더로 자동 매칭**
- **`.lrc 폴더 지정하기`** 클릭 → `.lrc` 파일들이 들어있는 폴더 선택.
- 이후 곡이 바뀔 때마다 폴더에서 파일명이 일치하는 가사를 **자동으로** 찾아 표시합니다.

### 파일명 규칙

매칭은 공백·대소문자·구분자를 무시하는 **느슨한 방식**이라 아래 형식이 모두 동작합니다.

| 예시 | 매칭 |
|---|---|
| `아티스트--제목.lrc` | ✅ 정확 매칭 (권장) |
| `아티스트 - 제목.lrc` | ✅ 느슨한 매칭 |
| `아티스트 제목.lrc` | ✅ 느슨한 매칭 |
| `제목.lrc` (제목만) | ✅ 느슨한 매칭 (동일/유사 제목 및 아티스트와 혼동될 수 있음) |

> **권장: `아티스트--제목.lrc`** — `--` 구분자가 있으면 아티스트·제목을 정확히 구별합니다.
> 여러 파일이 느슨하게 일치할 때는 **`--`로 정확히 구분된 파일을 우선** 적용하므로, 혼동을 막을 수 있습니다.

### 📌 LRC 파일이 없다면 — Lyrical Sync 추천

동기화된 `.lrc` 파일을 직접 만들고 싶다면, **[Lyrical Sync](https://github.com/AHRI2nd/Lyrical-Sync)** 사용을 추천합니다.

### 설치

ivLyrics **마켓플레이스**에서 `Lyricaload`를 검색해 설치합니다.

> 코드 업데이트 후 동작이 안 바뀌면, 마켓플레이스에서 **제거 → Spotify 재시작 → 재설치 → 재시작** 하세요.

---

## English

Show your own `.lrc` files as lyrics for songs.
Supports both **manually picking a file** and **auto-matching from a folder** on every track change.

### Features

- 🎵 **Manual load** — apply a `.lrc` file to the currently playing track
- 📁 **Folder auto-match** — set a folder once; it finds `Artist--Title.lrc` automatically as tracks change
- 💾 **Auto restore** — cached per track, so it reappears when you return to that song

### How to use

1. In ivLyrics **Settings → Lyrics Providers**, move **Lyricaload to the top** of the list.
   > Providers are tried top-down, so it must be first for local lyrics to win.
2. **Expand the Lyricaload card** to open its settings UI.
3. Load lyrics either way:

**① Manually, one track at a time**
- With a song playing, click **`Load .lrc for current track`** → pick a `.lrc` file → applied instantly.

**② Automatically from a folder**
- Click **`Set .lrc folder`** → choose a folder containing `.lrc` files.
- From then on, matching lyrics are found **automatically** whenever the track changes.

### Filename rule

Matching is **loose** — it ignores spaces, case, and separators — so all of these work:

| Example | Match |
|---|---|
| `Artist--Title.lrc` | ✅ exact (recommended) |
| `Artist - Title.lrc` | ✅ loose |
| `artist title.lrc` | ✅ loose |
| `Title.lrc` (title only) | ✅ loose (may collide with same/similar songs) |

> **Recommended: `Artist--Title.lrc`** — the `--` separator distinguishes artist and title precisely.
> When several files match loosely, the one separated by `--` is **preferred**, avoiding same-title collisions.

### 📌 No LRC files yet? Try Lyrical Sync

To create synced `.lrc` files yourself, recommend to use **[Lyrical Sync](https://github.com/AHRI2nd/Lyrical-Sync)**

### Install

Search for `Lyricaload` in the ivLyrics **Marketplace** and install.

> If behavior doesn't change after an update, **Uninstall → restart Spotify → Install → restart** from the Marketplace.

---