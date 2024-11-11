// src/content_scripts/domHandlers.js

import AudioManager from './audioManager.js'; // Adjust the path as necessary
import { Globals } from '../globals.js'; // Correct relative path
import { PatientManager } from './patientManager.js'; // Import PatientManager
import { Utilities } from './utilities.js'; // Import Utilities

const DOMHandlers = (function () {
  // Declare cachedPatientList at the top to ensure it's defined
  let cachedPatientList = null;

  // Initialize findPatientNameInChildren before it's used
  function findPatientNameInChildren(element) {
    if (element.textContent) {
      const patientNameMatch = element.textContent.match(
        /^"(.+)"(?: [A-Za-z'\s]+)?$/
      );
      if (patientNameMatch && patientNameMatch[1]) {
        let normalizedName = patientNameMatch[1]
          .replace(/['"]/g, '')
          .trim()
          .toLowerCase();
        return normalizedName;
      }
    }

    // Recursively check all child elements
    for (let child of element.children) {
      const result = findPatientNameInChildren(child);
      if (result) {
        return result; // Return the name if found
      }
    }

    return null; // No name found in this branch
  }

  function resetCachedPatientList() {
    cachedPatientList = null;
    if (Globals.getDebug()) console.log('cachedPatientList has been reset.');
  }

  function getPatientList() {
    cachedPatientList = document.querySelector(
      'div[data-testid="PatientList"]'
    );
    if (Globals.getDebug())
      console.log('Cached patient list:', cachedPatientList);
    return cachedPatientList;
  }

  function updatePatientDataToMatchScreen() {
    if (Globals.getDebug())
      console.log('Updating patient data to match screen.');
    const patientList = getPatientList();
    if (!patientList) {
      if (Globals.getDebug()) console.log('Patient list not found.');
      return;
    }

    // Use the debounced version to prevent excessive calls
    Array.from(
      patientList.querySelectorAll('div[aria-label="Patient List Item"]')
    ).forEach(function (patientCard) {
      handlePatientDataUpdate(patientCard, 'Card');
    });

    if (Globals.getDebug())
      console.log('Patient data updated to match the current screen.');
  }

  // Main function to find patient name from patient card
  function findPatientNameFromPatientCard(PatientCardNode) {
    const avatarDiv = PatientCardNode.querySelector(
      'div[aria-label="avatarWithMessage"]'
    );
    if (!avatarDiv) {
      if (Globals.getDebug())
        console.log(
          'Avatar div not found for PatientCardNode:',
          PatientCardNode
        );
      return null;
    }

    const siblings = Array.from(avatarDiv.parentElement.children).filter(
      child => child !== avatarDiv
    );

    for (let sibling of siblings) {
      // Recursively search through each sibling's children
      let normalizedName = findPatientNameInChildren(sibling);

      if (normalizedName) {
        // Check for matching patient name in PatientManager and normalize it
        for (let storedName in PatientManager.getAllPatientData()) {
          if (
            storedName.includes(normalizedName) ||
            normalizedName.includes(storedName)
          ) {
            normalizedName = storedName; // Use the more complete name
            break;
          }
        }
        return normalizedName;
      }
    }

    if (Globals.getDebug())
      console.log(
        'No valid patient name found in this Patient Card Node:',
        PatientCardNode
      );
    return null;
  }

  // Main function to find patient name from PatientInfo
  function findPatientNameFromPatientInfo(PatientInfoNode) {
    const avatarDiv = PatientInfoNode.previousSibling.querySelector(
      'div[aria-label="avatarWithMessage"]'
    );
    if (!avatarDiv) {
      if (Globals.getDebug())
        console.log(
          'Avatar div not found for PatientInfoNode:',
          PatientInfoNode
        );
      return null;
    }

    const siblings = Array.from(avatarDiv.parentElement.children).filter(
      child => child !== avatarDiv
    );

    for (let sibling of siblings) {
      // Recursively search through each sibling's children
      let normalizedName = findPatientNameInChildren(sibling);

      if (normalizedName) {
        // Check for matching patient name in PatientManager and normalize it
        for (let storedName in PatientManager.getAllPatientData()) {
          if (
            storedName.includes(normalizedName) ||
            normalizedName.includes(storedName)
          ) {
            normalizedName = storedName; // Use the more complete name
            break;
          }
        }
        return normalizedName;
      }
    }

    if (Globals.getDebug())
      console.log(
        'No valid patient name found in this Patient Info Node:',
        PatientInfoNode
      );
    return null;
  }

  // Initialize patient data with time slots
  function initializePatientData(patientName, retryCount = 0) {
    const timeSlots = Utilities.findTimeSlots();
    if (!timeSlots.length) {
      if (retryCount < 5) {
        if (Globals.getDebug())
          console.log(
            `No time slots found, retrying initialization for ${patientName} in 500ms.`
          );
        setTimeout(() => {
          initializePatientData(patientName, retryCount + 1);
        }, 500); // Retry after 500ms
      } else {
        if (Globals.getDebug())
          console.log(
            `No time slots found after retries, skipping initialization for ${patientName}.`
          );
      }
      return;
    }
    if (Globals.getDebug())
      console.log(
        `Initializing patient data for ${patientName} with time slots:`,
        timeSlots
      );
    const initialData = {
      criticalNotes: null,
      missed: null,
      due: null,
      timeSlots: {},
    };
    timeSlots.forEach(time => {
      if (!initialData.timeSlots[time]) {
        initialData.timeSlots[time] = { diagnostics: 0 };
      }
    });
    PatientManager.updatePatientData(patientName, initialData);
  }

  function findCriticalNotesNode(patientBar) {
    const searchNodes = node => {
      // Check if the current node has the desired aria-label attribute
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.getAttribute('aria-label') === 'Critical Notes'
      ) {
        return node; // Return the node if found
      }

      // Recursively search through all child nodes
      for (let child of node.children) {
        const result = searchNodes(child);
        if (result) return result; // Return the result if found in any child node
      }

      return null; // Return null if the node is not found
    };

    // Start searching from the given parent node
    return searchNodes(patientBar);
  }

  // Function to recursively search for a node with aria-label="Patient List Item"
  function findPatientListItemNode(parentNode) {
    const searchNodes = node => {
      // Check if the current node has the desired aria-label attribute
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.getAttribute('aria-label') === 'Patient List Item'
      ) {
        return node; // Return the node if found
      }

      // Recursively search through all child nodes
      for (let child of node.children) {
        const result = searchNodes(child);
        if (result) return result; // Return the result if found in any child node
      }

      return null; // Return null if the node is not found
    };

    // Start searching from the given parent node
    return searchNodes(parentNode);
  }

  // Handle updates to patient data
  function handlePatientDataUpdate(node, nodeType) {
    let patientName;

    if (nodeType === 'Card') {
      // Find patient name from card node
      patientName = findPatientNameFromPatientCard(node);
    } else if (nodeType === 'Info') {
      // Find patient name from info node
      patientName = findPatientNameFromPatientInfo(node);
    }
    if (!patientName) {
      console.error('Patient name not found.');
      return;
    }

    // Initialize the patient if not present in the data
    if (!PatientManager.getPatientData(patientName)) {
      initializePatientData(patientName); // Initialize with time slots
    }

    // Find the Patient List Item node by recursively searching the sibling's children
    const patientListItemNode = findPatientListItemNode(node);
    if (!patientListItemNode) {
      if (Globals.getDebug()) console.log('Patient List Item node not found.');
      return;
    }

    // The patient bar is the next sibling of the Patient List Item node
    const patientBar = patientListItemNode.nextElementSibling;
    if (!patientBar) {
      if (Globals.getDebug())
        console.log(`Patient bar not found for node:`, node);
      return;
    }

    // Find the Critical Notes node
    const criticalNotesNode = findCriticalNotesNode(patientBar);
    if (!criticalNotesNode) {
      if (Globals.getDebug()) console.log('Critical notes node not found.');
      return;
    }

    // Find the siblings: missed, due, and time slots
    const missedNode = criticalNotesNode.nextElementSibling;
    const dueNode = missedNode?.nextElementSibling;

    if (!missedNode || !dueNode) {
      if (Globals.getDebug()) console.log('Missed or Due nodes not found.');
      return;
    }

    // Process diagnostics for criticalNotes, missed, due fields
    updateDiagnosticsCountForNode(
      patientName,
      'criticalNotes',
      criticalNotesNode
    );
    updateDiagnosticsCountForNode(patientName, 'missed', missedNode);
    updateDiagnosticsCountForNode(patientName, 'due', dueNode);

    // Process time slots starting from the next sibling of dueNode
    let timeSlotNode = dueNode.nextElementSibling; // First time slot is the sibling of dueNode

    let timeSlotIndex = 0; // Index in the timeSlots array

    while (timeSlotNode) {
      // Update the diagnostics count for the current time slot using the index
      updateDiagnosticsCountForNode(
        patientName,
        `timeSlots.${timeSlotIndex}`,
        timeSlotNode
      );

      timeSlotNode = timeSlotNode.nextElementSibling; // Move to the next sibling
      timeSlotIndex++; // Increment the index for the next time slot
    }

    if (Globals.getDebug())
      console.log(`Updated patient data for ${patientName}`);
  }

  // Function to update diagnostics count for a specific node
  function updateDiagnosticsCountForNode(patientName, category, node) {
    // Search the node for any diagnostics tasks
    const foundDiagnostics = searchForDiagnostics(node);

    // Retrieve current patient data
    const currentData = PatientManager.getPatientData(patientName);

    // Variable to hold the current diagnostics count
    let currentDiagnosticsCount = 0;

    let diagnosticsCount;

    // Check if this is a time slot or a field (criticalNotes, missed, due)
    if (category.startsWith('timeSlots.')) {
      const timeSlotIndex = category.split('.')[1];
      const globalTimeSlots = Globals.getGlobalTimeSlots();

      // Use the index to access the correct time slot in the timeSlots array
      const timeSlotKey = globalTimeSlots[timeSlotIndex]; // Preserve the order
      if (!timeSlotKey) {
        if (Globals.getDebug())
          console.log(
            `Time slot key ${timeSlotIndex} not found in globalTimeSlots`
          );
        return; // Exit early if the time slot is not found
      }

      // Get the current diagnostics count for this time slot
      currentDiagnosticsCount =
        currentData.timeSlots[timeSlotKey]?.diagnostics || 0;

      if (typeof foundDiagnostics === 'number') {
        // Compare the found diagnostics number to the current data
        diagnosticsCount = foundDiagnostics;
        if (foundDiagnostics > currentDiagnosticsCount) {
          // Play the chime if the found number is larger than the current data
          AudioManager.playChime();
        }
      } else {
        // Reset diagnostics count to 0 if no diagnostics are found
        diagnosticsCount = 0;
      }

      // Update patient data for the specific time slot
      PatientManager.updatePatientData(
        patientName,
        `timeSlots.${timeSlotKey}`,
        { diagnostics: diagnosticsCount }
      );
    } else {
      // If it's criticalNotes, missed, or due, we can store diagnostics count directly in the field
      currentDiagnosticsCount = currentData[category]?.diagnostics || 0;

      if (typeof foundDiagnostics === 'number') {
        diagnosticsCount = foundDiagnostics;
        if (foundDiagnostics > currentDiagnosticsCount) {
          AudioManager.playChime();
        }
      } else {
        diagnosticsCount = 0;
      }

      // Update patient data for criticalNotes, missed, or due
      PatientManager.updatePatientData(patientName, category, {
        diagnostics: diagnosticsCount,
      });
    }

    if (Globals.getDebug())
      console.log(`Diagnostics updated for ${category}:`, diagnosticsCount);
  }

  function searchForDiagnostics(node) {
    let diagnosticsNumber = null; // Declare diagnosticsNumber with let

    // Helper function to search recursively for diagnostics in child nodes
    const searchChildrenForDiagnostics = parentNode => {
      for (let child of parentNode.children) {
        const result = searchForDiagnostics(child); // Recursively search children
        if (result) return result; // Return if diagnostics node is found
      }
      return false; // No diagnostics node found in children
    };

    // Helper function to find diagnostics number in previous siblings
    const visitedNodes = new Set();

    const findDiagnosticsNumber = sibling => {
      if (!sibling || visitedNodes.has(sibling)) return null;
      visitedNodes.add(sibling);

      // Check if sibling's textContent is numeric
      const numericContent = sibling.textContent.trim();
      if (/^\d+$/.test(numericContent)) {
        return parseInt(numericContent, 10); // Return the number as an integer
      }

      // Recursively search the children of the sibling
      for (let child of sibling.children) {
        const result = findDiagnosticsNumber(child);
        if (result !== null) return result; // If found, return the number
      }

      // Continue searching the previous sibling if number not found in children
      return findDiagnosticsNumber(sibling.previousElementSibling);
    };

    // Check if the current node itself has 'data-testId="Diagnostics"'
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      node.getAttribute('data-testId') === 'Diagnostics'
    ) {
      // Look for the diagnostic number in the previous sibling
      diagnosticsNumber = findDiagnosticsNumber(node.previousElementSibling);

      if (diagnosticsNumber !== null) {
        return diagnosticsNumber; // Return found diagnostics number
      }

      return true; // Diagnostics found but no numeric sibling
    }

    // If the current node has children, search the children recursively
    if (node.children && node.children.length > 0) {
      return searchChildrenForDiagnostics(node); // Recursively search children
    }

    // If the node has no children, check the node itself for 'data-testId="Diagnostics"'
    let sibling = node;
    while (sibling) {
      if (
        sibling.nodeType === Node.ELEMENT_NODE &&
        sibling.getAttribute('data-testId') === 'Diagnostics'
      ) {
        // Found diagnostics, now look for the number in the previous sibling
        const diagnosticsNumber = findDiagnosticsNumber(
          sibling.previousElementSibling
        );

        if (diagnosticsNumber !== null) {
          return diagnosticsNumber; // Return found diagnostics number
        }

        return 1; // Diagnostics node found, no number available
      }

      // If the sibling has children, search within its children
      if (sibling.children && sibling.children.length > 0) {
        const result = searchChildrenForDiagnostics(sibling);
        if (result) return result; // Return result if diagnostics node is found
      }

      // Move to the next sibling and repeat the process
      sibling = sibling.nextElementSibling;
    }

    return 0; // Return 0 if no diagnostics node found
  }

  // Function to wait for the target node to be added to the DOM
  function waitForTargetNode() {
    if (Globals.getDebug())
      console.log('Waiting for target node to be added to the DOM.');

    // Options for the observer (which mutations to observe)
    const config = {
      childList: true,
      subtree: true,
    };

    // Callback function to execute when mutations are observed
    const callback = function (mutationsList, observer) {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          const targetNode = document.querySelector(
            'div[data-testid="PatientList"]'
          );
          const timeSlots = Utilities.findTimeSlots();
          if (targetNode && timeSlots.length > 0) {
            if (Globals.getDebug()) {
              console.log('Target node and time slots found:', targetNode);
              console.log('Time slots:', timeSlots);
            }
            // Set up the main mutation observer on the PatientList node
            setupPatientListObserver(targetNode);
            setupHeaderObserver();

            if (Globals.getDebug()) console.log('Observers set up.');

            // Optionally, disconnect the observer since we've found the target node
            observer.disconnect();
            if (Globals.getDebug())
              console.log(
                'Disconnected observer waiting for target node and time slots.'
              );
            break; // Exit the loop since we've found the target node and time slots
          }
        }
      }
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);

    // Start observing the document body for configured mutations
    observer.observe(document.body, config);
  }

  function setupPatientListObserver(patientListNode) {
    //const patientListNode = document.querySelector('div[data-testid="PatientList"]');
    if (!patientListNode) {
      console.warn('PatientList node not found.');
      return;
    }

    console.log('Setting up patient list observer on:', patientListNode);

    const config = {
      childList: true, // observe direct children
      subtree: true, // observe mutations in all descendants
      //attributes: true, // observe attribute changes
      characterData: true, // observe text changes
    };

    const observer = new MutationObserver(handlePatientListMutations);
    observer.observe(patientListNode, config);

    console.log('Patient list observer set up with config:', config);

    // Process existing patient cards
    const existingPatientInfos = findPatientInfoNodesInNode(patientListNode);

    existingPatientInfos.forEach(patientInfoNode => {
      console.log('Processing existing patient Info Node:', patientInfoNode);
      setupPatientInfoObserver(patientInfoNode);
      handlePatientDataUpdate(patientInfoNode, 'Info');
    });
  }

  function handlePatientListMutations(mutationsList) {
    console.log(
      'handlePatientListMutations called with mutations:',
      mutationsList
    );

    for (const mutation of mutationsList) {
      updatePatientDataToMatchScreen();
      if (mutation.type === 'childList') {
        // Handle added patient info
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Search for patient info within the added node
            const patientInfoNodes = findPatientInfoNodesInNode(node);

            if (patientInfoNodes.length > 0) {
              patientInfoNodes.forEach(patientInfoNode => {
                console.log('Patient info added:', patientInfoNode);
                // Set up observer on the new patient info
                setupPatientInfoObserver(patientInfoNode);
                // After setting up the observer on the new patient info
                handlePatientDataUpdate(patientInfoNode, 'Info');
              });
            } else if (
              node.innerText &&
              node.innerText.includes('CriticalNotes')
            ) {
              console.log('Header Row element added, skipping:', node);
            } else {
              console.log('Non-patient element added, skipping:', node);
            }
          }
        });

        // Handle removed patient cards
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const PatientInfos = findPatientInfoNodesInNode(node);
            if (PatientInfos.length > 0) {
              PatientInfos.forEach(patientInfoNode => {
                console.log('Patient info removed:', patientInfoNode);

                // Disconnect the observer on the removed patient info
                if (patientInfoNode.__observer) {
                  patientInfoNode.__observer.disconnect();
                  delete patientInfoNode.__observer;
                  console.log(
                    'Observer disconnected for patient info:',
                    patientInfoNode
                  );
                }
              }); // Added closing parenthesis and semicolon here
            } else {
              console.log('Non-patient element removed, skipping:', node); // Fixed console message
            }
          }
        });
      } else if (mutation.type === 'attributes') {
        console.log('Attribute mutation detected on:', mutation.target);
        // Handle attribute mutations if necessary
      } else if (mutation.type === 'characterData') {
        console.log('Character data mutation detected on:', mutation.target);
        // Handle character data mutations if necessary
      } else {
        console.log('Unhandled mutation type:', mutation.type);
      }
    }
  }

  function setupPatientInfoObserver(PatientInfoNode) {
    // Check if the node has children; ignore if it doesn't
    if (!PatientInfoNode.hasChildNodes()) {
      return;
    }

    // Avoid setting up an observer if one already exists
    if (PatientInfoNode.children[0].children[5].__observer) {
      console.log(
        'Observer already exists for patient card:',
        PatientInfoNode.children[0].children[5]
      );
      return;
    }

    console.log(
      'Setting up observer on patient Info:',
      PatientInfoNode.children[0].children[5]
    );

    const config = {
      childList: true,
      subtree: true, // Observe changes within the patient Info
    };

    const observer = new MutationObserver(handlePatientInfoMutations);
    observer.observe(PatientInfoNode.children[0].children[5], config);

    // Store the observer if you need to disconnect it later
    PatientInfoNode.children[0].children[5].__observer = observer;

    console.log('Patient Info observer set up with config:', config);
  }

  function handlePatientInfoMutations(mutationsList) {
    console.log(
      'handlePatientInfoMutations called with mutations:',
      mutationsList
    );
    for (const mutation of mutationsList) {
      updatePatientDataToMatchScreen();
      if (mutation.type === 'childList') {
        // Handle added nodes
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if a diagnostics node was added
            if (
              node.getAttribute('data-testid') === 'Diagnostics' ||
              node.querySelector('[data-testid="Diagnostics"]')
            ) {
              console.log('Diagnostics node added:', node);
              // Handle the added diagnostics node
              handleDiagnosticsAddition(node, 'Info');
            }
          }
        });

        // Handle removed patient Info
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (
              node.getAttribute('data-testid') === 'Diagnostics' ||
              node.querySelector('[data-testid="Diagnostics"]')
            ) {
              console.log('Diagnostics Node removed:', node);
              handleDiagnosticsRemoval(node);
            } else {
              console.log('Non-Diagnostics Node removed:', node);
              handleDiagnosticsRemoval(node);
            }
          }
        });
      }
    }
  }

  function handleDiagnosticsRemoval(node) {
    console.log('Handling diagnostics node removal:', node);
    handlePatientDataUpdate(node);
  }

  function handleDiagnosticsAddition(node) {
    console.log('Handling diagnostics node addition:', node);
    handlePatientDataUpdate(node);
  }

  function setupHeaderObserver() {
    const patientListNode = document.querySelector(
      'div[data-testid="PatientList"]'
    );
    if (
      !patientListNode ||
      !patientListNode.firstElementChild ||
      !patientListNode.firstElementChild.firstElementChild
    ) {
      console.warn('Header node not found.');
      return;
    }

    const headerNode = patientListNode.firstElementChild.firstElementChild;
    const config = {
      childList: true,
      characterData: true,
      subtree: true,
    };

    const observer = new MutationObserver(handleHeaderMutations);
    observer.observe(headerNode, config);
  }

  function handleHeaderMutations(mutationsList) {
    for (const mutation of mutationsList) {
      console.log('Header mutation detected:', mutation);
      // Re-fetch and update global time slots
      const timeSlots = Utilities.findTimeSlots();
      Globals.setGlobalTimeSlots(timeSlots);
      console.log('Updated global time slots:', timeSlots);
    }
  }

  function findPatientInfoNodesInNode(node) {
    let patientInfoNodes = [];

    // Recursive function to search for PatientListCard nodes
    function searchForPatientInfo(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      // Check if the node is a PatientListCard
      if (
        node.getAttribute &&
        node.getAttribute('data-testid') &&
        node.getAttribute('data-testid').startsWith('PatientListCard_')
      ) {
        // Assuming the patient info node is the second child
        const patientInfoNode = node.children[1]; // Adjust index if needed
        if (patientInfoNode) {
          patientInfoNodes.push(patientInfoNode);
        } else {
          console.warn('Patient info node not found in PatientListCard:', node);
        }
      }

      // Recursively search through child nodes
      for (let i = 0; i < node.childNodes.length; i++) {
        searchForPatientInfo(node.childNodes[i]);
      }
    }

    // Start the recursive search from the input node
    searchForPatientInfo(node);

    return patientInfoNodes;
  }

  // Expose functions
  return {
    resetCachedPatientList,
    waitForTargetNode,
    getPatientList,
    updatePatientDataToMatchScreen,
    //setupMutationObserver,
  };
})();

// Export DOMHandlers for use in other modules if needed
export { DOMHandlers };
