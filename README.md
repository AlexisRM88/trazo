# Trazo — Technical Screenshot for Google Chrome

[🇪🇸 Leer en Español](README.es.md)

> Minimalist **Manifest V3** Chrome extension built for **one-handed (mouse-only)** technical screenshots.  
> An open-source contribution by **Cabuya Creativa** & **Alexis Roman**.

---

## Key Features

- **Automatic Bilingual Support (EN / ES)**: Automatically adapts to your Chrome browser language via `chrome.i18n` (`_locales/en` & `_locales/es`).
- **One-Handed Operation (Mouse Only)**: Activate with one click on the extension icon and control everything without touching the keyboard.
- **`Element` Mode (Natural Scroll + Pin & Zoom)**:
  - Scroll any webpage naturally with your mouse wheel or trackpad.
  - **1st click** on any element to **pin** it and open the floating micro-bar (`Parent` / `Capture` / `Child`).
  - Use the mouse wheel or `Parent` / `Child` buttons to zoom out/in across the DOM tree until you highlight the exact container.
  - **2nd click** directly on the pinned element to capture immediately.
- **`Area` Mode (Free Rectangle)**:
  - Supports both **click-and-drag** and **two-click** selection (start corner → end corner).
- **`Page` Mode (Current View or Full Page)**:
  - Choose between capturing **Current view only** or **Full page (scroll & stitch)** in a single high-DPI PNG, automatically hiding `fixed`/`sticky` headers after the first slice to prevent duplicates.
- **Optional Technical Badge (`Info: ON / OFF`)**:
  - **ON**: Shows the live CSS selector (`tag#id.class`) and dimensions (`px`), and stamps a clean technical footer bar at the bottom of the captured PNG.
  - **OFF**: Outputs 100% clean screenshots with no labels.
- **Auto-Copy + Local History (`IndexedDB`)**:
  - Every screenshot is automatically copied to your clipboard (`image/png`) and saved locally in `IndexedDB` with a built-in gallery to re-copy, download as PNG, or delete items.
- **Right-click shortcut**: Unpin the active element, cancel a rectangle, or close **Trazo** effortlessly.

---

## How to Get & Install Trazo in Google Chrome

### Option 1: Download ZIP from GitHub (Fastest)
1. Click the green **`<> Code`** button in this repository → **`Download ZIP`**.
2. Unzip the file into a permanent folder on your computer (e.g. `Documents/Trazo`).

### Option 2: Clone with Git
```bash
git clone https://github.com/AlexisRM88/trazo.git
```

### Load the Extension in Google Chrome
1. Open a new tab in Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the project folder (`trazo`).
5. *(Recommended)* Click the **Extensions (puzzle)** icon in Chrome's toolbar and pin **Trazo** for 1-click access.

---

## How to Use Trazo

1. Open any webpage and click the **Trazo** icon in your Chrome toolbar.
2. Pick a mode from the floating bottom HUD:
   - **`Element`**: Hover, click to pin a block, adjust `Parent` / `Child` if needed, and click **`Capture`** (or click the pinned block again).
   - **`Area`**: Draw a free rectangle over any part of the screen.
   - **`Page`**: Choose **Current view only** or **Full page (scroll & stitch)**.
3. Paste directly (`Cmd + V` / `Ctrl + V`) into Slack, Notion, Figma, Jira, or browse saved shots in **`History`**.

---

## Project Structure

```text
├── _locales/
│   ├── en/messages.json   # English localization
│   └── es/messages.json   # Spanish localization
├── manifest.json          # Manifest V3 configuration
├── background.js          # Service Worker (injection, captureVisibleTab & messaging)
├── storage.js             # IndexedDB local persistence
├── content.js             # Shadow DOM HUD, DOM inspector, cropper & full-page stitch
├── content.css            # Encapsulated UI styles
└── icons/                 # Extension PNG icons (16, 32, 48, 128 px)
```

---

## License & Credits

Released under the **MIT License** — see [LICENSE](LICENSE).  
Built and shared with the community by **Cabuya Creativa** & **Alexis Roman**.
