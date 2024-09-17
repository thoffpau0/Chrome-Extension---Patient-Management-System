let debug = false; // Initial debug state
let cachedPatientList = null; // Cache patient list element
let globalTimeSlots = [];

// AudioManager with additional error logging
const AudioManager = (() => {
    let audio = null;
    let isPlaying = false;
    let chimeQueue = []; // Queue to store chime requests

    const playChime = () => {
        if (debug) console.log("playChime() called. isPlaying:", isPlaying);

        // Add the chime to the queue
        chimeQueue.push(() => {
            return new Promise((resolve, reject) => {
                chrome.storage.local.get(['selectedSound'], (result) => {
                    const soundFileURL = result.selectedSound || chrome.runtime.getURL("3_tone_chime-99718.mp3");
                    try {
                        audio = new Audio(soundFileURL);

                        // Play the audio
                        audio.play().then(() => {
                            if (debug) console.log("Chime sound started playing.");
                        }).catch(error => {
                            console.error("Error playing chime sound:", error);
                            reject(); // In case of error, we reject the promise
                        });

                        // When the sound ends, resolve the promise
                        audio.onended = () => {
                            if (debug) console.log("Chime sound finished playing.");
                            resolve(); // Resolve when chime is finished
                        };
                    } catch (error) {
                        console.error("Error initializing audio:", error);
                        reject(); // Handle error
                    }
                });
            });
        });

        // Only start playing the queue if it's not already playing
        if (!isPlaying) {
            processQueue(); // Start processing the queue
        }
    };

    const processQueue = async () => {
        if (chimeQueue.length === 0) {
            isPlaying = false;
            return; // No more chimes in the queue
        }

        isPlaying = true;
        const nextChime = chimeQueue.shift(); // Get the next chime from the queue

        try {
            await nextChime(); // Wait for the chime to finish playing
        } catch (error) {
            console.error("Error processing chime:", error);
        }

        // Continue with the next chime in the queue
        processQueue();
    };

    return { playChime };
})();

// Patient data management module
const PatientManager = (() => {
    const patientsData = {};

    const updatePatientData = (patientName, category, data) => {
		// Functionality to initialize patient data, commented out for now
		
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

		if (debug) console.log(`Updated patient data for ${patientName}:`, patientsData[patientName]);
		// Logging the current state of patient data
		//if (debug) console.log("Current state of all patient data:", patientsData);
};


    const getPatientData = (patientName) => patientsData[patientName] || null;
    const getAllPatientData = () => patientsData;
    const clearAllPatientData = () => Object.keys(patientsData).forEach(patient => delete patientsData[patient]);
    const logAllPatientData = () => {
        console.log("Current state of all patient data:", patientsData);
    };

    return {
        updatePatientData,
        getPatientData,
        getAllPatientData,
        clearAllPatientData,
        logAllPatientData // Expose the new method
    };
})();

// Function to find time slots for a patient
const findTimeSlots = () => {
    if (globalTimeSlots.length > 0) {
        return globalTimeSlots;
    }
	
	const timeSlots = [];

	
    // Step 1: Get the node with data-testid="PatientList"
    const patientListNode = document.querySelector('div[data-testid="PatientList"]');
    if (!patientListNode) {
        if (debug) console.log("PatientList node not found.");
        return timeSlots;
    }

    // Get the first child of the first child
    const startingNode = patientListNode.firstElementChild?.firstElementChild;
    if (!startingNode) {
        if (debug) console.log("Starting node for time slots not found.");
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

    if (debug) console.log("Found time slots:", timeSlots);
    globalTimeSlots = timeSlots;
    return timeSlots;
};

// Decode HTML entities
const decodeHtmlEntities = (str) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
};

