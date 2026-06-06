// options.js — VetRadar Extension Settings
'use strict';

// ─── Sound config ─────────────────────────────────────────────────────────────

const SOUNDS = {
    examRoomNotification: {
        label:    'Exam Room Notification',
        defaults: { enabled: true, fileName: '3_tone_chime-99718.mp3', fileData: null, volume: 0.5 },
        keys:     { enabled: 'enableExamRoomNotification', fileName: 'examRoomNotificationFileName',
                    fileData: 'examRoomNotificationFileData', volume: 'examRoomNotificationVolume' },
    },
    patientAdded: {
        label:    'Patient Added',
        defaults: { enabled: true, fileName: 'BuddyIn.mp3', fileData: null, volume: 1.0 },
        keys:     { enabled: 'enablePatientAdded', fileName: 'patientAddedFileName',
                    fileData: 'patientAddedFileData', volume: 'patientAddedVolume' },
    },
    patientRemoved: {
        label:    'Patient Removed',
        defaults: { enabled: true, fileName: 'Goodbye.mp3', fileData: null, volume: 1.0 },
        keys:     { enabled: 'enablePatientRemoved', fileName: 'patientRemovedFileName',
                    fileData: 'patientRemovedFileData', volume: 'patientRemovedVolume' },
    },
    taskCompleted: {
        label:    'Task Completed',
        defaults: { enabled: true, fileName: 'mixkit-bell-notification-933.mp3', fileData: null, volume: 1.0 },
        keys:     { enabled: 'enableTaskCompleted', fileName: 'taskCompletedFileName',
                    fileData: 'taskCompletedFileData', volume: 'taskCompletedVolume' },
    },
};

// ─── DOM helpers ──────────────────────────────────────────────────────────────

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const el  = id => document.getElementById(id);
const pct = v  => Math.round(v * 100) + '%';

function soundEls(key) {
    return {
        checkbox:  el(`enable${cap(key)}`),
        dropdown:  el(`library${cap(key)}`),
        volSlider: el(`volumeLibrary${cap(key)}`),
        volValue:  el(`volumeLibrary${cap(key)}Value`),
        dropzone:  el(`dropzone${cap(key)}`),
        resetBtn:  el(`reset${cap(key)}`),
        playBtn:   el(`playLibrary${cap(key)}`),
    };
}

// ─── Save / Load / Reset ──────────────────────────────────────────────────────

function saveAllSettings() {
    const data = { chimeVolume: parseFloat(el('volumeSlider').value) };
    for (const [key, sound] of Object.entries(SOUNDS)) {
        const e = soundEls(key);
        data[sound.keys.enabled]  = e.checkbox.checked;
        data[sound.keys.fileName] = e.dropdown.value;
        data[sound.keys.volume]   = parseFloat(e.volSlider.value);
        data[sound.keys.fileData] = e.dropzone.dataset.fileData || null;
    }
    chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) { alert('Error saving settings.'); return; }
        showNotification('Settings saved!');
        if (confirm('Settings saved.\n\nOK to close, Cancel to stay.')) {
            window.close();
        } else {
            el('saveSettings').disabled = true;
        }
    });
}

function loadAllSettings() {
    const keys = ['chimeVolume', ...Object.values(SOUNDS).flatMap(s => Object.values(s.keys))];
    chrome.storage.local.get(keys, result => {
        if (chrome.runtime.lastError) { alert('Error loading settings.'); return; }

        const masterVol = result.chimeVolume ?? 0.5;
        el('volumeSlider').value    = masterVol;
        el('volumeValue').innerText = pct(masterVol);

        for (const [key, sound] of Object.entries(SOUNDS)) {
            const e = soundEls(key);
            const d = sound.defaults;

            e.checkbox.checked   = result[sound.keys.enabled] ?? d.enabled;
            e.dropdown.value     = result[sound.keys.fileName] || d.fileName;
            const vol            = result[sound.keys.volume] ?? d.volume;
            e.volSlider.value    = vol;
            e.volValue.innerText = pct(vol);

            if (result[sound.keys.fileData]) {
                e.dropzone.dataset.fileData = result[sound.keys.fileData];
                e.dropzone.textContent      = 'Custom file uploaded';
            } else {
                e.dropzone.dataset.fileData = '';
                e.dropzone.textContent      = 'Drag & drop or click to select a file';
            }
        }
    });
}

