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
    const ADDON_VERSION = "0.1.0";
    const CACHE_KEY = "lyricaload:local-lrc"; // { [trackId]: { synced, unsynced } }
    const LOG_PREFIX = "[Lyricaload]";

    function log(...args) {
        console.log(LOG_PREFIX, ...args);
    }

    function notify(msg) {
        try { Spicetify?.showNotification?.(`${LOG_PREFIX} ${msg}`); } catch { /* 무시 */ }
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
        input.accept = ".lrc,text/plain";
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
                en: "Load local .lrc files as synced lyrics for the current track.",
                ko: "로컬 .lrc 파일을 현재 곡의 동기화 가사로 불러옵니다.",
            },
            supports: { karaoke: false, synced: true, unsynced: true },

            init() {
                log(`ivLyrics 프로바이더 init (v${ADDON_VERSION})`);
            },

            async getLyrics(info) {
                const trackId = trackIdFromInfo(info);
                const entry = getCacheEntry(trackId);
                if (!entry) {
                    // 캐시 미스 → 빈 결과로 다음 프로바이더 폴백 유도
                    return { uri: info?.uri, provider: "Lyricaload", synced: null, unsynced: null, error: null };
                }
                return {
                    uri: info?.uri,
                    provider: "Lyricaload (Local)",
                    synced: entry.synced ?? null,
                    unsynced: entry.unsynced ?? null,
                    copyright: "",
                    error: null,
                };
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
            Spicetify?.showNotification?.("재생 중인 트랙이 없습니다.");
            return;
        }
        if (!activeAdapter) {
            notify("호환 가능한 가사 플랫폼을 찾지 못했습니다.");
            return;
        }
        openFilePicker((text) => {
            const parsed = parseLRC(text);
            if (!parsed.synced && !parsed.unsynced) {
                notify("유효한 LRC 내용을 찾을 수 없습니다.");
                return;
            }
            const count = parsed.synced?.length ?? parsed.unsynced?.length ?? 0;
            const reloaded = activeAdapter.applyLyrics(trackId, parsed);
            updateButtonState();
            notify(`${count}줄 로드 완료${reloaded ? "" : " (가사 패널을 다시 열면 반영됩니다)"}`);
            log(`로드 — adapter: ${activeAdapter.name}, trackId: ${trackId}, 라인 수: ${count}, reload: ${reloaded}`);
        });
    }

    function updateButtonState() {
        const btn = document.querySelector(".lyricaload-btn");
        if (!btn) return;
        const stored = !!getCacheEntry(currentTrackId());
        btn.classList.toggle("lyricaload-btn--loaded", stored);
        btn.title = stored ? "로컬 LRC 저장됨 (클릭하면 교체)" : "로컬 .lrc 파일 불러오기";
    }

    function createButton() {
        const btn = document.createElement("button");
        btn.className = "lyricaload-btn";
        btn.textContent = "LRC";
        btn.title = "로컬 .lrc 파일 불러오기";
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
        Spicetify?.Player?.addEventListener?.("songchange", () => updateButtonState());
        const observer = new MutationObserver(() => injectButton());
        observer.observe(document.body, { childList: true, subtree: true });
        injectButton();
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
