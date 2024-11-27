// options_event_listeners.js

function setupEventListeners() {
    var saveSettingsButton = document.getElementById('saveSettings');
    var restoreDefaultsButton = document.getElementById('restoreDefaults');
    var masterVolumeSlider = document.getElementById('volumeSlider');
    var masterVolumeValue = document.getElementById('volumeValue');

    // Master Volume Slider
    masterVolumeSlider.addEventListener('input', function () {
        var volume = parseFloat(masterVolumeSlider.value);
        masterVolumeValue.innerText = Math.round(volume * 100) + '%';
        console.log('Master Volume changed to ' + (volume * 100) + '%');
        updateSaveButton(saveSettingsButton);
    });

    // Sound Library Event Listeners
    for (var key in soundLibrary) {
        (function (key) {
            var sound = soundLibrary[key];
            var elements = sound.elements;

            // Enable Checkbox
            elements.enableCheckbox.addEventListener('change', function () {
                var isEnabled = elements.enableCheckbox.checked;
                console.log('Enable checkbox for ' + sound.name + ' changed to ' + isEnabled);
                
				// We still call updateSoundControls, but it no longer disables controls
				updateSoundControls(sound, isEnabled);

				// Mark that settings have changed
                updateSaveButton(saveSettingsButton);
            });

            // Dropdown
            elements.selectDropdown.addEventListener('change', function () {
                var selectedValue = elements.selectDropdown.value;
                console.log('Select dropdown for ' + sound.name + ' changed to ' + selectedValue);
                updateSaveButton(saveSettingsButton);
            });

            // Volume Slider
            elements.volumeSlider.addEventListener('input', function () {
                var volume = parseFloat(elements.volumeSlider.value);
                elements.volumeValue.innerText = Math.round(volume * 100) + '%';
                console.log('Volume slider for ' + sound.name + ' changed to ' + (volume * 100) + '%');
                updateSaveButton(saveSettingsButton);
            });

            // Reset Button
            elements.resetButton.addEventListener('click', function () {
                console.log('Reset button clicked for ' + sound.name);
                chrome.storage.local.remove([
                    sound.storageKeys.fileName,
                    sound.storageKeys.fileData,
                    sound.storageKeys.volume,
                ], function () {
                    if (chrome.runtime.lastError) {
                        console.error('Error resetting ' + sound.name + ' sound:', chrome.runtime.lastError);
                        alert('Failed to reset the sound.');
                        return;
                    }
                    console.log(sound.name + ' sound has been reset to default.');
                    showNotification('"' + sound.name + '" sound has been reset to default.');
                    loadAllSettings();
                });
            });

            // Dropzone (Drag & Drop or File Select)
            var dropzone = elements.dropzone;

            dropzone.addEventListener('dragover', function (e) {
                e.preventDefault();
                dropzone.classList.add('dragover');
                console.log('Dragging over dropzone for ' + sound.name);
            });

            dropzone.addEventListener('dragleave', function () {
                dropzone.classList.remove('dragover');
                console.log('Dragging left dropzone for ' + sound.name);
            });

            dropzone.addEventListener('drop', function (e) {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                console.log('File dropped on dropzone for ' + sound.name);
                var file = e.dataTransfer.files[0];
                if (file) {
                    if (file.type !== 'audio/mp3' && file.type !== 'audio/mpeg') {
                        console.error('Invalid file type for ' + sound.name + ':', file.type);
                        alert('Please upload a valid MP3 file.');
                        return;
                    }
                    var reader = new FileReader();
                    reader.onload = function (event) {
                        var dataURL = event.target.result;
                        dropzone.dataset.fileData = dataURL;
                        dropzone.textContent = 'Custom file uploaded';
                        console.log('Custom file uploaded for ' + sound.name + ':', dataURL);
                        updateSaveButton(saveSettingsButton);
                    };
                    reader.onerror = function (error) {
                        console.error('Error reading file for ' + sound.name + ':', error);
                        alert('An error occurred while reading the file. Please try again.');
                    };
                    reader.readAsDataURL(file);
                } else {
                    console.warn('No file found in drop event for ' + sound.name + '.');
                }
            });

            dropzone.addEventListener('click', function () {
                console.log('Dropzone clicked for ' + sound.name);
                var fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'audio/mp3, audio/mpeg';
                fileInput.onchange = function () {
                    var selectedFile = fileInput.files[0];
                    if (selectedFile) {
                        console.log('File selected for ' + sound.name + ':', selectedFile);
                        if (selectedFile.type !== 'audio/mp3' && selectedFile.type !== 'audio/mpeg') {
                            console.error('Invalid file type for ' + sound.name + ':', selectedFile.type);
                            alert('Please upload a valid MP3 file.');
                            return;
                        }
                        var reader = new FileReader();
                        reader.onload = function (event) {
                            var dataURL = event.target.result;
                            dropzone.dataset.fileData = dataURL;
                            dropzone.textContent = 'Custom file uploaded';
                            console.log('Custom file uploaded for ' + sound.name + ':', dataURL);
                            updateSaveButton(saveSettingsButton);
                        };
                        reader.onerror = function (error) {
                            console.error('Error reading file for ' + sound.name + ':', error);
                            alert('An error occurred while reading the file. Please try again.');
                        };
                        reader.readAsDataURL(selectedFile);
                    } else {
                        console.warn('No file selected for ' + sound.name + '.');
                    }
                };
                fileInput.click();
            });

            // Play Button
            elements.playButton.addEventListener('click', function () {
                console.log('Play button clicked for ' + sound.name);
                playSound(key);
            });
        })(key);
    }

    // Save and Restore Buttons
    saveSettingsButton.addEventListener('click', saveAllSettings);
    restoreDefaultsButton.addEventListener('click', resetAllSettings);
}