// Helper function to recursively check all children of an element
const findPatientNameInChildren = (element) => {
    // If the current element has textContent and a title that matches the criteria
    if (element.textContent && element.title.match(/^".+" [A-Za-z]+$|".+"$/)) {
        const patientName = element.title.match(/^".+" [A-Za-z]+$|".+"$/);
        if (patientName && patientName[0]) {
            let normalizedName = patientName[0].replace(/['"]/g, '').trim().toLowerCase();
            return normalizedName;
        }
    }

    // Recursively check all child elements
    for (let child of element.children) {
        const result = findPatientNameInChildren(child);
        if (result) {
            return result;  // Return the name if found
        }
    }
    
    return null;  // No name found in this branch
};

// Main function to find patient name
const findPatientName = (patientListItem) => {
    const avatarDiv = patientListItem.querySelector('div[aria-label="avatarWithMessage"]');
    if (!avatarDiv) {
        if (debug) console.log("Avatar div not found for patientListItem:", patientListItem);
        return null;
    }

    const siblings = Array.from(avatarDiv.parentElement.children).filter(child => child !== avatarDiv);
    
    for (let sibling of siblings) {
        // Recursively search through each sibling's children
        let normalizedName = findPatientNameInChildren(sibling);
        
        if (normalizedName) {
            // Check for matching patient name in PatientManager and normalize it
            for (let storedName in PatientManager.getAllPatientData()) {
                if (storedName.includes(normalizedName) || normalizedName.includes(storedName)) {
                    normalizedName = storedName;  // Use the more complete name
                    break;
                }
            }
            return normalizedName;
        }
    }

    if (debug) console.log("No valid patient name found in this patient list item:", patientListItem);
    return null;
};

// Initialize patient data with time slots
const initializePatientData = (patientName) => {
    const timeSlots = findTimeSlots();
    if (!timeSlots.length) {
        if (debug) console.log(`No time slots found, skipping initialization for ${patientName}.`);
        return;
    }
    if (debug) console.log(`Initializing patient data for ${patientName} with time slots:`, timeSlots);
    const initialData = { criticalNotes: null, missed: null, due: null, timeSlots: {} };
    timeSlots.forEach(time => {
        if (!initialData.timeSlots[time]) {
            initialData.timeSlots[time] = { diagnostics: 0 };
        }
    });
    PatientManager.updatePatientData(patientName, initialData);
};

// Handle updates to patient data
const handlePatientDataUpdate = (node) => {
    // Find patient name
    const patientName = findPatientName(node);
    if (!patientName) return;

    // Initialize the patient if not present in the data
    if (!PatientManager.getPatientData(patientName)) {
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
        if (debug) console.log("Patient List Item node not found.");
        return;
    }

    // The patient bar is the next sibling of the Patient List Item node
    const patientBar = patientListItemNode.nextElementSibling;
	if (!patientBar) {
			if (debug) console.log(`Patient bar not found for node:`, node);
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
        if (debug) console.log("Critical notes node not found.");
        return;
    }

    // Find the siblings: missed, due, and time slots
    const missedNode = criticalNotesNode.nextElementSibling;
    const dueNode = missedNode?.nextElementSibling;

    if (!missedNode || !dueNode) {
        if (debug) console.log("Missed or Due nodes not found.");
        return;
    }

    // Process diagnostics for criticalNotes, missed, due fields
    updateDiagnosticsCountForNode(patientName, 'criticalNotes', criticalNotesNode);
    updateDiagnosticsCountForNode(patientName, 'missed', missedNode);
    updateDiagnosticsCountForNode(patientName, 'due', dueNode);

    // Process time slots starting from the third sibling of criticalNotesNode onward
	let timeSlotNode = dueNode.nextElementSibling; // First time slot is the sibling of dueNode

	let timeSlotIndex = 0; // Index in the timeSlots array

	while (timeSlotNode) {
		// Update the diagnostics count for the current time slot using the index
		updateDiagnosticsCountForNode(patientName, `timeSlots.${timeSlotIndex}`, timeSlotNode);

		timeSlotNode = timeSlotNode.nextElementSibling; // Move to the next sibling
		timeSlotIndex++; // Increment the index for the next time slot
	}

    if (debug) console.log(`Updated patient data for ${patientName}`);
};

const searchForDiagnostics = (node) => {
    // Helper function to search recursively for diagnostics in child nodes
    const searchChildrenForDiagnostics = (parentNode) => {
        for (let child of parentNode.children) {
            const result = searchForDiagnostics(child); // Recursively search children
            if (result) return result; // Return if diagnostics node is found
        }
        return false; // No diagnostics node found in children
    };

    // Helper function to find diagnostics number in previous sibling
    const findDiagnosticsNumber = (sibling) => {
        if (!sibling) return null; // No sibling, return null

        // Check if sibling's textContent is numeric
        const numericContent = sibling.textContent.trim();
        if (/^\d+$/.test(numericContent)) {
            return parseInt(numericContent, 10); // Return the number as an integer
        }

        // Recursively search the children of the previous sibling
        for (let child of sibling.children) {
            const result = findDiagnosticsNumber(child);
            if (result !== null) return result; // If found, return the number
        }

        // Continue searching the previous sibling if number not found in children
        return findDiagnosticsNumber(sibling.previousElementSibling);
    };

    // Check if the current node itself has 'data-testId="Diagnostics"'
    if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('data-testId') === 'Diagnostics') {
        // Look for the diagnostic number in the previous sibling
        const diagnosticsNumber = findDiagnosticsNumber(node.previousElementSibling);

        if (diagnosticsNumber !== null) {
            return diagnosticsNumber; // Return found diagnostics number
        }

        return true; // Diagnostics found but no numeric sibling
    }

    // If the current node has children, search the children recursively
    if (node.children && node.children.length > 0) {
        return searchChildrenForDiagnostics(node); // Recursively search children
    }

    // If the node has no children, check the node itself for 'data-testId="Diagnostics"'
    let sibling = node;
    while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.getAttribute('data-testId') === 'Diagnostics') {
            // Found diagnostics, now look for the number in the previous sibling
            const diagnosticsNumber = findDiagnosticsNumber(sibling.previousElementSibling);

            if (diagnosticsNumber !== null) {
                return diagnosticsNumber; // Return found diagnostics number
            }

            return true; // Diagnostics node found, no number available
        }

        // If the sibling has children, search within its children
        if (sibling.children && sibling.children.length > 0) {
            const result = searchChildrenForDiagnostics(sibling);
            if (result) return result; // Return result if diagnostics node is found
        }

        // Move to the next sibling and repeat the process
        sibling = sibling.nextElementSibling;
    }

    return false; // Return false if no diagnostics node found
};

