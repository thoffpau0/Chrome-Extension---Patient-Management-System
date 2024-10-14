// options.js
// Access the global Constants object
const MESSAGES = window.Constants.getMessages();

document.addEventListener('DOMContentLoaded', () => {
	const resetSoundButton = document.getElementById('resetSound');
    const disableButton = document.getElementById('disableButton');
    const soundPicker = document.getElementById('soundPicker');
    const saveSettings = document.getElementById('saveSettings');
    const currentSound = document.getElementById('currentSound');
    const messageDiv = document.getElementById('message');
    let settingsChanged = false;
	
    // Function to display messages
    function showMessage(message, type = 'success') {
        messageDiv.textContent = message;
        messageDiv.className = type;
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = '';
        }, 3000);
    }

	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		switch(request.message) {
			case MESSAGE_TYPES.AUDIO_PLAYBACK_ERROR:
				showMessage(request.error, 'error');
				return false; // Synchronous response
				
			default:
				console.warn("Unknown message received:", request.message);
				sendResponse({ success: false, error: "Unknown message type." });
				return false; // Synchronous response
		}
	});

   // Disable button click: Sends a message to disable the extension
    if (disableButton) {
        disableButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to disable the Vet Radar Notification extension?')) {
                chrome.runtime.sendMessage({ message: "toggleExtensionState", state: false }, (response) => {
                    if (chrome.runtime.lastError) {
                        showMessage('Failed to disable the extension.', 'error');
                        console.error("Error disabling extension:", chrome.runtime.lastError.message);
                    } else {
                        showMessage('Extension disabled successfully.', 'success');
                        // Optionally, disable further interactions on the options page
                        disableButton.disabled = true;
                        saveSettings.disabled = true;
                        soundPicker.disabled = true;
                    }
                });
            }
        });
    }

    // Handle sound file selection
    if (soundPicker) {
		soundPicker.addEventListener('change', (event) => {
			const file = event.target.files[0];
			if (file && (file.type === 'audio/mpeg' || file.type === 'audio/mp3')) {
				// Implement file size limit (e.g., 5MB)
				const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
				if (file.size > MAX_FILE_SIZE) {
					showMessage('File size exceeds 5MB limit.', 'error');
					soundPicker.value = ''; // Reset the file input
					return;
				}

				const reader = new FileReader();
				reader.onload = function (e) {
					const soundData = e.target.result;
					chrome.storage.local.set({ selectedSound: soundData, soundName: file.name }, () => {
						if (chrome.runtime.lastError) {
							showMessage('Failed to save the sound file.', 'error');
							console.error("Error saving sound file:", chrome.runtime.lastError);
							return;
						}
						console.log('Sound file saved:', file.name);
						currentSound.innerText = `Current Sound: ${file.name}`;
						settingsChanged = true; // Mark that settings have been changed
						saveSettings.disabled = false; // Enable save button
						showMessage('Sound file selected. Click "Save and Close" to apply.', 'success');
					});
				};
				reader.onerror = function () {
					showMessage('Failed to read the file.', 'error');
					console.error("FileReader error:", reader.error);
				};
				reader.readAsDataURL(file);
			} else {
				alert('Please select a valid MP3 file.');
				soundPicker.value = ''; // Reset the file input
			}
		});
    }
	
	// Handle volume slider changes
    if (chimeVolumeSlider) {
        chimeVolumeSlider.addEventListener('input', (event) => {
            let volume = parseFloat(event.target.value);
			// Clamp volume between 0.0 and 1.0
			volume = Math.min(Math.max(volume, 0.0), 1.0);
			event.target.value = volume.toFixed(1);
			volumeValueDisplay.textContent = volume.toFixed(1);
			chrome.storage.local.set({ chimeVolume: volume }, () => {
                if (chrome.runtime.lastError) {
                    showMessage('Failed to set chime volume.', 'error');
                    console.error("Error setting chime volume:", chrome.runtime.lastError);
                    return;
                }
                settingsChanged = true; // Mark that settings have been changed
                saveSettings.disabled = false; // Enable save button
                showMessage('Chime volume updated.', 'success');
            });
        });
    }

    // Save the settings when the save button is clicked
    if (saveSettings) {
        saveSettings.addEventListener('click', () => {
            if (settingsChanged) {
                showMessage('Settings saved successfully.', 'success');
                settingsChanged = false;
                saveSettings.disabled = true; // Disable save button until next change
                window.close(); // Close the options page
            } else {
                showMessage('No changes to save.', 'info');
            }
        });
    }

	if (resetSoundButton) {
		resetSoundButton.addEventListener('click', () => {
			chrome.storage.local.remove(['selectedSound', 'soundName'], () => {
				currentSound.innerText = 'Current Sound: Default';
				showMessage('Sound reset to default.', 'success');
				soundPicker.value = '';
				saveSettings.disabled = true;
			});
		});
	}

	// Disable the save button initially until changes are made
    saveSettings.disabled = true;

    // Load current settings and display the current sound name
    chrome.storage.local.get(['soundName', 'chimeVolume'], (result) => {
        if (result.soundName) {
            currentSound.innerText = `Current Sound: ${result.soundName}`;
        } else {
            currentSound.innerText = 'Current Sound: Default';
        }
		
		if (result.chimeVolume !== undefined) {
            chimeVolumeSlider.value = result.chimeVolume;
            volumeValueDisplay.textContent = result.chimeVolume.toFixed(1);
        } else {
            chimeVolumeSlider.value = 0.5; // Default volume
            volumeValueDisplay.textContent = '0.5';
        }
    });
});
