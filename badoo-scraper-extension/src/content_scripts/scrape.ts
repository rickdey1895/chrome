// Content script for Badoo scraping
// - Observes the DOM for profile cards
// - Extracts a small profile object per card
// - Batches and sends results to the background service worker

type Profile = {
    id: string;
    url?: string;
    name?: string;
    age?: number | null;
    location?: string | null;
    photos?: string[];
    bio?: string | null;
    scrapedAt: string;
};

const BATCH_SIZE = 10;
const FLUSH_MS = 5000;

let buffer: Profile[] = [];
let seen = new Set<string>();
let flushTimer: number | undefined;
let scrapingEnabled = true;

function nowISO() {
    return new Date().toISOString();
}

function normalizeUrl(u: string) {
    try {
        return new URL(u, window.location.href).href;
    } catch (e) {
        return u;
    }
}

function extractIdFromUrl(url: string) {
    // heuristic: use last path segment or query param
    try {
        const u = new URL(url, window.location.href);
        const parts = u.pathname.split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : url;
    } catch (e) {
        return url;
    }
}

function textOrNull(el: Element | null) {
    if (!el) return null;
    const t = el.textContent?.trim();
    return t && t.length ? t : null;
}

function parseAge(text: string | null) {
    if (!text) return null;
    const m = text.match(/(\d{1,3})/);
    return m ? parseInt(m[1], 10) : null;
}

function extractProfileFromCard(card: HTMLElement): Profile | null {
    // find a profile link
    const anchor = card.querySelector('a[href*="/profile"], a[href*="/user"], a') as HTMLAnchorElement | null;
    const url = anchor ? normalizeUrl(anchor.href) : normalizeUrl(card.getAttribute('data-url') || window.location.href);
    const id = extractIdFromUrl(url || window.location.href);

    if (!id) return null;

    const nameEl = card.querySelector('[data-test="user-name"], .user-name, .profile-name, h3, h2, .name');
    const ageEl = card.querySelector('.age, .user-age');
    const locationEl = card.querySelector('.location, .user-location');
    const bioEl = card.querySelector('.bio, .description, .user-bio');

    const imgs = Array.from(card.querySelectorAll('img'))
        .map((i: HTMLImageElement) => i.src || i.getAttribute('data-src') || '')
        .filter(Boolean)
        .map(normalizeUrl);

    const profile: Profile = {
        id,
        url,
        name: textOrNull(nameEl) || undefined,
        age: parseAge(textOrNull(ageEl)),
        location: textOrNull(locationEl) || undefined,
        photos: imgs.length ? imgs : undefined,
        bio: textOrNull(bioEl) || undefined,
        scrapedAt: nowISO(),
    };

    return profile;
}

function enqueue(p: Profile) {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    buffer.push(p);
    if (buffer.length >= BATCH_SIZE) flushBuffer();
    scheduleFlush();
}

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = window.setTimeout(() => {
        flushTimer = undefined;
        flushBuffer();
    }, FLUSH_MS);
}

function flushBuffer() {
    if (!buffer.length) return;
    const toSend = buffer.slice();
    buffer = [];
        try {
            chrome.runtime.sendMessage({ type: 'SCRAPE_BATCH', items: toSend }, (resp: any) => {
                // optional ACK handling
                // console.log('background ack', resp);
            });
        } catch (e) {
        console.error('Failed to send scrape batch', e);
    }
}

function scanAndExtract() {
    if (!scrapingEnabled) return;
    // Heuristic selectors for cards on Badoo — try common wrapper classes
    const candidates = Array.from(document.querySelectorAll('[data-test="user-card"], .user-card, .profile, .profile-item, [data-qa="card"]')) as HTMLElement[];
    if (!candidates.length) {
        // broad fallback: anchor cards
        const alt = Array.from(document.querySelectorAll('a[href*="/profile"], a[href*="/user"]')) as HTMLElement[];
        alt.forEach(a => {
            const parent = a.closest('article, li, div');
            if (parent) candidates.push(parent as HTMLElement);
        });
    }

    for (const c of candidates) {
        const p = extractProfileFromCard(c);
        if (p) enqueue(p);
    }
}

const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
            scanAndExtract();
            break;
        }
    }
});

function startObserving() {
    observer.observe(document.body, { childList: true, subtree: true });
    // initial scan
    scanAndExtract();
}

function stopObserving() {
    observer.disconnect();
    scrapingEnabled = false;
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = undefined;
    }
    flushBuffer();
}

// Listen for commands from popup/background
chrome.runtime.onMessage.addListener((msg: any, _sender: any, sendResponse: (r: any) => void) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'START_SCRAPING') {
        scrapingEnabled = true;
        startObserving();
        sendResponse({ status: 'started' });
    } else if (msg.type === 'STOP_SCRAPING') {
        stopObserving();
        sendResponse({ status: 'stopped' });
    } else if (msg.type === 'FLUSH') {
        flushBuffer();
        sendResponse({ status: 'flushed' });
    }
});

// Monitor SPA navigation (pushState/replaceState)
(() => {
    const _push = history.pushState;
    history.pushState = function (...args: any[]) {
        // @ts-ignore
        const r = _push.apply(this, args);
        setTimeout(scanAndExtract, 500);
        return r;
    };
    const _replace = history.replaceState;
    history.replaceState = function (...args: any[]) {
        // @ts-ignore
        const r = _replace.apply(this, args);
        setTimeout(scanAndExtract, 500);
        return r;
    };
    window.addEventListener('popstate', () => setTimeout(scanAndExtract, 500));
})();

// Start by default
startObserving();

// Expose a small debug hook
(window as any).__badooScraper = {
    flush: flushBuffer,
    getBuffer: () => buffer.slice(),
    getSeen: () => Array.from(seen),
};