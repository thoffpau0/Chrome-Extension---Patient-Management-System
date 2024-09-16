document.addEventListener('DOMContentLoaded', () => {
    const disableButton = document.getElementById('disableButton');
    const soundPicker = document.getElementById('soundPicker');
    const saveSettings = document.getElementById('saveSettings');
    const currentSound = document.getElementById('currentSound');
    let settingsChanged = false;

    // Disable button click: Sends a message to disable the extension
    if (disableButton) {
        disableButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({ message: "disableExtension" });
        });
    }

    // Handle sound file selection
    if (soundPicker) {
        soundPicker.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type === 'audio/mpeg') { // Ensure it's an MP3 file
                const reader = new FileReader();
                reader.onload = function (e) {
                    const soundData = e.target.result;
                    chrome.storage.local.set({ soundFile: soundData, soundName: file.name }, () => {
                        console.log('Sound file saved:', file.name);
                        currentSound.innerText = `Current Sound: ${file.name}`;
                        settingsChanged = true; // Mark that settings have been changed
                        saveSettings.disabled = false; // Enable save button
                    });
                };
                reader.readAsDataURL(file);
            } else {
                alert('Please select a valid MP3 file.');
            }
        });
    }

    // Save the settings when the save button is clicked
    if (saveSettings) {
        saveSettings.addEventListener('click', () => {
            if (settingsChanged) {
                alert('Settings saved.');
            } else {
                alert('No changes made.');
            }
            window.close(); // Close the options page
        });
    }

    // Disable the save button initially until changes are made
    saveSettings.disabled = true;

    // Load current settings and display the current sound name
    chrome.storage.local.get(['soundName'], (result) => {
        if (result.soundName) {
            currentSound.innerText = `Current Sound: ${result.soundName}`;
        } else {
            currentSound.innerText = 'Current Sound: Default';
        }
    });
});
