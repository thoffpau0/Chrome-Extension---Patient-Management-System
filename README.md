# Vet Radar Notification — Chrome Extension

A Chrome extension for [VetRadar](https://app.vetradar.com) that monitors the patient board in real time and plays configurable audio chimes so your clinic team never misses a critical update.

## Features

- **Patient Added** — chime plays when a new patient appears on the board
- **Patient Removed** — chime plays when a patient is discharged or removed
- **New Task** — chime plays when a task is assigned to any patient
- **Task Completed** — chime plays when a task is marked done
- **Amber "muted" state** — when Chrome's autoplay policy blocks sound (e.g. after navigating into a patient record and returning), the widget turns amber with a missed-chime badge counter so staff know to click the page to re-enable sound
- **Four independent sound channels** — each with its own sound selection, volume, and enable/disable toggle
- **Custom audio** — upload your own MP3 for any channel via drag-and-drop

## Widget States

| Colour | Meaning |
|--------|---------|
| **Green** | Active — monitoring and sound enabled |
| **Amber** (pulsing) | Active — monitoring but sound is paused; badge shows missed chime count; click anywhere on the page to re-enable |
| **Red** (inactive) | Not monitoring — click widget to start |
| **Red** (pulsing) | Error — PatientList not found or repeated failures; click to retry |

## Folder Structure

```
Chrome-Extension---Patient-Management-System/
├── Audio/                  # MP3 sound files
├── graphic assets/         # Extension icons and store graphics
├── background.js           # Service worker — badge/icon management
├── manifest.json           # Extension manifest (MV3)
├── monitor.js              # Content script — all monitoring logic
├── options.html            # Settings page UI
├── options.js              # Settings page logic
└── privacy-policy.html
```

## Installation (Developer / Unpacked)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle, top right)
4. Click **Load unpacked** and select the project folder
5. Navigate to `https://app.vetradar.com` — the widget appears bottom-right

## Usage

1. **Start monitoring** — click the widget (bottom-right corner of VetRadar). It turns green when active.
2. **Sound blocked?** — if the widget turns amber after a page navigation, click anywhere on the VetRadar tab to re-enable audio. The badge shows how many chimes were missed.
3. **Stop monitoring** — click the green widget.
4. **Configure sounds** — right-click the extension icon → **Options**, or go to `chrome://extensions` → Details → Extension options.

## Options

- **Master volume** — scales all channels simultaneously
- **Per-channel controls** — enable/disable toggle, sound selection (6 built-in sounds), individual volume slider, drag-and-drop custom MP3
- **Reset** button per channel restores that channel's default sound and volume
- **Restore All Defaults** resets every channel at once

## Sound Files (built-in)

| File | Default use |
|------|------------|
| `BuddyIn.mp3` | Patient Added |
| `Goodbye.mp3` | Patient Removed |
| `3_tone_chime-99718.mp3` | New Task (Exam Room Notification) |
| `mixkit-bell-notification-933.mp3` | Task Completed |
| `simple-notification-152054.mp3` | — (selectable) |
| `mixkit-doorbell-single-press-333.mp3` | — (selectable) |

## Diagnostics

Open Chrome DevTools on the VetRadar tab and run:

```js
// Status summary
window.dispatchEvent(new CustomEvent('vr-mon-cmd', {detail:{cmd:'status'}}))

// Last 50 log entries
window.dispatchEvent(new CustomEvent('vr-mon-cmd', {detail:{cmd:'logs'}}))

// Copy full diagnostic report to clipboard
window.dispatchEvent(new CustomEvent('vr-mon-cmd', {detail:{cmd:'report'}}))
```

## Requirements

- Google Chrome (or Chromium-based browser)
- Active VetRadar account at `app.vetradar.com`
- MP3 files must be under 1 MB for best performance if using custom audio

## Contributing

Fork the repository and open a pull request. Document any changes to the DOM selectors if VetRadar's front-end updates affect detection logic.

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
