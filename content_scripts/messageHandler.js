// content_scripts/messageHandler.js

// Access the global Constants object
const MESSAGES = Constants.getMessages();

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch(request.message) {
        case MESSAGES.PLAY_TEST_CHIME:
            try {
                if (AudioManager && typeof AudioManager.playChime === 'function') {
                    AudioManager.playChime();
                    sendResponse({ success: true, message: "Chime played successfully." });
                } else {
                    console.error("AudioManager is not defined or playChime is not a function.");
                    sendResponse({ success: false, error: "AudioManager is not defined or playChime is not a function." });
                }
            } catch (error) {
                console.error("Error playing chime:", error);
                sendResponse({ success: false, error: error.message });
            }
            break; // Prevent fall-through

        case MESSAGES.TOGGLE_EXTENSION_STATE:
            try {
				// Retrieve the state from storage if available
				chrome.storage.local.get(['isExtensionActive', 'debug'], (result) => {
					if (result.isExtensionActive) {
						// Start polling or other active functionalities
						startPolling();
						sendResponse({ success: true, message: "Extension activated and polling started." });
					} else {
						// Stop polling or deactivate functionalities
						stopPolling();
						// Invoke cleanup
						if (AudioManager && typeof AudioManager.cleanup === 'function') {
							AudioManager.cleanup();
						}
						sendResponse({ success: true, message: "Extension deactivated and polling stopped." });
					}
				});
            } catch (error) {
                console.error("Error toggling extension state:", error);
                sendResponse({ success: false, error: error.message });
            }
            break; // Prevent fall-through

        case MESSAGES.TOGGLE_DEBUG:
            try {
                Globals.setDebug(request.debug);
                console.log("Debug mode set to:", request.debug);
                sendResponse({ success: true, message: `Debug mode set to ${request.debug}` });
            } catch (error) {
                console.error("Error toggling debug mode:", error);
                sendResponse({ success: false, error: error.message });
            }
            break; // Prevent fall-through

        case MESSAGES.OUTPUT_PATIENT_LISTS:
            try {
                PatientManager.logAllPatientData();
                sendResponse({ success: true, message: "Patient lists logged successfully." });
            } catch (error) {
                console.error("Error logging patient lists:", error);
                sendResponse({ success: false, error: error.message });
            }
            break; // Prevent fall-through

        case MESSAGES.REINITIALIZE_AND_OUTPUT_PATIENT_LIST:
            try {
                PatientManager.resetCachedPatientList();
                PatientManager.logAllPatientData();
                sendResponse({ success: true, message: "Patient list reinitialized and logged successfully." });
            } catch (error) {
                console.error("Error reinitializing and logging patient list:", error);
                sendResponse({ success: false, error: error.message });
            }
            break; // Prevent fall-through

        case MESSAGES.UPDATE_PATIENT_DATA:
            try {
                DOMHandlers.updatePatientDataToMatchScreen();
                sendResponse({ success: true, message: "Patient data updated successfully." });
            } catch (error) {
                console.error("Error updating patient data:", error);
                sendResponse({ success: false, error: error.message });
            }
            break; // Prevent fall-through

        case MESSAGES.CLEAR_PATIENT_DATA:
            try {
                PatientManager.clearAllPatientData();
                Globals.SetGlobalTimeSlots([]);
                DOMHandlers.resetCachedPatientList();
                if (Globals.getDebug()) console.log("All patient data has been cleared.");
                sendResponse({ success: true, message: "All patient data cleared successfully." });
            } catch (error) {
                console.error("Error clearing patient data:", error);
                sendResponse({ success: false, error: error.message });
            }
            break; // Prevent fall-through

        default:
            console.warn("Unknown message received:", request.message);
            sendResponse({ success: false, error: "Unknown message type." });
            break; // Prevent fall-through
    }
    
    // Return false since sendResponse is called synchronously in all cases
    return false;
});