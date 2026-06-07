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
    taskCompletedVolume: 1.0,
    enablePatientAdded: true,
    enablePatientRemoved: true,
    enableExamRoomNotification: true,
    enableTaskCompleted: true,
    debug: false,
    isActive: true,
};

const ALL_KEYS = [
    'chimeVolume', 'patientAddedVolume', 'patientRemovedVolume', 'examRoomNotificationVolume', 'taskCompletedVolume',
    'enablePatientAdded', 'enablePatientRemoved', 'enableExamRoomNotification', 'enableTaskCompleted',
    'debug', 'isActive', 'vrMonitoringActive',
    'patientAddedFileData', 'patientAddedFileName',
    'patientRemovedFileData', 'patientRemovedFileName',
    'examRoomNotificationFileData', 'examRoomNotificationFileName',
    'taskCompletedFileData', 'taskCompletedFileName',
];

function applySettings(result) {
    cfg.chimeVolume                = result.chimeVolume                ?? 0.5;
    cfg.patientAddedVolume         = result.patientAddedVolume         ?? 1.0;
    cfg.patientRemovedVolume       = result.patientRemovedVolume       ?? 1.0;
    cfg.examRoomNotificationVolume = result.examRoomNotificationVolume ?? 1.0;
    cfg.taskCompletedVolume        = result.taskCompletedVolume        ?? 1.0;
    cfg.enablePatientAdded         = result.enablePatientAdded         !== false;
    cfg.enablePatientRemoved       = result.enablePatientRemoved       !== false;
    cfg.enableExamRoomNotification = result.enableExamRoomNotification !== false;
    cfg.enableTaskCompleted        = result.enableTaskCompleted        !== false;
    cfg.debug                      = result.debug                      ?? false;
    cfg.isActive                   = result.isActive                   !== false;
}

function loadSettings(cb) {
    safeChrome(() => chrome.storage.local.get(ALL_KEYS, result => {
        applySettings(result);
        loadSounds(result);
        if (cb) cb(result.isActive !== false, result.vrMonitoringActive === true);
    }));
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    const cfgKeys = ['chimeVolume','patientAddedVolume','patientRemovedVolume','examRoomNotificationVolume','taskCompletedVolume',
                     'enablePatientAdded','enablePatientRemoved','enableExamRoomNotification','enableTaskCompleted','debug'];
    for (const k of cfgKeys) {
        if (changes[k]) cfg[k] = changes[k].newValue;
    }

    const soundKeys = ['patientAddedFileData','patientAddedFileName','patientRemovedFileData',
                       'patientRemovedFileName','examRoomNotificationFileData','examRoomNotificationFileName',
                       'taskCompletedFileData','taskCompletedFileName'];
    if (soundKeys.some(k => changes[k])) {
        safeChrome(() => chrome.storage.local.get(soundKeys, r => loadSounds(r)));
    }

    if (changes.isActive) {
        cfg.isActive = changes.isActive.newValue !== false;
        if (!cfg.isActive && isMonitoring) stopMonitoring();
        else if (cfg.isActive && !isMonitoring && userActivated) startMonitoring();
    }
});

// ─── Audio ────────────────────────────────────────────────────────────────────
// 3-item queue, sequential. Clone so rapid events don't cut each other off.

const audioEl = { patientAdded: new Audio(), patientRemoved: new Audio(), examRoomNotification: new Audio(), taskCompleted: new Audio() };
const audioQueue = [];
const QUEUE_MAX = 3;
let audioPlaying = false;

function extURL(filename) {
    try { return chrome.runtime.getURL(filename); }
    catch { log('ERROR', 'Audio', 'Extension context invalidated — cannot resolve URL'); return ''; }
}

function loadSounds(result) {
    audioEl.patientAdded.src          = result.patientAddedFileData         || extURL(result.patientAddedFileName         || 'Audio/BuddyIn.mp3');
    audioEl.patientRemoved.src        = result.patientRemovedFileData       || extURL(result.patientRemovedFileName       || 'Audio/Goodbye.mp3');
    audioEl.examRoomNotification.src  = result.examRoomNotificationFileData || extURL(result.examRoomNotificationFileName || 'Audio/3_tone_chime-99718.mp3');
    audioEl.taskCompleted.src         = result.taskCompletedFileData        || extURL(result.taskCompletedFileName        || 'Audio/mixkit-bell-notification-933.mp3');
    for (const a of Object.values(audioEl)) a.load();
}

