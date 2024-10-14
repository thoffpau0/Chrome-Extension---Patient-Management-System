// polling.js
var pollingInterval = null;

function startPolling() {
    if (!pollingInterval) {
        pollingInterval = setInterval(function() {
            DOMHandlers.updatePatientDataToMatchScreen();
        }, 500); // Adjust the interval as needed
        if (Globals.getDebug()) console.log("Started polling for patient data updates.");
    }
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        if (Globals.getDebug()) console.log("Stopped polling for patient data updates.");
    }
}