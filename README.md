# Storyline Prompt Editor

[![Bekijk de demo op YouTube](https://img.youtube.com/vi/gxHS0iwoO0U/0.jpg)](https://youtu.be/gxHS0iwoO0U?si=gFUd9JmBjGY3Wzks)

This project is a browser-based workspace for crafting video LLM prompts while steadily tracking the entire storyline of your production. It was built to make it easy to manage prompts, starter/ending images, translations, and project notes in one place and to carry that context across machines.

![Storyline Prompt Editor Screenshot](docs/images/screenshot.png)

## Why this tool?

I first created this editor as a handy companion while producing video prompts for generative models. I wanted a smooth way to:

- Keep start and end reference images together with the text prompts.
- See the entire storyline from scene to scene without losing the big picture.
- Store English prompts alongside Dutch translations for quick hand-off or localisation.
- Export image sequences and prompt scripts per project so nothing gets lost.

## Highlights

- **Project explorer** – create, open, and sort storyline projects with automatic last-modified tracking.
- **Scene board** – drag scenes horizontally, reorder via drag handles, edit prompts in-place, or open a fullscreen dialog for focused editing.
- **Image workflow** – drop or upload images per scene, export all images as numbered files, and preview large versions instantly.
- **Prompt exports** – review prompts in a dialog, copy them to the clipboard, and save a text file in the project folder in one step.
- **Browser storage** – remembers your chosen project directory between sessions (using the browser’s File System Access API).
- **Bilingual UI** – switch between Dutch and English labels from the header.
- **Portable by design** – everything lives inside a single `storylineprompteditor` folder that you can copy to another machine.

## Project layout

```
storylineprompteditor/
├─ assets/
│  ├─ css/
│  │  └─ style.css           # Global styling
│  └─ js/
│     ├─ app.js              # Main application logic
│     └─ translations.js     # Locale definitions (NL/EN)
├─ server.sh                 # Helper script to start/stop a local dev server
├─ index.html                # Application entry point
├─ README.md                 # English documentation (this file)
└─ README.nl.md              # Dutch documentation
```

## Getting started

1. **Install requirements**  
   You only need Python 3 (or any static file server). Nothing else is required.

2. **Launch the local server**

   ```bash
   ./server.sh start
   ```

   - Default address: `http://localhost:8123/opdracht/storylineprompteditor/`
   - `./server.sh status` shows the running PID.
   - `./server.sh stop` terminates the server.

3. **Open the editor**  
   Use Chrome or Edge. Click “📁 Choose project folder” and select a writable directory. The tool will create:
   - `projecten/` containing JSON data + images per project
   - `index.json` with the global project list

4. **Create or open projects**  
   Once a root folder is selected, you can add projects, manage scenes, upload images, and export prompts.

## Browser support

- Requires a secure context (`http://localhost`) and the File System Access API.  
- Chrome ≥ 86 and Edge (Chromium) are supported. Safari/Firefox currently lack the APIs needed for full functionality.

## Contributing & notes

- No build step is required; everything is native HTML/CSS/JS.
- If you copy this folder to another machine, just run `./server.sh start` and continue working.
- Feel free to extend `assets/js/translations.js` with additional languages or tweak styles in `assets/css/style.css`.

---

Built to keep video prompt workflows focused, organised, and portable—enjoy crafting your next storyline!

