// background.js — Service worker: icon, badge, extension toggle
'use strict';

function updateIcon(isActive) {
    chrome.action.setIcon({ path: isActive ? 'icon48_on.png' : 'icon48_off.png' }, () => {
        void chrome.runtime.lastError;
    });
}

function setStatusBadge(status) {
    if (status === 'active') {
        chrome.action.setBadgeText({ text: 'ON' });
        chrome.action.setBadgeBackgroundColor({ color: '#15803d' });
    } else if (status === 'error') {
        chrome.action.setBadgeText({ text: 'ERR' });
        chrome.action.setBadgeBackgroundColor({ color: '#b91c1c' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
    chrome.storage.local.set({ monitorStatus: status });
}

function toggleExtension() {
    chrome.storage.local.get('isActive', result => {
        const next = result.isActive !== false ? false : true;
        chrome.storage.local.set({ isActive: next }, () => updateIcon(next));
    });
}

chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
    if (req.message === 'setStatus') {
        setStatusBadge(req.status);
        sendResponse({ ok: true });
        return true;
    }
});

chrome.action.onClicked.addListener(toggleExtension);

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['isActive', 'debug', 'monitorStatus'], result => {
        if (result.isActive === undefined) chrome.storage.local.set({ isActive: true });
        if (result.debug === undefined)    chrome.storage.local.set({ debug: false });
        updateIcon(result.isActive !== false);
        if (result.monitorStatus) setStatusBadge(result.monitorStatus);
    });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['isActive', 'monitorStatus'], result => {
        updateIcon(result.isActive !== false);
        if (result.monitorStatus) setStatusBadge(result.monitorStatus);
    });
});
