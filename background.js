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
        const newDebug = !result.debug;
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
        case "playTestSound":
            chrome.storage.local.get(['soundFileDiagnostics'], (result) => {
                const soundFileURL = result.soundFileDiagnostics || chrome.runtime.getURL("3_tone_chime-99718.mp3"); // Use Diagnostics sound or default
                chrome.tabs.sendMessage(tab.id, { message: "playTestChime", soundFile: soundFileURL });
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
            console.warn("Unknown context menu item clicked:", info.menuItemId);
    }
});

// Listen for messages to toggle the extension state
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "toggleExtensionState") {
        const newState = request.state;
        chrome.storage.local.set({ isActive: newState }, () => {
            console.log(`Extension state set to: ${newState}`);
            // Notify all content scripts about the state change
            sendMessageToAllTabs({ message: "toggleExtensionState", state: newState });
            sendResponse({ status: "success" });
        });
        // Return true to indicate that the response is sent asynchronously
        return true;
    }
});

// Initialize the extension's active state and set up context menus on install
chrome.runtime.onInstalled.addListener(() => {
    // Create the context menu items
    chrome.contextMenus.create({
        id: "playTestSound",
        title: "Play Test Sound",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "debugMenu",
        title: "Debug",
        contexts: ["all"],
        documentUrlPatterns: ["https://app.vetradar.com/*"]
    });

    chrome.contextMenus.create({
        id: "outputPatientList",
        parentId: "debugMenu",
        title: "Output Current Patient Lists to Console",
        contexts: ["all"],
        documentUrlPatterns: ["https://app.vetradar.com/*"]
    });

    chrome.contextMenus.create({
        id: "reinitializePatientList",
        parentId: "debugMenu",
        title: "Reinitialize and Output Patient List",
        contexts: ["all"],
        documentUrlPatterns: ["https://app.vetradar.com/*"]
    });

    chrome.contextMenus.create({
        id: "toggleDebug",
        parentId: "debugMenu",
        title: "Toggle Debug Mode",
        contexts: ["all"],
        documentUrlPatterns: ["https://app.vetradar.com/*"]
    });

    chrome.contextMenus.create({
        id: "updatePatientData",
        parentId: "debugMenu",
        title: "Update Patient Data to Match Screen",
        contexts: ["all"],
        documentUrlPatterns: ["https://app.vetradar.com/*"]
    });

    chrome.contextMenus.create({
        id: "clearPatientData",
        parentId: "debugMenu",
        title: "Clear Patient Data",
        contexts: ["all"],
        documentUrlPatterns: ["https://app.vetradar.com/*"]
    });

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

// Listen for messages to update the extension's active state
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "toggleExtensionState") {
        const newState = request.state;
        chrome.storage.local.set({ isActive: newState }, () => {
            console.log(`Extension state set to: ${newState}`);
            // Notify all content scripts about the state change
            sendMessageToAllTabs({ message: "toggleExtensionState", state: newState });
            sendResponse({ status: "success" });
        });
        // Return true to indicate that the response is sent asynchronously
        return true;
    }
});

// Toggle the extension state when the icon is clicked
chrome.action.onClicked.addListener(() => {
    toggleExtension();
});

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

// Function to toggle the debug mode
function toggleDebug(tabId) {
    chrome.storage.local.get(['debug'], (result) => {
        const newDebug = !result.debug;
        chrome.storage.local.set({ debug: newDebug }, () => {
            sendMessageToTab(tabId, { message: "toggleDebug", debug: newDebug });
            console.log("Debug mode is now", newDebug ? "enabled" : "disabled");
        });
    });
}

// Update the browser action icon based on the extension state
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
