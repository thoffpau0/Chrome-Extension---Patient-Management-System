// domHandlers.js
var DOMHandlers = (function() {
    function resetCachedPatientList() {
        cachedPatientList = null;
        if (Globals.getDebug()) console.log("cachedPatientList has been reset.");
    }

    function getPatientList() {
        cachedPatientList = document.querySelector('div[data-testid="PatientList"]');
        if (Globals.getDebug()) console.log("Cached patient list:", cachedPatientList);
        return cachedPatientList;
    }

    function updatePatientDataToMatchScreen() {
        var patientList = getPatientList();
        if (!patientList) {
            if (Globals.getDebug()) console.log("Patient list not found.");
            return;
        }

        Array.from(patientList.querySelectorAll('div[aria-label="Patient List Item"]')).forEach(function(patientCard) {
            handlePatientDataUpdate(patientCard);
        });

        if (Globals.getDebug()) console.log("Patient data updated to match the current screen.");
    }
	
	// Main function to find patient name
	function findPatientName(patientListItem) {
		const avatarDiv = patientListItem.querySelector('div[aria-label="avatarWithMessage"]');
		if (!avatarDiv) {
			if (Globals.getDebug()) console.log("Avatar div not found for patientListItem:", patientListItem);
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

		if (Globals.getDebug()) console.log("No valid patient name found in this patient list item:", patientListItem);
		return null;
	}

	// Initialize patient data with time slots
	function initializePatientData(patientName) {
		const timeSlots = Utilities.findTimeSlots();
		if (!timeSlots.length) {
			if (Globals.getDebug()) console.log(`No time slots found, skipping initialization for ${patientName}.`);
			return;
		}
		if (Globals.getDebug()) console.log(`Initializing patient data for ${patientName} with time slots:`, timeSlots);
		const initialData = { criticalNotes: null, missed: null, due: null, timeSlots: {} };
		timeSlots.forEach(time => {
			if (!initialData.timeSlots[time]) {
				initialData.timeSlots[time] = { diagnostics: 0 };
			}
		});
		PatientManager.updatePatientData(patientName, initialData);
	}
	
	function findCriticalNotesNode(patientBar) {
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
		}

	// Function to recursively search for a node with aria-label="Patient List Item"
	function findPatientListItemNode(parentNode) {
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
	}

	// Handle updates to patient data
	function handlePatientDataUpdate(node) {
		// Find patient name
		const patientName = findPatientName(node);
		if (!patientName) {
			console.error("Patient name not found.");
			return;
		}

		// Initialize the patient if not present in the data
		if (!PatientManager.getPatientData(patientName)) {
			initializePatientData(patientName); // Initialize with time slots
		}
		
	 
		// Find the Patient List Item node by recursively searching the sibling's children
		const patientListItemNode = findPatientListItemNode(node);
		if (!patientListItemNode) {
			if (Globals.getDebug()) console.log("Patient List Item node not found.");
			return;
		}

		// The patient bar is the next sibling of the Patient List Item node
		const patientBar = patientListItemNode.nextElementSibling;
		if (!patientBar) {
				if (Globals.getDebug()) console.log(`Patient bar not found for node:`, node);
				return;
			}
			
		
		// Find the Critical Notes node
		const criticalNotesNode = findCriticalNotesNode(patientBar);
		if (!criticalNotesNode) {
			if (Globals.getDebug()) console.log("Critical notes node not found.");
			return;
		}

		// Find the siblings: missed, due, and time slots
		const missedNode = criticalNotesNode.nextElementSibling;
		const dueNode = missedNode?.nextElementSibling;

		if (!missedNode || !dueNode) {
			if (Globals.getDebug()) console.log("Missed or Due nodes not found.");
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

		if (Globals.getDebug()) console.log(`Updated patient data for ${patientName}`);
	}

	function debounce(func, wait) {
	  let timeout;
	  return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(this, args), wait);
	  };
	}

    // Function to update diagnostics count for a specific node
	function updateDiagnosticsCountForNode(patientName, category, node) {
		// Search the node for any diagnostics tasks
		const foundDiagnostics = searchForDiagnostics(node);
		
		// Retrieve current patient data
		const currentData = PatientManager.getPatientData(patientName);
		
		// Variable to hold the current diagnostics count
		let currentDiagnosticsCount = 0;
		
		let diagnosticsCount;
		
		// Check if this is a time slot or a field (criticalNotes, missed, due)
		if (category.startsWith('timeSlots.')) {
			const timeSlotIndex = category.split('.')[1];
			const globalTimeSlots = Globals.getGlobalTimeSlots();

			// Use the index to access the correct time slot in the timeSlots array
			const timeSlotKey = globalTimeSlots[timeSlotIndex]; // Preserve the order
			if (!timeSlotKey) {
				if (Globals.getDebug()) console.log(`Time slot key ${timeSlotIndex} not found in globalTimeSlots`);
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

		if (Globals.getDebug()) console.log(`Diagnostics updated for ${category}:`, currentDiagnosticsCount);
	}

	function searchForDiagnostics(node) {
		 diagnosticsNumber = null; // Declare diagnosticsNumber in the outer scope
		// Helper function to search recursively for diagnostics in child nodes
		const searchChildrenForDiagnostics = (parentNode) => {
			for (let child of parentNode.children) {
				const result = searchForDiagnostics(child); // Recursively search children
				if (result) return result; // Return if diagnostics node is found
			}
			return false; // No diagnostics node found in children
		}

		// Helper function to find diagnostics number in previous sibling
		const visitedNodes = new Set();

		const findDiagnosticsNumber = (sibling) => {
			if (!sibling || visitedNodes.has(sibling)) return null;
			visitedNodes.add(sibling);

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
		}

		// Check if the current node itself has 'data-testId="Diagnostics"'
		if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('data-testId') === 'Diagnostics') {
			// Look for the diagnostic number in the previous sibling
			diagnosticsNumber = findDiagnosticsNumber(node.previousElementSibling);

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

				return 1; // Diagnostics node found, no number available
			}

			// If the sibling has children, search within its children
			if (sibling.children && sibling.children.length > 0) {
				const result = searchChildrenForDiagnostics(sibling);
				if (result) return result; // Return result if diagnostics node is found
			}

			// Move to the next sibling and repeat the process
			sibling = sibling.nextElementSibling;
		}

		return 0; // Return 0 if no diagnostics node found
	}
	
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

	
	const handlePatientDataUpdateDebounced = debounce(handlePatientDataUpdate, 200);
	
	// Expose functions
    return {
        resetCachedPatientList: resetCachedPatientList,
        getPatientList: getPatientList,
        updatePatientDataToMatchScreen: updatePatientDataToMatchScreen,
        // Expose handlePatientDataUpdate if it needs to be called from outside
        // handlePatientDataUpdate: handlePatientDataUpdate
    };
})();