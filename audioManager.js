// audioManager.js

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

        /**
         * Loads and caches the selected sounds and volume.
         */
        function loadSounds() {
            chrome.storage.local.get([
                'soundFileDiagnostics',
                'soundFileMedication',
                'soundFileNursingCare',
                'soundFilePatientAdded',
                'soundFilePatientRemoved',
                'chimeVolume'
            ], result => {
                // Load custom sounds if available, otherwise use defaults
                cachedSoundFiles = {
                    diagnostics: result.soundFileDiagnostics || chrome.runtime.getURL('3_tone_chime-99718.mp3'),
                    medication: result.soundFileMedication || chrome.runtime.getURL('mixkit-bell-notification-933.mp3'),
                    nursingCare: result.soundFileNursingCare || chrome.runtime.getURL('mixkit-doorbell-single-press-333.mp3'),
                    patientAdded: result.soundFilePatientAdded || chrome.runtime.getURL('BuddyIn.mp3'),
                    patientRemoved: result.soundFilePatientRemoved || chrome.runtime.getURL('Goodbye.mp3'),
                };

                cachedVolume = result.chimeVolume !== undefined ? result.chimeVolume : 0.5;

                logDebug('Sounds loaded:', cachedSoundFiles);
                logDebug('Master Chime volume:', cachedVolume);

                // Preload audio
                preloadAudio();
            });
        }

        /**
         * Loads and caches per-sound volume settings.
         */
        function loadLibraryVolumes() {
            const volumeKeys = [
                'volumeLibraryDiagnostics',
                'volumeLibraryMedication',
                'volumeLibraryNursingCare',
                'volumeLibraryPatientAdded',
                'volumeLibraryPatientRemoved'
            ];
            chrome.storage.local.get(volumeKeys, (result) => {
                for (const key of volumeKeys) {
                    cachedLibraryVolumes[key.replace('volumeLibrary', '').toLowerCase()] = result[key] !== undefined ? result[key] : 1.0;
                }
                logDebug('Per-sound volumes loaded:', cachedLibraryVolumes);
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
                    logDebug(`Audio preloaded for ${key}:`, cachedSoundFiles[key].src);
                }
            } catch (error) {
                console.error('Error preloading audio:', error);
            }
        }

        /**
         * Plays a chime sound based on the soundType.
         * @param {string} soundType - The type of sound to play ('diagnostics', 'medication', 'nursingCare', 'patientAdded', 'patientRemoved').
         */
        function playChime(soundType) {
            if (chimeQueue.length >= MAX_QUEUE_SIZE) {
                logDebug('Chime queue is full. Chime request ignored.');
                return;
            }
            logDebug('playChime() called. isPlaying:', isPlaying, 'soundType:', soundType);

            chimeQueue.push(() => {
                return new Promise((resolve, reject) => {
                    // Use cached Audio objects
                    const audioObj = cachedSoundFiles[soundType] || cachedSoundFiles['diagnostics']; // Fallback to Diagnostics default

                    logDebug('Using audio object:', audioObj.src);
                    logDebug('Master volume set to:', cachedVolume);
                    logDebug('Per-sound volume set to:', cachedLibraryVolumes[soundType] || 1.0);

                    try {
                        // Clone the Audio object to allow overlapping sounds
                        const audioClone = audioObj.cloneNode();
                        const perSoundVolume = cachedLibraryVolumes[soundType] || 1.0;
                        audioClone.volume = cachedVolume * perSoundVolume;

                        const playPromise = audioClone.play();
                        if (playPromise !== undefined) {
                            playPromise
                                .then(() => {
                                    logDebug(`Chime sound started playing for ${soundType}.`);
                                })
                                .catch(error => {
                                    console.error('Error playing chime sound:', error);
                                    reject(error);
                                });
                        }

                        audioClone.onended = () => {
                            logDebug(`Chime sound finished playing for ${soundType}.`);
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
            logDebug('Audio resources have been cleaned up.');
        }

        /**
         * Updates sound files and volume dynamically when storage changes.
         */
        function updateSoundsFromStorage(changes, area) {
            if (area === 'local') {
                let shouldPreload = false;

                if (changes.soundFileDiagnostics) {
                    cachedSoundFiles.diagnostics = changes.soundFileDiagnostics.newValue || chrome.runtime.getURL('3_tone_chime-99718.mp3');
                    shouldPreload = true;
                }
                if (changes.soundFileMedication) {
                    cachedSoundFiles.medication = changes.soundFileMedication.newValue || chrome.runtime.getURL('mixkit-bell-notification-933.mp3');
                    shouldPreload = true;
                }
                if (changes.soundFileNursingCare) {
                    cachedSoundFiles.nursingCare = changes.soundFileNursingCare.newValue || chrome.runtime.getURL('mixkit-doorbell-single-press-333.mp3');
                    shouldPreload = true;
                }
                if (changes.soundFilePatientAdded) {
                    cachedSoundFiles.patientAdded = changes.soundFilePatientAdded.newValue || chrome.runtime.getURL('BuddyIn.mp3');
                    shouldPreload = true;
                }
                if (changes.soundFilePatientRemoved) {
                    cachedSoundFiles.patientRemoved = changes.soundFilePatientRemoved.newValue || chrome.runtime.getURL('Goodbye.mp3');
                    shouldPreload = true;
                }
                if (changes.chimeVolume) {
                    cachedVolume = changes.chimeVolume.newValue;
                    shouldPreload = true;
                }

                // Handle per-sound volume changes
                const volumeKeys = Object.keys(cachedLibraryVolumes).map(key => `volumeLibrary${capitalizeFirstLetter(key)}`);
                for (const key of volumeKeys) {
                    if (changes[key]) {
                        const soundType = key.replace('volumeLibrary', '').toLowerCase();
                        cachedLibraryVolumes[soundType] = changes[key].newValue;
                        logDebug(`Per-sound volume updated for ${soundType}:`, changes[key].newValue);
                    }
                }

                if (shouldPreload) {
                    preloadAudio();
                }
            }
        }

        // Utility function to capitalize the first letter of a string
        function capitalizeFirstLetter(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        }

        // Function to log debug messages
        function logDebug(message, ...args) {
            if (global.debug) {
                console.log(`[AudioManager] ${message}`, ...args);
            }
        }

        // Listen for changes in storage to update sounds and volume dynamically
        chrome.storage.onChanged.addListener(updateSoundsFromStorage);

        // Initialize by loading the sounds, master volume, and per-sound volumes
        loadSounds();
        loadLibraryVolumes();

        // Expose public methods by returning an object
        return {
            playChime: playChime,
            cleanup: cleanup,
        };
    })();

    // Expose the AudioManager to the global scope
    global.AudioManager = AudioManager;

})(window);
