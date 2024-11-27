// options_data.js

// Shared Variables
var settingsChanged = false;

// Element References
var saveSettingsButton = document.getElementById('saveSettings');
var restoreDefaultsButton = document.getElementById('restoreDefaults');
var masterVolumeSlider = document.getElementById('volumeSlider');
var masterVolumeValue = document.getElementById('volumeValue');

// Sound Library Definition
var soundLibrary = {
    examRoomNotification: {
        name: 'ExamRoomNNotification',
        elements: {
            enableCheckbox: document.getElementById('enableExamRoomNotification'),
            selectDropdown: document.getElementById('libraryExamRoomNotification'),
            volumeSlider: document.getElementById('volumeLibraryExamRoomNotification'),
            volumeValue: document.getElementById('volumeLibraryExamRoomNotificationValue'),
            dropzone: document.getElementById('dropzoneExamRoomNotification'),
            resetButton: document.getElementById('resetExamRoomNotification'),
            playButton: document.getElementById('playLibraryExamRoomNotification'),
        },
        storageKeys: {
            enabled: 'enableExamRoomNotification',
            fileName: 'examRoomNotificationFileName',
            fileData: 'examRoomNotificationFileData',
            volume: 'examRoomNotificationVolume',
        },
        defaultValues: {
            enabled: true,
            fileName: '3_tone_chime-99718.mp3',
            fileData: null,
            volume: 0.5,
        },
    },
    patientAdded: {
        name: 'Patient Added',
        elements: {
            enableCheckbox: document.getElementById('enablePatientAdded'),
            selectDropdown: document.getElementById('libraryPatientAdded'),
            volumeSlider: document.getElementById('volumeLibraryPatientAdded'),
            volumeValue: document.getElementById('volumeLibraryPatientAddedValue'),
            dropzone: document.getElementById('dropzonePatientAdded'),
            resetButton: document.getElementById('resetPatientAdded'),
            playButton: document.getElementById('playLibraryPatientAdded'),
        },
        storageKeys: {
            enabled: 'enablePatientAdded',
            fileName: 'patientAddedFileName',
            fileData: 'patientAddedFileData',
            volume: 'patientAddedVolume',
        },
        defaultValues: {
            enabled: true,
            fileName: 'BuddyIn.mp3',
            fileData: null,
            volume: 0.5,
        },
    },
    patientRemoved: {
        name: 'Patient Removed',
        elements: {
            enableCheckbox: document.getElementById('enablePatientRemoved'),
            selectDropdown: document.getElementById('libraryPatientRemoved'),
            volumeSlider: document.getElementById('volumeLibraryPatientRemoved'),
            volumeValue: document.getElementById('volumeLibraryPatientRemovedValue'),
            dropzone: document.getElementById('dropzonePatientRemoved'),
            resetButton: document.getElementById('resetPatientRemoved'),
            playButton: document.getElementById('playLibraryPatientRemoved'),
        },
        storageKeys: {
            enabled: 'enablePatientRemoved',
            fileName: 'patientRemovedFileName',
            fileData: 'patientRemovedFileData',
            volume: 'patientRemovedVolume',
        },
        defaultValues: {
            enabled: true,
            fileName: 'Goodbye.mp3',
            fileData: null,
            volume: 0.5,
        },
    },
};
