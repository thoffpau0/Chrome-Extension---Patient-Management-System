// patientManager.js

(function (global) {
    'use strict';

    // Ensure your namespace exists
    global.VR_Mon_App = global.VR_Mon_App || {};

    // Define the AudioManager if not already defined
    global.VR_Mon_App.AudioManager = global.VR_Mon_App.AudioManager || {
        playChime: (type) => {
            // Implement the chime playing logic here
            const audio = new Audio(global.VR_Mon_App.AudioManager.getSoundFileURL(type));
            audio.play();
        },
        getSoundFileURL: (type) => {
            // Return the URL based on the type
            switch (type) {
                case 'patientAdded':
                    return chrome.runtime.getURL("BuddyIn.mp3"); // Replace with your actual file
                case 'patientRemoved':
                    return chrome.runtime.getURL("Goodbye.mp3"); // Replace with your actual file
                case 'examRoomNotification':
                    return chrome.runtime.getURL("3_tone_chime-99718.mp3"); // Replace with your actual file
                default:
                    return chrome.runtime.getURL("3_tone_chime-99718.mp3"); // Default sound
            }
        }
    };

    // Define the PatientManager module and assign it to your namespace
    global.VR_Mon_App.PatientManager = (() => {
        // Private variables
        const patientsData = {};
        let globalTimeSlots = [];
        let previousPatientNames = new Set(); // Track previous patient names

        // Reference to AudioManager
        const AudioManager = global.VR_Mon_App.AudioManager;

        // Centralized logging function
        const logDebug = (message, ...args) => {
            if (window.debug) {
                console.log(`[PatientManager] ${message}`, ...args);
            }
        };

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
         * Gets the patient list element.
         * @returns {HTMLElement|null} The patient list element or null if not found.
         */
        const getPatientList = () => {
            const patientList = document.querySelector('div[data-testid="PatientList"]');
            logDebug("Retrieved patient list:", patientList);
            return patientList;
        };

        /**
         * Finds and returns time slots for patients.
         * @returns {Array} An array of time slot strings.
         */
        const findTimeSlots = () => {
            if (globalTimeSlots.length > 0) {
                return globalTimeSlots;
            }

            // Regular expression to match time slot formats (e.g., "2:00pm")
            const timeSlotRegex = /^\d{1,2}:\d{2}(am|pm)$/i;

            // Find all elements with data-testid matching the time slot pattern
            const timeSlotElements = document.querySelectorAll('div[data-testid]');
            const timeSlots = Array.from(timeSlotElements)
                .map(el => el.getAttribute('data-testid'))
                .filter(dataTestId => timeSlotRegex.test(dataTestId));

            globalTimeSlots = timeSlots;

            logDebug("Found time slots:", timeSlots);
            return timeSlots;
        };

        /**
         * Recursively searches for a patient name within child elements.
         * @param {HTMLElement} element - The element to search within.
         * @returns {string|null} The normalized patient name or null if not found.
         */
        const findPatientNameInChildren = (element) => {
            if (!element) return null;

            const textContent = element.textContent.trim();
            const patientNameMatch = textContent.match(/^"(.+)"(?: [A-Za-z'\s]+)?$/);
            if (patientNameMatch) {
                return patientNameMatch[1].replace(/['"]/g, '').trim().toLowerCase();
            }

            for (let child of element.children) {
                const result = findPatientNameInChildren(child);
                if (result) return result;
            }

            return null;
        };

        /**
         * Checks if a patient is in an exam room by searching for a specific node.
         * @param {HTMLElement} patientListItem - The patient list item element.
         * @returns {boolean} True if the patient is in an exam room, false otherwise.
         */
        const isPatientInExamRoom = (patientListItem) => {
            // Define the prefix to search for
            const examRoomPrefix = "Exam, ";

            // Search for any node within patientListItem that starts with "Exam, "
            const examRoomNodes = patientListItem.querySelectorAll('*:not(script):not(style)');

            for (let node of examRoomNodes) {
                const textContent = node.textContent.trim();
                if (textContent.startsWith(examRoomPrefix)) {
                    return true;
                }
            }

            // Alternatively, search all text nodes for the pattern
            const textNodes = Array.from(patientListItem.querySelectorAll('*')).flatMap(element => 
                Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE)
            );

            for (let node of textNodes) {
                const text = node.textContent.trim();
                if (text.startsWith(examRoomPrefix)) {
                    return true;
                }
            }

            return false;
        };

        /**
         * Finds and returns the patient name and exam room status from a patient list item.
         * @param {HTMLElement} patientListItem - The patient list item element.
         * @returns {object|null} An object containing the normalized patient name and InExamRoom status, or null if not found.
         */
        const findPatientName = (patientListItem) => {
            const avatarDiv = patientListItem.querySelector('div[aria-label="avatarWithMessage"]');
            if (!avatarDiv) {
                logDebug("Avatar div not found for patientListItem:", patientListItem);
                return null;
            }

            const siblings = Array.from(avatarDiv.parentElement.children).filter(child => child !== avatarDiv);

            for (let sibling of siblings) {
                const normalizedName = findPatientNameInChildren(sibling);
                if (normalizedName) {
                    // Check if the patient is in an exam room
                    const inExamRoom = isPatientInExamRoom(patientListItem);

                    // Use stored name if available
                    for (let storedName in patientsData) {
                        if (storedName.includes(normalizedName) || normalizedName.includes(storedName)) {
                            // Update InExamRoom status if needed
                            patientsData[storedName].InExamRoom = inExamRoom;
                            return { name: storedName, InExamRoom: inExamRoom };
                        }
                    }

                    return { name: normalizedName, InExamRoom: inExamRoom };
                }
            }

            logDebug("No valid patient name found in this patient list item:", patientListItem);
            return null;
        };

        /**
         * Initializes patient data with time slots.
         * @param {string} patientName - The name of the patient.
         * @param {boolean} inExamRoom - Whether the patient is in an exam room.
         */
        const initializePatientData = (patientName, inExamRoom = false) => {
            const timeSlots = findTimeSlots();
            if (!timeSlots.length) {
                logDebug(`No time slots found, skipping initialization for ${patientName}.`);
                return;
            }

            logDebug(`Initializing patient data for ${patientName} with time slots:`, timeSlots);
            const initialData = {
                InExamRoom: inExamRoom,
                criticalNotes: { hasNotification: false },
                missed: { hasNotification: false },
                due: { hasNotification: false },
                timeSlots: {}
            };
            timeSlots.forEach(time => {
                initialData.timeSlots[time] = { hasNotification: false };
            });

            updatePatientData(patientName, initialData);
        };

        /**
         * Updates patient data for a specific patient.
         * @param {string} patientName - The name of the patient.
         * @param {object|string} category - The category to update or data object.
         * @param {object} [data] - The data to update.
         */
        const updatePatientData = (patientName, category, data) => {
            if (!patientsData[patientName]) {
                patientsData[patientName] = {
                    InExamRoom: false, // Default value
                    criticalNotes: { hasNotification: false },
                    missed: { hasNotification: false },
                    due: { hasNotification: false },
                    timeSlots: {}
                };
            }

            if (typeof category === 'object') {
                Object.assign(patientsData[patientName], category);
            } else if (category.startsWith('timeSlots.')) {
                const timeSlotKey = category.split('.')[1];
                patientsData[patientName].timeSlots[timeSlotKey] = data;
            } else {
                patientsData[patientName][category] = data;
            }

            logDebug(`Updated patient data for ${patientName}:`, patientsData[patientName]);
        };


		/**
         * Checks if a node indicates a notification.
         * @param {HTMLElement} node - The node to check.
         * @param {string} category - The category to determine specific checks.
         * @returns {boolean} True if a notification is present, false otherwise.
         */
        const checkForNotification = (node, category) => {
            if (!node) return false;

            switch (category) {
                case 'criticalNotes':
                    // For Critical Notes, check if its child node has a 'title' attribute
                    const criticalChild = node.querySelector('[title]');
                    if (criticalChild) {
                        //return true;
                        return false; // No sound on critical notes for now
                    }
                    break;

                case 'missed':
                case 'due':
                    // For Missed and Due, check if they have grandchildren nodes
                    for (let child of node.children) {
                        for (let grandChild of child.children) {
                            return true; // Found a grandchild node
                        }
                    }
                    break;

                default:
                    if (category.startsWith('timeSlots.')) {
                        // For Time Slots, check if they have grandchildren nodes
                        for (let child of node.children) {
                            for (let grandChild of child.children) {
                                return true; // Found a grandchild node
                            }
                        }
                    }
                    break;
            }

            return false;
        };

        /**
         * Updates notification status for a specific node.
         * @param {string} patientName - The name of the patient.
         * @param {string} category - The category to update.
         * @param {HTMLElement} node - The DOM node to process.
         */
        const updateNotificationStatusForNode = (patientName, category, node) => {
            const hasNotification = checkForNotification(node, category);

            // Retrieve current notification status
            const currentData = patientsData[patientName];
            let currentCategoryStatus;

            if (category.startsWith('timeSlots.')) {
                const timeSlotIndex = category.split('.')[1];
                const timeSlotKey = globalTimeSlots[timeSlotIndex];

                if (!timeSlotKey) {
                    logDebug(`Time slot key ${timeSlotIndex} not found in globalTimeSlots`);
                    return;
                }

                currentCategoryStatus = currentData.timeSlots[timeSlotKey]?.hasNotification || false;
            } else {
                currentCategoryStatus = currentData[category]?.hasNotification || false;
            }

            // Check if the patient is in an exam room
			const isInExamRoom = currentData.InExamRoom;

			// If a new notification is detected and the patient is in an exam room, play the sound
			if (hasNotification && !currentCategoryStatus && isInExamRoom) {
				AudioManager.playChime('examRoomNotification');
            }

            // Update patient data
            const updatedData = { hasNotification };

            if (category.startsWith('timeSlots.')) {
                currentData.timeSlots[globalTimeSlots[category.split('.')[1]]] = updatedData;
            } else {
                currentData[category] = updatedData;
            }

            logDebug(`Notification status updated for ${category}:`, updatedData);
        };



        /**
         * Handles updates to patient data for notifications.
         * @param {HTMLElement} node - The DOM node to process.
         */
        const handlePatientDataUpdate = (node) => {
            const patientInfo = findPatientName(node);
            if (!patientInfo) {
                console.error("Patient information not found.");
                return;
            }

            const { name, InExamRoom } = patientInfo;

            if (!patientsData[name]) {
                initializePatientData(name, InExamRoom);
            } else {
                // Update InExamRoom status
                patientsData[name].InExamRoom = InExamRoom;
            }

            const patientBar = node.nextElementSibling;
            if (!patientBar) {
                logDebug(`Patient bar not found for node:`, node);
                return;
            }

            // Correctly retrieve nested child nodes
            const childNodes = Array.from(patientBar.children[0].children);
            const categories = ['criticalNotes', 'missed', 'due'];

            // Iterate over the child nodes
            childNodes.forEach((childNode, index) => {
                if (index < categories.length) {
                    // Assign to main categories
                    const category = categories[index];
                    updateNotificationStatusForNode(name, category, childNode);
                } else {
                    // Assign to time slots
                    const timeSlotIndex = index - categories.length;
                    updateNotificationStatusForNode(name, `timeSlots.${timeSlotIndex}`, childNode);
                }
            });

            logDebug(`Updated patient data for ${name}`);
        };

        /**
		 * Updates patient data to match the current screen.
		 */
		const updatePatientDataToMatchScreen = () => {
			const patientList = getPatientList();
			if (!patientList) {
				logDebug("Patient list not found.");
				return;
			}

			findTimeSlots();

			const currentPatientNames = new Set();
			const patientCards = Array.from(patientList.querySelectorAll('div[aria-label="Patient List Item"]'));

			// Iterate through each patient card to collect current patient names
			patientCards.forEach(patientCard => {
				const patientInfo = findPatientName(patientCard);
				if (patientInfo) {
					const { name, InExamRoom } = patientInfo;
					currentPatientNames.add(name);

					if (patientsData[name]) {
						// Update InExamRoom status
						patientsData[name].InExamRoom = InExamRoom;
					} else {
						// Initialize patient data with InExamRoom status
						initializePatientData(name, InExamRoom);
						
						// **Conditional Chime: Play only if InExamRoom is true**
						if (InExamRoom) {
							AudioManager.playChime('patientAdded');
							logDebug(`Patient added (InExamRoom): ${name}`);
						} else {
							logDebug(`Patient added (Not in ExamRoom): ${name}`);
						}
					}
				}
			});

			// Determine removed patients by comparing previous and current patient names
			const removedPatients = new Set([...previousPatientNames].filter(x => !currentPatientNames.has(x)));

			// Handle removed patients
			removedPatients.forEach(patientName => {
				const wasInExamRoom = patientsData[patientName]?.InExamRoom; // **Capture InExamRoom before removal**
				
				removePatientData(patientName);
				
				// **Conditional Chime: Play only if wasInExamRoom was true**
				if (wasInExamRoom) {
					AudioManager.playChime('patientRemoved');
					logDebug(`Patient removed (Was in ExamRoom): ${patientName}`);
				} else {
					logDebug(`Patient removed (Was not in ExamRoom): ${patientName}`);
				}
			});

			// Handle updates for existing patients who are in exam rooms
			patientCards.forEach(patientCard => {
				const patientInfo = findPatientName(patientCard);
				if (patientInfo) {
					const { name, InExamRoom } = patientInfo;
					if (patientsData[name] && patientsData[name].InExamRoom) {
						handlePatientDataUpdate(patientCard);
					}
				}
			});

			// Update the previous patient names set for next comparison
			previousPatientNames = new Set(currentPatientNames);

			logDebug("Patient data and Time Slots updated to match the current screen.");
		};

        /**
         * Removes patient data.
         * @param {string} patientName - The name of the patient.
         */
        const removePatientData = (patientName) => {
            delete patientsData[patientName];
            logDebug(`Patient data removed for ${patientName}`);
        };

        /**
         * Clears all patient data.
         */
        const clearAllPatientData = () => {
            for (let patientName in patientsData) {
                delete patientsData[patientName];
            }
            previousPatientNames.clear();
            resetTimeSlots();
            logDebug("All patient data has been cleared.");
        };

        /**
         * Logs all patient data.
         */
        const logAllPatientData = () => {
            console.log("Current state of all patient data:", patientsData);
        };

        /**
         * Resets the time slots.
         */
        const resetTimeSlots = () => {
            globalTimeSlots = [];
        };

        /**
         * Handles changes in time slot headers.
         * @param {HTMLElement} timeSlotHeadersNode - The node containing time slot headers.
         */
        const handleTimeSlotHeadersChange = (timeSlotHeadersNode) => {
            logDebug("Time slot headers changed:", timeSlotHeadersNode);

            const newTimeSlots = Array.from(timeSlotHeadersNode.childNodes)
                .filter(node => node.nodeType === Node.ELEMENT_NODE && node.textContent.trim())
                .map(node => node.textContent.trim());

            logDebug("New time slots found:", newTimeSlots);

            const oldTimeSlots = [...globalTimeSlots];
            globalTimeSlots = newTimeSlots;

            const removedTimeSlots = oldTimeSlots.filter(slot => !newTimeSlots.includes(slot));
            const addedTimeSlots = newTimeSlots.filter(slot => !oldTimeSlots.includes(slot));

            if (removedTimeSlots.length > 0) {
                logDebug("Removed time slots:", removedTimeSlots);
                Object.keys(patientsData).forEach(patientName => {
                    removedTimeSlots.forEach(removedSlot => {
                        delete patientsData[patientName].timeSlots[removedSlot];
                    });
                });
                logDebug("Removed time slots from patient data.");
            }

            if (addedTimeSlots.length > 0) {
                logDebug("Added time slots:", addedTimeSlots);
                Object.keys(patientsData).forEach(patientName => {
                    addedTimeSlots.forEach(addedSlot => {
                        patientsData[patientName].timeSlots[addedSlot] = { hasNotification: false };
                    });
                });
                updatePatientDataToMatchScreen();
                logDebug("Added new time slots to patient data.");
            }

            logDebug("Updated global time slots:", globalTimeSlots);
        };

        // Expose public methods
        return {
            updatePatientData,
            getPatientData: (patientName) => patientsData[patientName] || null,
            getAllPatientData: () => patientsData,
            clearAllPatientData,
            logAllPatientData,
            removePatientData,
            updatePatientDataToMatchScreen,
            resetTimeSlots,
            handleTimeSlotHeadersChange,
        };
    })();

})(window);



