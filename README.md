
# Patient Data Monitoring Chrome Extension

## Description

A custom Chrome extension designed to monitor real-time updates to patient data in a web-based system. The extension tracks changes to patient cards, time slot headers, and diagnostics, providing auditory alerts for critical updates. It efficiently handles DOM mutations by using modular MutationObservers for patient cards and time slot headers.

## Features

- Observes changes in patient cards and time slot headers.
- Plays a chime when diagnostics updates exceed current values.
- Dynamically manages time slots and patient diagnostics data.
- Real-time mutation observation with efficient event handling.
- Modular design for handling individual DOM components.

## Installation

1. **Clone the Repository:**

   Open a terminal and run the following command to clone the repository:
   
   ```bash
   git clone https://github.com/your-username/patient-data-monitor.git
   ```

2. **Navigate to the Project Directory:**

   ```bash
   cd patient-data-monitor
   ```

3. **Load the Extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable "Developer mode" by toggling the switch at the top right.
   - Click "Load unpacked" and select the project directory.

4. **Test the Extension:**
   - Open a web page that contains the patient list interface.
   - Make sure the console is open (`Ctrl + Shift + J`).
   - Changes to the patient list and diagnostics should trigger console logs and a chime.

## Usage

   How to Use the Extension
      This guide walks through how to install, configure, and use the Chrome extension for monitoring patient data updates, including managing audio alerts and configuration options.
   
   Requirements
   
      Supported Browsers: Chrome (Other Chromium-based browsers may also work, but Chrome is recommended).
      Audio Files: You can select an audio chime for alerts. The extension only supports .mp3 format for the audio files.
      
   Features
   
      Monitoring Patient Data: The extension tracks changes in the patient list and time slots, displaying real-time updates. Alerts are generated when certain conditions are met, such as diagnostic changes.
      Customizable Audio Alerts: You can customize the sound played when a diagnostic alert is triggered.
      Persistent Patient Data Management: Patient data is stored and updated in the background with options to clear or export this data at any time.
      
   Icon States
   
      Idle/Gray: The extension is installed but not actively monitoring anything. No data is being tracked, and no alerts will trigger.
      Active/Green: The extension is actively monitoring patient list data. Any changes to time slots or diagnostics will be tracked and potentially trigger alerts.
      Error/Red: There has been an issue, such as the Patient List not being detected or an error when loading audio alerts. The extension is unable to monitor correctly and may require attention.
      Debug Mode/Blue: If the extension is running in debug mode, you’ll see additional logs in the Chrome Developer Tools Console. This mode is for troubleshooting and diagnostics.
      
   Options Available
   
   1. Audio Alert Configuration
         Select a Chime: The extension allows you to select an .mp3 file to use as the chime for alerts. By default, it uses an included sound file, but you can upload your own audio file.
         Supported format: .mp3 only
      
         Ensure your file is under 1 MB for optimal performance.
      
         How to upload:
            Go to the extension settings.
            Click on "Choose Chime".
            Select the .mp3 file from your local directory.
      
   2. Debug Mode
         Toggle this option to enable/disable debug mode. When debug mode is active, the console will output detailed logs about patient data changes, mutations in the DOM, and diagnostic checks.
         This can help when troubleshooting or during development to ensure the extension is working as expected.
         It also outputs errors, warnings, and detailed steps for each mutation observed in the patient list.
      
   4. Reset Patient Data
         This option allows you to clear all stored patient data.
         It will reset diagnostics counts and clear any cached information about time slots or patient data.
         *Warning*: This action is irreversible once executed.

   Usage Instructions
   
      Install the Extension: 
         Follow the instructions in the "Installation" section.
         
      Monitor Patients:
         Open your web application where the patient list is displayed.
         The extension will automatically detect the "Patient List" and start monitoring for changes.
         You will see the icon change to green when the extension is actively tracking.
         
      Configure Chime (Optional):
         Go to the extension options.
         Upload your own .mp3 sound file if you prefer a custom sound for alerts.
         
      Check Alerts:
         Alerts are triggered when diagnostics numbers are updated in real-time.
         The extension will play the selected sound if a diagnostic alert condition is met (e.g., a diagnostic number increases).
         
      Troubleshooting:
         If the icon turns red, open the Chrome Developer Console (Ctrl + Shift + I or Cmd + Option + I on Mac) and check for error logs under the "Console" tab.
         Use debug mode to output more verbose logs about the extension’s internal state.
   Limitations
      The extension only supports patient lists that use a structured DOM with consistent data-testid attributes for detecting patient cards and time slots.
      Currently, only .mp3 files are supported for chime sounds. Other formats (like .wav or .ogg) will not work.
## Contributing

If you wish to contribute, fork the repository and create a pull request with your changes. Make sure to document any modifications thoroughly.

## Contact

For any issues or support, please open an issue on GitHub or contact the repository owner.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](./LICENSE) file for more information.
