import { Globals } from '../globals.js';
import { DOMHandlers } from './domHandlers.js';
// Import other content scripts as needed

(function () {
  // Initialization code
  if (Globals.getDebug()) console.log('Extension script loaded.');

  // Set up the mutation observer to wait for the target node
  try {
    DOMHandlers.waitForTargetNode();
    if (Globals.getDebug()) console.log('Waiting for target node.');
  } catch (error) {
    console.error('Error setting up mutation observer for target node:', error);
  }

  // Additional global initializations can go here
})();
