// Lyricaload — ivLyrics Local LRC Addon
// 로컬 .lrc 파일을 현재 재생 곡의 가사로 표시하는 애드온.
// 빌드 없음, 순수 JS 단일 파일. ivLyrics LyricsAddonManager 규격을 따른다.
//
// 구조: [공통 코어]는 플랫폼 비의존(파서/캐시/파일선택/버튼 UI),
//       [어댑터]만 플랫폼 의존(등록/가사 제공/강제 새로고침).
//       현재는 ivLyrics 어댑터만 활성. 추후 Spicetify(Lyrics Plus) 어댑터 추가 가능.

(function Lyricaload() {
    "use strict";

    const ADDON_ID = "local-lrc";
    const ADDON_VERSION = "0.1.3-dev";
    const CACHE_KEY = "lyricaload:local-lrc"; // { [trackId]: { synced, unsynced } }  (수동 로드)
    const FOLDER_KEY = "lyricaload:lrc-folder"; // { name, count, files: { [normKey]: { synced, unsynced } } }
    const LOG_PREFIX = "[Lyricaload]";

    function log(...args) {
        console.log(LOG_PREFIX, ...args);
    }

    function notify(msg) {
        try { Spicetify?.showNotification?.(`${LOG_PREFIX} ${msg}`); } catch { /* 무시 */ }
    }

    // ─── i18n — ivLyrics 표시 언어(ko/en)에 맞춰 UI 문자열 분기 ────────────────

    // ivLyrics는 언어를 I18n.getCurrentLanguage() 또는 localStorage에 저장한다.
    function uiLang() {
        let l = "";
        try { l = window.I18n?.getCurrentLanguage?.() || ""; } catch { /* 무시 */ }
        if (!l) l = storageGet("ivLyrics:visual:language") || "";
        l = String(l).replace(/['"]/g, "").trim().toLowerCase();
        if (!l) { try { l = (navigator?.language || "en").toLowerCase(); } catch { l = "en"; } }
        if (l.startsWith("ko")) return "ko";
        if (l.startsWith("ja")) return "ja";
        return "en"; // ko/ja 외에는 영어로 폴백
    }

    const STR = {
        ko: {
            noTrack: "재생 중인 트랙 없음",
            noTrackPlaying: "재생 중인 트랙이 없습니다.",
            invalidLrc: "유효한 LRC 내용을 찾을 수 없습니다.",
            loaded: (n, reloaded) => `${n}줄 로드 완료${reloaded ? "" : " (가사 패널을 다시 열면 반영)"}`,
            folderReading: "폴더 읽는 중…",
            folderTooBig: "폴더가 너무 커서 저장에 실패했습니다. 더 작은 폴더를 사용하세요.",
            folderSet: (name, count, scanned) => `폴더 "${name}" 등록 — .lrc ${count}개 (스캔 ${scanned}개)`,
            folderUnset: "폴더 지정을 해제했습니다.",
            clearedCurrent: "현재 곡의 수동 LRC를 삭제했습니다.",
            clearedAll: "저장된 모든 수동 LRC를 삭제했습니다.",
            srcManual: "● 수동 LRC",
            srcFolder: "● 폴더 매칭",
            srcNone: "○ 없음",
            curSong: "현재 곡: ",
            manualDesc: "재생 중인 곡에 로컬 .lrc 파일을 직접 불러옵니다. 곡별로 저장되어 자동 복원됩니다.",
            btnLoad: "현재 곡 .lrc 불러오기",
            btnRefresh: "새로고침",
            btnClearCurrent: "현재 곡 삭제",
            btnClearAll: "수동 전체 삭제",
            folderDesc: "폴더를 지정하면 곡이 바뀔 때마다 \"아티스트--제목.lrc\" 형식의 파일을 자동으로 찾아 적용합니다. 이 가사 제공자를 목록 맨 위로 올려야 다른 제공자보다 먼저 적용됩니다.",
            folderLabel: "지정 폴더: ",
            folderNone: "지정 안 됨",
            folderInfo: (name, count) => `${name} (.lrc ${count}개)`,
            btnPickFolder: ".lrc 폴더 지정하기",
            btnUnsetFolder: "폴더 해제",
            noPlatform: "호환 가능한 가사 플랫폼을 찾지 못했습니다.",
            playbarTitle: "Lyricaload: 로컬 .lrc 불러오기",
            playbarTitleLoaded: "Lyricaload: 로컬 LRC 저장됨 (클릭하면 교체)",
            btnTitle: "로컬 .lrc 파일 불러오기",
            btnTitleLoaded: "로컬 LRC 저장됨 (클릭하면 교체)",
        },
        en: {
            noTrack: "No track playing",
            noTrackPlaying: "No track is playing.",
            invalidLrc: "No valid LRC content found.",
            loaded: (n, reloaded) => `Loaded ${n} line${n === 1 ? "" : "s"}${reloaded ? "" : " (reopen the lyrics panel to apply)"}`,
            folderReading: "Reading folder…",
            folderTooBig: "Folder too large to save. Please use a smaller folder.",
            folderSet: (name, count, scanned) => `Folder "${name}" registered — ${count} .lrc file${count === 1 ? "" : "s"} (scanned ${scanned})`,
            folderUnset: "Folder unset.",
            clearedCurrent: "Removed the manual LRC for the current track.",
            clearedAll: "Removed all saved manual LRC.",
            srcManual: "● Manual LRC",
            srcFolder: "● Folder match",
            srcNone: "○ None",
            curSong: "Current track: ",
            manualDesc: "Load a local .lrc file onto the playing track. Saved per track and restored automatically.",
            btnLoad: "Load .lrc for current track",
            btnRefresh: "Refresh",
            btnClearCurrent: "Remove current",
            btnClearAll: "Clear all manual",
            folderDesc: "Set a folder and matching \"Artist--Title.lrc\" files are applied automatically on every track change. Move this provider to the top of the list so it takes precedence over others.",
            folderLabel: "Folder: ",
            folderNone: "Not set",
            folderInfo: (name, count) => `${name} (${count} .lrc file${count === 1 ? "" : "s"})`,
            btnPickFolder: "Set .lrc folder",
            btnUnsetFolder: "Unset folder",
            noPlatform: "No compatible lyrics platform found.",
            playbarTitle: "Lyricaload: load local .lrc",
            playbarTitleLoaded: "Lyricaload: local LRC saved (click to replace)",
            btnTitle: "Load local .lrc file",
            btnTitleLoaded: "Local LRC saved (click to replace)",
        },
        ja: {
            noTrack: "再生中のトラックなし",
            noTrackPlaying: "再生中のトラックがありません。",
            invalidLrc: "有効なLRCの内容が見つかりません。",
            loaded: (n, reloaded) => `${n}行を読み込みました${reloaded ? "" : "（歌詞パネルを開き直すと反映されます）"}`,
            folderReading: "フォルダを読み込み中…",
            folderTooBig: "フォルダが大きすぎて保存できませんでした。より小さいフォルダを使用してください。",
            folderSet: (name, count, scanned) => `フォルダ「${name}」を登録 — .lrc ${count}件（スキャン ${scanned}件）`,
            folderUnset: "フォルダ指定を解除しました。",
            clearedCurrent: "現在の曲の手動LRCを削除しました。",
            clearedAll: "保存された手動LRCをすべて削除しました。",
            srcManual: "● 手動LRC",
            srcFolder: "● フォルダ一致",
            srcNone: "○ なし",
            curSong: "現在の曲: ",
            manualDesc: "再生中の曲にローカル.lrcファイルを直接読み込みます。曲ごとに保存され、自動的に復元されます。",
            btnLoad: "現在の曲に.lrcを読み込む",
            btnRefresh: "更新",
            btnClearCurrent: "現在の曲を削除",
            btnClearAll: "手動をすべて削除",
            folderDesc: "フォルダを指定すると、曲が変わるたびに「アーティスト--タイトル.lrc」形式のファイルを自動的に探して適用します。この歌詞プロバイダーをリストの最上部に移動すると、他より優先されます。",
            folderLabel: "指定フォルダ: ",
            folderNone: "未指定",
            folderInfo: (name, count) => `${name}（.lrc ${count}件）`,
            btnPickFolder: ".lrcフォルダを指定",
            btnUnsetFolder: "フォルダ解除",
            noPlatform: "対応する歌詞プラットフォームが見つかりませんでした。",
            playbarTitle: "Lyricaload: ローカル.lrcを読み込む",
            playbarTitleLoaded: "Lyricaload: ローカルLRC保存済み（クリックで置き換え）",
            btnTitle: "ローカル.lrcファイルを読み込む",
            btnTitleLoaded: "ローカルLRC保存済み（クリックで置き換え）",
        },
    };

    function t(key, ...args) {
        const tbl = STR[uiLang()] || STR.en;
        let v = tbl[key];
        if (v === undefined) v = STR.en[key];
        return typeof v === "function" ? v(...args) : v;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  공통 코어 (플랫폼 비의존)
    // ════════════════════════════════════════════════════════════════════════

    // ─── 저장소 (Spicetify.LocalStorage 우선, 폴백 localStorage) ──────────────

    function storageGet(key) {
        try {
            return Spicetify?.LocalStorage?.get(key) ?? localStorage.getItem(key);
        } catch {
            try { return localStorage.getItem(key); } catch { return null; }
        }
    }

    function storageSet(key, value) {
        try {
            if (Spicetify?.LocalStorage?.set) Spicetify.LocalStorage.set(key, value);
            else localStorage.setItem(key, value);
        } catch {
            try { localStorage.setItem(key, value); } catch { /* 무시 */ }
        }
    }

    function readCache() {
        try { return JSON.parse(storageGet(CACHE_KEY) ?? "{}"); }
        catch { return {}; }
    }

    function writeCacheEntry(trackId, entry) {
        const all = readCache();
        all[trackId] = entry;
        storageSet(CACHE_KEY, JSON.stringify(all));
    }

    function getCacheEntry(trackId) {
        if (!trackId) return null;
        const entry = readCache()[trackId];
        if (!entry) return null;
        if (entry.synced?.length || entry.unsynced?.length) return entry;
        return null;
    }

    // ─── LRC 파서 (다중 타임스탬프, [offset:N], ms 정규화) ────────────────────

    function parseLRC(text) {
        const lines = text.split("\n");
        const synced = [];
        const unsynced = [];
        let offsetMs = 0;

        const offsetTag = /^\[offset:\s*(-?\d+)\s*\]/i;
        const metaTag = /^\[(?:ar|ti|al|by|length|re|ve):/i;
        const timeTag = /\[(\d{1,2}):(\d{2})[.,](\d{1,3})\]/g;
        const stripTime = /\[\d{1,2}:\d{2}[.,]\d{1,3}\]/g;

        for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;

            const offMatch = line.match(offsetTag);
            if (offMatch) {
                offsetMs = parseInt(offMatch[1], 10);
                continue;
            }

            if (metaTag.test(line)) continue;

            const timestamps = [];
            let m;
            timeTag.lastIndex = 0;
            while ((m = timeTag.exec(line)) !== null) {
                const min = parseInt(m[1], 10);
                const sec = parseInt(m[2], 10);
                const ms = parseInt(m[3].padEnd(3, "0"), 10);
                timestamps.push(min * 60000 + sec * 1000 + ms);
            }

            const lyricText = line.replace(stripTime, "").trim();

            if (timestamps.length > 0) {
                for (const ts of timestamps) {
                    if (lyricText) synced.push({ startTime: ts + offsetMs, text: lyricText });
                }
            } else if (lyricText) {
                unsynced.push({ text: lyricText });
            }
        }

        synced.sort((a, b) => a.startTime - b.startTime);

        return {
            synced: synced.length > 0 ? synced : null,
            unsynced: unsynced.length > 0 ? unsynced : null,
        };
    }

    // ─── 파일 선택 다이얼로그 ────────────────────────────────────────────────

    function openFilePicker(onText) {
        const input = document.createElement("input");
        input.type = "file";
        // macOS 파일창은 accept에 MIME가 섞이면 확장자 필터를 무시해 .lrc를 비활성화한다.
        // 확장자 토큰만 둔다.
        input.accept = ".lrc,.txt";
        input.style.display = "none";
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) { input.remove(); return; }
            const reader = new FileReader();
            reader.onload = (ev) => { onText(ev.target.result); input.remove(); };
            reader.onerror = () => { log("FileReader 오류"); input.remove(); };
            reader.readAsText(file, "UTF-8");
        };
        document.body.appendChild(input);
        input.click();
    }

    // ─── 폴더 지정 / 자동 매칭 (Phase 2) ─────────────────────────────────────

    // 파일명·곡명을 비교용 키로 정규화: 확장자 제거 → 소문자 → 영숫자/문자 외 모두 제거.
    // "아티스트--제목.lrc", "아티스트 - 제목", "Artist-Title" 등이 모두 같은 키로 수렴한다.
    function normalizeKey(s) {
        return String(s ?? "")
            .toLowerCase()
            .replace(/\.[a-z0-9]+$/i, "")
            .replace(/[^\p{L}\p{N}]/gu, "");
    }

    function readFolderMap() {
        try { return JSON.parse(storageGet(FOLDER_KEY) ?? "null"); }
        catch { return null; }
    }

    // 파일명(확장자 제외)을 "--" 기준으로 분해. "아티스트--제목" → { a, t, hasSep }
    function splitName(nameNoExt) {
        const idx = nameNoExt.indexOf("--");
        if (idx === -1) return { a: null, t: null, hasSep: false };
        return {
            a: normalizeKey(nameNoExt.slice(0, idx)),
            t: normalizeKey(nameNoExt.slice(idx + 2)),
            hasSep: true,
        };
    }

    // webkitdirectory로 폴더 선택 → .lrc 전부 읽어 파일별 매칭 키와 함께 배열로 저장
    function openFolderPicker(onDone) {
        const input = document.createElement("input");
        input.type = "file";
        input.webkitdirectory = true;
        input.multiple = true;
        input.style.display = "none";
        input.onchange = async (e) => {
            const all = Array.from(e.target.files ?? []);
            const lrcFiles = all.filter((f) => /\.lrc$/i.test(f.name));
            const folderName = all[0]?.webkitRelativePath?.split("/")?.[0] ?? "(폴더)";
            const files = [];
            for (const f of lrcFiles) {
                try {
                    const parsed = parseLRC(await f.text());
                    if (!parsed.synced && !parsed.unsynced) continue;
                    const nameNoExt = f.name.replace(/\.[^.]+$/, "");
                    const { a, t, hasSep } = splitName(nameNoExt);
                    files.push({ full: normalizeKey(nameNoExt), a, t, hasSep, parsed });
                } catch (err) {
                    log("폴더 파일 읽기 실패:", f.name, err);
                }
            }
            const count = files.length;
            let ok = true;
            try {
                storageSet(FOLDER_KEY, JSON.stringify({ name: folderName, count, files }));
            } catch (err) {
                ok = false; // 용량 초과 등
                log("폴더 저장 실패:", err);
            }
            input.remove();
            onDone?.({ ok, folderName, count, scanned: lrcFiles.length });
        };
        document.body.appendChild(input);
        input.click();
    }

    function removeFolder() {
        storageSet(FOLDER_KEY, "null");
    }

    // 현재 곡 메타로 폴더에서 매칭되는 가사를 찾는다 (없으면 null).
    // 1순위: "아티스트--제목" 구분자로 두 필드가 정확히 일치(느슨한 충돌을 이걸로 해소)
    // 2순위: 느슨한 매칭(구분자·순서·공백 무시한 통짜 비교, 제목 단독 허용)
    function matchFromFolder(title, artist) {
        const data = readFolderMap();
        if (!Array.isArray(data?.files)) return null;
        const A = normalizeKey(artist);
        const T = normalizeKey(title);
        if (!T) return null;

        // 1) 정확 매칭 — "--"로 구분된 파일명의 아티스트/제목 두 필드가 모두 일치
        if (A) {
            const precise = data.files.find(
                (f) => f.hasSep && ((f.a === A && f.t === T) || (f.a === T && f.t === A))
            );
            if (precise) return precise.parsed;
        }

        // 2) 느슨한 매칭 — 정규화한 전체 문자열 비교 (아티스트+제목 / 제목+아티스트 / 제목 단독)
        const looseKeys = new Set();
        if (A) { looseKeys.add(A + T); looseKeys.add(T + A); }
        looseKeys.add(T);
        const loose = data.files.find((f) => looseKeys.has(f.full));
        return loose ? loose.parsed : null;
    }

    // 수동 캐시 우선, 없으면 폴더 자동 매칭. { entry, source } | null
    function resolveEntry(trackId, title, artist) {
        const manual = getCacheEntry(trackId);
        if (manual) return { entry: manual, source: "manual" };
        const folder = matchFromFolder(title, artist);
        if (folder) return { entry: folder, source: "folder" };
        return null;
    }

    // ─── 트랙 식별 유틸 ──────────────────────────────────────────────────────

    function trackIdFromInfo(info) {
        return info?.trackId ?? info?.uri?.split(":")?.[2] ?? null;
    }

    function currentTrackId() {
        const uri = Spicetify?.Player?.data?.item?.uri;
        return uri?.split(":")?.[2] ?? null;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  플랫폼 어댑터
    //  공통 코어가 호출하는 인터페이스:
    //    name             : 표시용 이름
    //    isAvailable()    : 이 플랫폼에서 동작 가능한지
    //    init()           : 프로바이더 등록 등 가사 제공 준비
    //    applyLyrics(id,p): 해당 트랙에 파싱 결과를 적용하고 즉시 표시.
    //                       강제 새로고침이 일어났으면 true 반환.
    // ════════════════════════════════════════════════════════════════════════

    // ─── ivLyrics 어댑터 (LyricsAddonManager 규격) ───────────────────────────

    const ivLyricsAdapter = {
        name: "ivLyrics",

        isAvailable() {
            return typeof window !== "undefined" && !!window.LyricsAddonManager;
        },

        // ivLyrics 프로바이더 객체 — manager가 getLyrics(info)로 캐시를 조회
        _addon: {
            id: ADDON_ID,
            name: "Lyricaload (Local LRC)",
            author: "Lyricaload",
            version: ADDON_VERSION,
            description: {
                en: "Local .lrc lyrics. Move this provider to the top, then use 'Load .lrc for current track' or 'Set .lrc folder' in settings.",
                ko: "로컬 .lrc 가사. 이 제공자를 맨 위로 올린 뒤, 설정에서 '현재 곡 .lrc 불러오기' 또는 '.lrc 폴더 지정하기'를 사용하세요.",
                ja: "ローカル.lrc歌詞。このプロバイダーを最上部に移動し、設定で「現在の曲に.lrcを読み込む」または「.lrcフォルダを指定」を使用してください。",
            },
            supports: { karaoke: false, synced: true, unsynced: true },

            init() {
                log(`ivLyrics 프로바이더 init (v${ADDON_VERSION})`);
            },

            async getLyrics(info) {
                const trackId = trackIdFromInfo(info);
                const resolved = resolveEntry(trackId, info?.title, info?.artist);
                if (!resolved) {
                    // 매칭 없음 → 빈 결과로 다음 제공자 폴백. skipCache로 음성 결과 캐시 방지
                    // (나중에 폴더를 지정하면 재조회되도록).
                    return { uri: info?.uri, provider: "Lyricaload", synced: null, unsynced: null, error: null, skipCache: true };
                }
                const { entry, source } = resolved;
                return {
                    uri: info?.uri,
                    provider: source === "folder" ? "Lyricaload (Folder)" : "Lyricaload (Local)",
                    synced: entry.synced ?? null,
                    unsynced: entry.unsynced ?? null,
                    copyright: "",
                    error: null,
                };
            },

            // ivLyrics가 설정 화면에 렌더하는 공식 UI 표면.
            // 애드온이 사이드바에 버튼을 직접 추가하는 API는 없으므로 모든 UI를 여기에 둔다.
            getSettingsUI() {
                const React = window.Spicetify?.React;
                if (!React) return null;

                function describe() {
                    const item = window.Spicetify?.Player?.data?.item;
                    if (!item?.uri) return { trackId: null, label: t("noTrack"), source: null };
                    const trackId = item.uri.split(":")[2];
                    const title = item.metadata?.title ?? item.name ?? trackId;
                    const artist = item.metadata?.artist_name ?? "";
                    const resolved = resolveEntry(trackId, title, artist);
                    return {
                        trackId,
                        label: artist ? `${title} — ${artist}` : title,
                        source: resolved?.source ?? null, // "manual" | "folder" | null
                    };
                }

                function describeFolder() {
                    const data = readFolderMap();
                    return data?.files ? { name: data.name, count: data.count } : null;
                }

                function forceReloadCurrent() {
                    try {
                        const item = window.Spicetify?.Player?.data?.item;
                        window.lyricContainer?.fetchLyrics?.(item, true);
                    } catch { /* 무시 */ }
                }

                function Panel() {
                    const [cur, setCur] = React.useState(describe());
                    const [folder, setFolder] = React.useState(describeFolder());
                    const [msg, setMsg] = React.useState("");

                    const refresh = () => { setCur(describe()); setFolder(describeFolder()); };

                    const loadForCurrent = () => {
                        const item = window.Spicetify?.Player?.data?.item;
                        const trackId = item?.uri?.split(":")?.[2];
                        if (!trackId) { setMsg(t("noTrackPlaying")); return; }
                        openFilePicker((text) => {
                            const parsed = parseLRC(text);
                            if (!parsed.synced && !parsed.unsynced) {
                                setMsg(t("invalidLrc"));
                                return;
                            }
                            const count = parsed.synced?.length ?? parsed.unsynced?.length ?? 0;
                            const reloaded = ivLyricsAdapter.applyLyrics(trackId, parsed);
                            refresh();
                            setMsg(t("loaded", count, reloaded));
                        });
                    };

                    const pickFolder = () => {
                        setMsg(t("folderReading"));
                        openFolderPicker((r) => {
                            if (!r.ok) { setMsg(t("folderTooBig")); return; }
                            forceReloadCurrent(); // 현재 곡 즉시 재매칭
                            refresh();
                            setMsg(t("folderSet", r.folderName, r.count, r.scanned));
                        });
                    };

                    const unsetFolder = () => {
                        removeFolder();
                        forceReloadCurrent();
                        refresh();
                        setMsg(t("folderUnset"));
                    };

                    const clearCurrent = () => {
                        if (!cur.trackId) return;
                        const all = readCache();
                        delete all[cur.trackId];
                        storageSet(CACHE_KEY, JSON.stringify(all));
                        forceReloadCurrent();
                        refresh();
                        setMsg(t("clearedCurrent"));
                    };

                    const clearAll = () => {
                        storageSet(CACHE_KEY, "{}");
                        forceReloadCurrent();
                        refresh();
                        setMsg(t("clearedAll"));
                    };

                    const box = { display: "flex", flexDirection: "column", gap: "10px", padding: "8px 0" };
                    const row = { display: "flex", gap: "8px", flexWrap: "wrap" };
                    const btn = {
                        padding: "8px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
                        fontWeight: 700, background: "var(--spice-button, #1db954)", color: "var(--spice-main, #000)",
                    };
                    const btnGhost = {
                        ...btn, background: "transparent", color: "var(--spice-text, #fff)",
                        border: "1px solid var(--spice-button-disabled, #535353)",
                    };
                    const sub = { color: "var(--spice-subtext, #b3b3b3)", fontSize: "13px", margin: 0 };
                    const hr = { border: "none", borderTop: "1px solid var(--spice-button-disabled, #333)", margin: "4px 0" };
                    const sourceTag = cur.source === "manual"
                        ? React.createElement("span", { style: { color: "var(--spice-button, #1db954)", marginLeft: 8 } }, t("srcManual"))
                        : cur.source === "folder"
                            ? React.createElement("span", { style: { color: "#4ea1ff", marginLeft: 8 } }, t("srcFolder"))
                            : React.createElement("span", { style: { color: "var(--spice-subtext, #b3b3b3)", marginLeft: 8 } }, t("srcNone"));

                    return React.createElement("div", { style: box },
                        // 현재 곡 상태
                        React.createElement("p", { style: { margin: 0, fontWeight: 700 } },
                            t("curSong"), React.createElement("span", { style: { fontWeight: 400 } }, cur.label), sourceTag),

                        // 수동 로드
                        React.createElement("p", { style: sub }, t("manualDesc")),
                        React.createElement("div", { style: row },
                            React.createElement("button", { style: btn, onClick: loadForCurrent }, t("btnLoad")),
                            React.createElement("button", { style: btnGhost, onClick: refresh }, t("btnRefresh")),
                            React.createElement("button", { style: btnGhost, onClick: clearCurrent, disabled: cur.source !== "manual" }, t("btnClearCurrent")),
                            React.createElement("button", { style: btnGhost, onClick: clearAll }, t("btnClearAll"))),

                        React.createElement("hr", { style: hr }),

                        // 폴더 자동 매칭
                        React.createElement("p", { style: sub }, t("folderDesc")),
                        React.createElement("p", { style: { margin: 0 } },
                            t("folderLabel"),
                            folder
                                ? React.createElement("span", { style: { fontWeight: 700 } }, t("folderInfo", folder.name, folder.count))
                                : React.createElement("span", { style: { color: "var(--spice-subtext, #b3b3b3)" } }, t("folderNone"))),
                        React.createElement("div", { style: row },
                            React.createElement("button", { style: btn, onClick: pickFolder }, t("btnPickFolder")),
                            React.createElement("button", { style: btnGhost, onClick: unsetFolder, disabled: !folder }, t("btnUnsetFolder"))),

                        msg ? React.createElement("p", { style: { ...sub, color: "var(--spice-text, #fff)" } }, msg) : null,
                    );
                }

                // ivLyrics Settings.js는 결과를 react.createElement(SettingsUI)로 감싼다 →
                // 엘리먼트가 아니라 "컴포넌트 함수"를 반환해야 한다.
                return Panel;
            },
        },

        init() {
            const tryRegister = () => {
                if (window.LyricsAddonManager) {
                    window.LyricsAddonManager.register(this._addon);
                    log("LyricsAddonManager 등록 완료");
                } else {
                    setTimeout(tryRegister, 100);
                }
            };
            tryRegister();
        },

        applyLyrics(trackId, parsed) {
            writeCacheEntry(trackId, parsed);
            // manager는 trackId 기준 IndexedDB 캐시를 getLyrics보다 먼저 확인하므로
            // refresh=true로 우회 재요청해야 새 LRC가 즉시 반영된다.
            try {
                const track = Spicetify?.Player?.data?.item;
                if (window.lyricContainer?.fetchLyrics) {
                    window.lyricContainer.fetchLyrics(track, true);
                    return true;
                }
            } catch (e) {
                log("applyLyrics 새로고침 실패:", e);
            }
            return false;
        },
    };

    // ─── (예정) Spicetify / Lyrics Plus 어댑터 자리 ──────────────────────────
    // const lyricsPlusAdapter = {
    //     name: "Lyrics Plus",
    //     isAvailable() { return !window.LyricsAddonManager && !!Spicetify?.LocalStorage; },
    //     init() { /* 별도 등록 불필요 — push 방식 */ },
    //     applyLyrics(trackId, parsed) {
    //         // lyrics-plus:local-lyrics 에 {synced,unsynced} 기록 + window.reloadLyrics()
    //     },
    // };

    const ADAPTERS = [ivLyricsAdapter /*, lyricsPlusAdapter */];

    let activeAdapter = null;

    function selectAdapter() {
        activeAdapter = ADAPTERS.find((a) => a.isAvailable()) ?? null;
        return activeAdapter;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  로드 버튼 UI (공통)
    // ════════════════════════════════════════════════════════════════════════

    function handleLoadClick() {
        const trackId = currentTrackId();
        if (!trackId) {
            notify(t("noTrackPlaying"));
            return;
        }
        if (!activeAdapter) {
            notify(t("noPlatform"));
            return;
        }
        openFilePicker((text) => {
            const parsed = parseLRC(text);
            if (!parsed.synced && !parsed.unsynced) {
                notify(t("invalidLrc"));
                return;
            }
            const count = parsed.synced?.length ?? parsed.unsynced?.length ?? 0;
            const reloaded = activeAdapter.applyLyrics(trackId, parsed);
            updateButtonState();
            notify(t("loaded", count, reloaded));
            log(`로드 — adapter: ${activeAdapter.name}, trackId: ${trackId}, 라인 수: ${count}, reload: ${reloaded}`);
        });
    }

    // 재생 바(Playbar) 공식 버튼 — DOM 추정 없이 항상 표시되는 1차 진입점
    let playbarButton = null;
    const LRC_ICON =
        `<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">` +
        `<path d="M3 1h6l4 4v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm5.5 1H3v12h10V5.5H9a.5.5 0 0 1-.5-.5V2zM4.5 7h7v1h-7V7zm0 2.5h7v1h-7v-1zM4.5 12h4v1h-4v-1z"/>` +
        `</svg>`;

    function registerPlaybarButton() {
        if (playbarButton || !Spicetify?.Playbar?.Button) return;
        try {
            playbarButton = new Spicetify.Playbar.Button(
                t("playbarTitle"),
                LRC_ICON,
                () => handleLoadClick(),
                false,
                false
            );
            log("Playbar 버튼 등록 완료");
        } catch (e) {
            log("Playbar 버튼 등록 실패:", e);
        }
    }

    function updateButtonState() {
        const stored = !!getCacheEntry(currentTrackId());

        if (playbarButton) {
            playbarButton.active = stored;
            playbarButton.label = stored ? t("playbarTitleLoaded") : t("playbarTitle");
        }

        const btn = document.querySelector(".lyricaload-btn");
        if (btn) {
            btn.classList.toggle("lyricaload-btn--loaded", stored);
            btn.title = stored ? t("btnTitleLoaded") : t("btnTitle");
        }
    }

    function createButton() {
        const btn = document.createElement("button");
        btn.className = "lyricaload-btn";
        btn.textContent = "LRC";
        btn.title = t("btnTitle");
        btn.onclick = handleLoadClick;
        return btn;
    }

    // ivLyrics 가사 패널 후보 셀렉터 (실기기 DevTools로 확인 필요)
    const PANEL_CANDIDATES = [
        "[class*='lyricsContainer']",
        "[class*='LyricsContainer']",
        "[class*='nowPlaying'] [class*='lyrics']",
        "[data-testid*='lyrics']",
    ];

    function findLyricsPanel() {
        for (const sel of PANEL_CANDIDATES) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function injectButton() {
        const panel = findLyricsPanel();
        if (!panel || panel.querySelector(".lyricaload-btn")) return;
        const header = panel.querySelector("[class*='header'], [class*='Header']") ?? panel;
        header.appendChild(createButton());
        updateButtonState();
        log("버튼 주입 완료");
    }

    function injectStyles() {
        if (document.getElementById("lyricaload-styles")) return;
        const style = document.createElement("style");
        style.id = "lyricaload-styles";
        style.textContent = `
            .lyricaload-btn {
                display: inline-flex; align-items: center; justify-content: center;
                padding: 4px 10px; margin: 6px;
                border: 1px solid var(--spice-button-disabled, #535353);
                border-radius: 4px; background: transparent;
                color: var(--spice-subtext, #b3b3b3);
                font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
                cursor: pointer; transition: border-color 0.15s, color 0.15s;
            }
            .lyricaload-btn:hover {
                border-color: var(--spice-text, #fff); color: var(--spice-text, #fff);
            }
            .lyricaload-btn--loaded {
                border-color: var(--spice-button, #1db954); color: var(--spice-button, #1db954);
            }
            .lyricaload-btn--loaded:hover {
                border-color: var(--spice-button-active, #1ed760); color: var(--spice-button-active, #1ed760);
            }
        `;
        document.head.appendChild(style);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  진입점
    // ════════════════════════════════════════════════════════════════════════

    function startUI() {
        injectStyles();
        registerPlaybarButton(); // 1차 진입점 (항상 표시)
        Spicetify?.Player?.addEventListener?.("songchange", () => updateButtonState());
        const observer = new MutationObserver(() => injectButton());
        observer.observe(document.body, { childList: true, subtree: true });
        injectButton();
        updateButtonState();
        log("UI 시작");
    }

    function boot() {
        if (!Spicetify?.Player || !Spicetify?.LocalStorage) {
            setTimeout(boot, 300);
            return;
        }

        const adapter = selectAdapter();
        if (!adapter) {
            // 아직 LyricsAddonManager가 안 떴을 수 있음 → 잠시 후 재시도
            setTimeout(boot, 300);
            return;
        }

        log(`어댑터 선택: ${adapter.name}`);
        adapter.init();
        startUI();
    }

    boot();
})();
