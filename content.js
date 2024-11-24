let isActive = true; // Extension starts deactivated
let pollingInterval = null;

// Ensure your namespace exists
window.VR_Mon_App = window.VR_Mon_App || {};

// Set the window.debug variable in the global scope
window.debug = true;

// Now use the AudioManager via your namespace
const { AudioManager, PatientManager } = VR_Mon_App;

// Message handling
chrome.runtime.onMessage.addListener((request) => {
    if (request.message === "playTestChime") {
        AudioManager.playChime(); // Reuse the AudioManager's playChime
    } else if (request.message === "toggleDebug") {
        window.debug = request.debug;
        console.log("window.debug mode set to:", window.debug);
    } else if (request.message === "updatePatientData") {
        PatientManager.updatePatientDataToMatchScreen();
    } else if (request.message === "outputPatientLists") {
		PatientManager.logAllPatientData();
	} else if (request.message === "clearPatientData") {
		PatientManager.clearAllPatientData();
		PatientManager.resetTimeSlots();
		if (window.debug) console.log("All patient data has been cleared.");
	} else if (request.message === "toggleExtensionState") {
         isActive = request.state;
        if (isActive) {
            if (window.debug) console.log("Extension activated. Starting polling.");
            startPolling();
        } else {
            if (window.debug) console.log("Extension deactivated. Stopping polling.");
            stopPolling();
        }
    } else {
		console.warn("Unknown message received:", request.message);
	}
});

const startPolling = () => {
     if (isActive && !pollingInterval) {
        pollingInterval = setInterval(() => {
            PatientManager.updatePatientDataToMatchScreen();
        }, 2000); // Adjust the interval as needed
        if (window.debug) console.log("Started polling for patient data updates.");
    }
};

const stopPolling = () => {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        if (window.debug) console.log("Stopped polling for patient data updates.");
    }
};

const initializeExtensionState = () => {
/**
* Initializes the extension's active state and starts polling if active.
*/
    chrome.storage.local.get(['isActive'], (result) => {
        isActive = result.isActive !== undefined ? result.isActive : true; // Default to true if not set
        if (isActive) {
            startPolling();
            if (window.debug) console.log("Extension is active. Polling started on load.");
        }
		
		// Optionally, set window.debug mode based on stored value
        if (window.debug) {
            console.log("window.debug mode is enabled.");
        }
    });
};

// Call the initialization function when the content script loads
initializeExtensionState();