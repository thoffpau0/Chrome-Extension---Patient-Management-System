// utilities.js
var Utilities = (function() {
    function findTimeSlots() {
		const globalTimeSlots = Globals.getGlobalTimeSlots();
        if (globalTimeSlots.length > 0) {
            return globalTimeSlots;
        }

        var timeSlots = [];
        var patientListNode = document.querySelector('div[data-testid="PatientList"]');
        if (!patientListNode) {
            if (Globals.getDebug()) console.log("PatientList node not found.");
            return timeSlots;
        }

        var startingNode = patientListNode.firstElementChild && patientListNode.firstElementChild.firstElementChild;
        if (!startingNode) {
            if (Globals.getDebug()) console.log("Starting node for time slots not found.");
            return timeSlots;
        }

        var timeSlotRegex = /^\d{1,2}:\d{2}(am|pm)$/i;

        function searchTimeSlots(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                var dataTestId = node.getAttribute('data-testid');
                if (dataTestId && timeSlotRegex.test(dataTestId)) {
                    timeSlots.push(dataTestId);
                }
            }
            node.childNodes.forEach(function(child) {
                searchTimeSlots(child);
            });
        }

        searchTimeSlots(startingNode);
        if (Globals.getDebug()) console.log("Found time slots:", timeSlots);
        Globals.setGlobalTimeSlots(timeSlots);
        return timeSlots;
    }

    function decodeHtmlEntities(str) {
        var txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    }

    return {
        findTimeSlots: findTimeSlots,
        decodeHtmlEntities: decodeHtmlEntities
    };
})();
