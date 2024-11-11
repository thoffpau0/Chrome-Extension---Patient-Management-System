// src/content_scripts/patientManager.js

import { Globals } from '../globals.js'; // Ensure Globals is exported from globals.js

const PatientManager = (function () {
  let patientsData = {};

  function updatePatientData(patientName, category, data) {
    if (!patientsData[patientName]) {
      patientsData[patientName] = {
        criticalNotes: null,
        missed: null,
        due: null,
        timeSlots: {},
      };
    }

    if (typeof category === 'object' && category.timeSlots) {
      Object.assign(patientsData[patientName].timeSlots, category.timeSlots);
    } else if (category.startsWith('timeSlots.')) {
      const timeSlot = category.split('.')[1];
      patientsData[patientName].timeSlots[timeSlot] = data;
    } else {
      patientsData[patientName][category] = data;
    }

    if (Globals.getDebug())
      console.log(
        `Updated patient data for ${patientName}:`,
        patientsData[patientName]
      );
  }

  function getPatientData(patientName) {
    return patientsData[patientName] || null;
  }

  function getAllPatientData() {
    return patientsData;
  }

  function clearAllPatientData() {
    patientsData = {};
  }

  function logAllPatientData() {
    console.log('Current state of all patient data:', patientsData);
  }

  return {
    updatePatientData,
    getPatientData,
    getAllPatientData,
    clearAllPatientData,
    logAllPatientData,
  };
})();

// Export the PatientManager for use in other modules
export { PatientManager };
