// audiomanager.js

(function (global) {
    'use strict';

    global.VR_Mon_App = global.VR_Mon_App || {};

    global.VR_Mon_App.AudioManager = (function () {
        // Private variables and functions
        let isPlaying = false;
        const chimeQueue = [];
        let cachedSoundFiles = {};
        let cachedVolume = 0.5; // Default master volume
        let cachedLibraryVolumes = {}; // Per-sound volume settings

        const MAX_QUEUE_SIZE = 20;
		// Initial load of settings
		function loadSettings() {
			chrome.storage.local.get(['chimeVolume', 'patientAddedVolume', 'patientRemovedVolume', 'examRoomNotificationVolume', 'enablePatientAdded', 'enablePatientRemoved','enableExamRoomNotification'], function (result) {
				// Initialize your variables with the settings
				var chimeVolume = result.chimeVolume !== undefined ? result.chimeVolume : 0.5;
				var patientAddedVolume = result.patientAddedVolume !== undefined ? result.patientAddedVolume : 1.0;
				var patientRemovedVolume = result.patientRemovedVolume !== undefined ? result.patientRemovedVolume : 1.0;
				var examRoomNotificationVolume = result.examRoomNotificationVolume !== undefined ? result.examRoomNotificationVolume : 1.0;
				var enablePatientAdded = result.enablePatientAdded !== false; // Default to true if undefined
				var enablePatientRemoved = result.enablePatientRemoved !== false; // Default to true if undefined
				var enableExamRoomNotification = result.enableExamRoomNotification !== false; // Default to true if undefined

				// Update your variables or state accordingly
				// For example:
				window.chimeVolume = chimeVolume;
				window.patientAddedVolume = patientAddedVolume;
				window.patientRemovedVolume = patientRemovedVolume;
				window.examRoomNotificationVolume = examRoomNotificationVolume;
				window.enablePatientAdded = enablePatientAdded;
				window.enablePatientRemoved = enablePatientRemoved;
				window.enableExamRoomNotification = enableExamRoomNotification;

				console.log('Settings loaded:', {
					chimeVolume,
					patientAddedVolume,
					patientRemovedVolume,
					examRoomNotificationVolume,
					enablePatientAdded,
					enablePatientRemoved,
					enableExamRoomNotification,
				});
			});
		}

		// Listen for changes in storage
		chrome.storage.onChanged.addListener(function (changes, areaName) {
			if (areaName === 'local') {
				console.log('Storage changes detected:', changes);

				// Update variables based on changes
				if (changes.chimeVolume) {
					window.chimeVolume = changes.chimeVolume.newValue;
					console.log('Updated chimeVolume:', window.chimeVolume);
				}
				if (changes.patientAddedVolume) {
					window.patientAddedVolume = changes.patientAddedVolume.newValue;
					console.log('Updated patientAddedVolume:', window.patientAddedVolume);
				}
				if (changes.patientRemovedVolume) {
					window.patientRemovedVolume = changes.patientRemovedVolume.newValue;
					console.log('Updated patientRemovedVolume:', window.patientRemovedVolume);
				}
				if (changes.examRoomNotificationVolume) {
					window.examRoomNotificationVolume = changes.examRoomNotificationVolume.newValue;
					console.log('Updated examRoomNotificationVolume:', window.examRoomNotificationVolume);
				}
				if (changes.enablePatientAdded) {
					window.enablePatientAdded = changes.enablePatientAdded.newValue;
					console.log('Updated enablePatientAdded:', window.enablePatientAdded);
				}
				if (changes.enablePatientRemoved) {
					window.enablePatientRemoved = changes.enablePatientRemoved.newValue;
					console.log('Updated enablePatientRemoved:', window.enablePatientRemoved);
				}
				if (changes.enableExamRoomNotification) {
					window.enableExamRoomNotification = changes.enableExamRoomNotification.newValue;
					console.log('Updated enableExamRoomNotification:', window.enableExamRoomNotification);
				}
				// If there are other settings, handle them here
			}
		});

		// Call loadSettings when the content script is first executed
		loadSettings();

        /**
         * Loads and caches the selected sounds and volume.
         */
        function loadSounds() {
            chrome.storage.local.get([
                'patientAddedFileData',
                'patientAddedFileName',
                'patientRemovedFileData',
                'patientRemovedFileName',
				'examRoomNotificationFileData',
				'examRoomNotificationFileName',
                // Include other sounds as needed
                'chimeVolume'
            ], result => {
                // Load custom sounds if available, otherwise use defaults
                cachedSoundFiles = {
                    patientAdded: result.patientAddedFileData || chrome.runtime.getURL(result.patientAddedFileName || 'BuddyIn.mp3'),
                    patientRemoved: result.patientRemovedFileData || chrome.runtime.getURL(result.patientRemovedFileName || 'Goodbye.mp3'),
					examRoomNotification: result.examRoomNotificationFileData || chrome.runtime.getURL(result.examRoomNotificationFileName || '3_tone_chime-99718.mp3'),
                    // Include other sounds as needed
                };

                cachedVolume = result.chimeVolume !== undefined ? result.chimeVolume : 0.5;

                logDebugAudioManager('Sounds loaded:', cachedSoundFiles);
                logDebugAudioManager('Master Chime volume:', cachedVolume);

                // Preload audio
                preloadAudio();
            });
        }

        /**
         * Loads and caches per-sound volume settings.
         */
        function loadLibraryVolumes() {
            const volumeKeys = [
                'patientAddedVolume',
                'patientRemovedVolume',
				'examRoomNotificationVolume',
                // Include other volume keys as needed
            ];
            chrome.storage.local.get(volumeKeys, (result) => {
                cachedLibraryVolumes = {
                    patientAdded: result.patientAddedVolume !== undefined ? result.patientAddedVolume : 1.0,
                    patientRemoved: result.patientRemovedVolume !== undefined ? result.patientRemovedVolume : 1.0,
					examRoomNotification: result.examRoomNotificationVolume !== undefined ? result.examRoomNotificationVolume : 1.0,
                    // Include other volumes as needed
                };
                logDebugAudioManager('Per-sound volumes loaded:', cachedLibraryVolumes);
            });
        }

        /**
         * Preloads the audio files to reduce playback latency.
         */
        function preloadAudio() {
            try {
                // Preload each audio file
                for (const key in cachedSoundFiles) {
                    const audioObj = new Audio();
                    audioObj.src = cachedSoundFiles[key];
                    audioObj.load();
                    cachedSoundFiles[key] = audioObj; // Store Audio objects instead of URLs
                    logDebugAudioManager(`Audio preloaded for ${key}:`, cachedSoundFiles[key].src);
                }
            } catch (error) {
                console.error('Error preloading audio:', error);
            }
        }

        /**
         * Plays a chime sound based on the soundType.
         * @param {string} soundType - The type of sound to play ('patientAdded', 'patientRemoved', etc.).
         */
        function playChime(soundType) {
            if (chimeQueue.length >= MAX_QUEUE_SIZE) {
                logDebugAudioManager('Chime queue is full. Chime request ignored.');
                return;
            }
            logDebugAudioManager('playChime() called. isPlaying:', isPlaying, 'soundType:', soundType);

            // Check if the sound is enabled
            const enabledKey = 'enable' + capitalizeFirstLetter(soundType);
            chrome.storage.local.get(enabledKey, result => {
                const isEnabled = result[enabledKey] !== false; // Default to true if undefined
                if (!isEnabled) {
                    logDebugAudioManager(`${soundType} sound is disabled. Chime will not be played.`);
                    return;
                }

                chimeQueue.push(() => {
                    return new Promise((resolve, reject) => {
                        // Use cached Audio objects
                        const audioObj = cachedSoundFiles[soundType];
                        if (!audioObj) {
                            console.error(`No audio object found for soundType: ${soundType}`);
                            resolve();
                            return;
                        }

                        logDebugAudioManager('Using audio object:', audioObj.src);
                        logDebugAudioManager('Master volume set to:', cachedVolume);
                        logDebugAudioManager('Per-sound volume set to:', cachedLibraryVolumes[soundType] || 1.0);

                        try {
                            // Clone the Audio object to allow overlapping sounds
                            const audioClone = audioObj.cloneNode();
                            const perSoundVolume = cachedLibraryVolumes[soundType] || 1.0;
                            audioClone.volume = cachedVolume * perSoundVolume;

                            const playPromise = audioClone.play();
                            if (playPromise !== undefined) {
                                playPromise
                                    .then(() => {
                                        logDebugAudioManager(`Chime sound started playing for ${soundType}.`);
                                    })
                                    .catch(error => {
                                        console.error('Error playing chime sound:', error);
                                        reject(error);
                                    });
                            }

                            audioClone.onended = () => {
                                logDebugAudioManager(`Chime sound finished playing for ${soundType}.`);
                                resolve();
                            };

                            audioClone.onerror = event => {
                                console.error('Audio playback error:', event);
                                reject(event);
                            };
                        } catch (error) {
                            console.error('Error initializing audio:', error);
                            reject(error);
                        }
                    });
                });

                if (!isPlaying) {
                    processQueue();
                }
            });
        }

        /**
         * Processes the chime queue, ensuring that chimes are played sequentially.
         */
        function processQueue() {
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
                .catch(error => {
                    console.error('Error processing chime:', error);
                    processQueue(); // Continue processing the queue even if there's an error
                });
        }

        /**
         * Cleans up audio resources to prevent memory leaks.
         */
        function cleanup() {
            chimeQueue.length = 0; // Clear the queue
            isPlaying = false;
            cachedSoundFiles = {};
            cachedLibraryVolumes = {};
            cachedVolume = 0.5; // Reset to default volume
            logDebugAudioManager('Audio resources have been cleaned up.');
        }

        // Utility function to capitalize the first letter of a string
        function capitalizeFirstLetter(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        }

        // Function to log debug messages
        function logDebugAudioManager(message, ...args) {
            if (window.debug) {
                console.log(`[AudioManager] ${message}`, ...args);
            }
        }

        // Initialize by loading the sounds, master volume, and per-sound volumes
        loadSounds();
        loadLibraryVolumes();

        // Expose public methods by returning an object
        return {
            playChime: playChime,
            cleanup: cleanup,
        };
    })();

})(window);
