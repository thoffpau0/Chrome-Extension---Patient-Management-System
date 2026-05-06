// content.js

window.VR_Mon_App = window.VR_Mon_App || {};
window.debug = false;

let isActive = false;
let isMonitoringStarted = false;
let patientObserver = null;
let patientListWatcher = null;
let consecutiveErrors = 0;
let pollCount = 0;
let lastUpdateTime = null;
const MAX_CONSECUTIVE_ERRORS = 5;

// Guards against extension context invalidation after Chrome auto-updates the extension
function safeChromeCall(fn) {
    try {
        return fn();
    } catch (e) {
        if (e && e.message && e.message.includes('invalidated')) {
            console.warn('[VR Monitor] Extension context invalidated — reload the page to restore monitoring.');
        } else {
            console.error('[VR Monitor] Chrome API error:', e);
        }
        return null;
    }
}

function reportStatus(status) {
    safeChromeCall(() => {
        chrome.runtime.sendMessage({ message: 'setStatus', status }, () => {
            void chrome.runtime.lastError; // swallow — service worker may be sleeping
        });
    });
}

// ─── Diagnostic Log Buffer ────────────────────────────────────────────────────
// Keeps the last 150 structured events in memory. Survives page interactions.
// Access via: window.VR_Mon_App.getLogs() or window.VR_Mon_App.status()

const LOG_MAX = 150;
window.VR_Mon_App._logs = window.VR_Mon_App._logs || [];

function logEvent(level, source, message, data) {
    const entry = {
        t: new Date().toISOString(),
        level,   // 'INFO' | 'WARN' | 'ERROR' | 'EVENT'
        source,
        message,
        ...(data !== undefined ? { data } : {}),
    };
    window.VR_Mon_App._logs.push(entry);
    if (window.VR_Mon_App._logs.length > LOG_MAX) window.VR_Mon_App._logs.shift();

    if (level === 'ERROR') {
        console.error(`[VR][${source}]`, message, data ?? '');
    } else if (level === 'WARN') {
        console.warn(`[VR][${source}]`, message, data ?? '');
    } else if (window.debug) {
        console.log(`[VR][${source}]`, message, data ?? '');
    }
}

// Shared hook so patientManager.js can write into the same buffer
window.VR_Mon_App._logEvent = logEvent;

// ─── Floating Widget ──────────────────────────────────────────────────────────

const WIDGET_STYLES = `
    #vr-monitor-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.8);
        cursor: pointer;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        transition: background-color 0.25s ease, transform 0.1s ease;
        background-color: #b91c1c;
        user-select: none;
    }
    #vr-monitor-widget:hover { transform: scale(1.1); }
    #vr-monitor-widget.active { background-color: #15803d; }
    #vr-monitor-widget.error {
        background-color: #b91c1c;
        animation: vr-pulse 1.4s ease-in-out infinite;
    }
    @keyframes vr-pulse {
        0%,100% { box-shadow: 0 2px 8px rgba(185,28,28,0.4); }
        50%      { box-shadow: 0 0 18px 4px rgba(185,28,28,0.85); }
    }
`;

// Muted speaker (red state)
const ICON_MUTED = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
// Active speaker with waves (green state)
const ICON_ACTIVE = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

function injectWidget() {
    if (document.getElementById('vr-monitor-widget')) return;

    const style = document.createElement('style');
    style.textContent = WIDGET_STYLES;
    document.head.appendChild(style);

    const widget = document.createElement('div');
    widget.id = 'vr-monitor-widget';
    widget.innerHTML = ICON_MUTED;
    widget.title = 'VetRadar Monitoring — click to start';
    document.body.appendChild(widget);
    widget.addEventListener('click', handleWidgetClick);
}

function setWidgetState(state) {
    const widget = document.getElementById('vr-monitor-widget');
    if (!widget) return;
    widget.classList.remove('active', 'error');
    if (state === 'active') {
        widget.classList.add('active');
        widget.innerHTML = ICON_ACTIVE;
        widget.title = 'VetRadar Monitoring — active (click to stop)';
    } else if (state === 'error') {
        widget.classList.add('error');
        widget.innerHTML = ICON_MUTED;
        widget.title = 'VetRadar Monitoring — error detected (click to retry)';
    } else {
        widget.innerHTML = ICON_MUTED;
        widget.title = 'VetRadar Monitoring — click to start';
    }
}

