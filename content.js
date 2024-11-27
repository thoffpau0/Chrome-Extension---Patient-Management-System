// content.js

// Ensure your namespace exists
window.VR_Mon_App = window.VR_Mon_App || {};

// Set the window.debug variable in the global scope
window.debug = true;

// Now use the AudioManager via your namespace
const { AudioManager, PatientManager } = VR_Mon_App;

// Variables to keep track of initialization
let isActive = false; // Extension starts inactive until user interaction
let pollingInterval = null;
let isMonitoringStarted = false;

// Function to inject CSS for the modal dialog
function injectModalCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Modal Overlay */
        #vr-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 9999;
        }
        /* Modal Content */
        #vr-modal {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: #fff;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            text-align: center;
        }
        #vr-modal h2 {
            margin-top: 0;
        }
        #vr-start-button {
            padding: 10px 20px;
            font-size: 16px;
        }
    `;
    document.head.appendChild(style);
}

// Function to inject HTML for the modal dialog
function injectModalHTML() {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'vr-modal-overlay';

    modalOverlay.innerHTML = `
        <div id="vr-modal">
            <h2>Vet Radar Monitoring</h2>
            <p>Click "Start Monitoring" to begin.</p>
            <button id="vr-start-button">Start Monitoring</button>
        </div>
    `;

    document.body.appendChild(modalOverlay);
}

// Function to show the modal dialog
function showModal() {
    const overlay = document.getElementById('vr-modal-overlay');
    overlay.style.display = 'block';
}

// Function to initialize monitoring after user interaction
function initializeMonitoring() {
    if (isMonitoringStarted) return;
    isMonitoringStarted = true;

    // Hide the modal if it's still visible
    const overlay = document.getElementById('vr-modal-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }

    // Set session storage flag
    sessionStorage.setItem('vrMonitoringStarted', 'true');

    // Load settings and start polling
    loadSettings();
}

// Function to handle the Start Monitoring button click
function handleStartButtonClick() {
    initializeMonitoring();
}

// Set up event listener for the Start Monitoring button
function setupModalEventListeners() {
    const startButton = document.getElementById('vr-start-button');
    startButton.addEventListener('click', handleStartButtonClick);
}

// Check if monitoring has already been started
function checkMonitoringStatus() {
    if (sessionStorage.getItem('vrMonitoringStarted')) {
        // Monitoring has already started in this session
        isMonitoringStarted = true;
		// Hide the modal if it's still visible
		const overlay = document.getElementById('vr-modal-overlay');
		if (overlay) {
			overlay.style.display = 'none';
		}
        // Initialize without showing modal
        initializeMonitoring();
    } else {
        // Show modal to get user interaction
        showModal();
        setupModalEventListeners();
    }
}

// Initial load of settings
function loadSettings() {
    chrome.storage.local.get([
        'chimeVolume',
        'patientAddedVolume',
        'patientRemovedVolume',
        'examRoomNotificationVolume',
        'enablePatientAdded',
        'enablePatientRemoved',
        'enableExamRoomNotification',
        'isActive',
        'debug'
    ], function (result) {
        // Initialize your variables with the settings
        window.chimeVolume = result.chimeVolume !== undefined ? result.chimeVolume : 0.5;
        window.patientAddedVolume = result.patientAddedVolume !== undefined ? result.patientAddedVolume : 1.0;
        window.patientRemovedVolume = result.patientRemovedVolume !== undefined ? result.patientRemovedVolume : 1.0;
        window.examRoomNotificationVolume = result.examRoomNotificationVolume !== undefined ? result.examRoomNotificationVolume : 1.0;
        window.enablePatientAdded = result.enablePatientAdded !== false; // Default to true if undefined
        window.enablePatientRemoved = result.enablePatientRemoved !== false; // Default to true if undefined
        window.enableExamRoomNotification = result.enableExamRoomNotification !== false; // Default to true if undefined

        isActive = result.isActive !== undefined ? result.isActive : true; // Default to true if not set
        window.debug = result.debug !== undefined ? result.debug : false; // Default to false if not set

        console.log('Settings loaded:', {
            chimeVolume: window.chimeVolume,
            patientAddedVolume: window.patientAddedVolume,
            patientRemovedVolume: window.patientRemovedVolume,
            examRoomNotificationVolume: window.examRoomNotificationVolume,
            enablePatientAdded: window.enablePatientAdded,
            enablePatientRemoved: window.enablePatientRemoved,
            enableExamRoomNotification: window.enableExamRoomNotification,
            isActive,
            debug: window.debug
        });

        // Start polling if active
        initializeExtensionState();
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
        if (changes.isActive) {
            isActive = changes.isActive.newValue;
            console.log('Updated isActive:', isActive);
            if (isActive) {
                startPolling();
            } else {
                stopPolling();
            }
        }
        if (changes.debug) {
            window.debug = changes.debug.newValue;
            console.log('window.debug mode is', window.debug ? "enabled" : "disabled");
        }
        // Handle other settings if needed
    }
});

// Function to start polling
const startPolling = () => {
    if (isActive && !pollingInterval) {
        pollingInterval = setInterval(() => {
            PatientManager.updatePatientDataToMatchScreen();
        }, 2000); // Adjust the interval as needed
        if (window.debug) console.log("Started polling for patient data updates.");
    }
};

// Function to stop polling
const stopPolling = () => {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        if (window.debug) console.log("Stopped polling for patient data updates.");
    }
};

// Function to initialize the extension state after user interaction
const initializeExtensionState = () => {
    if (isActive) {
        startPolling();
        if (window.debug) console.log("Extension is active. Polling started.");
    } else {
        if (window.debug) console.log("Extension is inactive.");
    }
};

// **Check document.readyState and Initialize Accordingly**
function initializeContentScript() {
    injectModalCSS();
    injectModalHTML();
    checkMonitoringStatus();
}

// **Set up listener for 'readystatechange' event**
function onReadyStateChange() {
    if (document.readyState === 'complete') {
        // Remove the event listener to avoid duplicate execution
        document.removeEventListener('readystatechange', onReadyStateChange);
        initializeContentScript();
    }
}

// Add the event listener for 'readystatechange'
document.addEventListener('readystatechange', onReadyStateChange);

// Check if document.readyState is already 'complete'
if (document.readyState === 'complete') {
    onReadyStateChange();
}
