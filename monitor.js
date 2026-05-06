// monitor.js — VetRadar Patient Monitoring
// Single content script: settings, audio, patient tracking, widget, diagnostics
'use strict';

// ─── Settings ─────────────────────────────────────────────────────────────────
// One object, one load, one listener. Everything reads from `cfg`.

const cfg = {
    chimeVolume: 0.5,
    patientAddedVolume: 1.0,
    patientRemovedVolume: 1.0,
    examRoomNotificationVolume: 1.0,
    enablePatientAdded: true,
    enablePatientRemoved: true,
    enableExamRoomNotification: true,
    debug: false,
};

const ALL_KEYS = [
    'chimeVolume', 'patientAddedVolume', 'patientRemovedVolume', 'examRoomNotificationVolume',
    'enablePatientAdded', 'enablePatientRemoved', 'enableExamRoomNotification',
    'debug', 'isActive',
    'patientAddedFileData', 'patientAddedFileName',
    'patientRemovedFileData', 'patientRemovedFileName',
    'examRoomNotificationFileData', 'examRoomNotificationFileName',
];

function applySettings(result) {
    cfg.chimeVolume                = result.chimeVolume                ?? 0.5;
    cfg.patientAddedVolume         = result.patientAddedVolume         ?? 1.0;
    cfg.patientRemovedVolume       = result.patientRemovedVolume       ?? 1.0;
    cfg.examRoomNotificationVolume = result.examRoomNotificationVolume ?? 1.0;
    cfg.enablePatientAdded         = result.enablePatientAdded         !== false;
    cfg.enablePatientRemoved       = result.enablePatientRemoved       !== false;
    cfg.enableExamRoomNotification = result.enableExamRoomNotification !== false;
    cfg.debug                      = result.debug                      ?? false;
}

function loadSettings(cb) {
    safeChrome(() => chrome.storage.local.get(ALL_KEYS, result => {
        applySettings(result);
        loadSounds(result);
        if (cb) cb(result.isActive !== false);
    }));
}

safeChrome(() => chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    const cfgKeys = ['chimeVolume','patientAddedVolume','patientRemovedVolume','examRoomNotificationVolume',
                     'enablePatientAdded','enablePatientRemoved','enableExamRoomNotification','debug'];
    const cfgMap  = { chimeVolume: 'chimeVolume', patientAddedVolume: 'patientAddedVolume',
                      patientRemovedVolume: 'patientRemovedVolume', examRoomNotificationVolume: 'examRoomNotificationVolume',
                      enablePatientAdded: 'enablePatientAdded', enablePatientRemoved: 'enablePatientRemoved',
                      enableExamRoomNotification: 'enableExamRoomNotification', debug: 'debug' };
    for (const k of cfgKeys) {
        if (changes[k]) cfg[k] = changes[k].newValue;
    }

    // Reload sounds if any sound file or name changed
    const soundKeys = ['patientAddedFileData','patientAddedFileName','patientRemovedFileData',
                       'patientRemovedFileName','examRoomNotificationFileData','examRoomNotificationFileName'];
    if (soundKeys.some(k => changes[k])) {
        safeChrome(() => chrome.storage.local.get(soundKeys, r => loadSounds(r)));
    }

    if (changes.isActive) {
        const on = changes.isActive.newValue;
        if (!on && isMonitoring) stopMonitoring();
        else if (on && !isMonitoring && userActivated) startMonitoring();
    }
}));

// ─── Audio ────────────────────────────────────────────────────────────────────
// 3-item queue, sequential. Clone so rapid events don't cut each other off.

const audioEl = { patientAdded: new Audio(), patientRemoved: new Audio(), examRoomNotification: new Audio() };
const audioQueue = [];
const QUEUE_MAX = 3;
let audioPlaying = false;

function extURL(filename) {
    try { return chrome.runtime.getURL(filename); }
    catch { log('ERROR', 'Audio', 'Extension context invalidated — cannot resolve URL'); return ''; }
}

