// patientManager.js

(function (global) {
    'use strict';

    // Ensure your namespace exists
    global.VR_Mon_App = global.VR_Mon_App || {};

    // Define the PatientManager module and assign it to your namespace
    global.VR_Mon_App.PatientManager = (() => {
        // Private variables
        const patientsData = {};
        let globalTimeSlots = [];
        let previousPatientNames = new Set();

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
            const initialData = { criticalNotes: null, missed: null, due: null, timeSlots: {} };
            timeSlots.forEach(time => {
                initialData.timeSlots[time] = { diagnostics: 0, medication: 0, nursingCare: 0 };
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
                patientsData[patientName] = { criticalNotes: null, missed: null, due: null, timeSlots: {} };
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
         * Searches for a specific task type in the node.
         * @param {HTMLElement} node - The node to search within.
         * @param {string} taskType - The task type to search for.
         * @returns {number} The task count or 0 if not found.
         */
        const searchForTaskType = (node, taskType) => {
            if (!node) return 0;

            const stack = [node];

            while (stack.length > 0) {
                const currentNode = stack.pop();

                if (currentNode.nodeType === Node.ELEMENT_NODE) {
                    const dataTestId = currentNode.getAttribute('data-testId');
                    if (dataTestId === taskType) {
                        const taskNumber = parseInt(currentNode.previousElementSibling?.textContent.trim(), 10);
                        return !isNaN(taskNumber) ? taskNumber : 1;
                    }

                    for (let child of currentNode.children) {
                        stack.push(child);
                    }
                }
            }

            return 0;
        };

        /**
         * Updates task counts for diagnostics, medication, and nursing care for a specific node.
         * @param {string} patientName - The name of the patient.
         * @param {string} category - The category to update.
         * @param {HTMLElement} node - The DOM node to process.
         */
        const updateTaskCountsForNode = (patientName, category, node) => {
            const diagnosticsCount = searchForTaskType(node, 'Diagnostics');
            const medicationCount = searchForTaskType(node, 'Medication');
            const nursingCareCount = searchForTaskType(node, 'Nursing Care');

            const currentData = patientsData[patientName];
            let currentCategoryData;

            if (category.startsWith('timeSlots.')) {
                const timeSlotIndex = category.split('.')[1];
                const timeSlotKey = globalTimeSlots[timeSlotIndex];

                if (!timeSlotKey) {
                    logDebug(`Time slot key ${timeSlotIndex} not found in globalTimeSlots`);
                    return;
                }

                currentCategoryData = currentData.timeSlots[timeSlotKey] || {};
            } else {
                currentCategoryData = currentData[category] || {};
            }

            const playChimeIfIncreased = (taskName, newCount, currentCount) => {
                if (newCount > currentCount) {
                    AudioManager.playChime(taskName);
                }
            };

            playChimeIfIncreased('diagnostics', diagnosticsCount, currentCategoryData.diagnostics || 0);
            playChimeIfIncreased('medication', medicationCount, currentCategoryData.medication || 0);
            playChimeIfIncreased('nursingCare', nursingCareCount, currentCategoryData.nursingCare || 0);

            const updatedData = {
                diagnostics: diagnosticsCount,
                medication: medicationCount,
                nursingCare: nursingCareCount,
            };

            if (category.startsWith('timeSlots.')) {
                currentData.timeSlots[globalTimeSlots[category.split('.')[1]]] = updatedData;
            } else {
                currentData[category] = updatedData;
            }

            logDebug(`Counts updated for ${category}:`, updatedData);
        };

        /**
         * Handles updates to patient data for Diagnostics, Medication, and Nursing Care.
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

            const categories = ['criticalNotes', 'missed', 'due'];
            let currentNode = patientBar.firstElementChild;

            categories.forEach(category => {
                if (currentNode) {
                    updateTaskCountsForNode(patientName, category, currentNode);
                    currentNode = currentNode.nextElementSibling;
                }
            });

            let timeSlotIndex = 0;
            while (currentNode) {
                updateTaskCountsForNode(patientName, `timeSlots.${timeSlotIndex}`, currentNode);
                currentNode = currentNode.nextElementSibling;
                timeSlotIndex++;
            }

            logDebug(`Updated patient data for ${patientName}`);
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
            patientCards.forEach(patientCard => {
                const patientName = findPatientName(patientCard);
                if (patientName) {
                    currentPatientNames.add(patientName);
                    handlePatientDataUpdate(patientCard);
                }
            });

            const addedPatients = new Set([...currentPatientNames].filter(x => !previousPatientNames.has(x)));
            const removedPatients = new Set([...previousPatientNames].filter(x => !currentPatientNames.has(x)));

            addedPatients.forEach(patientName => {
                initializePatientData(patientName);
                AudioManager.playChime('patientAdded');
                logDebug(`Patient added: ${patientName}`);
            });

            removedPatients.forEach(patientName => {
                removePatientData(patientName);
                AudioManager.playChime('patientRemoved');
                logDebug(`Patient removed: ${patientName}`);
            });

            previousPatientNames = currentPatientNames;

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
                        patientsData[patientName].timeSlots[addedSlot] = { diagnostics: 0, medication: 0, nursingCare: 0 };
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
        };
    })();

})(window);