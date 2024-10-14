// src/content_scripts/constants.js

const DEFAULT_MP3_FILENAME = "3_tone_chime-99718.mp3";

const Constants = {
    MESSAGES: {
        PLAY_TEST_CHIME: "playTestChime",
        TOGGLE_EXTENSION_STATE: "toggleExtensionState",
        TOGGLE_DEBUG: "toggleDebug",
        OUTPUT_PATIENT_LISTS: "outputPatientLists",
        REINITIALIZE_AND_OUTPUT_PATIENT_LIST: "reinitializeAndOutputPatientList",
        UPDATE_PATIENT_DATA: "updatePatientData",
        CLEAR_PATIENT_DATA: "clearPatientData"
        // Add other message types as needed
    },
    
    getMessages: function() {
        return this.MESSAGES;
    }
};