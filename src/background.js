// src/background.js
import { Globals } from './globals.js'; 
import { MESSAGES } from './constants.js';

// Utility function to log messages based on debug state using Globals
function logDebug(message, ...args) {
    if (Globals.getDebug()) { // Using Globals getter
        console.log(`[Debug] ${message}`, ...args);
    }
}

// Initialize context menus upon installation
chrome.runtime.onInstalled.addListener(() => {
    // Create the main "Play Test Sound" context menu
    chrome.contextMenus.create({
        id: "playTestSound",
        title: "Play Test Sound",
        contexts: ["action"]
    });

    // Create the "Debug" submenu
    chrome.contextMenus.create({
        id: "debugMenu",
        title: "Debug",
        contexts: ["all"],
        documentUrlPatterns: ["https://app.vetradar.com/*"]
    });

    // Create items under the "Debug" submenu
    const debugMenuItems = [
        {
            id: "outputPatientList",
            title: "Output Current Patient Lists to Console",
            contexts: ["all"],
            documentUrlPatterns: ["https://app.vetradar.com/*"]
        },
        {
            id: "reinitializePatientList",
            title: "Reinitialize and Output Patient List",
            contexts: ["all"],
            documentUrlPatterns: ["https://app.vetradar.com/*"]
        },
        {
            id: "toggleDebug",
            title: "Toggle Debug Mode",
            contexts: ["all"],
            documentUrlPatterns: ["https://app.vetradar.com/*"]
        },
        {
            id: "updatePatientData",
            title: "Update Patient Data to Match Screen",
            contexts: ["all"],
            documentUrlPatterns: ["https://app.vetradar.com/*"]
        },
        {
            id: "clearPatientData",
            title: "Clear Patient Data",
            contexts: ["all"],
            documentUrlPatterns: ["https://app.vetradar.com/*"]
        }
    ];

    debugMenuItems.forEach(item => chrome.contextMenus.create(item));

    // Retrieve the state from storage if available
    chrome.storage.local.get(['isExtensionActive', 'debug'], (result) => {
        if (result.isExtensionActive !== undefined) {
            Globals.setIsActive(result.isExtensionActive);
        }
        if (result.debug !== undefined) {
            Globals.setDebug(result.debug);
        }
        updateIcon();
        logDebug("Initial states loaded:", {
            isExtensionActive: Globals.getIsActive(),
            debug: Globals.getDebug()
        });
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id) {
        logDebug("No active tab found for context menu action.");
        return;
    }

    switch (info.menuItemId) {
        case "playTestSound":
            chrome.storage.local.get(['selectedSound'], (result) => {
				const mp3Filename = Globals.getDefaultMp3Filename();
                const soundFileURL = result.selectedSound || chrome.runtime.getURL(`resources/${mp3Filename}`); // Use default if no custom sound
                chrome.tabs.sendMessage(tab.id, { message: "playTestChime", soundFile: soundFileURL }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error sending playTestChime message:", chrome.runtime.lastError.message);
                    } else {
                        logDebug("playTestChime message sent successfully.");
                    }
                });
            });
            break;
        case "toggleDebug":
            toggleDebug(tab.id);
            break;
        case "outputPatientList":
            sendMessageToTab(tab.id, { message: "outputPatientLists" });
            break;
        case "reinitializePatientList":
            sendMessageToTab(tab.id, { message: "reinitializeAndOutputPatientList" });
            break;
        case "updatePatientData":
            sendMessageToTab(tab.id, { message: "updatePatientData" });
            break;
        case "clearPatientData":
            sendMessageToTab(tab.id, { message: "clearPatientData" });
            break;
        default:
            console.warn("Unhandled context menu item:", info.menuItemId);
            break;
    }
});

// Toggle the extension state when the icon is clicked
chrome.action.onClicked.addListener(() => {
    toggleExtension();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	switch(request.message) {
		case MESSAGES.TOGGLE_EXTENSION_STATE:
			Globals.setIsActive(request.state);
			chrome.storage.local.set({ isExtensionActive: Globals.getIsActive() }, () => {
				if (chrome.runtime.lastError) {
					console.error("Error setting isExtensionActive:", chrome.runtime.lastError.message);
					sendResponse({ success: false });
					return;
				}
				updateIcon();
				sendMessageToAllTabs({ message: "toggleExtensionState", state: Globals.getIsActive() });
				console.log("Extension state toggled to:", Globals.getIsActive());
				sendResponse({ success: true });

				if (!Globals.getIsActive()) {
					// Send a message to all content scripts to perform cleanup
					sendMessageToAllTabs({ message: "cleanupAudio" });
				}
			});
			return true; // Indicates that the response is sent asynchronously
			
		default:
            console.warn("Unknown message received:", request.message);
            sendResponse({ success: false, error: "Unknown message type." });
            return false; // Synchronous response
	}
});

// Function to toggle the extension's active state
function toggleExtension() {
    Globals.setIsActive(!Globals.getIsActive());
    chrome.storage.local.set({ isExtensionActive: Globals.getIsActive() }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving isExtensionActive state:", chrome.runtime.lastError.message);
            return;
        }
        updateIcon();
        sendMessageToAllTabs({ message: "toggleExtensionState", state: Globals.getIsActive() });
        console.log("Extension is now", Globals.getIsActive() ? "active" : "inactive");
    });
}

// Update the browser action icon based on the extension state
function updateIcon() {
    const iconPath = Globals.getIsActive() ? "icons/icon48_on.png" : "icons/icon48_off.png";
    chrome.action.setIcon({ path: iconPath }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error setting icon:", chrome.runtime.lastError.message);
        } else {
            logDebug("Icon updated to", iconPath);
        }
    });
}

// Function to toggle the debug mode
function toggleDebug(tabId) {
    Globals.setDebug(!Globals.getDebug());
    chrome.storage.local.set({ debug: Globals.getDebug() }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving debug state:", chrome.runtime.lastError.message);
            return;
        }
        sendMessageToTab(tabId, { message: "toggleDebug", debug: Globals.getDebug() });
        console.log("Debug mode is now", Globals.getDebug() ? "enabled" : "disabled");
    });
}

// Send a message to a specific tab
function sendMessageToTab(tabId, message) {
    chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
            console.error(`Failed to send message to tab ${tabId}:`, chrome.runtime.lastError.message);
        } else {
            logDebug(`Message sent to tab ${tabId}:`, message);
        }
    });
}

// Send a message to all active tabs of the extension
function sendMessageToAllTabs(message) {
    chrome.tabs.query({ url: "https://app.vetradar.com/*" }, (tabs) => {
        if (chrome.runtime.lastError) {
            console.error("Error querying tabs:", chrome.runtime.lastError.message);
            return;
        }

        tabs.forEach((tab) => {
            sendMessageToTab(tab.id, message);
        });

        logDebug("Messages sent to all relevant tabs:", message);
    });
}
