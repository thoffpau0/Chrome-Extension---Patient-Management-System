// options_util.js

/**
 * Updates the Save Settings button state.
 */
function updateSaveButton() {
    if (!settingsChanged) {
        settingsChanged = true;
        saveSettingsButton.disabled = false;
        console.log('Settings have been modified. Save button enabled.');
    }
}

/**
 * Shows a temporary notification.
 * @param {string} message - The message to display.
 * @param {number} [duration=3000] - Duration in milliseconds.
 */
function showNotification(message, duration) {
    duration = duration || 3000;
    var notification = document.createElement('div');
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
    setTimeout(function () {
        document.body.removeChild(notification);
    }, duration);
}

/**
 * Updates the state of sound controls based on enabled status.
 * @param {Object} sound - The sound object from soundLibrary.
 * @param {boolean} isEnabled - Whether the sound is enabled.
 */
function updateSoundControls(sound, isEnabled) {
    var elements = sound.elements;
	
    // We no longer disable the controls based on the enabled status.
    // All controls remain accessible at all times.
	
    console.log('Updated controls for ' + sound.name + ': Enabled = ' + isEnabled);
}

// options_util.js

/**
 * Plays a sound for testing purposes.
 * @param {string} soundKey - The key of the sound in soundLibrary.
 */
function playSound(soundKey) {
    var sound = soundLibrary[soundKey];
    var elements = sound.elements;
    var storageKeys = sound.storageKeys;

    // Get the current selected file from the dropdown
    var selectedFileName = elements.selectDropdown.value;
    var customFileData = elements.dropzone.dataset.fileData;

    // Get the current volume value from the volume slider
    var soundVolume = parseFloat(elements.volumeSlider.value);

    // Get the master volume
    var masterVolume = parseFloat(masterVolumeSlider.value);

    var audioSrc;
    if (customFileData) {
        // Use custom uploaded file
        audioSrc = customFileData;
        console.log(sound.name + ' Sound using custom file.');
    } else {
        // Use predefined file
        audioSrc = chrome.runtime.getURL(selectedFileName || sound.defaultValues.fileName);
        console.log(sound.name + ' Sound using predefined file: ' + audioSrc);
    }

    console.log('Audio Source for ' + sound.name + ': ' + audioSrc);

    var audio = new Audio(audioSrc);
    audio.volume = masterVolume * soundVolume;

    console.log(sound.name + ' Volume: Master Volume (' + masterVolume + ') * Sound Volume (' + soundVolume + ') = ' + audio.volume);

    audio.play().then(function () {
        console.log(sound.name + ' Sound is playing.');
    }).catch(function (error) {
        console.error('Failed to play ' + sound.name + ' sound:', error);
        alert('Failed to play the sound "' + selectedFileName + '". Please ensure the file is valid and supported.');
    });
}