function handleWidgetClick() {
    if (isActive) {
        stopMonitoring();
    } else {
        startMonitoring();
    }
}

// ─── Monitoring Control ───────────────────────────────────────────────────────

function startMonitoring() {
    isActive = true;
    isMonitoringStarted = true;
    consecutiveErrors = 0;
    pollCount = 0;
    lastUpdateTime = null;
    setWidgetState('active');
    safeChromeCall(() => chrome.storage.local.set({ vrMonitoringActive: true }));
    logEvent('INFO', 'Monitor', 'Monitoring started');
    loadSettings();
}

function stopMonitoring() {
    isActive = false;
    stopObserver();
    setWidgetState('inactive');
    reportStatus('inactive');
    safeChromeCall(() => chrome.storage.local.set({ vrMonitoringActive: false }));
    logEvent('INFO', 'Monitor', 'Monitoring stopped by user');
}

// ─── MutationObserver ─────────────────────────────────────────────────────────

function runUpdate() {
    const PatientManager = window.VR_Mon_App && window.VR_Mon_App.PatientManager;
    if (!PatientManager) {
        logEvent('ERROR', 'Monitor', 'PatientManager not available — patientManager.js may not have loaded');
        return;
    }
    try {
        PatientManager.updatePatientDataToMatchScreen();
        lastUpdateTime = Date.now();
        consecutiveErrors = 0;
        pollCount++;

        if (pollCount === 1) {
            logEvent('INFO', 'Monitor', 'First successful update — monitoring is running');
            reportStatus('active');
        } else if (pollCount % 30 === 0) {
            logEvent('INFO', 'Monitor', `Alive — update #${pollCount}`);
        }

        // Update tooltip with live patient count
        const allPatients = PatientManager.getAllPatientData();
        const count = Object.keys(allPatients).length;
        const widget = document.getElementById('vr-monitor-widget');
        if (widget) {
            widget.title = `VetRadar Monitoring — Active\n${count} patient${count !== 1 ? 's' : ''} tracked | update #${pollCount}`;
        }
    } catch (err) {
        consecutiveErrors++;
        logEvent('ERROR', 'Monitor', `Update error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`, { message: err.message, stack: err.stack });
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            setWidgetState('error');
            reportStatus('error');
        }
    }
}

function startObserver(patientList) {
    if (patientObserver) patientObserver.disconnect();

    let debounce = null;
    patientObserver = new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(runUpdate, 300);
    });

    patientObserver.observe(patientList, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    // Run once immediately so we capture current state
    logEvent('INFO', 'Monitor', 'MutationObserver attached to PatientList');
    runUpdate();

    // Watch the parent so we know if React unmounts the patient list (SPA navigation)
    const parent = patientList.parentElement;
    if (parent) {
        const sentinelObserver = new MutationObserver(() => {
            if (!document.contains(patientList)) {
                sentinelObserver.disconnect();
                if (patientObserver) {
                    patientObserver.disconnect();
                    patientObserver = null;
                }
                logEvent('WARN', 'Monitor', 'PatientList removed from DOM (SPA navigation?) — will reconnect');
                if (isActive) startPatientListWatcher();
            }
        });
        sentinelObserver.observe(parent, { childList: true });
    }
}

function stopObserver() {
    if (patientObserver) {
        patientObserver.disconnect();
        patientObserver = null;
    }
    if (patientListWatcher) {
        clearInterval(patientListWatcher);
        patientListWatcher = null;
    }
}