// Function to update diagnostics count for a specific node
const updateDiagnosticsCountForNode = (patientName, category, node) => {
    // Search the node for any diagnostics tasks
    const foundDiagnostics = searchForDiagnostics(node);
    
    // Retrieve current patient data
    const currentData = PatientManager.getPatientData(patientName);
    
    // Variable to hold the current diagnostics count
    let currentDiagnosticsCount = 0;
    
    // Check if this is a time slot or a field (criticalNotes, missed, due)
    if (category.startsWith('timeSlots.')) {
        let diagnosticsCount;
        const timeSlotIndex = category.split('.')[1];

        // Use the index to access the correct time slot in the timeSlots array
        const timeSlotKey = globalTimeSlots[timeSlotIndex]; // Preserve the order
        if (!timeSlotKey) {
            if (debug) console.log(`Time slot key ${timeSlotIndex} not found in globalTimeSlots`);
            return; // Exit early if the time slot is not found
        }
        
        // Get the current diagnostics count for this time slot
        currentDiagnosticsCount = currentData.timeSlots[timeSlotKey]?.diagnostics || 0;

        if (typeof foundDiagnostics === 'number') {
            // Compare the found diagnostics number to the current data
            diagnosticsCount = foundDiagnostics;
            if (foundDiagnostics > currentDiagnosticsCount) {
                // Play the chime if the found number is larger than the current data
                AudioManager.playChime();
            }
        } else {
            // Reset diagnostics count to 0 if no diagnostics are found
            diagnosticsCount = 0;
        }

        // Update patient data for the specific time slot
        PatientManager.updatePatientData(patientName, `timeSlots.${timeSlotKey}`, { diagnostics: diagnosticsCount });

    } else {
        // If it's criticalNotes, missed, or due, we can store diagnostics count directly in the field
        currentDiagnosticsCount = currentData[category]?.diagnostics || 0;

        if (typeof foundDiagnostics === 'number') {
            diagnosticsCount = foundDiagnostics;
            if (foundDiagnostics > currentDiagnosticsCount) {
                AudioManager.playChime();
            }
        } else {
            diagnosticsCount = 0;
        }

        // Update patient data for criticalNotes, missed, or due
        PatientManager.updatePatientData(patientName, category, { diagnostics: diagnosticsCount });
    }

    if (debug) console.log(`Diagnostics updated for ${category}:`, currentDiagnosticsCount);
};

// Invalidate cached data
const resetCachedPatientList = () => {
    cachedPatientList = null; // Clear the cached patient list
    if (debug) console.log("cachedPatientList has been reset.");
};

