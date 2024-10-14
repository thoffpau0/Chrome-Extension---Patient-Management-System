// audioManager.js
const AudioManager = (function() {
    let audio = null;
    let isPlaying = false;
    const chimeQueue = [];
    let cachedSoundFileURL = null;
    let cachedVolume = 0.5; // Default volume
	const mp3Filename = Globals.getDefaultMp3Filename();

    /**
     * Logs messages to the console if debug mode is enabled.
     * @param {string} message - The message to log.
     * @param  {...any} args - Additional arguments.
     */
    const logDebug = (message, ...args) => {
        if (Globals.getDebug()) { // Using the getter method from Globals
            console.log(`[AudioManager] ${message}`, ...args);
        }
    };

    /**
     * Loads and caches the selected sound and volume.
     */
    const loadSound = () => {
        chrome.storage.local.get(['selectedSound', 'chimeVolume'], (result) => {
            cachedSoundFileURL = result.selectedSound || chrome.runtime.getURL(`resources/${mp3Filename}`);
            cachedVolume = (result.chimeVolume !== undefined) ? result.chimeVolume : 0.5;
            logDebug("Sound loaded:", cachedSoundFileURL);
            logDebug("Chime volume:", cachedVolume);
            // Preload audio
            preloadAudio();
        });
    };

    /**
     * Preloads the audio to reduce playback latency.
     */
    const preloadAudio = () => {
        try {
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            } else {
                audio = new Audio();
            }
            audio.src = cachedSoundFileURL;
            audio.volume = cachedVolume;
            audio.load();
            logDebug("Audio preloaded:", cachedSoundFileURL);
        } catch (error) {
            console.error("Error preloading audio:", error);
        }
    };

    /**
     * Plays a chime sound. Queues the sound if another chime is currently playing.
     */
    const MAX_QUEUE_SIZE = 10;
	const playChime = () => {
		if (chimeQueue.length >= MAX_QUEUE_SIZE) {
			logDebug("Chime queue is full. Chime request ignored.");
			return;
		}
        logDebug("playChime() called. isPlaying:", isPlaying);

        chimeQueue.push(() => {
            return new Promise((resolve, reject) => {
                // Use cached values
                const soundFileURL = cachedSoundFileURL || chrome.runtime.getURL(`resources/${mp3Filename}`);
                const volume = cachedVolume;

                logDebug("Using soundFileURL:", soundFileURL);
                logDebug("Chime volume set to:", volume);

                try {
                    // Reuse the existing Audio instance if possible
                    if (audio) {
                        audio.pause();
                        audio.currentTime = 0;
                    } else {
                        audio = new Audio();
                    }
                    audio.src = soundFileURL;
                    audio.volume = volume;

                    const playPromise = audio.play();
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                logDebug("Chime sound started playing.");
                            })
                            .catch((error) => {
                                console.error("Error playing chime sound:", error);
                                // If the current sound is custom, attempt to revert to default
                                if (soundFileURL !== chrome.runtime.getURL(`resources/${mp3Filename}`)) {
                                    logDebug("Attempting to revert to default sound.");
                                    audio.onerror = null; // Remove current error handler to prevent recursion
                                    chrome.storage.local.set({ selectedSound: chrome.runtime.getURL(`resources/${mp3Filename}`), soundName: "Default Chime" }, () => {
                                        if (chrome.runtime.lastError) {
                                            console.error("Error reverting to default sound:", chrome.runtime.lastError);
                                            reject(error);
                                            return;
                                        }
                                        // Update cached values
                                        cachedSoundFileURL = chrome.runtime.getURL(`resources/${mp3Filename}`);
                                        preloadAudio();
                                        playChime(); // Retry with default sound
                                        resolve();
                                    });
                                } else {
                                    reject(error); // If already using default sound, reject
                                }
                            });
                    }

                    audio.onended = () => {
                        logDebug("Chime sound finished playing.");
                        resolve();
                    };

                    audio.onerror = (event) => {
						console.error("Audio playback error:", event);
						// If the current sound is custom, attempt to revert to default
						if (soundFileURL !== chrome.runtime.getURL(`resources/${mp3Filename}`)) {
							logDebug("Attempting to revert to default sound due to playback error.");
							audio.onerror = null; // Remove current error handler to prevent recursion
							chrome.storage.local.set({ selectedSound: chrome.runtime.getURL(`resources/${mp3Filename}`), soundName: "Default Chime" }, () => {
								if (chrome.runtime.lastError) {
									console.error("Error reverting to default sound:", chrome.runtime.lastError);
									// Send a message to the options page to notify the user
									chrome.runtime.sendMessage({ message: "audioPlaybackError", error: "Failed to play custom sound. Reverting to default." });
									reject(event);
									return;
								}
								// Update cached values
								cachedSoundFileURL = chrome.runtime.getURL(`resources/${mp3Filename}`); // Use default if no custom sound
								preloadAudio();
								playChime(); // Retry with default sound
								resolve();
							});
						} else {
							reject(event); // If already using default sound, reject
						}
					};
                } catch (error) {
                    console.error("Error initializing audio:", error);
                    reject(error);
                }
            });
        });

        if (!isPlaying) {
            processQueue();
        }
    };

    /**
     * Processes the chime queue, ensuring that chimes are played sequentially.
     */
    const processQueue = () => {
        if (chimeQueue.length === 0) {
            isPlaying = false;
            return;
        }
        isPlaying = true;
        const nextChime = chimeQueue.shift();
        nextChime()
            .then(() => {
                processQueue();
            })
            .catch((error) => {
                console.error("Error processing chime:", error);
                processQueue(); // Continue processing the queue even if there's an error
            });
    };

    /**
     * Cleans up audio resources to prevent memory leaks.
     */
    const cleanup = () => {
        if (audio) {
            audio.pause();
            audio.src = '';
            audio = null;
            logDebug("Audio resources have been cleaned up.");
        }
        chimeQueue.length = 0; // Clear the queue
        isPlaying = false;
        cachedSoundFileURL = null;
        cachedVolume = 0.5; // Reset to default volume
    };

    // Initialize by loading the sound and volume
    loadSound();

    return {
        playChime,
        cleanup
    };
})();
