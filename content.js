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
    chrome.storage.local.get(['isActive', 'debug'], (result) => {
        isActive = result.isActive !== undefined ? result.isActive : true; // Default to true if not set
        window.debug = result.debug !== undefined ? result.debug : false; // Default to false if not set
        
        if (isActive) {
            startPolling();
            if (window.debug) console.log("Extension is active. Polling started on load.");
        }

        console.log("window.debug mode is", window.debug ? "enabled" : "disabled");
    });
};

// Call the initialization function when the content script loads
initializeExtensionState();