const volKey = { patientAdded: 'patientAddedVolume', patientRemoved: 'patientRemovedVolume', examRoomNotification: 'examRoomNotificationVolume', taskCompleted: 'taskCompletedVolume' };
const enKey  = { patientAdded: 'enablePatientAdded', patientRemoved: 'enablePatientRemoved', examRoomNotification: 'enableExamRoomNotification', taskCompleted: 'enableTaskCompleted' };

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
    let advanced = false;
    const advance = () => { if (!advanced) { advanced = true; drainQueue(); } };
    clone.onended = advance;
    clone.onerror = () => { log('ERROR', 'Audio', `Playback error for ${type}`); advance(); };
    clone.play().catch(err => {
        if (err?.name === 'NotAllowedError') {
            audioPrimed = false;   // autoplay gate not unlocked — re-prime on next interaction
            mutedChimeCount++;
            log('WARN', 'Audio', `Autoplay blocked for ${type} — will play after next page interaction (${mutedChimeCount} missed)`);
            if (isMonitoring) { setWidgetState('muted'); updateBadge(); }
        } else {
            log('ERROR', 'Audio', `play() failed for ${type}: ${err.message}`);
        }
        advance();
    });
}

// ─── Patient Tracking ─────────────────────────────────────────────────────────

const patients = {};       // { [name]: { InExamRoom, taskCounts:{active,completed}|null } }
let prevNames  = new Set();

function getPatientList() {
    return document.querySelector('div[data-testid="PatientList"]');
}

function isInExamRoom(card) {
    return card.textContent.includes('Exam, ');
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
            if (stored === raw) return { name: stored, InExamRoom: isInExamRoom(card) };
        }
        for (const stored of Object.keys(patients)) {
            if (stored.startsWith(raw) || raw.startsWith(stored)) {
                return { name: stored, InExamRoom: isInExamRoom(card) };
            }
        }
        return { name: raw, InExamRoom: isInExamRoom(card) };
    }
    log('WARN', 'Patient', 'Could not parse name from card', { preview: card.textContent.slice(0, 80).trim() });
    return null;
}

function initPatient(name, inRoom) {
    patients[name] = { InExamRoom: inRoom, taskCounts: null };
}

function hasGrandchild(node) {
    for (const child of node.children) {
        if (child.children.length > 0) return true;
    }
    return false;
}

function isCellCompleted(cell) {
    return cell.querySelector('svg[data-testid="SvgCheck"]') !== null;
}

// Count task-bearing cells, ignoring the Critical Notes column (always child 0).
// Robust to column shifts and to the grid collapsing to 1 cell when a patient
// has no tasks then expanding to the full column set when the first task lands.
function countTasks(container) {
    let active = 0, completed = 0;
    Array.from(container.children).forEach((cell, i) => {
        if (i === 0) return;              // Critical Notes column — not a task (handled separately later)
        if (!hasGrandchild(cell)) return; // empty time/status cell
        if (isCellCompleted(cell)) completed++;
        else active++;
    });
    return { active, completed };
}

function checkNotifications(card, name) {
    const p = patients[name];
    if (!p) return;

    const container = card.nextElementSibling?.children[0];
    if (!container) {
        log('WARN', 'Patient', 'No task container found', { name });
        return;
    }

    const { active, completed } = countTasks(container);
    const prev = p.taskCounts;

    if (!prev || prev.active !== active || prev.completed !== completed) {
        log('INFO', 'Patient', 'Task counts changed', { name, prev, now: { active, completed } });
    }

    if (initialized && prev) {
        for (let k = prev.active; k < active; k++) {
            playChime('examRoomNotification');
            log('EVENT', 'Patient', 'Task added', { name, active });
        }
        for (let k = prev.completed; k < completed; k++) {
            playChime('taskCompleted');
            log('EVENT', 'Patient', 'Task completed', { name, completed });
        }
    }

    p.taskCounts = { active, completed };
}

