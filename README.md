
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

- The extension will start monitoring the page as soon as it is loaded. 
- It checks for patient cards and time slot header changes.
- When a diagnostic number exceeds its previous value, an audio chime will play to alert the user.

## Development

1. **Make changes to the source code using any text editor like Notepad++.**

2. **Use Git for Version Control:**
   - To check the status of your changes:
     ```bash
     git status
     ```
   - To add and commit your changes:
     ```bash
     git add .
     git commit -m "Your commit message"
     ```
   - To push the changes to GitHub:
     ```bash
     git push origin master
     ```

## Publishing to Chrome Web Store

1. **Prepare for Chrome Web Store:**
   - Navigate to the project directory.
   - Zip the contents of the directory (excluding `node_modules` if present).
   
2. **Publish in the Chrome Web Store:**
   - Create a developer account on [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
   - Upload the zipped file, fill in the details, and submit it for approval.
   - You can also set the extension to "Unlisted" for private sharing.

## License Options

You can choose from the following licenses based on how you want to distribute the project:

1. **MIT License**: A permissive license that allows anyone to use, modify, and distribute the code, with attribution to you.
2. **GNU GPL v3**: Requires that any modified versions of your code are also open-source and distributed under the same license.
3. **Apache License 2.0**: Similar to MIT but provides explicit patent rights protection for contributors.

Feel free to select the license that aligns best with your goals for this project.

## Contributing

If you wish to contribute, fork the repository and create a pull request with your changes. Make sure to document any modifications thoroughly.

## Contact

For any issues or support, please open an issue on GitHub or contact the repository owner.