const handleTimeSlotHeadersChange = (timeSlotHeadersNode) => {
    if (debug) console.log("Time slot headers changed:", timeSlotHeadersNode);

    // Collect the new time slots from the headers
    const newTimeSlots = [];

    // Assume the time slot headers are stored as children of timeSlotHeadersNode
    timeSlotHeadersNode.childNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && node.textContent.trim()) {
            newTimeSlots.push(node.textContent.trim()); // Push the time slot text to the array
        }
    });

    if (debug) console.log("New time slots found:", newTimeSlots);

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
        if (debug) console.log("Removed time slots:", removedTimeSlots);

        // For each patient, remove the diagnostics for the missing time slots
        const allPatients = PatientManager.getAllPatientData();
        Object.keys(allPatients).forEach(patientName => {
            removedTimeSlots.forEach(removedSlot => {
                delete allPatients[patientName].timeSlots[removedSlot]; // Remove the time slot from the patient's data
            });
        });

        if (debug) console.log("Removed time slots from patient data.");
    }

    // Handle added time slots
    if (addedTimeSlots.length > 0) {
        if (debug) console.log("Added time slots:", addedTimeSlots);

        // For each patient, initialize the new time slots with diagnostics count set to 0
        const allPatients = PatientManager.getAllPatientData();
        Object.keys(allPatients).forEach(patientName => {
            addedTimeSlots.forEach(addedSlot => {
                allPatients[patientName].timeSlots[addedSlot] = { diagnostics: 0 }; // Add the new time slot with default diagnostics
            });
        });
		// Trigger an update to refresh the patient data with the new time slots
		updatePatientDataToMatchScreen();

        if (debug) console.log("Added new time slots to patient data.");
    }

    // Log the updated global time slots
    if (debug) console.log("Updated global time slots:", globalTimeSlots);
};

// Utility functions
const getPatientList = () => {
    //if (!cachedPatientList) {
        cachedPatientList = document.querySelector('div[data-testid="PatientList"]');
    //}
    if (debug) console.log("Cached patient list:", cachedPatientList);
    return cachedPatientList; // Only re-fetch if cache is null
};

// Utility function to update patient data based on the current screen
const updatePatientDataToMatchScreen = () => {
    const patientList = getPatientList();
    if (!patientList) {
        if (debug) console.log("Patient list not found.");
        return;
    }

    Array.from(patientList.querySelectorAll('div[aria-label="Patient List Item"]')).forEach(patientCard => {
    handlePatientDataUpdate(patientCard, 'update');
});

    if (debug) console.log("Patient data updated to match the current screen.");
};

const resetTimeSlots = () => {
    globalTimeSlots = [];
};

// Message handling
chrome.runtime.onMessage.addListener((request) => {
    if (request.message === "playTestChime") {
        AudioManager.playChime(); // Reuse the AudioManager's playChime
    } else if (request.message === "toggleDebug") {
        debug = request.debug;
        console.log("Debug mode set to:", debug);
    } else if (request.message === "updatePatientData") {
        updatePatientDataToMatchScreen();
    } else if (request.message === "outputPatientLists") {
	PatientManager.logAllPatientData();
    } else if (request.message === "clearPatientData") {
	PatientManager.clearAllPatientData();
	resetTimeSlots();
	resetCachedPatientList();
	console.log("All patient data has been cleared.");
    } else if (request.message === "toggleExtensionState") {
        if (request.state) {
            // If the extension is activated, start observing
			console.log("The extension is activated, start observing");
            MutationObserverManager.startObserving();
        } else {
            // If the extension is deactivated, stop observing
			console.log("The extension is de-activated, stop observing");
            MutationObserverManager.stopObserving();
        }
    }
});

