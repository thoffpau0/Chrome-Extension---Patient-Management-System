# Chrome Extension - Patient Management System

## Overview

This Chrome extension is built to assist in monitoring patient data updates in a web-based patient management system. It observes key elements in the DOM, such as patient cards and time slot headers, and handles data updates, including diagnostics tracking and mutation event detection. When a patient's diagnostics are updated, the extension can trigger auditory alerts, providing real-time feedback on changes to patient information.

## Features

- **Patient Card Observers**: Monitors each patient card for additions, modifications, or deletions.
- **Time Slot Header Observer**: Detects changes in time slot headers to ensure accurate tracking of time slots.
- **Diagnostics Handling**: Searches patient nodes for diagnostics updates and processes them accordingly.
- **Auditory Alerts**: Plays a sound whenever a patient's data (such as diagnostics) is updated.
- **Real-Time DOM Monitoring**: Observes and reacts to DOM mutations in real time, using efficient mutation observers.
  
## How to Install Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/patient-management-extension.git
