// options.js

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const disableButton = document.getElementById('disableButton');
    const saveSettings = document.getElementById('saveSettings');
    const restoreDefaults = document.getElementById('restoreDefaults');
    const errorMessage = document.getElementById('errorMessage');
    const masterVolumeSlider = document.getElementById('volumeSlider');
    const masterVolumeValue = document.getElementById('volumeValue');

    // Sound Pickers Configuration
    const soundPickers = {
        diagnostics: {
            dropzone: document.getElementById('dropzoneDiagnostics'),
            label: document.getElementById('currentSoundDiagnostics'),
            playButton: document.getElementById('playDiagnostics'),
            resetButton: document.getElementById('resetDiagnostics'),
            storageKey: 'soundFileDiagnostics',
            defaultName: '3_tone_chime-99718.mp3',
            defaultURL: chrome.runtime.getURL('3_tone_chime-99718.mp3')
        },
        medication: {
            dropzone: document.getElementById('dropzoneMedication'),
            label: document.getElementById('currentSoundMedication'),
            playButton: document.getElementById('playMedication'),
            resetButton: document.getElementById('resetMedication'),
            storageKey: 'soundFileMedication',
            defaultName: 'mixkit-bell-notification-933.mp3',
            defaultURL: chrome.runtime.getURL('mixkit-bell-notification-933.mp3')
        },
        nursingCare: {
            dropzone: document.getElementById('dropzoneNursingCare'),
            label: document.getElementById('currentSoundNursingCare'),
            playButton: document.getElementById('playNursingCare'),
            resetButton: document.getElementById('resetNursingCare'),
            storageKey: 'soundFileNursingCare',
            defaultName: 'mixkit-doorbell-single-press-333.mp3',
            defaultURL: chrome.runtime.getURL('mixkit-doorbell-single-press-333.mp3')
        },
        patientAdded: {
            dropzone: document.getElementById('dropzonePatientAdded'),
            label: document.getElementById('currentSoundPatientAdded'),
            playButton: document.getElementById('playPatientAdded'),
            resetButton: document.getElementById('resetPatientAdded'),
            storageKey: 'soundFilePatientAdded',
            defaultName: 'BuddyIn.mp3',
            defaultURL: chrome.runtime.getURL('BuddyIn.mp3')
        },
        patientRemoved: {
            dropzone: document.getElementById('dropzonePatientRemoved'),
            label: document.getElementById('currentSoundPatientRemoved'),
            playButton: document.getElementById('playPatientRemoved'),
            resetButton: document.getElementById('resetPatientRemoved'),
            storageKey: 'soundFilePatientRemoved',
            defaultName: 'Goodbye.mp3',
            defaultURL: chrome.runtime.getURL('Goodbye.mp3')
        }
    };

    // Sound Library Configuration
    const librarySelects = {
        diagnostics: document.getElementById('libraryDiagnostics'),
        medication: document.getElementById('libraryMedication'),
        nursingCare: document.getElementById('libraryNursingCare'),
        patientAdded: document.getElementById('libraryPatientAdded'),
        patientRemoved: document.getElementById('libraryPatientRemoved')
    };

    const libraryPlayButtons = {
        diagnostics: document.getElementById('playLibraryDiagnostics'),
        medication: document.getElementById('playLibraryMedication'),
        nursingCare: document.getElementById('playLibraryNursingCare'),
        patientAdded: document.getElementById('playLibraryPatientAdded'),
        patientRemoved: document.getElementById('playLibraryPatientRemoved')
    };

    const libraryVolumeSliders = {
        diagnostics: {
            slider: document.getElementById('volumeLibraryDiagnostics'),
            value: document.getElementById('volumeLibraryDiagnosticsValue')
        },
        medication: {
            slider: document.getElementById('volumeLibraryMedication'),
            value: document.getElementById('volumeLibraryMedicationValue')
        },
        nursingCare: {
            slider: document.getElementById('volumeLibraryNursingCare'),
            value: document.getElementById('volumeLibraryNursingCareValue')
        },
        patientAdded: {
            slider: document.getElementById('volumeLibraryPatientAdded'),
            value: document.getElementById('volumeLibraryPatientAddedValue')
        },
        patientRemoved: {
            slider: document.getElementById('volumeLibraryPatientRemoved'),
            value: document.getElementById('volumeLibraryPatientRemovedValue')
        }
    };

    let settingsChanged = false;
    let selectedSoundNames = new Set();

    /**
     * Utility Functions
     */

    /**
     * Capitalizes the first letter of a string.
     * @param {string} str - The string to capitalize.
     * @returns {string} - The capitalized string.
     */
    function capitalizeFirstLetter(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Displays an error message to the user.
     * @param {string} message - The error message to display.
     */
    function displayError(message) {
        errorMessage.innerText = message;
        setTimeout(() => {
            errorMessage.innerText = '';
        }, 5000); // Clear error after 5 seconds
    }

    /**
     * Initialize the master volume slider based on stored value or default.
     */
    function initializeMasterVolume() {
        chrome.storage.local.get(['chimeVolume'], (result) => {
            const storedVolume = result.chimeVolume !== undefined ? result.chimeVolume : 0.5;
            masterVolumeSlider.value = storedVolume;
            masterVolumeValue.innerText = `${Math.round(storedVolume * 100)}%`;
        });

        masterVolumeSlider.addEventListener('input', () => {
            const volume = parseFloat(masterVolumeSlider.value);
            masterVolumeValue.innerText = `${Math.round(volume * 100)}%`;
            chrome.storage.local.set({ chimeVolume: volume }, () => {
                console.log(`Master volume set to ${volume}`);
                settingsChanged = true;
                saveSettings.disabled = false;
            });
        });
    }

    /**
     * Load current settings and display the current sound name for each type.
     */
    function loadCurrentSettings() {
        const storageKeys = Object.values(soundPickers).map(item => item.storageKey);
        const storageNameKeys = Object.values(soundPickers).map(item => item.storageKey + 'Name');
        const volumeLibraryKeys = Object.keys(libraryVolumeSliders).map(key => `volumeLibrary${capitalizeFirstLetter(key)}`);
        chrome.storage.local.get([...storageKeys, ...storageNameKeys, ...volumeLibraryKeys, 'chimeVolume'], (result) => {
            // Initialize Master Volume
            if (masterVolumeSlider && masterVolumeValue) {
                const storedVolume = result.chimeVolume !== undefined ? result.chimeVolume : 0.5;
                masterVolumeSlider.value = storedVolume;
                masterVolumeValue.innerText = `${Math.round(storedVolume * 100)}%`;
            }

            for (const key in soundPickers) {
                const soundPicker = soundPickers[key];
                const soundName = result[soundPicker.storageKey + 'Name'] || soundPicker.defaultName;
                soundPicker.label.innerText = `${capitalizeFirstLetter(key)} Sound: ${soundName}`;
                if (soundName !== soundPicker.defaultName) {
                    selectedSoundNames.add(soundName);
                }
            }

            // Initialize Sound Library Dropdowns
            populateSoundLibraryDropdowns(result);

            // Initialize Per-Sound Volume Sliders in Sound Library
            initializeLibraryVolumeSliders(result);

            enforceAllSelections();
        });
    }

    /**
     * Populate the Sound Library dropdowns with predefined sounds.
     * @param {Object} result - The stored settings.
     */
    function populateSoundLibraryDropdowns(result) {
        for (const key in librarySelects) {
            const librarySelect = librarySelects[key];
            const soundPicker = soundPickers[key];
            const currentSoundName = result[soundPicker.storageKey + 'Name'] || soundPicker.defaultName;

            // Clear existing options
            librarySelect.innerHTML = '';

            // Populate options
            const predefinedSounds = getPredefinedSounds(key);
            predefinedSounds.forEach(sound => {
                const option = document.createElement('option');
                option.value = sound.fileName;
                option.text = sound.displayName;
                librarySelect.appendChild(option);
            });

            // Set the current sound as selected
            librarySelect.value = currentSoundName;
        }
    }

    /**
     * Returns a list of predefined sounds for a given sound type.
     * @param {string} soundType - The sound type key.
     * @returns {Array} - Array of sound objects with fileName and displayName.
     */
    function getPredefinedSounds(soundType) {
        const predefined = {
            diagnostics: [
                { fileName: '3_tone_chime-99718.mp3', displayName: '3 Tone Chime' },
                { fileName: 'predefined-sound1.mp3', displayName: 'Predefined Sound 1' },
                { fileName: 'predefined-sound2.mp3', displayName: 'Predefined Sound 2' }
            ],
            medication: [
                { fileName: 'mixkit-bell-notification-933.mp3', displayName: 'Bell Notification' },
                { fileName: 'predefined-sound3.mp3', displayName: 'Predefined Sound 3' },
                { fileName: 'predefined-sound4.mp3', displayName: 'Predefined Sound 4' }
            ],
            nursingCare: [
                { fileName: 'mixkit-doorbell-single-press-333.mp3', displayName: 'Doorbell Press' },
                { fileName: 'predefined-sound5.mp3', displayName: 'Predefined Sound 5' },
                { fileName: 'predefined-sound6.mp3', displayName: 'Predefined Sound 6' }
            ],
            patientAdded: [
                { fileName: 'BuddyIn.mp3', displayName: 'Buddy In' },
                { fileName: 'predefined-sound7.mp3', displayName: 'Predefined Sound 7' },
                { fileName: 'predefined-sound8.mp3', displayName: 'Predefined Sound 8' }
            ],
            patientRemoved: [
                { fileName: 'Goodbye.mp3', displayName: 'Goodbye' },
                { fileName: 'predefined-sound9.mp3', displayName: 'Predefined Sound 9' },
                { fileName: 'predefined-sound10.mp3', displayName: 'Predefined Sound 10' }
            ]
        };

        return predefined[soundType] || [];
    }

    /**
     * Initialize per-sound volume sliders in Sound Library.
     * @param {Object} result - The stored settings.
     */
    function initializeLibraryVolumeSliders(result) {
        for (const key in libraryVolumeSliders) {
            const slider = libraryVolumeSliders[key].slider;
            const display = libraryVolumeSliders[key].value;
            const storedVolume = result[`volumeLibrary${capitalizeFirstLetter(key)}`] !== undefined ? result[`volumeLibrary${capitalizeFirstLetter(key)}`] : 1.0;
            slider.value = storedVolume;
            display.innerText = `${Math.round(storedVolume * 100)}%`;

            slider.addEventListener('input', () => {
                const volume = parseFloat(slider.value);
                display.innerText = `${Math.round(volume * 100)}%`;
                chrome.storage.local.set({ [`volumeLibrary${capitalizeFirstLetter(key)}`]: volume }, () => {
                    console.log(`Volume for ${capitalizeFirstLetter(key)} set to ${volume}`);
                    settingsChanged = true;
                    saveSettings.disabled = false;
                });
            });
        }
    }

    /**
     * Handle file drop in dropzones.
     * @param {Event} event - The drop event.
     * @param {string} soundType - The sound type key.
     */
    function handleFileDrop(event, soundType) {
        event.preventDefault();
        const soundPicker = soundPickers[soundType];
        soundPicker.dropzone.classList.remove('dragover');

        const files = event.dataTransfer.files;
        if (files.length === 0) return;

        const file = files[0];
        if (file.type !== 'audio/mp3' && file.type !== 'audio/mpeg') {
            displayError(`Invalid file type for ${capitalizeFirstLetter(soundType)}. Please upload an MP3 file.`);
            return;
        }

        const soundName = file.name;

        // Check for duplicate sound name
        if (selectedSoundNames.has(soundName)) {
            displayError(`The sound "${soundName}" is already selected for another type. Please choose a different sound.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const soundData = e.target.result;
            chrome.storage.local.set({ [soundPicker.storageKey]: soundData, [soundPicker.storageKey + 'Name']: soundName }, () => {
                console.log(`Sound file for ${soundType} saved:`, soundName);
                soundPicker.label.innerText = `${capitalizeFirstLetter(soundType)} Sound: ${soundName}`;
                selectedSoundNames.add(soundName);
                settingsChanged = true;
                saveSettings.disabled = false;
                loadCurrentSettings(); // Reload settings to enforce selections
            });
        };
        reader.onerror = function () {
            displayError(`Failed to read the file "${soundName}". Please try again.`);
        };
        reader.readAsDataURL(file);
    }

    /**
     * Set up drag-and-drop listeners for each dropzone.
     */
    function setupDropzones() {
        for (const key in soundPickers) {
            const soundPicker = soundPickers[key];
            const dropzone = soundPicker.dropzone;

            // Prevent default behavior
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            // Highlight dropzone when file is dragged over
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, () => {
                    dropzone.classList.add('dragover');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, () => {
                    dropzone.classList.remove('dragover');
                }, false);
            });

            // Handle dropped files
            dropzone.addEventListener('drop', (e) => {
                handleFileDrop(e, key);
            }, false);

            // Handle click to open file dialog
            dropzone.addEventListener('click', () => {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'audio/mp3, audio/mpeg';
                fileInput.addEventListener('change', (e) => {
                    const files = e.target.files;
                    if (files.length === 0) return;

                    const file = files[0];
                    if (file.type !== 'audio/mp3' && file.type !== 'audio/mpeg') {
                        displayError(`Invalid file type for ${capitalizeFirstLetter(key)}. Please upload an MP3 file.`);
                        return;
                    }

                    const soundName = file.name;

                    // Check for duplicate sound name
                    if (selectedSoundNames.has(soundName)) {
                        displayError(`The sound "${soundName}" is already selected for another type. Please choose a different sound.`);
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const soundData = e.target.result;
                        chrome.storage.local.set({ [soundPickers[key].storageKey]: soundData, [soundPickers[key].storageKey + 'Name']: soundName }, () => {
                            console.log(`Sound file for ${key} saved:`, soundName);
                            soundPickers[key].label.innerText = `${capitalizeFirstLetter(key)} Sound: ${soundName}`;
                            selectedSoundNames.add(soundName);
                            settingsChanged = true;
                            saveSettings.disabled = false;
                            loadCurrentSettings(); // Reload settings to enforce selections
                        });
                    };
                    reader.onerror = function () {
                        displayError(`Failed to read the file "${soundName}". Please try again.`);
                    };
                    reader.readAsDataURL(file);
                });
                fileInput.click();
            }, false);
        }
    }

    /**
     * Setup play buttons for sound pickers.
     */
    function setupPlayButtons() {
        for (const key in soundPickers) {
            const soundPicker = soundPickers[key];
            soundPicker.playButton.addEventListener('click', () => {
                chrome.storage.local.get([soundPicker.storageKey, soundPicker.storageKey + 'Name'], (result) => {
                    const soundDataURL = result[soundPicker.storageKey];
                    const soundName = result[soundPicker.storageKey + 'Name'] || soundPicker.defaultName;
                    const masterVolume = parseFloat(masterVolumeSlider.value);
                    if (soundDataURL && soundName !== soundPicker.defaultName) {
                        const audio = new Audio(soundDataURL);
                        audio.volume = masterVolume;
                        audio.play().catch(error => {
                            console.error('Error playing sound:', error);
                            displayError(`Failed to play the sound "${soundName}". Please try re-uploading the sound.`);
                        });
                    } else {
                        // Play default sound
                        const audio = new Audio(soundPicker.defaultURL);
                        audio.volume = masterVolume;
                        audio.play().catch(error => {
                            console.error('Error playing default sound:', error);
                            displayError(`Failed to play the default sound for ${capitalizeFirstLetter(key)}.`);
                        });
                    }
                });
            });
        }
    }

    /**
     * Setup play buttons for the Sound Library.
     */
    function setupSoundLibraryPlayButtons() {
        for (const key in librarySelects) {
            const playLibraryButton = libraryPlayButtons[key];
            const librarySelect = librarySelects[key];
            const soundPicker = soundPickers[key];

            playLibraryButton.addEventListener('click', () => {
                const selectedValue = librarySelect.value;
                if (selectedValue === "") {
                    displayError(`Please select a sound to play for ${capitalizeFirstLetter(key)}.`);
                    return;
                }

                const soundURL = chrome.runtime.getURL(selectedValue);
                const audio = new Audio(soundURL);
                const perSoundVolume = parseFloat(libraryVolumeSliders[key].slider.value);
                const masterVolume = parseFloat(masterVolumeSlider.value);
                audio.volume = masterVolume * perSoundVolume;
                audio.play().catch(error => {
                    console.error('Error playing sound:', error);
                    displayError(`Failed to play the sound "${selectedValue}".`);
                });
            });
        }
    }

    /**
     * Setup reset buttons to reset individual sounds to default.
     */
    function setupResetButtons() {
        for (const key in soundPickers) {
            const soundPicker = soundPickers[key];
            soundPicker.resetButton.addEventListener('click', () => {
                chrome.storage.local.remove([soundPicker.storageKey, soundPicker.storageKey + 'Name'], () => {
                    soundPicker.label.innerText = `${capitalizeFirstLetter(key)} Sound: ${soundPicker.defaultName}`;
                    if (selectedSoundNames.has(soundPicker.defaultName)) {
                        selectedSoundNames.delete(soundPicker.defaultName);
                    }
                    settingsChanged = true;
                    saveSettings.disabled = false;
                    loadCurrentSettings(); // Reload settings to enforce selections
                });
            });
        }
    }

    /**
     * Enforce unique sound selections across all sound types.
     */
    function enforceAllSelections() {
        // First, enable all options
        for (const key in librarySelects) {
            const librarySelect = librarySelects[key];
            for (let i = 0; i < librarySelect.options.length; i++) {
                librarySelect.options[i].disabled = false;
            }
        }

        // Disable already selected sounds in all other dropdowns
        for (const key in soundPickers) {
            const soundPicker = soundPickers[key];
            const soundName = soundPicker.label.innerText.split(': ')[1];
            if (soundName && soundName !== soundPicker.defaultName) {
                for (const otherKey in librarySelects) {
                    if (otherKey === key) continue;
                    const otherLibrarySelect = librarySelects[otherKey];
                    for (let i = 0; i < otherLibrarySelect.options.length; i++) {
                        if (otherLibrarySelect.options[i].value === soundName) {
                            otherLibrarySelect.options[i].disabled = true;
                        }
                    }
                }
            }
        }
    }

    /**
     * Setup Sound Library selections and play buttons.
     */
    function setupSoundLibrary() {
        for (const key in librarySelects) {
            const librarySelect = librarySelects[key];
            const soundPicker = soundPickers[key];

            librarySelect.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                if (selectedValue === "") {
                    // Do nothing if no selection
                    return;
                }

                const soundName = selectedValue;

                // Check for duplicate sound name
                if (selectedSoundNames.has(soundName)) {
                    displayError(`The sound "${soundName}" is already selected for another type. Please choose a different sound.`);
                    librarySelect.value = ""; // Reset the selection
                    return;
                }

                const soundURL = chrome.runtime.getURL(selectedValue);
                chrome.storage.local.set({ [soundPicker.storageKey]: soundURL, [soundPicker.storageKey + 'Name']: soundName }, () => {
                    console.log(`Sound file for ${key} set to:`, soundName);
                    soundPicker.label.innerText = `${capitalizeFirstLetter(key)} Sound: ${soundName}`;
                    selectedSoundNames.add(soundName);
                    settingsChanged = true;
                    saveSettings.disabled = false;
                    enforceAllSelections();
                });
            });
        }
    }

    /**
     * Initialize all event listeners and load settings.
     */
    function initializeSettings() {
        initializeMasterVolume();
        loadCurrentSettings();
        setupDropzones();
        setupPlayButtons();
        setupSoundLibraryPlayButtons();
        setupResetButtons();
        setupSoundLibrary();
        setupSoundLibraryVolumeSliders();
    }

    /**
     * Save settings and close options page.
     */
    if (saveSettings) {
        saveSettings.addEventListener('click', () => {
            if (settingsChanged) {
                alert('Settings saved.');
                settingsChanged = false;
                saveSettings.disabled = true;
            } else {
                alert('No changes made.');
            }
            window.close();
        });
    }

    /**
     * Restore all sounds to default.
     */
    if (restoreDefaults) {
        restoreDefaults.addEventListener('click', () => {
            const storageKeys = Object.values(soundPickers).map(item => item.storageKey);
            const storageNames = Object.values(soundPickers).map(item => item.storageKey + 'Name');
            const volumeLibraryKeys = Object.keys(libraryVolumeSliders).map(key => `volumeLibrary${capitalizeFirstLetter(key)}`);
            chrome.storage.local.remove([...storageKeys, ...storageNames, ...volumeLibraryKeys, 'chimeVolume'], () => {
                Object.values(soundPickers).forEach(soundPicker => {
                    soundPicker.label.innerText = `${capitalizeFirstLetter(getKeyFromStorageKey(soundPicker.storageKey))} Sound: ${soundPicker.defaultName}`;
                });
                // Reset Sound Library selections
                for (const key in librarySelects) {
                    librarySelects[key].value = soundPickers[key].defaultName;
                }
                // Reset Sound Library volume sliders
                for (const key in libraryVolumeSliders) {
                    const slider = libraryVolumeSliders[key].slider;
                    const display = libraryVolumeSliders[key].value;
                    slider.value = 1.0;
                    display.innerText = `100%`;
                }
                // Reset master volume
                if (masterVolumeSlider && masterVolumeValue) {
                    masterVolumeSlider.value = 0.5;
                    masterVolumeValue.innerText = `50%`;
                }
                selectedSoundNames.clear();
                settingsChanged = true;
                saveSettings.disabled = false;
                displayError('All sounds restored to default.');
                loadCurrentSettings();
            });
        });
    }

    /**
     * Helper function to extract key from storageKey.
     * @param {string} storageKey - The storage key.
     * @returns {string} - The sound type key.
     */
    function getKeyFromStorageKey(storageKey) {
        return storageKey.replace('soundFile', '').charAt(0).toLowerCase() + storageKey.replace('soundFile', '').slice(1);
    }

    /**
     * Setup per-sound volume sliders in Sound Library.
     * Already handled in initializeLibraryVolumeSliders function.
     */

    // Start the initialization
    initializeSettings();
});