// Polls every 1s (lightweight) until the patient list appears, then hands off to MutationObserver
function startPatientListWatcher() {
    if (patientListWatcher) return;
    patientListWatcher = setInterval(() => {
        if (!isActive) {
            clearInterval(patientListWatcher);
            patientListWatcher = null;
            return;
        }
        const patientList = document.querySelector('div[data-testid="PatientList"]');
        if (patientList) {
            clearInterval(patientListWatcher);
            patientListWatcher = null;
            logEvent('INFO', 'Monitor', 'PatientList found in DOM — connecting observer');
            startObserver(patientList);
        }
    }, 1000);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function loadSettings() {
    safeChromeCall(() => {
        chrome.storage.local.get([
            'chimeVolume',
            'patientAddedVolume',
            'patientRemovedVolume',
            'examRoomNotificationVolume',
            'enablePatientAdded',
            'enablePatientRemoved',
            'enableExamRoomNotification',
            'isActive',
            'debug',
        ], function (result) {
            window.chimeVolume                = result.chimeVolume                !== undefined ? result.chimeVolume                : 0.5;
            window.patientAddedVolume         = result.patientAddedVolume         !== undefined ? result.patientAddedVolume         : 1.0;
            window.patientRemovedVolume       = result.patientRemovedVolume       !== undefined ? result.patientRemovedVolume       : 1.0;
            window.examRoomNotificationVolume = result.examRoomNotificationVolume !== undefined ? result.examRoomNotificationVolume : 1.0;
            window.enablePatientAdded         = result.enablePatientAdded         !== false;
            window.enablePatientRemoved       = result.enablePatientRemoved       !== false;
            window.enableExamRoomNotification = result.enableExamRoomNotification !== false;
            window.debug                      = result.debug                      !== undefined ? result.debug                      : false;

            // Honour the extension's global on/off toggle from background
            const extensionEnabled = result.isActive !== undefined ? result.isActive : true;
            if (!extensionEnabled) {
                isActive = false;
                setWidgetState('inactive');
                return;
            }

            if (isActive) startPatientListWatcher();
        });
    });
}

safeChromeCall(() => {
    chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName !== 'local') return;

        if (changes.chimeVolume)                window.chimeVolume                = changes.chimeVolume.newValue;
        if (changes.patientAddedVolume)         window.patientAddedVolume         = changes.patientAddedVolume.newValue;
        if (changes.patientRemovedVolume)       window.patientRemovedVolume       = changes.patientRemovedVolume.newValue;
        if (changes.examRoomNotificationVolume) window.examRoomNotificationVolume = changes.examRoomNotificationVolume.newValue;
        if (changes.enablePatientAdded)         window.enablePatientAdded         = changes.enablePatientAdded.newValue;
        if (changes.enablePatientRemoved)       window.enablePatientRemoved       = changes.enablePatientRemoved.newValue;
        if (changes.enableExamRoomNotification) window.enableExamRoomNotification = changes.enableExamRoomNotification.newValue;
        if (changes.debug)                      window.debug                      = changes.debug.newValue;

        if (changes.isActive) {
            const extensionEnabled = changes.isActive.newValue;
            if (!extensionEnabled && isActive) {
                stopMonitoring();
            } else if (extensionEnabled && isMonitoringStarted && !isActive) {
                startMonitoring();
            }
        }
    });
});

// ─── Public Diagnostic API ────────────────────────────────────────────────────
// Run any of these from the browser DevTools console on a VetRadar tab:
//   window.VR_Mon_App.status()       → formatted state dump
//   window.VR_Mon_App.getLogs(50)    → last N log entries, color-coded
//   window.VR_Mon_App.copyReport()   → full diagnostic report copied to clipboard

window.VR_Mon_App.status = function () {
    const PM = window.VR_Mon_App.PatientManager;
    const patients = PM ? PM.getAllPatientData() : {};
    const names = Object.keys(patients);
    const inRoom = names.filter(n => patients[n].InExamRoom);
    const patientListInDOM = !!document.querySelector('div[data-testid="PatientList"]');
    const secAgo = lastUpdateTime
        ? `${((Date.now() - lastUpdateTime) / 1000).toFixed(1)}s ago`
        : 'never';

    console.group('%c[VR Monitor] Status Report', 'font-weight:bold;color:#15803d;font-size:13px');
    console.log(`Monitoring active : ${isActive}`);
    console.log(`Observer attached : ${patientObserver !== null}`);
    console.log(`PatientList in DOM: ${patientListInDOM}`);
    console.log(`Patients tracked  : ${names.length} total, ${inRoom.length} in exam room`);
    console.log(`Updates           : ${pollCount} successful, ${consecutiveErrors} consecutive errors`);
    console.log(`Last update       : ${secAgo}`);
    console.log('Settings:', {
        debug: window.debug,
        chimeVolume: window.chimeVolume,
        enablePatientAdded: window.enablePatientAdded,
        enablePatientRemoved: window.enablePatientRemoved,
        enableExamRoomNotification: window.enableExamRoomNotification,
    });
    console.log('Patient data:', patients);
    console.groupEnd();
    return { isActive, observerAttached: patientObserver !== null, patientListInDOM, patients, pollCount, consecutiveErrors, lastUpdateTime };
};

