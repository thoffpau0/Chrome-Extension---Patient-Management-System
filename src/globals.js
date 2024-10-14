// src/globals.js

export const Globals = (function() {
    let debug = false;
    let isActive = false;
    let cachedPatientList = null;
    let globalTimeSlots = [];

    // MP3 file name state
    let defaultMp3Filename = "3_tone_chime-99718.mp3";

    return {
        // Debug state
        getDebug: function() {
            return debug;
        },
        setDebug: function(value) {
            debug = value;
        },
        // Extension active state
        getIsActive: function() {
            return isActive;
        },
        setIsActive: function(value) {
            isActive = value;
        },
        // Cached patient list
        getCachedPatientList: function() {
            return cachedPatientList;
        },
        setCachedPatientList: function(value) {
            cachedPatientList = value;
        },
        // Global time slots
        getGlobalTimeSlots: function() {
            return globalTimeSlots;
        },
        setGlobalTimeSlots: function(value) {
            globalTimeSlots = value;
        },
        // Default MP3 Filename
        getDefaultMp3Filename: function() {
            return defaultMp3Filename;
        },
        setDefaultMp3Filename: function(filename) {
            defaultMp3Filename = filename;
        }
    };
})();
