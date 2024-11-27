// background.js
let debug = true; // Initial debug state

// Function to update the browser action icon based on the extension state
function updateIcon(isActive) {
    const iconPath = isActive ? "icon48_on.png" : "icon48_off.png";
    chrome.action.setIcon({ path: iconPath }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error setting icon:", chrome.runtime.lastError);
        } else {
            console.log(`Icon updated to ${isActive ? "active" : "inactive"} state.`);
        }
    });
}

// Function to send a message to a specific tab
function sendMessageToTab(tabId, message) {
    chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Failed to send message to tab:", chrome.runtime.lastError.message);
        }
    });
}

// Function to send a message to all relevant tabs
function sendMessageToAllTabs(message) {
    chrome.tabs.query({ url: "https://app.vetradar.com/*" }, (tabs) => {
        tabs.forEach((tab) => sendMessageToTab(tab.id, message));
    });
}

// Function to toggle the debug mode
function toggleDebug(tabId) {
    chrome.storage.local.get(['debug'], (result) => {
        const currentDebug = result.debug !== undefined ? result.debug : false;
        const newDebug = !currentDebug;
        chrome.storage.local.set({ debug: newDebug }, () => {
            sendMessageToTab(tabId, { message: "toggleDebug", debug: newDebug });
            console.log("Debug mode is now", newDebug ? "enabled" : "disabled");
        });
    });
}

// Function to toggle the extension's active state
function toggleExtension() {
    chrome.storage.local.get(['isActive'], (result) => {
        const currentState = result.isActive !== undefined ? result.isActive : true;
        const newState = !currentState;
        chrome.storage.local.set({ isActive: newState }, () => {
            console.log(`Extension state set to: ${newState}`);
            updateIcon(newState);
            sendMessageToAllTabs({ message: "toggleExtensionState", state: newState });
            console.log("Extension is now", newState ? "active" : "inactive");
        });
    });
}

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

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "toggleExtensionState") {
        const newState = request.state;
        chrome.storage.local.set({ isActive: newState }, () => {
            console.log(`Extension state set to: ${newState}`);
            updateIcon(newState);
            sendMessageToAllTabs({ message: "toggleExtensionState", state: newState });
            sendResponse({ status: "success" });
        });
        return true; // Keep the messaging channel open for sendResponse
    }
});

// Initialize the extension's active state on install
chrome.runtime.onInstalled.addListener(() => {
    // Retrieve and initialize the state from storage if available
    chrome.storage.local.get(['isActive', 'debug'], (result) => {
        if (result.isActive === undefined) {
            chrome.storage.local.set({ isActive: true }, () => {
                console.log("Extension enabled by default on install.");
                updateIcon(true);
                sendMessageToAllTabs({ message: "toggleExtensionState", state: true });
            });
        } else {
            updateIcon(result.isActive);
        }

        if (result.debug !== undefined) {
            debug = result.debug;
            console.log("Debug mode set to:", debug);
        } else {
            chrome.storage.local.set({ debug: false });
            debug = false;
            console.log("Debug mode set to default (false).");
        }
    });
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['isActive'], (result) => {
        const currentState = result.isActive !== undefined ? result.isActive : true;
        chrome.storage.local.set({ isActive: currentState }, () => {
            console.log(`Extension set to ${currentState ? "active" : "inactive"} on startup.`);
            updateIcon(currentState);
            sendMessageToAllTabs({ message: "toggleExtensionState", state: currentState });
        });
    });
});

// Toggle the extension state when the icon is clicked
chrome.action.onClicked.addListener(() => {
    toggleExtension();
});

// Call loadSettings when the content script is first executed
loadSettings();