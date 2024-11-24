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
                case 'diagnostics':
                    return chrome.runtime.getURL("diagnostics_doorbell.mp3"); // Replace with your actual file
                case 'patientAdded':
                    return chrome.runtime.getURL("BuddyIn.mp3"); // Replace with your actual file
                case 'patientRemoved':
                    return chrome.runtime.getURL("Goodbye.mp3"); // Replace with your actual file
                default:
                    return chrome.runtime.getURL("diagnostics_doorbell.mp3"); // Default sound
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
         * Finds and returns the patient name from a patient list item.
         * @param {HTMLElement} patientListItem - The patient list item element.
         * @returns {string|null} The normalized patient name or null if not found.
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
                    // Use stored name if available
                    for (let storedName in patientsData) {
                        if (storedName.includes(normalizedName) || normalizedName.includes(storedName)) {
                            return storedName;
                        }
                    }
                    return normalizedName;
                }
            }

            logDebug("No valid patient name found in this patient list item:", patientListItem);
            return null;
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

            // If a new notification is detected, play the sound
            if (hasNotification && !currentCategoryStatus) {
                AudioManager.playChime('diagnostics');
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
         * Initializes patient data with time slots.
         * @param {string} patientName - The name of the patient.
         */
        const initializePatientData = (patientName) => {
            const timeSlots = findTimeSlots();
            if (!timeSlots.length) {
                logDebug(`No time slots found, skipping initialization for ${patientName}.`);
                return;
            }

            logDebug(`Initializing patient data for ${patientName} with time slots:`, timeSlots);
            const initialData = {
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
         * Handles updates to patient data for notifications.
         * @param {HTMLElement} node - The DOM node to process.
         */
        const handlePatientDataUpdate = (node) => {
            const patientName = findPatientName(node);
            if (!patientName) {
                console.error("Patient name not found.");
                return;
            }

            if (!patientsData[patientName]) {
                initializePatientData(patientName);
            }

            const patientBar = node.nextElementSibling;
            if (!patientBar) {
                logDebug(`Patient bar not found for node:`, node);
                return;
            }

            // Access the nested children within the first child of patientBar to correctly map categories and time slots
			const getNestedChildren = (parent, level = 1) => {
				let children = Array.from(parent.children);
				for (let i = 0; i < level; i++) {
					if (children.length > 0) {
						children = Array.from(children[0].children);
					} else {
						return [];
					}
				}
				return children;
			};

			// Usage:
			const childNodes = getNestedChildren(patientBar, 1); // Adjust level as needed

            // Define the main categories
            const categories = ['criticalNotes', 'missed', 'due'];

            // Iterate over the child nodes
            childNodes.forEach((childNode, index) => {
                if (index < categories.length) {
                    // Assign to main categories
                    const category = categories[index];
                    updateNotificationStatusForNode(patientName, category, childNode);
                } else {
                    // Assign to time slots
                    const timeSlotIndex = index - categories.length;
                    updateNotificationStatusForNode(patientName, `timeSlots.${timeSlotIndex}`, childNode);
                }
            });

            logDebug(`Updated patient data for ${patientName}`);
        };

        /**
         * Initializes existing patients without triggering chimes.
         * Call this function during extension startup or installation.
         */
        const initializeExistingPatients = () => {
            const patientList = getPatientList();
            if (!patientList) {
                logDebug("Patient list not found during initialization.");
                return;
            }

            const patientCards = Array.from(patientList.querySelectorAll('div[aria-label="Patient List Item"]'));
            patientCards.forEach(patientCard => {
                const patientName = findPatientName(patientCard);
                if (patientName) {
                    previousPatientNames.add(patientName);
                    initializePatientData(patientName);
                }
            });

            logDebug("Initialized existing patients without triggering chimes.");
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
                const patientName = findPatientName(patientCard);
                if (patientName) {
                    currentPatientNames.add(patientName);
                }
            });

            // Determine added and removed patients
            const addedPatients = new Set([...currentPatientNames].filter(x => !previousPatientNames.has(x)));
            const removedPatients = new Set([...previousPatientNames].filter(x => !currentPatientNames.has(x)));

            // Handle added patients
            addedPatients.forEach(patientName => {
                initializePatientData(patientName);
                AudioManager.playChime('patientAdded');
                logDebug(`Patient added: ${patientName}`);
            });

            // Handle removed patients
            removedPatients.forEach(patientName => {
                removePatientData(patientName);
                AudioManager.playChime('patientRemoved');
                logDebug(`Patient removed: ${patientName}`);
            });

            // Handle updates for existing patients
            patientCards.forEach(patientCard => {
                const patientName = findPatientName(patientCard);
                if (patientName && !addedPatients.has(patientName)) {
                    handlePatientDataUpdate(patientCard);
                }
            });

            // Update the previous patient names set for next comparison
            previousPatientNames = new Set(currentPatientNames);

            logDebug("Patient data and Time Slots updated to match the current screen.");
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
            initializeExistingPatients, // Expose the initialization method
        };
    })();

})(window);