let isExtensionActive = false; // Initial extension state
let debug = false; // Initial debug state

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


    // Retrieve the state from storage if available
    chrome.storage.local.get(['isExtensionActive', 'debug'], (result) => {
        if (result.isExtensionActive !== undefined) isExtensionActive = result.isExtensionActive;
        if (result.debug !== undefined) debug = result.debug;
        updateIcon();
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
        case "playTestSound":
            chrome.storage.local.get(['selectedSound'], (result) => {
                const soundFileURL = result.selectedSound || chrome.runtime.getURL("3_tone_chime-99718.mp3"); // Use default if no custom sound
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

    }
});

// Toggle the extension state when the icon is clicked
chrome.action.onClicked.addListener(() => {
    toggleExtension();
});

// Function to toggle the extension's active state
function toggleExtension() {
    isExtensionActive = !isExtensionActive;
    chrome.storage.local.set({ isExtensionActive });
    updateIcon();
    sendMessageToAllTabs({ message: "toggleExtensionState", state: isExtensionActive });
    console.log("Extension is now", isExtensionActive ? "active" : "inactive");
}

// Update the browser action icon based on the extension state
function updateIcon() {
    const iconPath = isExtensionActive ? "icon48_on.png" : "icon48_off.png";
    chrome.action.setIcon({ path: iconPath });
}

// Function to toggle the debug mode
function toggleDebug(tabId) {
    debug = !debug;
    chrome.storage.local.set({ debug });
    sendMessageToTab(tabId, { message: "toggleDebug", debug });
    console.log("Debug mode is now", debug ? "enabled" : "disabled");
}

// Send a message to a specific tab
function sendMessageToTab(tabId, message) {
    chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Failed to send message to tab:", chrome.runtime.lastError.message);
        }
    });
}

// Send a message to all active tabs of the extension
function sendMessageToAllTabs(message) {
    chrome.tabs.query({ url: "https://app.vetradar.com/*" }, (tabs) => {
        tabs.forEach((tab) => sendMessageToTab(tab.id, message));
    });
}
