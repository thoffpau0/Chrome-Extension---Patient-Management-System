// patientManager.js
var PatientManager = (function() {
    var patientsData = {};

    function updatePatientData(patientName, category, data) {
        if (!patientsData[patientName]) {
            patientsData[patientName] = { criticalNotes: null, missed: null, due: null, timeSlots: {} };
        }

        if (typeof category === 'object' && category.timeSlots) {
            Object.assign(patientsData[patientName].timeSlots, category.timeSlots);
        } else if (category.startsWith('timeSlots.')) {
            var timeSlot = category.split('.')[1];
            patientsData[patientName].timeSlots[timeSlot] = data;
        } else {
            patientsData[patientName][category] = data;
        }

        if (Globals.getDebug()) console.log("Updated patient data for " + patientName + ":", patientsData[patientName]);
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
        console.log("Current state of all patient data:", patientsData);
    }

    return {
        updatePatientData: updatePatientData,
        getPatientData: getPatientData,
        getAllPatientData: getAllPatientData,
        clearAllPatientData: clearAllPatientData,
        logAllPatientData: logAllPatientData
    };
})();