function loadSounds(result) {
    audioEl.patientAdded.src          = result.patientAddedFileData         || extURL(result.patientAddedFileName         || 'BuddyIn.mp3');
    audioEl.patientRemoved.src        = result.patientRemovedFileData       || extURL(result.patientRemovedFileName       || 'Goodbye.mp3');
    audioEl.examRoomNotification.src  = result.examRoomNotificationFileData || extURL(result.examRoomNotificationFileName || '3_tone_chime-99718.mp3');
    for (const a of Object.values(audioEl)) a.load();
}

const volKey = { patientAdded: 'patientAddedVolume', patientRemoved: 'patientRemovedVolume', examRoomNotification: 'examRoomNotificationVolume' };
const enKey  = { patientAdded: 'enablePatientAdded', patientRemoved: 'enablePatientRemoved', examRoomNotification: 'enableExamRoomNotification' };

function playChime(type) {
    if (!cfg[enKey[type]]) return;
    if (!audioEl[type]?.src) return;
    if (audioQueue.length >= QUEUE_MAX) { log('WARN', 'Audio', `Queue full, dropping ${type}`); return; }
    audioQueue.push(type);
    if (!audioPlaying) drainQueue();
}

function drainQueue() {
    if (!audioQueue.length) { audioPlaying = false; return; }
    audioPlaying = true;
    const type = audioQueue.shift();
    if (!audioEl[type]?.src) { drainQueue(); return; }
    const clone = audioEl[type].cloneNode();
    clone.volume = Math.min(1, cfg.chimeVolume * (cfg[volKey[type]] ?? 1.0));
    clone.onended = drainQueue;
    clone.onerror = () => { log('ERROR', 'Audio', `Playback error for ${type}`); drainQueue(); };
    clone.play().catch(err => { log('ERROR', 'Audio', `play() failed for ${type}`, { error: err.message }); drainQueue(); });
}

// ─── Patient Tracking ─────────────────────────────────────────────────────────

const patients = {};       // { [name]: { InExamRoom, criticalNotes, missed, due, timeSlots } }
let prevNames  = new Set();
let timeSlots  = [];
const TIME_RE  = /^\d{1,2}:\d{2}(am|pm)$/i;

function getPatientList() {
    return document.querySelector('div[data-testid="PatientList"]');
}

function scanTimeSlots() {
    if (timeSlots.length) return;
    timeSlots = Array.from(document.querySelectorAll('div[data-testid]'))
        .map(el => el.getAttribute('data-testid'))
        .filter(id => TIME_RE.test(id));
}

function isInExamRoom(card) {
    for (const node of card.querySelectorAll('*:not(script):not(style)')) {
        if (node.textContent.trim().startsWith('Exam, ')) return true;
    }
    return false;
}