function runUpdate() {
    const list = getPatientList();
    if (!list) { log('INFO', 'Patient', 'PatientList not in DOM'); return; }

    const cards     = Array.from(list.querySelectorAll('div[aria-label="Patient List Item"]'));
    const cardInfos = new Map();

    // Parse pass: resolve all patient names before touching any state.
    for (const card of cards) {
        const info = findPatientInfo(card);
        if (info) cardInfos.set(card, info);
    }

    const current = new Set([...cardInfos.values()].map(i => i.name));

    // Never act on an empty scan. The list element can exist before its cards
    // render (startup) or briefly during a VetRadar remount. Acting on zero
    // patients would either flip the baseline (false "Added" for everyone on
    // the next scan) or wipe taskCounts (missed task chimes). Skip entirely —
    // initialized stays false until we actually see a patient.
    if (current.size === 0) {
        if (prevNames.size > 0) log('INFO', 'Patient', 'No parseable patients — skipping (possible remount)');
        return;
    }

    for (const [, info] of cardInfos) {
        const { name, InExamRoom } = info;
        if (patients[name]) {
            patients[name].InExamRoom = InExamRoom;
        } else {
            initPatient(name, InExamRoom);
            if (initialized) {
                playChime('patientAdded');
                log('EVENT', 'Patient', 'Added', { name });
            } else {
                log('INFO', 'Patient', 'Baseline', { name, InExamRoom });
            }
        }
    }

    for (const name of [...prevNames].filter(n => !current.has(n))) {
        delete patients[name];
        playChime('patientRemoved');
        log('EVENT', 'Patient', 'Removed', { name });
    }

    for (const [card, info] of cardInfos) {
        if (patients[info.name]) checkNotifications(card, info.name);
    }

    prevNames    = new Set(current);
    initialized  = true;
}

// ─── Observer & Watcher ───────────────────────────────────────────────────────

let observer   = null;
let listWatcher = null;

