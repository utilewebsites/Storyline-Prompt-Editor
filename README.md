
# Storyline Prompt Editor

[![Bekijk de demo op YouTube](https://img.youtube.com/vi/gxHS0iwoO0U/0.jpg)](https://youtu.be/gxHS0iwoO0U?si=gFUd9JmBjGY3Wzks)

This project is a browser-based workspace for crafting video LLM prompts while steadily tracking the entire storyline of your production. It was built to make it easy to manage prompts, starter/ending images, translations, and project notes in one place and to carry that context across machines.

![Storyline Prompt Editor Screenshot](docs/images/screenshot.png)

## update — 16 November 2025

Given our workflows at playanote.nl, where videos are often built from an audio file, we've added a dedicated editor to quickly set up a storyline. You can load an audio file and link scenes to it, allowing you to easily create storyboards for both greenscreen shoots and prompts for an AI video server. This significantly speeds up production and is useful for teams and creators using an audio-based 4.0 video workflow.

Want to try the tool immediately without installation? Email us via one of our platforms and we'll send you a URL (and login) so you can get started right away.

Privacy and security: the editor runs entirely locally using the File System Access API (in Chrome) — no project files are uploaded to or stored on our servers. All data remains in the folder on your computer.

**Code Refactoring & Optimization:**
- **Modular architecture**: app.js split into 25 ES6 modules for improved maintainability and clarity
- **UI minimization**: toggle buttons to minimize the header, sidebar, and project header for maximum workspace

![Storyline Prompt Editor Screenshot](docs/images/minimal.png)

- **Audio timeline improvements**: scenes without media can now be linked to audio markers; orphaned markers are automatically cleaned up
- **Bug fixes**: rating synchronization between card and dialog; scene-marker consistency on deletion; duplicate marker warnings removed

**Professional Audio/Video Timeline Editor:**
- **Fullscreen editor**: new Final Cut Pro–like interface with a large waveform, preview canvas, and timeline scrubbing for professional audio/video editing.
- **GPU-accelerated playhead**: smooth audio scrubbing with instant visual feedback. Music pauses during scrubbing and resumes at the new position on release.
- **Per-scene media type**: choose between image (🖼️) or video (🎬) for each scene with a real-time preview canvas. Videos play automatically synchronized with the audio.
- **Draggable markers**: drag markers on the waveform to new positions—scenes are automatically re-sorted by timestamp.
- **Link inactive scenes**: scenes without a marker are shown as "Inactive scenes" with a 🔗 button. Click, place a marker on the waveform, and the scene becomes active and linked.
- **Confirmation dialog**: when placing a new marker, a popup asks whether you want to automatically create a new scene.

**Scene Transition Editor:**
- **Transition descriptions**: ➕ buttons between scenes open a dialog to describe transition effects (cross-fade, cut, pan, zoom, etc.).
- **Save per project**: transition data is stored in the project JSON and exported with prompts.
- **Visual indicators**: transition buttons show a green indicator (●) when a description is set.

**Bilingual interface**: all new features fully translated (Dutch/English) using data-i18n attributes.

**Attachments**: You can now add up to 8 attachments per scene, including images, videos, audio files, and text files.

> **Note:** Many thanks to **Jan Brosens** for the valuable feedback during development and testing of the storyline editor.

![Audio Timeline Editor](docs/images/editor-audio-preview.png) ![Audio Presentation Mode](docs/images/transitie.png) ![Scene Dialog](docs/images/attachements.png)


## 15 November 2025

This release adds audio timeline functionality and a context-sensitive help system:

**Audio Timeline for time-based production:**
- **Audio Timeline mode**: upload an audio file (MP3/WAV) and place markers on the waveform to automatically link scenes to specific timestamps. Ideal for music videos, voice-overs, and sound effects.
- **Automatic scene synchronization**: markers determine the order and timing of scenes. Drag a marker to adjust a scene’s timing—scenes are automatically reordered based on their position in the audio.
- **Audio presentation mode**: preview your project with synchronized audio playback. Scenes switch automatically at the correct moments while the audio plays.
- **Visual marker editing**: edit marker times with a styled dialog (MM:SS.ms format), attach existing scenes to markers via a "➕" button, and see immediately which scenes are already linked.

**Contextual help system:**
- **"?" Help icons**: click the question-mark icons next to input fields and buttons for immediate explanations of functionality.
- **Info badge**: a red "!" badge on the Audio Timeline button explains how markers determine scene order—click it for more information.
- **💡 Help mode toggle**: switch between compact and expanded views with inline explanations for all features.

This update makes time-based video workflows straightforward and helps users quickly find their way—from music videos to documentaries with voice-over.

![Audio Timeline Editor](docs/images/audio-timeline-editor.png) ![Audio Presentation Mode](docs/images/audio-presentation.png) ![Scene Dialog](docs/images/scene-dialog.png)


## update — 6 November 2025

This release enhances the scene editing workflow with quick navigation:

- **Scene dialog navigation**: when editing a scene in the popup dialog, you can now navigate directly to the previous or next scene using arrow buttons (⬅️ ➡️) in the dialog header. No need to close and reopen—just click through your scenes.
- **Keyboard shortcuts**: use the left and right arrow keys (← →) to quickly jump between scenes while editing. Works seamlessly unless you're typing in a text field.
- **Auto-save on navigation**: changes to prompts and translations are automatically saved when you navigate to another scene, ensuring no work is lost.
- **Smart button states**: navigation buttons are automatically disabled at the first and last scene, providing clear visual feedback about your position in the storyline.

This update makes it effortless to review and edit your entire storyline in one continuous flow, perfect for fine-tuning prompts and checking consistency across scenes.


## update — 5 November 2025

- Add video
   ![Copy scenes example](docs/images/uitbreiding-met-video.png)
- Presentation mode preview + video:
   ![Presentation mode example](docs/images/presentatie-met-video.png)

This release adds comprehensive video workflow support based on real-world user feedback:

- **Video upload per scene**: in addition to images, you can now upload the final rendered video (MP4/WebM) for each scene. This lets you keep prompts, reference images, and final results together in one place.
- **Toggle between image and video**: each scene card has a toggle to switch between viewing the reference image or the rendered video, keeping your workspace clean and focused.
- **Combined video presentation mode**: presentation mode now includes a "🎬 Video (auto-play)" option that plays all scene videos back-to-back as one continuous film. This gives you an instant preview of your entire production and helps identify what needs improvement.
- **Video timeline with scrubbing**: the presentation footer shows a timeline slider with markers for each video segment. Click or drag to jump to any point in your "film", with automatic prompt text sync.
- **Full video workflow**: videos are stored in a separate `videos/` folder per project, copied when duplicating projects or scenes, and support drag & drop upload just like images.
- **Popup dialog improvements**: when opening a scene, both the reference image and rendered video are displayed vertically for easy comparison.

Previous update: 4 November 2025

  ![Scene with video](docs/images/screenshot.png)
  ![Video presentation mode](docs/images/presentation.png)

How to use video features:

- **Upload video**: click the "🎬 Video" toggle on a scene card, then drag a video file or click to upload. Supported formats: MP4, WebM.
- **View in presentation**: click "Presentation" in the project header, then select "🎬 Video (auto-play)" from the mode dropdown. All videos play automatically with synced prompt text.
- **Navigate timeline**: use the slider in the footer to scrub through all videos, or use Previous/Next in image mode. Markers show where each video segment begins.
- **Compare results**: open any scene to see both the reference image (top) and rendered video (bottom) side by side.

These updates reflect ongoing development based on feedback from video AI creators who need to track both inputs (prompts/images) and outputs (rendered videos) in a single workspace.

## update — 4 November 2025

This release improves export workflows and dialog feedback:

- **Export notes/translations**: in addition to exporting prompts, you can now choose to export only notes or translations. The export dialog offers a menu to select what to export. Presentation mode also supports viewing prompts, notes, or both side by side.
- **Improved dialogs & feedback**: export status messages, image export confirmations, and project duplication now use professional modal dialogs instead of browser alerts. Copy-to-clipboard feedback shows confirmation.
- **Bug fixes & robustness**: fixed export handling for missing images, improved file permission handling, and ensured operations complete gracefully even when source files are temporarily unavailable. Exporting images multiple times now works reliably without re-clearing the output folder.

Previous published version: 3 November 2025



- Copy scenes dialog:  
   ![Copy scenes example](docs/images/copy_scenes.png)
- Presentation mode preview:
   ![Presentation mode example](docs/images/presentation.png)

How to use the new features (short):

- Copy a scene: open the scene menu (clipboard icon) and choose "Copy scene". Select target project (or choose the same project) and click "Duplicate in this project" or "Copy to project".
- Duplicate/delete project: in the project header use the "Duplicate project" or "Delete project" buttons. Deleting asks for confirmation.
- Presentation mode: click the "Presentation" button in the project header to enter fullscreen review mode. Use keyboard arrows to move between scenes.

These notes are also reflected in the Dutch README (`README.nl.md`).

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
# Uitleg (NL)

```
storylineprompteditor/
├─ assets/
│  ├─ css/
│  │  ├─ style.css                    # Hoofd stylesheet
│  │  ├─ variables.css                # CSS-variabelen (kleuren, spacing)
│  │  ├─ base.css                     # Reset & basisstijlen
│  │  ├─ layout.css                   # Grid- & flex-layouts
│  │  ├─ buttons.css                  # Knopstijlen
│  │  ├─ forms.css                    # Formulierelementen
│  │  ├─ dialogs.css                  # Modale dialogen
│  │  ├─ panels.css                   # Zijpanelen
│  │  ├─ projects.css                 # Projectlijst & kaarten
│  │  ├─ prompt-cards.css             # Scenekaart-stijlen
│  │  ├─ media-upload.css             # Upload- & preview-componenten
│  │  ├─ presentation.css             # Presentatiemodus
│  │  ├─ audio-timeline.css           # Audio-timeline editor
│  │  ├─ transitions.css              # Scene transitie-editor
│  │  ├─ attachments.css              # Bijlagen-interface
│  │  ├─ fullscreen-editor.css        # Fullscreen audio/video-editor
│  │  ├─ help-system.css              # Help-tooltips & badges
│  │  └─ responsive.css               # Mobiele responsiviteit
│  └─ js/
│     ├─ app.js                       # Hoofdscripts: applicatielogica en event-wiring
│     ├─ translations.js              # Taaldefinities (NL/EN)
│     └─ modules/
│        ├─ state.js                  # Centrale state-management
│        ├─ i18n.js                   # Internationalisatie & vertaling
│        ├─ constants.js              # Applicatieconstanten
│        ├─ file-system.js            # Wrappers voor File System Access API
│        ├─ utils.js                  # UUID, slugify, datum/tijd, JSON I/O
│        ├─ dialogs.js                # showError/showSuccess dialooghelpers
│        ├─ dom-helpers.js            # DOM-hulpfuncties & applyTranslations
│        ├─ ui-rendering.js           # UI-rendering functies
│        ├─ project-manager.js        # Project synchronisatie & structuur
│        ├─ project-operations.js     # Project CRUD-operaties
│        ├─ project-actions.js        # Projectacties (verouderd)
│        ├─ scenes.js                 # Scene/promptbeheer
│        ├─ scene-actions.js          # Scene CRUD-helpers
│        ├─ scene-copy.js             # Scene kopiëren tussen projecten
│        ├─ media-handlers.js         # Afbeelding/video upload & preview
│        ├─ upload-handlers.js        # Upload wrappers voor media
│        ├─ attachments.js            # Bestandsbijlagen per scene
│        ├─ presentation.js           # Fullscreen presentatiemodus
│        ├─ transitions.js            # Scene transitiebeheer
│        ├─ audio-timeline.js         # Audio-timeline (verouderd)
│        ├─ audio-video-editor.js     # Audio/video-timeline editor
│        ├─ drag-drop.js              # Drag & drop kaartherordening
│        ├─ export-handlers.js        # Exporteer prompts, afbeeldingen, notities
│        ├─ help.js                   # Contextueel help-systeem
│        └─ logger.js                 # Debug-logging (optioneel)
├─ docs/
│  └─ images/                         # Screenshots voor README
├─ server.sh                          # Start/stop script voor lokale server
├─ index.html                         # Ingang van de applicatie
├─ README.md                          # Engelstalige uitleg
└─ README.nl.md                       # Nederlandstalige uitleg
```
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