function findNameInSubtree(el) {
    if (!el) return null;
    const m = el.textContent.trim().match(/^"(.+)"(?: [A-Za-z'\s]+)?$/);
    if (m) return m[1].replace(/['"]/g, '').trim().toLowerCase();
    for (const child of el.children) {
        const r = findNameInSubtree(child);
        if (r) return r;
    }
    return null;
}

function findPatientInfo(card) {
    const avatar = card.querySelector('div[aria-label="avatarWithMessage"]');
    if (!avatar) return null;
    for (const sib of Array.from(avatar.parentElement.children).filter(c => c !== avatar)) {
        const raw = findNameInSubtree(sib);
        if (!raw) continue;
        for (const stored of Object.keys(patients)) {
            if (stored.includes(raw) || raw.includes(stored)) {
                const inRoom = isInExamRoom(card);
                patients[stored].InExamRoom = inRoom;
                return { name: stored, InExamRoom: inRoom };
            }
        }
        return { name: raw, InExamRoom: isInExamRoom(card) };
    }
    return null;
}

function initPatient(name, inRoom) {
    const slotData = {};
    timeSlots.forEach(s => { slotData[s] = { hasNotification: false }; });
    patients[name] = {
        InExamRoom: inRoom,
        criticalNotes: { hasNotification: false },
        missed:        { hasNotification: false },
        due:           { hasNotification: false },
        timeSlots: slotData,
    };
}

function hasGrandchild(node) {
    for (const child of node.children) {
        if (child.children.length > 0) return true;
    }
    return false;
}

function checkNotifications(card) {
    const info = findPatientInfo(card);
    if (!info || !patients[info.name]) return;
    const { name } = info;
    const bar = card.nextElementSibling;
    if (!bar?.children[0]) return;

    const cats = ['criticalNotes', 'missed', 'due'];
    Array.from(bar.children[0].children).forEach((child, i) => {
        if (i < cats.length) {
            const cat = cats[i];
            if (cat === 'criticalNotes') return; // silenced per current design
            const hasNew = hasGrandchild(child);
            if (hasNew && !patients[name][cat]?.hasNotification && patients[name].InExamRoom) {
                playChime('examRoomNotification');
                log('EVENT', 'Patient', 'Exam room notification', { name, category: cat });
            }
            patients[name][cat] = { hasNotification: hasNew };
        } else {
            const slot = timeSlots[i - cats.length];
            if (!slot) return;
            const hasNew = hasGrandchild(child);
            if (hasNew && !patients[name].timeSlots[slot]?.hasNotification && patients[name].InExamRoom) {
                playChime('examRoomNotification');
                log('EVENT', 'Patient', 'Time slot notification', { name, slot });
            }
            patients[name].timeSlots[slot] = { hasNotification: hasNew };
        }
    });
}

function runUpdate() {
    const list = getPatientList();
    if (!list) { log('INFO', 'Patient', 'PatientList not in DOM'); return; }

    scanTimeSlots();

    const cards   = Array.from(list.querySelectorAll('div[aria-label="Patient List Item"]'));
    const current = new Set();

    for (const card of cards) {
        const info = findPatientInfo(card);
        if (!info) continue;
        const { name, InExamRoom } = info;
        current.add(name);

        if (patients[name]) {
            patients[name].InExamRoom = InExamRoom;
        } else {
            initPatient(name, InExamRoom);
            if (InExamRoom) {
                playChime('patientAdded');
                log('EVENT', 'Patient', 'Added — entered exam room', { name });
            } else {
                log('INFO', 'Patient', 'Added — waiting room', { name });
            }
        }
    }

    for (const name of [...prevNames].filter(n => !current.has(n))) {
        const wasInRoom = patients[name]?.InExamRoom;
        delete patients[name];
        if (wasInRoom) {
            playChime('patientRemoved');
            log('EVENT', 'Patient', 'Removed — was in exam room', { name });
        } else {
            log('INFO', 'Patient', 'Removed — was in waiting room', { name });
        }
    }

    for (const card of cards) {
        const info = findPatientInfo(card);
        if (info && patients[info.name]?.InExamRoom) checkNotifications(card);
    }

    prevNames = new Set(current);
}

// ─── Observer & Watcher ───────────────────────────────────────────────────────

let observer   = null;
let listWatcher = null;

function onMutation() {
    try {
        runUpdate();
        errCount = 0;
        updateCount++;
        lastUpdate = Date.now();

        if (updateCount === 1) reportStatus('active');
        if (updateCount % 30 === 0) log('INFO', 'Monitor', `Alive — update #${updateCount}`);

        const n = Object.keys(patients).length;
        const w = document.getElementById('vr-monitor-widget');
        if (w) w.title = `VetRadar Monitoring — Active\n${n} patient${n !== 1 ? 's' : ''} | update #${updateCount}`;
        setWidgetState('active');
    } catch (err) {
        errCount++;
        log('ERROR', 'Monitor', 'runUpdate threw', { message: err.message, stack: err.stack });
        if (errCount >= MAX_ERRORS) { setWidgetState('error'); reportStatus('error'); }
    }
}

function startObserver(patientList) {
    if (observer) observer.disconnect();
    let deb = null;
    observer = new MutationObserver(() => { clearTimeout(deb); deb = setTimeout(onMutation, 300); });
    observer.observe(patientList, { childList: true, subtree: true, characterData: true });
    log('INFO', 'Monitor', 'Observer attached to PatientList');
    onMutation();

    const parent = patientList.parentElement;
    if (parent) {
        const sentinel = new MutationObserver(() => {
            if (!document.contains(patientList)) {
                sentinel.disconnect();
                if (observer) { observer.disconnect(); observer = null; }
                log('WARN', 'Monitor', 'PatientList left DOM — will reconnect');
                if (isMonitoring) startListWatcher();
            }
        });
        sentinel.observe(parent, { childList: true });
    }
}

function startListWatcher() {
    if (listWatcher) return;
    listWatcher = setInterval(() => {
        if (!isMonitoring) { clearInterval(listWatcher); listWatcher = null; return; }
        const pl = getPatientList();
        if (pl) {
            clearInterval(listWatcher); listWatcher = null;
            log('INFO', 'Monitor', 'PatientList found — connecting observer');
            startObserver(pl);
        }
    }, 1000);
}

function stopObserver() {
    if (observer)     { observer.disconnect(); observer = null; }
    if (listWatcher)  { clearInterval(listWatcher); listWatcher = null; }
}

// ─── Monitor Control ──────────────────────────────────────────────────────────

let isMonitoring  = false;
let userActivated = false;
let updateCount   = 0;
let errCount      = 0;
let lastUpdate    = null;
const MAX_ERRORS  = 5;

function startMonitoring() {
    isMonitoring  = true;
    userActivated = true;
    errCount      = 0;
    updateCount   = 0;
    lastUpdate    = null;
    setWidgetState('active');
    safeChrome(() => chrome.storage.local.set({ vrMonitoringActive: true }));
    log('INFO', 'Monitor', 'Monitoring started');
    startListWatcher();
}

function stopMonitoring() {
    isMonitoring = false;
    stopObserver();
    setWidgetState('inactive');
    reportStatus('inactive');
    safeChrome(() => chrome.storage.local.set({ vrMonitoringActive: false }));
    log('INFO', 'Monitor', 'Monitoring stopped');
}

// ─── Widget ───────────────────────────────────────────────────────────────────

const WIDGET_CSS = `
    #vr-monitor-widget {
        position:fixed; bottom:20px; right:20px; width:44px; height:44px;
        border-radius:50%; border:2px solid rgba(255,255,255,0.8); cursor:pointer;
        z-index:2147483647; display:flex; align-items:center; justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        transition:background-color 0.25s ease, transform 0.1s ease;
        background-color:#b91c1c; user-select:none;
    }
    #vr-monitor-widget:hover { transform:scale(1.1); }
    #vr-monitor-widget.active { background-color:#15803d; }
    #vr-monitor-widget.error  { background-color:#b91c1c; animation:vr-pulse 1.4s ease-in-out infinite; }
    @keyframes vr-pulse {
        0%,100% { box-shadow:0 2px 8px rgba(185,28,28,0.4); }
        50%      { box-shadow:0 0 18px 4px rgba(185,28,28,0.85); }
    }
`;
const ICON_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
const ICON_ON  = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

function injectWidget() {
    if (document.getElementById('vr-monitor-widget')) return;
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    document.head.appendChild(style);
    const w = document.createElement('div');
    w.id = 'vr-monitor-widget';
    w.innerHTML = ICON_OFF;
    w.title = 'VetRadar Monitoring — click to start';
    document.body.appendChild(w);
    w.addEventListener('click', () => isMonitoring ? stopMonitoring() : startMonitoring());
}

function setWidgetState(state) {
    const w = document.getElementById('vr-monitor-widget');
    if (!w) return;
    w.classList.remove('active', 'error');
    if (state === 'active') {
        w.classList.add('active'); w.innerHTML = ICON_ON;
        // tooltip is updated by onMutation with live patient count
    } else if (state === 'error') {
        w.classList.add('error'); w.innerHTML = ICON_OFF;
        w.title = 'VetRadar Monitoring — error (click to retry)';
    } else {
        w.innerHTML = ICON_OFF;
        w.title = 'VetRadar Monitoring — click to start';
    }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function safeChrome(fn) {
    try { return fn(); }
    catch (e) {
        if (e?.message?.includes('invalidated'))
            console.warn('[VR Monitor] Extension context invalidated — reload page.');
        else
            console.error('[VR Monitor] Chrome API error:', e);
    }
}

function reportStatus(status) {
    safeChrome(() => chrome.runtime.sendMessage({ message: 'setStatus', status }, () => { void chrome.runtime.lastError; }));
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

const logBuf = [];
const LOG_MAX = 150;

function log(level, source, message, data) {
    const entry = { t: new Date().toISOString(), level, source, message, ...(data !== undefined ? { data } : {}) };
    logBuf.push(entry);
    if (logBuf.length > LOG_MAX) logBuf.shift();
    if (level === 'ERROR')      console.error(`[VR][${source}]`, message, data ?? '');
    else if (level === 'WARN')  console.warn(`[VR][${source}]`, message, data ?? '');
    else if (cfg.debug)         console.log(`[VR][${source}]`, message, data ?? '');
}

window.VR_Mon_App = {
    status() {
        const n = Object.keys(patients).length;
        const ago = lastUpdate ? `${((Date.now() - lastUpdate) / 1000).toFixed(1)}s ago` : 'never';
        console.group('%c[VR Monitor] Status', 'font-weight:bold;color:#15803d;font-size:13px');
        console.log(`Monitoring      : ${isMonitoring}`);
        console.log(`Observer        : ${observer !== null}`);
        console.log(`PatientList DOM : ${!!getPatientList()}`);
        console.log(`Patients        : ${n} total, ${Object.values(patients).filter(p => p.InExamRoom).length} in exam room`);
        console.log(`Updates         : ${updateCount} ok, ${errCount} consecutive errors`);
        console.log(`Last update     : ${ago}`);
        console.log('Config:', { ...cfg });
        console.log('Patients:', { ...patients });
        console.groupEnd();
        return { isMonitoring, observerAttached: observer !== null, patientListInDOM: !!getPatientList(), patients, updateCount, errCount };
    },
    getLogs(n = 50) {
        const entries = logBuf.slice(-n);
        console.group(`%c[VR Monitor] Last ${entries.length} entries`, 'font-weight:bold;font-size:13px');
        entries.forEach(e => {
            const style = e.level === 'ERROR' ? 'color:#ef4444' : e.level === 'WARN' ? 'color:#f59e0b' : e.level === 'EVENT' ? 'color:#3b82f6' : '';
            console.log(`%c${e.t.slice(11, 23)} [${e.level}][${e.source}] ${e.message}`, style, e.data ?? '');
        });
        console.groupEnd();
        return entries;
    },
    copyReport() {
        const ago = lastUpdate ? `${((Date.now() - lastUpdate) / 1000).toFixed(1)}s ago` : 'never';
        const lines = [
            '=== VetRadar Monitor Diagnostic Report ===',
            `Generated : ${new Date().toISOString()}`,
            `URL       : ${location.href}`, '',
            '--- Status ---',
            `Monitoring      : ${isMonitoring}`,
            `Observer        : ${observer !== null}`,
            `PatientList DOM : ${!!getPatientList()}`,
            `Patients        : ${Object.keys(patients).length} (${Object.values(patients).filter(p => p.InExamRoom).length} in exam room)`,
            `Updates         : ${updateCount} ok, ${errCount} consecutive errors`,
            `Last update     : ${ago}`, '',
            '--- Config ---',
            ...Object.entries(cfg).map(([k, v]) => `${k}: ${v}`), '',
            '--- Recent Logs ---',
            ...logBuf.slice(-100).map(e => `${e.t.slice(11, 23)} [${e.level}][${e.source}] ${e.message}${e.data ? ' ' + JSON.stringify(e.data) : ''}`), '',
            '--- Patient Data ---',
            JSON.stringify(patients, null, 2),
        ];
        const text = lines.join('\n');
        navigator.clipboard.writeText(text)
            .then(() => console.log('[VR Monitor] Report copied to clipboard.'))
            .catch(() => console.log('[VR Monitor] Clipboard blocked:\n', text));
        return text;
    },
    _log: log,
};

// ─── Startup ──────────────────────────────────────────────────────────────────

function init() {
    injectWidget();
    loadSettings(extensionEnabled => {
        if (!extensionEnabled) { setWidgetState('inactive'); return; }
        safeChrome(() => chrome.storage.local.get('vrMonitoringActive', r => {
            if (r.vrMonitoringActive === true) startMonitoring();
        }));
    });
}

if (document.readyState === 'complete') {
    init();
} else {
    document.addEventListener('readystatechange', function h() {
        if (document.readyState === 'complete') { document.removeEventListener('readystatechange', h); init(); }
    });
}
