// src/constants.js
import { Globals } from './globals.js'; // Import Globals

export const DEFAULT_MP3_FILENAME = '3_tone_chime-99718.mp3';

export const Constants = {
  MESSAGES: {
    PLAY_TEST_CHIME: 'playTestChime',
    TOGGLE_EXTENSION_STATE: 'toggleExtensionState',
    TOGGLE_DEBUG: 'toggleDebug',
    OUTPUT_PATIENT_LISTS: 'outputPatientLists',
    REINITIALIZE_AND_OUTPUT_PATIENT_LIST: 'reinitializeAndOutputPatientList',
    UPDATE_PATIENT_DATA: 'updatePatientData',
    CLEAR_PATIENT_DATA: 'clearPatientData',
    AUDIO_PLAYBACK_ERROR: 'audioPlaybackError', // Added for options.js
    // Add other message types as needed
  },

  getMessages() {
    return this.MESSAGES;
  },

  getDefaultMp3Filename() {
    return DEFAULT_MP3_FILENAME;
  },

  getDebug() {
    return Globals.getDebug();
  },

  // Add other methods as needed
};
