// options.js

document.addEventListener('DOMContentLoaded', () => {
    const saveSettingsButton = document.getElementById('saveSettings');
    const restoreDefaultsButton = document.getElementById('restoreDefaults');
    const masterVolumeSlider = document.getElementById('volumeSlider');
    const masterVolumeValue = document.getElementById('volumeValue');

    const soundLibrary = {
        notification: {
            name: 'Notification',
            elements: {
                enableCheckbox: document.getElementById('enableNotification'),
                selectDropdown: document.getElementById('libraryNotification'),
                volumeSlider: document.getElementById('volumeLibraryNotification'),
                volumeValue: document.getElementById('volumeLibraryNotificationValue'),
                dropzone: document.getElementById('dropzoneNotification'),
                resetButton: document.getElementById('resetNotification'),
                playButton: document.getElementById('playLibraryNotification'),
            },
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
            name: 'Patient Added',
            elements: {
                enableCheckbox: document.getElementById('enablePatientAdded'),
                selectDropdown: document.getElementById('libraryPatientAdded'),
                volumeSlider: document.getElementById('volumeLibraryPatientAdded'),
                volumeValue: document.getElementById('volumeLibraryPatientAddedValue'),
                dropzone: document.getElementById('dropzonePatientAdded'),
                resetButton: document.getElementById('resetPatientAdded'),
                playButton: document.getElementById('playLibraryPatientAdded'),
            },
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
            name: 'Patient Removed',
            elements: {
                enableCheckbox: document.getElementById('enablePatientRemoved'),
                selectDropdown: document.getElementById('libraryPatientRemoved'),
                volumeSlider: document.getElementById('volumeLibraryPatientRemoved'),
                volumeValue: document.getElementById('volumeLibraryPatientRemovedValue'),
                dropzone: document.getElementById('dropzonePatientRemoved'),
                resetButton: document.getElementById('resetPatientRemoved'),
                playButton: document.getElementById('playLibraryPatientRemoved'),
            },
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

    /**
     * Utility Functions
     */

    // Updates Save Settings button state
    function updateSaveButton() {
        if (!settingsChanged) {
            settingsChanged = true;
            saveSettingsButton.disabled = false;
            console.log('Settings have been modified. Save button enabled.');
        }
    }

    // Shows a temporary notification
    function showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 20px';
        notification.style.backgroundColor = '#4CAF50';
        notification.style.color = '#fff';
        notification.style.borderRadius = '5px';
        notification.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
        notification.style.zIndex = '1000';
        document.body.appendChild(notification);
        setTimeout(() => {
            document.body.removeChild(notification);
        }, duration);
    }

    // Updates the state of sound controls based on enabled status
    function updateSoundControls(sound, isEnabled) {
        const { selectDropdown, playButton, dropzone, resetButton, volumeSlider, volumeValue, customNameInput } = sound.elements;

        selectDropdown.disabled = !isEnabled;
        playButton.disabled = !isEnabled;
        dropzone.style.pointerEvents = isEnabled ? 'auto' : 'none';
        dropzone.style.opacity = isEnabled ? '1' : '0.6';
        resetButton.disabled = !isEnabled;
        volumeSlider.disabled = !isEnabled;
        volumeValue.style.opacity = isEnabled ? '1' : '0.6';
        // Assuming there's a customNameInput, ensure it's handled if present
        if (customNameInput) {
            customNameInput.disabled = !isEnabled;
        }

        console.log(`Updated controls for ${sound.name}: Enabled = ${isEnabled}`);
    }

    // Saves all settings to chrome.storage.local
    function saveAllSettings() {
        const settings = { chimeVolume: parseFloat(masterVolumeSlider.value) };
        console.log('Saving settings:', settings);

        for (const key in soundLibrary) {
            const sound = soundLibrary[key];
            const { enabled, fileName, fileData, volume } = sound.storageKeys;

            settings[enabled] = sound.enableCheckbox.checked;
            settings[fileName] = sound.selectDropdown.value;
            settings[volume] = parseFloat(sound.volumeSlider.value);
            if (sound.dropzone.dataset.fileData) {
                settings[fileData] = sound.dropzone.dataset.fileData;
            } else {
                settings[fileData] = null;
            }

            console.log(`Setting for ${sound.name}:`, {
                enabled: settings[enabled],
                fileName: settings[fileName],
                fileData: settings[fileData],
                volume: settings[volume],
            });
        }

        chrome.storage.local.set(settings, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving settings:', chrome.runtime.lastError);
                alert('An error occurred while saving settings.');
                return;
            }
            showNotification('Settings saved successfully!');
            console.log('Settings saved successfully.');

            const userChoice = confirm(
                "Settings have been saved successfully!\n\nClick OK and Exit to close the page or Cancel to stay on this page."
            );
            if (userChoice) {
                window.close();
            } else {
                settingsChanged = false;
                saveSettingsButton.disabled = true;
                console.log('User chose to stay on the settings page.');
            }
        });
    }

    // Loads settings from chrome.storage.local
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
        console.log('Loading settings with keys:', keys);

        chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
                console.error('Error loading settings:', chrome.runtime.lastError);
                alert('An error occurred while loading settings.');
                return;
            }

            console.log('Loaded settings:', result);

            // Master Volume
            const masterVolume = result.chimeVolume !== undefined ? result.chimeVolume : 0.5;
            masterVolumeSlider.value = masterVolume;
            masterVolumeValue.innerText = `${Math.round(masterVolume * 100)}%`;
            console.log(`Master Volume set to ${masterVolume * 100}%`);

            // Sound Library
            let allEnabled = true;
            for (const key in soundLibrary) {
                const sound = soundLibrary[key];
                const storageKeys = sound.storageKeys;

                // Enable Checkbox
                const isEnabled = result[storageKeys.enabled] !== undefined
                    ? result[storageKeys.enabled]
                    : sound.defaultValues.enabled;
                sound.enableCheckbox.checked = isEnabled;
                console.log(`${sound.name} enabled: ${isEnabled}`);
                if (!isEnabled) {
                    allEnabled = false;
                }

                // Dropdown
                const fileName = result[storageKeys.fileName] || sound.defaultValues.fileName;
                sound.selectDropdown.value = fileName;
                console.log(`${sound.name} selected file: ${fileName}`);

                // Volume Slider
                const volume = result[storageKeys.volume] !== undefined
                    ? result[storageKeys.volume]
                    : sound.defaultValues.volume;
                sound.volumeSlider.value = volume;
                sound.volumeValue.innerText = `${Math.round(volume * 100)}%`;
                console.log(`${sound.name} volume set to ${volume * 100}%`);

                // Dropzone File Data
                if (result[storageKeys.fileData]) {
                    sound.dropzone.dataset.fileData = result[storageKeys.fileData];
                    sound.dropzone.textContent = 'Custom file uploaded';
                    console.log(`${sound.name} has a custom file uploaded.`);
                } else {
                    sound.dropzone.dataset.fileData = '';
                    sound.dropzone.textContent = 'Drag & drop or click to select a file';
                    console.log(`${sound.name} is using the default file.`);
                }

                // Update Controls
                updateSoundControls(sound, isEnabled);
            }

            // Master Toggle
            enableAllSoundsCheckbox.checked = allEnabled;
            console.log(`Master toggle set to ${allEnabled}`);
        });
    }

    // Resets all settings to default values
    function resetAllSettings() {
        const confirmReset = confirm(
            "Are you sure you want to restore all values to their defaults?\n\nClick OK to proceed or Cancel to keep your current settings."
        );
        if (!confirmReset) {
            console.log('User canceled the reset operation.');
            return; // User canceled
        }

        const settings = { chimeVolume: 0.5 }; // Reset Master Volume
        for (const key in soundLibrary) {
            const sound = soundLibrary[key];
            const storageKeys = sound.storageKeys;

            settings[storageKeys.enabled] = sound.defaultValues.enabled;
            settings[storageKeys.fileName] = sound.defaultValues.fileName;
            settings[storageKeys.volume] = sound.defaultValues.volume;
            settings[storageKeys.fileData] = sound.defaultValues.fileData;
        }
        console.log('Resetting settings to default values:', settings);
        chrome.storage.local.set(settings, () => {
            if (chrome.runtime.lastError) {
                console.error('Error resetting settings:', chrome.runtime.lastError);
                alert('An error occurred while resetting settings.');
                return;
            }
            showNotification('Settings have been restored to defaults.');
            console.log('Settings have been restored to defaults.');
            loadAllSettings();
            settingsChanged = false;
            saveSettingsButton.disabled = true;
        });
    }

    /**
     * Play Sound Functionality
     * Allows users to test sound playback directly from the options page.
     */
    function playSound(soundKey) {
        const sound = soundLibrary[soundKey];
        const { fileData, fileName, volume } = sound.storageKeys;

        chrome.storage.local.get([fileData, fileName, volume, 'chimeVolume'], (result) => {
            if (chrome.runtime.lastError) {
                console.error(`Error accessing storage for ${sound.name}:`, chrome.runtime.lastError);
                alert(`An error occurred while accessing settings for ${sound.name} sound.`);
                return;
            }

            let audioSrc;
            if (result[fileData]) {
                // Use custom uploaded file
                audioSrc = result[fileData];
                console.log(`${sound.name} Sound using custom file.`);
            } else {
                // Use predefined file
                audioSrc = chrome.runtime.getURL(result[fileName] || sound.defaultValues.fileName);
                console.log(`${sound.name} Sound using predefined file: ${audioSrc}`);
            }

            console.log(`Audio Source for ${sound.name}: ${audioSrc}`);

            const audio = new Audio(audioSrc);
            const masterVolume = result['chimeVolume'] !== undefined ? result['chimeVolume'] : 0.5;
            const soundVolume = result[volume] !== undefined ? result[volume] : sound.defaultValues.volume;
            audio.volume = masterVolume * soundVolume;

            console.log(`${sound.name} Volume: Master Volume (${masterVolume}) * Sound Volume (${soundVolume}) = ${audio.volume}`);

            audio.play().then(() => {
                console.log(`${sound.name} Sound is playing.`);
            }).catch((error) => {
                console.error(`Failed to play ${sound.name} sound:`, error);
                alert(`Failed to play the sound "${result[fileName] || sound.defaultValues.fileName}". Please ensure the file is valid and supported.`);
            });
        });
    }

    // Event Listeners

    // Master Volume
    masterVolumeSlider.addEventListener('input', () => {
        const volume = parseFloat(masterVolumeSlider.value);
        masterVolumeValue.innerText = `${Math.round(volume * 100)}%`;
        console.log(`Master Volume changed to ${volume * 100}%`);
        updateSaveButton();
    });

    // Sound Library
    for (const key in soundLibrary) {
        const sound = soundLibrary[key];

        // Enable Checkbox
        sound.enableCheckbox.addEventListener('change', () => {
            const isEnabled = sound.enableCheckbox.checked;
            console.log(`Enable checkbox for ${sound.name} changed to ${isEnabled}`);
            updateSoundControls(sound, isEnabled);
            updateSaveButton();
        });

        // Dropdown
        sound.selectDropdown.addEventListener('change', () => {
            const selectedValue = sound.selectDropdown.value;
            console.log(`Select dropdown for ${sound.name} changed to ${selectedValue}`);
            updateSaveButton();
        });

        // Volume Slider
        sound.volumeSlider.addEventListener('input', () => {
            const volume = parseFloat(sound.volumeSlider.value);
            sound.volumeValue.innerText = `${Math.round(volume * 100)}%`;
            console.log(`Volume slider for ${sound.name} changed to ${volume * 100}%`);
            updateSaveButton();
        });

        // Reset Button
        sound.resetButton.addEventListener('click', () => {
            console.log(`Reset button clicked for ${sound.name}`);
            chrome.storage.local.remove([
                sound.storageKeys.fileName,
                sound.storageKeys.fileData,
                sound.storageKeys.volume,
            ], () => {
                if (chrome.runtime.lastError) {
                    console.error(`Error resetting ${sound.name} sound:`, chrome.runtime.lastError);
                    alert('Failed to reset the sound.');
                    return;
                }
                console.log(`${sound.name} sound has been reset to default.`);
                showNotification(`"${sound.name}" sound has been reset to default.`);
                loadAllSettings();
            });
        });

        // Dropzone (Drag & Drop or File Select)
        sound.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            sound.dropzone.classList.add('dragover');
            console.log(`Dragging over dropzone for ${sound.name}`);
        });

        sound.dropzone.addEventListener('dragleave', () => {
            sound.dropzone.classList.remove('dragover');
            console.log(`Dragging left dropzone for ${sound.name}`);
        });

        sound.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            sound.dropzone.classList.remove('dragover');
            console.log(`File dropped on dropzone for ${sound.name}`);
            const file = e.dataTransfer.files[0];
            if (file) {
                if (file.type !== 'audio/mp3' && file.type !== 'audio/mpeg') {
                    console.error(`Invalid file type for ${sound.name}:`, file.type);
                    alert('Please upload a valid MP3 file.');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataURL = event.target.result;
                    sound.dropzone.dataset.fileData = dataURL;
                    sound.dropzone.textContent = 'Custom file uploaded';
                    console.log(`Custom file uploaded for ${sound.name}:`, dataURL);
                    updateSaveButton();
                };
                reader.onerror = (error) => {
                    console.error(`Error reading file for ${sound.name}:`, error);
                    alert('An error occurred while reading the file. Please try again.');
                };
                reader.readAsDataURL(file);
            } else {
                console.warn(`No file found in drop event for ${sound.name}.`);
            }
        });

        sound.dropzone.addEventListener('click', () => {
            console.log(`Dropzone clicked for ${sound.name}`);
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'audio/mp3, audio/mpeg';
            fileInput.onchange = () => {
                const selectedFile = fileInput.files[0];
                if (selectedFile) {
                    console.log(`File selected for ${sound.name}:`, selectedFile);
                    if (selectedFile.type !== 'audio/mp3' && selectedFile.type !== 'audio/mpeg') {
                        console.error(`Invalid file type for ${sound.name}:`, selectedFile.type);
                        alert('Please upload a valid MP3 file.');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const dataURL = event.target.result;
                        sound.dropzone.dataset.fileData = dataURL;
                        sound.dropzone.textContent = 'Custom file uploaded';
                        console.log(`Custom file uploaded for ${sound.name}:`, dataURL);
                        updateSaveButton();
                    };
                    reader.onerror = (error) => {
                        console.error(`Error reading file for ${sound.name}:`, error);
                        alert('An error occurred while reading the file. Please try again.');
                    };
                    reader.readAsDataURL(selectedFile);
                } else {
                    console.warn(`No file selected for ${sound.name}.`);
                }
            };
            fileInput.click();
        });

        // Play Button
        sound.playButton.addEventListener('click', () => {
            console.log(`Play button clicked for ${sound.name}`);
            playSound(key);
        });
    }

    // Save Button
    saveSettingsButton.addEventListener('click', saveAllSettings);

    // Restore Defaults Button
    restoreDefaultsButton.addEventListener('click', resetAllSettings);

    /**
     * Helper Functions
     */

    // Play Sound Functionality
    function playSound(soundKey) {
        const sound = soundLibrary[soundKey];
        const { fileData, fileName, volume } = sound.storageKeys;

        chrome.storage.local.get([fileData, fileName, volume, 'chimeVolume'], (result) => {
            if (chrome.runtime.lastError) {
                console.error(`Error accessing storage for ${sound.name}:`, chrome.runtime.lastError);
                alert(`An error occurred while accessing settings for ${sound.name} sound.`);
                return;
            }

            let audioSrc;
            if (result[fileData]) {
                // Use custom uploaded file
                audioSrc = result[fileData];
                console.log(`${sound.name} Sound using custom file.`);
            } else {
                // Use predefined file
                audioSrc = chrome.runtime.getURL(result[fileName] || sound.defaultValues.fileName);
                console.log(`${sound.name} Sound using predefined file: ${audioSrc}`);
            }

            console.log(`Audio Source for ${sound.name}: ${audioSrc}`);

            const audio = new Audio(audioSrc);
            const masterVolume = result['chimeVolume'] !== undefined ? result['chimeVolume'] : 0.5;
            const soundVolume = result[volume] !== undefined ? result[volume] : sound.defaultValues.volume;
            audio.volume = masterVolume * soundVolume;

            console.log(`${sound.name} Volume: Master Volume (${masterVolume}) * Sound Volume (${soundVolume}) = ${audio.volume}`);

            audio.play().then(() => {
                console.log(`${sound.name} Sound is playing.`);
            }).catch((error) => {
                console.error(`Failed to play ${sound.name} sound:`, error);
                alert(`Failed to play the sound "${result[fileName] || sound.defaultValues.fileName}". Please ensure the file is valid and supported.`);
            });
        });
    }
});
