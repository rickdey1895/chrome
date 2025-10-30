// popup.ts
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-button') as HTMLButtonElement | null;
    const stopBtn = document.getElementById('stop-button') as HTMLButtonElement | null;
    const exportBtn = document.getElementById('export-button') as HTMLButtonElement | null;
    const clearBtn = document.getElementById('clear-button') as HTMLButtonElement | null;
    const countEl = document.getElementById('count') as HTMLElement | null;
    const statusEl = document.getElementById('status') as HTMLElement | null;
    const proxyEl = document.getElementById('proxy') as HTMLTextAreaElement | null;
    const saveProxyBtn = document.getElementById('save-proxy') as HTMLButtonElement | null;

    const DEFAULT_PROXY = '8fceb83bb599108e7733:5327b6152674503f@gw.dataimpulse.com:823';

    if (proxyEl) {
        // load saved proxy or default
        chrome.runtime.sendMessage({ type: 'GET_PROXY' }, (resp: any) => {
            if (resp && resp.proxy) proxyEl.value = resp.proxy;
            else proxyEl.value = DEFAULT_PROXY;
        });
    }
    const uploadUrlEl = document.getElementById('uploadUrl') as HTMLInputElement | null;
    const autoUploadEl = document.getElementById('autoUpload') as HTMLInputElement | null;
    const saveUploadBtn = document.getElementById('save-upload') as HTMLButtonElement | null;
    if (uploadUrlEl && autoUploadEl) {
        chrome.runtime.sendMessage({ type: 'GET_UPLOAD_URL' }, (resp: any) => {
            if (resp && resp.uploadUrl) uploadUrlEl.value = resp.uploadUrl;
            autoUploadEl.checked = !!(resp && resp.autoUpload);
        });
    }

    function setStatus(text: string) {
        if (statusEl) statusEl.textContent = text;
    }

    function refreshCount() {
        chrome.runtime.sendMessage({ type: 'GET_COUNT' }, (resp: any) => {
            if (resp && resp.count != null) {
                if (countEl) countEl.textContent = String(resp.count);
            }
        });
    }

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
                if (!tabs || !tabs[0] || typeof tabs[0].id === 'undefined') {
                    setStatus('No active tab');
                    return;
                }
                chrome.tabs.sendMessage(tabs[0].id, { type: 'START_SCRAPING' }, (resp: any) => {
                    setStatus('Scraping started');
                    refreshCount();
                });
            });
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
                if (!tabs || !tabs[0] || typeof tabs[0].id === 'undefined') {
                    setStatus('No active tab');
                    return;
                }
                chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_SCRAPING' }, (resp: any) => {
                    setStatus('Scraping stopped');
                    refreshCount();
                });
            });
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            setStatus('Preparing CSV...');
            chrome.runtime.sendMessage({ type: 'EXPORT_CSV' }, (resp: any) => {
                if (!resp || resp.status !== 'ok') {
                    setStatus('Export failed');
                    return;
                }
                const csv = resp.csv || '';
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                a.download = `badoo-scrape-${ts}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                setStatus(`Exported ${resp.count || 0} rows`);
            });
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'CLEAR_SCRAPED' }, (resp: any) => {
                if (resp && resp.status === 'ok') {
                    setStatus('Cleared stored profiles');
                    if (countEl) countEl.textContent = '0';
                }
            });
        });
    }

    if (saveProxyBtn && proxyEl) {
        saveProxyBtn.addEventListener('click', () => {
            const val = proxyEl.value.trim();
            chrome.runtime.sendMessage({ type: 'SAVE_PROXY', proxy: val }, (resp: any) => {
                if (resp && resp.status === 'ok') setStatus('Proxy saved');
                else setStatus('Save failed');
            });
        });
    }

    if (saveUploadBtn && uploadUrlEl && autoUploadEl) {
        saveUploadBtn.addEventListener('click', () => {
            const url = uploadUrlEl.value.trim() || null;
            const auto = !!autoUploadEl.checked;
            chrome.runtime.sendMessage({ type: 'SAVE_UPLOAD_URL', uploadUrl: url, autoUpload: auto }, (resp: any) => {
                if (resp && resp.status === 'ok') setStatus('Upload settings saved');
                else setStatus('Save failed');
            });
        });
    }

    // initial refresh
    refreshCount();
});