function resetAllSettings() {
    if (!confirm('Reset all settings to defaults?')) return;
    const data = { chimeVolume: 0.5 };
    for (const sound of Object.values(SOUNDS)) {
        data[sound.keys.enabled]  = sound.defaults.enabled;
        data[sound.keys.fileName] = sound.defaults.fileName;
        data[sound.keys.volume]   = sound.defaults.volume;
        data[sound.keys.fileData] = null;
    }
    chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) { alert('Error resetting settings.'); return; }
        showNotification('Settings restored to defaults.');
        loadAllSettings();
        el('saveSettings').disabled = true;
    });
}

// ─── Audio preview ────────────────────────────────────────────────────────────

function playSound(key) {
    const sound = SOUNDS[key];
    const e     = soundEls(key);
    const src   = e.dropzone.dataset.fileData || chrome.runtime.getURL(e.dropdown.value || sound.defaults.fileName);
    const audio = new Audio(src);
    audio.volume = parseFloat(el('volumeSlider').value) * parseFloat(e.volSlider.value);
    audio.play().catch(err => alert(`Could not play sound: ${err.message}`));
}

// ─── File handling ────────────────────────────────────────────────────────────

function handleFile(file, dropzone) {
    if (file.type !== 'audio/mp3' && file.type !== 'audio/mpeg') {
        alert('Please upload a valid MP3 file.');
        return;
    }
    const reader   = new FileReader();
    reader.onload  = e => { dropzone.dataset.fileData = e.target.result; dropzone.textContent = 'Custom file uploaded'; markChanged(); };
    reader.onerror = () => alert('Error reading file.');
    reader.readAsDataURL(file);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function markChanged() { el('saveSettings').disabled = false; }

function showNotification(msg) {
    const n = document.createElement('div');
    Object.assign(n.style, {
        position: 'fixed', bottom: '20px', right: '20px', padding: '10px 20px',
        backgroundColor: '#4CAF50', color: '#fff', borderRadius: '5px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: '1000',
    });
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadAllSettings();

    el('volumeSlider').addEventListener('input', () => {
        el('volumeValue').innerText = pct(parseFloat(el('volumeSlider').value));
        markChanged();
    });

    for (const key of Object.keys(SOUNDS)) {
        const e     = soundEls(key);
        const sound = SOUNDS[key];

        e.checkbox.addEventListener('change', markChanged);
        e.dropdown.addEventListener('change', markChanged);
        e.volSlider.addEventListener('input', () => {
            e.volValue.innerText = pct(parseFloat(e.volSlider.value));
            markChanged();
        });

        e.resetBtn.addEventListener('click', () => {
            chrome.storage.local.remove([sound.keys.fileName, sound.keys.fileData, sound.keys.volume, sound.keys.enabled], () => {
                if (chrome.runtime.lastError) { alert('Error resetting.'); return; }
                showNotification(`"${sound.label}" reset to default.`);
                loadAllSettings();
            });
        });

        e.playBtn.addEventListener('click', () => playSound(key));

        e.dropzone.addEventListener('dragover',  ev => { ev.preventDefault(); e.dropzone.classList.add('dragover'); });
        e.dropzone.addEventListener('dragleave', ()  => e.dropzone.classList.remove('dragover'));
        e.dropzone.addEventListener('drop', ev => {
            ev.preventDefault();
            e.dropzone.classList.remove('dragover');
            if (ev.dataTransfer.files[0]) handleFile(ev.dataTransfer.files[0], e.dropzone);
        });
        e.dropzone.addEventListener('click', () => {
            const input  = document.createElement('input');
            input.type   = 'file';
            input.accept = 'audio/mp3,audio/mpeg';
            input.onchange = () => { if (input.files[0]) handleFile(input.files[0], e.dropzone); };
            input.click();
        });
    }

    el('saveSettings').addEventListener('click', saveAllSettings);
    el('restoreDefaults').addEventListener('click', resetAllSettings);
});
