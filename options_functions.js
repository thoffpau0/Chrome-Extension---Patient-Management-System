// options_functions.js

/**
 * Saves all settings to chrome.storage.local.
 */
function saveAllSettings() {
    var saveSettingsButton = document.getElementById('saveSettings');

    var settings = { chimeVolume: parseFloat(document.getElementById('volumeSlider').value) };
    console.log('Saving settings:', settings);

    for (var key in soundLibrary) {
        var sound = soundLibrary[key];
        var storageKeys = sound.storageKeys;
        var elements = sound.elements;

        settings[storageKeys.enabled] = elements.enableCheckbox.checked;
        settings[storageKeys.fileName] = elements.selectDropdown.value;
        settings[storageKeys.volume] = parseFloat(elements.volumeSlider.value);
        if (elements.dropzone.dataset.fileData) {
            settings[storageKeys.fileData] = elements.dropzone.dataset.fileData;
        } else {
            settings[storageKeys.fileData] = null;
        }

        console.log('Setting for ' + sound.name + ':', {
            enabled: settings[storageKeys.enabled],
            fileName: settings[storageKeys.fileName],
            fileData: settings[storageKeys.fileData],
            volume: settings[storageKeys.volume],
        });
    }

    chrome.storage.local.set(settings, function () {
        if (chrome.runtime.lastError) {
            console.error('Error saving settings:', chrome.runtime.lastError);
            alert('An error occurred while saving settings.');
            return;
        }
        showNotification('Settings saved successfully!');
        console.log('Settings saved successfully.');

        var userChoice = confirm(
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

/**
 * Loads settings from chrome.storage.local.
 */
function loadAllSettings() {
    var masterVolumeSlider = document.getElementById('volumeSlider');
    var masterVolumeValue = document.getElementById('volumeValue');

    var keys = ['chimeVolume'];
    for (var key in soundLibrary) {
        var storageKeys = soundLibrary[key].storageKeys;
        keys.push(
            storageKeys.enabled,
            storageKeys.fileName,
            storageKeys.fileData,
            storageKeys.volume
        );
    }
    console.log('Loading settings with keys:', keys);

    chrome.storage.local.get(keys, function (result) {
        if (chrome.runtime.lastError) {
            console.error('Error loading settings:', chrome.runtime.lastError);
            alert('An error occurred while loading settings.');
            return;
        }

        console.log('Loaded settings:', result);

        // Master Volume
        var masterVolume = result.chimeVolume !== undefined ? result.chimeVolume : 0.5;
        masterVolumeSlider.value = masterVolume;
        masterVolumeValue.innerText = Math.round(masterVolume * 100) + '%';
        console.log('Master Volume set to ' + (masterVolume * 100) + '%');

        // Sound Library
        for (var key in soundLibrary) {
            var sound = soundLibrary[key];
            var storageKeys = sound.storageKeys;
            var elements = sound.elements;

            // Enable Checkbox
            var isEnabled = result[storageKeys.enabled] !== undefined
                ? result[storageKeys.enabled]
                : sound.defaultValues.enabled;
            elements.enableCheckbox.checked = isEnabled;
            console.log(sound.name + ' enabled: ' + isEnabled);

            // Dropdown
            var fileName = result[storageKeys.fileName] || sound.defaultValues.fileName;
            elements.selectDropdown.value = fileName;
            console.log(sound.name + ' selected file: ' + fileName);

            // Volume Slider
            var volume = result[storageKeys.volume] !== undefined
                ? result[storageKeys.volume]
                : sound.defaultValues.volume;
            elements.volumeSlider.value = volume;
            elements.volumeValue.innerText = Math.round(volume * 100) + '%';
            console.log(sound.name + ' volume set to ' + (volume * 100) + '%');

            // Dropzone File Data
            if (result[storageKeys.fileData]) {
                elements.dropzone.dataset.fileData = result[storageKeys.fileData];
                elements.dropzone.textContent = 'Custom file uploaded';
                console.log(sound.name + ' has a custom file uploaded.');
            } else {
                elements.dropzone.dataset.fileData = '';
                elements.dropzone.textContent = 'Drag & drop or click to select a file';
                console.log(sound.name + ' is using the default file.');
            }

            // Update Controls
            updateSoundControls(sound, isEnabled);
        }
    });
}

/**
 * Resets all settings to default values.
 */
function resetAllSettings() {
    var saveSettingsButton = document.getElementById('saveSettings');

    var confirmReset = confirm(
        "Are you sure you want to restore all values to their defaults?\n\nClick OK to proceed or Cancel to keep your current settings."
    );
    if (!confirmReset) {
        console.log('User canceled the reset operation.');
        return; // User canceled
    }

    var settings = { chimeVolume: 0.5 }; // Reset Master Volume
    for (var key in soundLibrary) {
        var sound = soundLibrary[key];
        var storageKeys = sound.storageKeys;

        settings[storageKeys.enabled] = sound.defaultValues.enabled;
        settings[storageKeys.fileName] = sound.defaultValues.fileName;
        settings[storageKeys.volume] = sound.defaultValues.volume;
        settings[storageKeys.fileData] = sound.defaultValues.fileData;
    }
    console.log('Resetting settings to default values:', settings);
    chrome.storage.local.set(settings, function () {
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
