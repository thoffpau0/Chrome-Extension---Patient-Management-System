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

		// Private helper functions

		/**
		 * Finds and returns time slots for patients.
		 * @returns {Array} An array of time slot strings.
		 */
		const findTimeSlots = () => {
			if (globalTimeSlots.length > 0) {
				return globalTimeSlots;
			}

			const timeSlots = [];

			// Step 1: Get the node with data-testid="PatientList"
			const patientListNode = document.querySelector('div[data-testid="PatientList"]');
			if (!patientListNode) {
				if (window.debug) console.log("PatientList node not found.");
				return timeSlots;
			}

			// Get the first child of the first child
			const startingNode = patientListNode.firstElementChild?.firstElementChild;
			if (!startingNode) {
				if (window.debug) console.log("Starting node for time slots not found.");
				return timeSlots;
			}

			// Regular expression to match time slot formats (e.g., "2:00pm")
			const timeSlotRegex = /^\d{1,2}:\d{2}(am|pm)$/i;

			// Step 2 & 3: Recursive function to search through subnodes
			const searchTimeSlots = (node) => {
				if (node.nodeType === Node.ELEMENT_NODE) {
					const dataTestId = node.getAttribute('data-testid');
					const textContent = node.textContent.trim();

					if (dataTestId && timeSlotRegex.test(dataTestId)) {
						// Step 4: Collect the time slot
						timeSlots.push(dataTestId);
					}
				}

				// Recursively search child nodes
				node.childNodes.forEach(child => searchTimeSlots(child));
			};

			searchTimeSlots(startingNode);

			if (window.debug) console.log("Found time slots:", timeSlots);
			globalTimeSlots = timeSlots;
			return timeSlots;
		};

		/**
		 * Recursively searches for a patient name within child elements.
		 * @param {HTMLElement} element - The element to search within.
		 * @returns {string|null} The normalized patient name or null if not found.
		 */
		const findPatientNameInChildren = (element) => {
			if (element.textContent) {
				const patientNameMatch = element.textContent.match(
					/^"(.+)"(?: [A-Za-z'\s]+)?$/
				);
				if (patientNameMatch && patientNameMatch[1]) {
					let normalizedName = patientNameMatch[1]
						.replace(/['"]/g, '')
						.trim()
						.toLowerCase();
					return normalizedName;
				}
			}

			// Recursively check all child elements
			for (let child of element.children) {
				const result = findPatientNameInChildren(child);
				if (result) {
					return result; // Return the name if found
				}
			}

			return null; // No name found in this branch
		};

		/**
		 * Finds and returns the patient name from a patient list item.
		 * @param {HTMLElement} patientListItem - The patient list item element.
		 * @returns {string|null} The normalized patient name or null if not found.
		 */
		const findPatientName = (patientListItem) => {
			const avatarDiv = patientListItem.querySelector('div[aria-label="avatarWithMessage"]');
			if (!avatarDiv) {
				if (window.debug) console.log("Avatar div not found for patientListItem:", patientListItem);
				return null;
			}

			const siblings = Array.from(avatarDiv.parentElement.children).filter(child => child !== avatarDiv);

			for (let sibling of siblings) {
				// Recursively search through each sibling's children
				let normalizedName = findPatientNameInChildren(sibling);

				if (normalizedName) {
					// Check for matching patient name in PatientManager and normalize it
					for (let storedName in patientsData) {
						if (storedName.includes(normalizedName) || normalizedName.includes(storedName)) {
							normalizedName = storedName;  // Use the more complete name
							break;
						}
					}
					return normalizedName;
				}
			}

			if (window.debug) console.log("No valid patient name found in this patient list item:", patientListItem);
			return null;
		};

		/**
		 * Initializes patient data with time slots.
		 * @param {string} patientName - The name of the patient.
		 */
		const initializePatientData = (patientName) => {
			const timeSlots = findTimeSlots();
			if (!timeSlots.length) {
				if (window.debug) console.log(`No time slots found, skipping initialization for ${patientName}.`);
				return;
			}
			if (window.debug) console.log(`Initializing patient data for ${patientName} with time slots:`, timeSlots);
			const initialData = { criticalNotes: null, missed: null, due: null, timeSlots: {} };
			timeSlots.forEach(time => {
				if (!initialData.timeSlots[time]) {
					initialData.timeSlots[time] = { diagnostics: 0 };
				}
			});
			updatePatientData(patientName, initialData);
		};

		/**
		 * Handles updates to patient data for Diagnostics, Medication, and Nursing Care.
		 * @param {HTMLElement} node - The DOM node to process.
		 */
		const handlePatientDataUpdate = (node) => {
			// Find patient name
			const patientName = findPatientName(node);
			if (!patientName) {
				console.error("Patient name not found.");
				return;
			}

			// Initialize the patient if not present in the data
			if (!patientsData[patientName]) {
				initializePatientData(patientName); // Initialize with time slots
			}

			// Function to recursively search for a node with aria-label="Patient List Item"
			const findPatientListItemNode = (parentNode) => {
				const searchNodes = (node) => {
					// Check if the current node has the desired aria-label attribute
					if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('aria-label') === 'Patient List Item') {
						return node; // Return the node if found
					}

					// Recursively search through all child nodes
					for (let child of node.children) {
						const result = searchNodes(child);
						if (result) return result; // Return the result if found in any child node
					}

					return null; // Return null if the node is not found
				};

				// Start searching from the given parent node
				return searchNodes(parentNode);
			};

			// Find the Patient List Item node by recursively searching the sibling's children
			const patientListItemNode = findPatientListItemNode(node);
			if (!patientListItemNode) {
				if (window.debug) console.log("Patient List Item node not found.");
				return;
			}

			// The patient bar is the next sibling of the Patient List Item node
			const patientBar = patientListItemNode.nextElementSibling;
			if (!patientBar) {
				if (window.debug) console.log(`Patient bar not found for node:`, node);
				return;
			}

			const findCriticalNotesNode = (patientBar) => {
				const searchNodes = (node) => {
					// Check if the current node has the desired aria-label attribute
					if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('aria-label') === 'Critical Notes') {
						return node; // Return the node if found
					}

					// Recursively search through all child nodes
					for (let child of node.children) {
						const result = searchNodes(child);
						if (result) return result; // Return the result if found in any child node
					}

					return null; // Return null if the node is not found
				};

				// Start searching from the given parent node
				return searchNodes(patientBar);
			};

			// Find the Critical Notes node
			const criticalNotesNode = findCriticalNotesNode(patientBar);
			if (!criticalNotesNode) {
				if (window.debug) console.log("Critical notes node not found.");
				return;
			}

			// Find the siblings: missed, due, and time slots
			const missedNode = criticalNotesNode.nextElementSibling;
			const dueNode = missedNode?.nextElementSibling;

			if (!missedNode || !dueNode) {
				if (window.debug) console.log("Missed or Due nodes not found.");
				return;
			}

			// Helper function to update all task counts (Diagnostics, Medication, Nursing Care) for a node
			const updateAllTaskCounts = (category, taskNode) => {
				updateTaskCountsForNode(patientName, category, taskNode); // Update for Diagnostics, Medication, and Nursing Care
			};

			// Process tasks for criticalNotes, missed, due fields
			updateAllTaskCounts('criticalNotes', criticalNotesNode);
			updateAllTaskCounts('missed', missedNode);
			updateAllTaskCounts('due', dueNode);

			// Process time slots starting from the third sibling of criticalNotesNode onward
			let timeSlotNode = dueNode.nextElementSibling; // First time slot is the sibling of dueNode
			let timeSlotIndex = 0; // Index in the timeSlots array

			while (timeSlotNode) {
				// Update all task counts for the current time slot using the index
				updateAllTaskCounts(`timeSlots.${timeSlotIndex}`, timeSlotNode);

				timeSlotNode = timeSlotNode.nextElementSibling; // Move to the next sibling
				timeSlotIndex++; // Increment the index for the next time slot
			}

			if (window.debug) console.log(`Updated patient data for ${patientName}`);
		};

		/**
		 * Generic function to search for a specific task type in the node.
		 * @param {HTMLElement} node - The node to search within.
		 * @param {string} taskType - The task type to search for.
		 * @returns {number|boolean} The task number if found, true if found without a number, or false if not found.
		 */
		const searchForTaskType = (node, taskType) => {
			// Helper function to search recursively for the task type in child nodes
			const searchChildrenForTask = (parentNode) => {
				for (let child of parentNode.children) {
					const result = searchForTaskType(child, taskType); // Recursively search children
					if (result) return result; // Return if task node is found
				}
				return false; // No task node found in children
			};

			// Helper function to find the task number in the previous sibling
			const findTaskNumber = (sibling) => {
				if (!sibling) return null; // No sibling, return null

				// Check if sibling's textContent is numeric
				const numericContent = sibling.textContent.trim();
				if (/^\d+$/.test(numericContent)) {
					return parseInt(numericContent, 10); // Return the number as an integer
				}

				// Recursively search the children of the previous sibling
				for (let child of sibling.children) {
					const result = findTaskNumber(child);
					if (result !== null) return result; // If found, return the number
				}

				// Continue searching the previous sibling if number not found in children
				return findTaskNumber(sibling.previousElementSibling);
			};

			// Check if the current node itself has the specified task type
			if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('data-testId') === taskType) {
				// Look for the task number in the previous sibling
				const taskNumber = findTaskNumber(node.previousElementSibling);

				if (taskNumber !== null) {
					return taskNumber; // Return found task number
				}

				return true; // Task type found, but no numeric sibling
			}

			// If the current node has children, search the children recursively
			if (node.children && node.children.length > 0) {
				return searchChildrenForTask(node); // Recursively search children
			}

			// If the node has no children, check the node itself for the specified task type
			let sibling = node;
			while (sibling) {
				if (sibling.nodeType === Node.ELEMENT_NODE && sibling.getAttribute('data-testId') === taskType) {
					// Found task type, now look for the number in the previous sibling
					const taskNumber = findTaskNumber(sibling.previousElementSibling);

					if (taskNumber !== null) {
						return taskNumber; // Return found task number
					}

					return true; // Task type node found, no number available
				}

				// If the sibling has children, search within its children
				if (sibling.children && sibling.children.length > 0) {
					const result = searchChildrenForTask(sibling);
					if (result) return result; // Return result if task node is found
				}

				// Move to the next sibling and repeat the process
				sibling = sibling.nextElementSibling;
			}

			return false; // Return false if no task node found
		};

		// Wrapper functions for each specific task type
		const searchForDiagnostics = (node) => searchForTaskType(node, 'Diagnostics');
		const searchForMedication = (node) => searchForTaskType(node, 'Medication');
		const searchForNursingCare = (node) => searchForTaskType(node, 'Nursing Care');

		/**
		 * Updates task counts for diagnostics, medication, and nursing care for a specific node.
		 * @param {string} patientName - The name of the patient.
		 * @param {string} category - The category to update.
		 * @param {HTMLElement} node - The DOM node to process.
		 */
		const updateTaskCountsForNode = (patientName, category, node) => {
			// Search the node for diagnostics, medication, and nursing care tasks
			const foundDiagnostics = searchForDiagnostics(node);
			const foundMedication = searchForMedication(node);
			const foundNursingCare = searchForNursingCare(node);

			// Retrieve current patient data
			const currentData = patientsData[patientName];

			// Variables to hold the current counts
			let currentDiagnosticsCount = 0;
			let currentMedicationCount = 0;
			let currentNursingCareCount = 0;

			if (category.startsWith('timeSlots.')) {
				const timeSlotIndex = category.split('.')[1];
				const timeSlotKey = globalTimeSlots[timeSlotIndex];

				if (!timeSlotKey) {
					if (window.debug) console.log(`Time slot key ${timeSlotIndex} not found in globalTimeSlots`);
					return;
				}

				// Retrieve current counts for each task type
				currentDiagnosticsCount = currentData.timeSlots[timeSlotKey]?.diagnostics || 0;
				currentMedicationCount = currentData.timeSlots[timeSlotKey]?.medication || 0;
				currentNursingCareCount = currentData.timeSlots[timeSlotKey]?.nursingCare || 0;

				// Define new counts based on found values
				const diagnosticsCount = typeof foundDiagnostics === 'number' ? foundDiagnostics : 0;
				const medicationCount = typeof foundMedication === 'number' ? foundMedication : 0;
				const nursingCareCount = typeof foundNursingCare === 'number' ? foundNursingCare : 0;

				// Play chime if any new count exceeds the current count
				if (diagnosticsCount > currentDiagnosticsCount) {
					AudioManager.playChime('diagnostics');
				}
				if (medicationCount > currentMedicationCount) {
					AudioManager.playChime('medication');
				}
				if (nursingCareCount > currentNursingCareCount) {
					AudioManager.playChime('nursingCare');
				}

				// Update patient data for the specific time slot
				updatePatientData(patientName, `timeSlots.${timeSlotKey}`, {
					diagnostics: diagnosticsCount,
					medication: medicationCount,
					nursingCare: nursingCareCount
				});

			} else {
				// Retrieve current counts for each task type in non-timeSlot fields
				currentDiagnosticsCount = currentData[category]?.diagnostics || 0;
				currentMedicationCount = currentData[category]?.medication || 0;
				currentNursingCareCount = currentData[category]?.nursingCare || 0;

				// Define new counts based on found values
				const diagnosticsCount = typeof foundDiagnostics === 'number' ? foundDiagnostics : 0;
				const medicationCount = typeof foundMedication === 'number' ? foundMedication : 0;
				const nursingCareCount = typeof foundNursingCare === 'number' ? foundNursingCare : 0;

				// Play chime if any new count exceeds the current count
				if (diagnosticsCount > currentDiagnosticsCount) {
					AudioManager.playChime('diagnostics');
				}
				if (medicationCount > currentMedicationCount) {
					AudioManager.playChime('medication');
				}
				if (nursingCareCount > currentNursingCareCount) {
					AudioManager.playChime('nursingCare');
				}

				// Update patient data for criticalNotes, missed, or due
				updatePatientData(patientName, category, {
					diagnostics: diagnosticsCount,
					medication: medicationCount,
					nursingCare: nursingCareCount
				});
			}

			if (window.debug) console.log(`Counts updated for ${category}: Diagnostics=${currentDiagnosticsCount}, Medication=${currentMedicationCount}, Nursing Care=${currentNursingCareCount}`);
		};

		/**
		 * Handles changes in time slot headers.
		 * @param {HTMLElement} timeSlotHeadersNode - The node containing time slot headers.
		 */
		const handleTimeSlotHeadersChange = (timeSlotHeadersNode) => {
			if (window.debug) console.log("Time slot headers changed:", timeSlotHeadersNode);

			// Collect the new time slots from the headers
			const newTimeSlots = [];

			// Assume the time slot headers are stored as children of timeSlotHeadersNode
			timeSlotHeadersNode.childNodes.forEach(node => {
				if (node.nodeType === Node.ELEMENT_NODE && node.textContent.trim()) {
					newTimeSlots.push(node.textContent.trim()); // Push the time slot text to the array
				}
			});

			if (window.debug) console.log("New time slots found:", newTimeSlots);

			// Get the old time slots
			const oldTimeSlots = [...globalTimeSlots];

			// Update the global time slots array
			globalTimeSlots = newTimeSlots;

			// Find the time slots that were removed
			const removedTimeSlots = oldTimeSlots.filter(slot => !newTimeSlots.includes(slot));

			// Find the time slots that were added
			const addedTimeSlots = newTimeSlots.filter(slot => !oldTimeSlots.includes(slot));

			// Handle removed time slots
			if (removedTimeSlots.length > 0) {
				if (window.debug) console.log("Removed time slots:", removedTimeSlots);

				// For each patient, remove the diagnostics for the missing time slots
				Object.keys(patientsData).forEach(patientName => {
					removedTimeSlots.forEach(removedSlot => {
						delete patientsData[patientName].timeSlots[removedSlot]; // Remove the time slot from the patient's data
					});
				});

				if (window.debug) console.log("Removed time slots from patient data.");
			}

			// Handle added time slots
			if (addedTimeSlots.length > 0) {
				if (window.debug) console.log("Added time slots:", addedTimeSlots);

				// For each patient, initialize the new time slots with diagnostics count set to 0
				Object.keys(patientsData).forEach(patientName => {
					addedTimeSlots.forEach(addedSlot => {
						patientsData[patientName].timeSlots[addedSlot] = { diagnostics: 0 }; // Add the new time slot with default diagnostics
					});
				});
				// Trigger an update to refresh the patient data with the new time slots
				updatePatientDataToMatchScreen();

				if (window.debug) console.log("Added new time slots to patient data.");
			}

			// Log the updated global time slots
			if (window.debug) console.log("Updated global time slots:", globalTimeSlots);
		};

		/**
		 * Gets the patient list element.
		 * @returns {HTMLElement|null} The patient list element or null if not found.
		 */
		const getPatientList = () => {
			const cachedPatientList = document.querySelector('div[data-testid="PatientList"]');
			if (window.debug) console.log("Cached patient list:", cachedPatientList);
			return cachedPatientList; // Only re-fetch if cache is null
		};

		/**
		 * Updates patient data to match the current screen.
		 */
		const updatePatientDataToMatchScreen = () => {
			const patientList = getPatientList();
			if (!patientList) {
				if (window.debug) console.log("Patient list not found.");
				return;
			}

			findTimeSlots(); // Keep your existing call to findTimeSlots()

			// Get the current list of patient names
			const currentPatientNames = new Set();
			const patientCards = Array.from(patientList.querySelectorAll('div[aria-label="Patient List Item"]'));
			patientCards.forEach(patientCard => {
				const patientName = findPatientName(patientCard);
				if (patientName) {
					currentPatientNames.add(patientName);
					handlePatientDataUpdate(patientCard);
				}
			});

			// Compare with previous patient names to detect additions and removals
			const addedPatients = new Set([...currentPatientNames].filter(x => !previousPatientNames.has(x)));
			const removedPatients = new Set([...previousPatientNames].filter(x => !currentPatientNames.has(x)));

			// Handle added patients
			addedPatients.forEach(patientName => {
				initializePatientData(patientName); // Initialize patient data
				AudioManager.playChime('patientAdded'); // Play 'BuddyIn.mp3'
				if (window.debug) console.log(`Patient added: ${patientName}`);
			});

			// Handle removed patients
			removedPatients.forEach(patientName => {
				removePatientData(patientName); // Remove patient data
				AudioManager.playChime('patientRemoved'); // Play 'Goodbye.mp3'
				if (window.debug) console.log(`Patient removed: ${patientName}`);
			});

			// Update the previous patient names set
			previousPatientNames = currentPatientNames;

			if (window.debug) console.log("Patient data and Time Slots updated to match the current screen.");
		};

		/**
		 * Resets the time slots.
		 */
		const resetTimeSlots = () => {
			globalTimeSlots = [];
		};

		// Public methods
		const updatePatientData = (patientName, category, data) => {
			if (!patientsData[patientName]) {
				patientsData[patientName] = { criticalNotes: null, missed: null, due: null, timeSlots: {} };
			}

			if (typeof category === 'object' && category.timeSlots) {
				Object.assign(patientsData[patientName].timeSlots, category.timeSlots);
			} else if (category.startsWith('timeSlots.')) {
				const timeSlot = category.split('.')[1];
				patientsData[patientName].timeSlots[timeSlot] = data;
			} else {
				patientsData[patientName][category] = data;
			}

			if (window.debug) console.log(`Updated patient data for ${patientName}:`, patientsData[patientName]);
		};

		const getPatientData = (patientName) => patientsData[patientName] || null;
		const getAllPatientData = () => patientsData;
		const clearAllPatientData = () => {
			for (let patientName in patientsData) {
				delete patientsData[patientName];
			}
			previousPatientNames.clear();
			resetTimeSlots();
		};
		const logAllPatientData = () => {
			console.log("Current state of all patient data:", patientsData);
		};
		const removePatientData = (patientName) => {
			delete patientsData[patientName];
			if (window.debug) console.log(`Patient data removed for ${patientName}`);
		};

		// Expose public methods
		return {
			updatePatientData,
			getPatientData,
			getAllPatientData,
			clearAllPatientData,
			logAllPatientData,
			removePatientData,
			updatePatientDataToMatchScreen,
			resetTimeSlots,
			handleTimeSlotHeadersChange,
		};
	})();
	
})(window);