window.VR_Mon_App.getLogs = function (n = 50) {
    const entries = window.VR_Mon_App._logs.slice(-n);
    console.group(`%c[VR Monitor] Last ${entries.length} log entries`, 'font-weight:bold;font-size:13px');
    entries.forEach(e => {
        const ts = e.t.slice(11, 23);
        const style = e.level === 'ERROR' ? 'color:#ef4444'
            : e.level === 'WARN'  ? 'color:#f59e0b'
            : e.level === 'EVENT' ? 'color:#3b82f6'
            : 'color:inherit';
        console.log(`%c${ts} [${e.level}][${e.source}] ${e.message}`, style, e.data ?? '');
    });
    console.groupEnd();
    return entries;
};

window.VR_Mon_App.copyReport = function () {
    const PM = window.VR_Mon_App.PatientManager;
    const patients = PM ? PM.getAllPatientData() : {};
    const patientListInDOM = !!document.querySelector('div[data-testid="PatientList"]');
    const secAgo = lastUpdateTime
        ? `${((Date.now() - lastUpdateTime) / 1000).toFixed(1)}s ago`
        : 'never';

    const lines = [
        '=== VetRadar Monitor Diagnostic Report ===',
        `Generated : ${new Date().toISOString()}`,
        `Page URL  : ${location.href}`,
        '',
        '--- Status ---',
        `Monitoring active : ${isActive}`,
        `Observer attached : ${patientObserver !== null}`,
        `PatientList in DOM: ${patientListInDOM}`,
        `Patients tracked  : ${Object.keys(patients).length}`,
        `In exam room      : ${Object.values(patients).filter(p => p.InExamRoom).length}`,
        `Update count      : ${pollCount}`,
        `Consecutive errors: ${consecutiveErrors}`,
        `Last update       : ${secAgo}`,
        '',
        '--- Settings ---',
        `debug                      : ${window.debug}`,
        `chimeVolume                : ${window.chimeVolume}`,
        `enablePatientAdded         : ${window.enablePatientAdded}`,
        `enablePatientRemoved       : ${window.enablePatientRemoved}`,
        `enableExamRoomNotification : ${window.enableExamRoomNotification}`,
        '',
        '--- Recent Logs (last 100) ---',
        ...window.VR_Mon_App._logs.slice(-100).map(e =>
            `${e.t.slice(11, 23)} [${e.level}][${e.source}] ${e.message}${e.data !== undefined ? ' ' + JSON.stringify(e.data) : ''}`
        ),
        '',
        '--- Patient Data ---',
        JSON.stringify(patients, null, 2),
    ];

    const text = lines.join('\n');
    navigator.clipboard.writeText(text)
        .then(() => console.log('[VR Monitor] Diagnostic report copied to clipboard — paste it anywhere.'))
        .catch(() => console.log('[VR Monitor] Clipboard write blocked. Full report:\n', text));
    return text;
};

// ─── Startup ──────────────────────────────────────────────────────────────────

function initializeContentScript() {
    injectWidget();

    safeChromeCall(() => {
        chrome.storage.local.get(['vrMonitoringActive', 'isActive'], function (result) {
            const extensionEnabled = result.isActive         !== undefined ? result.isActive         : true;
            const monitoringActive = result.vrMonitoringActive === true;

            if (!extensionEnabled) {
                setWidgetState('inactive');
                return;
            }

            if (monitoringActive) {
                // User previously activated on this device — auto-start without requiring a click
                startMonitoring();
            }
            // Otherwise widget stays red, waiting for the user's first click
        });
    });
}

function onReadyStateChange() {
    if (document.readyState === 'complete') {
        document.removeEventListener('readystatechange', onReadyStateChange);
        initializeContentScript();
    }
}

document.addEventListener('readystatechange', onReadyStateChange);
if (document.readyState === 'complete') {
    onReadyStateChange();
}