function onMutation() {
    try {
        runUpdate();
        const recovering = errCount >= MAX_ERRORS;
        errCount = 0;
        updateCount++;
        lastUpdate = Date.now();

        if (updateCount === 1 || recovering) reportStatus('active');
        if (updateCount % 30 === 0) log('INFO', 'Monitor', `Alive — update #${updateCount}`);

        const n = Object.keys(patients).length;
        const w = document.getElementById('vr-monitor-widget');
        if (audioPrimed) {
            if (w) w.title = `VetRadar Monitoring — Active\n${n} patient${n !== 1 ? 's' : ''} | update #${updateCount}`;
            setWidgetState('active');
        } else {
            setWidgetState('muted');
        }
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

// Play every sound at volume 0 so Chrome's autoplay gate is unlocked before any
// real event fires. Must be called from within a user-gesture handler to work.
// audioPrimed flips to true only when a play() actually resolves, so the widget
// state reflects whether sound will really work.
let audioPrimed = false;
function primeAudio() {
    if (audioPrimed) return;
    for (const a of Object.values(audioEl)) {
        const clone = a.cloneNode();
        clone.volume = 0;
        const p = clone.play();
        if (!p) continue;
        p.then(() => {
            clone.pause();
            if (!audioPrimed) {
                audioPrimed = true;
                mutedChimeCount = 0;
                log('INFO', 'Audio', 'Autoplay gate unlocked — sound enabled');
                if (isMonitoring) { setWidgetState('active'); updateBadge(); }
            }
        }).catch(() => {});
    }
}

let isMonitoring    = false;
let userActivated   = false;
let initialized     = false;
let updateCount     = 0;
let errCount        = 0;
let lastUpdate      = null;
let mutedChimeCount = 0;
const MAX_ERRORS    = 5;

function updateBadge() {
    const w = document.getElementById('vr-monitor-widget');
    if (!w) return;
    if (mutedChimeCount > 0) {
        w.dataset.badge = mutedChimeCount > 9 ? '9+' : String(mutedChimeCount);
    } else {
        delete w.dataset.badge;
    }
}
const INSTANCE_ID = Math.random().toString(36).slice(2, 7);

function startMonitoring() {
    if (!cfg.isActive) { log('WARN', 'Monitor', 'Start blocked — extension disabled via toolbar'); return; }
    isMonitoring  = true;
    userActivated = true;
    initialized   = false;
    errCount      = 0;
    updateCount   = 0;
    lastUpdate    = null;
    Object.keys(patients).forEach(k => delete patients[k]);
    prevNames = new Set();
    mutedChimeCount = 0;
    primeAudio();
    setWidgetState(audioPrimed ? 'active' : 'muted');
    updateBadge();
    safeChrome(() => chrome.storage.local.set({ vrMonitoringActive: true }));
    log('INFO', 'Monitor', 'Monitoring started', { instance: INSTANCE_ID });
    startListWatcher();
}

function stopMonitoring() {
    isMonitoring = false;
    stopObserver();
    audioQueue.length = 0;
    mutedChimeCount = 0;
    setWidgetState('inactive');
    updateBadge();
    reportStatus('inactive');
    safeChrome(() => chrome.storage.local.set({ vrMonitoringActive: false }));
    log('INFO', 'Monitor', 'Monitoring stopped', { instance: INSTANCE_ID });
}

// ─── Widget ───────────────────────────────────────────────────────────────────

const WIDGET_CSS = `
    #vr-monitor-widget {
        position:fixed; bottom:20px; right:20px; width:44px; height:44px;
        border-radius:50%; border:2px solid rgba(255,255,255,0.8); cursor:pointer;
        z-index:2147483647; display:flex; align-items:center; justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        transition:background-color 0.25s ease, transform 0.1s ease;
        background-color:#b91c1c; user-select:none; overflow:visible;
    }
    #vr-monitor-widget:hover { transform:scale(1.1); }
    #vr-monitor-widget.active { background-color:#15803d; }
    #vr-monitor-widget.muted  { background-color:#d97706; animation:vr-pulse-amber 1.6s ease-in-out infinite; }
    #vr-monitor-widget.error  { background-color:#b91c1c; animation:vr-pulse 1.4s ease-in-out infinite; }
    @keyframes vr-pulse {
        0%,100% { box-shadow:0 2px 8px rgba(185,28,28,0.4); }
        50%      { box-shadow:0 0 18px 4px rgba(185,28,28,0.85); }
    }
    @keyframes vr-pulse-amber {
        0%,100% { box-shadow:0 2px 8px rgba(217,119,6,0.4); }
        50%      { box-shadow:0 0 18px 4px rgba(217,119,6,0.85); }
    }
    #vr-monitor-widget[data-badge]::after {
        content: attr(data-badge);
        position:absolute; top:-6px; right:-6px;
        min-width:18px; height:18px; padding:0 4px;
        border-radius:9px; background:#ef4444; color:#fff;
        font-size:10px; font-weight:bold; line-height:18px; text-align:center;
        border:2px solid #fff; box-sizing:border-box; pointer-events:none;
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
    w.addEventListener('click', () => {
        if (w.classList.contains('error') || !isMonitoring) startMonitoring();
        else if (w.classList.contains('muted')) primeAudio();  // enable sound, keep monitoring
        else stopMonitoring();
    });
}

function setWidgetState(state) {
    const w = document.getElementById('vr-monitor-widget');
    if (!w) return;
    w.classList.remove('active', 'error', 'muted');
    if (state === 'active') {
        w.classList.add('active'); w.innerHTML = ICON_ON;
        // tooltip is updated by onMutation with live patient count
    } else if (state === 'muted') {
        w.classList.add('muted'); w.innerHTML = ICON_OFF;
        w.title = 'VetRadar Monitoring — ACTIVE, but sound is paused.\nClick anywhere on the page to enable sound.';
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

// ─── Debug bridge ────────────────────────────────────────────────────────────
// Content scripts run in an isolated JS world. VR_Mon_App is not visible from
// the DevTools console (top context). Dispatch a 'vr-mon-cmd' CustomEvent from
// top to call diagnostic commands without switching console context:
//   window.dispatchEvent(new CustomEvent('vr-mon-cmd', {detail:{cmd:'status'}}))
//   window.dispatchEvent(new CustomEvent('vr-mon-cmd', {detail:{cmd:'logs'}}))
//   window.dispatchEvent(new CustomEvent('vr-mon-cmd', {detail:{cmd:'report'}}))
window.addEventListener('vr-mon-cmd', ev => {
    const cmd = ev?.detail?.cmd;
    if      (cmd === 'status')  VR_Mon_App.status();
    else if (cmd === 'logs')    VR_Mon_App.getLogs(ev.detail.n);
    else if (cmd === 'report')  VR_Mon_App.copyReport();
});

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

    // Unlock Chrome's autoplay gate on user interaction anywhere on the page.
    // Auto-resumed monitoring has no user gesture, so priming inside
    // startMonitoring() alone isn't enough. Listeners stay attached and
    // primeAudio() is a no-op once primed, so if a chime is ever blocked again
    // (audioPrimed reset to false) the next click re-primes.
    document.addEventListener('pointerdown', primeAudio, true);
    document.addEventListener('keydown', primeAudio, true);

    log('INFO', 'Monitor', 'Content script loaded', { instance: INSTANCE_ID, frame: window === window.top ? 'top' : 'iframe', url: location.href });

    loadSettings((extensionEnabled, monitoringActive) => {
        if (!extensionEnabled) { setWidgetState('inactive'); return; }
        if (monitoringActive) startMonitoring();
    });
}

init();
