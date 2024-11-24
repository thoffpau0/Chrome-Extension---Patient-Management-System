document.addEventListener('DOMContentLoaded', () => {
    const saveSettings = document.getElementById('saveSettings');
    const restoreDefaults = document.getElementById('restoreDefaults');
    const masterVolumeSlider = document.getElementById('volumeSlider');
    const masterVolumeValue = document.getElementById('volumeValue');

    const soundLibrary = {
        notification: {
            enableCheckbox: document.getElementById('enableNotification'),
            selectDropdown: document.getElementById('libraryNotification'),
            volumeSlider: document.getElementById('volumeLibraryNotification'),
            volumeValue: document.getElementById('volumeLibraryNotificationValue'),
            dropzone: document.getElementById('dropzoneNotification'),
            resetButton: document.getElementById('resetNotification'),
            playButton: document.getElementById('playLibraryNotification'),
            storageKeys: {
                enabled: 'enableNotification',
                fileName: 'notificationFileName',
                fileData: 'notificationFileData',
                volume: 'notificationVolume',
            },
            defaultValues: {
                enabled: true,
                fileName: 'default_notification.mp3',
                fileData: null,
                volume: 0.5,
            },
        },
        patientAdded: {
            enableCheckbox: document.getElementById('enablePatientAdded'),
            selectDropdown: document.getElementById('libraryPatientAdded'),
            volumeSlider: document.getElementById('volumeLibraryPatientAdded'),
            volumeValue: document.getElementById('volumeLibraryPatientAddedValue'),
            dropzone: document.getElementById('dropzonePatientAdded'),
            resetButton: document.getElementById('resetPatientAdded'),
            playButton: document.getElementById('playLibraryPatientAdded'),
            storageKeys: {
                enabled: 'enablePatientAdded',
                fileName: 'patientAddedFileName',
                fileData: 'patientAddedFileData',
                volume: 'patientAddedVolume',
            },
            defaultValues: {
                enabled: true,
                fileName: 'BuddyIn.mp3',
                fileData: null,
                volume: 0.5,
            },
        },
        patientRemoved: {
            enableCheckbox: document.getElementById('enablePatientRemoved'),
            selectDropdown: document.getElementById('libraryPatientRemoved'),
            volumeSlider: document.getElementById('volumeLibraryPatientRemoved'),
            volumeValue: document.getElementById('volumeLibraryPatientRemovedValue'),
            dropzone: document.getElementById('dropzonePatientRemoved'),
            resetButton: document.getElementById('resetPatientRemoved'),
            playButton: document.getElementById('playLibraryPatientRemoved'),
            storageKeys: {
                enabled: 'enablePatientRemoved',
                fileName: 'patientRemovedFileName',
                fileData: 'patientRemovedFileData',
                volume: 'patientRemovedVolume',
            },
            defaultValues: {
                enabled: true,
                fileName: 'Goodbye.mp3',
                fileData: null,
                volume: 0.5,
            },
        },
    };

    let settingsChanged = false;

    // Updates Save Settings button state
    function updateSaveButton() {
        settingsChanged = true;
        saveSettings.disabled = false;
    }

    // Saves current settings to Chrome local storage
    function saveAllSettings() {
        const settings = { chimeVolume: parseFloat(masterVolumeSlider.value) };
        for (const key in soundLibrary) {
            const sound = soundLibrary[key];
            settings[sound.storageKeys.enabled] = sound.enableCheckbox.checked;
            settings[sound.storageKeys.fileName] = sound.selectDropdown.value;
            settings[sound.storageKeys.volume] = parseFloat(sound.volumeSlider.value);
            if (sound.dropzone.dataset.fileData) {
                settings[sound.storageKeys.fileData] = sound.dropzone.dataset.fileData;
            }
        }
        chrome.storage.local.set(settings, () => {
            const userChoice = confirm(
                "Settings have been saved successfully!\n\nClick OK and Exit to close the page or Cancel to stay on this page."
            );
            if (userChoice) {
                window.close();
            } else {
                settingsChanged = false;
                saveSettings.disabled = true;
            }
        });
    }

    // Loads settings from Chrome local storage
    function loadAllSettings() {
        const keys = ['chimeVolume'];
        for (const key in soundLibrary) {
            keys.push(
                soundLibrary[key].storageKeys.enabled,
                soundLibrary[key].storageKeys.fileName,
                soundLibrary[key].storageKeys.fileData,
                soundLibrary[key].storageKeys.volume
            );
        }
        chrome.storage.local.get(keys, (result) => {
            // Master Volume
            const masterVolume = result.chimeVolume !== undefined ? result.chimeVolume : 0.5;
            masterVolumeSlider.value = masterVolume;
            masterVolumeValue.innerText = `${Math.round(masterVolume * 100)}%`;

            // Sound Library
            for (const key in soundLibrary) {
                const sound = soundLibrary[key];
                const storageKeys = sound.storageKeys;

                // Enable Checkbox
                const isEnabled = result[storageKeys.enabled] !== undefined
                    ? result[storageKeys.enabled]
                    : sound.defaultValues.enabled;
                sound.enableCheckbox.checked = isEnabled;

                // Dropdown
                const fileName = result[storageKeys.fileName] || sound.defaultValues.fileName;
                sound.selectDropdown.value = fileName;

                // Volume Slider
                const volume = result[storageKeys.volume] !== undefined
                    ? result[storageKeys.volume]
                    : sound.defaultValues.volume;
                sound.volumeSlider.value = volume;
                sound.volumeValue.innerText = `${Math.round(volume * 100)}%`;

                // Dropzone File Data
                if (result[storageKeys.fileData]) {
                    sound.dropzone.dataset.fileData = result[storageKeys.fileData];
                }
            }
        });
    }

    // Resets all settings to default values
    function resetAllSettings() {
        const confirmReset = confirm(
            "Are you sure you want to restore all values to their defaults?\n\nClick OK to proceed or Cancel to keep your current settings."
        );
        if (!confirmReset) {
            return; // User canceled
        }

        const settings = { chimeVolume: 0.5 }; // Reset Master Volume
        for (const key in soundLibrary) {
            const sound = soundLibrary[key];
            const storageKeys = sound.storageKeys;

            settings[storageKeys.enabled] = sound.defaultValues.enabled;
            settings[storageKeys.fileName] = sound.defaultValues.fileName;
            settings[storageKeys.volume] = sound.defaultValues.volume;
            settings[storageKeys.fileData] = null;
        }
        chrome.storage.local.set(settings, () => {
            loadAllSettings();
        });
    }

    // Event Listeners

    // Master Volume
    masterVolumeSlider.addEventListener('input', () => {
        const volume = parseFloat(masterVolumeSlider.value);
        masterVolumeValue.innerText = `${Math.round(volume * 100)}%`;
        updateSaveButton();
    });

    // Sound Library
    for (const key in soundLibrary) {
        const sound = soundLibrary[key];

        // Enable Checkbox
        sound.enableCheckbox.addEventListener('change', updateSaveButton);

        // Dropdown
        sound.selectDropdown.addEventListener('change', updateSaveButton);

        // Volume Slider
        sound.volumeSlider.addEventListener('input', () => {
            const volume = parseFloat(sound.volumeSlider.value);
            sound.volumeValue.innerText = `${Math.round(volume * 100)}%`;
            updateSaveButton();
        });

        // Reset Button
        sound.resetButton.addEventListener('click', () => {
            chrome.storage.local.remove([
                sound.storageKeys.fileName,
                sound.storageKeys.fileData,
                sound.storageKeys.volume,
            ], loadAllSettings);
        });

        // Dropzone (Drag & Drop or File Select)
        sound.dropzone.addEventListener('dragover', (e) => e.preventDefault());
        sound.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'audio/mp3') {
                const reader = new FileReader();
                reader.onload = (event) => {
                    sound.dropzone.dataset.fileData = event.target.result;
                    updateSaveButton();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Save Button
    saveSettings.addEventListener('click', saveAllSettings);

    // Restore Defaults Button
    restoreDefaults.addEventListener('click', resetAllSettings);

    // Initialization
    loadAllSettings();
});