const MutationObserverManager = (() => {
	let activeObservers = []; // Track all active observers
	
    // Function to create an observer for time slots header row
    const createTimeSlotObserver = (timeSlotHeadersNode) => {
        console.log("Creating Time Slot Observer");
        const timeSlotObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            console.log("Time slot mutation detected:", mutation);

            // Check for added or removed nodes
            [...mutation.addedNodes, ...mutation.removedNodes].forEach(node => {
                if (node.nodeType === 1) {
                    console.log("Node added or removed in time slot header:", node);
                    handleTimeSlotHeadersChange(timeSlotHeadersNode);
                }
            });

            // Also check if any modifications happen within the time slot header
            if (mutation.target === timeSlotHeadersNode || timeSlotHeadersNode.contains(mutation.target)) {
                console.log("Time slot header modified:", mutation.target);
                handleTimeSlotHeadersChange(timeSlotHeadersNode); // Modified time slot header
            }
        });
    });

	    timeSlotObserver.observe(timeSlotHeadersNode, { childList: true, subtree: true });
	    activeObservers.push(timeSlotObserver); // Track this observer
    };

    // Function to create an observer for a patient card
    const createPatientCardObserver = (patientCardNode) => {
		console.log("Creating Patient Card Observer"); // Confirm observer creation
		const patientCardObserver = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				console.log("Mutation detected on patient card:", mutation);

				// Check for added or removed nodes
				[...mutation.addedNodes, ...mutation.removedNodes].forEach(node => {
					if (node.nodeType === 1) {
						console.log("Node added or removed:", node);
						handlePatientDataUpdate(node); // New or removed patient card
					}
				});

				// Also check if any modifications happen within the patient card
				if (mutation.target === patientCardNode || patientCardNode.contains(mutation.target)) {
					console.log("Patient card modified:", mutation.target);
					handlePatientDataUpdate(patientCardNode); // Modified patient card
				}
			});
		});
		
    patientCardObserver.observe(patientCardNode, { childList: true, subtree: true });
    activeObservers.push(patientCardObserver); // Track this observer
};

    // Function to locate the time slots header row based on the deep hierarchy
    const locateTimeSlotHeadersNode = () => {
        const patientListNode = document.querySelector('div[data-testid="PatientList"]');
        return patientListNode?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild?.children[1] || null;
    };

    // Wait for the patient list to be fully loaded (no loading indicator)
    const waitForPatientList = () => {
        const patientListNode = document.querySelector('div[data-testid="PatientList"]');

        // Helper function to search recursively for the "Patient List Loading Indicator"
        const isLoadingIndicatorPresent = (node) => {
            if (!node) return false;

            // If the current node has aria-label="Patient List Loading Indicator", return true
            if (node.getAttribute && node.getAttribute('aria-label') === 'Patient List Loading Indicator') {
                return true;
            }

            // Recursively check child nodes
            for (let child of node.children) {
                if (isLoadingIndicatorPresent(child)) {
                    return true; // If any child node has the loading indicator, return true
                }
            }

            return false; // No loading indicator found in this node or its children
        };

        if (patientListNode && !isLoadingIndicatorPresent(patientListNode)) {
            // If the patient list exists and there is no loading indicator, start observing
            startObserving(patientListNode);
        } else {
            if (debug) console.log("PatientList node not ready. Retrying...");
            setTimeout(waitForPatientList, 250); // Retry after 250ms if patient list not found or still loading
        }
    };

    // Function to start observing the time slot headers and all patient cards
    const startObserving = (patientListNode) => {
        // Locate the time slot headers row using the correct hierarchy
        const timeSlotHeadersNode = locateTimeSlotHeadersNode();
        if (timeSlotHeadersNode) {
            createTimeSlotObserver(timeSlotHeadersNode); // Start observing the time slot headers
        } else {
            if (debug) console.log("Time slot headers not found.");
			return;
        }

        // Locate the first patient card (2nd child of the first child)
        const firstPatientCard = patientListNode.firstElementChild?.children[1];
        if (!firstPatientCard) {
            if (debug) console.log("First patient card not found.");
            return;
        }

        // Create an observer for the first patient card
        createPatientCardObserver(firstPatientCard);

        // Iterate through the remaining siblings that have children (patient cards)
        let siblingNode = firstPatientCard.nextElementSibling;
        while (siblingNode && siblingNode.hasChildNodes()) {
            createPatientCardObserver(siblingNode); // Create an observer for each patient card
            siblingNode = siblingNode.nextElementSibling; // Move to the next sibling
        }
    };

     // Stop all observers
    const stopObserving = () => {
        activeObservers.forEach(observer => observer.disconnect());
        activeObservers = []; // Clear the observers list
        console.log("Stopped observing all nodes.");
    };

    return { startObserving, stopObserving };
})();

// Start observing when ready
chrome.storage.local.get("isActive", (result) => {
    if (result.isActive) {
        MutationObserverManager.startObserving();
    }
});
