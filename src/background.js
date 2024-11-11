// src/background.js

import { Globals } from './globals.js'; // Correct relative path

import { Constants, DEFAULT_MP3_FILENAME } from './constants.js'; // Adjust the path as necessary

// Initialize states from Globals
let isExtensionActive = Globals.isExtensionActive; // Initial extension state
let debug = Globals.debug; // Initial debug state

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'playTestSound',
    title: 'Play Test Sound',
    contexts: ['action'],
  });

  chrome.contextMenus.create({
    id: 'debugMenu',
    title: 'Debug',
    contexts: ['all'],
    documentUrlPatterns: ['https://app.vetradar.com/*'],
  });

  chrome.contextMenus.create({
    id: 'outputPatientList',
    parentId: 'debugMenu',
    title: 'Output Current Patient Lists to Console',
    contexts: ['all'],
    documentUrlPatterns: ['https://app.vetradar.com/*'],
  });

  chrome.contextMenus.create({
    id: 'reinitializePatientList',
    parentId: 'debugMenu',
    title: 'Reinitialize and Output Patient List',
    contexts: ['all'],
    documentUrlPatterns: ['https://app.vetradar.com/*'],
  });

  chrome.contextMenus.create({
    id: 'toggleDebug',
    parentId: 'debugMenu',
    title: 'Toggle Debug Mode',
    contexts: ['all'],
    documentUrlPatterns: ['https://app.vetradar.com/*'],
  });

  chrome.contextMenus.create({
    id: 'updatePatientData',
    parentId: 'debugMenu',
    title: 'Update Patient Data to Match Screen',
    contexts: ['all'],
    documentUrlPatterns: ['https://app.vetradar.com/*'],
  });

  chrome.contextMenus.create({
    id: 'clearPatientData',
    parentId: 'debugMenu',
    title: 'Clear Patient Data',
    contexts: ['all'],
    documentUrlPatterns: ['https://app.vetradar.com/*'],
  });

  // Retrieve the state from storage if available
  chrome.storage.local.get(['isExtensionActive', 'debug'], result => {
    if (result.isExtensionActive !== undefined) {
      Globals.isExtensionActive = result.isExtensionActive;
      isExtensionActive = result.isExtensionActive;
    }
    if (result.debug !== undefined) {
      Globals.debug = result.debug;
      debug = result.debug;
    }
    updateIcon();
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'playTestSound':
      chrome.storage.local.get(['selectedSound'], result => {
        const soundFileURL =
          result.selectedSound || chrome.runtime.getURL(DEFAULT_MP3_FILENAME);
        // Using Constants.MESSAGES
        console.log(Constants.getMessages().PLAY_TEST_CHIME);
        chrome.tabs.sendMessage(tab.id, {
          message: 'playTestChime',
          soundFile: soundFileURL,
        });
      });
      break;
    case 'toggleDebug':
      toggleDebug(tab.id);
      break;
    case 'outputPatientList':
      sendMessageToTab(tab.id, { message: 'outputPatientLists' });
      break;
    case 'reinitializePatientList':
      sendMessageToTab(tab.id, { message: 'reinitializeAndOutputPatientList' });
      break;
    case 'updatePatientData':
      sendMessageToTab(tab.id, { message: 'updatePatientData' });
      break;
    case 'clearPatientData':
      sendMessageToTab(tab.id, { message: 'clearPatientData' });
      break;
  }
});

// Toggle the extension state when the icon is clicked
chrome.action.onClicked.addListener(() => {
  toggleExtension();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ isExtensionActive: false });
  updateIcon();
  console.log('Extension set to inactive on startup.');
});

// Function to toggle the extension's active state
function toggleExtension() {
  Globals.isExtensionActive = !Globals.isExtensionActive;
  isExtensionActive = Globals.isExtensionActive;
  chrome.storage.local.set({ isExtensionActive });
  updateIcon();
  sendMessageToAllTabs({
    message: 'toggleExtensionState',
    state: isExtensionActive,
  });
  console.log('Extension is now', isExtensionActive ? 'active' : 'inactive');
}

// Update the browser action icon based on the extension state
function updateIcon() {
  const iconPath = isExtensionActive
    ? 'icons/icon48_on.png'
    : 'icons/icon48_off.png';
  chrome.action.setIcon({ path: iconPath });
}

// Function to toggle the debug mode
function toggleDebug(tabId) {
  Globals.debug = !Globals.debug;
  debug = Globals.debug;
  chrome.storage.local.set({ debug });
  sendMessageToTab(tabId, { message: 'toggleDebug', debug });
  console.log('Debug mode is now', debug ? 'enabled' : 'disabled');
}

// Send a message to a specific tab
function sendMessageToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, () => {
    if (chrome.runtime.lastError) {
      console.error(
        'Failed to send message to tab:',
        chrome.runtime.lastError.message
      );
    }
  });
}

// Send a message to all active tabs of the extension
function sendMessageToAllTabs(message) {
  chrome.tabs.query({ url: 'https://app.vetradar.com/*' }, tabs => {
    tabs.forEach(tab => sendMessageToTab(tab.id, message));
  });
}
