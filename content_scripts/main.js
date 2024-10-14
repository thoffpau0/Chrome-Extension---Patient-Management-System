// main.js

// Your initialization code
if (Globals.getDebug()) console.log("Extension script loaded.");

// Update patient data on load
DOMHandlers.updatePatientDataToMatchScreen();

// Start observing DOM mutations if needed
// Uncomment the following line if you have a MutationObserverManager module
// MutationObserverManager.startObserving();

// Start the extension if it's active
if (Globals.getIsActive) {
    startPolling();
}

// Additional global initializations can go here