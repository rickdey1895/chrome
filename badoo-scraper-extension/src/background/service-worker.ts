// Background service worker for Badoo Scraper extension (MV3)
// - receives SCRAPE_BATCH messages from content scripts
// - deduplicates and stores profiles in chrome.storage.local
// - supports EXPORT_CSV and CLEAR_SCRAPED messages

declare const chrome: any;

type ScrapedProfile = {
    id: string;
    url?: string;
    name?: string;
    age?: number | null;
    location?: string | null;
    photos?: string[];
    bio?: string | null;
    scrapedAt: string;
};

const STORAGE_KEY = 'scrapedProfiles';

async function getStoredMap(): Promise<Record<string, ScrapedProfile>> {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (res: any) => {
            const raw = res[STORAGE_KEY] || {};
            resolve(raw as Record<string, ScrapedProfile>);
        });
    });
}

async function saveStoredMap(map: Record<string, ScrapedProfile>): Promise<void> {
    return new Promise((resolve) => {
        const obj: Record<string, any> = {};
        obj[STORAGE_KEY] = map;
        chrome.storage.local.set(obj, () => resolve());
    });
}

function profilesMapToArray(map: Record<string, ScrapedProfile>): ScrapedProfile[] {
    return Object.keys(map).map((k) => map[k]);
}

function toCSV(items: ScrapedProfile[]) {
    const header = ['id', 'url', 'name', 'age', 'location', 'photos', 'bio', 'scrapedAt'];
    const lines = [header.join(',')];
    for (const it of items) {
        const row = [
            safe(it.id),
            safe(it.url),
            safe(it.name),
            it.age != null ? String(it.age) : '',
            safe(it.location),
            safe(it.photos ? it.photos.join(' | ') : ''),
            safe(it.bio),
            safe(it.scrapedAt),
        ];
        lines.push(row.join(','));
    }
    return lines.join('\n');

    function safe(v: any) {
        if (v == null) return '';
        const s = String(v).replace(/"/g, '""');
        if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s}"`;
        return s;
    }
}

async function uploadBatch(uploadUrl: string, items: ScrapedProfile[], proxy: string | null) {
    // send items to a remote server which can forward via the provided proxy
    // We include the proxy string in the body so the server can use it.
    try {
        const body = JSON.stringify({ profiles: items, proxy });
        const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Upload failed: ${res.status} ${res.statusText} - ${text}`);
        }
        return await res.json().catch(() => ({}));
    } catch (err) {
        throw err;
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('Badoo Scraper: installed');
});

chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (resp: any) => void) => {
    (async () => {
        try {
            if (!message || !message.type) return;
            if (message.type === 'SCRAPE_BATCH') {
                const items: ScrapedProfile[] = message.items || [];
                const map = await getStoredMap();
                let added = 0;
                for (const p of items) {
                    if (!p || !p.id) continue;
                    if (!map[p.id]) {
                        map[p.id] = p;
                        added++;
                    }
                }
                await saveStoredMap(map);
                sendResponse({ status: 'ok', added, total: Object.keys(map).length });
                // If an upload URL is configured and auto-upload is enabled, attempt to upload this batch
                try {
                    chrome.storage.sync.get(['uploadUrl', 'autoUpload', 'proxy'], async (cfg: any) => {
                        const uploadUrl = cfg && cfg.uploadUrl ? cfg.uploadUrl : null;
                        const autoUpload = cfg && cfg.autoUpload;
                        const proxy = cfg && cfg.proxy ? cfg.proxy : null;
                        if (uploadUrl && autoUpload) {
                            // send items to upload endpoint
                            try {
                                await uploadBatch(uploadUrl, items, proxy);
                                console.log('Auto-uploaded batch to', uploadUrl);
                            } catch (err) {
                                console.error('Auto-upload failed', err);
                            }
                        }
                    });
                } catch (err) {
                    console.warn('Failed to check auto-upload config', err);
                }
            } else if (message.type === 'EXPORT_CSV') {
                const map = await getStoredMap();
                const arr = profilesMapToArray(map);
                const csv = toCSV(arr);
                // If caller asked for background download, perform it using chrome.downloads
                if (message && message.backgroundDownload) {
                    try {
                        const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                        const filename = message.filename || `badoo-scrape-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
                        chrome.downloads.download({ url: dataUrl, filename }, () => {
                            // ignore result
                        });
                        sendResponse({ status: 'ok', downloaded: true, count: arr.length });
                    } catch (err) {
                        console.error('Background download failed', err);
                        sendResponse({ status: 'error', error: String(err) });
                    }
                } else {
                    sendResponse({ status: 'ok', csv, count: arr.length });
                }
            } else if (message.type === 'CLEAR_SCRAPED') {
                await saveStoredMap({});
                sendResponse({ status: 'ok', cleared: true });
            } else if (message.type === 'GET_COUNT') {
                const map = await getStoredMap();
                sendResponse({ status: 'ok', count: Object.keys(map).length });
            } else if (message.type === 'GET_PROXY') {
                chrome.storage.sync.get(['proxy'], (res: any) => {
                    sendResponse({ status: 'ok', proxy: res && res.proxy ? res.proxy : null });
                });
                return;
            } else if (message.type === 'SAVE_PROXY') {
                const proxy = message.proxy || null;
                chrome.storage.sync.set({ proxy }, () => {
                    sendResponse({ status: 'ok', saved: true });
                });
                return;
            } else if (message.type === 'SAVE_UPLOAD_URL') {
                const uploadUrl = message.uploadUrl || null;
                const autoUpload = !!message.autoUpload;
                chrome.storage.sync.set({ uploadUrl, autoUpload }, () => {
                    sendResponse({ status: 'ok', saved: true });
                });
                return;
            } else if (message.type === 'GET_UPLOAD_URL') {
                chrome.storage.sync.get(['uploadUrl', 'autoUpload'], (res: any) => {
                    sendResponse({ status: 'ok', uploadUrl: res && res.uploadUrl ? res.uploadUrl : null, autoUpload: !!(res && res.autoUpload) });
                });
                return;
            }
        } catch (err) {
            console.error('background onMessage error', err);
            sendResponse({ status: 'error', error: String(err) });
        }
    })();
    // indicate we'll respond asynchronously
    return true;
});

// Expose a simple command via chrome.commands or alarms could be added later